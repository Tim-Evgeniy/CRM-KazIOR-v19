// Runs production documents.js against the real local API with a lightweight DOM contract.
// This is not a visual/browser test. No external providers are started.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{spawn}=require('child_process'),path=require('path');
const root=path.resolve(__dirname,'..'),makeDocument=require('./dom_stub.cjs');
const fixture=spawn('python3',[path.join(__dirname,'client_fixture.py')],{stdio:['ignore','pipe','pipe']});
const ready=new Promise((resolve,reject)=>{fixture.stdout.once('data',d=>resolve(JSON.parse(d.toString().split('\n')[0])));fixture.once('error',reject);fixture.stderr.on('data',x=>process.stderr.write(x))});
const wait=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const {port}=await ready,origin='http://127.0.0.1:'+port;
 const r=await fetch(origin+'/api/auth/name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Врач Документ Тест'})});const auth=await r.json();
 const doc=makeDocument(fs.readFileSync(path.join(root,'documents.html'),'utf8'));
 const form=doc.querySelector('#documentForm');form.elements={};for(const name of ['type','title','content','ticketId','reviewer','signer','files'])form.elements[name]=doc.querySelector('[name="'+name+'"]');
 doc.querySelector('#documentModal').showModal=function(){this.open=true};doc.querySelector('#documentModal').close=function(){this.open=false};
 const store=new Map([['kazior_v15_token',auth.token]]);
 const context={console,document:doc,crypto:require('crypto').webcrypto,Uint8Array,URL,URLSearchParams,AbortController,Blob,Event:class{},sessionStorage:{getItem:k=>store.get(k)||null},location:{hash:'',search:''},setTimeout:(fn,ms)=>ms>=28000?setTimeout(fn,ms):0,clearTimeout,fetch:(p,opt)=>fetch(origin+p,opt),prompt:()=>'',window:{}};
 context.window=context;vm.createContext(context);
 const code=fs.readFileSync(path.join(root,'documents.js'),'utf8').replace('  init();\n})();','  window.testing={init,examples,open,form,act,getState:()=>state};\n})();');
 vm.runInContext(code,context);await context.testing.init();await wait();
 assert.equal(doc.querySelector('#workspace').hidden,false);assert.equal(doc.querySelector('#docUser').textContent,'Врач Документ Тест');
 await context.testing.examples();assert.equal(context.testing.getState().documents.length,3);
 const id=context.testing.getState().documents[0].id;context.testing.open(id);
 assert.ok(doc.querySelector('#documentPreview').innerHTML.includes('ТЕСТОВЫЙ ДОКУМЕНТ'));
 await context.testing.act('submit');await context.testing.act('approve');await context.testing.act('test-sign');
 let result=await(await fetch(origin+'/api/documents',{headers:{Authorization:'Bearer '+auth.token}})).json();
 assert.equal(result.documents.find(x=>x.id===id).status,'signed');assert.equal(result.documents.find(x=>x.id===id).signatures[0].cryptographicallyVerified,false);
 assert.ok(doc.querySelector('#documentSignatures').innerHTML.includes('Тестовая отметка'));
 await context.testing.examples();result=await(await fetch(origin+'/api/documents',{headers:{Authorization:'Bearer '+auth.token}})).json();assert.equal(result.documents.length,3);
 context.testing.form();assert.equal(form.elements.reviewer.value,auth.user.id);assert.equal(form.elements.signer.value,auth.user.id);
 // NCALayer bridge protocol: simulate the local signer, never a real private key.
 const sent=[];class FakeWS{constructor(url){this.url=url;setImmediate(()=>this.onmessage({data:JSON.stringify({result:{version:'test'}})}))}send(raw){sent.push(JSON.parse(raw));setImmediate(()=>this.onmessage({data:JSON.stringify({status:true,body:{result:'C'.repeat(100)}})}))}close(){}}
 context.WebSocket=FakeWS;vm.runInContext(fs.readFileSync(path.join(root,'ncalayer.js'),'utf8'),context);const cms=await context.KaziorEDS.sign('dGVzdA==');assert.equal(cms,'C'.repeat(100));assert.equal(sent[0].args.data,'dGVzdA==');assert.equal(sent[0].module,'kz.gov.pki.knca.basics');assert.equal(sent[0].args.signingParams.encapsulate,true);
 console.log('PASS: documents initialization, 3 examples, review/sign flow, repeat without duplicates, participant defaults, NCALayer protocol contract');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>fixture.kill('SIGINT'));
