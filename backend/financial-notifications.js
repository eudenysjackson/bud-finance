// Regras determinísticas: não dependem do Buddy nem fazem lançamentos financeiros.
const iso = value => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0,10);
  const d = typeof value.toDate === 'function' ? value.toDate() : new Date(value.seconds != null ? value.seconds * 1000 : value);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d) : '';
};
const money = value => Number(value || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function monthDate(month, day) {
  const [year,m] = month.split('-').map(Number), last = new Date(Date.UTC(year,m,0)).getUTCDate();
  return month+'-'+String(Math.min(Math.max(1,Number(day)||1),last)).padStart(2,'0');
}
function financialNotices({recorrentes=[],cartoes=[],dividas=[],transacoes=[]}, today) {
  const tomorrow = new Date(today+'T12:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  const next = tomorrow.toISOString().slice(0,10), month=today.slice(0,7), notices=[];
  const activeTx = transacoes.filter(t=>!['cancelado','estornado'].includes(t.status));
  function add(kind,id,due,label,value,url,receipt=false) {
    if (!due || due>next) return;
    const when=due===next?'amanhã':due===today?'hoje':'em atraso';
    notices.push({tag:[kind,id,due,today].join('-'),title:receipt?(due<today?'Recebimento a confirmar':'Recebimento previsto '+when):(due<today?'Pagamento em atraso': 'Pagamento '+when),body:label+(value!=null?' — '+money(value):'')+(due<today?' · previsto para '+due.split('-').reverse().join('/'):'')+(receipt?' · confirme quando receber.':' · já pagou? Confirme no app.'),url,emoji:receipt?'💰':'🔔'});
  }
  for (const rec of recorrentes) {
    if (rec.ativa===false) continue;
    const id=rec._id||rec.id, frequency=rec.periodicidade||'mensal';
    let due=frequency==='mensal'?monthDate(month,rec.diaVencimento):iso(rec.proximaData);
    if (frequency==='mensal' && due<today && month!==next.slice(0,7)) {
      const nextDue=monthDate(next.slice(0,7),rec.diaVencimento);
      const paid=activeTx.some(t=>t.recorrenteId===id && String(t.mesReferencia||iso(t.dataReferencia||t.data)).slice(0,7)===month && t.confirmado!==false && t.pago!==false && !t.pendenteConfirmacao);
      if (paid) due=nextDue;
    }
    if (iso(rec.criadoEm||rec.dataCriacao)>due) continue;
    const paid=activeTx.some(t=>{
      const day=iso(t.dataReferencia||t.data), samePeriod=frequency==='mensal'?String(t.mesReferencia||day).slice(0,7)===due.slice(0,7):day===due;
      const linked=t.recorrenteId===id || (!t.recorrenteId && t.origem==='recorrente' && t.tipo===rec.tipo && String(t.descricao||'').trim().toLowerCase()===String(rec.descricao||'').trim().toLowerCase());
      return linked&&samePeriod&&t.confirmado!==false&&t.pago!==false&&!t.pendenteConfirmacao;
    });
    if (!paid) add('rec',id,due,rec.descricao||'Recorrência',rec.valorPrevisto||rec.valor,'recorrentes.html',rec.tipo==='receita');
  }
  for (const card of cartoes) {
    const id=card._id||card.id, amounts=new Map();
    for (const tx of activeTx) {
      if (tx.cartaoId!==id || tx.pagamentoFatura) continue;
      const reference=iso(tx.dataReferencia);if (!reference) continue;
      const key=reference.slice(0,7);amounts.set(key,(amounts.get(key)||0)+Number(tx.valor||0));
    }
    for (const [period,amount] of amounts) {
      if (amount<=0 || card.faturasPagas?.[period]) continue;
      add('fatura',id,monthDate(period,card.diaVencimento||card.vencimento),'Fatura '+(card.nome||'do cartão'),amount,'cartoes.html');
    }
  }
  for (const debt of dividas) {
    const paid=Number(debt.parcelasPagas||0),total=Number(debt.parcelas||1),base=iso(debt.vencimento);
    if (!base || paid>=total || ['quitada','cancelada'].includes(debt.status)) continue;
    const start=new Date(base+'T12:00:00Z'),target=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+paid,1));
    const period=target.toISOString().slice(0,7),due=monthDate(period,start.getUTCDate());
    add('divida',debt._id||debt.id,due,(debt.nome||debt.instituicao||'Dívida')+' · parcela '+(paid+1)+'/'+total,Number(debt.valorParcela)||Number(debt.valorTotal||0)/total,'dividas.html');
  }
  return notices;
}
function subscriptionPushNotices(profile, today) {
  const status=String(profile.assinaturaStatus||'').toLowerCase(),plan=String(profile.plano||'free').toLowerCase();
  if (['cancelled','canceled','paused'].includes(status)) return [];
  const due=iso(plan==='trial'?profile.trialFim:profile.planoExpira||profile.assinaturaExpira);
  if (!due) return [];
  const days=Math.round((new Date(due+'T12:00:00Z')-new Date(today+'T12:00:00Z'))/86400000);
  const formatted=due.split('-').reverse().join('/'),paid=['starter','pro','plus'].includes(plan);
  if((days<0&&paid)||(status==='past_due'&&days<=0)) return [{tag:'subscription-overdue-'+due+'-'+today,title:'Pagamento da assinatura pendente',body:'Vencimento: '+formatted+'. Confira o pagamento do seu plano no Bud Finance.',url:'configuracoes.html',emoji:'⚠️'}];
  if(![3,1,0].includes(days)||(!paid&&plan!=='trial')) return [];
  const nextPlan=profile.planoTroca?.status==='scheduled'?profile.planoTroca.planKey:plan;
  const label={starter:'Starter',pro:'Pro',plus:'Plus',trial:'de testes'}[nextPlan]||nextPlan;
  const automatic=paid&&profile.mpSubscriptionId&&status==='authorized';
  return [{tag:'subscription-due-'+due+'-'+today,title:automatic?'Renovação do plano '+label: 'Vencimento do plano '+label,body:automatic?'Próxima cobrança: '+formatted+'. Sua assinatura será renovada nessa data.':'Seu plano vence em '+formatted+'. Confira as opções para continuar.',url:'configuracoes.html',emoji:'🔔'}];
}
async function sendFinancialPush(messaging, tokens, notice, frontendUrl) {
  const targets=[...new Set(tokens.filter(token=>typeof token==='string'&&token))].slice(0,20);
  if (!targets.length) return {successCount:0,invalid:[]};
  const response=await messaging.sendEachForMulticast({
    tokens:targets,
    data:{title:notice.title,body:notice.body,url:notice.url||'dashboard.html',tag:notice.tag,emoji:notice.emoji||'🔔'},
    webpush:{headers:{TTL:'3600'},fcmOptions:{link:frontendUrl+'/'+(notice.url||'dashboard.html')}}
  });
  return {successCount:response.successCount,invalid:response.responses.flatMap((result,index)=>!result.success&&['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(result.error?.code)?[targets[index]]:[])};
}
module.exports={financialNotices,subscriptionPushNotices,sendFinancialPush};
