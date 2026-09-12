"""Separate test document workflow; optional fail-closed NCALayer signature verification."""
import base64
import hashlib
import json
import re
import secrets
import time
from urllib.request import Request,build_opener
from urllib.parse import urlsplit
from receiver import NoRedirect
from crm_store import Fault,clean_text,digest,js,now

class Documents:
    def __init__(self,store,config):self.store,self.config=store,config.get('eds',{})
    def enabled(self):return bool(self.config.get('enabled') and self.config.get('verifier_url'))
    def can_view(self,u,d):return u['role']=='superadmin' or u['id'] in [d['ownerId'],*d.get('reviewers',[]),*d.get('signers',[])]
    def require_doc(self,c,u,did):
        d=self.store.get(c,'documents',did)
        if not d or not self.can_view(u,d):raise Fault('Документ недоступен',403)
        return d
    def list(self,u):
        with self.store.db() as c:
            docs=[d for d in self.store.all(c,'documents') if self.can_view(u,d)]
            people=[{k:v for k,v in x.items() if k in ('id','name','role','dept')} for x in self.store.all(c,'users') if x.get('status')=='active']
            binding=c.execute('SELECT iin FROM eds_bindings WHERE uid=?',(u['id'],)).fetchone()
        return {'documents':docs,'people':people,'user':{k:u[k] for k in ('id','name','role')},'eds':{'enabled':self.enabled(),'bound':bool(binding)},'testMode':True}
    def history(self,d,u,text):d.setdefault('history',[]).append({'date':now(),'actor':u['name'],'actorId':u['id'],'text':text})
    def notify(self,c,d,u,title):
        for uid in set([d['ownerId'],*d['reviewers'],*d['signers']])-{u['id']}:
            self.store.notice(c,uid,title,d['id']+' · '+d['title'],'doc:'+d['id'])
    def create(self,u,data,key):
        if not re.fullmatch(r'[A-Za-z0-9-]{16,100}',key or ''):raise Fault('Не задан идентификатор операции')
        with self.store.db(True) as c:
            old=c.execute('SELECT response FROM mutations WHERE uid=? AND key=?',(u['id'],key)).fetchone()
            if old:return json.loads(old[0])
            title=clean_text(data.get('title'),180);content=clean_text(data.get('content'),24000)
            if not title or not content:raise Fault('Укажите название и текст документа')
            reviewers=data.get('reviewers') or [u['id']];signers=data.get('signers') or [u['id']]
            if not isinstance(reviewers,list) or not isinstance(signers,list) or len(reviewers)+len(signers)>30:raise Fault('Проверьте участников')
            for uid in set(reviewers+signers):
                p=self.store.get(c,'users',uid)
                if not p or p.get('status')!='active':raise Fault('Участник недоступен')
            ticket_id=clean_text(data.get('ticketId'),30)
            if ticket_id:
                t=self.store.get(c,'tickets',ticket_id)
                if not t or not self.store.can_view(u,'tickets',t):raise Fault('Заявка недоступна',403)
            c.execute("UPDATE meta SET value=value+1 WHERE key='document_number'");num=c.execute("SELECT value FROM meta WHERE key='document_number'").fetchone()[0]
            d={'id':f'DOC-{num:06d}','title':title,'content':content,'type':data.get('type') if data.get('type') in ('Служебная записка','Заявка','Согласование') else 'Служебная записка','ownerId':u['id'],'ownerName':u['name'],'reviewers':list(dict.fromkeys(reviewers)),'signers':list(dict.fromkeys(signers)),'status':'draft','testMode':True,'created':now(),'updated':now(),'approvals':[],'signatures':[],'history':[],'ticketId':ticket_id,'files':self.store.validate_files(c,u,data.get('files',[]))}
            self.history(d,u,'Создан тестовый документ');d=self.store.put(c,'documents',d);self.store.log(c,u,'Создание тестового документа','documents',d['id'])
            result={'document':d};c.execute('INSERT INTO mutations VALUES (?,?,?)',(u['id'],key,js(result)))
        return result
    def act(self,u,data):
        action=data.get('action');key=data.get('key')
        if not re.fullmatch(r'[A-Za-z0-9-]{16,100}',key or ''):raise Fault('Не задан идентификатор операции')
        with self.store.db(True) as c:
            saved=c.execute('SELECT response FROM mutations WHERE uid=? AND key=?',(u['id'],key)).fetchone()
            if saved:return json.loads(saved[0])
            d=self.require_doc(c,u,data.get('id'))
            if d['_v']!=data.get('version'):raise Fault('Документ изменён. Обновите страницу.',409)
            owner=u['id']==d['ownerId'];reviewer=u['id'] in d['reviewers'];signer=u['id'] in d['signers'];status=d['status']
            note=clean_text(data.get('comment'),2000)
            if action=='edit':
                if not owner or status not in ('draft','rejected'):raise Fault('Редактирование доступно автору до согласования',403)
                title=clean_text(data.get('title'),180);content=clean_text(data.get('content'),24000)
                if not title or not content:raise Fault('Название и текст обязательны')
                d.update(title=title,content=content,status='draft',approvals=[],signatures=[]);self.history(d,u,'Текст обновлён; согласования сброшены')
            elif action=='submit':
                if not owner or status not in ('draft','rejected'):raise Fault('Нельзя отправить на согласование',403)
                d.update(status='review',approvals=[],signatures=[]);self.history(d,u,'Отправлен на согласование · тест');self.notify(c,d,u,'Документ на согласовании')
            elif action in ('approve','reject'):
                if not reviewer or status!='review':raise Fault('Согласовать может назначенный участник',403)
                if action=='reject':
                    if not note:raise Fault('Укажите причину возврата')
                    d.update(status='rejected',approvals=[],signatures=[]);self.history(d,u,'Возвращён: '+note)
                else:
                    if any(x['uid']==u['id'] for x in d['approvals']):raise Fault('Вы уже согласовали документ')
                    d['approvals'].append({'uid':u['id'],'name':u['name'],'date':now(),'comment':note,'test':True})
                    if set(d['reviewers']) <= {x['uid'] for x in d['approvals']}:d['status']='signing'
                    self.history(d,u,'Согласовано в тестовом режиме'+(': '+note if note else ''))
                self.notify(c,d,u,'Изменение согласования')
            elif action=='test-sign':
                if not signer or status!='signing':raise Fault('Подписать может назначенный участник после согласования',403)
                if any(x['uid']==u['id'] for x in d['signatures']):raise Fault('Вы уже выполнили подпись')
                d['signatures'].append({'uid':u['id'],'name':u['name'],'date':now(),'kind':'simulation','cryptographicallyVerified':False,'hash':self.document_hash(d),'label':'Тестовая отметка. Это не ЭЦП.'})
                if set(d['signers']) <= {x['uid'] for x in d['signatures']}:d['status']='signed'
                self.history(d,u,'Тестовая подпись — без ЭЦП');self.notify(c,d,u,'Тестовый документ подписан')
            elif action=='comment':
                if not note:raise Fault('Напишите комментарий')
                self.history(d,u,'Комментарий: '+note);self.notify(c,d,u,'Комментарий к документу')
            else:raise Fault('Неизвестное действие')
            d['updated']=now();d=self.store.put(c,'documents',d);self.store.log(c,u,'Документ: '+action,'documents',d['id'])
            result={'document':d};c.execute('INSERT INTO mutations VALUES (?,?,?)',(u['id'],key,js(result)))
        return result
    def document_bytes(self,d):
        return js({k:d[k] for k in ('id','title','content','type','ownerId','reviewers','signers','ticketId','files','testMode')}).encode()
    def document_hash(self,d):return hashlib.sha256(self.document_bytes(d)).hexdigest()
    def challenge(self,u,data,origin):
        purpose=data.get('purpose','login');uid=u['id'] if u else ''
        if purpose not in ('login','bind','document'):raise Fault('Неизвестное действие ЭЦП')
        if purpose!='login' and not u:raise Fault('Войдите в CRM',401)
        payload={'service':'KazIOR CRM','origin':origin,'purpose':purpose,'userId':uid,'nonce':secrets.token_urlsafe(32),'expires':int(time.time()+300)}
        with self.store.db(True) as c:
            if purpose=='document':
                d=self.require_doc(c,u,data.get('id'))
                if d['status']!='signing' or uid not in d['signers']:raise Fault('Документ не готов к вашей подписи',403)
                payload.update(documentId=d['id'],documentVersion=d['_v'],documentHash=self.document_hash(d),document=json.loads(self.document_bytes(d)))
            cid=secrets.token_urlsafe(32);raw=js(payload)
            c.execute('DELETE FROM eds_challenges WHERE expires<?',(time.time(),))
            c.execute('INSERT INTO eds_challenges VALUES (?,?,?,?,?,0)',(cid,uid,purpose,raw,time.time()+300))
        return {'id':cid,'payloadBase64':base64.b64encode(raw.encode()).decode(),'purpose':purpose,'expiresIn':300}
    def verify_cms(self,cms,payload,purpose):
        # A trusted Kalkan/NCA adapter must validate signature, exact payload, chain, validity,
        # revocation and certificate key usage. No client-supplied identity is trusted.
        if not self.enabled():raise Fault('Серверная проверка ЭЦП не подключена',503)
        url=self.config['verifier_url'];parts=urlsplit(url)
        if parts.username or parts.password or parts.fragment or (parts.scheme!='https' and not(parts.scheme=='http' and parts.hostname in ('127.0.0.1','localhost','::1'))):raise Fault('Некорректный адрес сервера проверки ЭЦП',503)
        if not isinstance(cms,str) or not 64<len(cms)<2*1024*1024:raise Fault('Некорректная подпись')
        try:base64.b64decode(cms,validate=True)
        except ValueError:raise Fault('Некорректный CMS')
        if self.config.get('provider')=='ncanode':
            from ncanode_verifier import verify
            return verify(self.config,cms,payload,purpose)
        body={'cms':cms,'data':base64.b64encode(payload.encode()).decode(),'purpose':purpose,'requireRevocationCheck':True}
        headers={'Content-Type':'application/json'}
        if self.config.get('verifier_token'):headers['Authorization']='Bearer '+self.config['verifier_token']
        try:
            with build_opener(NoRedirect()).open(Request(url,data=js(body).encode(),headers=headers),timeout=20) as res: info=json.loads(res.read(1024*1024))
        except Exception:raise Fault('Сервис проверки ЭЦП недоступен. Вход или подпись не выполнены.',503) from None
        checks=('verified','chainValid','validNow','revocationChecked','keyUsageValid')
        if any(info.get(k) is not True for k in checks) or info.get('revoked') is not False or info.get('payloadSha256')!=digest(payload):raise Fault('Подпись или сертификат не прошли проверку',403)
        if not re.fullmatch(r'\d{12}',str(info.get('iin',''))):raise Fault('В проверенном сертификате нет ИИН',403)
        return {'iin':info['iin'],'name':clean_text(info.get('name'),160),'certificateSerial':clean_text(info.get('certificateSerial'),160)}
    def complete(self,u,data,origin):
        cid=data.get('id')
        with self.store.db() as c:challenge=c.execute('SELECT * FROM eds_challenges WHERE id=?',(cid,)).fetchone()
        if not challenge or challenge['used'] or challenge['expires']<time.time():raise Fault('Запрос ЭЦП истёк или уже использован',403)
        expected=json.loads(challenge['payload'])
        if expected['origin']!=origin:raise Fault('Источник запроса не совпадает',403)
        if challenge['purpose']!='login' and (not u or challenge['uid']!=u['id']):raise Fault('Нельзя подписать чужой запрос',403)
        verified=self.verify_cms(data.get('cms'),challenge['payload'],challenge['purpose'])
        with self.store.db(True) as c:
            if not c.execute('UPDATE eds_challenges SET used=1 WHERE id=? AND used=0 AND expires>?',(cid,time.time())).rowcount:raise Fault('Запрос уже использован',409)
            binding=c.execute('SELECT uid FROM eds_bindings WHERE iin=?',(verified['iin'],)).fetchone()
            if challenge['purpose']=='login':
                target=self.store.get(c,'users',binding['uid']) if binding else None
                if not binding:
                    from crm_store import ROLES
                    uid='eds-'+secrets.token_hex(12)
                    target={'id':uid,'name':verified['name'] or 'Сотрудник KazIOR','login':uid,'role':'employee','status':'active','workStatus':'available','org':'КазНИИОиР','dept':'','phone':'','email':'','photo':'','position':'Сотрудник KazIOR','interests':[],'theme':'light','permissions':ROLES['employee'].copy(),'registeredAt':now(),'externalOnly':True}
                    self.store.put(c,'users',target);c.execute('INSERT INTO eds_bindings VALUES (?,?)',(verified['iin'],uid))
                if not target or target.get('status')!='active':raise Fault('Кабинет недоступен',403)
                token=self.store.session(c,target)
            elif challenge['purpose']=='bind':
                if binding and binding['uid']!=u['id']:raise Fault('Эта ЭЦП уже привязана к другому кабинету',409)
                c.execute('DELETE FROM eds_bindings WHERE uid=?',(u['id'],));c.execute('INSERT OR REPLACE INTO eds_bindings VALUES (?,?)',(verified['iin'],u['id']))
                self.store.log(c,u,'Привязка проверенной ЭЦП','users',u['id']);return {'ok':True}
            else:
                if not binding or binding['uid']!=u['id']:raise Fault('Сначала привяжите эту ЭЦП к своему профилю.',403)
                d=self.require_doc(c,u,expected['documentId'])
                if d['_v']!=expected['documentVersion'] or self.document_hash(d)!=expected['documentHash'] or d['status']!='signing':raise Fault('Документ изменён. Подпишите актуальную версию.',409)
                if u['id'] not in d['signers'] or any(x['uid']==u['id'] for x in d['signatures']):raise Fault('Подпись недоступна',403)
                d['signatures'].append({'uid':u['id'],'name':verified['name'] or u['name'],'date':now(),'kind':'cms','cryptographicallyVerified':True,'cms':data['cms'],'payload':challenge['payload'],'hash':expected['documentHash'],'certificateSerial':verified['certificateSerial'],'label':'CMS проверен сервером; документ тестовый'})
                if set(d['signers']) <= {x['uid'] for x in d['signatures']}:d['status']='signed'
                self.history(d,u,'CMS-подпись тестового документа проверена');d=self.store.put(c,'documents',d);self.notify(c,d,u,'Подпись документа');return {'document':d}
        return {'token':token,**self.store.snapshot(target)}
