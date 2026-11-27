const {collector,operation}=require('../appbudfinance/js/diagnostics-core');
function createMonitoring({env=process.env,send=fetch}={}){
  const capture=collector({dsn:env.SENTRY_DSN,enabled:env.SENTRY_FREE_PLAN_CONFIRMED==='true',send,limit:100});
  const context=req=>({surface:'backend',op:operation(req.path),status:500});
  return {capture:(error,req)=>capture(error,context(req)),middleware(req,res,next){
    const op=operation(req.path);if(op)res.on('finish',()=>{if(res.statusCode>=500)void capture(new Error(),{...context(req),status:res.statusCode});});next();
  }};
}
module.exports={createMonitoring};
