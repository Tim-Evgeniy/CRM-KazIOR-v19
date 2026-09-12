#!/usr/bin/env python3
"""KazIOR v15: local/LAN server, SQLite persistence, server-enforced roles."""
import argparse
import base64
import datetime as dt
import ipaddress
import json
import mimetypes
import os
from pathlib import Path
import secrets
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlsplit
import webbrowser
from crm_store import Store, Fault, digest, js, clean_text, now
from wa_service import WhatsApp
from telegram_service import Telegram
from documents_service import Documents
from ai_service import Assistant
from oauth_service import OAuth,PROVIDERS
from mail_service import Mail
from http.cookies import SimpleCookie

ROOT=Path(__file__).resolve().parent.parent
DEFAULT_CONFIG=Path(__file__).with_name('config.local.json')

class App:
    def __init__(self,store,config):
        self.store,self.config=store,config
        self.store.notification_config=config
        self.stop=threading.Event()
        self.wa=WhatsApp(store,config,self.stop)
        self.tg=Telegram(store,config,self.stop)
        self.documents=Documents(store,config)
        self.assistant=Assistant(store,config)
        self.oauth=OAuth(store,config)
        self.mail=Mail(store,self.oauth,self.stop)
        self.pending_restart=False
        self.rate={};self.rate_lock=threading.Lock()
        self.backup_lock=threading.Lock()
        self.wa_reload_lock=threading.Lock()
        self.wa_reload_state=''

    def reload_whatsapp(self):
        if not self.wa_reload_lock.acquire(False):return {'ok':True,'message':'Подключение уже применяется'}
        import copy
        config=copy.deepcopy(self.config)
        self.wa_reload_state='Применяем настройки WhatsApp…'
        def reload():
            try:
                old=self.wa;old.stop.set()
                deadline=time.time()+65
                for thread in old.threads:thread.join(max(0,deadline-time.time()))
                if any(t.is_alive() for t in old.threads):raise RuntimeError('Приём не остановился. Перезапустите сервер CRM.')
                self.wa=WhatsApp(self.store,copy.deepcopy(self.config),self.stop);self.wa.start()
                self.wa_reload_state='Настройки WhatsApp применены'
            except Exception:self.wa_reload_state='Не удалось применить WhatsApp. Перезапустите сервер CRM.'
            finally:self.wa_reload_lock.release()
        threading.Thread(target=reload,daemon=True).start()
        return {'ok':True,'message':self.wa_reload_state}

    def configure(self,data):
        import copy,re
        from receiver import GreenAPI
        cfg=copy.deepcopy(self.config);section=data.get('section')
        if section not in ('telegram','ai','eds','whatsapp','oauth'):raise Fault('Неизвестное подключение')
        if section=='oauth':
            provider=data.get('provider')
            if provider not in PROVIDERS:raise Fault('Выберите провайдера')
            oauth=cfg.setdefault('oauth',{});part=oauth.setdefault(provider,{})
            if data.get('public_origin'):oauth['public_origin']=clean_text(data['public_origin'],500).rstrip('/')
            part['enabled']=bool(data.get('enabled'))
            for field in ('client_id','client_secret'):
                if data.get(field):part[field]=clean_text(data[field],1000)
            old_config=self.oauth.config
            try:self.oauth.config=cfg;self.oauth.origin()
            finally:self.oauth.config=old_config
            if part['enabled'] and not(part.get('client_id') and part.get('client_secret')):raise Fault('Нужны Client ID и Client Secret приложения')
            hostname=urlsplit(oauth.get('public_origin','http://localhost:8000')).hostname
            if hostname:cfg['allowed_hosts']=sorted(set(cfg.get('allowed_hosts',[]))|{hostname})
        elif section=='whatsapp':
            channel=next((x for x in cfg['channels'] if x['id']==data.get('id')),None)
            if not channel:raise Fault('Выберите инженера')
            channel['enabled']=bool(data.get('enabled'))
            if data.get('incoming_mode') in ('commands','all'):channel['incoming_mode']=data['incoming_mode']
            for setting in ('notify_new','notify_reply','notify_status'):
                if setting in data:cfg.setdefault('whatsapp_notifications',{})[setting]=data[setting] is True
            if data.get('phone'):
                from crm_store import phone
                channel['phone']=phone(data['phone'])
            if data.get('routing') in ('engineer','common'):channel['routing']=data['routing']
            if data.get('default_engineer_id'):
                with self.store.db() as c:person=self.store.get(c,'users',data['default_engineer_id'])
                if not person or person.get('role') not in ('engineer','superadmin') or person.get('status')!='active':raise Fault('Выберите действующего инженера')
                channel['default_engineer_id']=person['id']
            if channel['enabled'] and not channel.get('phone'):raise Fault('Укажите номер WhatsApp, подключённый к этому каналу')
            for field in ('id_instance','api_token','api_url'):
                if data.get(field):channel[field]=clean_text(data[field],500)
            if channel['enabled']:
                try:GreenAPI(channel)
                except ValueError:raise Fault('Проверьте idInstance, apiTokenInstance и адрес GREEN-API')
                if any(x['id']!=channel['id'] and x.get('enabled') and x.get('id_instance')==channel['id_instance'] for x in cfg['channels']):raise Fault('Этот idInstance уже используется другим инженером')
        else:
            part=cfg.setdefault(section,{})
            part['enabled']=bool(data.get('enabled'))
            field={'telegram':'bot_token','ai':'api_key','eds':'verifier_token'}[section]
            if data.get(field):part[field]=clean_text(data[field],1000)
            if section=='telegram' and part['enabled'] and not re.fullmatch(r'\d+:[A-Za-z0-9_-]{20,}',part.get(field,'')):raise Fault('Нужен токен Telegram от @BotFather, а не токен WhatsApp')
            if section=='ai':
                if data.get('model'):part['model']=clean_text(data['model'],100)
                if part['enabled'] and not (part.get(field) or os.environ.get('OPENAI_API_KEY')):raise Fault('Введите отдельный API-ключ AI')
            if section=='eds':
                if data.get('provider') in ('ncanode','adapter'):part['provider']=data['provider']
                if data.get('verifier_url'):part['verifier_url']=clean_text(data['verifier_url'],1000)
                if part['enabled'] and not part.get('verifier_url'):raise Fault('Укажите адрес серверной проверки ЭЦП')
        path=Path(cfg.get('_config_path') or DEFAULT_CONFIG);temp=path.with_name(path.name+'.tmp-'+secrets.token_hex(4))
        fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w',encoding='utf-8') as f:json.dump({k:v for k,v in cfg.items() if not k.startswith('_')},f,ensure_ascii=False,indent=2)
        os.replace(temp,path);self.config=cfg;self.store.notification_config=cfg
        if section=='oauth':self.oauth.config=cfg
        elif section=='ai':self.assistant=Assistant(self.store,cfg)
        elif section=='eds':self.documents=Documents(self.store,cfg)
        elif section=='telegram':self.pending_restart=True
        return {'ok':True,'restartRequired':section=='telegram','applyRequired':section=='whatsapp'}

    def limit(self,key,limit,seconds):
        with self.rate_lock:
            stamp=time.time()
            if len(self.rate)>10000: self.rate={k:v for k,v in self.rate.items() if v and v[-1]>stamp-3600}
            hits=[x for x in self.rate.get(key,[]) if x>stamp-seconds]
            if len(hits)>=limit: raise Fault('Слишком много попыток. Повторите позже.',429)
            hits.append(stamp);self.rate[key]=hits

    def backup(self):
        with self.backup_lock:
            folder=Path(self.config.get('backup_dir') or self.store.path.parent/'backups')
            if not folder.is_absolute(): folder=ROOT/folder
            name='kazior-'+dt.datetime.now().strftime('%Y%m%d-%H%M%S')+'-'+secrets.token_hex(2)+'.sqlite3'
            return self.store.backup(folder/name)

    def backup_loop(self):
        while not self.stop.is_set():
            try:
                path=self.backup()
                keep=max(2,int(self.config.get('backup_keep',14)))
                for old in sorted(path.parent.glob('kazior-*.sqlite3'),reverse=True)[keep:]: old.unlink()
            except Exception:
                print('Не удалось создать автоматическую копию. Проверьте папку копий и место на диске.',flush=True)
            self.stop.wait(max(300,int(self.config.get('backup_interval_seconds',86400))))

    def start(self):
        self.wa.start()
        self.tg.start()
        threading.Thread(target=self.backup_loop,daemon=True).start()


