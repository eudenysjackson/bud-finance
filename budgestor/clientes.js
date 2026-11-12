const stages = { lead: 'Interessado', quote: 'Em cotação', customer: 'Cliente', inactive: 'Inativo' };
const plans = { free: 'Gratuito', trial: 'Trial', starter: 'Starter', pro: 'Pro', plus: 'Plus' };
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' });
const formatDate = value => value ? dateFormat.format(new Date(value)) : 'Data indisponível';
const normalized = value => (value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function setupClients(request) {
  const select = id => document.getElementById(id);
  const rows = select('client-rows');
  const search = select('client-search');
  const source = select('client-source');
  const stage = select('client-stage');
  const plan = select('client-plan');
  const status = select('clients-status');
  const more = select('clients-more');
  const dialog = select('client-dialog');
  const title = select('client-dialog-title');
  const dialogStatus = select('client-dialog-status');
  const detail = select('finance-detail');
  const form = select('client-form');
  const add = select('add-client');
  const clients = new Map();
  let next = {};
  let session = 0;
  let revision = 0;
  let editing = null;

  function render() {
    const all = [...clients.values()];
    select('count-all').textContent = all.length;
    select('count-finance').textContent = all.filter(item => item.source === 'finance').length;
    select('count-leads').textContent = all.filter(item => ['lead', 'quote'].includes(item.stage)).length;
    const term = normalized(search.value.trim());
    const matches = all.filter(item =>
      (!source.value || item.source === source.value) &&
      (!stage.value || item.stage === stage.value) &&
      (!plan.value || item.plan === plan.value) &&
      (!term || normalized([item.name, item.company, item.email, item.phone].join(' ')).includes(term))
    ).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const fragment = document.createDocumentFragment();
    for (const item of matches) {
      const row = document.createElement('tr');
      const identity = row.insertCell();
      const name = document.createElement('strong');
      name.textContent = item.name || 'Sem nome';
      const contact = document.createElement('small');
      contact.textContent = item.email || item.phone || item.company || 'Contato indisponível';
      identity.append(name, contact);
      row.insertCell().textContent = item.source === 'finance' || item.product === 'finance' ? 'Bud Finance' : 'A definir';
      row.insertCell().textContent = plans[item.plan] || '—';
      row.insertCell().textContent = stages[item.stage] || '—';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'desk-secondary';
      button.textContent = 'Abrir';
      button.setAttribute('aria-label', 'Abrir ficha de ' + name.textContent);
      button.addEventListener('click', () => openClient(item));
      row.insertCell().append(button);
      fragment.append(row);
    }
    rows.replaceChildren(fragment);
    more.hidden = !Object.values(next).some(value => value !== null);
    status.textContent = matches.length ? `${matches.length} de ${all.length} registros carregados` : 'Nenhum registro corresponde aos filtros.';
  }

  async function load() {
    const current = session;
    more.disabled = true;
    status.textContent = 'Carregando clientes…';
    try {
      const pages = await Promise.all(Object.entries(next).filter(([, cursor]) => cursor !== null).map(async ([kind, cursor]) => {
        const params = new URLSearchParams({ source: kind });
        if (cursor) params.set('cursor', cursor);
        return [kind, await request('clients?' + params)];
      }));
      if (current !== session) return;
      for (const [kind, page] of pages) {
        next[kind] = page.next;
        for (const item of page.clients) clients.set(kind + ':' + item.id, item);
      }
      render();
    } catch (error) {
      if (current !== session) return;
      status.textContent = error.message;
      more.hidden = false;
    } finally {
      if (current === session) more.disabled = false;
    }
  }

  function financeDetail(item) {
    const facts = document.createElement('dl');
    for (const [label, value] of [
      ['E-mail', item.email], ['Telefone', item.phone], ['Cadastro', formatDate(item.createdAt)],
      ['Plano ativo', plans[item.plan]], ['Etapa', stages[item.stage]],
      ['Assinatura', ({ authorized: 'Ativa', active: 'Ativa', pending: 'Pendente', past_due: 'Em atraso', cancelled: 'Cancelada', paused: 'Pausada' })[item.subscription]],
      ['Próximo plano', item.scheduledPlan && plans[item.scheduledPlan] + ' · ' + formatDate(item.scheduledAt)]
    ]) {
      if (!value) continue;
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      facts.append(term, description);
    }
    const heading = document.createElement('h3');
    heading.textContent = 'Histórico de planos';
    const timeline = document.createElement(item.history.length ? 'ol' : 'p');
    if (!item.history.length) timeline.textContent = 'Ainda não há alterações de plano registradas.';
    for (const event of item.history) {
      const li = document.createElement('li');
      const change = [plans[event.from], plans[event.to]].filter(Boolean).join(' → ');
      const reason = ({ cancelled: 'Cancelamento', paused: 'Pausa' })[event.status];
      li.textContent = [formatDate(event.at), reason, change].filter(Boolean).join(' · ');
      timeline.append(li);
    }
    detail.replaceChildren(facts, heading, timeline);
  }

  async function openClient(item) {
    const current = ++revision;
    editing = item?.source === 'manual' ? item.id : null;
    form.reset();
    title.textContent = item?.name || 'Novo cadastro';
    detail.replaceChildren();
    detail.hidden = true;
    form.hidden = Boolean(item);
    dialogStatus.textContent = item ? 'Carregando ficha…' : '';
    dialog.showModal();
    if (!item) return;
    try {
      const data = await request(`clients/${item.source}/${encodeURIComponent(item.id)}`);
      if (current !== revision || !dialog.open) return;
      if (item.source === 'finance') {
        financeDetail(data);
        detail.hidden = false;
      } else {
        for (const field of form.elements) {
          if (field.name && typeof data[field.name] === 'string') field.value = data[field.name];
        }
        form.hidden = false;
      }
      dialogStatus.textContent = '';
    } catch (error) {
      if (current === revision) dialogStatus.textContent = error.message;
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const current = revision;
    const button = event.submitter;
    const data = Object.fromEntries(new FormData(form));
    button.disabled = true;
    dialogStatus.textContent = 'Salvando cadastro…';
    try {
      const path = 'clients/manual' + (editing ? '/' + encodeURIComponent(editing) : '');
      const { id } = await request(path, { method: editing ? 'PATCH' : 'POST', data });
      if (current !== revision) return;
      clients.set('manual:' + id, { ...data, id, source: 'manual', phone: data.phone || data.whatsapp });
      dialog.close();
      render();
      status.textContent = 'Cadastro salvo. ' + status.textContent;
    } catch (error) {
      if (current === revision) dialogStatus.textContent = error.message;
    } finally { button.disabled = false; }
  });

  dialog.addEventListener('close', () => { revision++; form.reset(); detail.replaceChildren(); });
  for (const field of [search, source, stage, plan]) field.addEventListener('input', render);
  add.addEventListener('click', () => openClient());
  more.addEventListener('click', load);

  function reset() {
    session++;
    if (dialog.open) dialog.close();
    clients.clear();
    next = {};
    for (const field of [search, source, stage, plan]) field.value = '';
    rows.replaceChildren();
    status.textContent = '';
  }
  return {
    reset,
    start() {
      reset();
      next = { finance: '', manual: '' };
      load();
    }
  };
}
