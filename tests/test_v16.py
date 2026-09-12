"""v16 acceptance/security tests use disposable SQLite and fake providers only."""
import base64,copy,json,secrets,sys,tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from crm_store import Store,Fault,password_hash,password_ok,digest,js,phone
from crm_server import App
from telegram_service import Telegram
from documents_service import Documents
from ai_service import Assistant

def key():return secrets.token_hex(20)
class Features(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.store=Store(Path(self.tmp.name)/'crm.sqlite3')
        self.a=self.store.login_name({'name':'Тестовый Врач А'})['user'];self.b=self.store.login_name({'name':'Тестовый Врач Б'})['user']
        with self.store.db() as c:self.eng=self.store.get(c,'users','u4');self.admin=self.store.get(c,'users','u1')
        self.docs=Documents(self.store,{});self.tg=Telegram(self.store,{'telegram':{'enabled':True,'bot_token':'123456:'+('x'*30)}})
        self.tg.state.update(ok=True,username='test_disposable_bot')
        self.update_id=0
    def tearDown(self):self.tmp.cleanup()
    def get(self,kind,rid):
        with self.store.db() as c:return self.store.get(c,kind,rid)
    def event(self,chat,text='',**parts):
        self.update_id+=1;u={'update_id':self.update_id,'message':{'message_id':self.update_id,'chat':{'id':chat,'type':'private'},'from':{'id':chat,'first_name':'Test'},'text':text,**parts}}
        self.tg.event(u);return u
    def link(self,user,chat,number=None):
        code=self.tg.link_code(user)['url'].split('=')[1]
        self.event(chat,'/start '+code)
        self.event(chat,contact={'user_id':chat,'phone_number':number or user.get('phone') or '+77010000001'})
    def create_doc(self,**extra):return self.docs.create(self.a,dict(title='Проверка принтера',content='Служебная записка',reviewers=[self.a['id']],signers=[self.a['id']],**extra),key())['document']
    def action(self,d,act,user=None,**extra):return self.docs.act(user or self.a,dict(id=d['id'],version=d['_v'],action=act,key=key(),**extra))['document']
    def test_engineer_fio_password_and_admin_unchanged(self):
        before=None
        with self.store.db() as c:before=c.execute("SELECT hash FROM accounts WHERE uid='u1'").fetchone()[0]
        self.store.login_name({'name':self.eng['name']}) # Same-name employee cannot obscure engineer sign-in.
        r=self.store.login_password({'login':'  '+self.eng['name']+'  ','password':'KazIOR@2026'});self.assertEqual(r['user']['id'],'u4')
        for uid in ('u3','u4','u5','u6','u8'):
            u=self.get('users',uid);self.assertEqual(self.store.login_password({'login':u['name'],'password':'KazIOR@2026'})['user']['role'],'engineer')
        with self.assertRaises(Fault):self.store.login_password({'login':'superadmin','password':'KazIOR@2026'})
        with self.store.db() as c:self.assertEqual(c.execute("SELECT hash FROM accounts WHERE uid='u1'").fetchone()[0],before)
    def test_engineer_password_not_reset_on_restart(self):
        with self.store.db(True) as c:c.execute("UPDATE accounts SET hash=? WHERE uid='u3'",(password_hash('ChangedByEngineer-TEST'),))
        restored=Store(self.store.path)
        self.assertEqual(restored.login_password({'login':'abarakbaeva','password':'ChangedByEngineer-TEST'})['user']['id'],'u3')
        with self.assertRaises(Fault):restored.login_password({'login':'abarakbaeva','password':'KazIOR@2026'})
    def test_phone_required_and_name_is_server_owned(self):
        with self.assertRaises(Fault):self.store.create_ticket(self.a,{'subject':'Ошибка'},key())
        t=self.store.create_ticket(self.a,{'subject':'Ошибка','phone':'8 (701) 000-00-01','ownerName':'Администратор'},key())['ticket']
        self.assertEqual(t['phone'],'+77010000001');self.assertEqual(t['ownerName'],self.a['name']);self.assertEqual(self.get('users',self.a['id'])['phone'],t['phone'])
    def test_directory_contact_only_and_not_ticket_access(self):
        row=next(x for x in self.store.snapshot(self.b)['db']['users'] if x['id']==self.a['id'])
        self.assertEqual(row['name'],self.a['name']);self.assertNotIn('permissions',row);self.assertNotIn('login',row)
        t=self.store.create_ticket(self.a,{'subject':'Ошибка','phone':'+77010000001'},key())['ticket']
        self.assertNotIn(t['id'],[t['id'] for t in self.store.snapshot(self.b)['db']['tickets']])
    def test_telegram_binding_requires_own_contact_and_staff_number(self):
        code=self.tg.link_code(self.eng)['url'].split('=')[1];self.event(101,'/start '+code)
        self.event(101,contact={'user_id':999,'phone_number':self.eng['phone']})
        self.event(101,contact={'user_id':101,'phone_number':'+77010000002'})
        with self.store.db() as c:self.assertEqual(c.execute('SELECT count(*) FROM tg_links').fetchone()[0],0)
        self.event(101,contact={'user_id':101,'phone_number':self.eng['phone']})
        with self.store.db() as c:self.assertEqual(c.execute('SELECT uid FROM tg_links WHERE chat=?',('101',)).fetchone()[0],'u4')
    def test_telegram_registration_any_phone_and_work_request(self):
        self.event(201,'/start');self.event(201,contact={'user_id':201,'phone_number':'+77010000011'});self.event(201,'/name Новый Врач')
        self.event(201,'/engineer amuratova');update=self.event(201,'/new Не печатает принтер. Кабинет 315');self.tg.event(update)
        with self.store.db() as c:rows=self.store.all(c,'tickets');offset=c.execute("SELECT value FROM meta WHERE key='telegram_offset'").fetchone()[0]
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['engineerId'],'u4');self.assertEqual(rows[0]['ownerName'],'Новый Врач');self.assertEqual(rows[0]['phone'],'+77010000011');self.assertEqual(offset,update['update_id']+1)
        self.assertTrue(any(n['ticketId']==rows[0]['id'] for n in self.store.snapshot(self.eng)['db']['notifications']))
    def test_telegram_reply_scope_and_full_text_notification(self):
        self.link(self.a,301);self.link(self.eng,302)
        self.event(301,'/engineer amuratova');self.event(301,'/new Принтер не печатает')
        with self.store.db() as c:t=self.store.all(c,'tickets')[0]
        self.link(self.b,303,number='+77010000002');self.event(303,t['id']+' чужой ответ')
        self.assertEqual(self.get('tickets',t['id'])['messages'],[])
        message='Проверка подключения. '+('Подробности проверки. '*25)
        self.event(302,t['id']+' '+message)
        updated=self.get('tickets',t['id']);self.assertEqual(updated['messages'][0]['authorId'],'u4');self.assertEqual(updated['messages'][0]['text'],message.strip())
        with self.store.db() as c:out='\n'.join(x['text'] for x in c.execute('SELECT text FROM tg_outbox WHERE chat=?',('301',)))
        self.assertIn(message.strip(),out)
    def test_telegram_group_and_private_chatter_not_tickets(self):
        self.link(self.a,401);self.event(401,'До встречи!')
        self.update_id+=1;self.tg.event({'update_id':self.update_id,'message':{'chat':{'id':-33,'type':'group'},'from':{'id':401},'text':'/new Группа'}})
        with self.store.db() as c:self.assertEqual(self.store.all(c,'tickets'),[])
    def test_telegram_timeout_not_retried_automatically(self):
        with self.store.db(True) as c:self.store.telegram_enqueue(c,'501','Тест',key())
        self.tg.request=lambda *args:(_ for _ in ()).throw(RuntimeError('Telegram недоступен по сети'))
        self.assertTrue(self.tg.send_once());self.assertFalse(self.tg.send_once())
        with self.store.db() as c:self.assertEqual(c.execute('SELECT state FROM tg_outbox').fetchone()[0],'uncertain')
    def test_telegram_submitted_is_not_delivered(self):
        with self.store.db(True) as c:self.store.telegram_enqueue(c,'601','Тест',key(),'KZ-000001')
        self.tg.request=lambda *args:{'message_id':777};self.tg.send_once()
        with self.store.db() as c:
            self.assertEqual(c.execute('SELECT state FROM tg_outbox').fetchone()[0],'submitted');self.assertEqual(c.execute('SELECT ticket_id FROM tg_messages').fetchone()[0],'KZ-000001')
    def test_document_lifecycle_and_false_signature_prevented(self):
        d=self.create_doc()
        with self.assertRaises(Fault):self.action(d,'test-sign')
        d=self.action(d,'submit');d=self.action(d,'approve');d=self.action(d,'test-sign',cryptographicallyVerified=True)
        self.assertEqual(d['status'],'signed');self.assertFalse(d['signatures'][0]['cryptographicallyVerified']);self.assertTrue(d['testMode'])
        with self.assertRaises(Fault):self.action(d,'edit',title='Подмена',content='Подмена')
        with self.assertRaises(Fault):self.store.patch(self.a,[{'kind':'documents','id':d['id'],'version':d['_v'],'value':dict(d,status='signed')}],key())
    def test_document_author_reviewer_scope_and_attachment(self):
        meta=self.store.upload(self.a,'memo.txt','text/plain',b'test')
        d=self.docs.create(self.a,{'title':'Memo','content':'Test','reviewers':[self.eng['id']],'signers':[self.a['id']],'files':[meta]},key())['document']
        self.assertEqual(self.docs.list(self.b)['documents'],[])
        self.assertEqual(self.store.attachment(self.eng,meta['id'])['data'],b'test')
        with self.assertRaises(Fault):self.store.attachment(self.b,meta['id'])
        d=self.action(d,'submit')
        with self.assertRaises(Fault):self.action(d,'approve',user=self.a)
        d=self.action(d,'approve',user=self.eng)
        self.assertEqual(d['status'],'signing')
    def test_document_return_conflict_and_idempotency(self):
        d=self.create_doc();old=d;d=self.action(d,'submit')
        with self.assertRaises(Fault):self.action(old,'submit')
        d=self.action(d,'reject',comment='Уточнить оборудование');d=self.action(d,'edit',title='Принтер',content='Модель указана')
        self.assertEqual(d['status'],'draft');self.assertEqual(d['approvals'],[])
        body={'id':d['id'],'version':d['_v'],'action':'submit','key':key()};a=self.docs.act(self.a,body);b=self.docs.act(self.a,body);self.assertEqual(a,b)
    def test_eds_disabled_expired_and_replay(self):
        challenge=self.docs.challenge(None,{'purpose':'login'},'localhost')
        with self.assertRaises(Fault):self.docs.complete(None,{'id':challenge['id'],'cms':'not-verified'},'localhost')
        self.docs.config={'enabled':True,'verifier_url':'http://127.0.0.1:12345/verify'}
        self.docs.verify_cms=lambda *x:{'iin':'000000000001','name':'Тест','certificateSerial':'test'}
        c=self.docs.challenge(self.a,{'purpose':'bind'},'localhost');self.docs.complete(self.a,{'id':c['id'],'cms':'test'},'localhost')
        with self.assertRaises(Fault):self.docs.complete(self.a,{'id':c['id'],'cms':'test'},'localhost')
        login=self.docs.challenge(None,{'purpose':'login'},'localhost');r=self.docs.complete(None,{'id':login['id'],'cms':'test'},'localhost');self.assertEqual(r['user']['id'],self.a['id']);self.assertEqual(r['user']['role'],'employee')
        expired=self.docs.challenge(None,{'purpose':'login'},'localhost')
        with self.store.db(True) as c:c.execute('UPDATE eds_challenges SET expires=0 WHERE id=?',(expired['id'],))
        with self.assertRaises(Fault):self.docs.complete(None,{'id':expired['id'],'cms':'test'},'localhost')
    def test_eds_strict_verifier_contract_rejects_revocation_and_wrong_payload(self):
        self.docs.config={'enabled':True,'verifier_url':'http://127.0.0.1:12345/verify'}
        good={'verified':True,'chainValid':True,'validNow':True,'revocationChecked':True,'keyUsageValid':True,'revoked':False,'payloadSha256':digest('test'),'iin':'000000000001','name':'Test'}
        class Response:
            def __enter__(self):return self
            def __exit__(self,*a):pass
            def read(self,*a):return js(self.data).encode()
        class Opener:
            def open(self,*a,**kw):r=Response();r.data=self.data;return r
        op=Opener()
        with patch('documents_service.build_opener',return_value=op):
            for change in ({'revoked':True},{'payloadSha256':'wrong'},{'verified':'true'},{'revocationChecked':False},{'validNow':False}):
                op.data=dict(good,**change)
                with self.assertRaises(Fault):self.docs.verify_cms(base64.b64encode(b'x'*100).decode(),'test','login')
            op.data=good;self.assertEqual(self.docs.verify_cms(base64.b64encode(b'x'*100).decode(),'test','login')['iin'],'000000000001')
    def test_ai_context_acl_and_no_automatic_send(self):
        ai=Assistant(self.store,{})
        t=self.store.create_ticket(self.a,{'subject':'Не печатает принтер','phone':'+77010000001','engineerId':'u4'},key())['ticket']
        with self.assertRaises(Fault):ai.suggest(self.b,{'ticketId':t['id']})
        r=ai.suggest(self.eng,{'ticketId':t['id']});self.assertEqual(r['source'],'template');self.assertIn('модель принтера',r['text']);self.assertEqual(self.get('tickets',t['id'])['messages'],[])
        r=ai.suggest(self.a,{'subject':'Принтер','draft':'ошибка 02','mode':'create'});self.assertIn('Ошибка 02',r['text'])
    def test_secret_config_is_masked_and_api_token_types_not_confused(self):
        app=App(self.store,{'channels':[],'_config_path':str(Path(self.tmp.name)/'private.json')})
        with self.assertRaises(Fault):app.configure({'section':'telegram','enabled':True,'bot_token':'abc123nottelegram'})
        app.configure({'section':'ai','enabled':True,'api_key':'fake-secret-key','model':'gpt-4.1-mini'})
        self.assertNotIn('fake-secret-key',js(app.assistant.status()))
        self.assertEqual(json.loads((Path(self.tmp.name)/'private.json').read_text())['ai']['api_key'],'fake-secret-key')
    def test_document_and_telegram_survive_sqlite_backup(self):
        d=self.create_doc();self.link(self.a,701);self.event(701,'/new Ошибка программы')
        out=self.store.backup(Path(self.tmp.name)/'backup.sqlite3');restored=Store(out)
        with restored.db() as c:self.assertIsNotNone(restored.get(c,'documents',d['id']));self.assertEqual(c.execute('SELECT count(*) FROM tg_links').fetchone()[0],1)

if __name__=='__main__':unittest.main()