def handler_factory(app):
    class Handler(BaseHTTPRequestHandler):
        server_version='KazIOR/17'
        def setup(self):
            super().setup();self.connection.settimeout(30)
        def log_message(self,*args): pass
        def reply(self,code,data,mime='application/json; charset=utf-8',headers=None):
            raw=js(data).encode() if isinstance(data,(dict,list)) else data
            self.send_response(code)
            self.send_header('Content-Type',mime)
            self.send_header('Content-Length',str(len(raw)))
            self.send_header('Cache-Control','no-store' if self.path.startswith('/api/') else 'no-cache')
            self.send_header('X-Content-Type-Options','nosniff')
            self.send_header('X-Frame-Options','DENY')
            self.send_header('Referrer-Policy','same-origin')
            self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://onco.kz; media-src 'self' blob:; connect-src 'self' wss://127.0.0.1:13579; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
            for k,v in (headers or {}).items(): self.send_header(k,v)
            self.end_headers();self.wfile.write(raw)
        def oauth_cookie(self):
            jar=SimpleCookie()
            try:jar.load(self.headers.get('Cookie',''))
            except Exception:return ''
            return jar['kazior_oauth'].value if 'kazior_oauth' in jar else ''
        def cookie_header(self,value,age=600):
            secure='; Secure' if app.oauth.origin().startswith('https:') else ''
            return f'kazior_oauth={value}; Path=/api/oauth; HttpOnly; SameSite=Lax; Max-Age={age}'+secure
        def check_origin(self):
            host=self.headers.get('Host','')
            try: name=urlsplit('//'+host).hostname
            except ValueError: name=None
            hosts={'localhost','127.0.0.1',*app.config.get('allowed_hosts',[])}
            try: allowed=name in hosts or ipaddress.ip_address(name).is_private
            except ValueError: allowed=name in hosts
            if not allowed: raise Fault('Адрес сервера не разрешён',403)
            origin=self.headers.get('Origin')
            if origin:
                parsed=urlsplit(origin)
                if parsed.scheme not in ('http','https') or parsed.netloc!=host: raise Fault('Запрос с другого сайта запрещён',403)
        def body(self):
            if self.headers.get('Content-Type','').split(';')[0]!='application/json': raise Fault('Ожидается JSON',415)
            try: n=int(self.headers.get('Content-Length','0'))
            except ValueError: raise Fault('Некорректная длина')
            if n<=0 or n>15*1024*1024: raise Fault('Запрос слишком большой',413)
            try: data=json.loads(self.rfile.read(n))
            except (ValueError,UnicodeError): raise Fault('Некорректный JSON')
            if not isinstance(data,dict): raise Fault('Ожидается объект JSON')
            return data
        def user(self):
            auth=self.headers.get('Authorization','')
            if not auth.startswith('Bearer '): raise Fault('Войдите в CRM',401)
            return app.store.authenticate(auth[7:])
        def admin(self,u):
            if u.get('role')!='superadmin': raise Fault('Только супер-администратор',403)
        def serve_file(self,path,download=None):
            if not path.is_file(): raise Fault('Файл не найден',404)
            self.send_response(200)
            self.send_header('Content-Type','application/octet-stream' if download else mimetypes.guess_type(path.name)[0] or 'application/octet-stream')
            self.send_header('Content-Length',str(path.stat().st_size))
            self.send_header('Cache-Control','no-store' if download else 'no-cache')
            self.send_header('X-Content-Type-Options','nosniff')
            if download: self.send_header('Content-Disposition','attachment; filename="'+download+'"')
            self.end_headers()
            with path.open('rb') as f:
                while chunk:=f.read(128*1024): self.wfile.write(chunk)
        def do_GET(self):
            try:
                self.check_origin()
                url=urlsplit(self.path);path=unquote(url.path);q=parse_qs(url.query)
                if path=='/api/health': return self.reply(200,{'service':'kazior-crm','version':19})
                if path=='/api/launcher/status': return self.reply(200,{'service':'kazior-crm','version':19,'project':str(ROOT)})
                if path=='/api/oauth/providers':
                    optional=None
                    if self.headers.get('Authorization'):
                        try:optional=self.user()
                        except Fault:pass
                    return self.reply(200,app.oauth.status(optional))
                if path.startswith('/api/oauth/callback/'):
                    provider=path.rsplit('/',1)[1]
                    app.oauth.callback(provider,{k:v[0] for k,v in q.items()},self.oauth_cookie())
                    return self.reply(303,b'',headers={'Location':app.oauth.origin()+'/?oauth=complete'})
                if path=='/api/eds/status':return self.reply(200,{'enabled':app.documents.enabled(),'testDocuments':True})
                if path.startswith('/api/'):
                    u=self.user()
                    if path=='/api/mail':return self.reply(200,app.mail.list(u))
                    if path=='/api/state': return self.reply(200,app.store.snapshot(u,q.get('after',[None])[0]))
                    if path=='/api/documents':return self.reply(200,app.documents.list(u))
                    if path=='/api/ai/status':return self.reply(200,app.assistant.status())
                    if path=='/api/integrations/status':
                        self.admin(u)
                        return self.reply(200,{'telegram':app.tg.status(),'ai':app.assistant.status(),'eds':{'enabled':app.documents.enabled(),'provider':app.config.get('eds',{}).get('provider','adapter'),'verifierUrl':app.config.get('eds',{}).get('verifier_url',''),'hasToken':bool(app.config.get('eds',{}).get('verifier_token'))},'restartRequired':app.pending_restart})
                    if path=='/api/whatsapp/status':
                        self.admin(u);return self.reply(200,app.wa.status())
                    if path=='/api/audit':
                        self.admin(u)
                        with app.store.db() as c: rows=[dict(x) for x in c.execute('SELECT * FROM audit ORDER BY seq DESC LIMIT 500')]
                        return self.reply(200,{'audit':rows})
                    if path.startswith('/api/attachments/'):
                        row=app.store.attachment(u,path.removeprefix('/api/attachments/'))
                        return self.reply(200,row['data'],row['mime'],{'Content-Disposition':'attachment'})
                    raise Fault('Метод не найден',404)
                public={'index.html','app.js','shared-client.js','styles.css','shared.css','manifest.json','service-worker.js','whatsapp-core.js','v16-ui.js','v18-ui.js','v19-ui.js','ncalayer.js','documents.html','documents.js','documents.css','v17-ui.js','mail.html','mail.js','mail.css'}
                rel=path.lstrip('/') or 'index.html'
                if rel not in public and not (rel.startswith('assets/') and '..' not in rel and Path(rel).suffix.lower() in ('.png','.jpg','.jpeg','.webp','.svg','.ico')): raise Fault('Файл не найден',404)
                dest=(ROOT/rel).resolve()
                if ROOT not in dest.parents: raise Fault('Файл не найден',404)
                # The HTML response adds the same restrictive application CSP as API responses.
                if rel in ('index.html','documents.html','mail.html'): return self.reply(200,dest.read_bytes(),'text/html; charset=utf-8')
                return self.serve_file(dest)
            except Fault as e: self.reply(e.code,{'error':str(e)})
            except (BrokenPipeError,ConnectionResetError): pass
            except Exception: self.reply(500,{'error':'Ошибка сервера. Данные не подтверждены; проверьте диск и журнал запуска.'})
        def do_POST(self):
            try:
                self.check_origin();path=urlsplit(self.path).path;data=self.body()
                ip=self.client_address[0]
                if path=='/api/oauth/begin':
                    app.limit(('oauth',ip),30,300);optional=None
                    if self.headers.get('Authorization'):
                        try:optional=self.user()
                        except Fault:pass
                    result,cookie=app.oauth.begin(optional,data,self.headers.get('Host',''))
                    return self.reply(200,result,headers={'Set-Cookie':self.cookie_header(cookie)})
                if path=='/api/oauth/finish':
                    result=app.oauth.finish(self.oauth_cookie(),data.get('nonce',''))
                    return self.reply(200,result,headers={'Set-Cookie':self.cookie_header('',0)})
                if path=='/api/auth/name':
                    app.limit(('name',ip),120,600)
                    return self.reply(200,app.store.login_name(data))
                if path in ('/api/eds/challenge','/api/eds/complete'):
                    app.limit(('eds',ip),30,300)
                    eds_user=None
                    if self.headers.get('Authorization'):
                        try:eds_user=self.user()
                        except Fault as e:
                            if e.code!=401:raise
                    origin=self.headers.get('Host','')
                    result=app.documents.challenge(eds_user,data,origin) if path.endswith('challenge') else app.documents.complete(eds_user,data,origin)
                    return self.reply(200,result)
                if path=='/api/auth/password':
                    app.limit(('password',ip,clean_text(data.get('login'),160)),20,300)
                    return self.reply(200,app.store.login_password(data))
                u=self.user()
                if path=='/api/oauth/unlink':return self.reply(200,app.oauth.unlink(u,data.get('provider')))
                if path=='/api/mail/connect':return self.reply(200,app.mail.connect_password(u,data))
                if path=='/api/mail/disconnect':return self.reply(200,app.mail.disconnect(u,data.get('account')))
                if path=='/api/mail/sync':
                    app.limit(('mail-sync',u['id']),12,60)
                    return self.reply(200,app.mail.sync(u,data.get('account')))
                if path=='/api/mail/send':
                    app.limit(('mail-send',u['id']),15,60)
                    return self.reply(200,app.mail.send(u,data))
                if path=='/api/mail/ticket':return self.reply(200,app.mail.to_ticket(u,data))
                if path=='/api/telegram/link':return self.reply(200,app.tg.link_code(u))
                if path=='/api/telegram/unlink':
                    with app.store.db(True) as c:
                        link=c.execute('SELECT chat FROM tg_links WHERE uid=?',(u['id'],)).fetchone()
                        if link:c.execute("UPDATE tg_outbox SET state='cancelled' WHERE chat=? AND state='pending'",(link['chat'],))
                        c.execute('DELETE FROM tg_links WHERE uid=?',(u['id'],))
                    return self.reply(200,{'ok':True})
                if path=='/api/ai/draft':
                    app.limit(('ai',u['id']),15,60)
                    return self.reply(200,app.assistant.suggest(u,data))
                if path=='/api/documents/create':return self.reply(200,app.documents.create(u,data,data.get('key')))
                if path=='/api/documents/action':return self.reply(200,app.documents.act(u,data))
                if path=='/api/integrations/configure':
                    self.admin(u);return self.reply(200,app.configure(data))
                if path=='/api/telegram/retry':
                    self.admin(u)
                    if data.get('confirmed') is not True:raise Fault('Проверьте Telegram перед повтором')
                    with app.store.db(True) as c:c.execute("UPDATE tg_outbox SET state='pending',next_try=0 WHERE id=? AND state IN ('uncertain','failed')",(data.get('id'),))
                    return self.reply(200,{'ok':True})
                if path=='/api/auth/logout':
                    with app.store.db(True) as c: c.execute('DELETE FROM sessions WHERE hash=?',(digest(self.headers['Authorization'][7:]),))
                    return self.reply(200,{'ok':True})
                if path=='/api/patch':
                    app.store.patch(u,data.get('ops'),data.get('key'))
                    return self.reply(200,app.store.snapshot(u))
                if path=='/api/tickets':
                    result=app.store.create_ticket(u,data.get('ticket',{}),data.get('key'))
                    return self.reply(200,{**result,**app.store.snapshot(u)})
                if path=='/api/attachments':
                    try: content=base64.b64decode(data.get('data',''),validate=True)
                    except ValueError: raise Fault('Некорректный файл')
                    return self.reply(200,app.store.upload(u,data.get('name'),data.get('type'),content))
                if path=='/api/whatsapp/link':
                    code=secrets.token_hex(6).upper()
                    with app.store.db(True) as c:
                        c.execute('DELETE FROM wa_codes WHERE uid=? OR expires<?',(u['id'],time.time()))
                        c.execute('INSERT INTO wa_codes VALUES (?,?,?)',(code,u['id'],time.time()+600))
                    return self.reply(200,{'code':code,'expiresIn':600})
                if path=='/api/whatsapp/apply':
                    self.admin(u);return self.reply(200,app.reload_whatsapp())
                if path in ('/api/whatsapp/check','/api/whatsapp/test'):
                    self.admin(u)
                    from receiver import GreenAPI
                    from crm_store import phone
                    channel=next((x for x in app.config.get('channels',[]) if x['id']==data.get('id')),None)
                    if not channel:raise Fault('Сначала сохраните канал WhatsApp')
                    try:provider=GreenAPI(channel)
                    except ValueError:raise Fault('Укажите ID Instance, API URL и ключ, затем сохраните настройки')
                    if path.endswith('/check'):
                        try:
                            state=provider.request('getStateInstance') or {}
                            settings=provider.request('getSettings') or {}
                        except RuntimeError as e:raise Fault(str(e),502)
                        checks=[{'name':'Авторизация WhatsApp','ok':state.get('stateInstance')=='authorized'},
                          {'name':'Номер соответствует каналу','ok':phone(str(settings.get('wid','')).split('@')[0])==phone(channel.get('phone'))},
                          {'name':'HTTP-приём без webhookUrl','ok':not bool(settings.get('webhookUrl'))},
                          {'name':'Входящие уведомления','ok':settings.get('incomingWebhook')=='yes'},
                          {'name':'Статусы доставки','ok':settings.get('outgoingWebhook')=='yes'}]
                        return self.reply(200,{'ok':all(x['ok'] for x in checks),'checks':checks,'enabled':bool(channel.get('enabled')),'message':app.wa_reload_state})
                    number=phone(data.get('phone'))
                    if not number:raise Fault('Укажите номер получателя теста в формате +7 …')
                    if not channel.get('enabled'):raise Fault('Включите канал и примените настройки')
                    unique=str(data.get('key',''))
                    if not __import__('re').fullmatch(r'[a-zA-Z0-9-]{16,100}',unique):raise Fault('Не задан идентификатор теста')
                    with app.store.db(True) as c:
                        app.store.enqueue(c,channel['id'],number[1:]+'@c.us','CRM КазНИИОиР · Проверка уведомлений.\nТестовое сообщение из раздела «Интеграции».\n\nIT-System-Solution\nwww.its24.kz','',unique)
                    return self.reply(200,{'ok':True,'message':'Тест поставлен в очередь. Результат доставки появится в журнале отправки.'})
                if path=='/api/backup':
                    self.admin(u);backup=app.backup()
                    return self.serve_file(backup,backup.name)
                if path=='/api/whatsapp/retry':
                    self.admin(u)
                    if data.get('confirmed') is not True: raise Fault('Подтвердите проверку WhatsApp перед повторной отправкой')
                    with app.store.db(True) as c: c.execute("UPDATE outbox SET state='pending',next_try=0 WHERE id=? AND state IN ('uncertain','failed')",(data.get('id'),))
                    return self.reply(200,{'ok':True})
                if path=='/api/password':
                    self.admin(u)
                    from crm_store import password_hash
                    uid=data.get('uid');password=data.get('password')
                    if not isinstance(password,str) or len(password)>200:raise Fault('Пароль должен содержать от 10 до 200 символов')
                    if len(password)<10: raise Fault('Не менее 10 символов')
                    with app.store.db(True) as c:
                        if not app.store.get(c,'users',uid): raise Fault('Пользователь не найден')
                        c.execute('INSERT OR REPLACE INTO accounts VALUES (?,?)',(uid,password_hash(password)))
                        c.execute('DELETE FROM sessions WHERE uid=?',(uid,))
                        app.store.log(c,u,'Смена пароля','users',uid)
                    return self.reply(200,{'ok':True})
                raise Fault('Метод не найден',404)
            except Fault as e: self.reply(e.code,{'error':str(e)})
            except (BrokenPipeError,ConnectionResetError): pass
            except Exception: self.reply(500,{'error':'Не удалось сохранить. Повторите после проверки сервера.'})
        def do_OPTIONS(self): self.reply(403,{'error':'Cross-origin requests are disabled'})
    return Handler

