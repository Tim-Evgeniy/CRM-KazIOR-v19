"""Regression coverage for personnel edits and password reset on a disposable database."""
import copy,json,secrets,sys,tempfile,threading,unittest
from pathlib import Path
from urllib.request import Request,build_opener,ProxyHandler
from urllib.error import HTTPError
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from crm_store import Store,Fault,js
from crm_server import App,Server,handler_factory
from wa_service import WhatsApp
from unittest.mock import patch

class PersonnelTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.store=Store(Path(self.tmp.name)/'db.sqlite3')
  self.employee=self.store.login_name({'name':'Проверка Профиля'})['user']
  with self.store.db() as c:self.admin=self.store.get(c,'users','u1');self.engineer=self.store.get(c,'users','u4')
 def tearDown(self):self.tmp.cleanup()
 def patch(self,actor,target,**values):
  self.store.patch(actor,[{'kind':'users','id':target['id'],'version':target['_v'],'value':dict(copy.deepcopy(target),**values)}],secrets.token_hex(16))
 def test_own_contacts_persist_and_other_person_cannot_edit(self):
  self.patch(self.employee,self.employee,location='Корпус Б, кабинет 315',phone='+77010000000',email='test@example.test')
  with self.store.db() as c:person=self.store.get(c,'users',self.employee['id'])
  self.assertEqual(person['location'],'Корпус Б, кабинет 315')
  for actor in (self.employee,self.engineer):
   with self.assertRaises(Fault):self.patch(actor,self.admin,phone='+77010000001')
 def test_password_edit_revokes_sessions(self):
  with self.store.db(True) as c:token=self.store.session(c,self.engineer)
  self.patch(self.admin,self.engineer,password='NewTestPassword-19')
  with self.assertRaises(Fault):self.store.authenticate(token)
  self.assertEqual(self.store.login_password({'login':self.engineer['login'],'password':'NewTestPassword-19'})['user']['id'],self.engineer['id'])
 def channel(self):
  return {'id':'desk','engineer_id':'u1','phone':'+77779712555','id_instance':'123','api_token':'test-token','api_url':'https://api.green-api.com','enabled':True,'routing':'common','incoming_mode':'all'}
 def test_web_ticket_reply_status_queue_and_plain_whatsapp_response(self):
  config={'channels':[self.channel()]};App(self.store,config)
  t=self.store.create_ticket(self.employee,{'subject':'Не работает компьютер','phone':'+77010000001'},secrets.token_hex(16))['ticket']
  self.assertEqual(t['wa']['chat'],'77010000001@c.us')
  modified=copy.deepcopy(t);modified['engineerId']=self.admin['id'];modified['status']='working';modified['messages'].append({'text':'Проверяем компьютер','files':[]})
  self.store.patch(self.admin,[{'kind':'tickets','id':t['id'],'version':t['_v'],'value':modified}],secrets.token_hex(16))
  with self.store.db() as c:
   messages=[r[0] for r in c.execute("SELECT message FROM outbox WHERE chat='77010000001@c.us'")]
   notices=[n for n in self.store.all(c,'notifications') if n['recipientId']==self.employee['id']]
  self.assertTrue(any('Ответ по заявке' in m and 'Проверяем компьютер' in m and 'www.its24.kz' in m for m in messages))
  self.assertTrue(any('Новый статус: В работе' in m for m in messages));self.assertTrue(notices)
  wa=WhatsApp(self.store,config)
  incoming={'typeWebhook':'incomingMessageReceived','idMessage':'plain-reply','instanceData':{'idInstance':'123'},'senderData':{'chatId':'77010000001@c.us'},'messageData':{'typeMessage':'textMessage','textMessageData':{'textMessage':'Ошибка осталась'}}}
  self.assertEqual(wa.event('desk',incoming),t['id'])
  self.assertEqual(wa.event('desk',incoming),t['id'])
  with self.store.db() as c:ticket=self.store.get(c,'tickets',t['id'])
  self.assertEqual(sum(m['text']=='Ошибка осталась' for m in ticket['messages']),1)
 def test_only_channel_can_send_dispatch_and_test_deliveries_are_tracked(self):
  wa=WhatsApp(self.store,{'channels':[self.channel()]});wa.states['desk']={'ok':True}
  with self.store.db(True) as c:self.store.enqueue(c,'dispatch','77779712555@c.us','Test notification','',secrets.token_hex(16))
  with patch.object(wa.apis['desk'],'request',return_value={'idMessage':'out-1'}) as send:
   self.assertTrue(wa.send_once());self.assertEqual(send.call_count,1)
  wa.event('desk',{'typeWebhook':'outgoingMessageStatus','idMessage':'out-1','status':'delivered','instanceData':{'idInstance':'123'}})
  self.assertEqual(wa.status()['outbox'].get('delivered'),1)
 def test_dedicated_service_number_can_accept_plain_new_message(self):
  config=self.channel();config['incoming_mode']='all';wa=WhatsApp(self.store,{'channels':[config]})
  incoming={'typeWebhook':'incomingMessageReceived','idMessage':'new-plain','instanceData':{'idInstance':'123'},'senderData':{'chatId':'77010000002@c.us'},'messageData':{'typeMessage':'textMessage','textMessageData':{'textMessage':'Принтер не печатает'}}}
  tid=wa.event('desk',incoming);self.assertTrue(tid)
  with self.store.db() as c:self.assertEqual(self.store.get(c,'tickets',tid)['subject'],'Принтер не печатает')
 def test_http_password_reset_is_superadmin_only_for_all_roles(self):
  server=Server(('127.0.0.1',0),handler_factory(App(self.store,{'channels':[]})))
  thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  client=build_opener(ProxyHandler({}))
  def reset(actor,uid,password):
   with self.store.db(True) as c:token=self.store.session(c,actor)
   req=Request(f'http://127.0.0.1:{server.server_port}/api/password',data=js({'uid':uid,'password':password}).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+token})
   try:
    with client.open(req) as r:return r.status
   except HTTPError as e:
    with e:return e.code
  try:
   self.assertEqual(reset(self.engineer,self.employee['id'],'NewTestPassword-19'),403)
   self.assertEqual(reset(self.employee,self.engineer['id'],'NewTestPassword-19'),403)
   self.assertEqual(reset(self.admin,self.employee['id'],'short'),400)
   for target in (self.employee,self.engineer):
    self.assertEqual(reset(self.admin,target['id'],'NewTestPassword-19'),200)
    self.assertEqual(self.store.login_password({'login':target['login'],'password':'NewTestPassword-19'})['user']['id'],target['id'])
  finally:server.shutdown();server.server_close();thread.join()
 def test_whatsapp_diagnostics_and_test_message_do_not_expose_secret(self):
  app=App(self.store,{'channels':[self.channel()]})
  server=Server(('127.0.0.1',0),handler_factory(app));thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  with self.store.db(True) as c:token=self.store.session(c,self.admin)
  client=build_opener(ProxyHandler({}))
  def request(path,data=None):
   req=Request(f'http://127.0.0.1:{server.server_port}'+path,data=js(data).encode() if data is not None else None,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
   with client.open(req) as r:return r.read().decode()
  try:
   for asset in ('v18-ui.js','v19-ui.js','ncalayer.js'):self.assertTrue(request('/'+asset))
   with patch('receiver.GreenAPI.request',side_effect=[{'stateInstance':'authorized'},{'wid':'77779712555@c.us','incomingWebhook':'yes','outgoingWebhook':'yes','webhookUrl':''}]):
    result=json.loads(request('/api/whatsapp/check',{'id':'desk'}));self.assertTrue(result['ok']);self.assertNotIn('test-token',js(result))
   data={'id':'desk','phone':'+77010000003','key':secrets.token_hex(16)}
   self.assertTrue(json.loads(request('/api/whatsapp/test',data))['ok']);request('/api/whatsapp/test',data)
   with self.store.db() as c:self.assertEqual(c.execute("SELECT count(*) FROM outbox WHERE chat='77010000003@c.us'").fetchone()[0],1)
   with patch.object(WhatsApp,'start') as start:
    request('/api/whatsapp/apply',{})
    app.wa_reload_lock.acquire(timeout=3);app.wa_reload_lock.release();self.assertEqual(start.call_count,1)
  finally:app.stop.set();server.shutdown();server.server_close();thread.join()

if __name__=='__main__':unittest.main()
