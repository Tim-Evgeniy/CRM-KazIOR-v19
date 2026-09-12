/* NCALayer integration. Private keys and passwords stay inside NCALayer. */
(() => {
  'use strict';
  const endpoints=['wss://127.0.0.1:13579/','wss://localhost:13579/'];
  function permissionHint(){
    return 'Не удалось подключиться к NCALayer. Убедитесь, что NCALayer запущен. В браузере разрешите доступ к локальной сети/loopback. Для проверки откройте https://localhost:13579 и затем повторите вход.';
  }
  function signAt(url,payloadBase64,signal,probe=false){
    return new Promise((resolve,reject)=>{
      let socket,requested=false,done=false;
      const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);try{socket?.close()}catch{};error?reject(error):resolve(value)};
      const abort=()=>finish(Object.assign(new Error('Выбор ЭЦП отменён.'),{canceledByUser:true}));
      let timer=setTimeout(()=>finish(Object.assign(new Error(permissionHint()),{connectionFailure:true})),5000);
      if(signal?.aborted){abort();return} signal?.addEventListener('abort',abort,{once:true});
      try{socket=new WebSocket(url)}catch(e){e.connectionFailure=true;finish(e);return}
      socket.onerror=()=>finish(Object.assign(new Error(permissionHint()),{connectionFailure:!requested}));
      socket.onclose=()=>{if(!done)finish(Object.assign(new Error('NCALayer закрыл соединение до завершения подписи.'),{connectionFailure:!requested}))};
      socket.onmessage=event=>{
        try{
          const reply=JSON.parse(event.data);
          if(!requested){
            if(!reply.result?.version)throw new Error('NCALayer ответил в неизвестном формате. Обновите NCALayer до актуальной версии.');
            if(probe){finish(null,{ok:true,version:reply.result.version});return}
            clearTimeout(timer);timer=setTimeout(()=>finish(new Error('Время выбора ключа истекло. Повторите вход и подтвердите подпись в NCALayer.')),180000);
            requested=true;
            socket.send(JSON.stringify({
              module:'kz.gov.pki.knca.basics',method:'sign',args:{
                allowedStorages:['PKCS12'],format:'cms',data:payloadBase64,
                signingParams:{decode:true,encapsulate:true,digested:false},
                signerParams:{extKeyUsageOids:[]},locale:'ru'
              }
            }));
            return;
          }
          if(!reply.status){
            const msg=[reply.code,reply.message,reply.details].filter(Boolean).join(': ')||'NCALayer не выполнил подпись. Обновите NCALayer: требуется модуль KNCA Basics.';
            throw Object.assign(new Error(msg),{canceledByUser:/cancel|отмен/i.test(String(msg))});
          }
          if(!reply.body || !Object.prototype.hasOwnProperty.call(reply.body,'result'))throw Object.assign(new Error('Выбор ключа отменён пользователем.'),{canceledByUser:true});
          const raw=reply.body.result;
          const cms=Array.isArray(raw)?raw[0]:raw;
          if(typeof cms!=='string'||cms.length<64)throw new Error('NCALayer не вернул CMS-подпись. Повторите выбор ключа.');
          finish(null,cms);
        }catch(e){finish(e)}
      };
    });
  }
  window.KaziorEDS={
    async sign(payloadBase64,signal){
      let last;
      for(const url of endpoints){
        if(signal?.aborted)throw Object.assign(new Error('Выбор ЭЦП отменён.'),{canceledByUser:true});
        try{return await signAt(url,payloadBase64,signal)}catch(e){last=e;if(!e.connectionFailure)throw e}
      }
      throw last||new Error(permissionHint());
    },
    async probe(signal){
      let last;
      for(const url of endpoints){try{return await signAt(url,null,signal,true)}catch(e){last=e;if(!e.connectionFailure)break}}
      return {ok:false,message:last?.message||permissionHint()};
    },
    async perform(api,purpose,extra={},options={}){
      const challenge=await api('/api/eds/challenge',{purpose,...extra});
      const cms=await this.sign(challenge.payloadBase64,options.signal);
      if(options.signal?.aborted)throw new Error('Операция отменена.');
      return api('/api/eds/complete',{id:challenge.id,cms});
    }
  };
})();