class Server(ThreadingHTTPServer):
    daemon_threads=True
    request_queue_size=256
    allow_reuse_address=True


def read_config(path):
    defaults=json.loads(Path(__file__).with_name('config.example.json').read_text('utf-8'))
    cfg=json.loads(path.read_text('utf-8-sig')) if path.exists() else defaults
    if not isinstance(cfg.get('channels'),list):raise ValueError('Для v16 нужна конфигурация с разделом channels. Сохраните старую конфигурацию отдельно.')
    for section in ('telegram','ai','eds','oauth'):cfg.setdefault(section,defaults[section])
    for channel in defaults['channels']:
        if not any(x['engineer_id']==channel['engineer_id'] for x in cfg['channels']):cfg['channels'].append(channel)
    supplied=Path(__file__).with_name('whatsapp.supplied.json')
    if supplied.exists():
        cred=json.loads(supplied.read_text('utf-8'))
        # Verified on 2026-09-12 via read-only getStateInstance/getSettings: account belongs to u1.
        # An existing operator configuration always wins; never reuse one instance for six numbers.
        target=next((x for x in cfg['channels'] if x['engineer_id']=='u1'),None)
        if target and not target.get('api_token') and cred.get('auto_connect') and not any(x.get('id_instance')==cred['id_instance'] for x in cfg['channels']):
            target.update({k:cred[k] for k in ('id_instance','api_token','api_url')});target['enabled']=True
    cfg['_config_path']=str(path.resolve())
    return cfg

