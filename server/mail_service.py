"""Private mailboxes: Gmail/Graph OAuth, Yandex/Mail.ru IMAP+SMTP app passwords."""
import base64,email,email.policy,email.utils,imaplib,json,re,secrets,smtplib,ssl,threading,time
from html.parser import HTMLParser
from urllib.parse import quote,urlencode
from crm_store import Fault,clean_text,digest,js,now,is_staff,phone,ROLES
from oauth_service import request_json

SERVERS={'yandex':('imap.yandex.ru','smtp.yandex.ru'),'mailru':('imap.mail.ru','smtp.mail.ru')}
class Plain(HTMLParser):
 def __init__(self):super().__init__();self.text=[];self.skip=0
 def handle_starttag(self,tag,attrs):
  if tag in ('script','style'):self.skip+=1
  if tag in ('p','br','div','tr'):self.text.append('\n')
 def handle_endtag(self,tag):
  if tag in ('script','style'):self.skip=max(0,self.skip-1)
 def handle_data(self,data):
  if not self.skip:self.text.append(data)
def plain_html(value):
 p=Plain();p.feed(value);return ''.join(p.text)
def decode_message(raw):
 msg=email.message_from_bytes(raw,policy=email.policy.default);part=msg.get_body(preferencelist=('plain','html')) if msg.is_multipart() else msg
 body=part.get_content() if part else ''
 if not isinstance(body,str):body=''
 if part and part.get_content_type()=='text/html':body=plain_html(body)
 name,address=email.utils.parseaddr(str(msg.get('From','')))
 return {'from':address,'senderName':name,'subject':str(msg.get('Subject','Без темы')),'body':body[:40000],'date':str(msg.get('Date','')),'messageId':str(msg.get('Message-ID','')),'attachments':[part.get_filename() for part in msg.iter_attachments() if part.get_filename()]}

