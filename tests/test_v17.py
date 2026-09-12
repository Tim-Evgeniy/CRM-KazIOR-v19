"""v17 integration contracts with fake providers, no real mail or messaging."""
import base64,copy,json,secrets,sys,tempfile,time,unittest
from pathlib import Path
from urllib.parse import parse_qs,urlsplit
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from crm_store import Store,Fault,password_hash,digest,js
from crm_server import App
from oauth_service import OAuth,PROVIDERS
from mail_service import Mail,decode_message
from ai_service import Assistant
from categories import CATEGORIES
from ncanode_verifier import verify
from documents_service import Documents
from wa_service import WhatsApp

def key():return secrets.token_hex(24)
class Connectors(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.s=Store(Path(self.tmp.name)/'db.sqlite3');self.a=self.s.login_name({'name':'Тестовый Сотрудник А'})['user'];self.b=self.s.login_name({'name':'Тестовый Сотрудник Б'})['user']
  self.cfg={'channels':[],'_config_path':str(Path(self.tmp.name)/'config.json'),'oauth':{'public_origin':'http://localhost:8000',**{p:{'enabled':True,'client_id':'test-client-'+p,'client_secret':'test-secret-'+p} for p in PROVIDERS}}}
  self.app=App(self.s,self.cfg);self.o=self.app.oauth;self.mail=self.app.mail
  with self.s.db() as c:self.eng=self.s.get(c,'users','u4');self.admin=self.s.get(c,'users','u1')
 def tearDown(self):self.tmp.cleanup()
 def flow(self,provider='google',purpose='login',user=None):
  nonce=key();r,cookie=self.o.begin(user,{'provider':provider,'purpose':purpose,'nonce':nonce},'localhost:8000');q={k:v[0] for k,v in parse_qs(urlsplit(r['url']).query).items()};return nonce,cookie,q
 def identity(self,provider):return {'subject':'same-provider-subject','email':'verified@example.test','name':self.admin['name']}
 def callback(self,purpose='login',user=None,provider='google'):
  nonce,cookie,q=self.flow(provider,purpose,user)
  with patch('oauth_service.request_json',return_value={'access_token':'private-token','refresh_token':'private-refresh','scope':PROVIDERS[provider].get('mail',''),'expires_in':3600}),patch.object(self.o,'userinfo',return_value=self.identity(provider)):
   self.o.callback(provider,{'state':q['state'],'code':'fake-code'},cookie)
  return self.o.finish(cookie,nonce)
 def account(self,owner=None):
  uid=(owner or self.a)['id'];aid='fake-google'
  with self.s.db(True) as c:c.execute('INSERT OR REPLACE INTO mail_accounts VALUES (?,?,?,?,?,?)',(aid,uid,'google','test@example.test',js({'access_token':'secret','refresh_token':'refresh','expires_at':time.time()+300}),js({})))
  return aid
 def test_profile_details_new_engineer_and_password_preservation(self):
  with self.s.db() as c:rows=self.s.all(c,'users');old=c.execute("SELECT hash FROM accounts WHERE uid='u1'").fetchone()[0]
  staff=[u for u in rows if u['role'] in ('engineer','superadmin')];self.assertEqual(len(staff),7);self.assertTrue(all(u['education'] for u in staff));self.assertEqual(next(u for u in staff if u['id']=='u-zhainar')['phone'],'')
  self.assertEqual(self.s.login_password({'login':'Жангербаева Жайнар Ельшатовна','password':'KazIOR@2026'})['user']['id'],'u-zhainar')
  with self.s.db(True) as c:c.execute("UPDATE accounts SET hash=? WHERE uid='u-zhainar'",(password_hash('changed-password'),))
  restored=Store(self.s.path);restored.login_password({'login':'zhainar','password':'changed-password'})
  with restored.db() as c:self.assertEqual(c.execute("SELECT hash FROM accounts WHERE uid='u1'").fetchone()[0],old)
  directory=self.s.snapshot(self.a)['db']['users'];self.assertTrue(next(u for u in directory if u['id']=='u4')['degree']);self.assertNotIn('login',next(u for u in directory if u['id']=='u4'))
 def test_every_category_has_specific_draft_and_preserves_facts(self):
  ai=Assistant(self.s,{})
  for category in CATEGORIES:
   r=ai.suggest(self.a,{'mode':'create','category':category,'subject':'Ошибка','room':'315','dept':'Отдел','draft':'ошибка 02'})
   self.assertIn(category,r['text']);self.assertIn('315',r['text']);self.assertIn('Ошибка 02',r['text']);self.assertEqual(r['source'],'template')
  self.assertIn('Название сети',ai.suggest(self.a,{'mode':'create','category':'Wi-Fi'})['text'])
  t=self.s.create_ticket(self.a,{'subject':'Устройство','category':'Видеонаблюдение','phone':'+77010000001','engineerId':'u4'},key())['ticket']
  self.assertIn('какая камера',ai.suggest(self.eng,{'ticketId':t['id']})['text'])
 def test_oauth_state_cookie_pkce_and_provider_are_bound(self):
  nonce,cookie,q=self.flow();self.assertEqual(q['code_challenge_method'],'S256');self.assertNotIn('secret',q)
  for bad_cookie,provider in [('wrong','google'),(cookie,'yandex')]:
   with self.assertRaises(Fault):self.o.callback(provider,{'state':q['state'],'code':'fake'},bad_cookie)
  with patch('oauth_service.request_json',return_value={'access_token':'private-token'}),patch.object(self.o,'userinfo',return_value=self.identity('google')):self.o.callback('google',{'state':q['state'],'code':'fake'},cookie)
  with self.assertRaises(Fault):self.o.finish(cookie,'wrong-nonce')
  r=self.o.finish(cookie,nonce);self.assertEqual(r['user']['role'],'employee');self.assertNotEqual(r['user']['id'],self.admin['id']);self.assertNotIn('private-token',js(r))
  with self.assertRaises(Fault):self.o.finish(cookie,nonce)
  with self.assertRaises(Fault):self.o.callback('google',{'state':q['state'],'code':'fake'},cookie)
 def test_oauth_all_providers_link_to_existing_engineer(self):
  for p in PROVIDERS:
   r=self.callback('link',self.eng,p);self.assertEqual(r['purpose'],'link')
   r=self.callback(provider=p);self.assertEqual(r['user']['id'],'u4');self.assertEqual(r['user']['role'],'engineer')
   r=self.callback('link',self.b,p);self.assertIn('error',r)
 def test_userinfo_transport_and_provider_shapes(self):
  cases={'google':{'sub':'g1','name':'A','email':'a@example.test','email_verified':True},'yandex':{'id':'y1','client_id':'test-client-yandex','real_name':'A','default_email':'a@example.test'},'mailru':{'id':'r1','first_name':'A','last_name':'B','email':'a@example.test'},'microsoft':{'id':'m1','displayName':'A','mail':'a@example.test'}}
  for provider,profile in cases.items():
   with patch('oauth_service.request_json',return_value=profile) as req:
    identity=self.o.userinfo(provider,{'access_token':'mock-access-token'});self.assertEqual(identity['email'],'a@example.test')
    if provider=='mailru':self.assertIn('access_token=mock-access-token',req.call_args.args[0])
    else:self.assertNotIn('mock-access-token',req.call_args.args[0])
  with patch('oauth_service.request_json',return_value={**cases['yandex'],'client_id':'wrong'}):
   with self.assertRaises(Fault):self.o.userinfo('yandex',{'access_token':'test'})
 def test_imap_initial_window_then_new_uids_only(self):
  aid='test-imap'
  with self.s.db(True) as c:c.execute('INSERT INTO mail_accounts VALUES (?,?,?,?,?,?)',(aid,self.a['id'],'mailru','a@example.test',js({'password':'fake'}),js({})))
  class IMAP:
   count=60
   def __init__(self,*a,**k):pass
   def login(self,*a):return 'OK',[]
   def logout(self):pass
   def select(self,*a,**k):return 'OK',[]
   def response(self,*a):return 'UIDVALIDITY',[b'1']
   def uid(self,cmd,*args):
    if cmd=='search':return 'OK',[b' '.join(str(i).encode() for i in range(1,self.count+1))]
    if args[1]=='(RFC822.SIZE)':return 'OK',[b'1 (RFC822.SIZE 100)']
    return 'OK',[(b'1',b'From: A <a@example.test>\r\nSubject: Test\r\n\r\nHello')]
  with patch('mail_service.imaplib.IMAP4_SSL',IMAP):
   self.assertEqual(self.mail.sync(self.a,aid)['received'],50);IMAP.count=62;self.assertEqual(self.mail.sync(self.a,aid)['received'],2)
  self.assertEqual(len(self.mail.list(self.a)['messages']),52)
 def test_mail_consent_does_not_link_login_or_expose_secrets(self):
  r=self.callback('mail',self.a);self.assertEqual(r['purpose'],'mail')
  with self.s.db() as c:self.assertEqual(c.execute('SELECT count(*) FROM oauth_links').fetchone()[0],0)
  data=self.mail.list(self.a);self.assertEqual(len(data['accounts']),1);self.assertNotIn('private-',js(data));self.assertEqual(self.mail.list(self.b)['accounts'],[])
  with self.assertRaises(Fault):self.mail.sync(self.b,data['accounts'][0]['id'])
 def test_mail_scopes_are_required(self):
  nonce,cookie,q=self.flow('google','mail',self.a)
  with patch('oauth_service.request_json',return_value={'access_token':'x','scope':'openid email'}),patch.object(self.o,'userinfo',return_value=self.identity('google')):self.o.callback('google',{'state':q['state'],'code':'fake'},cookie)
  self.assertIn('error',self.o.finish(cookie,nonce));self.assertEqual(self.mail.list(self.a)['accounts'],[])
 def test_token_refresh_keeps_refresh_token_and_not_public(self):
  aid=self.account();a=self.mail.account(self.a,aid)
  with patch('oauth_service.request_json',return_value={'access_token':'new-token','expires_in':3600}) as req:
   # Force refresh by moving expiry to the past.
   a['secret']=js({'access_token':'old','refresh_token':'old-refresh','expires_at':0});self.assertEqual(self.o.access_token(a),'new-token');self.assertEqual(req.call_args.kwargs['form']['grant_type'],'refresh_token')
  with self.s.db() as c:stored=json.loads(c.execute('SELECT secret FROM mail_accounts').fetchone()[0])
  self.assertEqual(stored['refresh_token'],'old-refresh');self.assertNotIn('new-token',js(self.mail.list(self.a)))
 def test_mail_sync_is_idempotent_plaintext_and_owner_scoped(self):
  aid=self.account();raw=b'From: A <sender@example.test>\r\nSubject: Printer\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Printer error</p><script>steal()</script>'
  m=decode_message(raw);self.assertNotIn('steal',m['body'])
  with patch.object(self.mail,'fetch',return_value=[('m1',m)]):self.assertEqual(self.mail.sync(self.a,aid)['received'],1);self.assertEqual(self.mail.sync(self.a,aid)['received'],0)
  self.assertEqual(len(self.mail.list(self.a)['messages']),1);self.assertEqual(self.mail.list(self.b)['messages'],[])
  with self.assertRaises(Fault):self.mail.message(self.b,aid,'m1')
 def test_mail_send_replay_and_uncertain_no_double_send(self):
  aid=self.account();data={'account':aid,'to':'receiver@example.test','subject':'Test','body':'Fake','key':key()}
  with patch('mail_service.request_json',return_value={'id':'test'}) as send:
   self.assertEqual(self.mail.send(self.a,data)['state'],'submitted');self.mail.send(self.a,data);self.assertEqual(send.call_count,1)
  data['key']=key()
  with patch('mail_service.request_json',side_effect=TimeoutError()) as send:
   with self.assertRaises(Fault):self.mail.send(self.a,data)
   with self.assertRaises(Fault):self.mail.send(self.a,data)
   self.assertEqual(send.call_count,1)
 def test_mail_import_requires_phone_and_no_sender_account_takeover(self):
  aid=self.account(self.eng);m={'from':self.admin['email'],'senderName':self.admin['name'],'subject':'Тест','body':'Проверка','date':''}
  with patch.object(self.mail,'fetch',return_value=[('m1',m)]):self.mail.sync(self.eng,aid)
  r=self.mail.to_ticket(self.eng,{'account':aid,'id':'m1','phone':'+77010000001'});again=self.mail.to_ticket(self.eng,{'account':aid,'id':'m1','phone':'+77010000001'});self.assertEqual(r,again)
  with self.s.db() as c:t=self.s.get(c,'tickets',r['id'])
  self.assertTrue(t['ownerId'].startswith('mail-'));self.assertNotEqual(t['ownerId'],self.admin['id']);self.assertEqual(t['ownerName'],self.admin['name']);self.assertIn(self.admin['name'],t['description'])
  with self.s.db() as c:self.assertEqual(self.s.get(c,'users','u4')['phone'],self.eng['phone'])
 def test_config_secrets_masked_and_redirect_not_open(self):
  self.assertNotIn('test-secret',js(self.o.status(self.admin)))
  with self.assertRaises(Fault):self.o.begin(None,{'provider':'google','nonce':key()},'evil.test')
  with self.assertRaises(Fault):self.app.configure({'section':'oauth','provider':'google','public_origin':'https://example.test/redirect','enabled':True})
 def test_ncanode_payload_revocation_expiry_and_invalid_flags(self):
  cert={'valid':True,'subject':{'iin':'000000000001','commonName':'Тест'},'notBefore':'2020-01-01T00:00:00Z','notAfter':'2100-01-01T00:00:00Z','keyUsage':'SIGN','serialNumber':'TEST','revocations':[{'by':'OCSP','revoked':False}]}
  good={'status':200,'valid':True,'signers':[{'status':'VALID','certificates':[cert]}]};extract={'status':200,'data':base64.b64encode(b'nonce').decode()}
  class Response:
   def __init__(self,data):self.data=data
   def __enter__(self):return self
   def __exit__(self,*a):pass
   def read(self,*a):return js(self.data).encode()
  class Opener:
   data=good;extracted=extract
   def open(self,req,**kwargs):return Response(self.extracted if req.full_url.endswith('/extract') else self.data)
  op=Opener();cfg={'verifier_url':'http://127.0.0.1:14579'}
  with patch('ncanode_verifier.build_opener',return_value=op):
   self.assertEqual(verify(cfg,'fake','nonce','login')['iin'],'000000000001')
   for change in ({'valid':False},{'revocations':[]},{'revocations':[{'by':'OCSP','revoked':True}]},{'notAfter':'2001-01-01T00:00:00Z'},{'keyUsage':'UNKNOWN'}):
    op.data={**good,'signers':[{'status':'VALID','certificates':[{**cert,**change}]}]}
    with self.assertRaises(Fault):verify(cfg,'fake','nonce','login')
   op.data=good;op.extracted={**extract,'data':base64.b64encode(b'other nonce').decode()}
   with self.assertRaises(Fault):verify(cfg,'fake','nonce','login')
 def test_eds_first_login_employee_only(self):
  docs=Documents(self.s,{'eds':{'enabled':True,'verifier_url':'http://localhost:14579','provider':'ncanode'}});challenge=docs.challenge(None,{'purpose':'login'},'localhost')
  docs.verify_cms=lambda *a:{'iin':'000000000002','name':self.admin['name'],'certificateSerial':'TEST'}
  r=docs.complete(None,{'id':challenge['id'],'cms':'mock'},'localhost');self.assertEqual(r['user']['role'],'employee');self.assertNotEqual(r['user']['id'],self.admin['id'])
  with self.assertRaises(Fault):docs.complete(None,{'id':challenge['id'],'cms':'mock'},'localhost')
 def test_whatsapp_common_channel_chooses_engineer(self):
  channel={'id':'test','engineer_id':'u1','phone':self.admin['phone'],'id_instance':'1100123456','api_token':'x'*48,'api_url':'https://api.green-api.com','enabled':True,'routing':'common','default_engineer_id':'u3'}
  wa=WhatsApp(self.s,{'channels':[channel]})
  def event(mid,text):return {'typeWebhook':'incomingMessageReceived','instanceData':{'idInstance':1100123456},'idMessage':mid,'timestamp':time.time(),'senderData':{'chatId':'77010000001@c.us','sender':'77010000001@c.us','senderName':'Тест Врач'},'messageData':{'typeMessage':'textMessage','textMessageData':{'textMessage':text}}}
  tid=wa.event('test',event('M1','Заявка: @elnur Wi-Fi не работает'));wa.event('test',event('M1','Заявка: @elnur Wi-Fi не работает'))
  tid2=wa.event('test',event('M2','Заявка: Принтер не работает'))
  with self.s.db() as c:
   self.assertEqual(self.s.get(c,'tickets',tid)['engineerId'],'u5');self.assertEqual(self.s.get(c,'tickets',tid2)['engineerId'],'u3');self.assertEqual(len(self.s.all(c,'tickets')),2)
  wa.event('test',event('M3','Заявка: @unknown Принтер'))
  with self.s.db() as c:self.assertEqual(len(self.s.all(c,'tickets')),2)

class HttpFlows(unittest.TestCase):
 def test_public_buttons_cookie_finish_and_private_mail_routes(self):
  import http.client,threading
  from crm_server import Server,handler_factory
  with tempfile.TemporaryDirectory() as folder:
   s=Store(Path(folder)/'db.sqlite3');cfg={'channels':[],'oauth':{'public_origin':'http://127.0.0.1:8000','google':{'enabled':True,'client_id':'test','client_secret':'secret'}}};app=App(s,cfg);server=Server(('127.0.0.1',0),handler_factory(app));port=server.server_address[1];cfg['oauth']['public_origin']='http://127.0.0.1:'+str(port);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
   def req(path,data=None,token='',cookie=''):
    conn=http.client.HTTPConnection('127.0.0.1',port,timeout=10);headers={}
    if data is not None:headers['Content-Type']='application/json'
    if token:headers['Authorization']='Bearer '+token
    if cookie:headers['Cookie']=cookie
    conn.request('POST' if data is not None else 'GET',path,js(data) if data is not None else None,headers);r=conn.getresponse();raw=r.read();h=dict(r.getheaders());status=r.status;conn.close();return status,h,json.loads(raw) if h.get('Content-Type','').startswith('application/json') and raw else raw
   try:
    self.assertEqual(req('/mail.html')[0],200);self.assertEqual(req('/v17-ui.js')[0],200);self.assertEqual(req('/api/mail')[0],401);self.assertEqual(req('/server/config.example.json')[0],404)
    nonce=key();code,h,r=req('/api/oauth/begin',{'provider':'google','purpose':'login','nonce':nonce});self.assertEqual(code,200);cookie=h['Set-Cookie'].split(';')[0];self.assertIn('HttpOnly',h['Set-Cookie']);self.assertIn('SameSite=Lax',h['Set-Cookie']);state=parse_qs(urlsplit(r['url']).query)['state'][0]
    with patch('oauth_service.request_json',return_value={'access_token':'t'}),patch.object(app.oauth,'userinfo',return_value={'subject':'id1','email':'a@example.test','name':'Тест OAuth'}):
     status,h,_=req('/api/oauth/callback/google?state='+state+'&code=test',cookie=cookie);self.assertEqual(status,303);self.assertNotIn('code=',h['Location'])
    status,h,r=req('/api/oauth/finish',{'nonce':nonce},cookie=cookie);self.assertEqual(status,200);self.assertEqual(r['user']['role'],'employee');token=r['token'];self.assertIn('Max-Age=0',h['Set-Cookie'])
    self.assertEqual(req('/api/mail',token=token)[0],200);self.assertEqual(req('/api/integrations/configure',{'section':'oauth'},token)[0],403)
    status,_,challenge=req('/api/eds/challenge',{'purpose':'login'});self.assertEqual(status,200);self.assertEqual(req('/api/eds/complete',{'id':challenge['id'],'cms':'fake'})[0],503)
   finally:server.shutdown();server.server_close();thread.join(timeout=5)

if __name__=='__main__':unittest.main()