def main(argv=None):
    p=argparse.ArgumentParser()
    p.add_argument('--host');p.add_argument('--port',type=int);p.add_argument('--data-dir');p.add_argument('--config',default=str(DEFAULT_CONFIG));p.add_argument('--no-browser',action='store_true');p.add_argument('--mode',default='auto');p.add_argument('--backup',action='store_true')
    args=p.parse_args(argv)
    config=read_config(Path(args.config))
    folder=Path(args.data_dir or config.get('data_dir') or ROOT/'data')
    if not folder.is_absolute(): folder=ROOT/folder
    from maintenance import ProcessLock
    process_lock=None if args.backup else ProcessLock(folder)
    store=Store(folder/'crm.sqlite3')
    if not args.backup:
        with store.db(True) as c:
            c.execute("UPDATE tg_outbox SET state='uncertain',error='Сервер остановился при отправке; проверьте Telegram' WHERE state='sending'")
            c.execute("UPDATE outbox SET state='uncertain',error='Сервер остановился во время отправки; проверьте WhatsApp' WHERE state='sending'")
    app=App(store,config)
    if not args.backup:
        with store.db(True) as c:c.execute("UPDATE mail_sends SET state='uncertain' WHERE state='sending'")
    if args.backup:
        print(app.backup());return
    host=args.host or config.get('listen_host','127.0.0.1');port=args.port or int(config.get('listen_port',8000))
    try: server=Server((host,port),handler_factory(app))
    except OSError:
        print(f'Порт {port} уже занят. Откройте работающую CRM или укажите другой --port.');return
    app.start()
    url=f'http://127.0.0.1:{port}'
    print(f'CRM v16: {url}\nБаза: {store.path}\nЛогины инженеров: {folder / "FIRST_LOGIN.txt"}\nНе закрывайте это окно во время работы. Ctrl+C — остановить.',flush=True)
    if host=='0.0.0.0': print(f'Сотрудники открывают http://IP-АДРЕС-ЭТОГО-СЕРВЕРА:{port}',flush=True)
    if not args.no_browser: webbrowser.open(url)
    try: server.serve_forever(poll_interval=.5)
    except KeyboardInterrupt: pass
    finally:
        app.stop.set();server.server_close()
        try: app.backup()
        except Exception: pass
        process_lock.close()

if __name__=='__main__':
    try: main()
    except (ValueError,OSError,RuntimeError) as e:
        print('Ошибка запуска: '+str(e));raise SystemExit(1)
