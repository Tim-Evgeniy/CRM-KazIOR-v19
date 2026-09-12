"""Telegram Bot API: durable long polling, verified contact binding and ticket replies."""
import json
import os
import re
import secrets
import threading
import time
from urllib.request import Request, build_opener
from urllib.error import HTTPError, URLError
from receiver import NoRedirect
from crm_store import Fault, clean_text, digest, is_staff, js, now, phone, ROLES
from wa_service import NEW_REQUEST, TICKET_REF

class Telegram:
    def __init__(self,store,config,stop=None):
        self.store,self.config=store,config.get('telegram',{})
        self.stop=stop or threading.Event()
        self.token=os.environ.get('KAZIOR_TELEGRAM_TOKEN') or self.config.get('bot_token','')
        self.enabled=bool(self.config.get('enabled') and self.token)
        self.state={'ok':False,'message':'Не подключён: укажите токен бота Telegram','username':''}
        self.opener=build_opener(NoRedirect())

    def request(self,method,data=None):
        if not re.fullmatch(r'\d+:[A-Za-z0-9_-]{20,}',self.token): raise Fault('Нужен отдельный токен бота от @BotFather. Токен WhatsApp сюда не подходит.')
        req=Request('https://api.telegram.org/bot'+self.token+'/'+method,data=js(data or {}).encode(),headers={'Content-Type':'application/json'})
        try:
            with self.opener.open(req,timeout=20) as res: result=json.loads(res.read(4*1024*1024))
        except HTTPError as e: raise RuntimeError('Telegram HTTP '+str(e.code)) from None
        except (URLError,OSError,TimeoutError): raise RuntimeError('Telegram недоступен по сети') from None
        if result.get('ok') is not True: raise RuntimeError('Telegram отклонил запрос')
        return result['result']

    def status(self):
        with self.store.db() as c:
            recent=[dict(r) for r in c.execute('SELECT id,chat,state,error,ticket_id,created FROM tg_outbox ORDER BY rowid DESC LIMIT 30')]
            linked=c.execute('SELECT count(*) FROM tg_links').fetchone()[0]
        return dict(self.state,enabled=self.enabled,linked=linked,recent=recent)

    def link_code(self,u):
        if not self.enabled or not self.state.get('username'): raise Fault('Администратор должен подключить Telegram в разделе «Интеграции».')
        code=secrets.token_hex(12)
        with self.store.db(True) as c:
            c.execute('DELETE FROM tg_codes WHERE uid=? OR expires<?',(u['id'],time.time()))
            c.execute('INSERT INTO tg_codes VALUES (?,?,?)',(code,u['id'],time.time()+600))
        return {'url':'https://t.me/'+self.state['username']+'?start='+code,'expiresIn':600}

    def event(self,update):
        update_id=update.get('update_id')
        if not isinstance(update_id,int): raise ValueError('Invalid update')
        msg=update.get('message') or {};chat=str((msg.get('chat') or {}).get('id',''))
        with self.store.db(True) as c:
            if c.execute('SELECT 1 FROM tg_events WHERE id=?',(update_id,)).fetchone(): return
            outcome='ignored'
            if (msg.get('chat') or {}).get('type')=='private' and str(msg.get('from',{}).get('id'))==chat and not msg.get('from',{}).get('is_bot'):
                outcome=self.handle(c,chat,msg,str(update_id))
            c.execute('INSERT INTO tg_events VALUES (?,?)',(update_id,outcome))
            c.execute("UPDATE meta SET value=max(value,?) WHERE key='telegram_offset'",(update_id+1,))

    def handle(self,c,chat,msg,event):
        text=clean_text(msg.get('text'),12000)
        def say(body,markup=None,tid=''):
            self.store.telegram_enqueue(c,chat,body,event+'-'+digest(body),tid,markup)
        pending=c.execute('SELECT data FROM tg_pending WHERE chat=?',(chat,)).fetchone()
        pending=json.loads(pending[0]) if pending else {}
        def remember(): c.execute('INSERT OR REPLACE INTO tg_pending VALUES (?,?)',(chat,js(pending)))
        linked=c.execute('SELECT uid FROM tg_links WHERE chat=?',(chat,)).fetchone()
        u=self.store.get(c,'users',linked['uid']) if linked else None
        if u and u.get('status')!='active': say('Учётная запись отключена. Обратитесь к администратору.');return 'blocked'
        start=re.fullmatch(r'/start\s+([a-f0-9]{24})',text)
        if start:
            code=c.execute('SELECT uid FROM tg_codes WHERE code=? AND expires>?',(start[1],time.time())).fetchone()
            if not code: say('Код истёк. Получите новый в CRM → Мой профиль.');return 'expired_code'
            pending={'bind':start[1]};remember()
            say('Подтвердите свой номер кнопкой ниже.',{'keyboard':[[{'text':'Поделиться моим телефоном','request_contact':True}]],'resize_keyboard':True,'one_time_keyboard':True});return 'await_contact'
        contact=msg.get('contact') or {}
        if contact:
            number=phone(contact.get('phone_number'))
            if str(contact.get('user_id'))!=chat or not number:
                say('Нажмите «Поделиться моим телефоном». Чужой контакт не подходит.');return 'wrong_contact'
            if pending.get('bind'):
                code=c.execute('SELECT uid FROM tg_codes WHERE code=? AND expires>?',(pending['bind'],time.time())).fetchone()
                target=self.store.get(c,'users',code['uid']) if code else None
                if not target or target.get('status')!='active':say('Код истёк. Получите новый в CRM.');return 'expired_code'
                if is_staff(target) and phone(target.get('phone'))!=number:
                    say('Номер не совпадает с номером инженера в CRM. Проверьте учётную запись.');return 'wrong_engineer_phone'
                clash=c.execute('SELECT uid FROM tg_links WHERE chat=?',(chat,)).fetchone()
                if clash and clash['uid']!=target['id'] and not str(clash['uid']).startswith('tg-'):
                    say('Этот Telegram уже связан с другой учётной записью. Сначала отключите его в профиле CRM.');return 'already_linked'
                old_uid=clash['uid'] if clash else None
                c.execute('DELETE FROM tg_links WHERE uid=? OR chat=?',(target['id'],chat))
                c.execute('INSERT INTO tg_links VALUES (?,?,?)',(chat,target['id'],number))
                c.execute('DELETE FROM tg_codes WHERE code=?',(pending['bind'],))
                if old_uid and old_uid!=target['id']:
                    for t in self.store.all(c,'tickets'):
                        if t.get('ownerId')==old_uid and t.get('telegram',{}).get('chat')==chat:
                            t.update(ownerId=target['id'],ownerName=target['name']);self.store.put(c,'tickets',t)
                target['phone']=number;self.store.put(c,'users',target)
                c.execute('DELETE FROM tg_pending WHERE chat=?',(chat,))
                say('Подключено: '+target['name']+'\nНовая заявка: /new описание\nОтвет: KZ-000001 ваш текст\nСписок заявок: /tickets',{'remove_keyboard':True});return 'linked'
            if u:
                if is_staff(u) and phone(u.get('phone'))!=number:say('Номер инженера может исправить администратор.');return 'wrong_phone'
                u['phone']=number;self.store.put(c,'users',u);c.execute('UPDATE tg_links SET phone=? WHERE chat=?',(number,chat));say('Телефон обновлён.');return 'phone_updated'
            pending={'phone':number};remember();say('Теперь напишите своё ФИО: /name Иванова Анна Сергеевна',{'remove_keyboard':True});return 'await_name'
        if not u and text.startswith('/name ') and pending.get('phone'):
            name=clean_text(text[6:],160)
            if not name:say('Укажите ФИО после /name');return 'await_name'
            uid='tg-'+digest(chat)[:24]
            u={'id':uid,'name':name,'login':uid,'role':'employee','status':'active','workStatus':'available','phone':pending['phone'],'dept':'','org':'КазНИИОиР','position':'Сотрудник / врач','photo':'','email':'','theme':'light','interests':[],'permissions':ROLES['employee'].copy(),'externalOnly':True,'registeredAt':now()}
            self.store.put(c,'users',u);c.execute('INSERT INTO tg_links VALUES (?,?,?)',(chat,uid,pending['phone']));c.execute('DELETE FROM tg_pending WHERE chat=?',(chat,))
            say('Здравствуйте, '+name+'!\nНапишите /new что случилось и номер кабинета.\nЧтобы видеть заявки на компьютере: CRM → Мой профиль → Подключить Telegram.');return 'registered'
        if not u:
            say('Для заявки нужны ваши ФИО и телефон. Нажмите кнопку ниже или откройте CRM → Мой профиль → Подключить Telegram.',{'keyboard':[[{'text':'Поделиться моим телефоном','request_contact':True}]],'resize_keyboard':True,'one_time_keyboard':True});return 'registration_help'
        if text=='/tickets':
            items=[t for t in self.store.all(c,'tickets') if self.store.can_view(u,'tickets',t)][:20]
            say('\n'.join(t['id']+' · '+t['subject']+' · '+t['status'] for t in items) or 'У вас пока нет заявок. Напишите /new описание.');return 'list'
        if text.startswith('/engineer'):
            login=text.partition(' ')[2].strip().casefold();engineers=[x for x in self.store.all(c,'users') if is_staff(x) and x.get('status')=='active']
            engineer=next((x for x in engineers if x['login']==login),None)
            if engineer:pending={'engineerId':engineer['id']};remember();say('Следующая заявка → '+engineer['name']+'\nТеперь напишите /new описание')
            else:say('Выберите инженера командой /engineer логин:\n'+'\n'.join(x['login']+' — '+x['name'] for x in engineers))
            return 'engineer'
        ref=TICKET_REF.search(text)
        if not ref:
            reply=msg.get('reply_to_message') or {}
            mapping=c.execute('SELECT ticket_id FROM tg_messages WHERE chat=? AND message_id=?',(chat,str(reply.get('message_id','')))).fetchone()
            tid=mapping[0] if mapping else None
        else: tid=ref[1].upper()
        if tid:
            t=self.store.get(c,'tickets',tid)
            if not t or not self.store.can_view(u,'tickets',t):say('Эта заявка недоступна. Проверьте номер.');return 'forbidden'
            body=TICKET_REF.sub('',text).removeprefix('/reply').strip(' :\n')
            if not body:say('Добавьте текст ответа после номера заявки.');return 'empty'
            m={'id':'tg-'+event,'authorId':u['id'],'author':u['name'],'text':body,'date':now(),'files':[],'readBy':[u['id']],'source':'Telegram'}
            t.setdefault('messages',[]).append(m);t.setdefault('history',[]).append({'date':now(),'actor':u['name'],'actorId':u['id'],'text':'Ответ через Telegram'})
            self.store.put(c,'tickets',t);self.store.log(c,u,'Ответ Telegram','tickets',tid)
            if t['ownerId']!=u['id']: self.store.notice(c,t['ownerId'],tid,u['name']+': '+body,tid)
            self.store.team_event(c,t,u['id'],tid,u['name']+': '+body)
            if is_staff(u) and t.get('wa'):
                wa=t['wa'];self.store.enqueue(c,wa['channel'],wa['chat'],f"CRM КазНИИОиР · {tid}\n{u['name']}: {body}",tid,event)
            say('Ответ сохранён в '+tid,tid=tid);return 'reply'
        new=NEW_REQUEST.match(text)
        content=text[5:].strip() if text.startswith('/new ') else text[new.end():].strip() if new else ''
        if content:
            t=self.store.new_ticket(c,u,{'subject':content[:180],'description':content,'phone':u['phone']},source='Telegram',engineer=pending.get('engineerId',''))
            t['telegram']={'chat':chat};self.store.put(c,'tickets',t)
            c.execute('DELETE FROM tg_pending WHERE chat=?',(chat,))
            say('Заявка '+t['id']+' создана.\nЗаявитель: '+u['name']+'\nТелефон: '+u['phone']+'\nИнженер: '+t['engineerName']+'\nОтвет: '+t['id']+' ваш текст',tid=t['id']);return 'ticket'
        say('Новая заявка: /new описание\nВыбор инженера: /engineer\nМои заявки: /tickets\nОтвет: KZ-000001 ваш текст\nВложения можно добавить в CRM.');return 'help'

    def receive_loop(self):
        while not self.stop.is_set():
            try:
                me=self.request('getMe');webhook=self.request('getWebhookInfo')
                if webhook.get('url'): raise RuntimeError('У бота уже настроен webhook. Используйте отдельного бота или отключите прежний webhook.')
                with self.store.db(True) as c:
                    previous=c.execute("SELECT value FROM meta WHERE key='telegram_bot'").fetchone()
                    if previous and previous[0]!=int(me['id']):raise RuntimeError('В базе привязан другой Telegram-бот. Смена бота требует отдельной настройки базы администратором.')
                    c.execute("INSERT OR IGNORE INTO meta VALUES ('telegram_bot',?)",(int(me['id']),))
                self.state.update(username=me['username'])
                while not self.stop.is_set():
                    with self.store.db() as c: offset=c.execute("SELECT value FROM meta WHERE key='telegram_offset'").fetchone()[0]
                    updates=self.request('getUpdates',{'offset':offset,'timeout':10,'allowed_updates':['message']})
                    for item in updates: self.event(item)
                    self.state.update(ok=True,message='Подключён · @'+me['username'])
            except Exception as e:
                # Transport errors are sanitized; provider URLs and bot tokens never reach CRM.
                self.state.update(ok=False,message=str(e) if isinstance(e,(RuntimeError,Fault)) else 'Ошибка обработки Telegram; повторяем')
                self.stop.wait(10)

    def send_once(self):
        with self.store.db(True) as c:
            row=c.execute("SELECT * FROM tg_outbox WHERE state='pending' AND next_try<=? ORDER BY rowid LIMIT 1",(time.time(),)).fetchone()
            if not row:return False
            c.execute("UPDATE tg_outbox SET state='sending',attempts=attempts+1 WHERE id=?",(row['id'],))
        try:
            body={'chat_id':row['chat'],'text':row['text']}
            if row['markup']!='{}':body['reply_markup']=json.loads(row['markup'])
            res=self.request('sendMessage',body)
            if not res.get('message_id'):raise RuntimeError('Нет подтверждения отправки Telegram')
            with self.store.db(True) as c:
                c.execute("UPDATE tg_outbox SET state='submitted',provider_id=?,error='' WHERE id=?",(str(res['message_id']),row['id']))
                if row['ticket_id'].startswith('KZ-'):c.execute('INSERT OR REPLACE INTO tg_messages VALUES (?,?,?)',(row['chat'],str(res['message_id']),row['ticket_id']))
        except Exception as e:
            error=str(e) if isinstance(e,(RuntimeError,Fault)) else 'Не удалось отправить Telegram'
            state='failed' if 'HTTP 4' in error else 'uncertain'
            with self.store.db(True) as c:c.execute('UPDATE tg_outbox SET state=?,error=? WHERE id=?',(state,error,row['id']))
        return True

    def send_loop(self):
        while not self.stop.is_set():
            try:
                if not self.state.get('ok') or not self.send_once():self.stop.wait(.5)
            except Exception:self.stop.wait(2)

    def start(self):
        if self.enabled:
            threading.Thread(target=self.receive_loop,daemon=True).start()
            threading.Thread(target=self.send_loop,daemon=True).start()
