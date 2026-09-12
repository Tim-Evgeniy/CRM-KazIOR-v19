"""Six independent GREEN-API receivers. No browser/provider token sharing."""
import copy
import json
import re
import threading
import time
from urllib.parse import urlsplit
from urllib.request import Request
from crm_store import Fault, clean_text, digest, is_staff, js, now, phone, ROLES
from receiver import GreenAPI, normalize

NEW_REQUEST=re.compile(r'^\s*(?:#?заявка|#?өтінім|#?ticket)(?:\s*[:\-]\s*|\s+|$)',re.I)
TICKET_REF=re.compile(r'(?<![\w-])(KZ-\d{6,12})(?![\w-])',re.I)

class WhatsApp:
    def __init__(self,store,config,stop=None):
        self.store,self.config=store,config
        self.parent_stop=stop or threading.Event()
        self.stop=threading.Event()
        self.channels={str(c['id']):c for c in config.get('channels',[]) if c.get('enabled')}
        self.states={}
        self.apis={}
        self.threads=[]
        ids=set()
        for key,c in self.channels.items():
            if str(c.get('id_instance')) in ids: raise ValueError('Один idInstance нельзя использовать для двух инженеров')
            ids.add(str(c.get('id_instance')))
            self.apis[key]=GreenAPI(c)
            self.states[key]={'ok':False,'message':'Подключение…'}

    def status(self):
        with self.store.db() as c:
            counts={r['state']:r['n'] for r in c.execute('SELECT state,count(*) n FROM outbox GROUP BY state')}
            rows=[dict(r) for r in c.execute('SELECT id,channel,chat,state,attempts,error,ticket_id,created FROM outbox ORDER BY rowid DESC LIMIT 50')]
            stats={r['outcome']:r['n'] for r in c.execute('SELECT outcome,count(*) n FROM wa_events GROUP BY outcome')}
        return {'channels':[{'id':x['id'],'engineerId':x['engineer_id'],'phone':x['phone'],'enabled':bool(x.get('enabled')),'routing':x.get('routing','engineer'),'defaultEngineerId':x.get('default_engineer_id',''),'idInstance':x.get('id_instance',''),'hasToken':bool(x.get('api_token')),'apiUrl':x.get('api_url',''),'incomingMode':x.get('incoming_mode','commands'),**self.states.get(x['id'],{'ok':False,'message':'Не подключён'})} for x in self.config.get('channels',[])], 'outbox':counts,'recent':rows,'events':stats,'notifications':self.config.get('whatsapp_notifications',{})}

    def event(self,channel,payload):
        cconfig=self.channels[channel]
        b=payload.get('body',payload)
        if not isinstance(b,dict): raise ValueError('Invalid body')
        kind=b.get('typeWebhook','')
        inst=(b.get('instanceData') or {}).get('idInstance')
        if inst is not None and str(inst)!=str(cconfig['id_instance']): raise ValueError('Wrong instance')
        if kind=='outgoingMessageStatus':
            state=b.get('status');mid=b.get('idMessage')
            mapping={'sent':'sent','delivered':'delivered','read':'read','failed':'failed','noAccount':'failed','notInGroup':'failed'}
            if state in mapping:
                with self.store.db(True) as c:
                    ranks={'submitted':0,'sent':1,'delivered':2,'read':3,'failed':4}
                    rows=c.execute('SELECT id,state FROM outbox WHERE channel=? AND provider_id=?',(channel,mid)).fetchall()
                    for row in rows:
                        if ranks.get(mapping[state],0)>=ranks.get(row['state'],0): c.execute('UPDATE outbox SET state=? WHERE id=?',(mapping[state],row['id']))
            return None
        outgoing=kind=='outgoingMessageReceived'
        if kind not in ('incomingMessageReceived','outgoingMessageReceived'): return None
        normalized=copy.deepcopy(b)
        if outgoing:
            normalized['typeWebhook']='incomingMessageReceived'
            sender=normalized.get('senderData') or {}
            if not sender.get('chatId'): sender['chatId']=b.get('chatId','')
            normalized['senderData']=sender
        item=normalize(normalized)
        if not item: return None
        key=js([channel,kind,item['chatId'],item['idMessage']])
        chat=item['chatId'];body=item['text'];md=b.get('messageData') or {}
        if not re.fullmatch(r'\d+@(?:c\.us|s\.whatsapp\.net|lid)',chat): return None
        with self.store.db(True) as c:
            previous=c.execute('SELECT ticket_id FROM wa_events WHERE key=?',(key,)).fetchone()
            if previous: return previous[0]
            # Keep only event ids for private conversations, never their text or media.
            outcome='ignored_personal';tid=None
            account=self.store.get(c,'users',cconfig['engineer_id'])
            if not account or not is_staff(account): raise ValueError('Engineer not found')
            related=None
            ref=TICKET_REF.search(body)
            if ref: related=self.store.get(c,'tickets',ref.group(1).upper())
            quoted=md.get('quotedMessage') or {}
            qid=quoted.get('stanzaId') or quoted.get('idMessage')
            if qid and not ref:
                mapped=c.execute('SELECT ticket_id FROM wa_messages WHERE channel=? AND message_id=? AND chat=?',(channel,qid,chat)).fetchone()
                if mapped: related=self.store.get(c,'tickets',mapped[0])
            # Only the same sender on the same channel may append to this ticket.
            if related and (related.get('wa') or {}).get('chat')!=chat: related=None
            if related and (related.get('wa') or {}).get('channel')!=channel: related=None
            # A plain response is unambiguous only with one open request in this exact chat.
            if cconfig.get('incoming_mode')=='all' and not related and not ref and not NEW_REQUEST.match(body) and not outgoing:
                active=[t for t in self.store.all(c,'tickets') if t.get('wa',{}).get('chat')==chat and t.get('wa',{}).get('channel')==channel and t.get('status') not in ('done','closed')]
                if len(active)==1:related=active[0]
            link=re.fullmatch(r'\s*(?:CRM|КРМ)\s+([A-F0-9]{12})\s*',body,re.I)
            owned=c.execute('SELECT uid FROM wa_links WHERE channel=? AND chat=?',(channel,chat)).fetchone()
            known_engineer=any(phone(u.get('phone'))==item['phone'] for u in self.store.all(c,'users') if is_staff(u) and item['phone'])
            service_message=body.startswith('CRM КазНИИОиР')
            new=NEW_REQUEST.match(body)
            if not new and not related and cconfig.get('incoming_mode')=='all' and not ref and not link:
                new=re.match(r'^',body)
            if not outgoing and link and not known_engineer:
                code=c.execute('SELECT uid FROM wa_codes WHERE code=? AND expires>?',(link.group(1).upper(),time.time())).fetchone()
                if code:
                    c.execute('INSERT OR REPLACE INTO wa_links VALUES (?,?,?)',(channel,chat,code['uid']))
                    c.execute('DELETE FROM wa_codes WHERE code=?',(link.group(1).upper(),))
                    # Link previously created tickets only from this exact verified chat.
                    for old in self.store.all(c,'tickets'):
                        if old.get('wa',{}).get('channel')==channel and old.get('wa',{}).get('chat')==chat and str(old.get('ownerId','')).startswith('wa-'):
                            old['ownerId']=code['uid'];old['ownerName']=self.store.get(c,'users',code['uid'])['name'];self.store.put(c,'tickets',old)
                    u=self.store.get(c,'users',code['uid'])
                    if item['phone']:u['phone']=item['phone'];self.store.put(c,'users',u)
                    self.store.notice(c,code['uid'],'WhatsApp привязан','Ответы по вашим заявкам доступны в CRM')
                    self.store.enqueue(c,channel,chat,'CRM КазНИИОиР · WhatsApp привязан. Для новой заявки напишите: Заявка: что не работает.','',key)
                    outcome='linked'
            elif related and not service_message and (outgoing or not known_engineer):
                if outgoing and related.get('engineerId')!=account['id'] and account.get('role')!='superadmin':
                    outcome='ignored_other_engineer'
                else:
                    author=account if outgoing else self.store.get(c,'users',related['ownerId'])
                    author=author or {'id':related['ownerId'],'name':item['name']}
                    m={'id':'wa-'+digest(key)[:24],'authorId':author['id'],'author':author['name'],'text':body,'date':now(),'files':item['files'],'readBy':[],'source':'WhatsApp','waMessageId':item['idMessage']}
                    related.setdefault('messages',[]).append(m)
                    related.setdefault('history',[]).append({'actor':author['name'],'actorId':author['id'],'date':now(),'text':'Ответ через WhatsApp'})
                    related=self.store.put(c,'tickets',related)
                    tid=related['id'];outcome='reply'
                    self.store.log(c,author,'Ответ WhatsApp','tickets',tid)
                    if outgoing:
                        self.store.notice(c,related['ownerId'],tid,author['name']+': '+body,tid)
                    else:
                        self.store.team_event(c,related,author['id'],tid,author['name']+': '+body[:180])
            elif not outgoing and new and not ref and not service_message and not known_engineer:
                content=body[new.end():].strip()
                target=account
                if cconfig.get('routing')=='common':
                    chosen=self.store.get(c,'users',cconfig.get('default_engineer_id') or account['id'])
                    if chosen and chosen.get('status')=='active' and is_staff(chosen):target=chosen
                    route=re.match(r'^@([A-Za-z0-9_-]+)\s+(.+)$',content,re.S)
                    if route:
                        chosen=next((u for u in self.store.all(c,'users') if u.get('login','').lower()==route[1].lower() and u.get('status')=='active' and is_staff(u)),None)
                        if not chosen:
                            self.store.enqueue(c,channel,chat,'CRM КазНИИОиР · Инженер не найден. Укажите его логин из справочника или отправьте «Заявка: описание».','',key)
                            c.execute('INSERT INTO wa_events VALUES (?,?,?,?)',(key,'','unknown_engineer',now()))
                            return None
                        target=chosen;content=route[2].strip()
                if content or item['files']:
                    uid=owned['uid'] if owned else 'wa-'+digest(channel+chat)[:24]
                    author=self.store.get(c,'users',uid)
                    if not author:
                        author={'id':uid,'name':item['name'],'login':uid,'role':'employee','status':'active','workStatus':'available','org':'КазНИИОиР','position':'Заявитель WhatsApp','dept':'','phone':item['phone'],'email':'','photo':'','interests':[],'theme':'light','registeredAt':now(),'permissions':ROLES['employee'].copy(),'externalOnly':True}
                        self.store.put(c,'users',author)
                    ticket=self.store.new_ticket(c,author,{'subject':content[:180] or 'Вложение WhatsApp','description':content,'phone':item['phone'],'files':item['files']},source='WhatsApp',owner=uid,engineer=target['id'],wa={'channel':channel,'chat':chat,'key':key,'engineerId':target['id']})
                    tid=ticket['id'];outcome='ticket'
                    self.store.enqueue(c,channel,chat,f"CRM КазНИИОиР · заявка {tid} зарегистрирована.\nИнженер: {target['name']}\nДля ответа пишите: {tid} ваш текст.\nДля другой проблемы: Заявка: описание.",tid,key)
            if tid:
                c.execute('INSERT OR IGNORE INTO wa_messages VALUES (?,?,?,?)',(channel,item['idMessage'],tid,chat))
            c.execute('INSERT INTO wa_events VALUES (?,?,?,?)',(key,tid,outcome,now()))
            return tid

    def consume_once(self,channel,api):
        notification=api.request('receiveNotification',suffix='?receiveTimeout=5')
        if not notification: return
        receipt=notification.get('receiptId')
        if not isinstance(receipt,int) or isinstance(receipt,bool) or receipt<=0: raise ValueError('Invalid receipt')
        tid=self.event(channel,notification)  # ticket + audit + outbox are committed atomically.
        result=api.request('deleteNotification','DELETE',suffix='/'+str(receipt))
        if not isinstance(result,dict) or not result.get('result'): raise RuntimeError('Не удалось подтвердить обработку; повтор будет без дубля')
        if tid: self.archive_media(channel,tid)

    def archive_media(self,channel,tid):
        # Archive accepted work attachments only. Bounded download, HTTPS provider hosts, no redirects.
        with self.store.db() as c: t=self.store.get(c,'tickets',tid)
        if not t: return
        files=t.get('files',[])+[f for m in t.get('messages',[]) for f in m.get('files',[])]
        replacements={}
        for f in files:
            url=f.get('url','') if isinstance(f,dict) else ''
            if not url: continue
            u=urlsplit(url)
            if u.scheme!='https' or not re.fullmatch(r'(?:[a-z0-9-]+\.)*(?:green-api\.com|greenapi\.com)',u.hostname or '') or u.port not in (None,443): continue
            try:
                with self.apis[channel].opener.open(Request(url),timeout=15) as response:
                    content=response.read(10*1024*1024+1)
                if not content or len(content)>10*1024*1024: continue
                meta=self.store.upload({'id':t['ownerId']},f.get('name','WhatsApp'),f.get('type','application/octet-stream'),content)
                replacements[url]=meta
            except Exception:
                continue  # Original URL remains visible; never claim an unarchived file is local.
        if replacements:
            with self.store.db(True) as c:
                t=self.store.get(c,'tickets',tid)
                for holder in [t]+t.get('messages',[]): holder['files']=[replacements.get(f.get('url'),f) if isinstance(f,dict) else f for f in holder.get('files',[])]
                self.store.put(c,'tickets',t)

    def receive_loop(self,key,api):
        ready=False
        while not self.stop.is_set() and not self.parent_stop.is_set():
            try:
                if not ready:
                    if (api.request('getStateInstance') or {}).get('stateInstance')!='authorized': raise RuntimeError('Свяжите номер по QR-коду в GREEN-API')
                    s=api.request('getSettings') or {}
                    if s.get('webhookUrl'): raise RuntimeError('Очистите webhookUrl: используется очередь HTTP API')
                    wid=s.get('wid','').split('@')[0]
                    if not wid or phone(wid)!=phone(self.channels[key]['phone']): raise RuntimeError('Подключён другой номер: проверьте номер инстанса')
                    flags={'incomingWebhook':'yes','outgoingWebhook':'yes','outgoingMessageWebhook':'yes','outgoingAPIMessageWebhook':'yes'}
                    if any(s.get(k)!=v for k,v in flags.items()):
                        if not (api.request('setSettings','POST',flags) or {}).get('saveSettings'): raise RuntimeError('Не удалось включить уведомления GREEN-API')
                    ready=True
                self.consume_once(key,api)
                self.states[key]={'ok':True,'message':'Приём включён','checkedAt':int(time.time())}
                self.stop.wait(.15)
            except Exception as e:
                message=str(e) if isinstance(e,RuntimeError) else 'Ошибка приёма; проверьте настройки и свободное место'
                self.states[key]={'ok':False,'message':message,'checkedAt':int(time.time())}
                ready=False;self.stop.wait(10)

    def send_once(self):
        with self.store.db(True) as c:
            rows=c.execute("SELECT * FROM outbox WHERE state='pending' AND next_try<=? ORDER BY rowid LIMIT 100",(time.time(),)).fetchall()
            selected=None
            for row in rows:
                key=row['channel']
                if key=='dispatch':
                    key=next((k for k,v in self.channels.items() if self.states.get(k,{}).get('ok') and phone(v['phone'])[1:]!=row['chat'].split('@')[0]),None)
                    if not key:key=next((k for k in self.channels if self.states.get(k,{}).get('ok')),None)
                if not key or key not in self.apis or not self.states.get(key,{}).get('ok'): continue
                selected=dict(row);selected['channel']=key
                c.execute("UPDATE outbox SET state='sending',channel=?,attempts=attempts+1 WHERE id=?",(key,row['id']))
                break
        if not selected: return False
        try:
            result=self.apis[selected['channel']].request('sendMessage','POST',{'chatId':selected['chat'],'message':selected['message']}) or {}
            mid=result.get('idMessage')
            if not mid: raise ValueError('Missing message id')
            with self.store.db(True) as c:
                c.execute("UPDATE outbox SET state='submitted',provider_id=?,error=NULL WHERE id=?",(mid,selected['id']))
                if selected['ticket_id']: c.execute('INSERT OR IGNORE INTO wa_messages VALUES (?,?,?,?)',(selected['channel'],mid,selected['ticket_id'],selected['chat']))
        except Exception as e:
            # SendMessage has no idempotency key. Timeout may mean sent: require review.
            msg=str(e) if isinstance(e,RuntimeError) else 'Ответ сервиса не подтверждён'
            is_rejection=bool(re.search(r'HTTP (400|401|403|429)\b',msg))
            state='pending' if is_rejection else 'uncertain'
            with self.store.db(True) as c:
                c.execute('UPDATE outbox SET state=?,next_try=?,error=? WHERE id=?',(state,time.time()+min(3600,30*2**min(selected['attempts'],7)),msg,selected['id']))
        return True

    def send_loop(self):
        while not self.stop.is_set() and not self.parent_stop.is_set():
            try: self.send_once()
            except Exception: pass  # Database remains the queue of record.
            self.stop.wait(1)

    def start(self):
        for key,api in self.apis.items():
            t=threading.Thread(target=self.receive_loop,args=(key,api),daemon=True);t.start();self.threads.append(t)
        if self.apis:
            t=threading.Thread(target=self.send_loop,daemon=True);t.start();self.threads.append(t)
