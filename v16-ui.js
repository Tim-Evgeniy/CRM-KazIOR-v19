(() => {
  'use strict';
  const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const crm=window.KaziorCRM;
  let lastStatus=0;
  function announce(text){crm.toast(text)}
  async function draft(button,kind){
    if(button.disabled)return;
    const user=crm.currentUser();if(!user)return;
    const context=crm.aiContext(),target=$(kind==='create'?'#ticketDescription':kind==='ticket'?'#replyText':'#chatText');if(!target)return;
    const payload={mode:kind==='create'?'create':'reply',draft:target.value,subject:kind==='create'?$('#ticketSubject').value:''};
    if(kind==='create'){payload.category=$('#ticketCategory').value;payload.room=$('#ticketRoom').value;payload.dept=$('#ticketDept').value;payload.location=$('#ticketLocation').value;}
    if(kind!=='create'){if(context.ticketId)payload.ticketId=context.ticketId;else if(context.chatId)payload.chatId=context.chatId}
    button.disabled=true;
    const overlay=document.createElement('div');overlay.className='ai-dialog';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','AI ответ');
    overlay.innerHTML='<article><h3>✦ Подготовить ответ</h3><p class="ai-source" role="status">Готовим черновик по выбранной заявке…</p><textarea aria-label="Черновик ответа" disabled></textarea><div class="form-actions"><button class="btn primary" data-use disabled>Вставить в сообщение</button><button class="btn soft" data-cancel>Отмена</button></div><p class="hint">Проверьте текст. После вставки его можно изменить и отправить.</p></article>';
    document.body.appendChild(overlay);overlay.querySelector('[data-cancel]').onclick=()=>overlay.remove();
    try{
      const result=await crm.api('/api/ai/draft',payload),editor=overlay.querySelector('textarea');
      overlay.querySelector('.ai-source').textContent=result.label;editor.value=result.text;editor.disabled=false;
      const use=overlay.querySelector('[data-use]');use.disabled=false;use.onclick=()=>{
        const current=crm.aiContext();
        if(crm.currentUser()?.id!==user.id||(kind!=='create'&&(current.ticketId!==context.ticketId||current.chatId!==context.chatId))||!target.isConnected){announce('Переписка изменилась. Скопируйте черновик или подготовьте новый ответ.');return}
        target.value=editor.value;target.dispatchEvent(new Event('input',{bubbles:true}));overlay.remove();target.focus();announce('Черновик вставлен. Проверьте и нажмите «Отправить».');
      };editor.focus();
    }catch(e){overlay.querySelector('.ai-source').textContent=e.message}finally{button.disabled=false}
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('#createAiBtn,#replyAiBtn,#chatAiBtn');
    if(b){e.preventDefault();e.stopImmediatePropagation();draft(b,b.id==='createAiBtn'?'create':b.id==='replyAiBtn'?'ticket':'chat')}
    const doc=e.target.closest?.('[data-ticket-ref]');
    if(doc?.dataset.ticketRef?.startsWith('doc:')){
      e.preventDefault();e.stopImmediatePropagation();window.open('documents.html#'+encodeURIComponent(doc.dataset.ticketRef.slice(4)),'kazior-documents');
    }
  },true);
  function settingsPanel(){
    if(!$('#integrationsView')?.classList.contains('active')||crm.currentUser()?.role!=='superadmin')return;
    if(!$('#v16Integrations')){
      const panel=document.createElement('div');panel.id='v16Integrations';panel.className='panel v16-panel';
      panel.innerHTML=`<h3>Подключения и помощник</h3><p>Ключи сохраняются на компьютере с сервером CRM. Пустое поле сохраняет ранее введённый ключ.</p><div id="integrationRestart" role="status"></div>
      <form data-integration="whatsapp" class="v16-panel"><h4>WhatsApp · подключить номер инженера</h4><p>Для каждого номера нужны его собственные idInstance и apiTokenInstance.</p><label>Инженер<select name="id"><option value="superadmin">Демо Администратор</option><option value="amuratova">Инженер Сети</option><option value="elnur">Инженер Программирования</option><option value="altair">Инженер Поддержки</option><option value="kuanysh">Инженер Резерв</option><option value="abarakbaeva">Инженер Демо</option></select></label><label>idInstance<input name="id_instance" inputmode="numeric" autocomplete="off"></label><label>apiTokenInstance<input name="api_token" type="password" autocomplete="new-password"></label><label>Адрес API<input name="api_url" type="url" placeholder="https://api.green-api.com"></label><label><input name="enabled" type="checkbox" checked> Включить канал</label><button class="btn primary">Сохранить WhatsApp</button><p role="status"></p></form>
      <form data-integration="telegram" class="v16-panel"><h4>Telegram</h4><p id="telegramConnectionStatus" class="integration-status">Проверяем…</p><p>Создайте бота через @BotFather, вставьте его токен. Затем сотрудники и инженеры подключают бота в «Моём профиле».</p><label>Токен бота Telegram<input name="bot_token" type="password" autocomplete="new-password" placeholder="123456789:…"></label><label><input name="enabled" type="checkbox" checked> Включить Telegram</label><button class="btn primary">Сохранить Telegram</button><p role="status"></p><div id="telegramRecent"></div></form>
      <form data-integration="ai" class="v16-panel"><h4>✦ AI ответ</h4><p id="aiConnectionStatus" class="integration-status"></p><p>Помощник получает текст выбранной заявки и последние сообщения этой переписки. Он готовит черновик; отправляет человек.</p><label>API-ключ OpenAI<input name="api_key" type="password" autocomplete="new-password" placeholder="Отдельный ключ AI"></label><label>Модель<input name="model" value="gpt-4.1-mini" autocomplete="off"></label><label><input name="enabled" type="checkbox" checked> Включить генеративный AI</label><button class="btn primary">Сохранить AI</button><p role="status"></p></form>
      <form data-integration="eds" class="v16-panel"><h4>ЭЦП · серверная проверка</h4><p id="edsConnectionStatus" class="integration-status"></p><p>NCALayer выбирает ключ на компьютере подписанта. Для рабочего входа CRM должна проверить CMS, сертификат и отзыв. Настройка адаптера описана в EDS_SETUP_RU.md.</p><label>Адрес проверяющего сервиса<input name="verifier_url" type="url" placeholder="http://127.0.0.1:…/verify"></label><label>Ключ сервиса, если требуется<input name="verifier_token" type="password" autocomplete="new-password"></label><label><input name="enabled" type="checkbox"> Включить проверку ЭЦП</label><button class="btn primary">Сохранить ЭЦП</button><p role="status"></p></form>`;
      $('#integrationsView').appendChild(panel);
      panel.querySelectorAll('form').forEach(form=>form.onsubmit=async e=>{
        e.preventDefault();const b=form.querySelector('button'),status=form.querySelector('p[role=status]');b.disabled=true;
        const values=Object.fromEntries(new FormData(form));values.section=form.dataset.integration;values.enabled=form.elements.enabled.checked;
        try{const res=await crm.api('/api/integrations/configure',values);form.querySelectorAll('input[type=password]').forEach(x=>x.value='');status.textContent=res.restartRequired?'Сохранено. Перезапустите сервер CRM, чтобы применить подключение.':'Сохранено. Подключение настроено.';lastStatus=0}
        catch(e){status.textContent=e.message}finally{b.disabled=false}
      });
    }
    if(Date.now()-lastStatus<10000)return;lastStatus=Date.now();
    crm.api('/api/integrations/status').then(r=>{
      if(!$('#v16Integrations'))return;
      $('#telegramConnectionStatus').textContent=r.telegram.message+' · Привязано кабинетов: '+r.telegram.linked;
      $('#aiConnectionStatus').textContent=r.ai.enabled?'API настроен · '+r.ai.model:'Сейчас доступны локальные подсказки по теме. API-ключ AI не подключён.';
      $('#edsConnectionStatus').textContent=r.eds.enabled?'Сервер проверки настроен. Его ответ будет проверяться при каждой операции.':'ЭЦП не подключена. Тестовый маршрут документов доступен.';
      $('#integrationRestart').textContent=r.restartRequired?'Есть изменения подключений. Перезапустите сервер CRM.':'';
      $('#telegramRecent').innerHTML=r.telegram.recent.length?'<h4>Последние отправки Telegram</h4>'+r.telegram.recent.slice(0,8).map(x=>`<p>${esc(x.ticket_id||'Уведомление')} · ${esc(({pending:'В очереди',submitted:'Принято Telegram',uncertain:'Нужна проверка',failed:'Ошибка',sending:'Отправляется',cancelled:'Отменено'})[x.state]||x.state)} ${['failed','uncertain'].includes(x.state)?`<button type="button" class="btn soft" data-tg-retry="${esc(x.id)}">Повторить</button>`:''}</p>`).join(''):'';
      $('#telegramRecent').querySelectorAll('[data-tg-retry]').forEach(b=>b.onclick=async()=>{if(!confirm('Проверьте Telegram: сообщение могло уже прийти. Отправить повторно?'))return;try{await crm.api('/api/telegram/retry',{id:b.dataset.tgRetry,confirmed:true});lastStatus=0}catch(e){announce(e.message)}});
    }).catch(e=>{if($('#integrationRestart'))$('#integrationRestart').textContent=e.message});
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('#documentsNavBtn').onclick=()=>crm.openDocuments();
    $('#edsLoginBtn').onclick=async()=>{
      const b=$('#edsLoginBtn'),status=$('#edsLoginStatus');b.disabled=true;status.textContent='Проверяем подключение ЭЦП…';
      try{const result=await window.KaziorEDS.perform(crm.api,'login');status.textContent='';crm.acceptLogin(result)}catch(e){status.textContent=e.message}finally{b.disabled=false}
    };
    $('#edsBindBtn').onclick=async()=>{const b=$('#edsBindBtn');b.disabled=true;try{await window.KaziorEDS.perform(crm.api,'bind');announce('ЭЦП привязана. Теперь можно входить с ключом.')}catch(e){announce(e.message)}finally{b.disabled=false}};
    $('#telegramLinkBtn').onclick=async()=>{try{const r=await crm.api('/api/telegram/link',{});$('#telegramLinkResult').innerHTML=`<p>Откройте бота и подтвердите свой телефон. Ссылка действует 10 минут.</p><a class="btn primary" target="_blank" rel="noopener" href="${esc(r.url)}">Открыть Telegram</a><button class="btn soft" id="telegramUnlinkBtn" type="button">Отключить мой Telegram</button>`;$('#telegramUnlinkBtn').onclick=async()=>{try{await crm.api('/api/telegram/unlink',{});$('#telegramLinkResult').textContent='Telegram отключён от вашего кабинета.'}catch(e){announce(e.message)}}}catch(e){$('#telegramLinkResult').textContent=e.message}};
    setInterval(settingsPanel,1500);
  });
})();
