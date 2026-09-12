// Tests the real browser adapter against a local server using a minimal status DOM.
// This is a synchronization contract test, not a rendering or browser test.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{spawn}=require('child_process');
const path=require('path'),root=path.resolve(__dirname,'..');
const fixture=spawn(process.env.PYTHON || (process.platform==='win32'?'python':'python3'),[path.join(__dirname,'client_fixture.py')],{stdio:['ignore','pipe','pipe']});
const firstLine=new Promise((resolve,reject)=>{fixture.stdout.once('data',data=>resolve(JSON.parse(data.toString().split('\n')[0])));fixture.once('error',reject);fixture.stderr.on('data',data=>process.stderr.write(data))});
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}}
function client(origin){
  const elements=new Map();
  const el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',classList:{toggle(){},add(){},remove(){}},appendChild(){},remove(){}});return elements.get(id)};
  const context={console,URL,Blob,Uint32Array,crypto:require('crypto').webcrypto,AbortController,setTimeout,clearTimeout,structuredClone,localStorage:storage(),sessionStorage:storage(),location:{protocol:'http:',origin},navigator:{},document:{querySelector:el,querySelectorAll:()=>[],createElement:()=>el('toast'),body:el('body')},window:{},fetch:(url,opt)=>fetch(origin+url,opt)};
  context.window=context;
  let code=fs.readFileSync(path.join(root,'app.js'),'utf8');
  code=code.replace('document.addEventListener("DOMContentLoaded",init);',`window.testing={stop:()=>{sharedToken="";clearTimeout(sharedPollTimer)},init,enterApp,api,save,changes,getState:()=>db,getFailure:()=>sharedFailure,setSession:r=>{sharedToken=r.token;applyShared(r)},refresh:r=>{sharedFailure=null;applyShared(r)}};`);
  vm.createContext(context);vm.runInContext(code,context);return {t:context.testing,context};
}
(async()=>{
  const info=await firstLine,origin='http://127.0.0.1:'+info.port;
  const {t,context}=client(origin);
  let r=await t.api('/api/auth/name',{name:'Врач Адаптер'});t.setSession(r);
  r=await t.api('/api/tickets',{key:'contract-'+Date.now()+'-abcdef',ticket:{subject:'Контракт синхронизации',phone:'+77010000001'}});t.refresh(r);
  const id=r.ticket.id;t.getState().tickets[0].description='Изменено на первом компьютере';assert.equal(await t.save(),true);
  let current=await t.api('/api/state');assert.equal(current.db.tickets[0].description,'Изменено на первом компьютере');
  const ticket=t.getState().tickets[0];ticket.messages.push({author:'Врач',text:'Сообщение 1',files:[],readBy:[]});
  const first=t.save();ticket.messages.push({author:'Врач',text:'Сообщение 2',files:[],readBy:[]});const second=t.save();
  assert.equal(await first,true);assert.equal(await second,true);
  current=await t.api('/api/state');assert.deepEqual(current.db.tickets[0].messages.map(x=>x.text),['Сообщение 1','Сообщение 2']);
  // Another session writes first: reject this stale edit without overwriting that result.
  const fresh=current.db.tickets[0];await t.api('/api/patch',{key:'conflict-'+Date.now()+'-abcdef',ops:[{kind:'tickets',id,version:fresh._v,value:{...fresh,description:'Правка коллеги'}}]});
  t.getState().tickets[0].description='Устаревшее изменение';assert.equal(await t.save(),false);assert.equal(t.getFailure().conflict,true);
  current=await t.api('/api/state');assert.equal(current.db.tickets[0].description,'Правка коллеги');t.refresh(current);
  // Lost HTTP response after commit: retry the identical operation, not a new message.
  const realFetch=context.fetch;let lost=true;
  context.fetch=async(url,opt)=>{const response=await realFetch(url,opt);if(url==='/api/patch'&&lost){lost=false;throw new Error('Simulated response loss')}return response};
  t.getState().tickets[0].messages.push({text:'Сохранено до потери ответа',files:[]});assert.equal(await t.save(),false);
  const failure=t.getFailure();await t.api(failure.path,failure.body);
  current=await t.api('/api/state');assert.equal(current.db.tickets[0].messages.filter(m=>m.text==='Сохранено до потери ответа').length,1);
  assert.equal(context.localStorage.getItem('its24_crm_kazior_v13'),null);
  // Exercise the full initialization and role rendering against actual HTML IDs.
  const makeDocument=require('./dom_stub.cjs');
  context.document=makeDocument(fs.readFileSync(path.join(root,'index.html'),'utf8'));
  context.addEventListener=()=>{};context.setInterval=()=>0;context.matchMedia=()=>({matches:false,addEventListener(){}});
  t.init();
  const logged=await t.api('/api/auth/name',{name:'Врач Инициализация'});t.setSession(logged);t.enterApp(logged.user);
  const admin=await t.api('/api/auth/password',{login:'superadmin',password:'OnlyForLocalTests-15'});t.setSession(admin);t.enterApp(admin.user);
  context.clearTimeout=clearTimeout;
  t.stop();
  console.log('PASS: initialization, employee and engineer role rendering');
  console.log('PASS: shared save, concurrent local messages, conflict protection, retry after commit, no browser database');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>fixture.kill('SIGINT'));
