// Small tree DOM for client contract tests; no layout, browser or network simulation.
module.exports=function(html){
 const handlers={};let document;
 const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
 function attrs(raw){const a={};for(const m of raw.matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))a[m[1]]=decode(m[2]??m[3]??m[4]??'');return a}
 function match(n,s){
  const not=s.match(/:not\(([^)]+)\)/);if(not){if(match(n,not[1]))return false;s=s.replace(not[0],'')}
  const tag=s.match(/^[a-z][\w-]*/i);if(tag&&n.tagName!==tag[0].toUpperCase())return false;
  const id=s.match(/#([\w-]+)/);if(id&&n.id!==id[1])return false;
  for(const c of s.matchAll(/\.([\w-]+)/g))if(!n.classList.contains(c[1]))return false;
  for(const a of s.matchAll(/\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/g))if(!(a[1] in n.attributes)||(a[2]!==undefined&&n.attributes[a[1]]!==a[2]))return false;
  return true;
 }
 function create(tag,attributes={}){
  const n={tagName:tag.toUpperCase(),attributes,children:[],parentElement:null,style:{setProperty(){},removeProperty(){}},textContent:'',disabled:false,checked:'checked'in attributes,files:[],_value:attributes.value,appendChild(x){x.remove();x.parentElement=this;this.children.push(x);return x},insertBefore(x,b){x.remove();x.parentElement=this;const i=this.children.indexOf(b);this.children.splice(i<0?this.children.length:i,0,x);return x},remove(){if(this.parentElement){const siblings=this.parentElement.children;const i=siblings.indexOf(this);if(i>=0)siblings.splice(i,1);this.parentElement=null}},setAttribute(k,v){this.attributes[k]=String(v)},getAttribute(k){return this.attributes[k]},focus(){document.activeElement=this},showModal(){this.open=true},close(){this.open=false},addEventListener(){},dispatchEvent(){},querySelectorAll(selector){const candidates=[];function walk(p){for(const c of p.children){candidates.push(c);walk(c)}}walk(this);return candidates.filter(n=>selector.split(',').some(s=>match(n,s.trim())))},querySelector(s){return this.querySelectorAll(s)[0]||null},closest(s){for(let el=this;el;el=el.parentElement)if(s.split(',').some(x=>match(el,x.trim())))return el;return null},click(){const event={target:this,preventDefault(){},stopImmediatePropagation(){this.stopped=true}};for(const h of handlers.click||[]){h(event);if(event.stopped)return}return this.onclick?.(event)}};
  for(const key of ['id','name','type'])Object.defineProperty(n,key,{get:()=>n.attributes[key]||'',set:v=>n.attributes[key]=v});
  Object.defineProperty(n,'className',{get:()=>n.attributes.class||'',set:v=>n.attributes.class=v});
  n.classList={contains(c){return n.className.split(/\s+/).includes(c)},add(...cs){n.className=[...new Set(n.className.split(/\s+/).concat(cs))].join(' ')},remove(...cs){n.className=n.className.split(/\s+/).filter(x=>!cs.includes(x)).join(' ')},toggle(c,on){on=on??!this.contains(c);on?this.add(c):this.remove(c);return on}};
  n.dataset=new Proxy({}, {get:(_,k)=>n.attributes['data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())],set:(_,k,v)=>{n.attributes['data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())]=String(v);return true}});
  Object.defineProperty(n,'value',{get:()=>n._value??(n.tagName==='SELECT'?(n.querySelector('option')?.value||''):n.tagName==='OPTION'?n.attributes.value??n.textContent:''),set:v=>n._value=String(v)});
  Object.defineProperty(n,'elements',{get:()=>new Proxy({}, {get:(_,key)=>n.querySelector('[name="'+key+'"]')})});
  Object.defineProperty(n,'innerHTML',{get:()=>n._html||'',set:v=>{n._html=v;for(const c of n.children)c.parentElement=null;n.children=[];parse(String(v),n)}});
  Object.defineProperty(n,'isConnected',{get:()=>n===document||!!n.parentElement?.isConnected});
  return n;
 }
 function parse(s,parent){const stack=[parent];for(const m of s.matchAll(/<\/?([a-z][\w-]*)\b([^>]*?)>|([^<]+)/gi)){if(m[3]){stack[stack.length-1].textContent+=decode(m[3]);continue}const tag=m[1].toLowerCase();if(m[0].startsWith('</')){for(let i=stack.length-1;i>0;i--)if(stack[i].tagName===tag.toUpperCase()){stack.length=i;break}}else{const n=create(tag,attrs(m[2]));stack[stack.length-1].appendChild(n);if(!['input','img','br','hr','meta','link','source'].includes(tag))stack.push(n)}}}
 document=create('document');document.addEventListener=(name,fn)=>(handlers[name]??=[]).push(fn);document.createElement=tag=>create(tag);document.fire=async name=>{for(const fn of handlers[name]||[])await fn()};parse(html,document);document.body=document.querySelector('body');document.documentElement=document.querySelector('html');
 document.FormData=class{constructor(form){this.fields=form.querySelectorAll('input,select,textarea').filter(n=>n.name&&!n.disabled&&(n.type!=='checkbox'||n.checked)).map(n=>[n.name,n.value])}[Symbol.iterator](){return this.fields[Symbol.iterator]()}};
 return document;
};