class Mail:
 def __init__(self,store,oauth,stop=None):
  self.store,self.oauth=store,oauth;self.stop=stop or threading.Event();self.lock=threading.Lock();self.states={}
  with store.db() as c:c.executescript('''
   CREATE TABLE IF NOT EXISTS mail_messages(account TEXT,id TEXT,data TEXT,ticket_id TEXT DEFAULT '',PRIMARY KEY(account,id));
   CREATE TABLE IF NOT EXISTS mail_sends(uid TEXT,key TEXT,state TEXT,stamp TEXT,PRIMARY KEY(uid,key));
  ''')
 def account(self,u,aid):
  with self.store.db() as c:r=c.execute('SELECT * FROM mail_accounts WHERE id=? AND uid=?',(aid,u['id'])).fetchone()
  if not r:raise Fault('Нет доступа к этому ящику',403)
  return dict(r)
 def list(self,u):
  with self.store.db() as c:
   accounts=[dict(r) for r in c.execute('SELECT id,provider,email,data FROM mail_accounts WHERE uid=?',(u['id'],))]
   messages=[dict(json.loads(r['data']),id=r['id'],account=r['account'],ticketId=r['ticket_id']) for r in c.execute('SELECT m.* FROM mail_messages m JOIN mail_accounts a ON a.id=m.account WHERE a.uid=? ORDER BY m.rowid DESC LIMIT 200',(u['id'],))]
  for a in accounts:a.update(self.states.get(a['id'],{'message':'Подключено. Нажмите «Получить письма».','ok':None}));a.pop('data',None)
  return {'accounts':accounts,'messages':messages}
 def connect_password(self,u,data):
  provider=data.get('provider');address=clean_text(data.get('email'),254).lower();password=data.get('password','')
  if provider not in SERVERS or not re.fullmatch(r'[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+',address):raise Fault('Укажите провайдера и адрес почты')
  if not password or len(password)>1000:raise Fault('Введите пароль приложения для почтовой программы')
  aid=provider+'-'+digest(address)[:24]
  with self.store.db() as c:existing=c.execute('SELECT uid FROM mail_accounts WHERE id=?',(aid,)).fetchone()
  if existing and existing['uid']!=u['id']:raise Fault('Ящик уже подключён в другом кабинете',409)
  imap=None;smtp=None
  try:
   imap=imaplib.IMAP4_SSL(SERVERS[provider][0],993,ssl_context=ssl.create_default_context(),timeout=15);imap.login(address,password)
   if imap.select('INBOX',readonly=True)[0]!='OK':raise ValueError()
   smtp=smtplib.SMTP_SSL(SERVERS[provider][1],465,context=ssl.create_default_context(),timeout=15);smtp.login(address,password)
  except Exception:raise Fault('Почта не подтвердила подключение. Разрешите IMAP/SMTP и создайте пароль приложения в настройках почты.',502) from None
  finally:
   for conn in (imap,smtp):
    if conn:
     try:conn.logout() if conn is imap else conn.quit()
     except Exception:pass
  with self.store.db(True) as c:
   # Recheck ownership after the network operation.
   existing=c.execute('SELECT uid FROM mail_accounts WHERE id=?',(aid,)).fetchone()
   if existing and existing['uid']!=u['id']:raise Fault('Ящик уже подключён',409)
   c.execute('INSERT OR REPLACE INTO mail_accounts VALUES (?,?,?,?,?,?)',(aid,u['id'],provider,address,js({'password':password}),js({'connectedAt':now()})))
  return {'ok':True,'id':aid}
 def disconnect(self,u,aid):
  self.account(u,aid)
  if not self.lock.acquire(blocking=False):raise Fault('Дождитесь получения или отправки почты',409)
  try:
   with self.store.db(True) as c:
    c.execute('DELETE FROM mail_messages WHERE account=?',(aid,));c.execute('DELETE FROM mail_accounts WHERE id=? AND uid=?',(aid,u['id']))
  finally:self.lock.release()
  return {'ok':True}
 def sync(self,u,aid):
  a=self.account(u,aid)
  if not self.lock.acquire(blocking=False):raise Fault('Почта уже обрабатывается. Подождите.',409)
  try:
   rows=self.fetch(a);count=0
   with self.store.db(True) as c:
    for mid,item in rows:
     if c.execute('INSERT OR IGNORE INTO mail_messages(account,id,data) VALUES (?,?,?)',(aid,mid,js(item))).rowcount:count+=1
    if '_cursor' in a or '_imap' in a:
     metadata=json.loads(a['data'])
     if '_cursor' in a:metadata['cursor']=a['_cursor']
     if '_imap' in a:metadata['imap']=a['_imap']
     c.execute('UPDATE mail_accounts SET data=? WHERE id=?',(js(metadata),aid))
    if count:self.store.notice(c,u['id'],'Новые письма',f"{a['email']}: получено {count}")
   self.states[aid]={'ok':True,'message':'Обновлено: '+now(),'received':count};return {'ok':True,'received':count}
  except Fault as e:self.states[aid]={'ok':False,'message':str(e)};raise
  except Exception:self.states[aid]={'ok':False,'message':'Не удалось получить письма. Проверьте доступ к почте.'};raise Fault(self.states[aid]['message'],502) from None
  finally:self.lock.release()
 def fetch(self,a):
  provider=a['provider'];rows=[]
  if provider=='google':
   token=self.oauth.access_token(a);root='https://gmail.googleapis.com/gmail/v1/users/me/messages'
   # First sync takes the latest 50. Later sync paginates past known messages to avoid losing a busy inbox.
   page=json.loads(a['data']).get('cursor','');catchup=bool(page);seen=0
   while True:
    result=request_json(root+'?'+urlencode({'labelIds':'INBOX','maxResults':100,**({'pageToken':page} if page else {})}),token=token)
    for item in result.get('messages',[]):
     mid=item['id']
     with self.store.db() as c:known=c.execute('SELECT 1 FROM mail_messages WHERE account=? AND id=?',(a['id'],mid)).fetchone()
     if known:seen+=1;continue
     r=request_json(root+'/'+quote(mid,safe='')+'?format=raw',token=token);raw=base64.urlsafe_b64decode(r['raw']+'===');m=decode_message(raw);m['threadId']=r.get('threadId','');rows.append((mid,m))
    page=result.get('nextPageToken')
    if (seen and not catchup) or not page or len(rows)>=500:
     a['_cursor']=page if page and (not seen or catchup) else '';break
  elif provider=='microsoft':
   token=self.oauth.access_token(a);root='https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages'
   skip=int(json.loads(a['data']).get('cursor') or 0);catchup=bool(skip);seen=0
   while True:
    url=root+'?'+urlencode({'$top':100,'$skip':skip,'$orderby':'receivedDateTime desc','$select':'id,subject,from,body,receivedDateTime,internetMessageId,hasAttachments'})
    r=request_json(url,token=token)
    for item in r.get('value',[]):
     mid=item['id']
     with self.store.db() as c:known=c.execute('SELECT 1 FROM mail_messages WHERE account=? AND id=?',(a['id'],mid)).fetchone()
     if known:seen+=1;continue
     sender=item.get('from',{}).get('emailAddress',{});body=item.get('body',{})
     rows.append((mid,{'from':sender.get('address',''),'senderName':sender.get('name',''),'subject':item.get('subject',''),'body':(plain_html(body.get('content','')) if body.get('contentType','').lower()=='html' else body.get('content',''))[:40000],'date':item.get('receivedDateTime',''),'messageId':item.get('internetMessageId',''),'attachments':['Есть вложения — откройте Outlook'] if item.get('hasAttachments') else []}))
    if (seen and not catchup) or not r.get('@odata.nextLink') or len(rows)>=500:
     a['_cursor']=skip+100 if r.get('@odata.nextLink') and (not seen or catchup) else 0;break
    skip+=100
  else:
   conn=imaplib.IMAP4_SSL(SERVERS[provider][0],993,ssl_context=ssl.create_default_context(),timeout=20)
   try:
    conn.login(a['email'],json.loads(a['secret'])['password'])
    if conn.select('INBOX',readonly=True)[0]!='OK':raise Fault('Папка INBOX недоступна')
    validity=conn.response('UIDVALIDITY')[1];epoch=(validity[0] or b'unknown').decode()
    if epoch=='unknown':raise Fault('Почта не сообщила UIDVALIDITY; повторите получение')
    status,data=conn.uid('search',None,'ALL')
    if status!='OK':raise Fault('Не удалось прочитать список писем')
    ids=data[0].split()
    with self.store.db() as c:known={r[0] for r in c.execute('SELECT id FROM mail_messages WHERE account=?',(a['id'],))}
    # Persist stable UIDVALIDITY:UID, do not mark messages read.
    ids=[x for x in ids if epoch+':'+x.decode() not in known]
    checkpoint=json.loads(a['data']).get('imap',{})
    last_uid=int(checkpoint.get('uid',0)) if checkpoint.get('epoch')==epoch else 0
    ids=[x for x in ids if int(x)>last_uid]
    ids=ids[:500] if last_uid else ids[-50:]
    for uid in ids:
     st,parts=conn.uid('fetch',uid,'(RFC822.SIZE)')
     size=re.search(rb'RFC822.SIZE (\d+)',b' '.join(x for x in parts if isinstance(x,bytes)))
     if not size:raise Fault('Не удалось проверить размер письма')
     a['_imap']={'epoch':epoch,'uid':int(uid)}
     if int(size[1])>10*1024*1024:continue
     st,parts=conn.uid('fetch',uid,'(BODY.PEEK[])')
     if st!='OK':raise Fault('Не удалось получить письмо')
     raw=next((x[1] for x in parts if isinstance(x,tuple)),None)
     if raw:rows.append((epoch+':'+uid.decode(),decode_message(raw)))
   finally:
    try:conn.logout()
    except Exception:pass
  return rows
 def message(self,u,aid,mid):
  a=self.account(u,aid)
  with self.store.db() as c:r=c.execute('SELECT * FROM mail_messages WHERE account=? AND id=?',(aid,mid)).fetchone()
  if not r:raise Fault('Письмо не найдено',404)
  return a,dict(r),json.loads(r['data'])
 def to_ticket(self,u,data):
  if not is_staff(u):raise Fault('Создание заявки из входящего письма доступно инженеру',403)
  a,row,m=self.message(u,data.get('account'),data.get('id'))
  if row['ticket_id']:return {'id':row['ticket_id']}
  number=phone(data.get('phone'))
  if not number:raise Fault('Укажите телефон сотрудника из письма для связи')
  # Keep an external contact separate from all authenticated accounts; From is not identity proof.
  with self.store.db(True) as c:
   previous=c.execute('SELECT ticket_id FROM mail_messages WHERE account=? AND id=?',(a['id'],row['id'])).fetchone()
   if previous and previous['ticket_id']:return {'id':previous['ticket_id']}
   uid='mail-'+digest(a['id']+'|'+m['from'].lower())[:24]
   author=self.store.get(c,'users',uid)
   if not author:
    author={'id':uid,'name':m['senderName'] or m['from'],'login':uid,'role':'employee','status':'active','workStatus':'available','org':'КазНИИОиР','dept':'','phone':number,'email':m['from'],'photo':'','position':'Сотрудник KazIOR · почта','interests':[],'theme':'light','permissions':ROLES['employee'].copy(),'registeredAt':now(),'externalOnly':True}
    self.store.put(c,'users',author)
   ticket=self.store.new_ticket(c,author,{'subject':m['subject'][:180] or 'Обращение по почте','description':'Письмо от '+m['senderName']+' <'+m['from']+'>\n\n'+m['body'],'phone':number,'category':data.get('category','Другое')},source='Email',owner=uid,engineer=u['id'])
   c.execute('UPDATE mail_messages SET ticket_id=? WHERE account=? AND id=?',(ticket['id'],a['id'],row['id']))
  return {'id':ticket['id']}

 def send(self,u,data):
  a=self.account(u,data.get('account'));to=clean_text(data.get('to'),254);subject=clean_text(data.get('subject'),180);body=clean_text(data.get('body'),40000);key=data.get('key','')
  if not re.fullmatch(r'[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+',to) or not subject or not body:raise Fault('Заполните адрес получателя, тему и текст')
  if not re.fullmatch(r'[A-Za-z0-9-]{16,100}',key):raise Fault('Повторите отправку из формы')
  if not self.lock.acquire(blocking=False):raise Fault('Почта уже обрабатывается. Подождите.',409)
  try:
   with self.store.db(True) as c:
    old=c.execute('SELECT state FROM mail_sends WHERE uid=? AND key=?',(u['id'],key)).fetchone()
    if old:
     if old['state']=='submitted':return {'ok':True,'state':'submitted'}
     raise Fault('Статус предыдущей отправки не подтверждён. Проверьте «Отправленные» в почте перед новой попыткой.',409)
    c.execute('INSERT INTO mail_sends VALUES (?,?,?,?)',(u['id'],key,'sending',now()))
   msg=email.message.EmailMessage();msg['From']=a['email'];msg['To']=to;msg['Subject']=subject;msg['Message-ID']=email.utils.make_msgid();msg.set_content(body)
   if data.get('replyId'):
    _,_,original=self.message(u,a['id'],data['replyId'])
    if original.get('messageId') and '\n' not in original['messageId']:msg['In-Reply-To']=original['messageId'];msg['References']=original['messageId']
   if a['provider']=='google':
    payload={'raw':base64.urlsafe_b64encode(msg.as_bytes()).decode().rstrip('=')}
    if data.get('replyId') and original.get('threadId'):payload['threadId']=original['threadId']
    request_json('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',token=self.oauth.access_token(a),payload=payload)
   elif a['provider']=='microsoft':
    request_json('https://graph.microsoft.com/v1.0/me/sendMail',token=self.oauth.access_token(a),payload={'message':{'subject':subject,'body':{'contentType':'Text','content':body},'toRecipients':[{'emailAddress':{'address':to}}]},'saveToSentItems':True})
   else:
    with smtplib.SMTP_SSL(SERVERS[a['provider']][1],465,context=ssl.create_default_context(),timeout=20) as smtp:
     smtp.login(a['email'],json.loads(a['secret'])['password']);smtp.send_message(msg)
   with self.store.db(True) as c:c.execute("UPDATE mail_sends SET state='submitted' WHERE uid=? AND key=?",(u['id'],key))
   return {'ok':True,'state':'submitted'}
  except Exception as e:
   with self.store.db(True) as c:c.execute("UPDATE mail_sends SET state='uncertain' WHERE uid=? AND key=? AND state='sending'",(u['id'],key))
   if isinstance(e,Fault):raise
   raise Fault('Сервер почты не подтвердил отправку. Проверьте «Отправленные» перед повтором.',502) from None
  finally:self.lock.release()
