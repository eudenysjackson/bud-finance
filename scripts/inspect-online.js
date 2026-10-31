const fs=require('node:fs');
const crypto=require('node:crypto');
async function check(url,options={}){
 try{
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(25000)});
  const body=await response.text();
  return {url,status:response.status,finalURL:response.url,title:body.match(/<title>(.*?)<\/title>/s)?.[1],headers:{allowOrigin:response.headers.get('access-control-allow-origin'),allowMethods:response.headers.get('access-control-allow-methods'),allowHeaders:response.headers.get('access-control-allow-headers')},body};
 }catch(error){return{url,error:error.name,cause:error.cause?.code};}
}
async function main(){
 const endpoints=[
 ['https://bud-finance-backend.onrender.com/api/ping'],
 ['https://budsolucoes.com.br/'],
 ['https://budsolucoes.com.br/budfinance/'],
 ['https://www.budsolucoes.com.br/appbudfinance/'],
 ['https://budsolucoes.com.br/appbudfinance/js/bud-utils.js','appbudfinance/js/bud-utils.js'],
 ['https://budsolucoes.com.br/appbudfinance/js/carteira.js','appbudfinance/js/carteira.js'],
 ['https://budsolucoes.com.br/appbudfinance/js/configuracoes.js','appbudfinance/js/configuracoes.js'],
 ['https://budsolucoes.com.br/appbudfinance/js/recuperar-senha.js','appbudfinance/js/recuperar-senha.js'],
 ['https://budsolucoes.com.br/appbudfinance/js/acao-auth.js','appbudfinance/js/acao-auth.js'],
 ];
 for(const [url,file] of endpoints){const result=await check(url);const body=result.body;delete result.body;if(body&&file){const hash=s=>crypto.createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex').slice(0,12);Object.assign(result,{publicHash:hash(body),localHash:hash(fs.readFileSync(file,'utf8')),asyncReader:body.includes('budAIRequest'),accountDeletion:body.includes('/api/account'),backendReset:body.includes('/reset-senha'),browserEmailJS:body.includes('emailjs.send'),resetModeFallback:body.includes("getUrlParam('mode') || 'resetPassword'")});}else if(url.includes('/api/ping'))result.body=body?.slice(0,160);console.log(JSON.stringify(result));}
 const cors=await check('https://bud-finance-backend.onrender.com/api/push/token',{method:'OPTIONS',headers:{Origin:'https://www.budsolucoes.com.br','Access-Control-Request-Method':'DELETE','Access-Control-Request-Headers':'authorization'}});delete cors.body;console.log(JSON.stringify(cors));
 const checkout=await check('https://bud-finance-backend.onrender.com/mercadopago/create-subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planKey:'starter'})});checkout.body=checkout.body?.slice(0,250);console.log(JSON.stringify(checkout));
 const target=process.argv.find(arg=>arg.startsWith('--test-reset-email='))?.split('=')[1];
 if(target){const result=await check('https://bud-finance-backend.onrender.com/reset-senha',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://budsolucoes.com.br'},body:JSON.stringify({email:target})});result.body=result.body?.slice(0,250);console.log(JSON.stringify(result));}
}
main();
