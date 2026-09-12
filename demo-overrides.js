(() => {
'use strict';
window.KAZIOR_GITHUB_DEMO=true;
window.KaziorEDS={
  probe:async()=>({ok:true,message:'DEMO: NCALayer симулируется'}),
  perform:async(api,purpose)=>{await new Promise(r=>setTimeout(r,350));if(purpose==='login')return {demoUserId:'u9',user:{id:'u9'}};return {ok:true,demo:true,document:null}}
};
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-demo-login]').forEach(b=>b.onclick=()=>window.KaziorCRM.demoLogin(b.dataset.demoLogin));
  const wa=document.querySelector('#sharedLinkBtn');if(wa)wa.onclick=()=>{const r=document.querySelector('#sharedLinkResult');if(r)r.innerHTML='<p><b>DEMO код:</b> CRM DEMO-2026</p><p>В рабочей версии код связывает WhatsApp с кабинетом через сервер.</p>';};
  const ribbon=document.createElement('div');ribbon.className='github-demo-ribbon';ribbon.textContent='DEMO · без реальной БД/API';document.body.appendChild(ribbon);
});
})();
