(() => {
  'use strict';
  const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statuses={draft:'Черновик',review:'На согласовании',signing:'Ожидает подписи',signed:'Подписан · тест',rejected:'Возвращён'};
  let state={documents:[],people:[],user:null,eds:{}},selected=null,filter='all',editing=null,busy=false,formKey='',pollTimer=null,toastTimer;
  function key(){return crypto.randomUUID?.()||'doc-'+Array.from(crypto.getRandomValues(new Uint8Array(20)),x=>x.toString(16).padStart(2,'0')).join('')}
  function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,6500)}
  function showAuth(){$('#workspace').hidden=true;$('#authRequired').hidden=false;clearTimeout(pollTimer)}
  const MAIN_KEY='its24_crm_kazior_v13',SESSION_KEY='its24_crm_session',DOC_KEY='kazior_github_demo_documents_v1';
  const mainDb=()=>{try{return JSON.parse(localStorage.getItem(MAIN_KEY)||'{}')}catch{return {users:[],tickets:[]}}};
  const mainUser=()=>{const db=mainDb(),id=sessionStorage.getItem(SESSION_KEY);return db.users?.find(u=>u.id===id)||null};
  const loadDocs=()=>{try{return JSON.parse(localStorage.getItem(DOC_KEY)||'[]')}catch{return []}};
  const saveDocs=docs=>localStorage.setItem(DOC_KEY,JSON.stringify(docs));
  const stamp=()=>new Date().toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  async function api(path,body){
    const db=mainDb(),user=mainUser();if(!user){showAuth();throw new Error('Войдите в CRM и откройте «Документы» из меню.')}
    let docs=loadDocs();const people=(db.users||[]).filter(u=>u.status==='active').map(u=>({id:u.id,name:u.name,dept:u.dept,role:u.role}));
    if(path==='/api/state')return {user,db};
    if(path==='/api/documents'&&body===undefined)return {documents:docs,people,user,eds:{enabled:false,demo:true}};
    if(path==='/api/attachments')return {id:'att-'+Date.now()+'-'+Math.random().toString(16).slice(2),name:body.name,type:body.type,data:body.data};
    if(path==='/api/documents/create'){
      if(docs.some(d=>d.key===body.key))return {document:docs.find(d=>d.key===body.key)};
      const n=(Math.max(0,...docs.map(d=>Number(String(d.id).replace(/\D/g,''))||0))+1);const id='DOC-'+String(n).padStart(4,'0');
      const d={id,key:body.key,_v:1,type:body.type||'Служебная записка',title:body.title,content:body.content,ticketId:body.ticketId||'',ownerId:user.id,ownerName:user.name,reviewers:body.reviewers||[user.id],signers:body.signers||[user.id],status:'draft',approvals:[],signatures:[],files:body.files||[],created:stamp(),updated:stamp(),history:[{date:stamp(),actor:user.name,text:'Документ создан · DEMO'}]};docs.unshift(d);saveDocs(docs);return {document:d};
    }
    if(path==='/api/documents/action'){
      const d=docs.find(x=>x.id===body.id);if(!d)throw new Error('Документ не найден');
      if(body.action==='edit'){d.title=body.title;d.content=body.content;d.history.push({date:stamp(),actor:user.name,text:'Документ отредактирован'})}
      if(body.action==='submit'){d.status='review';d.history.push({date:stamp(),actor:user.name,text:'Отправлен на согласование'})}
      if(body.action==='approve'){if(!d.approvals.some(a=>a.uid===user.id))d.approvals.push({uid:user.id,name:user.name,date:stamp()});d.status='signing';d.history.push({date:stamp(),actor:user.name,text:'Согласовано · DEMO'})}
      if(body.action==='reject'){d.status='rejected';d.history.push({date:stamp(),actor:user.name,text:'Возвращён на доработку: '+(body.comment||'')})}
      if(body.action==='test-sign'){if(!d.signatures.some(s=>s.uid===user.id))d.signatures.push({uid:user.id,name:user.name,date:stamp(),kind:'simulation',label:'Тестовая подпись'});d.status='signed';d.history.push({date:stamp(),actor:user.name,text:'Добавлена тестовая подпись'})}
      if(body.action==='comment')d.history.push({date:stamp(),actor:user.name,text:'Комментарий: '+(body.comment||'')});
      d._v=(d._v||0)+1;d.updated=stamp();saveDocs(docs);return {document:d};
    }
    return {ok:true};
  }
  function person(id){return state.people.find(p=>p.id===id)?.name||id}
  function pill(d){return `<span class="status-pill status-${esc(d.status)}">${esc(statuses[d.status])}</span>`}
  function visible(){const q=$('#docSearch').value.trim().toLowerCase();return state.documents.filter(d=>(!q||(d.title+' '+d.id).toLowerCase().includes(q))&&(filter==='all'||filter==='mine'&&d.ownerId===state.user.id||filter==='inbox'&&d.status==='review'&&d.reviewers.includes(state.user.id)||filter===d.status))}
  function renderList(){
    $('#docCount').textContent=state.documents.length;$('#reviewCount').textContent=state.documents.filter(d=>d.status==='review'&&d.reviewers.includes(state.user.id)).length;
    const docs=visible();$('#listSummary').textContent=docs.length+' документов';
    $('#documentList').innerHTML=docs.length?docs.map(d=>`<button class="document-row" data-document="${esc(d.id)}"><span class="doc-icon">▤</span><span class="doc-row-text"><h3>${esc(d.title)}</h3><p>${esc(d.id)} · ${esc(d.type)}<br>${esc(d.ownerName)}</p></span><span class="doc-row-end">${pill(d)}<small>${esc(d.updated)}</small></span></button>`).join(''):'<div class="empty"><div class="empty-icon">▤</div><h2>Первый документ — за минуту</h2><p>Создайте служебную записку или откройте три примера. Вы сможете согласовать и подписать их в тестовом режиме.</p><button class="button soft" id="emptyExamples" style="margin-top:22px">Открыть 3 примера</button></div>';
    document.querySelectorAll('[data-document]').forEach(b=>b.onclick=()=>open(b.dataset.document));if($('#emptyExamples'))$('#emptyExamples').onclick=examples;
  }
  function showList(){selected=null;location.hash='';$('#detailScreen').hidden=true;$('#listScreen').hidden=false;$('#viewTitle').textContent='Документы';$('#viewSubtitle').textContent='Создайте документ, согласуйте и проверьте подписание.';renderList()}
  function open(id){selected=id;location.hash=id;$('#detailScreen').hidden=false;$('#listScreen').hidden=true;renderDetail()}
  function renderDetail(){
    const d=state.documents.find(d=>d.id===selected);if(!d)return showList();
    $('#viewTitle').textContent='Работа с документом';$('#viewSubtitle').textContent='Все участники видят одну актуальную версию.';
    $('#detailTitle').textContent=d.title;$('#detailType').textContent=d.type;$('#detailMeta').textContent=d.id+' · Создан '+d.created+' · Автор: '+d.ownerName;$('#detailStatus').innerHTML=pill(d);
    const step={draft:0,rejected:0,review:1,signing:2,signed:3}[d.status];$('#documentSteps').innerHTML=['Создание','Согласование','Подписание','Готово'].map((x,i)=>`<li class="${i<step?'complete':i===step?'current':''}"><i>${i<step?'✓':i+1}</i><span>${x}</span></li>`).join('');
    $('#documentPreview').innerHTML=`<div class="paper-org">АО «Казахский научно-исследовательский институт<br>онкологии и радиологии»<br>Отдел цифровизации</div><h2>${esc(d.type)}</h2><p class="paper-number">${esc(d.id)} · ${esc(d.created)}</p><div class="paper-text"><strong>${esc(d.title)}</strong><br><br>${esc(d.content)}</div><div class="paper-footer">Автор: ${esc(d.ownerName)}${d.ticketId?'<br>Заявка: '+esc(d.ticketId):''}<br>Статус: ${esc(statuses[d.status])}<br>${d.signatures.length?d.signatures.map(s=>esc(s.name)+' — '+esc(s.label)).join('<br>'):'Подписи отсутствуют'}</div><div class="watermark">ТЕСТОВЫЙ ДОКУМЕНТ</div>`;
    $('#documentAttachments').innerHTML=(d.files||[]).map(f=>`<button class="button soft" data-download="${esc(f.id)}">📎 ${esc(f.name)}</button>`).join('');
    $('#documentAttachments').querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>downloadAttachment(d.files.find(f=>f.id===b.dataset.download)));
    let actions='';const owner=d.ownerId===state.user.id;
    if(owner&&['draft','rejected'].includes(d.status))actions+='<button class="button primary" data-action="submit">Отправить на согласование</button><button class="button soft" id="editDocBtn">Редактировать</button>';
    if(d.status==='review'&&d.reviewers.includes(state.user.id)&&!d.approvals.some(a=>a.uid===state.user.id))actions+='<button class="button primary" data-action="approve">✓ Согласовать · тест</button><button class="button danger" data-action="reject">Вернуть на доработку</button>';
    if(d.status==='signing'&&d.signers.includes(state.user.id)&&!d.signatures.some(s=>s.uid===state.user.id))actions+='<button class="button primary" data-action="test-sign">✓ Тестовая подпись</button><button class="button soft" id="realSignBtn">Подписать своим ключом ЭЦП</button><p>Тестовая подпись создаёт демонстрационную отметку. ЭЦП требует NCALayer и серверной проверки.</p>';
    if(!actions)actions='<p>'+(d.status==='signed'?'Маршрут завершён. Скачайте документ и историю для просмотра.':'Ожидается действие назначенного участника.')+'</p>';
    $('#documentActions').innerHTML=actions;$('#documentActions').querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>act(b.dataset.action));
    if($('#editDocBtn'))$('#editDocBtn').onclick=()=>form(d);
    if($('#realSignBtn'))$('#realSignBtn').onclick=async()=>{toast('DEMO: реальный ключ ЭЦП не читается на GitHub Pages. Добавляем безопасную тестовую отметку.');await act('test-sign')};
    $('#documentParticipants').innerHTML='<h4>Участники</h4>'+[['Автор',d.ownerId],...d.reviewers.map(x=>['Согласует',x]),...d.signers.map(x=>['Подписывает',x])].map(([r,id])=>`<div class="participant"><i>${esc(person(id).slice(0,1))}</i><div>${esc(person(id))}<small>${r}${d.approvals.some(a=>a.uid===id)&&r==='Согласует'?' · согласовано':''}</small></div></div>`).join('');
    $('#documentSignatures').innerHTML=d.signatures.length?'<h4>Подписи</h4>'+d.signatures.map(s=>`<div class="signature ${s.kind==='simulation'?'simulation':''}"><b>${s.kind==='simulation'?'✓ Тестовая отметка':'✓ CMS проверен'}</b>${esc(s.name)}<br>${esc(s.date)}<br>${esc(s.label)}</div>`).join(''):'';
    $('#documentHistory').innerHTML=d.history.map(h=>`<div class="history-item"><div>${esc(h.text)}<p>${esc(h.date)} · ${esc(h.actor)}</p></div></div>`).join('');
  }
  function replace(d){const i=state.documents.findIndex(x=>x.id===d.id);if(i>=0)state.documents[i]=d;else state.documents.unshift(d);renderList();if(selected===d.id)renderDetail()}
  const actionKeys=new Map();
  async function act(action,comment){
    const d=state.documents.find(x=>x.id===selected);if(!d||busy)return;
    if(action==='reject'){comment=prompt('Почему документ нужно доработать?');if(!comment?.trim())return}
    const op=action+'-'+d.id+'-'+d._v+'-'+(comment||'');if(!actionKeys.has(op))actionKeys.set(op,key());busy=true;
    $('#documentActions').querySelectorAll('button').forEach(b=>b.disabled=true);
    try{const result=await api('/api/documents/action',{id:d.id,version:d._v,action,comment:comment||'',key:actionKeys.get(op)});replace(result.document);actionKeys.delete(op);toast('Действие сохранено');return true}catch(e){toast(e.message);return false}finally{busy=false;renderDetail()}
  }
  function participants(){
    const f=$('#documentForm'),query=$('#participantSearch').value.trim().toLowerCase();
    for(const name of ['reviewer','signer']){const previous=f.elements[name].value||state.user.id;const people=state.people.filter(p=>p.id===previous||!query||(p.name+' '+(p.dept||'')).toLowerCase().includes(query));f.elements[name].innerHTML=people.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.id===state.user.id?' (я)':''}</option>`).join('');f.elements[name].value=previous}
  }
  function form(d=null,prefill={}){
    editing=d;formKey=key();const f=$('#documentForm');f.reset();$('#documentFormError').textContent='';$('#formTitle').textContent=d?'Редактировать документ':'Создать документ';$('#participantsForm').hidden=!!d;
    for(const name of ['title','content','type','ticketId'])if((d||prefill)[name])f.elements[name].value=(d||prefill)[name];
    f.elements.type.disabled=!!d;f.elements.reviewer.value='';f.elements.signer.value='';participants();$('#documentModal').showModal();f.elements.title.focus();
  }
  const readBase64=file=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=()=>rej(new Error('Не удалось прочитать файл'));r.readAsDataURL(file)});
  async function saveForm(e){
    e.preventDefault();if(busy)return;busy=true;$('#saveDocBtn').disabled=true;$('#documentFormError').textContent='';
    const f=$('#documentForm');
    try{
      let result;
      if(editing)result=await api('/api/documents/action',{id:editing.id,version:editing._v,action:'edit',key:formKey,title:f.elements.title.value,content:f.elements.content.value});
      else {
        const files=[];for(const file of f.elements.files.files){if(file.size>10*1024*1024)throw new Error('Размер файла не должен превышать 10 МБ');files.push(await api('/api/attachments',{name:file.name,type:file.type,data:await readBase64(file)}))}
        result=await api('/api/documents/create',{key:formKey,title:f.elements.title.value,content:f.elements.content.value,type:f.elements.type.value,ticketId:f.elements.ticketId.value,reviewers:[f.elements.reviewer.value],signers:[f.elements.signer.value],files});
      }
      replace(result.document);$('#documentModal').close();open(result.document.id);toast('Черновик сохранён');
    }catch(e){$('#documentFormError').textContent=e.message}finally{busy=false;$('#saveDocBtn').disabled=false}
  }
  async function examples(){
    if(busy)return;busy=true;
    try{
      const examples=[['Служебная записка','Замена принтера в кабинете 315','Прошу рассмотреть замену принтера в кабинете 315.\nПри печати происходит замятие бумаги.\nЦель: восстановить печать рабочих документов.\n\nУчебный пример. Данные вымышлены.'],['Заявка','Доступ к рабочей программе','Прошу согласовать доступ к рабочей программе для выполнения служебных обязанностей.\nНужные разделы: просмотр и формирование отчётов.\n\nУчебный пример. Пароли и данные пациентов не используются.'],['Согласование','Плановое обслуживание компьютеров','Предлагаю согласовать плановую проверку компьютеров отделения.\nПеречень оборудования и удобное время уточняются с ответственным сотрудником.\n\nУчебный пример. Работы фактически не назначены.']];
      for(let i=0;i<examples.length;i++){const [type,title,content]=examples[i];const r=await api('/api/documents/create',{key:'example-v16-'+state.user.id+'-'+i,type,title,content,reviewers:[state.user.id],signers:[state.user.id]});replace(r.document)}state=await api('/api/documents');showList();toast('Добавлены 3 примера. Выберите документ и пройдите его маршрут.');
    }catch(e){toast(e.message)}finally{busy=false}
  }
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  async function downloadAttachment(f){try{if(!f?.data)throw new Error('Вложение недоступно');const bin=atob(f.data),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);download(new Blob([bytes],{type:f.type||'application/octet-stream'}),f.name)}catch(e){toast(e.message)}}
  async function refresh(){
    try{
      if(!busy){const next=await api('/api/documents'),old=state.documents.find(d=>d.id===selected);state=next;$('#connection').textContent='Сохранено · связь активна';renderList();const d=state.documents.find(d=>d.id===selected);if(selected&&(!old||old._v!==d?._v)&&!$('#documentModal').open)renderDetail()}
    }catch(e){$('#connection').textContent=e.message}
    if(sessionStorage.getItem(SESSION_KEY))pollTimer=setTimeout(refresh,5000);
  }
  async function init(){
    $('#documentForm').onsubmit=saveForm;$('#newDocBtn').onclick=()=>form();$('#examplesBtn').onclick=examples;$('#backToList').onclick=showList;
    $('#closeDocModal').onclick=$('#cancelDocForm').onclick=()=>$('#documentModal').close();$('#docSearch').oninput=renderList;$('#participantSearch').oninput=participants;
    document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));showList()});
    $('#exportDocBtn').onclick=()=>{const d=state.documents.find(d=>d.id===selected);if(d)download(new Blob([JSON.stringify({format:'KazIOR-test-document-v16',testMode:true,document:d},null,2)],{type:'application/json'}),d.id+'-test.json')};$('#printDocBtn').onclick=()=>window.print();
    $('#commentForm').onsubmit=async e=>{e.preventDefault();const text=$('#docComment').value.trim();if(!text)return;if(await act('comment',text))$('#docComment').value=''};
    try{state=await api('/api/documents');$('#workspace').hidden=false;$('#docUser').textContent=state.user.name;$('#userInitial').textContent=state.user.name.slice(0,1);renderList();const id=decodeURIComponent(location.hash.slice(1));if(state.documents.some(d=>d.id===id))open(id);
      const tid=new URLSearchParams(location.search).get('ticket');if(tid){const result=await api('/api/state'),t=result.db.tickets.find(t=>t.id===tid);if(t)form(null,{title:t.subject,content:t.description||t.subject,type:'Заявка',ticketId:t.id});else toast('Заявка недоступна')}
      refresh();
    }catch(e){toast(e.message)}
  }
  init();
})();
