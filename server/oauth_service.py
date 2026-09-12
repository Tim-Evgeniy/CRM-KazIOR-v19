"""Server-side authorization code flows. Provider identities never grant staff roles."""
import base64,hashlib,json,re,secrets,time
from urllib.parse import urlencode,urlsplit
from urllib.request import Request,build_opener
from crm_store import Fault,clean_text,digest,js,now,ROLES
from receiver import NoRedirect

PROVIDERS={
 'google':dict(name='Google / Gmail',auth='https://accounts.google.com/o/oauth2/v2/auth',token='https://oauth2.googleapis.com/token',info='https://openidconnect.googleapis.com/v1/userinfo',scope='openid email profile',mail='https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',pkce=True),
 'yandex':dict(name='Яндекс',auth='https://oauth.yandex.ru/authorize',token='https://oauth.yandex.ru/token',info='https://login.yandex.ru/info?format=json',scope='login:info login:email',pkce=True),
 'mailru':dict(name='Mail.ru',auth='https://oauth.mail.ru/login',token='https://oauth.mail.ru/token',info='https://oauth.mail.ru/userinfo',scope='userinfo',pkce=False),
 'microsoft':dict(name='Microsoft Outlook / 365',auth='https://login.microsoftonline.com/common/oauth2/v2.0/authorize',token='https://login.microsoftonline.com/common/oauth2/v2.0/token',info='https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName',scope='openid profile email User.Read',mail='offline_access Mail.Read Mail.Send',pkce=True)}

def request_json(url,form=None,token=None,payload=None,auth_type='Bearer',method=None):
 headers={'Accept':'application/json'};raw=None
 if form is not None:raw=urlencode(form).encode();headers['Content-Type']='application/x-www-form-urlencoded'
 if payload is not None:raw=js(payload).encode();headers['Content-Type']='application/json'
 if token:headers['Authorization']=auth_type+' '+token
 try:
  with build_opener(NoRedirect()).open(Request(url,data=raw,headers=headers,method=method),timeout=20) as r:
   raw=r.read(12*1024*1024+1)
   if len(raw)>12*1024*1024:raise ValueError()
   return json.loads(raw) if raw else {}
 except Exception:raise Fault('Провайдер не подтвердил запрос. Проверьте подключение, права приложения и повторите.',502) from None

