// Minimal DOM for initialization-contract tests; does not model layout or rendering.
module.exports=function makeDocument(html){
 const all=[],ids=new Map();
 function attrs(raw){const out={};for(const m of raw.matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g))out[m[1]]=m[2]??m[3]??'';return out}
 function create(tag='div',attributes={}){
  const classes=new Set((attributes.class||'').split(/\s+/).filter(Boolean));
  const node={tagName:tag.toUpperCase(),attributes,dataset:{},value:attributes.value||'',textContent:'',disabled:'disabled' in attributes,required:'required' in attributes,checked:'checked' in attributes,files:[],children:[],options:[],selectedIndex:0,style:{setProperty(){},removeProperty(){}},addEventListener(){},dispatchEvent(){},remove(){},after(){},click(){this.onclick?.({target:this,preventDefault(){}})},focus(){document.activeElement=this},setAttribute(k,v){this.attributes[k]=v},getAttribute(k){return this.attributes[k]},appendChild(x){this.children.push(x);x.parentElement=this;return x},removeChild(){},querySelectorAll(selector){return document.querySelectorAll(selector)},querySelector(selector){return document.querySelector(selector)},classList:{add(...v){v.forEach(x=>classes.add(x))},remove(...v){v.forEach(x=>classes.delete(x))},contains(v){return classes.has(v)},toggle(v,b){const state=b===undefined?!classes.has(v):!!b;if(state)classes.add(v);else classes.delete(v);return state}},getBoundingClientRect(){return {top:0,height:500}},scrollIntoView(){},scrollTop:0,scrollHeight:500,reset(){},closest(){return null}};
  Object.defineProperty(node,'className',{get:()=>[...classes].join(' '),set:v=>{classes.clear();v.split(/\s+/).forEach(c=>classes.add(c))}});
  Object.defineProperty(node,'innerHTML',{get:()=>node._html||'',set:v=>{node._html=v;parse(v);node.options=[...String(v).matchAll(/<option(?:[^>]*value="([^"]*)")?[^>]*>([^<]*)/g)].map(m=>({value:m[1]||m[2],text:m[2]}));if(!node.value&&node.options.length)node.value=node.options[0].value}});
  for(const [k,v]of Object.entries(attributes))if(k.startsWith('data-'))node.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;
  all.push(node);if(attributes.id){node.id=attributes.id;ids.set(node.id,node)}return node;
 }
 function parse(text){for(const m of String(text).matchAll(/<([a-z][\w-]*)\b([^>]*?)>/gi))create(m[1],attrs(m[2]))}
 const matches=(n,s)=>{
  const id=s.match(/#([\w-]+)/);if(id&&n.id!==id[1])return false;
  for(const cl of s.matchAll(/\.([\w-]+)/g))if(!n.classList.contains(cl[1]))return false;
  for(const at of s.matchAll(/\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/g))if(!(at[1]in n.attributes)||(at[2]!==undefined&&n.attributes[at[1]]!==at[2]))return false;
  const tag=s.match(/^[a-z][\w-]*/i);if(tag&&n.tagName!==tag[0].toUpperCase())return false;
  return true;
 };
 const document={activeElement:null,title:'',addEventListener(){},createElement:create,querySelectorAll(selector){return selector.split(',').flatMap(s=>{s=s.trim().split(/\s+(?![^\[]*\])/).pop();return all.filter(n=>matches(n,s))})},querySelector(selector){if(/^#[\w-]+$/.test(selector))return ids.get(selector.slice(1))||null;return this.querySelectorAll(selector)[0]||null}};
 parse(html);document.body=all.find(n=>n.tagName==='BODY');document.documentElement=all.find(n=>n.tagName==='HTML');all.forEach(n=>n.parentElement=n.parentElement||document.body);return document;
}
