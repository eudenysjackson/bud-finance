const labels = {
  draft: "Rascunho",
  queued: "Agendada",
  sending: "Enviando",
  paused: "Pausada",
  cancelled: "Cancelada",
  completed: "Concluída",
  attention: "Conferir envios",
};
const states = {
  pending: "Aguardando",
  sending: "Em processamento",
  sent: "Aceito pelo provedor",
  unknown: "Sem confirmação",
  failed: "Recusado",
  skipped: "Não enviado",
};
const date = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(value))
    : "—";
export function setupMarketing(request, syncSelects) {
  const desk = document.getElementById("gestor-desk"),
    content = desk.querySelector(".desk-content");
  const clients = [...content.children];
  const nav = desk.querySelector(".desk-nav"),
    clientLink = nav.querySelector("a");
  const link = document.createElement("a");
  link.href = "#marketing";
  link.innerHTML =
    '<span class="desk-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 6 9 7 9-7"/></svg></span>Marketing';
  nav.append(link);
  const root = document.createElement("section");
  root.className = "mk";
  root.hidden = true;
  root.innerHTML = `
 <header class="mk-heading"><div><p class="mk-eyebrow">RELACIONAMENTO COM CLIENTES</p><h1>E-mail marketing</h1><p>Uma boa mensagem, para o público certo.</p></div><button id="mk-new" class="desk-primary">＋ Nova campanha</button></header>
 <p id="mk-notice" class="mk-notice" role="status"></p><p id="mk-feedback" class="desk-status" role="status" aria-live="polite"></p>
 <div id="mk-home"><div class="mk-stats" id="mk-stats"></div><div class="mk-list-head"><h2>Suas campanhas</h2><button id="mk-refresh" class="desk-secondary">Atualizar</button></div><div id="mk-list" class="mk-list"></div></div>
 <section id="mk-editor" hidden><div class="mk-toolbar"><button id="mk-back" class="desk-secondary">← Campanhas</button><span id="mk-state" class="mk-badge"></span><button id="mk-copy" class="desk-secondary">Duplicar</button></div>
 <div class="mk-workspace"><form id="mk-form" class="mk-panel"><h2>Conteúdo da campanha</h2><label>Nome interno<input name="name" maxlength="100" required placeholder="Ex.: Novos preços do Finance"></label><label>Assunto do e-mail<input name="subject" maxlength="140" required placeholder="O que o cliente verá na caixa de entrada"></label>
 <div class="mk-two"><label>Modelo<select name="template"><option value="plans">Apresentação dos planos</option><option value="news">Novidades do aplicativo</option></select></label><label>Aplicativo<input value="Bud Finance" readonly></label></div>
 <label>Título principal<input name="title" maxlength="140" required></label><label>Mensagem<textarea name="body" rows="5" maxlength="3000" required></textarea></label><label id="mk-button-label">Texto do botão<input name="button" maxlength="60" value="Conheça o Bud Finance"></label><label class="mk-check"><input name="buddy" type="checkbox" checked> Incluir o Buddy</label>
 <h2>Quem vai receber</h2><div class="mk-two"><label>Plano atual<select name="plan"><option value="free">Gratuito</option><option value="trial">Teste Pro ativo</option><option value="starter">Starter</option><option value="pro">Plus</option><option value="plus">Pro</option><option value="all">Todos os planos</option></select></label><label>Sem usar há<select name="inactiveDays"><option value="0">Qualquer período</option><option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option><option value="60">60 dias</option><option value="90">90 dias</option></select></label></div><label>Cadastrados a partir de (opcional)<input name="registeredAfter" type="date"></label><p class="mk-help">Descadastros e contas bloqueadas são excluídos. O plano será conferido novamente antes de enviar. O filtro de inatividade considera apenas cadastros com data de acesso registrada.</p>
 <button class="desk-primary" type="submit">Salvar rascunho</button></form>
 <div class="mk-panel mk-preview"><div class="mk-list-head"><h2>Prévia</h2><div><button id="mk-desktop" class="desk-secondary">Computador</button> <button id="mk-mobile" class="desk-secondary">Celular</button></div></div><div class="mk-frame-wrap"><iframe id="mk-frame" title="Prévia do e-mail" sandbox="" referrerpolicy="no-referrer"></iframe></div><div class="mk-actions"><button id="mk-preview" class="desk-secondary">Atualizar prévia e público</button><button id="mk-test" class="desk-secondary">Enviar teste para mim</button><button id="mk-schedule" class="desk-primary">Revisar envio</button></div><p id="mk-tested" class="mk-help"></p><div id="mk-audience" class="mk-audience"></div></div></div>
 <section class="mk-panel mk-history"><div class="mk-list-head"><h2>Histórico de envios</h2><div id="mk-controls"></div></div><p class="mk-help">Aceito pelo provedor não confirma entrega ou leitura. Pausar ou cancelar interrompe os próximos envios; mensagens já em processamento podem terminar.</p><div id="mk-history"></div></section></section>
 <dialog id="mk-confirm" class="mk-confirm"><h2>Confirmar campanha</h2><p id="mk-confirm-summary"></p><label>Quando enviar<select id="mk-when"><option value="now">Enviar agora</option><option value="schedule">Agendar data e horário</option></select></label><label id="mk-date-label" hidden>Data e hora de Brasília<input id="mk-date" type="datetime-local"></label><label class="mk-check"><input id="mk-authorize" type="checkbox"> Revisei o teste, o conteúdo e o público. Autorizo este envio.</label><p id="mk-confirm-status" role="status"></p><div class="mk-actions"><button id="mk-close" class="desk-secondary">Voltar</button><button id="mk-confirm-send" class="desk-primary">Confirmar envio</button></div></dialog>`;
  content.append(root);
  syncSelects();
  const $ = (id) => root.querySelector("#mk-" + id),
    form = $("form"),
    field = (name) => form.elements.namedItem(name);
  let active = null,
    dirty = false,
    preview = null,
    busy = false,
    enabled = false,
    simulated = false,
    epoch = 0;
  const say = (message, error = false) => {
    $("feedback").textContent = message;
    $("feedback").dataset.error = String(error);
  };
  const run = async (fn) => {
    if (busy) return;
    busy = true;
    root.setAttribute("aria-busy", "true");
    try {
      await fn();
    } catch (e) {
      say(e.message, true);
    } finally {
      busy = false;
      root.removeAttribute("aria-busy");
    }
  };
  function selectArea(marketing) {
    clients.forEach((n) => (n.hidden = marketing));
    root.hidden = !marketing;
    clientLink.toggleAttribute("aria-current", !marketing);
    link.toggleAttribute("aria-current", marketing);
    if (marketing) run(refresh);
  }
  link.addEventListener("click", (e) => {
    e.preventDefault();
    selectArea(true);
  });
  clientLink.addEventListener("click", (e) => {
    e.preventDefault();
    selectArea(false);
  });
  function values() {
    return {
      name: field("name").value,
      subject: field("subject").value,
      title: field("title").value,
      body: field("body").value,
      button: field("button").value,
      template: field("template").value,
      buddy: field("buddy").checked,
      segment: {
        plan: field("plan").value,
        inactiveDays: Number(field("inactiveDays").value),
        registeredAfter: field("registeredAfter").value,
      },
      revision: active?.revision,
    };
  }
  async function refresh() {
    const version = epoch,
      result = await request("marketing");
    if (version !== epoch) return;
    enabled = result.enabled;
    simulated = result.simulated;
    $("notice").textContent = simulated
      ? "Ambiente local de demonstração: nenhum e-mail real será enviado."
      : enabled
        ? "Envio configurado. Teste o conteúdo antes de confirmar uma campanha."
        : "Rascunhos e prévias disponíveis. O envio depende da configuração do template de marketing no servidor.";
    const items = result.campaigns;
    $("stats").replaceChildren();
    for (const [label, value] of [
      ["Campanhas recentes", items.length],
      ["Rascunhos", items.filter((c) => c.status === "draft").length],
      [
        "Agendadas",
        items.filter((c) => c.status === "queued" || c.status === "paused")
          .length,
      ],
      ["Concluídas", items.filter((c) => c.status === "completed").length],
    ]) {
      const card = document.createElement("div");
      card.className = "mk-stat";
      const small = document.createElement("span"),
        number = document.createElement("strong");
      small.textContent = label;
      number.textContent = value;
      card.append(small, number);
      $("stats").append(card);
    }
    $("list").replaceChildren();
    if (!items.length) {
      const p = document.createElement("p");
      p.className = "mk-empty";
      p.textContent =
        "Sua próxima conversa com os clientes começa aqui. Crie uma campanha e receba o teste antes de enviar.";
      $("list").append(p);
    }
    for (const item of items) {
      const card = document.createElement("article");
      card.className = "mk-campaign";
      const text = document.createElement("div"),
        title = document.createElement("h3"),
        subject = document.createElement("p"),
        tag = document.createElement("span"),
        open = document.createElement("button");
      title.textContent = item.draft.name;
      subject.textContent = item.draft.subject;
      tag.className = "mk-badge";
      tag.textContent =
        (labels[item.status] || item.status) +
        (item.scheduledAt ? " · " + date(item.scheduledAt) : "");
      open.className = "desk-secondary";
      open.textContent = "Abrir campanha";
      open.onclick = () => run(() => openCampaign(item.id));
      text.append(tag, title, subject);
      card.append(text, open);
      $("list").append(card);
    }
  }
  function fill(c) {
    active = c;
    dirty = false;
    preview = null;
    const d = c.draft;
    for (const name of [
      "name",
      "subject",
      "title",
      "body",
      "button",
      "template",
    ])
      field(name).value = d[name] || "";
    field("buddy").checked = d.buddy;
    for (const name of ["plan", "inactiveDays", "registeredAfter"])
      field(name).value = d.segment[name] ?? "";
    const locked = c.status !== "draft";
    [...form.elements].forEach((el) => (el.disabled = locked));
    $("test").disabled = locked || !enabled;
    $("schedule").disabled = locked || !enabled;
    $("state").textContent = labels[c.status] || c.status;
    $("home").hidden = true;
    $("editor").hidden = false;
    $("tested").textContent = c.testedAt
      ? "Último teste aceito: " +
        date(c.testedAt) +
        (simulated ? " (simulado)" : "")
      : "Envie um teste desta versão antes de confirmar o envio.";
    syncSelects();
    history(c);
  }
  async function openCampaign(id) {
    const version = epoch,
      c = await request("marketing/" + id);
    if (version !== epoch) return;
    fill(c);
    await showPreview();
  }
  async function save() {
    if (!form.reportValidity()) throw Error("Confira os campos obrigatórios.");
    if (active?.status !== "draft") return;
    const result = await request(
      "marketing" + (active?.id ? "/" + active.id : ""),
      { method: active?.id ? "PUT" : "POST", data: values() },
    );
    active = { id: result.id, ...result.campaign };
    dirty = false;
    preview = null;
    $("tested").textContent =
      "Rascunho salvo. Envie um teste antes de confirmar.";
    say("Rascunho salvo.");
  }
  async function ensureSaved() {
    if (!active?.id || dirty) await save();
  }
  async function showPreview() {
    const version = epoch;
    await ensureSaved();
    if (version !== epoch) return;
    const p = await request("marketing/" + active.id + "/preview");
    if (version !== epoch) return;
    preview = p;
    $("frame").srcdoc = p.html;
    $("audience").replaceChildren();
    const count = document.createElement("strong");
    count.textContent = p.count + " destinatário(s) elegível(is)";
    const help = document.createElement("p");
    help.className = "mk-help";
    help.textContent =
      "O público será fixado ao confirmar. Quem mudar de plano ou pedir descadastro será excluído antes do envio.";
    $("audience").append(count, help);
    for (const person of p.sample) {
      const row = document.createElement("p");
      row.textContent = (person.name || "Cliente") + " · " + person.email;
      $("audience").append(row);
    }
  }
  function history(c) {
    $("history").replaceChildren();
    const rows = c.recipients || [];
    if (!rows.length) {
      $("history").textContent = "Nenhum envio iniciado nesta campanha.";
    }
    for (const r of rows) {
      const row = document.createElement("div");
      row.className = "mk-recipient";
      const who = document.createElement("span"),
        status = document.createElement("strong");
      who.textContent = r.email;
      status.textContent =
        (states[r.state] || r.state) + (r.reason ? " · " + r.reason : "");
      row.append(who, status);
      $("history").append(row);
    }
    $("controls").replaceChildren();
    for (const [action, label, allowed] of [
      ["pause", "Pausar", ["queued", "sending"]],
      ["resume", "Retomar", ["paused"]],
      ["cancel", "Cancelar próximos envios", ["queued", "sending", "paused"]],
    ]) {
      if (!allowed.includes(c.status)) continue;
      const b = document.createElement("button");
      b.className = "desk-secondary";
      b.textContent = label;
      b.onclick = () =>
        run(async () => {
          await request("marketing/" + active.id + "/control", {
            method: "POST",
            data: { action },
          });
          await openCampaign(active.id);
        });
      $("controls").append(b);
    }
    if (rows.length) {
      const b = document.createElement("button");
      b.className = "desk-secondary";
      b.textContent = "Atualizar histórico";
      b.onclick = () => run(() => openCampaign(active.id));
      $("controls").append(b);
    }
  }
  form.addEventListener("input", () => {
    dirty = true;
    preview = null;
  });
  form.addEventListener("change", () => {
    dirty = true;
    preview = null;
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    run(save);
  };
  $("new").onclick = () => {
    fill({
      status: "draft",
      draft: {
        name: "Nova campanha",
        subject: "Assine o Bud Finance e organize seu dinheiro",
        title: "Mais organização para o seu dinheiro",
        body: "Organize suas contas, cartões e benefícios em um só lugar. Conheça os planos do Bud Finance e escolha o que acompanha sua rotina.",
        button: "Conheça o Bud Finance",
        template: "plans",
        buddy: true,
        segment: { plan: "free", inactiveDays: 0, registeredAfter: "" },
      },
    });
    dirty = true;
    $("frame").srcdoc = "";
    $("audience").textContent =
      "Salve e atualize a prévia para conferir o público.";
  };
  $("copy").onclick = () =>
    run(async () => {
      const d = values();
      d.name += " — cópia";
      const r = await request("marketing", { method: "POST", data: d });
      await openCampaign(r.id);
    });
  $("refresh").onclick = () => run(refresh);
  $("back").onclick = () =>
    run(async () => {
      $("editor").hidden = true;
      $("home").hidden = false;
      active = null;
      await refresh();
    });
  $("preview").onclick = () => run(showPreview);
  $("desktop").onclick = () => {
    $("frame").style.width = "100%";
  };
  $("mobile").onclick = () => {
    $("frame").style.width = "375px";
  };
  $("test").onclick = () =>
    run(async () => {
      await ensureSaved();
      await request("marketing/" + active.id + "/test", {
        method: "POST",
        data: {},
      });
      const c = await request("marketing/" + active.id);
      active = c;
      $("tested").textContent = simulated
        ? "Teste simulado com sucesso. Nenhum e-mail real enviado."
        : "Teste enviado para o e-mail da sua conta administrativa.";
      say($("tested").textContent);
    });
  $("schedule").onclick = () =>
    run(async () => {
      await showPreview();
      const c = await request("marketing/" + active.id);
      if (c.testedDigest !== preview.digest)
        throw Error("Envie um teste desta versão antes de confirmar.");
      $("confirm-summary").textContent =
        c.draft.subject + " · " + preview.count + " destinatário(s).";
      $("authorize").checked = false;
      $("confirm-status").textContent = "";
      $("confirm").showModal();
      syncSelects();
    });
  $("when").onchange = () => {
    $("date-label").hidden = $("when").value !== "schedule";
  };
  $("close").onclick = () => $("confirm").close();
  $("confirm-send").onclick = () =>
    run(async () => {
      try {
        if (!$("authorize").checked)
          throw Error("Confirme que revisou o teste e o público.");
        let scheduledAt;
        if ($("when").value === "schedule") {
          if (!$("date").value) throw Error("Informe a data e o horário.");
          scheduledAt = new Date($("date").value + "-03:00").toISOString();
        }
        await request("marketing/" + active.id + "/queue", {
          method: "POST",
          data: {
            revision: active.revision,
            audienceToken: preview.audienceToken,
            scheduledAt,
            confirm: true,
          },
        });
        $("confirm").close();
        say(
          simulated
            ? "Campanha confirmada na simulação local."
            : "Campanha confirmada. Acompanhe o histórico.",
        );
        await openCampaign(active.id);
      } catch (e) {
        $("confirm-status").textContent = e.message;
      }
    });
  return {
    reset() {
      epoch++;
      active = null;
      preview = null;
      $("confirm").close();
      $("list").replaceChildren();
      $("history").replaceChildren();
      $("audience").replaceChildren();
      $("frame").srcdoc = "";
      form.reset();
      root.hidden = true;
      clients.forEach((n) => (n.hidden = false));
    },
  };
}
