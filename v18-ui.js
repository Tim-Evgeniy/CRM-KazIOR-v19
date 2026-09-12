(() => {
  'use strict';
  const crm=window.KaziorCRM,$=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localPlans=[
    {keys:['принтер','печать','картридж'],title:'Проверка принтера',steps:['Убедитесь, что принтер включён и на экране нет ошибки.','Проверьте бумагу и очередь печати на компьютере.','Попробуйте распечатать тестовую страницу.','Если принтер сетевой — уточните, доступен ли он у коллег.']},
    {keys:['wi-fi','wifi','вайфай','интернет','сеть'],title:'Проверка сети',steps:['Проверьте, подключён ли кабель или нужная Wi‑Fi сеть.','Отключите и снова включите сетевое подключение.','Проверьте, работает ли сеть у коллег рядом.','Если проблема только на одном ПК — укажите кабинет и имя компьютера.']},
    {keys:['компьютер','windows','не включ','завис','медленно'],title:'Проверка компьютера',steps:['Сохраните документы, если это возможно.','Перезапустите только проблемную программу; если не помогает — компьютер.','Запишите точный текст ошибки или приложите фото.','Не отключайте питание медицинского оборудования без разрешения ответственного сотрудника.']},
    {keys:['программа','мис','damed','ошибка','приложение'],title:'Проверка программы',steps:['Закройте программу и откройте её снова.','Запишите точный текст ошибки и действие, после которого она появляется.','Проверьте, возникает ли ошибка у другого сотрудника.','Не сообщайте AI или инженеру пароль от вашей учётной записи.']},
    {keys:['камера','видеонаблю','ivms'],title:'Проверка видеонаблюдения',steps:['Уточните номер/место камеры и что именно отсутствует: изображение, архив или связь.','Проверьте, проблема с одной камерой или с несколькими.','Не перезагружайте регистратор самостоятельно, если он обслуживает другие камеры.','Приложите скриншот ошибки при наличии.']}
  ];
  function fallback(text){const low=text.toLowerCase();const p=localPlans.find(x=>x.keys.some(k=>low.includes(k)))||{title:'Первичная диагностика',steps:['Опишите, что именно не работает и когда это началось.','Укажите кабинет/корпус и текст ошибки.','Проверьте, проблема только у вас или у коллег тоже.','Если безопасно — перезапустите только проблемную программу.']};return `${p.title}:\n${p.steps.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\nПосле выполнения напишите, что получилось. Если проблема останется, AI поможет подготовить заявку инженеру.`}
  async function askAgent(history){
    const subject=$('#ticketSubject')?.value.trim()||'';const description=$('#ticketDescription')?.value.trim()||'';const category=$('#ticketCategory')?.value||'Другое';
    const transcript=history.map(x=>`${x.role==='user'?'Сотрудник':'AI'}: ${x.text}`).join('\n').slice(-4200);
    const request=`Режим консультации до создания заявки. Помоги сотруднику безопасно устранить ИТ-проблему самостоятельно. Давай максимум 3-5 простых шагов за один ответ, затем один короткий вопрос о результате. Не проси пароли, ЭЦП, секретные ключи. Не предлагай отключать серверы, сетевое ядро, медицинское оборудование или выполнять действия с риском потери данных. Если нужна работа инженера — прямо скажи создать заявку.\nПроблема: ${subject}\nДополнение: ${description}\nДиалог:\n${transcript}`;
    try{const r=await crm.api('/api/ai/draft',{mode:'consult',subject,category,draft:request,room:$('#ticketRoom')?.value||'',dept:$('#ticketDept')?.value||'',location:$('#ticketLocation')?.value||''});return r.text||fallback(subject+' '+description)}catch{return fallback(subject+' '+description)}
  }
  async function openAgent(){
    if($('#aiSelfHelpDialog'))return;
    const subject=$('#ticketSubject')?.value.trim()||'';if(!subject){crm.toast('Сначала коротко напишите, что не работает.');$('#ticketSubject')?.focus();return}
    const overlay=document.createElement('div');overlay.id='aiSelfHelpDialog';overlay.className='ai-dialog';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    overlay.innerHTML=`<article class="ai-selfhelp"><div class="ai-selfhelp-head"><div><span class="tag ok">AI SERVICE DESK</span><h3>Помощник до создания заявки</h3><p>Попробуем безопасные действия. Если не поможет — перенесём результат диагностики в заявку инженеру.</p></div><button class="icon-btn" data-close type="button">✕</button></div><div class="ai-selfhelp-chat" data-chat></div><form class="ai-selfhelp-form"><input name="message" autocomplete="off" placeholder="Например: перезагрузил, ошибка осталась"><button class="btn primary">Отправить</button></form><div class="form-actions"><button class="btn soft" data-solved type="button">✓ Проблема решена</button><button class="btn primary" data-ticket type="button">Не помогло — добавить в заявку</button></div><p class="hint">AI не запрашивает пароли, закрытые ключи ЭЦП и медицинские данные пациентов.</p></article>`;
    document.body.appendChild(overlay);const chat=overlay.querySelector('[data-chat]'),history=[{role:'user',text:subject}];
    const render=()=>{chat.innerHTML=history.map(x=>`<div class="ai-selfhelp-msg ${x.role}"><b>${x.role==='user'?'Вы':'AI помощник'}</b><p>${esc(x.text).replace(/\n/g,'<br>')}</p></div>`).join('');chat.scrollTop=chat.scrollHeight};
    const respond=async()=>{history.push({role:'assistant',text:'Проверяю возможные безопасные действия…'});render();const idx=history.length-1;history[idx].text=await askAgent(history.slice(0,-1));render()};
    overlay.querySelector('[data-close]').onclick=()=>overlay.remove();
    overlay.querySelector('[data-solved]').onclick=()=>{crm.toast('Отлично. Заявку создавать не нужно.');overlay.remove()};
    overlay.querySelector('[data-ticket]').onclick=()=>{const transcript=history.map(x=>`${x.role==='user'?'Сотрудник':'AI'}: ${x.text}`).join('\n');const d=$('#ticketDescription');const marker='Диагностика с AI до заявки:';d.value=[d.value.trim(),`${marker}\n${transcript}`].filter(Boolean).join('\n\n').slice(0,5000);d.dispatchEvent(new Event('input',{bubbles:true}));overlay.remove();d.focus();crm.toast('Диалог диагностики добавлен в заявку. Проверьте текст и создайте обращение.')};
    overlay.querySelector('form').onsubmit=async e=>{e.preventDefault();const input=e.currentTarget.elements.message,text=input.value.trim();if(!text)return;history.push({role:'user',text});input.value='';render();await respond()};
    render();await respond();
  }
  document.addEventListener('click',e=>{const b=e.target.closest?.('#aiSelfHelpBtn');if(!b)return;e.preventDefault();e.stopImmediatePropagation();openAgent()},true);

})();
