#!/usr/bin/env python3
"""Interactive local configuration and offline restore; standard library only."""
import argparse
import contextlib
import getpass
import json
import os
from pathlib import Path
import secrets
import sqlite3
import sys
from crm_store import Store,password_hash
from receiver import GreenAPI

ROOT=Path(__file__).resolve().parent.parent

class ProcessLock:
    def __init__(self,directory):
        directory=Path(directory);directory.mkdir(parents=True,exist_ok=True)
        self.handle=(directory/'.server.lock').open('a+b')
        self.handle.seek(0);self.handle.write(b'1');self.handle.flush();self.handle.seek(0)
        try:
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(self.handle.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(self.handle.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError:
            self.handle.close();raise RuntimeError('Сервер уже работает с этой базой. Сначала остановите его.') from None
    def close(self):self.handle.close()
    def __enter__(self):return self
    def __exit__(self,*args):self.close()

def restore_database(source,dest):
    source=Path(source).resolve();dest=Path(dest).resolve()
    if source==dest:raise ValueError('Выберите файл резервной копии, а не рабочую базу.')
    if not source.is_file():raise ValueError('Файл копии не найден.')
    with ProcessLock(dest.parent):
        with contextlib.closing(sqlite3.connect(source.as_uri()+'?mode=ro',uri=True)) as c:
            if c.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('Копия повреждена.')
            if c.execute("SELECT value FROM meta WHERE key='schema'").fetchone()[0] not in (15,16,17):raise ValueError('Нужна копия CRM v15–v17.')
        previous=None
        if dest.exists(): previous=Store(dest).backup(dest.parent/'backups'/('before-restore-'+secrets.token_hex(6)+'.sqlite3'))
        temp=dest.with_name('restore-'+secrets.token_hex(6)+'.sqlite3')
        try:
            with contextlib.closing(sqlite3.connect(source.as_uri()+'?mode=ro',uri=True)) as src, contextlib.closing(sqlite3.connect(temp)) as out:
                src.backup(out)
                out.execute('DELETE FROM sessions');out.execute('DELETE FROM wa_codes')
                tables={r[0] for r in out.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                for table in ('tg_codes','tg_pending','eds_challenges','oauth_flows'):
                    if table in tables:out.execute('DELETE FROM '+table)
                if 'mail_sends' in tables:out.execute("UPDATE mail_sends SET state='uncertain' WHERE state='sending'")
                if 'tg_outbox' in tables:out.execute("UPDATE tg_outbox SET state='uncertain',error='Восстановлено из копии; проверьте Telegram перед повтором' WHERE state IN ('pending','sending')")
                # Restored messages may already have been sent after the backup was made.
                out.execute("UPDATE outbox SET state='uncertain',error='Восстановлено из копии; проверьте доставку перед повтором' WHERE state IN ('pending','sending')")
                out.commit();out.execute('PRAGMA wal_checkpoint(TRUNCATE)')
            for suffix in ('-wal','-shm'):
                old=Path(str(dest)+suffix)
                if old.exists():old.unlink()
            os.replace(temp,dest)
        finally:
            if temp.exists():temp.unlink()
        return previous

def configure(path):
    path=Path(path)
    if path.exists():
        cfg=json.loads(path.read_text('utf-8-sig'))
        if 'channels' not in cfg:raise ValueError('Это конфигурация v14. Сохраните её отдельно и переименуйте файл перед настройкой v16.')
    from crm_server import read_config
    cfg=read_config(path)
    cfg.pop('_config_path',None)
    print('Настройка WhatsApp для шести инженеров. Сообщения при настройке не отправляются.')
    print('Для каждого номера нужен отдельный инстанс GREEN-API, связанный по QR-коду с этим номером.')
    for channel in cfg['channels']:
        print('\nНомер: '+channel['phone']+' | '+channel['id'])
        action=input('1 — настроить, 2 — отключить, Enter — оставить: ').strip()
        if action=='2':channel['enabled']=False
        if action!='1':continue
        candidate=dict(channel)
        candidate['api_url']=input('apiUrl из кабинета GREEN-API [Enter — текущее значение]: ').strip() or channel['api_url']
        candidate['id_instance']=input('idInstance: ').strip()
        candidate['api_token']=getpass.getpass('apiTokenInstance (ввод скрыт): ').strip()
        GreenAPI(candidate)
        candidate['enabled']=True;channel.update(candidate)
    temp=path.with_name(path.name+'.tmp-'+secrets.token_hex(4))
    fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w',encoding='utf-8') as f:json.dump(cfg,f,ensure_ascii=False,indent=2)
    os.replace(temp,path)
    print('\nНастройки сохранены. Перезапустите START_CRM.bat или START_SERVER.bat.')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['configure','restore','backup','reset-password']);parser.add_argument('--data-dir');parser.add_argument('--source');parser.add_argument('--config',default=str(Path(__file__).with_name('config.local.json')));args=parser.parse_args()
    cfgpath=Path(args.config);cfg=json.loads(cfgpath.read_text('utf-8-sig')) if cfgpath.exists() else {}
    folder=Path(args.data_dir or cfg.get('data_dir','data'))
    if not folder.is_absolute():folder=ROOT/folder
    if args.action=='configure':return configure(cfgpath)
    dest=folder/'crm.sqlite3'
    if args.action=='restore':
        source=args.source or input('Полный путь к файлу .sqlite3: ').strip().strip('"')
        if input('Восстановить эту копию? Текущая база будет сохранена отдельно. Введите ДА: ').strip().upper()!='ДА':return
        previous=restore_database(source,dest)
        print('Копия восстановлена. Запустите CRM. Предыдущая база: '+str(previous or 'не существовала'));return
    if args.action=='backup':
        from crm_server import App
        print(App(Store(dest),{**cfg,'channels':[]}).backup());return
    with ProcessLock(folder):
        store=Store(dest);login=input('Логин пользователя: ').strip();pw=getpass.getpass('Новый пароль (от 10 символов): ')
        if len(pw)<10:raise ValueError('Слишком короткий пароль')
        if getpass.getpass('Повторите пароль: ')!=pw:raise ValueError('Пароли не совпадают')
        with store.db(True) as c:
            u=next((u for u in store.all(c,'users') if u.get('login')==login),None)
            if not u:raise ValueError('Логин не найден')
            c.execute('INSERT OR REPLACE INTO accounts VALUES (?,?)',(u['id'],password_hash(pw)))
            c.execute('DELETE FROM sessions WHERE uid=?',(u['id'],))
        print('Пароль изменён. Запустите CRM.')
if __name__=='__main__':
    try:main()
    except (ValueError,RuntimeError,OSError,sqlite3.Error) as e:
        print('Не выполнено: '+str(e));sys.exit(1)
