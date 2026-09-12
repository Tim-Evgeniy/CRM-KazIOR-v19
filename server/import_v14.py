#!/usr/bin/env python3
"""Offline import of an explicit v14 JSON export into an empty v15 database."""
import base64
import copy
import json
import os
from pathlib import Path
import re
import secrets
import sys
from crm_store import Store,ROLES,clean_text,now,password_hash
from maintenance import ProcessLock,ROOT

ID=re.compile(r'^[A-Za-z0-9_:\-]{1,128}$')

def import_backup(source,dest):
    parsed=json.loads(Path(source).read_text('utf-8-sig'))
    data=parsed.get('data',parsed)
    if not isinstance(data,dict) or not isinstance(data.get('users'),list) or not isinstance(data.get('tickets'),list):raise ValueError('Нужен JSON-экспорт базы из v14.')
    dest=Path(dest);access=[]
    with ProcessLock(dest.parent):
        store=Store(dest)
        with store.db() as c:
            if any(store.all(c,k) for k in ('tickets','tasks','directChats')):raise ValueError('Импорт разрешён только в пустую v15. Для рабочего сервера подготовьте отдельную папку.')
            if len(store.all(c,'users'))>len(store.seed['users']):raise ValueError('В базе уже есть сотрудники. Импортируйте в новую папку v15.')
        backup=store.backup(dest.parent/'backups'/('before-import-'+secrets.token_hex(5)+'.sqlite3'))
        with store.db(True) as c:
            for kind in ('users','departments','tickets','tasks','notifications','directChats'):
                rows=data.get(kind,[])
                if not isinstance(rows,list):raise ValueError('Некорректный раздел '+kind)
                seen=set()
                for original in rows:
                    if not isinstance(original,dict) or not ID.fullmatch(str(original.get('id',''))):raise ValueError('Некорректный идентификатор в '+kind)
                    row=copy.deepcopy(original);rid=row['id']
                    if rid in seen:raise ValueError('Дубликат идентификатора в '+kind)
                    seen.add(rid);row.pop('_v',None)
                    if kind=='users':
                        existing=store.get(c,kind,rid)
                        if existing:continue  # Preserve the five configured engineers and their new passwords.
                        row.pop('password',None);row.pop('passwordHash',None)
                        row.update(role='employee',permissions=ROLES['employee'].copy(),status='active')
                        row['name']=clean_text(row.get('name'),160) or 'Импортированный сотрудник'
                        row['login']='import-'+secrets.token_hex(8);pw=secrets.token_urlsafe(12)
                        row.setdefault('theme','light');row.setdefault('interests',[]);row.setdefault('registeredAt',now())
                        c.execute('INSERT INTO accounts VALUES (?,?)',(rid,password_hash(pw)))
                        access.append(f"{row['name']}\nЛогин: {row['login']}\nПервый пароль: {pw}\n")
                    if kind=='tickets':
                        row.pop('wa',None)  # Historical data must not trigger sends to old numbers.
                        row.setdefault('messages',[]);row.setdefault('history',[]);row.setdefault('files',[])
                        row['history'].append({'date':now(),'actor':'Импорт v14','actorId':'u1','text':'Перенесено из экспортного файла. Историческая запись.'})
                        match=re.fullmatch(r'KZ-(\d+)',rid)
                        if match:c.execute("UPDATE meta SET value=max(value,?) WHERE key='ticket_number'",(int(match[1]),))
                    if kind=='directChats':row.setdefault('messages',[])
                    store.put(c,kind,row)
            for f in parsed.get('attachments',[]):
                if not isinstance(f,dict) or not ID.fullmatch(str(f.get('id',''))):raise ValueError('Некорректное вложение')
                url=f.get('dataUrl','')
                if not url.startswith('data:') or ';base64,' not in url:raise ValueError('Вложение не содержит экспортированных байтов')
                content=base64.b64decode(url.split(';base64,',1)[1],validate=True)
                if len(content)>10*1024*1024:raise ValueError('Есть вложение больше 10 МБ: '+str(f.get('name')))
                c.execute('INSERT INTO attachments VALUES (?,?,?,?,?)',(f['id'],'u1',clean_text(f.get('name'),200),clean_text(f.get('type'),100) or 'application/octet-stream',content))
            admin=store.get(c,'users','u1');store.log(c,admin,'Импорт v14','database','main')
        if access:
            fd=os.open(dest.parent/'IMPORTED_ACCESS.txt',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
            with os.fdopen(fd,'w',encoding='utf-8') as f:f.write('Выдавайте сотрудникам только их индивидуальные данные. Старые пароли не импортированы.\n\n'+'\n'.join(access))
        return {'tickets':len(data['tickets']),'users':len(access),'previous':str(backup)}

if __name__=='__main__':
    try:
        source=sys.argv[1] if len(sys.argv)>1 else input('Полный путь к JSON-копии v14: ').strip().strip('"')
        cfgpath=Path(__file__).with_name('config.local.json');cfg=json.loads(cfgpath.read_text('utf-8-sig')) if cfgpath.exists() else {}
        folder=Path(cfg.get('data_dir','data'));folder=folder if folder.is_absolute() else ROOT/folder
        result=import_backup(source,folder/'crm.sqlite3')
        print('Перенос завершён. Заявок:',result['tickets'],'; сотрудников:',result['users'])
        print('Первый вход перенесённых сотрудников: data/IMPORTED_ACCESS.txt. Данные пяти инженеров: data/FIRST_LOGIN.txt.')
    except (ValueError,OSError,RuntimeError) as e:
        print('Перенос не выполнен: '+str(e));raise SystemExit(1)
