const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const code=fs.readFileSync(require('path').join(__dirname,'../ncalayer.js'),'utf8');
function client(replies){
 const sent=[],sockets=[];
 class WebSocket{
  constructor(url){this.url=url;sockets.push(this);queueMicrotask(()=>{if(replies.connectFail&&sockets.length===1)this.onerror();else this.onmessage({data:JSON.stringify({result:{version:'1.4'}})})})}
  send(data){sent.push(JSON.parse(data));queueMicrotask(()=>this.onmessage({data:JSON.stringify(replies.response)}))}
  close(){this.closed=true}
 }
 const context={window:{},WebSocket,setTimeout,clearTimeout,AbortController};vm.runInNewContext(code,context);
 return {eds:context.window.KaziorEDS,sent,sockets};
}
(async()=>{
 let c=client({});assert.equal((await c.eds.probe()).ok,true);assert.equal(c.sent.length,0);assert(c.sockets.every(s=>s.closed));
 for(const status of [true,'true']){c=client({response:{status,body:{result:['A'.repeat(128)]}}});assert.equal(await c.eds.sign('VEVTVA=='),'A'.repeat(128));assert.equal(c.sent[0].args.allowedStorages[0],'PKCS12');assert.deepEqual(Array.from(c.sent[0].args.signerParams.extKeyUsageOids),[])}
 c=client({response:{status:true,body:{}}});await assert.rejects(c.eds.sign('VEVTVA=='),e=>e.canceledByUser);assert.equal(c.sockets.length,1);
 c=client({response:{status:false,code:'BAD_KEY',message:'Неверный ключ'}});await assert.rejects(c.eds.sign('VEVTVA=='),/BAD_KEY/);assert.equal(c.sockets.length,1);
 c=client({connectFail:true,response:{status:true,body:{result:'B'.repeat(128)}}});assert.equal(await c.eds.sign('VEVTVA=='),'B'.repeat(128));assert.equal(c.sockets.length,2);
 c=client({});const controller=new AbortController();controller.abort();await assert.rejects(c.eds.sign('x',controller.signal),e=>e.canceledByUser);assert.equal(c.sockets.length,0);
 console.log('PASS: NCALayer probe, signature formats, PKCS12 parameters, cancel, provider error, connection fallback, abort');
})().catch(e=>{console.error(e);process.exitCode=1});
