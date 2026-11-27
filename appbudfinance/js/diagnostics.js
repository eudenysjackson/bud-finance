import './diagnostics-core.js';
const core=window.BudDiagnosticsCore;
const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
const state={performance:'disabled',sentry:'disabled',appCheck:'disabled'};
let optedOut=false;try{optedOut=localStorage.getItem('bud_diagnostics_disabled')==='true';}catch(_){}
const appEligible=!local&&location.protocol==='https:';
const eligible=appEligible&&!optedOut;
const nativeFetch=window.fetch.bind(window);
const capture=core.collector({dsn:window.BUD_SENTRY_DSN,enabled:eligible&&window.BUD_SENTRY_FREE_PLAN_CONFIRMED===true,send:nativeFetch,limit:10});
state.sentry=eligible&&window.BUD_SENTRY_FREE_PLAN_CONFIRMED===true&&core.sentryEndpoint(window.BUD_SENTRY_DSN)?'configured':'disabled';
window.BudDiagnostics={state,capture:(error,context={})=>capture(error,{route:core.page(location.pathname),...context}),
  setEnabled(enabled){try{localStorage.setItem('bud_diagnostics_disabled',String(!enabled));}catch(_){}location.reload();}};
const preference=document.getElementById('diagnosticsConsent');
if(preference){preference.checked=!optedOut;preference.addEventListener('change',()=>window.BudDiagnostics.setEnabled(preference.checked));}

let perf,trace,appToken=null;
let backendOrigin;try{backendOrigin=new URL(window.BUD_FUNCTIONS_URL).origin;}catch(_){}
// Only add a cached App Check token to our API; never delay a save for attestation.
if(appEligible&&((eligible&&(window.BUD_PERFORMANCE_ENABLED===true||window.BUD_SENTRY_FREE_PLAN_CONFIRMED===true))||window.BUD_APP_CHECK_SITE_KEY)){
  window.fetch=async function(input,init){
    let target;try{target=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);}catch(_){return nativeFetch(input,init);}
    const op=target.origin===backendOrigin?core.operation(target.pathname):null;
    if(!op)return nativeFetch(input,init);
    const start=Date.now();let options=init;
    if(appToken){const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));headers.set('X-Firebase-AppCheck',appToken);options={...init,headers};}
    function record(status){try{if(perf&&trace){const t=trace(perf,'api_'+op);t.record(start,Math.max(1,Date.now()-start),{attributes:{http_status:String(status)}});}}catch(_){} }
    try{const response=await nativeFetch(input,options);record(response.status);if(response.status>=500)void window.BudDiagnostics.capture(new Error(),{status:response.status,op});return response;}
    catch(error){record(0);if(error?.name!=='AbortError'||!options?.signal?.aborted)void window.BudDiagnostics.capture(error,{op});throw error;}
  };
}
if(eligible){
  window.addEventListener('error',e=>{if(e.error)void window.BudDiagnostics.capture(e.error);});
  window.addEventListener('unhandledrejection',e=>void window.BudDiagnostics.capture(e.reason));
}
async function start(){
  if(!appEligible||(!(eligible&&window.BUD_PERFORMANCE_ENABLED)&&!window.BUD_APP_CHECK_SITE_KEY))return;
  try{
    const sdk=await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js');
    const config=window.BUD_FIREBASE_CONFIG;
    if(!config?.appId||!config.projectId||config.appId.startsWith('__'))return;
    const app=sdk.getApps().find(a=>a.name==='[DEFAULT]')||sdk.initializeApp(config);
    if(eligible&&window.BUD_PERFORMANCE_ENABLED===true){
      try{const p=await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-performance.js');
        if(await p.isSupported()){
          perf=p.initializePerformance(app,{instrumentationEnabled:false,dataCollectionEnabled:true});trace=p.trace;state.performance='configured';
          const nav=performance.getEntriesByType('navigation')[0];
          if(nav?.domContentLoadedEventEnd>0)p.trace(perf,'page_ready_'+core.page(location.pathname)).record(performance.timeOrigin,nav.domContentLoadedEventEnd);
        }else state.performance='unsupported';
      }catch(_){state.performance='unavailable';}
    }
    // No provider is activated until the account is verified to have no paid overage.
    if(window.BUD_APP_CHECK_SITE_KEY&&window.BUD_APP_CHECK_FREE_PROVIDER_CONFIRMED===true){
      try{const check=await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-check.js');
        const instance=check.initializeAppCheck(app,{provider:new check.ReCaptchaV3Provider(window.BUD_APP_CHECK_SITE_KEY),isTokenAutoRefreshEnabled:true});
        check.onTokenChanged(instance,result=>{appToken=result.token;state.appCheck='observing';},()=>{appToken=null;state.appCheck='unavailable';});
        // SDK handles caching/refresh. A failed request is never a reason to block the UI.
        check.getToken(instance,false).catch(()=>{state.appCheck='unavailable';});
      }catch(_){state.appCheck='unavailable';}
    }
  }catch(_){}
}
// Monitoring must not block page authentication or the first render.
if(document.readyState==='complete')void start();else window.addEventListener('load',()=>void start(),{once:true});
