const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {subscriptionNotice}=require('../appbudfinance/js/bud-notif-inapp');
const {financialNotices,subscriptionPushNotices}=require('../backend/financial-notifications');
test('in-app notices are derived only from current subscription; blue near expiry, red overdue, upgrade for free',()=>{
 const now=new Date('2026-10-31T12:00:00Z');
 assert.equal(subscriptionNotice({plano:'plus',planoExpira:'2026-11-30T12:00:00Z'},now),null);
 assert.equal(subscriptionNotice({plano:'pro',planoExpira:{seconds:now.getTime()/1000+86400}},now).color,'blue');
 assert.equal(subscriptionNotice({plano:'pro',planoExpira:'2026-10-30T12:00:00Z'},now).color,'red');
 assert.equal(subscriptionNotice({plano:'free',assinaturaStatus:'past_due'},now).color,'red');
 assert.equal(subscriptionNotice({plano:'free'},now).key,'upgrade');
 assert.equal(subscriptionNotice({plano:'trial',trialFim:'2026-11-30'},now),null);
 assert.equal(subscriptionNotice({plano:'trial',trialFim:'2026-10-30'},now).color,'red');
});
test('dashboard no longer imports old global notices or converts foreground push into in-app history',()=>{
 const s=fs.readFileSync('appbudfinance/js/dashboard.js','utf8');
 assert.equal(s.includes("collection(db, 'notificacoes-globais')"),false);
 assert.equal(s.includes('BudInAppNotif.addExternal'),false);
 const html=fs.readFileSync('appbudfinance/dashboard.html','utf8');
 for(const id of ['secDividasAtraso','bannerConfirmarReceitas','secTudoEmDia'])assert.equal(html.includes('id="'+id+'"'),false);
 assert.match(fs.readFileSync('appbudfinance/js/bud-notif-inapp.js','utf8'),/removeItem\('bud_notif_v2'\)/);
});
test('recurring reminders respect confirmations, inactive items and month rollover',()=>{
 const recorrentes=[{_id:'salary',tipo:'receita',valor:2500,diaVencimento:1,descricao:'Salário'},{_id:'paid',tipo:'despesa',diaVencimento:31,valor:100},{_id:'off',ativa:false,diaVencimento:31}];
 const transacoes=[{recorrenteId:'salary',mesReferencia:'2026-10',confirmado:true,pago:true},{recorrenteId:'paid',mesReferencia:'2026-10',confirmado:true,pago:true}];
 const notices=financialNotices({recorrentes,transacoes},'2026-10-31');
 assert.equal(notices.length,1);assert.match(notices[0].title,/previsto amanhã/);assert.match(notices[0].body,/2\.500,00/);
 const pending=financialNotices({recorrentes:[recorrentes[1]],transacoes:[{...transacoes[1],confirmado:false,pago:false,pendenteConfirmacao:true}]},'2026-11-02');
 assert.equal(pending.length,0); // dia31 ainda não venceu em novembro.
 const overdue=financialNotices({recorrentes:[{_id:'late',diaVencimento:1,valor:20}]},'2026-11-02');assert.match(overdue[0].title,/atraso/);
});
test('paid, financed, empty and fully refunded card invoices never generate payment reminders',()=>{
 const card={_id:'card',nome:'Cartão',vencimento:1},tx={cartaoId:'card',dataReferencia:'2026-11-01',valor:50};
 assert.equal(financialNotices({cartoes:[card],transacoes:[tx]},'2026-10-31').length,1);
 for(const paid of [true,{parcelada:true}])assert.equal(financialNotices({cartoes:[{...card,faturasPagas:{'2026-11':paid}}],transacoes:[tx]},'2026-10-31').length,0);
 assert.equal(financialNotices({cartoes:[card],transacoes:[]},'2026-10-31').length,0);
 assert.equal(financialNotices({cartoes:[card],transacoes:[tx,{...tx,valor:-50}]},'2026-10-31').length,0);
});
test('debt reminder uses next unpaid installment and clamps short months without skipping February',()=>{
 const debt={_id:'debt',nome:'Compra',vencimento:'2026-01-31',parcelas:3,parcelasPagas:1,valorParcela:100};
 const notices=financialNotices({dividas:[debt]},'2026-02-27');assert.equal(notices.length,1);assert.match(notices[0].body,/2\/3/);assert.match(notices[0].title,/amanhã/);
 assert.equal(financialNotices({dividas:[{...debt,parcelasPagas:3}]},'2026-02-27').length,0);
});

test('renewal notices show the exact billing date and do not claim automatic renewal without a subscription',()=>{
 const profile={plano:'pro',assinaturaStatus:'authorized',mpSubscriptionId:'fictitious',planoExpira:'2026-11-03T15:00:00Z'};
 const notice=subscriptionNotice(profile,new Date('2026-10-31T18:00:00Z'));assert.match(notice.message,/Renovação do plano Pro/);assert.match(notice.message,/Próxima cobrança: 03\/11\/2026/);
 const push=subscriptionPushNotices(profile,'2026-10-31');assert.equal(push.length,1);assert.match(push[0].body,/Próxima cobrança: 03\/11\/2026/);
 assert.equal(subscriptionPushNotices({...profile,planoExpira:'2026-12-03T15:00:00Z'},'2026-10-31').length,0);
 assert.equal(subscriptionPushNotices({...profile,assinaturaStatus:'cancelled'},'2026-10-31').length,0);
 assert.match(subscriptionPushNotices({...profile,mpSubscriptionId:null},'2026-10-31')[0].title,/Vencimento/);
 assert.match(subscriptionPushNotices({...profile,planoTroca:{status:'scheduled',planKey:'plus'}},'2026-10-31')[0].title,/Plus/);
});
