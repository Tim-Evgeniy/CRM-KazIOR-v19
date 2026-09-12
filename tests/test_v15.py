import contextlib
"""Regression tests use synthetic people, local HTTP and fake GREEN-API only."""
import concurrent.futures
import copy
import json
from pathlib import Path
import secrets
import sqlite3
import sys
import tempfile
import threading
import unittest
from urllib.request import Request,build_opener,ProxyHandler
from urllib.error import HTTPError
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from crm_store import Store,Fault,js,phone
from crm_server import App,Server,handler_factory
from wa_service import WhatsApp

def key(): return secrets.token_hex(16)

def payload(text='Заявка: Принтер не печатает',mid=None,chat='77010000001@c.us',kind='incomingMessageReceived',instance='111111'):
    return {'receiptId':1,'body':{'typeWebhook':kind,'idMessage':mid or key(),'timestamp':1800000000,'instanceData':{'idInstance':instance,'wid':'77023377873@c.us'},'senderData':{'chatId':chat,'sender':chat,'senderName':'Тестовый врач'},'messageData':{'typeMessage':'textMessage','textMessageData':{'textMessage':text}}}}

class CoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'crm.sqlite3';self.store=Store(self.path)
        self.doctor=self.store.login_name({'name':'Айгүл Тест'})['user']
        with self.store.db() as c: self.engineer=self.store.get(c,'users','u4');self.admin=self.store.get(c,'users','u1')
        self.config={'backup_dir':str(Path(self.tmp.name)/'backups'),'channels':[{'id':'alma','engineer_id':'u4','phone':'+77023377873','enabled':True,'api_url':'https://api.green-api.com','id_instance':'111111','api_token':'test-not-real'}]}
        self.wa=WhatsApp(self.store,self.config)
    def tearDown(self): self.tmp.cleanup()
    def create(self,u=None,**data): return self.store.create_ticket(u or self.doctor,dict({'subject':'Принтер','phone':'+77010000001'},**data),key())['ticket']
    def patch(self,kind,row,u=None,**changes):
        changed=dict(copy.deepcopy(row),**changes)
        self.store.patch(u or self.doctor,[{'kind':kind,'id':row['id'],'version':row['_v'],'value':changed}],key())
    def get(self,kind,rid):
        with self.store.db() as c: return self.store.get(c,kind,rid)
    def test_name_never_grants_engineer_role(self):
        result=self.store.login_name({'name':self.admin['name']})
        self.assertEqual(result['user']['role'],'employee');self.assertNotEqual(result['user']['id'],'u1')
        self.assertFalse(any(result['user']['permissions'].values()))
    def test_unknown_names_and_device_identity(self):
        one=self.store.login_name({'name':'Новый Сотрудник'})
        same=self.store.login_name({'name':'новый   сотрудник','device':one['device']})
        other=self.store.login_name({'name':'Новый Сотрудник'})
        self.assertEqual(one['user']['id'],same['user']['id']);self.assertNotEqual(one['user']['id'],other['user']['id'])
    def test_server_permissions_and_visibility(self):
        t=self.create();other=self.store.login_name({'name':'Чужой'})['user']
        self.assertEqual(self.store.snapshot(other)['db']['tickets'],[])
        self.assertIn(self.doctor['id'],[u['id'] for u in self.store.snapshot(other)['db']['users']])
        directory_row=next(x for x in self.store.snapshot(other)['db']['users'] if x['id']==self.doctor['id'])
        self.assertNotIn('permissions',directory_row);self.assertNotIn('login',directory_row)
        for change in ({'role':'superadmin'},{'permissions':dict.fromkeys(self.admin['permissions'],True)}):
            with self.assertRaises(Fault): self.patch('users',self.get('users',self.doctor['id']),**change)
        with self.assertRaises(Fault): self.patch('tickets',t,status='done')
        with self.assertRaises(Fault): self.patch('tickets',t,u=other,description='hijack')
        self.assertEqual(self.get('tickets',t['id'])['status'],'new')
    def test_six_engineers_and_no_passwords(self):
        rows=self.store.snapshot(self.admin)['db']['users']
        self.assertEqual(sum(u['role'] in ('engineer','superadmin') for u in rows),7)
        self.assertFalse(any('password' in u for u in rows))
        self.assertEqual(phone(self.engineer['phone']),'+77023377873')
    def test_concurrent_creation_and_idempotency(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results=list(pool.map(lambda _:self.create(),range(20)))
        self.assertEqual(len({t['id'] for t in results}),20)
        op=key();one=self.store.create_ticket(self.doctor,{'subject':'Один'},op);two=self.store.create_ticket(self.doctor,{'subject':'Один'},op)
        self.assertEqual(one,two)
    def test_conflict_does_not_overwrite(self):
        t=self.create();self.patch('tickets',t,description='Первая правка')
        with self.assertRaises(Fault) as cm:self.patch('tickets',t,description='Устаревшая')
        self.assertEqual(cm.exception.code,409);self.assertEqual(self.get('tickets',t['id'])['description'],'Первая правка')
    def test_engineer_takes_and_answers_with_authored_history(self):
        t=self.create();self.patch('tickets',t,u=self.engineer,status='working',engineerId='u4')
        t=self.get('tickets',t['id']);self.patch('tickets',t,u=self.engineer,messages=[{'author':'Поддельный','authorId':'u1','text':'Проверяю','files':[]}])
        t=self.get('tickets',t['id']);self.assertEqual(t['messages'][0]['authorId'],'u4')
        self.assertTrue(any(h.get('actorId')=='u4' for h in t['history']))
        self.assertTrue(self.store.snapshot(self.doctor)['db']['notifications'])
    def test_messages_cannot_be_rewritten(self):
        t=self.create();self.patch('tickets',t,messages=[{'text':'Первое','files':[]}]);t=self.get('tickets',t['id'])
        bad=copy.deepcopy(t['messages']);bad[0]['text']='Замена'
        with self.assertRaises(Fault):self.patch('tickets',t,messages=bad)
    def test_attachment_access_and_backup_restore(self):
        meta=self.store.upload(self.doctor,'photo.txt','text/plain',b'important bytes')
        t=self.create(files=[meta]);other=self.store.login_name({'name':'Другой'})['user']
        with self.assertRaises(Fault):self.store.attachment(other,meta['id'])
        self.assertEqual(self.store.attachment(self.engineer,meta['id'])['data'],b'important bytes')
        backup=self.store.backup(Path(self.tmp.name)/'backup.sqlite3')
        restored=Store(backup)
        self.assertEqual(restored.attachment(self.engineer,meta['id'])['data'],b'important bytes')
        self.assertEqual(restored.snapshot(self.doctor)['db']['tickets'][0]['id'],t['id'])
        with contextlib.closing(sqlite3.connect(backup)) as c:self.assertEqual(c.execute('pragma integrity_check').fetchone()[0],'ok')
    def test_private_message_is_not_saved_as_ticket(self):
        secret='Личная переписка родственника 98765'
        self.assertIsNone(self.wa.event('alma',payload(secret)))
        self.assertEqual(self.store.snapshot(self.admin)['db']['tickets'],[])
        with self.store.db() as c:
            self.assertNotIn(secret,js([dict(x) for x in c.execute('SELECT * FROM wa_events')]))
    def test_any_phone_creates_request_and_retry_is_deduplicated(self):
        msg=payload(chat='447700900123@c.us');tid=self.wa.event('alma',msg)
        self.assertEqual(tid,self.wa.event('alma',msg));t=self.get('tickets',tid)
        self.assertEqual(t['engineerId'],'u4');self.assertEqual(t['phone'],'+447700900123')
        self.assertEqual(len(self.store.snapshot(self.admin)['db']['tickets']),1)
    def test_reply_number_and_wrong_sender_and_private_followup(self):
        tid=self.wa.event('alma',payload());self.wa.event('alma',payload('Забери ребёнка вечером'))
        self.wa.event('alma',payload(tid+' проблема осталась'));self.wa.event('alma',payload(tid+' чужое',chat='77010000002@c.us'))
        t=self.get('tickets',tid);self.assertEqual(len(t['messages']),1);self.assertIn('проблема',t['messages'][0]['text'])
    def test_multiple_requests_do_not_guess_last_ticket(self):
        one=self.wa.event('alma',payload('Заявка: Принтер'));two=self.wa.event('alma',payload('Заявка: Сеть'))
        self.assertNotEqual(one,two);self.wa.event('alma',payload(one+' ответ только сюда'))
        self.assertEqual(len(self.get('tickets',one)['messages']),1);self.assertEqual(len(self.get('tickets',two)['messages']),0)
    def test_reply_sent_from_engineer_phone(self):
        tid=self.wa.event('alma',payload());message=payload(tid+' Проверил',kind='outgoingMessageReceived');message['body']['senderData']['sender']='77023377873@c.us'
        self.wa.event('alma',message);t=self.get('tickets',tid);self.assertEqual(t['messages'][0]['authorId'],'u4')
    def test_quoted_message_links_to_ticket(self):
        msg=payload();tid=self.wa.event('alma',msg);reply=payload('Фото ошибки')
        reply['body']['messageData']['quotedMessage']={'stanzaId':msg['body']['idMessage']}
        self.wa.event('alma',reply);self.assertEqual(len(self.get('tickets',tid)['messages']),1)
    def test_same_message_id_on_different_channel_is_distinct(self):
        cfg=copy.deepcopy(self.config);cfg['channels'].append(dict(cfg['channels'][0],id='elnur',engineer_id='u5',id_instance='222222',phone='+77774910297'))
        wa=WhatsApp(self.store,cfg);first=wa.event('alma',payload(mid='same'));second=wa.event('elnur',payload(mid='same',instance='222222'))
        self.assertNotEqual(first,second);self.assertEqual(self.get('tickets',second)['engineerId'],'u5')
    def test_queue_commit_precedes_acknowledge(self):
        store=self.store;wa=self.wa;msg=payload()
        class Fake:
            def request(self,name,*args,**kw):
                if name=='receiveNotification':return msg
                if name=='deleteNotification':
                    self.committed=bool(store.snapshot(self_outer.admin)['db']['tickets']);return {'result':True}
        self_outer=self;fake=Fake();wa.consume_once('alma',fake);self.assertTrue(fake.committed)
    def test_send_timeout_is_not_automatically_duplicated(self):
        self.wa.event('alma',payload());self.wa.states['alma']={'ok':True}
        class TimeoutAPI:
            def request(self,*a,**k):raise RuntimeError('GREEN-API network unavailable; retrying')
        self.wa.apis['alma']=TimeoutAPI();self.wa.send_once()
        states=self.wa.status()['outbox'];self.assertEqual(states.get('uncertain'),1)
    def test_submission_is_distinct_from_delivery(self):
        self.wa.event('alma',payload());self.wa.states['alma']={'ok':True}
        class Fake:
            def request(self,*a,**k):return {'idMessage':'sent-message'}
        self.wa.apis['alma']=Fake();self.wa.send_once();self.assertEqual(self.wa.status()['outbox'].get('submitted'),1)
        self.wa.event('alma',{'typeWebhook':'outgoingMessageStatus','idMessage':'sent-message','status':'delivered','instanceData':{'idInstance':'111111'}})
        self.assertEqual(self.wa.status()['outbox'].get('delivered'),1)
    def test_group_and_api_echo_do_not_create_tickets(self):
        self.wa.event('alma',payload(chat='77010000001@g.us'));self.wa.event('alma',payload(kind='outgoingAPIMessageReceived'));self.wa.event('alma',payload('CRM КазНИИОиР · Новая заявка KZ-000001'))
        self.assertEqual(len(self.store.snapshot(self.admin)['db']['tickets']),0)
    def test_verified_link_attaches_existing_ticket_to_cabinet(self):
        tid=self.wa.event('alma',payload())
        with self.store.db(True) as c:c.execute('INSERT INTO wa_codes VALUES (?,?,?)',('ABCDEF123456',self.doctor['id'],9999999999))
        self.wa.event('alma',payload('CRM ABCDEF123456'))
        self.assertEqual(self.get('tickets',tid)['ownerId'],self.doctor['id'])
    def test_offline_restore_and_process_lock(self):
        from maintenance import ProcessLock,restore_database
        t=self.create();backup=self.store.backup(Path(self.tmp.name)/'source.sqlite3')
        with ProcessLock(Path(self.tmp.name)):
            with self.assertRaises(RuntimeError):restore_database(backup,self.path)
        self.patch('tickets',t,description='Later change')
        previous=restore_database(backup,self.path)
        self.assertTrue(previous.exists())
        self.assertEqual(self.get('tickets',t['id'])['description'],'')
    def test_web_ticket_uses_verified_whatsapp_link(self):
        with self.store.db(True) as c:c.execute('INSERT INTO wa_links VALUES (?,?,?)',('alma','77010000001@c.us',self.doctor['id']))
        t=self.create();self.assertEqual(t['wa']['channel'],'alma')
        self.patch('tickets',t,u=self.engineer,messages=[{'text':'Ответ по веб-заявке','files':[]}])
        with self.store.db() as c:
            rows=c.execute("SELECT message FROM outbox WHERE channel='alma' AND chat='77010000001@c.us'").fetchall()
        self.assertTrue(any('Ответ по веб-заявке' in r[0] for r in rows))
    def test_import_v14_preserves_history_and_attachment(self):
        from import_v14 import import_backup
        import base64
        source=Path(self.tmp.name)/'v14.json';dest=Path(self.tmp.name)/'imported'/'crm.sqlite3'
        data={'data':{'users':[{'id':'old-user','name':'Перенесённый врач','password':'old','role':'superadmin'}], 'tickets':[{'id':'KZ-000099','ownerId':'old-user','ownerName':'Перенесённый врач','subject':'Старая заявка','status':'new','engineerId':'u4','files':[{'id':'att-old','name':'old.txt','type':'text/plain'}],'messages':[{'text':'Старый ответ','author':'Инженер','files':[]}]}]},'attachments':[{'id':'att-old','name':'old.txt','type':'text/plain','dataUrl':'data:text/plain;base64,'+base64.b64encode(b'old bytes').decode()}]}
        source.write_text(js(data),encoding='utf-8');result=import_backup(source,dest);self.assertEqual(result['tickets'],1)
        imported=Store(dest)
        with imported.db() as c:
            user=imported.get(c,'users','old-user');ticket=imported.get(c,'tickets','KZ-000099')
        self.assertEqual(user['role'],'employee');self.assertNotIn('password',user);self.assertEqual(ticket['messages'][0]['text'],'Старый ответ')
        self.assertEqual(imported.attachment(user,'att-old')['data'],b'old bytes')
        with self.assertRaises(ValueError):import_backup(source,dest)
    def test_http_auth_and_private_file_blocking(self):
        app=App(self.store,{'channels':[],'backup_dir':str(Path(self.tmp.name)/'backups')})
        server=Server(('127.0.0.1',0),handler_factory(app));thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        base=f'http://127.0.0.1:{server.server_port}';http=build_opener(ProxyHandler({}))
        def request(path,body=None,token=None,origin=None):
            headers={}
            if body is not None:headers['Content-Type']='application/json'
            if token:headers['Authorization']='Bearer '+token
            if origin:headers['Origin']=origin
            try:
                with http.open(Request(base+path,data=js(body).encode() if body is not None else None,headers=headers)) as r:return r.status,r.read()
            except HTTPError as e:return e.code,e.read()
        try:
            self.assertEqual(request('/api/state')[0],401)
            for path in ['/data/crm.sqlite3','/server/config.local.json','/server/whatsapp.supplied.json','/server/seed.json','/data/FIRST_LOGIN.txt','/../server/launch.py']:self.assertEqual(request(path)[0],404)
            self.assertEqual(request('/api/auth/name',{'name':'x'},origin='https://evil.example')[0],403)
            status,raw=request('/api/auth/name',{'name':'HTTP Тест'});self.assertEqual(status,200);token=json.loads(raw)['token']
            self.assertEqual(request('/api/backup',{},token)[0],403)
            self.assertEqual(request('/documents.html')[0],200)
            self.assertEqual(request('/api/documents',token=token)[0],200)
            self.assertEqual(request('/api/integrations/configure',{'section':'ai','enabled':True},token)[0],403)
            self.assertEqual(request('/api/eds/challenge',{'purpose':'login'})[0],200)
            self.assertEqual(request('/api/ai/draft',{'mode':'create','subject':'Принтер'},token)[0],200)
            self.assertEqual(request('/api/auth/logout',{},token)[0],200)
            self.assertEqual(request('/api/state',token=token)[0],401)
        finally:server.shutdown();server.server_close();thread.join()

class CapacityTest(unittest.TestCase):
    def test_700_registered_users_survive_reopen(self):
        with tempfile.TemporaryDirectory() as d:
            s=Store(Path(d)/'crm.sqlite3')
            for i in range(700):s.login_name({'name':f'Сотрудник {i}'})
            s=Store(Path(d)/'crm.sqlite3')
            with s.db() as c:self.assertEqual(len(s.all(c,'users')),707)

if __name__=='__main__':unittest.main(verbosity=2)
