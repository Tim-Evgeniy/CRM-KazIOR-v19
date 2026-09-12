(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.WhatsAppCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clean=(v,max=16000)=>typeof v==='string'?v.slice(0,max):'';
  function safeUrl(value){
    try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch(e){return ''}
  }
  function normalize(payload){
    const b=payload?.body||payload;
    if(!b||b.typeWebhook!=='incomingMessageReceived')return null;
    const sender=b.senderData||{},chat=clean(sender.chatId,200),id=clean(b.idMessage,200);
    if(!chat||chat.endsWith('@g.us')||chat==='status@broadcast'||chat===b.instanceData?.wid)return null;
    if(!id)throw new Error('Входящее сообщение не содержит idMessage');
    const instance=String(b.instanceData?.idInstance||'');
    const data=b.messageData||{},type=clean(data.typeMessage,80),f=data.fileMessageData||{};
    let text=clean(data.textMessageData?.textMessage)||clean(data.extendedTextMessageData?.text)||clean(f.caption);
    if(type==='locationMessage'){
      const location=data.locationMessageData||{};
      text=[clean(location.nameLocation),clean(location.address),`Координаты: ${Number(location.latitude)||0}, ${Number(location.longitude)||0}`].filter(Boolean).join('\n');
    }
    if(type==='contactMessage')text=clean(data.contactMessageData?.displayName)||'Контакт WhatsApp';
    const labels={imageMessage:'Фото',videoMessage:'Видео',audioMessage:'Голосовое сообщение',documentMessage:'Документ',stickerMessage:'Стикер'};
    const url=safeUrl(f.downloadUrl),files=url?[{name:clean(f.fileName,250)||labels[type]||'Вложение WhatsApp',type:clean(f.mimeType,100),url}]:[];
    if(!text)text=labels[type]||'Сообщение WhatsApp';
    const phoneId=[sender.sender,chat].find(x=>typeof x==='string'&&/^\d+@(c\.us|s\.whatsapp\.net)$/.test(x));
    const phone=phoneId?'+'+phoneId.split('@')[0]:'';
    const timestamp=Number(b.timestamp);
    return {key:JSON.stringify([instance,chat,id]),instance,idMessage:id,chatId:chat,
      name:clean(sender.senderContactName,160)||clean(sender.senderName,160)||phone||'Отправитель WhatsApp',
      phone,text,files,type,timestamp:Number.isFinite(timestamp)&&timestamp>0&&timestamp<=253402214400?timestamp:Math.floor(Date.now()/1000)};
  }
  function loginLabel(user){return [user.name,user.dept,user.login].filter(Boolean).join(' · ')}
  const nameKey=v=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');
  function resolveName(users,value){
    const active=users.filter(u=>u.status==='active'),key=nameKey(value);
    const exact=active.filter(u=>nameKey(loginLabel(u))===key);
    if(exact.length===1)return {user:exact[0]};
    const names=active.filter(u=>nameKey(u.name)===key);
    return names.length===1?{user:names[0]}:{error:names.length?'Найдено несколько сотрудников с таким ФИО. Выберите строку с вашим отделом и логином.':'Выберите своё полное ФИО из списка активных сотрудников.'};
  }
  return {normalize,safeUrl,loginLabel,resolveName};
});
