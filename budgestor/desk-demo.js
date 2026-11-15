const customers = [
  { name: 'Ana Ribeiro', state: 'Gratuito', activity: 'Último lançamento há 2 dias' },
  { name: 'Bruno Mendes', state: 'Gratuito', activity: 'Sem atividade registrada' },
  { name: 'Paula Dantas', state: 'Teste ativo', activity: 'Último lançamento hoje', detail: 'Termina em 2 dias' },
  { name: 'Rafael Torres', state: 'Teste ativo', activity: 'Último lançamento ontem', detail: 'Termina amanhã' },
  { name: 'Sofia Teixeira', state: 'Teste vencido', activity: 'Última importação há 12 dias' },
  { name: 'Otávio Gomes', state: 'Assinatura ativa', activity: 'Último lançamento há 3 dias', detail: 'Starter', monthly: 9.99 },
  { name: 'Renata Dias', state: 'Assinatura ativa', activity: 'Última importação hoje', detail: 'Pro', monthly: 29.90 },
  { name: 'Tiago Rocha', state: 'Assinatura ativa', activity: 'Último lançamento ontem', detail: 'Plus', monthly: 49.90 },
  { name: 'Luana Prado', state: 'Assinatura cancelada', activity: 'Último lançamento há 34 dias' }
];

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const count = state => customers.filter(customer => customer.state === state).length;
const monthly = customers.reduce((total, customer) => total + (customer.monthly || 0), 0);
const revenue = 520;
const fees = 30;
const refunds = 20;
const paidCosts = 390;
const bills = [
  ['Hospedagem', 'Vence dia 20', 75],
  ['Envio de e-mails', 'Vence dia 24', 40]
];

export function setupDeskDemo(desk) {
  const views = [...desk.querySelectorAll('[data-desk-view]')];
  const links = [...desk.querySelectorAll('[data-desk-link]')];
  const filters = ['Todas', ...new Set(customers.map(customer => customer.state)), 'Sem atividade', 'Sem uso há 30 dias'];
  const element = (tag, value, className) => {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  };
  const byId = id => desk.querySelector('#' + id);
  const show = (area, { focus = false, filter = 'Todas' } = {}) => {
    for (const view of views) view.hidden = view.dataset.deskView !== area;
    for (const link of links) {
      if (link.dataset.deskLink === area) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (area === 'sales') renderSales(filter);
    if (focus) desk.querySelector(`[data-desk-view="${area}"] h1`)?.focus();
  };

  function renderSales(filter) {
    const visible = customers.filter(customer => {
      if (filter === 'Todas') return true;
      if (filter === 'Sem atividade') return customer.activity === 'Sem atividade registrada';
      if (filter === 'Sem uso há 30 dias') return /há (3[0-9]|[4-9][0-9]) dias/.test(customer.activity);
      return customer.state === filter;
    });
    byId('sales-list').replaceChildren(...visible.map(customer =>
      row(customer.name, customer.activity, customer.detail ? customer.state + ' · ' + customer.detail : customer.state)));
    byId('sales-count').textContent = visible.length === 1 ? '1 cliente de demonstração' : visible.length + ' clientes de demonstração';
    for (const button of byId('sales-filters').children) button.setAttribute('aria-pressed', String(button.textContent === filter));
  }

  function row(title, subtitle, value) {
    const item = element('div', '', 'desk-dashboard-row');
    const label = element('div', '');
    label.append(element('strong', title), element('small', subtitle));
    item.append(label, element('span', value, 'desk-dashboard-value'));
    return item;
  }

  function metric(label, value, area, filter) {
    const card = element(area ? 'button' : 'div', '', 'desk-metric');
    if (area) {
      card.type = 'button';
      card.addEventListener('click', () => show(area, { filter, focus: true }));
    }
    card.append(element('span', label), element('strong', String(value)));
    return card;
  }

  byId('overview-metrics').append(
    metric('Novos cadastros · últimos 7 dias', 4),
    metric('Testes ativos', count('Teste ativo'), 'sales', 'Teste ativo'),
    metric('Assinaturas ativas', count('Assinatura ativa'), 'sales', 'Assinatura ativa'),
    metric('Receita líquida recebida · mês', money.format(revenue - fees - refunds), 'finance')
  );
  byId('overview-attention').append(
    row('Testes perto de vencer', 'Oportunidades para acompanhamento', '2 clientes'),
    row('Contas da empresa a vencer', 'Hospedagem e envio de e-mails', money.format(bills.reduce((total, bill) => total + bill[2], 0)))
  );
  byId('sales-metrics').append(
    metric('Receita mensal recorrente estimada', money.format(monthly)),
    metric('Testes vencidos', count('Teste vencido')),
    metric('No Gratuito', count('Gratuito'))
  );
  for (const filter of filters) {
    const button = element('button', filter, 'desk-secondary');
    button.type = 'button';
    button.addEventListener('click', () => renderSales(filter));
    byId('sales-filters').append(button);
  }
  byId('finance-metrics').append(
    metric('Receita bruta confirmada', money.format(revenue)),
    metric('Receita líquida recebida', money.format(revenue - fees - refunds)),
    metric('Resultado após despesas pagas', money.format(revenue - fees - refunds - paidCosts))
  );
  byId('finance-list').append(
    row('Assinaturas do Bud Finance', 'Recebimentos confirmados', money.format(revenue)),
    row('Taxas do Mercado Pago', 'Descontadas dos recebimentos', money.format(-fees)),
    row('Estornos', 'Devoluções no mês', money.format(-refunds)),
    row('Despesas pagas', 'Custos operacionais do mês', money.format(-paidCosts)),
    ...bills.map(([name, due, amount]) => row(name, due, money.format(amount)))
  );

  for (const link of links) {
    link.hidden = false;
    link.addEventListener('click', event => {
      event.preventDefault();
      show(link.dataset.deskLink, { focus: true });
    });
  }
  return { show };
}
