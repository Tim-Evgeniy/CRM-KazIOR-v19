(() => {
 'use strict';
 const crm=window.KaziorCRM,$=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const providers={google:'Google / Gmail',yandex:'Яндекс',mailru:'Mail.ru',microsoft:'Microsoft Outlook / 365'};
 const social={'Google':'google','Яндекс':'yandex','Mail.ru':'mailru','Microsoft':'microsoft'};
 async function oauth(provider,purpose='login') {
  if(window.KAZIOR_GITHUB_DEMO){if(purpose==='login')crm.demoLogin('employee');else crm.toast('DEMO: привязка '+providers[provider]+' показана без внешнего OAuth.');return;}
  try {
   const nonce=Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('');
   sessionStorage.setItem('kazior_oauth_nonce',nonce);
   const r=await crm.api('/api/oauth/begin',{provider,purpose,nonce});window.location.assign(r.url);
  }catch(e){crm.toast(e.message);if($('#edsLoginStatus'))$('#edsLoginStatus').textContent=e.message}
 }
 function eds(purpose) {
  if($('#edsChooser'))return;
  const user=crm.currentUser(),controller=new AbortController(),overlay=document.createElement('div');overlay.className='ai-dialog';overlay.id='edsChooser';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Выбор ключа ЭЦП');
  overlay.innerHTML=`<article><span class="tag neutral">ЭЦП НУЦ РК</span><h2>${purpose==='login'?'Войти с ЭЦП':'Привязать свою ЭЦП'}</h2><ol class="eds-steps"><li>Запустите NCALayer на этом компьютере.</li><li>Нажмите «Выбрать ключ с компьютера». NCALayer откроет выбор файла .p12/.pfx на вашем компьютере.</li><li>Введите пароль ключа в NCALayer и подтвердите подпись запроса входа.</li></ol><p>Ключ остаётся на вашем компьютере. CRM получает подписанный запрос и проверяет его.</p><p>Инженеру: для входа в существующий кабинет сначала привяжите ЭЦП в «Моём профиле». При первом входе с новым ключом создаётся кабинет сотрудника.</p><p role="status" id="edsChooserStatus"></p><div class="form-actions"><button class="btn primary" data-key>Выбрать ключ с компьютера</button><button class="btn soft" data-probe>Проверить NCALayer</button><button class="btn soft" data-close>Закрыть</button></div><a href="https://pki.gov.kz/ncalayer/" target="_blank" rel="noopener">Установить NCALayer</a></article>`;
  document.body.appendChild(overlay);const button=overlay.querySelector('[data-key]'),status=overlay.querySelector('[role=status]');
  overlay.querySelector('[data-close]').onclick=()=>{controller.abort();overlay.remove()};
  overlay.querySelector('[data-probe]').onclick=async()=>{const check=overlay.querySelector('[data-probe]');check.disabled=true;status.textContent='Проверяем NCALayer без выбора ключа…';try{const r=await window.KaziorEDS.probe(controller.signal);status.textContent=r.ok?'NCALayer подключён. Нажмите «Выбрать ключ с компьютера».':r.message}finally{check.disabled=false}};
  button.onclick=async()=>{
   button.disabled=true;status.textContent='Подключаемся к NCALayer… После подключения откроется выбор файла ЭЦП.';
   try {
    const r=await window.KaziorEDS.perform(crm.api,purpose,{}, {signal:controller.signal});
    if(purpose!=='login'&&crm.currentUser()?.id!==user?.id)throw new Error('Кабинет изменился. Войдите снова.');
    overlay.remove();if(purpose==='login')crm.acceptLogin(r);else crm.toast('ЭЦП привязана. Теперь можно входить со своим ключом.');
   }catch(e){status.textContent=e.message}finally{button.disabled=false}
  };
  button.focus();
 }
 function openMail(){window.open('mail.html','kazior-mail')}
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-social],[data-oauth-link],#edsLoginBtn,#edsBindBtn,[data-view="mailbox"],#mailNavBtn,#openMailV17');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(b.dataset.social)oauth(social[b.dataset.social]);
  else if(b.dataset.oauthLink)oauth(b.dataset.oauthLink,'link');
  else if(b.id==='edsLoginBtn')eds('login');
  else if(b.id==='edsBindBtn')eds('bind');
  else openMail();
 },true);
 let last=0;
 function panels(){
  const user=crm.currentUser();if(!user)return;
  for(const id of ['oauthProfile','v17OAuthSettings']){const panel=$('#'+id);if(panel&&panel.dataset.owner!==user.id)panel.remove();}
  const profile=$('#sharedProfilePanel');
  if(profile&&!$('#oauthProfile')){
   const p=document.createElement('div');p.id='oauthProfile';p.dataset.owner=user.id;p.className='v16-panel';p.innerHTML='<h3>Вход через свой аккаунт</h3><p>Привяжите аккаунт, чтобы при следующем входе открыть этот кабинет.</p><div class="link-engineers">'+Object.entries(providers).map(([k,n])=>`<button class="btn soft" type="button" data-oauth-link="${k}">${n}</button>`).join('')+'</div><div id="oauthLinked"></div>';profile.appendChild(p);
   crm.api('/api/oauth/providers').then(r=>{
    if(!$('#oauthLinked'))return;
    $('#oauthLinked').innerHTML=r.links.map(x=>`<p>${esc(providers[x.provider])}: ${esc(x.email||'аккаунт привязан')} <button class="mini-btn" data-unlink-provider="${x.provider}">Отключить</button></p>`).join('');
    $('#oauthLinked').querySelectorAll('[data-unlink-provider]').forEach(b=>b.onclick=async()=>{try{await crm.api('/api/oauth/unlink',{provider:b.dataset.unlinkProvider});b.parentElement.remove();crm.toast('Привязка отключена')}catch(e){crm.toast(e.message)}});
   }).catch(()=>{});
  }
  if(!$('#integrationsView')?.classList.contains('active')||user.role!=='superadmin')return;
  if(!$('#v17OAuthSettings')){
   const el=document.createElement('div');el.id='v17OAuthSettings';el.dataset.owner=user.id;el.className='panel v16-panel';
   el.innerHTML=`<div class="mail-card-top"><div class="provider-logo google">✉</div><div><span class="eyebrow">MAIL CONNECTORS</span><h3>Подключение почты и корпоративный вход</h3></div></div><p>Google / Gmail, Яндекс Почта, Mail.ru и Microsoft Outlook / 365. Почта открывается в отдельном окне: получение писем, ответы и создание заявки.</p><button class="btn primary" id="openMailV17" type="button">Открыть и подключить почту</button><p>Для входа через провайдера зарегистрируйте веб-приложение и сохраните его Client ID и Client Secret. Для Яндекс Почты и Mail.ru также доступно подключение ящика с паролем приложения.</p><div class="oauth-grid">${Object.entries(providers).map(([k,n])=>`<form data-oauth-config="${k}" class="v16-panel"><h4>${n}</h4><p data-ready role="status">Проверяем настройки…</p><label>Адрес CRM<input name="public_origin" type="url" required value="${esc(location.origin)}"></label><label>Redirect URI<input data-redirect readonly aria-label="Redirect URI"></label><label>Client ID<input name="client_id" autocomplete="off" required></label><label>Client Secret<input name="client_secret" type="password" autocomplete="new-password" placeholder="Пусто — сохранить прежний"></label><label><input type="checkbox" name="enabled" checked> Включить вход</label><button class="btn primary">Сохранить ${n}</button><p data-result role="status"></p></form>`).join('')}</div>`;
   $('#integrationsView').appendChild(el);
   el.querySelectorAll('form').forEach(form=>form.onsubmit=async e=>{
    e.preventDefault();const button=form.querySelector('button');button.disabled=true;
    try {const values=Object.fromEntries(new FormData(form));await crm.api('/api/integrations/configure',{...values,section:'oauth',provider:form.dataset.oauthConfig,enabled:form.elements.enabled.checked});form.elements.client_secret.value='';form.querySelector('[data-result]').textContent='Сохранено. Нажмите кнопку провайдера для подключения.';last=0}
    catch(e){form.querySelector('[data-result]').textContent=e.message}finally{button.disabled=false}
   });
  }
  const wa=$('[data-integration="whatsapp"]');
  if(wa&&!wa.dataset.v17){
   wa.dataset.v17='1';wa.querySelector('h4').textContent='WhatsApp · общий номер или номера инженеров';wa.querySelector('p').textContent='Общий номер использует один ключ. Для личного номера каждого инженера укажите его собственный idInstance и ключ. Заявка с личного номера назначается владельцу канала.';
   const people=crm.people().filter(u=>['engineer','superadmin'].includes(u.role));wa.elements.id.innerHTML=people.map(u=>`<option value="${esc(u.login)}">${esc(u.name)}</option>`).join('');
   const fields=document.createElement('div');fields.innerHTML=`<label>Как использовать этот номер<select name="routing"><option value="engineer">Личный номер инженера</option><option value="common">Единый номер отдела</option></select></label><label>Номер WhatsApp<input name="phone" type="tel" placeholder="+7 …"></label><label>Инженер по умолчанию для общего номера<select name="default_engineer_id">${people.map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}</select></label><p>На общий номер можно написать: <b>Заявка: @elnur не работает принтер</b>. Укажите логин инженера из справочника. Без логина заявка назначается выбранному инженеру по умолчанию.</p><p id="waSavedKey" role="status"></p>`;
   wa.insertBefore(fields,wa.querySelector('button'));
   const fill=async()=>{try{const r=await crm.api('/api/whatsapp/status');if(!wa.dataset.channelsLoaded){wa.elements.id.innerHTML=r.channels.map(c=>`<option value="${esc(c.id)}">${esc(people.find(u=>u.id===c.engineerId)?.name||c.id)}</option>`).join('');wa.dataset.channelsLoaded='1';}const x=r.channels.find(x=>x.id===wa.elements.id.value);if(!x)return;wa.elements.phone.value=x.phone;wa.elements.id_instance.value=x.idInstance||'';wa.elements.api_url.value=x.apiUrl||'';wa.elements.enabled.checked=x.enabled;wa.elements.routing.value=x.routing;wa.elements.default_engineer_id.value=x.defaultEngineerId||x.engineerId;wa.elements.api_token.value='';$('#waSavedKey').textContent=x.hasToken?'Ключ этого канала уже сохранён на сервере.':'Ключ этого канала ещё не введён.'}catch(e){crm.toast(e.message)}};
   wa.elements.id.onchange=fill;fill();
  }
  const ef=$('[data-integration="eds"]');
  if(ef&&!ef.dataset.v17){ef.dataset.v17='1';const label=document.createElement('label');label.innerHTML='Сервис проверки<select name="provider"><option value="ncanode">NCANode v3</option><option value="adapter">Собственный адаптер</option></select>';ef.insertBefore(label,ef.querySelector('label'));ef.elements.verifier_url.placeholder='http://127.0.0.1:14579';ef.elements.verifier_url.value='http://127.0.0.1:14579';crm.api('/api/integrations/status').then(r=>{if(r.eds?.provider)ef.elements.provider.value=r.eds.provider;if(r.eds?.verifierUrl)ef.elements.verifier_url.value=r.eds.verifierUrl;ef.elements.enabled.checked=!!r.eds?.enabled}).catch(()=>{});ef.querySelector('p:not([id])').textContent='Запустите START_EDS_SERVER.bat на сервере CRM, выберите NCANode и включите проверку. На компьютере сотрудника нужен NCALayer. Для своего адаптера укажите его полный адрес.';}
  if(Date.now()-last<15000)return;last=Date.now();
  crm.api('/api/oauth/providers').then(r=>{
   for(const p of r.providers){const form=$(`[data-oauth-config="${p.id}"]`);if(!form)continue;form.querySelector('[data-ready]').textContent=p.ready?'Приложение настроено. Вход требует подтверждения у провайдера.':'Нужны реквизиты приложения.';form.querySelector('[data-redirect]').value=p.redirectUri;if(!form.dataset.originLoaded){form.elements.public_origin.value=r.publicOrigin;form.dataset.originLoaded='1';}if(!form.elements.client_id.value)form.elements.client_id.value=p.clientId||'';}
  }).catch(e=>crm.toast(e.message));
 }
 document.addEventListener('DOMContentLoaded',async()=>{
  if(new URLSearchParams(location.search).get('oauth')==='complete'){
   history.replaceState(null,'',location.pathname);const nonce=sessionStorage.getItem('kazior_oauth_nonce')||'';
   try {const r=await crm.api('/api/oauth/finish',{nonce});sessionStorage.removeItem('kazior_oauth_nonce');if(r.error)throw new Error(r.error);if(r.purpose==='login')crm.acceptLogin(r);else if(r.purpose==='mail'){crm.toast('Почта подключена.');location.assign('mail.html')}else crm.toast('Аккаунт привязан к вашему кабинету.')}
   catch(e){$('#edsLoginStatus').textContent=e.message;crm.toast(e.message)}
  }
  setInterval(panels,1500);
 });
})();
