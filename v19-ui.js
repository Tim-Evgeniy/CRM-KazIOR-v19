/* Server-backed WhatsApp controls; no provider credentials in browser storage. */
(() => {
 'use strict';
 const crm=window.KaziorCRM,$=s=>document.querySelector(s);
 function install(){
  const form=$('[data-integration="whatsapp"]');
  if(!form||form.dataset.v19||crm.currentUser()?.role!=='superadmin')return;
  form.dataset.v19='1';
  const box=document.createElement('div');box.className='wa-diagnostics';
  box.innerHTML=`<label>Входящие сообщения<select name="incoming_mode"><option value="commands">Заявки начинаются со слова «Заявка»</option><option value="all">Каждое личное сообщение — обращение в Service Desk</option></select></label><p>В режиме «Каждое личное сообщение» ответ на единственную открытую заявку можно написать обычным сообщением. Если заявок несколько, укажите номер KZ-… или ответьте цитатой.</p><fieldset><legend>Уведомления</legend><label><input type="checkbox" name="notify_new" checked> Новые заявки — инженерам</label><label><input type="checkbox" name="notify_reply" checked> Ответы инженера — на WhatsApp сотрудника</label><label><input type="checkbox" name="notify_status" checked> Изменение статуса — на WhatsApp сотрудника</label></fieldset><div class="form-actions"><button type="button" class="btn soft" data-check>Проверить подключение</button><button type="button" class="btn soft" data-apply>Применить без перезапуска CRM</button></div><label>Номер для тестового сообщения<input type="tel" name="test_phone" placeholder="+7 777 000 00 00"></label><button type="button" class="btn primary" data-test>Отправить тест на этот номер</button><p data-diagnostic role="status"></p><p>Сообщения отправляет сервер CRM, даже когда вкладка закрыта. Результат смотрите в журнале: «Принято сервисом» ещё не означает «Доставлено».</p>`;
  form.appendChild(box);
  const report=box.querySelector('[data-diagnostic]');
  const load=async()=>{try{const r=await crm.api('/api/whatsapp/status');const c=r.channels.find(x=>x.id===form.elements.id.value);if(c)form.elements.incoming_mode.value=c.incomingMode||'commands';for(const key of ['notify_new','notify_reply','notify_status'])form.elements[key].checked=r.notifications?.[key]!==false}catch(e){report.textContent=e.message}};
  form.elements.id.addEventListener('change',load);load();
  const action=async(button,path,payload)=>{button.disabled=true;report.textContent='Проверяем…';try{const r=await crm.api(path,payload);report.textContent=r.checks?r.checks.map(x=>(x.ok?'✓ ':'✗ ')+x.name).join('\n')+(r.enabled?'':'\nКанал выключен. Включите и сохраните его.'):(r.message||'Готово');return r}catch(e){report.textContent=e.message}finally{button.disabled=false}};
  box.querySelector('[data-check]').onclick=e=>action(e.currentTarget,'/api/whatsapp/check',{id:form.elements.id.value});
  box.querySelector('[data-apply]').onclick=e=>action(e.currentTarget,'/api/whatsapp/apply',{});
  box.querySelector('[data-test]').onclick=e=>{const phone=form.elements.test_phone.value.trim();if(!phone){report.textContent='Сначала укажите номер получателя тестового сообщения.';form.elements.test_phone.focus();return}action(e.currentTarget,'/api/whatsapp/test',{id:form.elements.id.value,phone,key:crypto.randomUUID()})};
  form.onsubmit=async event=>{
   event.preventDefault();const button=form.querySelector('button'),values=Object.fromEntries(new FormData(form));values.section='whatsapp';
   for(const key of ['enabled','notify_new','notify_reply','notify_status'])values[key]=form.elements[key].checked;
   delete values.test_phone;button.disabled=true;report.textContent='Сохраняем…';
   try{await crm.api('/api/integrations/configure',values);form.elements.api_token.value='';const r=await crm.api('/api/whatsapp/apply',{});report.textContent='Сохранено. '+r.message}catch(e){report.textContent=e.message}finally{button.disabled=false}
  };
 }
 document.addEventListener('DOMContentLoaded',()=>setInterval(install,1000));
})();
