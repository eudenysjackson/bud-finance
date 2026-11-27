/* Shared, allowlisted diagnostics. Never serializes an error, request or profile. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BudDiagnosticsCore=api;})(globalThis,function(){
  'use strict';
  const pages=new Set(['index','cadastro','acao-auth','recuperar-senha','trocar-senha','verificar-email','onboarding','dashboard','carteira','cartoes','extrato','recorrentes','dividas','metas','limites','categorias','graficos','insights','balanco-mensal','comparativo','relatorios','investimentos','assistente-ia','assistente-whatsapp','configuracoes','admin']);
  const kinds=new Set(['Error','TypeError','ReferenceError','SyntaxError','RangeError','NetworkError','TimeoutError','AbortError']);
  const files=new Set([...pages].map(p=>p+'.js').concat(['server.js','financial-write.js','financial-firestore.js','ai-reader.js','invoice-reader.js','subscription-change.js','subscription-upgrade.js','diagnostics.js','bud-utils.js','checkout-client.js']));
  function page(path){const key=String(path||'').split('?')[0].split('#')[0].split('/').filter(Boolean).at(-1)?.replace(/\.html$/,'')||'index';return pages.has(key)?key:'other';}
  function operation(path){
    const p=String(path||'').split('?')[0];
    if(p==='/api/financial/write')return 'financial_write';
    if(p.startsWith('/api/ia/jobs/'))return 'ai_status';
    if(/^\/api\/(extrair|ler|analisar)/.test(p))return 'ai_read';
    if(p==='/api/ping')return 'ping';
    if(p.startsWith('/mercadopago/'))return 'subscription';
    if(p.startsWith('/api/'))return 'api';
    return null;
  }
  function event(error,{surface='frontend',route='other',status,op}={}){
    let kind='Error';try{if(kinds.has(error?.name))kind=error.name;}catch(_){}
    const safeSurface=surface==='backend'?'backend':'frontend',safeRoute=pages.has(route)?route:'other';
    const tags={surface:safeSurface,page:safeRoute};
    if(Number.isInteger(status)&&status>=100&&status<=599)tags.http_status=String(status);
    if(['financial_write','ai_status','ai_read','ping','subscription','api'].includes(op))tags.operation=op;
    const result={platform:'javascript',level:'error',message:'Falha técnica: '+kind,
      exception:{values:[{type:kind,value:'Detalhes pessoais e conteúdo da solicitação não coletados.'}]},
      tags,fingerprint:[safeSurface,safeRoute,tags.operation||'page',kind,tags.http_status||'none']};
    try{
      const frames=String(error?.stack||'').split('\n').slice(1,15).flatMap(line=>{
        const m=line.replace(/\\/g,'/').match(/(appbudfinance\/js|backend)\/([a-z0-9-]+\.js):(\d+):(\d+)/i);
        return m&&files.has(m[2])&&Number(m[3])<100000&&Number(m[4])<100000?[{filename:'app:///'+m[1]+'/'+m[2],lineno:Number(m[3]),colno:Number(m[4]),in_app:true}]:[];
      }).reverse();
      if(frames.length){result.exception.values[0].stacktrace={frames};const top=frames.at(-1);result.fingerprint.push(top.filename,String(top.lineno));}
    }catch(_){}
    return result;
  }
  function sentryEndpoint(dsn){
    try{const u=new URL(dsn);if(u.protocol!=='https:'||!/(^|\.)sentry\.io$/.test(u.hostname)||u.port||u.password||u.search||u.hash||!/^\/[0-9]+$/.test(u.pathname)||!/^[a-f0-9]{32}$/i.test(u.username))return null;
      return u.origin+'/api'+u.pathname+'/envelope/?sentry_version=7&sentry_key='+u.username;
    }catch(_){return null;}
  }
  function collector({dsn,enabled=false,send=globalThis.fetch?.bind(globalThis),uuid=()=>globalThis.crypto.randomUUID(),now=Date.now,limit=10}={}){
    const endpoint=sentryEndpoint(dsn);let used=0,day=-1,pausedUntil=0;const seen=new Set();
    return async function capture(error,context){
      if(!enabled||!endpoint||!send||now()<pausedUntil)return false;
      const today=Math.floor(now()/86400000);if(today!==day){day=today;used=0;seen.clear();}
      const payload=event(error,context),key=JSON.stringify(payload.fingerprint);
      if(used>=limit||seen.has(key))return false;used++;seen.add(key);
      try{payload.event_id=uuid().replace(/-/g,'');payload.timestamp=now()/1000;
        const body=JSON.stringify({event_id:payload.event_id,sent_at:new Date(now()).toISOString()})+'\n'+JSON.stringify({type:'event'})+'\n'+JSON.stringify(payload)+'\n';
        const response=await send(endpoint,{method:'POST',headers:{'Content-Type':'text/plain'},body,credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(3000)});
        if(response.status===429||response.headers?.get('X-Sentry-Rate-Limits'))pausedUntil=now()+3600000;
        return response.ok;
      }catch(_){return false;}
    };
  }
  return {page,operation,event,sentryEndpoint,collector};
});
