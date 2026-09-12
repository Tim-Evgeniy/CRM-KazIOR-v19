"""Shared SQLite CRM storage, authorization and transactional event/outbox handling."""
import base64
import contextlib
import copy
import datetime as dt
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time
import unicodedata

KINDS = ('users', 'departments', 'tickets', 'tasks', 'notifications', 'directChats')
PERMISSIONS = ('viewAllTickets','viewAllChats','manageTickets','assignTickets','manageUsers','manageTasks','manageDepartments','viewReports','manageIntegrations')
ROLES = {
 'superadmin': dict.fromkeys(PERMISSIONS, True),
 'admin': dict.fromkeys(PERMISSIONS, True),
 'engineer': {p: p == 'manageTickets' for p in PERMISSIONS},
 'employee': dict.fromkeys(PERMISSIONS, False),
}
STATUS = {'new':'Новая','working':'В работе','waiting':'Ожидание','done':'Выполнено','closed':'Закрыта'}

class Fault(Exception):
    def __init__(self, message, code=400):
        super().__init__(message)
        self.code = code

def now():
    return dt.datetime.now(dt.timezone(dt.timedelta(hours=5))).strftime('%d.%m.%Y %H:%M')

def js(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(',', ':'))

def phone(value):
    number = re.sub(r'\D', '', str(value or ''))
    if len(number) == 11 and number.startswith('8'): number = '7' + number[1:]
    return '+' + number if 8 <= len(number) <= 15 else ''

def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()

def password_hash(value, salt=None):
    salt = salt or secrets.token_hex(16)
    result = hashlib.scrypt(value.encode(), salt=salt.encode(), n=16384, r=8, p=1).hex()
    return salt + ':' + result

def password_ok(value, stored):
    try: return hmac.compare_digest(password_hash(value, stored.split(':')[0]), stored)
    except (ValueError, TypeError): return False

def name_key(value):
    return ' '.join(unicodedata.normalize('NFKC', str(value)).split()).casefold()

def clean_text(value, limit=16000):
    if not isinstance(value, str): return ''
    return ''.join(c for c in value[:limit] if c >= ' ' or c in '\n\t').strip()

def is_staff(u): return u.get('role') in ('superadmin','admin','engineer')
def permit(u, p):
    if u.get('role') == 'employee': return False
    return u.get('role') == 'superadmin' or u.get('permissions', ROLES.get(u.get('role'), {})).get(p, False)

def safe_profile(u):
    return {k:v for k,v in u.items() if k not in ('password','passwordHash','device','token')}

