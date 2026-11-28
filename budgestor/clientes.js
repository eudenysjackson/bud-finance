const stages = { lead: 'Interessado', quote: 'Em cotação', customer: 'Cliente', inactive: 'Inativo' };
const plans = { free: 'Gratuito', trial: 'Trial', starter: 'Starter', pro: 'Plus', plus: 'Pro' };
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' });
const formatDate = value => value ? dateFormat.format(new Date(value)) : 'Data indisponível';
const normalized = value => (value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function setupClients(request, syncSelects) {
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
  let scrollTimer;
  const clientScroll = () => {
    if (dialog.scrollHeight <= dialog.clientHeight) return;
    dialog.classList.add('is-scrolling');
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => dialog.classList.remove('is-scrolling'), 750);
  };
  dialog.addEventListener('scroll', clientScroll, { passive: true });
  dialog.addEventListener('pointermove', event => {
    if (event.clientX >= dialog.getBoundingClientRect().right - 16) clientScroll();
  }, { passive: true });
  const clients = new Map();
  let next = {};
  let session = 0;
  let revision = 0;
  let editing = null;

  function render() {
    const all = [...clients.values()];
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
      for (const [label, value] of [
        ['Produto', item.source === 'finance' || item.product === 'finance' ? 'Bud Finance' : 'A definir'],
        ['Plano ativo', plans[item.plan] || '—'],
        ['Etapa', stages[item.stage] || '—']
      ]) {
        const cell = row.insertCell();
        cell.dataset.label = label;
        cell.textContent = value;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'desk-secondary desk-open-client';
      button.textContent = 'Abrir';
      button.setAttribute('aria-label', 'Abrir ficha de ' + name.textContent);
      button.addEventListener('click', () => openClient(item));
      row.insertCell().append(button);
      fragment.append(row);
    }
    rows.replaceChildren(fragment);
    more.hidden = !Object.values(next).some(value => value !== null);
    status.textContent = matches.length ? `${matches.length} de ${all.length} registros carregados`
      : all.length ? 'Nenhum registro corresponde aos filtros.'
      : more.hidden ? 'Nenhum cliente cadastrado. Use Novo cadastro para começar.' : 'Nenhum registro nesta página. Carregue mais para continuar.';
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

  function financeDetail(item, id) {
    const overview = document.createElement('section');
    overview.className = 'desk-profile-section';
    const overviewTitle = document.createElement('h3');
    overviewTitle.textContent = 'Dados do cliente';
    const facts = document.createElement('dl');
    for (const [label, value] of [
      ['Nome', item.name], ['E-mail', item.email], ['Telefone', item.phone],
      ['WhatsApp', item.whatsapp || 'Não informado'], ['Cadastro', formatDate(item.createdAt)],
      ['Plano ativo', plans[item.plan]], ['Etapa', stages[item.stage]],
      ['E-mail verificado', item.support?.emailVerified === true ? 'Sim' : item.support?.emailVerified === false ? 'Pendente' : ''],
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
    overview.append(overviewTitle, facts);
    const history = document.createElement('section');
    history.className = 'desk-profile-section';
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
    const firstPayment = document.createElement('p');
    firstPayment.textContent = item.firstPaymentAt
      ? 'Primeiro pagamento registrado · ' + formatDate(item.firstPaymentAt)
      : 'Sem primeiro pagamento registrado.';
    history.append(heading, firstPayment, timeline);
    detail.replaceChildren(overview, history);
    if (!item.support) return;

    const support = document.createElement('section');
    support.className = 'desk-support desk-profile-section';
    const supportTitle = document.createElement('h3');
    supportTitle.textContent = 'Atendimento';
    const actions = document.createElement('div');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const supportPath = `clients/finance/${encodeURIComponent(id)}/support`;
    const notes = document.createElement('ul');
    const addNote = note => {
      const entry = document.createElement('li');
      entry.textContent = formatDate(note.at) + ' · ' + note.text;
      if (note.attachmentName) {
        const download = document.createElement('button');
        download.type = 'button';
        download.className = 'desk-secondary';
        download.textContent = 'Baixar ' + note.attachmentName;
        download.addEventListener('click', async () => {
          download.disabled = true;
          try {
            const file = await request(supportPath + '/' + encodeURIComponent(note.id));
            const bytes = Uint8Array.from(atob(file.data), character => character.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = file.name;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (error) { status.textContent = error.message; }
          finally { download.disabled = false; }
        });
        entry.append(' ', download);
      }
      notes.prepend(entry);
    };
    [...item.support.notes].reverse().forEach(addNote);

    function actionButton(label, action, perform) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'desk-secondary';
      button.textContent = label;
      button.addEventListener('click', async () => {
        button.disabled = true;
        status.textContent = 'Processando…';
        try {
          const result = await perform(action, button);
          status.textContent = result;
        } catch (error) { status.textContent = error.message; }
        finally { button.disabled = false; }
      });
      actions.append(button);
    }

    const run = (action, values) => request(supportPath, { method: 'POST', data: { action, ...values } });
    const send = label => async action => {
      if (!window.confirm(label + ' para o endereço cadastrado deste cliente?')) return '';
      await run(action);
      return 'Solicitação de envio aceita.';
    };
    if (item.support.canEmail && !item.support.emailVerified) {
      actionButton('Reenviar verificação', 'verify-email', send('Reenviar verificação'));
    }
    if (item.support.canEmail) actionButton('Enviar recuperação', 'reset-password', send('Enviar recuperação'));
    if (item.support.hasSubscription) actionButton('Consultar Mercado Pago', 'subscription', async action => {
      const result = await run(action);
      const state = ({ authorized: 'Ativa', pending: 'Pendente', cancelled: 'Cancelada', paused: 'Pausada' })[result.status] || 'Situação indisponível';
      return ['Mercado Pago', state,
        result.createdAt && 'Assinatura criada em ' + formatDate(result.createdAt),
        result.nextCharge && 'Próxima cobrança ' + formatDate(result.nextCharge)
      ].filter(Boolean).join(' · ');
    });

    const label = document.createElement('label');
    label.textContent = 'Nota interna de atendimento';
    const input = document.createElement('textarea');
    input.maxLength = 2000;
    input.rows = 3;
    label.append(input);
    const fileLabel = document.createElement('label');
    fileLabel.textContent = 'Anexo opcional · PDF, PNG ou JPG de até 256 KB';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/pdf,image/png,image/jpeg';
    fileLabel.append(fileInput);
    actionButton('Salvar nota', 'note', async action => {
      const note = input.value.trim();
      if (!note) throw new Error('Escreva uma nota antes de salvar.');
      const file = fileInput.files[0];
      if (file && file.size > 262144) throw new Error('O anexo pode ter até 256 KB.');
      const attachment = file ? await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result.split(',')[1] });
        reader.onerror = () => reject(new Error('Não foi possível ler o anexo.'));
        reader.readAsDataURL(file);
      }) : undefined;
      const response = await run(action, { note, attachment });
      addNote(response.note);
      if (input.value.trim() === note) input.value = '';
      if (fileInput.files[0] === file) fileInput.value = '';
      return 'Nota salva.';
    });
    support.append(supportTitle, label, fileLabel, actions, status, notes);
    if (item.support.canApplyReferral) {
      const referralLabel = document.createElement('label');
      referralLabel.textContent = 'Código de indicação';
      const code = document.createElement('input');
      code.maxLength = 8;
      code.autocapitalize = 'characters';
      referralLabel.append(code);
      support.insertBefore(referralLabel, actions);
      actionButton('Aplicar indicação', 'referral', async (action, button) => {
        if (!/^[A-Za-z0-9]{8}$/.test(code.value.trim())) throw new Error('Informe o código de oito caracteres.');
        await run(action, { code: code.value.trim() });
        referralLabel.remove();
        button.remove();
        return 'Indicação registrada. O desconto segue as regras do Finance.';
      });
    }
    if (item.support.canManageAccess) {
      const accessLabel = document.createElement('label');
      accessLabel.textContent = 'Motivo da alteração de acesso';
      const reason = document.createElement('input');
      reason.maxLength = 500;
      accessLabel.append(reason);
      support.insertBefore(accessLabel, actions);
      const accessText = document.createElement('p');
      accessText.textContent = 'O bloqueio afeta o acesso. A assinatura e suas cobranças são gerenciadas separadamente.';
      support.insertBefore(accessText, actions);
      const labelFor = blocked => blocked ? 'Desbloquear acesso' : 'Bloquear acesso';
      actionButton(labelFor(item.support.accessBlocked), 'access', async (_, button) => {
        if (reason.value.trim().length < 5) throw new Error('Informe um motivo de pelo menos cinco caracteres.');
        const action = item.support.accessBlocked ? 'unblock' : 'block';
        if (!window.confirm(labelFor(item.support.accessBlocked) + ' deste cliente?')) return '';
        const result = await run(action, { reason: reason.value.trim() });
        item.support.accessBlocked = result.blocked;
        addNote(result.note);
        reason.value = '';
        button.textContent = labelFor(result.blocked);
        return result.blocked ? 'Acesso bloqueado.' : 'Acesso desbloqueado.';
      });
    }
    detail.append(support);
  }

  async function openClient(item) {
    const current = ++revision;
    editing = item?.source === 'manual' ? item.id : null;
    form.reset();
    syncSelects();
    dialog.classList.toggle('desk-dialog-wide', item?.source !== 'finance');
    dialog.classList.toggle('desk-dialog-finance', item?.source === 'finance');
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
        financeDetail(data, item.id);
        detail.hidden = false;
      } else {
        for (const field of form.elements) {
          if (field.name && typeof data[field.name] === 'string') field.value = data[field.name];
        }
        syncSelects();
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

  dialog.addEventListener('close', () => {
    revision++;
    clearTimeout(scrollTimer);
    dialog.classList.remove('is-scrolling');
    form.reset();
    detail.replaceChildren();
  });
  for (const field of [search, source, stage, plan]) field.addEventListener('input', render);
  add.addEventListener('click', () => openClient());
  more.addEventListener('click', load);

  function reset() {
    session++;
    if (dialog.open) dialog.close();
    clients.clear();
    next = {};
    for (const field of [search, source, stage, plan]) field.value = '';
    syncSelects();
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