class OAuth:
 def __init__(self,store,config):
  self.store,self.config=store,config
  with store.db() as c:c.executescript('''
   CREATE TABLE IF NOT EXISTS oauth_flows(state TEXT PRIMARY KEY,provider TEXT,purpose TEXT,uid TEXT,cookie TEXT,nonce TEXT,verifier TEXT,expires REAL,used INTEGER DEFAULT 0,result TEXT);
   CREATE TABLE IF NOT EXISTS oauth_links(provider TEXT,subject TEXT,uid TEXT,email TEXT,PRIMARY KEY(provider,subject),UNIQUE(provider,uid));
   CREATE TABLE IF NOT EXISTS mail_accounts(id TEXT PRIMARY KEY,uid TEXT,provider TEXT,email TEXT,secret TEXT,data TEXT);
  ''')
 def cfg(self,provider):
  if provider not in PROVIDERS:raise Fault('Выберите провайдера')
  return self.config.get('oauth',{}).get(provider,{})
 def origin(self):
  value=self.config.get('oauth',{}).get('public_origin','http://localhost:8000').rstrip('/');p=urlsplit(value)
  if p.path or p.query or p.fragment or p.username or p.password or not p.hostname or (p.scheme!='https' and not(p.scheme=='http' and p.hostname in ('localhost','127.0.0.1'))):raise Fault('Для OAuth нужен HTTPS-адрес CRM или http://localhost:8000',503)
  return value
 def status(self,u=None):
  origin=self.origin();items=[]
  for key,p in PROVIDERS.items():
   c=self.cfg(key);item={'id':key,'name':p['name'],'ready':bool(c.get('enabled') and c.get('client_id') and c.get('client_secret')),'redirectUri':origin+'/api/oauth/callback/'+key}
   if u and u['role']=='superadmin':item.update(clientId=c.get('client_id',''),hasSecret=bool(c.get('client_secret')))
   items.append(item)
  with self.store.db() as c:links=[dict(r) for r in c.execute('SELECT provider,email FROM oauth_links WHERE uid=?',(u['id'],))] if u else []
  return {'providers':items,'publicOrigin':origin,'links':links}
 def begin(self,u,data,host):
  provider=data.get('provider');p=PROVIDERS.get(provider);c=self.cfg(provider);purpose=data.get('purpose','login')
  if not c.get('enabled') or not c.get('client_id') or not c.get('client_secret'):raise Fault('Администратору нужно заполнить Client ID и Client Secret для '+p['name']+' в разделе «Интеграции».',503)
  if purpose not in ('login','link','mail'):raise Fault('Неизвестный способ входа')
  if purpose!='login' and not u:raise Fault('Войдите в CRM',401)
  if purpose=='mail' and provider not in ('google','microsoft'):raise Fault('Для этой почты используйте подключение с паролем приложения')
  origin=self.origin()
  if urlsplit(origin).netloc!=host:raise Fault('Для подключения откройте CRM по адресу '+origin,400)
  nonce=clean_text(data.get('nonce'),100)
  if not re.fullmatch(r'[A-Za-z0-9_-]{32,100}',nonce):raise Fault('Повторите вход из браузера')
  state=secrets.token_urlsafe(32);cookie=secrets.token_urlsafe(32);verifier=secrets.token_urlsafe(48)
  scope=p['scope']+(' '+p['mail'] if purpose=='mail' else '')
  args=dict(client_id=c['client_id'],response_type='code',redirect_uri=origin+'/api/oauth/callback/'+provider,scope=scope,state=state)
  if p['pkce']:args.update(code_challenge=base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('='),code_challenge_method='S256')
  if provider=='google':args.update(prompt='consent' if purpose=='mail' else 'select_account',**({'access_type':'offline'} if purpose=='mail' else {}))
  if provider=='yandex':args['force_confirm']='yes'
  with self.store.db(True) as db:
   db.execute('DELETE FROM oauth_flows WHERE expires<?',(time.time(),))
   db.execute('INSERT INTO oauth_flows VALUES (?,?,?,?,?,?,?,?,0,NULL)',(digest(state),provider,purpose,u['id'] if u else '',digest(cookie),digest(nonce),verifier,time.time()+600))
  return {'url':p['auth']+'?'+urlencode(args)},cookie
 def userinfo(self,provider,tokens):
  p=PROVIDERS[provider];token=tokens.get('access_token')
  if not token:raise Fault('Провайдер не выдал токен доступа',403)
  # Read identity from the provider over TLS. Client JSON/id_token is never used as proof.
  # Mail.ru userinfo requires access_token as a request parameter. This URL is server-only; errors never include it.
  info_url=p['info']+('?'+urlencode({'access_token':token}) if provider=='mailru' else '')
  r=request_json(info_url,token=token,auth_type='OAuth' if provider=='yandex' else 'Bearer')
  if provider=='google':subject=r.get('sub');email=r.get('email') if r.get('email_verified') is True else '';name=r.get('name')
  elif provider=='yandex':
   if r.get('client_id')!=self.cfg(provider)['client_id']:raise Fault('Не совпадает приложение Яндекс',403)
   subject=r.get('id');email=r.get('default_email');name=r.get('real_name') or r.get('display_name')
  elif provider=='microsoft':subject=r.get('id');email=r.get('mail') or r.get('userPrincipalName');name=r.get('displayName')
  else:subject=r.get('id');email=r.get('email');name=r.get('name') or ' '.join(filter(None,[r.get('first_name'),r.get('last_name')]))
  if not subject:raise Fault('Провайдер не подтвердил личность',403)
  return {'subject':str(subject),'email':clean_text(email,254),'name':clean_text(name,160) or clean_text(email,160) or 'Сотрудник KazIOR'}
 def callback(self,provider,query,cookie):
  state=digest(query.get('state',''));stamp=time.time()
  with self.store.db(True) as c:
   row=c.execute('SELECT * FROM oauth_flows WHERE state=?',(state,)).fetchone()
   if not row or row['used'] or row['expires']<stamp or row['provider']!=provider or not secrets.compare_digest(row['cookie'],digest(cookie)):raise Fault('Сеанс входа истёк или открыт в другом браузере. Повторите вход.',403)
   c.execute('UPDATE oauth_flows SET used=1 WHERE state=?',(state,))
  try:
   if query.get('error') or not query.get('code'):raise Fault('Вы отменили доступ у провайдера. Подключение не выполнено.')
   cfg=self.cfg(provider);p=PROVIDERS[provider]
   body=dict(grant_type='authorization_code',code=query['code'],client_id=cfg['client_id'],client_secret=cfg['client_secret'],redirect_uri=self.origin()+'/api/oauth/callback/'+provider)
   if p['pkce']:body['code_verifier']=row['verifier']
   tokens=request_json(p['token'],form=body);identity=self.userinfo(provider,tokens)
   with self.store.db(True) as c:
    u=self.store.get(c,'users',row['uid']) if row['uid'] else None
    if row['purpose']!='login' and (not u or u['status']!='active'):raise Fault('Кабинет недоступен',403)
    if row['purpose']=='mail':
     granted=set(tokens.get('scope','').split())
     required=set(PROVIDERS[provider]['mail'].split())-{'offline_access'}
     if not required<=granted:raise Fault('Не предоставлены права чтения и отправки почты. Повторите подключение.',403)
     if not identity['email']:raise Fault('Провайдер не сообщил адрес ящика')
     aid=provider+'-'+digest(identity['subject'])[:24]
     existing=c.execute('SELECT uid,secret FROM mail_accounts WHERE id=?',(aid,)).fetchone()
     if existing and existing['uid']!=u['id']:raise Fault('Ящик уже подключён в другом кабинете',409)
     old=json.loads(existing['secret']) if existing else {}
     if not tokens.get('refresh_token') and old.get('refresh_token'):tokens['refresh_token']=old['refresh_token']
     tokens['expires_at']=time.time()+int(tokens.get('expires_in',3600))
     c.execute('INSERT OR REPLACE INTO mail_accounts VALUES (?,?,?,?,?,?)',(aid,u['id'],provider,identity['email'],js(tokens),js({'connectedAt':now()})))
     result={'ok':True,'purpose':'mail'}
    else:
     link=c.execute('SELECT uid FROM oauth_links WHERE provider=? AND subject=?',(provider,identity['subject'])).fetchone()
     if row['purpose']=='link':
      if link and link['uid']!=u['id']:raise Fault('Этот аккаунт уже привязан к другому кабинету',409)
      previous=c.execute('SELECT subject FROM oauth_links WHERE provider=? AND uid=?',(provider,u['id'])).fetchone()
      if previous and previous['subject']!=identity['subject']:raise Fault('Сначала отключите прежний аккаунт этого провайдера в профиле',409)
     else:
      if link:u=self.store.get(c,'users',link['uid'])
      else:
       uid='oauth-'+secrets.token_hex(12)
       u={'id':uid,'name':identity['name'],'login':uid,'role':'employee','status':'active','workStatus':'available','org':'КазНИИОиР','dept':'','phone':'','email':identity['email'],'photo':'','position':'Сотрудник KazIOR','interests':[],'theme':'light','permissions':ROLES['employee'].copy(),'registeredAt':now(),'externalOnly':True}
       self.store.put(c,'users',u)
     if not u or u.get('status')!='active':raise Fault('Кабинет недоступен',403)
     c.execute('INSERT OR REPLACE INTO oauth_links VALUES (?,?,?,?)',(provider,identity['subject'],u['id'],identity['email']))
     result={'ok':True,'purpose':row['purpose'],'uid':u['id']}
    c.execute('UPDATE oauth_flows SET result=?,expires=? WHERE state=?',(js(result),time.time()+120,state))
  except Fault as e:
   with self.store.db(True) as c:c.execute('UPDATE oauth_flows SET result=?,expires=? WHERE state=?',(js({'error':str(e)}),time.time()+120,state))
 def finish(self,cookie,nonce):
  with self.store.db(True) as c:
   row=c.execute('SELECT * FROM oauth_flows WHERE cookie=? AND nonce=? AND expires>? AND used=1',(digest(cookie),digest(nonce),time.time())).fetchone()
   if not row or not row['result']:raise Fault('Нет завершённого входа. Нажмите кнопку провайдера заново.',403)
   c.execute('DELETE FROM oauth_flows WHERE state=?',(row['state'],));r=json.loads(row['result'])
   if r.get('purpose')=='login':
    u=self.store.get(c,'users',r['uid'])
    if not u or u.get('status')!='active':raise Fault('Кабинет недоступен',403)
    token=self.store.session(c,u)
  if r.get('purpose')=='login':return {'token':token,**self.store.snapshot(u),'purpose':'login'}
  return r
 def unlink(self,u,provider):
  self.cfg(provider)
  with self.store.db(True) as c:c.execute('DELETE FROM oauth_links WHERE uid=? AND provider=?',(u['id'],provider))
  return {'ok':True}
 def access_token(self,account):
  tokens=json.loads(account['secret']);provider=account['provider'];cfg=self.cfg(provider)
  if tokens.get('expires_at',0)>time.time()+90:return tokens['access_token']
  if not tokens.get('refresh_token'):raise Fault('Срок подключения истёк. Подключите почту повторно.',401)
  fresh=request_json(PROVIDERS[provider]['token'],form=dict(grant_type='refresh_token',refresh_token=tokens['refresh_token'],client_id=cfg.get('client_id',''),client_secret=cfg.get('client_secret','')))
  if not fresh.get('access_token'):raise Fault('Подключите почту повторно',401)
  tokens.update(fresh);tokens['expires_at']=time.time()+int(fresh.get('expires_in',3600))
  with self.store.db(True) as c:c.execute('UPDATE mail_accounts SET secret=? WHERE id=?',(js(tokens),account['id']))
  return tokens['access_token']