class Store:
    def __init__(self, path, seed=None):
        self.path = Path(path).resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.seed = seed or json.loads(Path(__file__).with_name('seed.json').read_text('utf-8'))
        with self.db() as c:
            c.executescript('''
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS records(kind TEXT, id TEXT, data TEXT NOT NULL, version INTEGER NOT NULL, PRIMARY KEY(kind,id));
            CREATE INDEX IF NOT EXISTS idx_records_owner ON records(kind,json_extract(data,'$.ownerId'));
            CREATE INDEX IF NOT EXISTS idx_records_engineer ON records(kind,json_extract(data,'$.engineerId'));
            CREATE INDEX IF NOT EXISTS idx_records_recipient ON records(kind,json_extract(data,'$.recipientId'));
            CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value INTEGER NOT NULL);
            INSERT OR IGNORE INTO meta VALUES ('revision',0),('ticket_number',0),('schema',15);
            CREATE TABLE IF NOT EXISTS accounts(uid TEXT PRIMARY KEY, hash TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS devices(hash TEXT PRIMARY KEY,uid TEXT NOT NULL,name_key TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,uid TEXT NOT NULL,expires REAL NOT NULL);
            CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
            CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY,actor TEXT,action TEXT,kind TEXT,record_id TEXT,stamp TEXT);
            CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY,owner TEXT,name TEXT,mime TEXT,data BLOB NOT NULL);
            CREATE TABLE IF NOT EXISTS wa_events(key TEXT PRIMARY KEY,ticket_id TEXT,outcome TEXT,stamp TEXT);
            CREATE TABLE IF NOT EXISTS wa_links(channel TEXT,chat TEXT,uid TEXT,PRIMARY KEY(channel,chat));
            CREATE TABLE IF NOT EXISTS wa_codes(code TEXT PRIMARY KEY,uid TEXT,expires REAL);
            CREATE TABLE IF NOT EXISTS wa_messages(channel TEXT,message_id TEXT,ticket_id TEXT,chat TEXT,PRIMARY KEY(channel,message_id));
            CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,channel TEXT,chat TEXT,message TEXT,state TEXT,attempts INTEGER DEFAULT 0,next_try REAL DEFAULT 0,provider_id TEXT,error TEXT,ticket_id TEXT,created TEXT);
            CREATE INDEX IF NOT EXISTS idx_outbox_ready ON outbox(channel,state,next_try);
            CREATE TABLE IF NOT EXISTS mutations(uid TEXT,key TEXT,response TEXT,PRIMARY KEY(uid,key));
            ''')
            if not c.execute("SELECT 1 FROM records WHERE kind='settings'").fetchone():
                passwords = []
                for kind in ('users','departments'):
                    for row in self.seed[kind]:
                        row = copy.deepcopy(row)
                        if kind == 'users':
                            row['permissions'] = ROLES[row['role']].copy()
                            pw = 'KazIOR@2026' if row['role']=='engineer' else secrets.token_urlsafe(12)
                            c.execute('INSERT INTO accounts VALUES (?,?)',(row['id'],password_hash(pw)))
                            passwords.append(f"{row['name']}\nЛогин: {row['login']}\nПароль: {pw}\n")
                        self.put(c,kind,row)
                self.put(c,'settings',dict(self.seed['settings'],id='main'))
                creds = self.path.parent / 'FIRST_LOGIN.txt'
                fd = os.open(creds, os.O_WRONLY|os.O_CREAT|os.O_EXCL, 0o600)
                with os.fdopen(fd,'w',encoding='utf-8') as f:
                    f.write('Личные пароли инженеров. Храните у администратора. Не отправляйте общий файл сотрудникам.\n\n'+'\n'.join(passwords))
        self.migrate_v16()
        self.migrate_v17()
        try:
            os.chmod(self.path.parent,0o700); os.chmod(self.path,0o600)
        except OSError: pass

    def migrate_v16(self):
        # One-time migration: never reset a password again on ordinary restart.
        with self.db(True) as c:
            c.executescript("""
            CREATE TABLE IF NOT EXISTS tg_links(chat TEXT PRIMARY KEY,uid TEXT UNIQUE,phone TEXT);
            CREATE TABLE IF NOT EXISTS tg_codes(code TEXT PRIMARY KEY,uid TEXT,expires REAL);
            CREATE TABLE IF NOT EXISTS tg_pending(chat TEXT PRIMARY KEY,data TEXT);
            CREATE TABLE IF NOT EXISTS tg_events(id INTEGER PRIMARY KEY,outcome TEXT);
            CREATE TABLE IF NOT EXISTS tg_messages(chat TEXT,message_id TEXT,ticket_id TEXT,PRIMARY KEY(chat,message_id));
            CREATE TABLE IF NOT EXISTS tg_outbox(id TEXT PRIMARY KEY,chat TEXT,text TEXT,markup TEXT,state TEXT,attempts INTEGER DEFAULT 0,next_try REAL DEFAULT 0,error TEXT,provider_id TEXT,ticket_id TEXT,created TEXT);
            CREATE TABLE IF NOT EXISTS eds_challenges(id TEXT PRIMARY KEY,uid TEXT,purpose TEXT,payload TEXT,expires REAL,used INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS eds_bindings(iin TEXT PRIMARY KEY,uid TEXT UNIQUE);
            """)
            if not c.execute("SELECT 1 FROM meta WHERE key='v16_engineers'").fetchone():
                engineer=next((x for x in self.seed['users'] if x['id']=='u3'),None)
                if engineer:
                    existing=self.get(c,'users','u3')
                    if not existing or name_key(existing.get('name','')).startswith('баракбаева айжан') or existing.get('login')=='abarakbaeva':
                        self.put(c,'users',{**(existing or {}),**engineer,'permissions':ROLES['engineer'].copy()})
                    else:raise Fault('Идентификатор Айжан u3 занят другой записью. Проверьте справочник перед обновлением.')
                for u in self.all(c,'users'):
                    if u.get('role')=='engineer':
                        c.execute('INSERT OR REPLACE INTO accounts VALUES (?,?)',(u['id'],password_hash('KazIOR@2026')))
                        c.execute('DELETE FROM sessions WHERE uid=?',(u['id'],))
                c.execute("INSERT INTO meta VALUES ('v16_engineers',1)")
            c.execute("UPDATE meta SET value=16 WHERE key='schema'")
            c.execute("INSERT OR IGNORE INTO meta VALUES ('telegram_offset',0),('document_number',0)")

    def migrate_v17(self):
        with self.db(True) as c:
            if not c.execute("SELECT 1 FROM meta WHERE key='v17_profiles'").fetchone():
                for seed in self.seed['users']:
                    existing=self.get(c,'users',seed['id'])
                    if existing:
                        # Profile details only: never overwrite roles, phone edits or passwords.
                        if existing.get('login')==seed.get('login'):
                            existing.update(education=seed.get('education',''),degree=seed.get('degree',''))
                            self.put(c,'users',existing)
                    elif seed['id']=='u-zhainar':
                        self.put(c,'users',{**seed,'permissions':ROLES['engineer'].copy()})
                        c.execute('INSERT INTO accounts VALUES (?,?)',(seed['id'],password_hash('KazIOR@2026')))
                c.execute("INSERT INTO meta VALUES ('v17_profiles',1)")
            c.execute("UPDATE meta SET value=17 WHERE key='schema'")

    @contextlib.contextmanager
    def db(self, write=False):
        c = sqlite3.connect(self.path, timeout=20)
        c.row_factory = sqlite3.Row
        c.execute('PRAGMA busy_timeout=20000')
        c.execute('PRAGMA synchronous=FULL')
        try:
            if write: c.execute('BEGIN IMMEDIATE')
            yield c
            c.commit()
        except Exception:
            c.rollback(); raise
        finally: c.close()

    def get(self,c,kind,rid):
        row=c.execute('SELECT data,version FROM records WHERE kind=? AND id=?',(kind,rid)).fetchone()
        if row is None: return None
        return dict(json.loads(row['data']),_v=row['version'])

    def all(self,c,kind):
        return [dict(json.loads(r['data']),_v=r['version']) for r in c.execute('SELECT data,version FROM records WHERE kind=? ORDER BY rowid DESC',(kind,))]

    def put(self,c,kind,item):
        item = {k:v for k,v in item.items() if k != '_v'}
        c.execute("UPDATE meta SET value=value+1 WHERE key='revision'")
        rev=c.execute("SELECT value FROM meta WHERE key='revision'").fetchone()[0]
        c.execute('INSERT INTO records VALUES (?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,version=excluded.version',(kind,item['id'],js(item),rev))
        return dict(item,_v=rev)

    def log(self,c,u,action,kind,rid):
        c.execute('INSERT INTO audit(actor,action,kind,record_id,stamp) VALUES (?,?,?,?,?)',(u['id'],action,kind,rid,now()))

    def can_view(self,u,kind,row):
        uid=u['id']
        if kind=='users': return is_staff(u) or row['id']==uid or row.get('status')=='active'
        if kind in ('settings','departments'): return True
        if kind=='tickets': return permit(u,'viewAllTickets') or row.get('ownerId')==uid or (is_staff(u) and row.get('engineerId','') in ('',uid))
        if kind=='notifications': return row.get('recipientId')==uid
        if kind=='directChats': return uid in row.get('participants',[]) or permit(u,'viewAllChats')
        if kind=='documents': return u['role']=='superadmin' or uid in [row['ownerId'],*row.get('reviewers',[]),*row.get('signers',[])]
        if kind=='tasks': return u['role']=='superadmin' or uid in (row.get('creatorId'),row.get('assigneeId'))
        return False

    def snapshot(self,u,after=None):
        with self.db() as c:
            c.execute('BEGIN')
            u=self.get(c,'users',u['id'])
            if not u or u.get('status')!='active': raise Fault('Войдите снова',401)
            rev=c.execute("SELECT value FROM meta WHERE key='revision'").fetchone()[0]
            if str(after)==str(rev): return {'revision':rev,'unchanged':True}
            result={}
            for k in KINDS:
                if k=='tickets' and not is_staff(u):
                    rows=[dict(json.loads(r['data']),_v=r['version']) for r in c.execute("SELECT data,version FROM records WHERE kind='tickets' AND json_extract(data,'$.ownerId')=? ORDER BY rowid DESC",(u['id'],))]
                elif k=='notifications':
                    rows=[dict(json.loads(r['data']),_v=r['version']) for r in c.execute("SELECT data,version FROM records WHERE kind='notifications' AND json_extract(data,'$.recipientId')=? ORDER BY rowid DESC",(u['id'],))]
                else: rows=self.all(c,k)
                result[k]=[safe_profile(row) for row in rows if self.can_view(u,k,row)]
            if not is_staff(u):
                result['users']=[r if r['id']==u['id'] else {k:v for k,v in r.items() if k in ('id','name','role','phone','photo','position','dept','deptId','org','status','workStatus','education','degree','_v')} for r in result['users']]
            result['settings']=self.get(c,'settings','main')
            result.update(lastNo=0,theme=u.get('theme','light'),chatAccessAudit=[],mailMessages=[],integrations={'whatsapp':{'receiveMode':'shared','incomingEnabled':False},'mail':{},'log':[]})
            return {'db':result,'user':safe_profile(u),'revision':rev}

    def login_name(self,data):
        name=clean_text(data.get('name'),160)
        if not name: raise Fault('Напишите своё ФИО')
        device=str(data.get('device') or '')
        with self.db(True) as c:
            row=c.execute('SELECT uid,name_key FROM devices WHERE hash=?',(digest(device),)).fetchone() if device else None
            u=self.get(c,'users',row['uid']) if row and row['name_key']==name_key(name) else None
            if not u or u['role']!='employee':
                uid='u-'+secrets.token_hex(12)
                u={'id':uid,'name':name,'login':'employee-'+uid[2:10],'role':'employee','status':'active','workStatus':'available','org':'КазНИИОиР','dept':'','deptId':'','phone':'','email':'','position':'Сотрудник / врач','photo':'','about':'','interests':[],'theme':'light','registeredAt':now(),'permissions':ROLES['employee'].copy()}
                self.put(c,'users',u)
                device=secrets.token_urlsafe(32)
                c.execute('INSERT INTO devices VALUES (?,?,?)',(digest(device),uid,name_key(name)))
                self.log(c,u,'Регистрация по ФИО','users',uid)
            if u['status']!='active': raise Fault('Учётная запись отключена. Обратитесь к администратору.',403)
            token=self.session(c,u)
        return {'token':token,'device':device,**self.snapshot(u)}

    def session(self,c,u):
        token=secrets.token_urlsafe(32)
        c.execute('DELETE FROM sessions WHERE expires<?',(time.time(),))
        c.execute('INSERT INTO sessions VALUES (?,?,?)',(digest(token),u['id'],time.time()+12*3600))
        return token

    def login_password(self,data):
        login=clean_text(data.get('login'),160).casefold()
        pw=str(data.get('password',''))[:1024]
        with self.db(True) as c:
            users=self.all(c,'users')
            matches=[x for x in users if x.get('login','').casefold()==login]
            if not matches:matches=[x for x in users if is_staff(x) and name_key(x.get('name',''))==name_key(login)]
            if len(matches)!=1: raise Fault('Укажите точное ФИО или личный логин',401)
            u=matches[0]
            row=c.execute('SELECT hash FROM accounts WHERE uid=?', (u['id'],)).fetchone() if u else None
            valid=password_ok(pw,row['hash'] if row else password_hash('invalid','0'*32))
            if not u or not row or not valid or u.get('status')!='active': raise Fault('Неверный логин или пароль',401)
            token=self.session(c,u)
        result={'token':token,**self.snapshot(u)}
        if u['role']=='employee':
            device=secrets.token_urlsafe(32)
            with self.db(True) as c:c.execute('INSERT INTO devices VALUES (?,?,?)',(digest(device),u['id'],name_key(u['name'])))
            result['device']=device
        return result

    def authenticate(self,token):
        with self.db() as c:
            row=c.execute('SELECT uid FROM sessions WHERE hash=? AND expires>?',(digest(token),time.time())).fetchone()
            u=self.get(c,'users',row['uid']) if row else None
        if not u or u.get('status')!='active': raise Fault('Войдите в CRM',401)
        return u

    def notice(self,c,uid,title,body,ticket=''):
        if not uid or not self.get(c,'users',uid): return
        nid='n-'+secrets.token_hex(12)
        self.telegram_notice(c,uid,title,body,ticket,nid)
        self.put(c,'notifications',{'id':nid,'recipientId':uid,'title':title,'text':body[:250],'ticketId':ticket,'date':now(),'read':False})

    def telegram_notice(self,c,uid,title,body,ticket,unique):
        link=c.execute('SELECT chat FROM tg_links WHERE uid=?',(uid,)).fetchone()
        if not link: return
        full=f"CRM КазНИИОиР · {title}\n{body}"
        if ticket.startswith('KZ-'): full+=f"\nОтвет: {ticket} ваш текст"
        elif ticket.startswith('dm:'): full+="\nОткройте личный чат в CRM для ответа."
        self.telegram_enqueue(c,link['chat'],full,unique,ticket)

    def telegram_enqueue(self,c,chat,text,unique,ticket='',markup=None):
        chunks=[];chunk='';units=0
        for char in text:
            width=2 if ord(char)>0xffff else 1
            if units+width>3900:chunks.append(chunk);chunk='';units=0
            chunk+=char;units+=width
        if chunk:chunks.append(chunk)
        for i,part in enumerate(chunks):
            c.execute("INSERT OR IGNORE INTO tg_outbox(id,chat,text,markup,state,ticket_id,created) VALUES (?,?,?,?,'pending',?,?)",(digest(unique+'-'+str(i)),str(chat),part,js(markup or {}),ticket,now()))

    def enqueue(self,c,channel,chat,message,ticket_id,unique):
        if not chat: return
        c.execute("INSERT OR IGNORE INTO outbox(id,channel,chat,message,state,ticket_id,created) VALUES (?,?,?,?,'pending',?,?)",(digest(unique),channel,chat,message[:19000],ticket_id,now()))

    def team_event(self,c,t,actor,title,body):
        team=[u for u in self.all(c,'users') if is_staff(u) and u.get('status')=='active']
        targets=[u for u in team if not t.get('engineerId') or u['id']==t['engineerId']]
        for u in targets:
            if u['id']!=actor:
                self.notice(c,u['id'],title,body,t['id'])
                if phone(u.get('phone')) and (not title.startswith('Новая заявка') or getattr(self,'notification_config',{}).get('whatsapp_notifications',{}).get('notify_new',True)):
                    if t.get('source')=='WhatsApp' and t.get('wa',{}).get('engineerId')==u['id'] and str(actor).startswith('wa-'): continue
                    self.enqueue(c,'dispatch',phone(u['phone'])[1:]+'@c.us',f"CRM КазНИИОиР · {title}\n{body}\nОткройте CRM для ответа.",t['id'],title+body+u['id']+str(t.get('_v',now())))

    def validate_files(self,c,u,files,existing=()):
        if not isinstance(files,list) or len(files)>20: raise Fault('Не более 20 вложений')
        allowed={f.get('id') for f in existing if isinstance(f,dict)}
        result=[]
        for f in files:
            if not isinstance(f,dict): raise Fault('Некорректное вложение')
            fid=f.get('id')
            row=c.execute('SELECT owner,name,mime,length(data) size FROM attachments WHERE id=?',(fid,)).fetchone()
            if fid in allowed: result.append(f); continue
            if not row or row['owner']!=u['id']: raise Fault('Нет доступа к вложению',403)
            result.append({'id':fid,'name':row['name'],'type':row['mime'],'size':row['size']})
        return result

    def whatsapp_target(self,c,t):
        if t.get('wa'):return t['wa']
        linked=c.execute('SELECT channel,chat FROM wa_links WHERE uid=? ORDER BY rowid DESC LIMIT 1',(t['ownerId'],)).fetchone()
        if linked:return dict(linked)
        channels=[x for x in getattr(self,'notification_config',{}).get('channels',[]) if x.get('enabled') and x.get('api_token')]
        channel=next((x for x in channels if x.get('routing')=='common'),None) or next((x for x in channels if x.get('engineer_id')==t.get('engineerId')),None) or next(iter(channels),None)
        contact=phone(t.get('phone'))
        if channel and contact:return {'channel':channel['id'],'chat':contact[1:]+'@c.us'}
        return None

    def whatsapp_text(self,t,change):
        status=STATUS.get(t.get('status'),'Новая')
        if change.startswith('Ответ: '):
            return f"CRM КазНИИОиР · Ответ по заявке {t['id']}\nТема: {t['subject']}\n\n{change[7:]}\n\nСтатус: {status}\nИнженер: {t.get('engineerName','Не назначен')}\n\nIT-System-Solution\nwww.its24.kz\n\nДля ответа: {t['id']} ваш текст"
        return f"CRM КазНИИОиР · 🔔 Статус заявки\n№ {t['id']}\nТема: {t['subject']}\nНовый статус: {status}\nИнженер: {t.get('engineerName','Не назначен')}\n\nIT-System-Solution\nwww.its24.kz\n\nДля ответа: {t['id']} ваш текст"

    def new_ticket(self,c,u,data,source='Web',owner=None,engineer='',wa=None):
        subject=clean_text(data.get('subject'),180)
        if not subject: raise Fault('Опишите, что не работает')
        contact=phone(data.get('phone')) or phone(u.get('phone'))
        if not contact: raise Fault('Укажите телефон для связи: например, +7 777 000 00 00')
        data=dict(data,phone=contact)
        c.execute("UPDATE meta SET value=value+1 WHERE key='ticket_number'")
        no=c.execute("SELECT value FROM meta WHERE key='ticket_number'").fetchone()[0]
        eid=self.get(c,'users',engineer) if engineer else None
        if engineer and (not eid or not is_staff(eid) or eid.get('status')!='active'): raise Fault('Выберите действующего инженера')
        t={'id':f'KZ-{no:06d}','ownerId':owner or u['id'],'ownerName':u['name'],'org':'КазНИИОиР','dept':clean_text(data.get('dept'),160),'room':clean_text(data.get('room'),80),'location':clean_text(data.get('location'),160),'phone':phone(data.get('phone')),'source':source,'category':clean_text(data.get('category'),80).replace('‑','-') or 'Другое','priority':data.get('priority','P3') if data.get('priority') in ('P1','P2','P3','P4') else 'P3','subject':subject,'description':clean_text(data.get('description')),'status':'new','engineerId':engineer,'engineerName':eid['name'] if eid else 'Не назначен','created':now(),'files':data.get('files',[]),'messages':[],'history':[{'date':now(),'actor':u['name'],'actorId':u['id'],'text':'Заявка создана · '+source}]}
        if source=='Web' and not wa:
            wa=self.whatsapp_target(c,t)
        if wa: t.update(wa=wa,waMessageKey=wa.get('key'))
        t=self.put(c,'tickets',t)
        if source=='Web' and wa:
            self.enqueue(c,wa['channel'],wa['chat'],f"CRM КазНИИОиР · заявка {t['id']} создана в CRM.\nДля ответа напишите: {t['id']} ваш текст.",t['id'],t['id']+'-web-created')
        self.log(c,u,'Создание','tickets',t['id'])
        self.team_event(c,t,u['id'],'Новая заявка '+t['id'],t['ownerName']+' · '+t['phone']+'\n'+t['subject'])
        return t

    def create_ticket(self,u,data,key):
        if not re.fullmatch(r'[a-zA-Z0-9-]{16,100}',key or ''): raise Fault('Не задан идентификатор операции')
        with self.db(True) as c:
            saved=c.execute('SELECT response FROM mutations WHERE uid=? AND key=?',(u['id'],key)).fetchone()
            if saved: return json.loads(saved[0])
            data=dict(data,files=self.validate_files(c,u,data.get('files',[])))
            fresh=self.get(c,'users',u['id'])
            t=self.new_ticket(c,fresh,data,engineer=clean_text(data.get('engineerId'),80))
            fresh['phone']=t['phone'];self.put(c,'users',fresh)
            result={'ticket':t}
            c.execute('INSERT INTO mutations VALUES (?,?,?)',(u['id'],key,js(result)))
        return result

    def append_messages(self,c,u,old,new):
        previous=old.get('messages',[])
        incoming=new.get('messages',[])
        if not isinstance(incoming,list) or len(incoming)<len(previous) or len(incoming)>len(previous)+10: raise Fault('История переписки не может быть удалена')
        result=copy.deepcopy(previous)
        for i,msg in enumerate(previous):
            editable=incoming[i]
            if {k:v for k,v in editable.items() if k!='readBy'}!={k:v for k,v in msg.items() if k!='readBy'}: raise Fault('Нельзя переписывать сообщения',403)
            if u['id'] in editable.get('readBy',[]): result[i]['readBy']=list(set(msg.get('readBy',[])+[u['id']]))
        added=[]
        for msg in incoming[len(previous):]:
            body=clean_text(msg.get('text'))
            files=self.validate_files(c,u,msg.get('files',[]))
            if not body and not files: continue
            m={'id':'msg-'+secrets.token_hex(12),'author':u['name'],'authorId':u['id'],'text':body,'date':now(),'files':files,'readBy':[u['id']]}
            added.append(m); result.append(m)
        return result,added

    def patch(self,u,ops,key):
        if not isinstance(ops,list) or len(ops)>100: raise Fault('Слишком много изменений за один раз')
        if not re.fullmatch(r'[a-zA-Z0-9-]{16,100}',key or ''): raise Fault('Не задан идентификатор операции')
        with self.db(True) as c:
            if c.execute('SELECT 1 FROM mutations WHERE uid=? AND key=?',(u['id'],key)).fetchone(): return
            u=self.get(c,'users',u['id'])
            for op in ops:
                kind=op.get('kind'); row=op.get('value'); rid=op.get('id')
                if kind not in KINDS+('settings',) or not isinstance(rid,str): raise Fault('Неизвестный тип записи')
                old=self.get(c,kind,rid)
                if old and not self.can_view(u,kind,old): raise Fault('Нет доступа к записи',403)
                if (old or {}).get('_v',0)!=op.get('version',0): raise Fault('Запись уже изменена на другом компьютере. Обновите данные и повторите действие.',409)
                if op.get('delete'):
                    if kind=='tasks' and old and (old.get('creatorId')==u['id'] or u['role']=='superadmin'):
                        c.execute('DELETE FROM records WHERE kind=? AND id=?',(kind,rid));c.execute("UPDATE meta SET value=value+1 WHERE key='revision'");self.log(c,u,'Удаление',kind,rid);continue
                    raise Fault('Удаление записи запрещено',403)
                if not isinstance(row,dict) or row.get('id')!=rid: raise Fault('Некорректная запись')
                out=copy.deepcopy(old or {'id':rid})
                if kind=='users':
                    if u['id']!=rid and u['role']!='superadmin': raise Fault('Управление пользователями доступно супер-администратору',403)
                    fields=('name','location','dept','deptId','position','education','degree','phone','email','photo','about','interests','theme','workStatus','backgroundImage')
                    if u['role']=='superadmin': fields+=('login','role','status','permissions')
                    for f in fields:
                        if f in row: out[f]=row[f]
                    if not old and u['role']!='superadmin': raise Fault('Недостаточно прав',403)
                    role=out.get('role','employee')
                    if role not in ROLES: raise Fault('Неизвестная роль')
                    if out.get('workStatus','available') not in ('available','busy','away','dnd'):raise Fault('Выберите статус доступности')
                    if out.get('status','active') not in ('active','pending','blocked'):raise Fault('Выберите статус учётной записи')
                    if u['role']=='superadmin':
                        out['login']=clean_text(out.get('login'),160)
                        if not out['login']:raise Fault('Укажите логин')
                        if any(x['id']!=rid and x.get('login','').casefold()==out['login'].casefold() for x in self.all(c,'users')):raise Fault('Этот логин уже используется')
                    if rid==u['id'] and u['role']=='superadmin' and (role!='superadmin' or out.get('status')!='active'): raise Fault('Нельзя отключить собственную учётную запись администратора')
                    # Reject tampering, including from a user who edits the HTTP request directly.
                    if u['role']!='superadmin' and any(row.get(f)!=old.get(f) for f in ('role','status','permissions','login')): raise Fault('Нельзя менять собственные права',403)
                    out['permissions']=ROLES['employee'].copy() if role=='employee' else {p:bool(out.get('permissions',ROLES[role]).get(p,False)) for p in PERMISSIONS}
                    out.setdefault('registeredAt',now());out.setdefault('status','active');out.setdefault('org','КазНИИОиР');out.setdefault('interests',[])
                    out['name']=clean_text(out.get('name'),160)
                    if not out['name']: raise Fault('Укажите ФИО')
                    pw=row.get('password')
                    if pw:
                        if u['role']!='superadmin': raise Fault('Смена пароля доступна администратору',403)
                        if len(pw)<10: raise Fault('Пароль должен содержать не менее 10 символов')
                        c.execute('INSERT OR REPLACE INTO accounts VALUES (?,?)',(rid,password_hash(pw)))
                        c.execute('DELETE FROM sessions WHERE uid=?',(rid,))
                    if not old and role!='employee' and not pw: raise Fault('Задайте пароль инженера')
                    if old and any(out.get(f)!=old.get(f) for f in ('role','status')): c.execute('DELETE FROM sessions WHERE uid=?',(rid,))
                elif kind=='tickets':
                    if not old: raise Fault('Создайте заявку через форму')
                    manage=is_staff(u) and (permit(u,'manageTickets') or permit(u,'assignTickets'))
                    allowed=('subject','description','dept','room','location','phone','category','priority') if old.get('ownerId')==u['id'] or manage else ()
                    for f in allowed:
                        if f in row: out[f]=clean_text(row[f],16000 if f=='description' else 180)
                    if out.get('phone')!=old.get('phone') and not phone(out.get('phone')): raise Fault('Телефон обязателен')
                    if row.get('ownerId')!=old.get('ownerId') or row.get('source')!=old.get('source'): raise Fault('Нельзя менять автора и источник заявки',403)
                    for f in ('status','engineerId','slaDue','acceptedAt','doneAt'):
                        if row.get(f)!=old.get(f):
                            if not manage: raise Fault('Сотрудник не может управлять заявкой инженера',403)
                            if f=='engineerId' and not permit(u,'assignTickets') and not (old.get('engineerId','') in ('',u['id']) and row.get(f)==u['id']): raise Fault('Недостаточно прав для переназначения',403)
                            out[f]=row.get(f)
                    if out.get('status') not in STATUS: raise Fault('Неизвестный статус')
                    eng=self.get(c,'users',out.get('engineerId',''))
                    if out.get('engineerId') and (not eng or not is_staff(eng) or eng.get('status')!='active'): raise Fault('Инженер недоступен')
                    out['engineerName']=eng['name'] if eng else 'Не назначен'
                    out['messages'],added=self.append_messages(c,u,old,row)
                    out['files']=self.validate_files(c,u,row.get('files',[]),old.get('files',[]))
                    changes=[]
                    if out.get('status')!=old.get('status'): changes.append('Статус: '+STATUS[out['status']])
                    if out.get('engineerId')!=old.get('engineerId'): changes.append('Инженер: '+out['engineerName'])
                    for m in added: changes.append('Ответ: '+m['text'])
                    for change in changes:
                        out.setdefault('history',[]).append({'date':now(),'actor':u['name'],'actorId':u['id'],'text':change})
                        if u['id']!=out['ownerId']: self.notice(c,out['ownerId'],out['id'],change,out['id'])
                        self.team_event(c,out,u['id'],out['id'],u['name']+': '+change)
                        if is_staff(u):
                            wa=self.whatsapp_target(c,out)
                            setting='notify_reply' if change.startswith('Ответ: ') else 'notify_status'
                            if wa and getattr(self,'notification_config',{}).get('whatsapp_notifications',{}).get(setting,True):
                                out['wa']=wa
                                self.enqueue(c,wa['channel'],wa['chat'],self.whatsapp_text(out,change),out['id'],key+change)
                    if not changes and any(out.get(f)!=old.get(f) for f in allowed): out.setdefault('history',[]).append({'date':now(),'actor':u['name'],'actorId':u['id'],'text':'Изменены данные заявки'})
                elif kind=='notifications':
                    if not old or old['recipientId']!=u['id']: raise Fault('Нет доступа к уведомлению',403)
                    out['read']=bool(row.get('read'))
                elif kind=='directChats':
                    parts=row.get('participants',[])
                    if not old:
                        if len(parts)!=2 or u['id'] not in parts: raise Fault('Некорректный чат')
                        other=self.get(c,'users',next(p for p in parts if p!=u['id']))
                        if not other or (not is_staff(u) and not is_staff(other)): raise Fault('Выберите инженера',403)
                        out.update(participants=parts,created=now(),messages=[])
                    if u['id'] not in out.get('participants',[]): raise Fault('Аудит не разрешает писать от чужого имени',403)
                    if old and parts!=old['participants']: raise Fault('Нельзя менять участников чата',403)
                    out['messages'],added=self.append_messages(c,u,old or {'messages':[]},row)
                    out['updatedAt']=now()
                    for m in added:
                        for other in parts:
                            if other!=u['id']:
                                self.notice(c,other,'Сообщение от '+u['name'],m['text'],'dm:'+rid)
                                target=self.get(c,'users',other)
                                if target and is_staff(target) and phone(target.get('phone')): self.enqueue(c,'dispatch',phone(target['phone'])[1:]+'@c.us','CRM КазНИИОиР · сообщение от '+u['name']+'\n'+m['text']+'\nОтветьте в чате CRM.','',m['id']+other)
                elif kind=='tasks':
                    if not old:
                        out=dict(row,creatorId=u['id'])
                        if not permit(u,'manageTasks'): out['assigneeId']=u['id']
                    elif old.get('creatorId')==u['id'] or u['role']=='superadmin':
                        for f in ('title','description','status','due','assigneeId'): out[f]=row.get(f,old.get(f))
                        if not permit(u,'manageTasks'): out['assigneeId']=old.get('assigneeId')
                    elif old.get('assigneeId')==u['id']: out['status']=row.get('status',old.get('status'))
                    else: raise Fault('Нет доступа к задаче',403)
                    out['creatorId']=(old or {}).get('creatorId',u['id']);out['readBy']=list(set(out.get('readBy',[])+[u['id']]))
                    assigned=self.get(c,'users',out.get('assigneeId',''))
                    if not assigned: raise Fault('Исполнитель не найден')
                    out['assignee']=assigned['name']
                elif kind in ('departments','settings'):
                    if not (u['role']=='superadmin' or kind=='departments' and permit(u,'manageDepartments')): raise Fault('Недостаточно прав',403)
                    out=row
                self.put(c,kind,safe_profile(out)); self.log(c,u,'Изменение' if old else 'Создание',kind,rid)
            c.execute('INSERT INTO mutations VALUES (?,?,?)',(u['id'],key,'{}'))

    def upload(self,u,name,mime,content):
        if not content or len(content)>10*1024*1024: raise Fault('Файл должен быть от 1 байта до 10 МБ')
        aid='att-'+secrets.token_hex(16)
        name=clean_text(name,200) or 'attachment'
        mime=clean_text(mime,100) or 'application/octet-stream'
        with self.db(True) as c: c.execute('INSERT INTO attachments VALUES (?,?,?,?,?)',(aid,u['id'],name,mime,content))
        return {'id':aid,'name':name,'type':mime,'size':len(content)}

    def attachment(self,u,aid):
        with self.db() as c:
            row=c.execute('SELECT * FROM attachments WHERE id=?',(aid,)).fetchone()
            if not row: raise Fault('Файл не найден',404)
            allowed=row['owner']==u['id']
            if not allowed:
                for kind in ('tickets','directChats','documents'):
                    for rec in self.all(c,kind):
                        if not self.can_view(u,kind,rec): continue
                        files=rec.get('files',[])+[f for m in rec.get('messages',[]) for f in m.get('files',[])]
                        if any(f.get('id')==aid for f in files if isinstance(f,dict)): allowed=True; break
                    if allowed: break
            if not allowed: raise Fault('Нет доступа к файлу',403)
            return dict(row)

    def backup(self,target):
        target=Path(target);target.parent.mkdir(parents=True,exist_ok=True)
        temp=target.with_name(target.name+'.tmp-'+secrets.token_hex(4))
        try:
            with self.db() as source, contextlib.closing(sqlite3.connect(temp)) as dest:
                source.backup(dest)
                if dest.execute('PRAGMA integrity_check').fetchone()[0]!='ok': raise RuntimeError('Backup integrity check failed')
            os.replace(temp,target)
            try: os.chmod(target,0o600)
            except OSError: pass
        finally:
            if temp.exists(): temp.unlink()
        return target
