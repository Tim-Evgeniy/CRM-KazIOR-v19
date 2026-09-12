(() => {
 'use strict';
 const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names={google:'Google / Gmail',yandex:'Яндекс',mailru:'Mail.ru',microsoft:'Outlook / 365'};
 let state={accounts:[],messages:[]},user=null,selected=null,busy=false;
 const MAIN_KEY='its24_crm_kazior_v13',SESSION_KEY='its24_crm_session',MAIL_KEY='kazior_github_demo_mail_v1';
 const readMain=()=>{try{return JSON.parse(localStorage.getItem(MAIN_KEY)||'{}')}catch{return {users:[],tickets:[],lastNo:0}}};
 const writeMain=db=>localStorage.setItem(MAIN_KEY,JSON.stringify(db));
 const readMail=()=>{try{return JSON.parse(localStorage.getItem(MAIL_KEY)||'{"accounts":[],"messages":[]}')}catch{return {accounts:[],messages:[]}}};
 const writeMail=x=>localStorage.setItem(MAIL_KEY,JSON.stringify(x));
 async function api(path,data){
   const db=readMain(),uid=sessionStorage.getItem(SESSION_KEY),u=db.users?.find(x=>x.id===uid);if(!u)throw new Error('Сначала войдите в CRM');let m=readMail();
   if(path==='/api/state')return {user:u,db};if(path==='/api/mail')return m;
   if(path==='/api/mail/connect'){const provider=data.provider,email=data.email||`demo.${provider}@example.invalid`;if(!m.accounts.some(a=>a.email===email)){m.accounts.push({id:'mail-'+Date.now(),provider,email,message:'Демо-подключение'})}writeMail(m);return {ok:true}}
   if(path==='/api/mail/disconnect'){m.accounts=m.accounts.filter(a=>a.id!==data.account);m.messages=m.messages.filter(x=>x.account!==data.account);writeMail(m);return {ok:true}}
   if(path==='/api/mail/sync'){const a=m.accounts.find(x=>x.id===data.account);if(!a)throw new Error('Ящик не найден');const id='msg-'+Date.now();if(!m.messages.some(x=>x.demoSeed&&x.account===a.id))m.messages.unshift({id,account:a.id,demoSeed:true,subject:'DEMO: заявка по рабочему месту',from:'employee@example.invalid',senderName:'Демо сотрудник',body:'Здравствуйте. Не печатает принтер в кабинете 315. Это тестовое письмо для демонстрации CRM.',date:new Date().toLocaleString('ru-RU'),attachments:[]});writeMail(m);return {received:1}}
   if(path==='/api/mail/send')return {ok:true,submitted:true};
   if(path==='/api/mail/ticket'){const msg=m.messages.find(x=>x.id===data.id&&x.account===data.account);db.lastNo=(db.lastNo||0)+1;const id='KZ-'+String(db.lastNo).padStart(6,'0');db.tickets=db.tickets||[];db.tickets.unshift({id,ownerId:u.id,ownerName:msg?.senderName||'Автор письма',org:'КазНИИОиР',dept:'',room:'',location:'',phone:data.phone,source:'E-mail',category:data.category||'Другое',priority:'P3',subject:msg?.subject||'Заявка из письма',description:msg?.body||'',status:'new',engineerId:u.role==='employee'?'':u.id,engineerName:u.role==='employee'?'Не назначен':u.name,created:new Date().toLocaleString('ru-RU'),slaDue:'',files:[],messages:[],history:[]});writeMain(db);if(msg)msg.ticketId=id;writeMail(m);return {id}}
   return {ok:true};
 }
 function notice(text){$('#mailNotice').textContent=text}
 function dialog(html){const d=$('#mailDialog');d.innerHTML='<button class="close" type="button" aria-label="Закрыть">✕</button>'+html;d.querySelector('.close').onclick=()=>d.close();d.showModal();return d}
 async function connect(provider){
  if(['google','microsoft'].includes(provider)){
   try{await api('/api/mail/connect',{provider,email:'demo.'+provider+'@example.invalid'});notice('DEMO: '+names[provider]+' подключён без внешнего OAuth.');await load()}catch(e){notice(e.message)}return;
  }
  const d=dialog(`<h2>Подключить ${names[provider]}</h2><p>Создайте отдельный пароль приложения для почтовой программы. CRM проверит входящие и исходящие подключения.</p><form><label>Адрес почты<input name="email" type="email" required autocomplete="email"></label><label>Пароль приложения<input name="password" type="password" required autocomplete="new-password"></label><button class="primary">Подключить почту</button><p role="status"></p></form>`);
  d.querySelector('form').onsubmit=async e=>{e.preventDefault();const form=e.target,b=form.querySelector('button');b.disabled=true;try{await api('/api/mail/connect',{provider,...Object.fromEntries(new FormData(form))});d.close();notice('Почта подключена. Нажмите «Получить письма».');await load()}catch(e){form.querySelector('[role=status]').textContent=e.message}finally{b.disabled=false}};
 }
 async function load(){state=await api('/api/mail');render();if(!state.accounts.length)$('#connectPanel').classList.remove('hidden')}
 function render(){
  $('#mailAccounts').innerHTML=state.accounts.length?state.accounts.map((a,i)=>`<div class="account"><b>${esc(a.email)}</b><small>${esc(names[a.provider])}</small><small>${esc(a.message)}</small><button data-disconnect="${i}">Отключить ящик</button></div>`).join(''):'<p class="hint">Подключённых ящиков пока нет.</p>';
  $('#mailAccounts').querySelectorAll('[data-disconnect]').forEach(b=>b.onclick=async()=>{const a=state.accounts[Number(b.dataset.disconnect)];if(!confirm('Отключить '+a.email+' от CRM? Оригиналы писем останутся в почте.'))return;try{await api('/api/mail/disconnect',{account:a.id});selected=null;$('#reader').textContent='Выберите письмо';await load()}catch(e){notice(e.message)}});
  const query=$('#search').value.toLowerCase();const rows=state.messages.filter(m=>(m.subject+' '+m.from+' '+m.body).toLowerCase().includes(query));
  $('#messages').innerHTML=rows.length?rows.map(m=>`<button class="message-row ${selected?.id===m.id&&selected?.account===m.account?'selected':''}" data-mid="${esc(m.id)}" data-account="${esc(m.account)}"><b>${esc(m.subject||'Без темы')}</b><small>${esc(m.senderName||m.from)}</small><small>${esc(m.body.slice(0,90))}</small>${m.ticketId?`<small>Заявка ${esc(m.ticketId)}</small>`:''}</button>`).join(''):'<p class="hint" style="padding:20px">Нет полученных писем. Подключите ящик и нажмите «Получить письма».</p>';
  $('#messages').querySelectorAll('[data-mid]').forEach(b=>b.onclick=()=>read(state.messages.find(m=>m.id===b.dataset.mid&&m.account===b.dataset.account)));
  $('#composeBtn').disabled=!state.accounts.length;$('#syncBtn').disabled=busy||!state.accounts.length;
 }
 function read(m){
  selected=m;render();const a=state.accounts.find(a=>a.id===m.account);
  $('#reader').innerHTML=`<h2>${esc(m.subject||'Без темы')}</h2><div class="metadata">От: ${esc(m.senderName)} &lt;${esc(m.from)}&gt;<br>Ящик: ${esc(a?.email)}<br>${esc(m.date)}</div><div class="message-body">${esc(m.body)}</div>${m.attachments?.length?`<p class="hint">Вложения: ${m.attachments.map(esc).join(', ')}. Откройте их в почтовом сервисе.</p>`:''}<div class="actions"><button class="primary" id="replyMail">Ответить</button>${user?.role!=='employee'?'<button id="mailTicket">Создать заявку</button>':''}</div>`;
  $('#replyMail').onclick=()=>compose(m);if($('#mailTicket'))$('#mailTicket').onclick=()=>ticket(m);
 }
 function compose(reply){
  const d=dialog(`<h2>${reply?'Ответ на письмо':'Новое письмо'}</h2><form><label>От кого<select name="account">${state.accounts.map(a=>`<option value="${esc(a.id)}" ${reply?.account===a.id?'selected':''}>${esc(a.email)}</option>`).join('')}</select></label><label>Кому<input type="email" name="to" required value="${esc(reply?.from||'')}"></label><label>Тема<input name="subject" required value="${esc(reply?'Re: '+reply.subject:'')}"></label><label>Текст<textarea name="body" required></textarea></label><button class="primary">Отправить письмо</button><p role="status"></p></form>`);
  const key='mail-'+Array.from(crypto.getRandomValues(new Uint8Array(20)),x=>x.toString(16).padStart(2,'0')).join('');d.querySelector('form').onsubmit=async e=>{e.preventDefault();const form=e.target,b=form.querySelector('button');b.disabled=true;try{const data=Object.fromEntries(new FormData(form));if(reply&&data.account===reply.account)data.replyId=reply.id;await api('/api/mail/send',{...data,key});d.close();notice('Почтовый сервер принял письмо к отправке.')}catch(e){form.querySelector('[role=status]').textContent=e.message}finally{b.disabled=false}};
 }
 function ticket(m){
  const d=dialog('<h2>Заявка из письма</h2><p>Заявка создаётся от имени автора письма и назначается вам. Укажите телефон сотрудника для связи.</p><form><label>Телефон сотрудника для связи<input name="phone" type="tel" required placeholder="+7 …"></label><label>Категория<select name="category">'+['Компьютер','Принтер','Сеть','Wi-Fi','Видеонаблюдение','Сервер','ПО / МИС','Телефония','СКС','Другое'].map(x=>`<option>${x}</option>`).join('')+'</select></label><button class="primary">Создать заявку</button><p role="status"></p></form>');
  d.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const r=await api('/api/mail/ticket',{account:m.account,id:m.id,...Object.fromEntries(new FormData(e.target))});d.close();notice('Создана заявка '+r.id+'. Она доступна в CRM.');await load()}catch(e){d.querySelector('[role=status]').textContent=e.message}finally{b.disabled=false}};
 }
 async function sync(){if(busy)return;busy=true;render();let count=0;const errors=[];for(const a of state.accounts){try{const r=await api('/api/mail/sync',{account:a.id});count+=r.received}catch(e){errors.push(a.email+': '+e.message)}}busy=false;await load();notice('Получено новых писем: '+count+(errors.length?'\n'+errors.join('\n'):''))}
 $('#connectToggle').onclick=()=>$('#connectPanel').classList.toggle('hidden');document.querySelectorAll('[data-connect]').forEach(b=>b.onclick=()=>connect(b.dataset.connect));$('#composeBtn').onclick=()=>compose();$('#syncBtn').onclick=()=>sync().catch(e=>notice(e.message));$('#search').oninput=render;
 setInterval(()=>{if($('#autoSync').checked&&!document.hidden&&!busy)sync().catch(e=>notice(e.message))},60000);
 api('/api/state').then(r=>{user=r.user;$('#mailUser').textContent=user.name;return load()}).catch(e=>notice(e.message+'. Откройте CRM и войдите в свой кабинет.'));
})();
