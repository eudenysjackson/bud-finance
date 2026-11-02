export function validCheckoutURL(raw) {
 const url=new URL(raw);
 if(url.protocol!=='https:'||!/(^|\.)mercadopago\.com(\.[a-z]{2})?$/.test(url.hostname))throw Error('O serviço não retornou um checkout válido.');
 return url.href;
}
export async function openAuthenticatedCheckout(user,planKey,{fetchImpl=fetch,base=window.BUD_FUNCTIONS_URL||'https://bud-finance-backend.onrender.com',navigate=url=>window.location.assign(url),refCode=''}={}) {
 if(!user)throw Error('Sua sessão expirou. Entre novamente para continuar.');
 if(!['starter','pro','plus'].includes(planKey))throw Error('Plano inválido.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try {
 const token=await user.getIdToken();
 const response=await fetchImpl(base.replace(/\/$/,'')+'/mercadopago/create-subscription',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({planKey,...(refCode?{ref:refCode}: {})}),signal:controller.signal});
 const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Não foi possível abrir o checkout. Tente novamente.');
 const target=validCheckoutURL(data.init_point);navigate(target);return data;
 } finally {clearTimeout(timer);}
}
