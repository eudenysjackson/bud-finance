// Run in the backend environment with its existing Firebase/MP credentials.
// Default: read-only report; --apply --production enables the authorized update.
const {writeFileSync}=require('node:fs');
const admin=require('../backend/node_modules/firebase-admin');
const {createPriceMigration,VERSION}=require('../backend/subscription-pricing');
async function main(){
  const args=process.argv.slice(2),apply=args.includes('--apply'),local=args.includes('--emulator');
  const reportIndex=args.indexOf('--report'),report=reportIndex>=0?args[reportIndex+1]:null;
  if(!report||!report.endsWith('.local.json'))throw Error('Use --report <arquivo.local.json> privado e ignorado pelo Git.');
  if(apply&&!local&&!args.includes('--production'))throw Error('Confirme --production para aplicar.');
  if(!local&&(process.env.FIREBASE_AUTH_EMULATOR_HOST||process.env.FIRESTORE_EMULATOR_HOST))throw Error('Ambiente de emulação inesperado.');
  if(!process.env.MP_ACCESS_TOKEN)throw Error('MP_ACCESS_TOKEN ausente.');
  if(local){process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';admin.initializeApp({projectId:'bud-finance-local'});}
  else admin.initializeApp({credential:process.env.FIREBASE_SERVICE_ACCOUNT?admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)):admin.credential.applicationDefault(),projectId:'bud-finance'});
  const db=admin.firestore(),migrate=createPriceMigration({db,token:process.env.MP_ACCESS_TOKEN});
  const rows=[];let cursor;
  do{
    let query=db.collection('usuarios').orderBy(admin.firestore.FieldPath.documentId()).limit(100);
    if(cursor)query=query.startAfter(cursor);
    const batch=await query.get();if(batch.empty)break;
    for(const doc of batch.docs){
      if(!doc.data().mpSubscriptionId)continue;
      try{rows.push({uid:doc.id,...await migrate(doc.id,{apply})});}
      catch(error){rows.push({uid:doc.id,status:'error',reason:error.message});}
      writeFileSync(report,JSON.stringify({version:VERSION,apply,rows},null,2),{mode:0o600});
    }
    cursor=batch.docs.at(-1);if(batch.size<100)break;
  }while(true);
  writeFileSync(report,JSON.stringify({version:VERSION,apply,rows},null,2),{mode:0o600});
  const summary={};for(const row of rows)summary[row.status]=(summary[row.status]||0)+1;
  console.log(JSON.stringify({apply,summary}));
  if(rows.some(r=>r.status==='error'||r.status==='skipped'&&!['already-current','no-active-subscription','not-authorized'].includes(r.reason)))process.exitCode=2;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>admin.apps.length?admin.app().delete():null);
