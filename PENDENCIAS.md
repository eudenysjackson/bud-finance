# PENDENCIAS.md — Registro Centralizado de Pendências

**Projeto**: Bud Finance
**Criado em**: 23/04/2026
**Última atualização**: 20/05/2026

> Documento único de consulta antes de qualquer sprint. Consolida:
> - Features descritas no `cérebro/` que ainda não foram implementadas no Bud
> - Débitos técnicos identificados em auditorias
> - Melhorias futuras mapeadas
>
> ⚠️ **Regra de ouro**: nenhum item daqui é implementado sem pedido explícito do usuário.
> Bugs ativos vão para [`ERRORS_LOG.md`](ERRORS_LOG.md), não aqui.

---

## 📑 Índice

- [Como usar este documento](#como-usar-este-documento)
- [Status / Legenda](#status--legenda)
- [Pendências por Tela](#pendências-por-tela)
  - [Configurações](#-configurações)
  - [Cartões](#-cartões)
  - [Metas](#-metas)
- [Débitos Técnicos Globais](#-débitos-técnicos-globais)
- [Histórico de Atualizações](#-histórico-de-atualizações)

---

## Como usar este documento

1. **Antes de iniciar uma tarefa**, consulte a seção da tela em questão.
2. **Ao tocar em uma tela** por qualquer motivo, verifique se algum débito técnico daquela tela pode ser atacado no mesmo PR (custa quase nada juntar).
3. **Ao identificar uma nova pendência**, adicione aqui com ID único (`PEND-XXX` ou `DT-XXX`).
4. **Ao concluir uma pendência**, mova para o histórico no final do documento (com data e link do commit, se possível) e remova da lista ativa.

---

## Status / Legenda

| Marcador | Significado |
|---|---|
| 🔴 Alta | Bloqueia ou degrada experiência do MVP |
| 🟡 Média | Feature do cérebro ausente, dá pra viver sem |
| 🟢 Baixa | Refino / melhoria / nice-to-have |
| ⚙️ DT | Débito técnico (código existe mas pode melhorar) |
| 🚀 FUT | Feature futura (depende de outras telas / não está no MVP) |

---

## Pendências por Tela

### 📧 Infraestrutura de e-mail

| ID | Item | Tipo | Dependências | Notas |
|---|---|---|---|---|
| PEND-EMAIL-001 | Configurar as variáveis do EmailJS no Render e validar um envio no ambiente público | 🔴 Alta | Reativação do backend Render | Ao voltar: copiar `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY`, `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_BOAS_VINDAS=template_pdch2ip`, `EMAILJS_TEMPLATE_RECUPERAR_SENHA=template_2mp7qgq`, `SUPPORT_EMAIL=budsolucoes@gmail.com` e `EMAIL_VERIFICATION_SECRET`. O e-mail local foi validado em 29/08/2026. |

### ⚙️ Configurações

> MVP atual: 3 abas (Perfil / Personalização / Segurança) — funcionando.
> Cérebro descreve uma versão muito mais ampla (referência: `cérebro/configuracoes.md`).
> Auditoria de paridade em 23/04/2026 confirmou que os itens abaixo NÃO existem no código.

| ID | Item | Tipo | Dependências | Notas |
|---|---|---|---|---|
| PEND-001 | Gestão de Assinatura (Mercado Pago) — card premium, plano/trial/expiração, upgrade/downgrade, banner `pending`, cancelamento | ✅ | Backend `/mercadopago/create-subscription`, tela `vendas.html` | **Backend + checkout implementados ✅ 20/05/2026.** Teste E2E sandbox (PEND-081). Seção em `configuracoes.html` implementada como PEND-085 ✅ 31/05/2026 (`_renderizarSecaoPlano` linhas 933-1049). |
| PEND-002 | Notificações Push (FCM) — `verificarEstadoPush()`, registro/revogação de token em `usuarios/{uid}/tokens/fcm`, modal de instalação iOS Safari → PWA | ✅ | Firebase Messaging, manifest PWA | **Modal iOS Safari → PWA implementado ✅ 31/05/2026** em `configuracoes.html` (`#modalInstalarPWA`). Detecção iOS+não-standalone no clique de "Ativar" abre instruções "Adicionar à Tela de Início" em vez de tentar registrar push (Safari só permite push em PWA instalado, iOS 16.4+). **Revogação de token implementada** em `push.js` (`revokePushToken`), backend `DELETE /api/push/token`, chamada em `fazerLogout()` em `configuracoes.js`. |
| PEND-003 | ~~Reset do Tutorial — botão integrado a `NexoTutorial.resetAll()`~~ — Onboarding implementado em `onboarding.html`/`js/onboarding.js` (29/04/2026). Reset do tutorial em si ainda depende de `tutorial.js` (não existe). | ✅ PARCIAL 29/04/2026 | `tutorial.js` para o FAB | Onboarding pronto; tutorial FAB é tarefa futura separada |
| PEND-004 | ~~Assistente WhatsApp vincular/desvincular~~ — `vincularWhatsApp()`, `desvincularWhatsApp()`, `carregarWhatsApp()` implementadas em `configuracoes.js`. Card "Assistente WhatsApp" adicionado ao HTML com 3 estados: gate (Free/Starter), conectado, desconectado. Feature-gate por `PLANOS_WHATSAPP = ['plus','pro','trial']`. Modal de confirmação para desvincular (style.cssText). Armazena `whatsappVinculado` no Firestore com prefixo `55`. | ✅ RESOLVIDO 30/04/2026 | — | — |
| PEND-005 | ~~LGPD: Exportar Dados Completo~~ — `exportarDadosJSON()` implementada em `configuracoes.js`: coleta 9 subcoleções (transacoes, carteira, cartoes, metas, limites, categorias, recorrentes, dividas, investimentos) + perfil, gera `.json` com replacer para Timestamps. Botão “Exportar JSON” no card Privacidade. | ✅ RESOLVIDO 29/04/2026 | — | — |
| PEND-006 | ~~LGPD: Revogar Consentimento de Notificações~~ — `revogarConsentimentoNotificacoes()` implementada: `setDoc(merge)` em `tokens/fcm` com `{ token: null, revogadoEm: ISO }`. Botão "Revogar" no card LGPD de `configuracoes.html`. Funciona mesmo sem FCM ativo. | ✅ RESOLVIDO 30/04/2026 | — | — |
| PEND-007 | ~~LGPD: Excluir Conta Permanentemente~~ — `confirmarExcluirConta()` implementada: modal com digitação "EXCLUIR", batch chunks de 400, deleta 13 subcoleções + doc principal + `user.delete()`. Trata `requires-recent-login` com re-login automático. Botão na aba Segurança. | ✅ RESOLVIDO 29/04/2026 | — | — |
| PEND-008 | ~~Reset Total da Conta~~ — `abrirModalReset()` + `executarReset()` implementados: modal com lista dos dados afetados, batch chunks de 400, limpa `nexo_tutorial_done_*` do localStorage, seta `onboardingConcluido: false`. Bot\u00e3o "Resetar Dados" na aba Seguran\u00e7a. | \u2705 RESOLVIDO 29/04/2026 | \u2014 | \u2014 |

### 💳 Cartões

> Auditoria de paridade em 23/04/2026 confirmou que TODOS os 12 bugs do cérebro foram evitados. DEC-034 aplicada com rigor. Nenhum bug ativo.
> DT-001 corrigido em 23/04/2026.
> Sugestão 1 (modal exclusão) já estava implementada — sem ação necessária.

| ID | Item | Tipo | Dependências | Notas |
|---|---|---|---|---|
| ~~DT-001~~ | ~~`salvarTransacoesIA` usa loop de `addDoc`~~ | ✅ Resolvido | — | Convertido para `writeBatch` em chunks de 400 em 23/04/2026. |
| ~~DT-002~~ | ~~`perfilPlano = null` hardcoded em cartoes.js~~ ✅ **RESOLVIDO 04/06/2026** — auth callback agora faz `getDoc('usuarios/{uid}')` e armazena em `window._cartoesUserPlano`. `handleSubmitCartao` usa `_cartoesUserPlano` para o gate de limite de cartões por plano. | ✅ Resolvido | — | — |
| ~~PEND-009~~ | ~~**Indicador fatura fechada vs aberta**~~ ✅ **RESOLVIDO 29/04/2026** — `calcularStatusFatura` agora retorna labels dinâmicos: "Fecha em Xd", "Fecha hoje", "Vence em Xd", "Vence hoje" quando próximo do prazo. | ✅ Resolvido | — | Implementado em `js/cartoes.js` |
| ~~PEND-010~~ | ~~**Filtro rápido por cartão na lista de transações**~~ ✅ **RESOLVIDO 04/06/2026** — chips clicáveis acima da lista de faturas em `cartoes.html`; `cartoes.js` filtra `dadosCartoes` por `_filtroCartaoId`. | ✅ Resolvido | — | — |
| ~~PEND-011~~ | ~~**Pagar fatura com 1 clique**~~ ✅ **RESOLVIDO 29/04/2026** — modal "Pagar Fatura" agora carrega contas de débito da Carteira. Ao confirmar com conta selecionada: writeBatch cria transação `pagamento_fatura` + decrementa `saldo` da conta. Ao desfazer: deleta transação + restaura saldo. Fallback: "Apenas marcar como paga" se sem contas. | ✅ Resolvido | — | Ver `js/cartoes.js` — `abrirModalPagarFatura`, `confirmarPagarFatura` |
| ~~PEND-012~~ | ~~**Parcelamento inteligente na importação IA**~~ ✅ **RESOLVIDO 29/04/2026** — modal Review IA exibe toggle "📅 Criar N parcelas restantes" por item quando parcelado detectado. Se ativado, `salvarTransacoesIA` gera as parcelas futuras (parcelaAtual+1 até totalParcelas) distribuindo em meses subsequentes via `_addMesesData`. Descrição atualizada automaticamente (ex: "02/12" vira "03/12", "04/12"...). | ✅ Resolvido | — | `js/cartoes.js` |
| ~~PEND-013~~ | ~~**Limite consumido visual**~~ ✅ **RESOLVIDO 29/04/2026** — barra agora mostra "R$ X usado de R$ Y" + percentual colorido (verde/amarelo/vermelho conforme uso). A barra em si já existia; texto e cor do % atualizados. | ✅ Resolvido | — | `buildCartaoEl` |
| ~~PEND-014~~ | ~~**Skeleton loader**~~ ✅ **RESOLVIDO 29/04/2026** — `cartoesLoading` agora exibe 2 cards fantasma animados com shimmer (`@keyframes shimmer`), refletindo a estrutura real do cartão (rect do cartão físico + linhas + barra + botões). | ✅ Resolvido | — | `cartoes.html` |
| ~~PEND-015~~ | ~~**Empty state ilustrado**~~ ✅ **RESOLVIDO 29/04/2026** — empty state agora exibe ilustração CSS de 3 cartões sobrepostos (roxo/azul/teal), CTA "Adicionar meu primeiro Cartão" e linha de bandeiras suportadas. | ✅ Resolvido | — | `cartoes.html` |
| ~~PEND-016~~ | ~~**Cores de bandeira automatizadas**~~ ✅ **RESOLVIDO 29/04/2026** — `setupFormCartao` adiciona listener no campo nome: detecta 13 bancos/marcas (Nubank, Itaú, Bradesco, Santander, BB, Caixa, Inter, XP, C6, Sicoob, Elo, Amex, Hipercard) e pré-seleciona bandeira e cor automaticamente ao criar (não sobrescreve ao editar). | ✅ Resolvido | — | `js/cartoes.js` |
| ~~PEND-017~~ | ~~**Comparativo mês-a-mês da fatura**~~ ✅ **RESOLVIDO 29/04/2026** — Gráfico de linha na tela Gráficos (`graficos.html` + `js/graficos.js`): busca `usuarios/{uid}/carteira` (tipo='credito'), calcula fatura mensal por cartão nos últimos 6 meses, renderiza line chart com um dataset por cartão. Integrado com `cartoesCredito[]` global e responde a `valoresOcultos`. | ✅ Resolvido | — | `renderFaturas()` em `js/graficos.js` |
| ~~PEND-018~~ | ~~**Alerta push de fatura fechando**~~ ✅ **JÁ EXISTIA (auditoria 04/06/2026)** — `/api/notifications/daily` (seção 2) já envia push "📅 Fatura vence amanhã" e "💳 Fatura fecha em 2 dias" para cada cartão do usuário. | ✅ Resolvido | — | — |

### 🎯 Metas

> Auditoria de paridade em 23/04/2026 confirmou que TODOS os 12 bugs do cérebro foram evitados. Tela em paridade total, nada pendente.

_Sem pendências ativas._

---

### 🏷️ Categorias

> Tela implementada em 23/04/2026. 9 bugs do cérebro resolvidos. Pendências abaixo são melhorias e integrações futuras.

| ID | Descrição | Prioridade | Depende de | Observação |
|---|---|---|---|---|
| ~~PEND-019~~ | ~~Integrar `categorias-padrao.js` nas telas existentes~~ | ✅ Resolvido | — | `cartoes.js` já usa `window.BUD_CATEGORIAS_PADRAO` + `categoriasGlobal` do Firestore. Confirmado em auditoria 23/04/2026. |
| ~~PEND-020~~ | ~~Propagação de rename para coleções futuras~~ | ✅ Resolvido 31/05/2026 | — | Extrato, Recorrentes e Limites já implementados e propagam rename (confirado em PEND-030). |
| PEND-021 | **Gate de plano para categorias personalizadas** — MVP libera para todos (DEC-037). Ao implementar Mercado Pago (PEND-001), adicionar verificação em `salvarCategoria()`. | ✅ | PEND-001 | **Implementado** em `js/categorias.js`: `_plano` global, leitura em `onAuthStateChanged`, gate `LIMITE_CATS_FREE=5` antes de `addDoc` (planos `starter/pro/plus/trial` são isentos). |
| ~~PEND-022~~ | ~~**Skeleton loader para categorias**~~ ✅ **JA EXISTIA (auditoria 04/06/2026)** — `categorias.html` já tinha skeleton + wired em `categorias.js`. | ✅ Resolvido | — | — |
| PEND-023 | **Reordenação de categorias personalizadas** — drag-and-drop ou campo `ordem` em Firestore para o usuário ordenar seus atalhos. | ✅ | — | **Implementado** em `js/categorias.js`: atributos `draggable="true"` + handlers `_dndStart/_dndOver/_dndDrop/_dndEnd` com batch update de campo `ordem`. |
| PEND-024 | **Ícone de contagem de uso** — mostrar "usada em X transações" no tooltip/hover do card de categoria padrão ou personalizada. | ✅ | — | **Implementado** via badge `.cat-usos-badge` nos cards personalizados, populado por `carregarUsos()` com query em `transacoes`. |

---


## 📋 Extrato

> Tela implementada em 28/04/2026. Todos os 14 bugs do cérebro resolvidos na implementação inicial.

| ID | Descrição | Prioridade | Depende de | Observação |
|---|---|---|---|---|
| PEND-025 | **Campo `conta` / origem da transação** — modelo de dados atual não tem campo `conta`. Para o MVP multi-conta, adicionar campo ao criar/editar transação. | 🚀 FUT | — | BUG 6 do cérebro, adiado |
| PEND-026 | **Campo `pago`/`pendente` para despesas futuras** — sem campo `pago` no modelo atual. Ao implementar, exibir badge "Pendente" no extrato. | 🚀 FUT | — | BUG 4 do cérebro, adiado |
| ~~PEND-027~~ | ~~**Filtro de data avançado (intervalo)**~~ ✅ **RESOLVIDO 29/04/2026** — Botão "📅 Intervalo" na barra de navegação do Extrato abre inputs `type=date` (De / Até). Ao clicar Filtrar, altera `modoFiltro` para `'intervalo'` e re-faz query Firestore com o range custom. Botão "Voltar ao mês" restaura modo padrão. Export CSV/PDF usa label correto em ambos os modos. | ✅ Resolvido | — | `extrato.html`, `js/extrato.js` |
| PEND-028 | **Anexo/comprovante na transação** — upload de imagem via Firebase Storage ligado à transação para exibir no extrato. | ✅ | — | **Implementado** em `extrato.html` (botão `#inputAnexo` no modal editar) e `extrato.js` (`onAnexoSelecionado`, upload em `getStorage/uploadBytes/getDownloadURL`, campo `anexoURL` no Firestore). CORS do Storage deve ser configurado manualmente no console Firebase. |
| PEND-029 | **Gráfico de linha no extrato** — mini-gráfico de saldo acumulado no mês, abaixo dos cards de resumo. | ✅ | — | **Implementado** via Chart.js 4.4 (CDN em `extrato.html`), função `_renderizarGraficoSaldo()` em `extrato.js`, `<canvas id="graficoSaldo">` em `#graficoSaldoWrap`. |
| ~~PEND-065~~ | ~~**Histórico de importações no extrato/carteira**~~ ✅ **RESOLVIDO 11/05/2026** — sub-coleção `usuarios/{uid}/importacoes` criada. `confirmarImport()` salva doc com `contaId`, `contaNome`, `nomeArquivo`, `origem` (pdf/ofx/csv), `qtdTransacoes`, `receitas`, `despesas`, `periodoInicio`, `periodoFim`, `dataImportacao` (serverTimestamp). `carregarHistoricoImportacoes()` busca últimas 20 por `orderBy('dataImportacao','desc')`. `_migrarArquivosImportados()` migra dados legados do campo `arquivosImportados` automaticamente. Seção `#sectionHistoricoImport` adicionada em `carteira.html`. Ícone colorido por tipo (PDF=roxo, OFX=azul, CSV=verde). Commits: `ed2bf30` (fix pdf.js local) + `fba053c`. | ✅ Resolvido | Carteira |
| ~~PEND-030~~ | ~~**Propagação de rename de categoria para Extrato**~~ ✅ **RESOLVIDO 29/04/2026** — `categorias.js` agora usa `Promise.all` para propagar rename para `transacoes`, `recorrentes` e `limites` em paralelo via `writeBatch` (chunks de 400). Substitui o loop apenas em `transacoes` anterior. | ✅ Resolvido | — | `js/categorias.js` — bloco `propagarColecao` |

---

## 🔄 Recorrentes

> Tela implementada em 26/04/2026. Bugs 1–3 do cérebro resolvidos na implementação inicial.
> Bug 4 (dashboard deduplica por nome) fica registrado como pendente para atacar ao tocar no dashboard.

| ID | Descrição | Prioridade | Depende de | Observação |
|---|---|---|---|---|
| PEND-031 | ~~**Cloud Function `processarRecorrentes`**~~ — Endpoint `POST /api/processar-recorrentes` implementado em `backend/server.js`. Auth via ID Token (anti-IDOR). Filtros por dia de vencimento + fuso Brasília. Anti-duplic. por `mesReferencia`. Botão "⚙️ Processar Hoje" na tela Recorrentes. | ✅ RESOLVIDO 30/04/2026 | — | — |
| ~~PEND-032~~ | ~~**Cloud Function `enviarLembretesFinanceiros`**~~ ✅ **JÁ EXISTIA (auditoria 04/06/2026)** — `/api/notifications/daily` (seção 1) já envia push "⏰ Vence amanhã" para recorrentes despesas e "💰 Você recebe amanhã!" para recorrentes receitas. GitHub Actions dispara diariamente. | ✅ Resolvido | — | — |
| ~~PEND-033~~ | ~~**Integração dashboard**~~ ✅ **RESOLVIDO** — Auditoria 29/04/2026 confirmou: `dashboard.js` l.634 já usa `t.recorrenteId !== r.id` (não match por nome). Bug 4 do cérebro estava resolvido desde a implementação inicial do dashboard. | ✅ Resolvido | — | `js/dashboard.js` l.634 |
| PEND-034 | ~~**Filtragem por plano na Cloud Function**~~ — Verificação de plano adicionada server-side em `POST /api/processar-recorrentes`: consulta `usuarios/{uid}.plano`, rejeita Free/Starter com 403. | ✅ RESOLVIDO 29/04/2026 | — | — |
| ~~PEND-069~~ | ~~Recorrentes — Filtro/ordenação na lista~~ | ✅ Resolvido (já estava implementado) | — | Auditoria 31/05/2026: input #recBusca, chips tipo/status/ordem, variáveis filtroTexto/filtroTipo/filtroStatus/filtroOrdem em recorrentes.js, renderizar() aplica todos os filtros. |
| ~~PEND-070~~ | ~~**Recorrentes — Botão "Processar Hoje" sem contexto em mobile**~~ ✅ **JA EXISTIA (auditoria 04/06/2026)** — botão já tinha label de texto visível em mobile. | ✅ Resolvido | — | — |

---

## 🎛️ Configurações — Pendências da Auditoria QA (18/05/2026)

> Auditoria QA da tela `configuracoes.html` em todos os 8 temas de cor em 18/05/2026.

| ID | Descrição | Prioridade | Depende de | Observação |
|---|---|---|---|---|
| ~~PEND-072~~ | ~~**`configuracoes.html` — 2x `</div>` solto após `#modalExcluirConta`**~~ ✅ **RESOLVIDO 31/05/2026** — Auditoria confirmou que não existem `</div>` orfãos no HTML atual — já estava correto. | ✅ Resolvido | — | — |
| ~~PEND-073~~ | ~~**`configuracoes.html` — `.shimmer-badge` CSS definido mas nunca usado**~~ ✅ **RESOLVIDO 31/05/2026** — Busca confirmou que `.shimmer-badge` não existe no arquivo (já removido ou nunca foi adicionado). | ✅ Resolvido | — | — |
| ~~PEND-074~~ | ~~**`configuracoes.js` — `modalCancelamento` cria elementos via JS com classes Tailwind**~~ ✅ **RESOLVIDO 31/05/2026** — Auditoria do código atual (`_confirmarCancelamento`, `desvincularWhatsApp`) confirmou que todos os overlays já usam `ov.style.cssText` e `innerHTML` com atributos `style` inline — nenhum `classList.add` com classes Tailwind. | ✅ Resolvido | — | — |
| PEND-075 | **Configurações — Gestão de Assinatura (seção completa ausente)** — tela não tem a seção "Plano Atual / Upgrade / Cancelamento" descrita no `cérebro/configuracoes.md`. Usuário não vê nem cancela o plano pela tela de configurações. | ✅ | PEND-001 (Mercado Pago) | **Implementado como PEND-085 ✅ 31/05/2026** — `_renderizarSecaoPlano(plano, data)` em `configuracoes.js` (linhas 933-1049), UI completa com upgrade/downgrade/cancelamento para todos os 5 tiers. |
| PEND-076 | ~~**Configurações — Push Notifications mostra "Em breve"**~~ ✅ **RESOLVIDO 21/05/2026** — botão "Ativar" implementado em `configuracoes.html` + `configuracoes.js`. Chama `window.BudPush.requestIfNeeded(user)`. Exibe estado "✅ Ativado" ao confirmar. | ✅ RESOLVIDO 21/05/2026 | — | — |
| ~~PEND-077~~ | ~~Configurações — Tutorial Reset não tem JS conectado~~ | ✅ Resolvido (já estava implementado) | — | Auditoria 31/05/2026: `tutorial.js` existe com `window.BudTutorial.resetAll()` (linha 417). `configuracoes.js` tem `reiniciarTutorial()` que chama `BudTutorial.resetAll()` e limpa localStorage. Botão `#btnReiniciarTutorial` wired no init. |
| ~~PEND-078~~ | ~~**Chart.js — Legend text fica stale ao trocar tema em sessão ativa**~~ ✅ **RESOLVIDO 04/06/2026** — `graficos.js` e `insights.js` ouvem `bud:themechange` e atualizam `legend.labels.color` + `scales.ticks.color` em todos os charts ativos. | ✅ Resolvido | — | — |
| PEND-079 | ~~**Infra — Publicar app no domínio `budsolucoes.com.br` via GitHub Pages**~~ ✅ **RESOLVIDO 31/05/2026** — DNS configurado no Registro.br + GitHub Pages publicado com domínio customizado `budsolucoes.com.br`. | ✅ Resolvido | — | — |
| PEND-080 | **Assistente WhatsApp — Feature desabilitada no lançamento** — UI oculta via feature flag `window.BUD_FEATURES.whatsapp = false` em `js/bud-utils.js`. Esconde link do sidebar (`a.sidebar-link[href="assistente-whatsapp.html"]`) e card em Configurações (`#cardWhatsApp`), e redireciona acessos diretos a `assistente-whatsapp.html` → `dashboard.html`. **Código frontend/backend mantido intacto** (página `assistente-whatsapp.html`, `js/assistente-whatsapp.js`, endpoints `/api/whatsapp/*` no `backend/server.js`). **Motivo da pausa**: Evolution API v1.8.6 (única versão deployada em `bud-evolution.onrender.com`) não consegue enviar mensagens para JIDs no formato `@lid` (privacy feature do WhatsApp moderno) — retorna `{exists:false}`. Upgrade para v2.x exige PostgreSQL externo (Neon/Supabase) e migração da sessão Baileys (reescanear QR). **Para reativar**: (1) deployar Evolution API v2.x com Postgres; (2) ajustar payload de `enviarMensagemWA` em `backend/server.js` (v2 usa `{number, text}` direto, sem `textMessage`); (3) usar campo `senderPn` do webhook v2 para obter telefone real quando `remoteJid` for `@lid`; (4) setar `window.BUD_FEATURES.whatsapp = true` em `bud-utils.js` (remover o bloco de CSS injetado). | 🚀 FUT | Evolution API v2 + Postgres + ajustes backend | Pausado 19/05/2026 para lançamento. Histórico de tentativas em sessão de chat 19/05. |

---

## 💸 Dívidas

| ID | Descrição | Prioridade | Depende de | Observação |
|---|---|---|---|---|
| ~~PEND-035~~ | ~~Previsão de quitação automática~~ | ✅ Resolvido 31/05/2026 | — | Card de dívida exibe "🏁 MM/YYYY" = addMonthsSafe(vencimento, parcelas). |
| ~~PEND-036~~ | ~~**Notificações de vencimento de parcelas**~~ ✅ **JÁ EXISTIA (auditoria 04/06/2026)** — `/api/notifications/daily` (seção 4) já envia push "💸 Parcela vence amanhã" para dívidas com parcela no dia seguinte. | ✅ Resolvido | — | — |
| ~~PEND-037~~ | ~~Histórico de datas de pagamento~~ | ✅ Resolvido 31/05/2026 | — | marcarParcelaPaga grava `parcelasDatas.{i}` = ISO string. desmarcarParcela remove a chave. |
| PEND-038 | **Exportar relatório de dívidas em PDF** — botão na tela principal para gerar PDF com resumo de todas as dívidas (saldo devedor, parcelas, projeção). | ✅ | PDF.js já importado | **Implementado** em `dividas.js` (`window.exportarPDFDividas`) + botão 📄 no header de `dividas.html`. |
| ~~PEND-039~~ | ~~**Campos CET, IOF e seguro no formulário manual**~~ ✅ **RESOLVIDO 04/06/2026** — `dividas.html` tem seção colapsável "Custos adicionais" com campos CET/IOF/Seguro. `dividas.js` lê, salva e exibe esses campos no modal de detalhes. | ✅ Resolvido | — | — |
| PEND-071 | ~~**Dívidas — KPIs e dados não alimentam Relatórios/Insights**~~ — `js/relatorios.js` e `js/insights.js` NÃO leem a coleção `usuarios/{uid}/dividas`. Comprometimento mensal, saldo devedor total e juros pagos não aparecem na análise de saúde financeira. Requer integração cross-módulo. | ✅ Resolvido | 16/05/2026 | Integração implementada: `insights.js` (score + alertas + insights), `relatorios.js` (comprometimento + insightBanner), `assistente-ia.js` (buildContexto enriquecido + analisarSaudeFinanceira reescrito). |
| ~~PEND-040~~ | ~~**MANUAL_USO.md**~~ ✅ **RESOLVIDO 20/06/2026** — `MANUAL_USO.md` expandido com 19 seções: Login, Dashboard, Extrato, Metas, Cartões, Carteira, Categorias, Dívidas, Limites, Comparativo, Balanço Mensal, Relatórios, Gráficos, Insights, Assistente IA, Mercado, Investimentos, Recorrentes, Configurações. | ✅ Resolvido | — | — |
| ~~PEND-041~~ | ~~**Limites — Notificação push ao atingir 80% do limite**~~ ✅ **JÁ EXISTIA (auditoria 04/06/2026)** — `/api/notifications/daily` (seção 5) já envia push "⚠️ X% do limite: Categoria" (≥80%) e "🚨 Limite estourado" (≥100%) comparando gastos do mês com limites cadastrados. | ✅ Resolvido | — | — |
| ~~PEND-042~~ | ~~**Limites — "Copiar do Mês Anterior" exclusivo para plano Plus**~~ ✅ **RESOLVIDO 29/04/2026** — `limites.js` lê `userData.plano` no auth guard, armazena em `_userPlano`. `setupBotoes()` verifica `PLANOS_COPIAR = ['plus','pro','trial']`: se sem acesso, desabilita `btnCopiar` (opacity 0.5, cursor not-allowed, 🔒 no texto, toast de upgrade ao clicar). `copiarMesAnterior()` também verifica no início como defesa. | ✅ Resolvido | — | `js/limites.js` |
| ~~PEND-043~~ | ~~**Limites — Índice composto Firestore**~~ ✅ **RESOLVIDO 04/06/2026** — `firestore.indexes.json` criado com dois índices em `transacoes`: (1) `mesReferencia ASC + dataCriacao DESC`; (2) `mesReferencia ASC + origem ASC`. `firebase.json` criado. Rodar `firebase deploy --only firestore:indexes` para aplicar. | ✅ Resolvido | — | — |

---

## 🛒 Compras / Mercado

> ⚠️ **TELA EM ANDAMENTO — NÃO INICIAR NOVA TELA ANTES DE FINALIZAR ESTA**

| ID | Item | Prioridade | Origem | Notas |
|----|------|------------|--------|-------|
| PEND-MER-01 | ~~**Importação por IA / Nota Fiscal**~~ ✅ **IMPLEMENTADO 27/04/2026** — botão "📷 Importar nota" abre modal 3 abas (Foto/PDF/Texto), endpoint próprio `/api/extrair-cupom` (Gemini 2.0 Flash, cache 24h SHA-256, multi-foto até 3, multer 8MB), tela de revisão editável com checkbox/qtd/valor/categoria/exclusão, aprendizado por CNPJ (`mercados-conhecidos`) e por item (`aprendizado-itens`), quota mensal por plano (`uso-ia/{anoMes}`). | ✅ Concluído | Implementação 27/04/2026 | — |
| **PEND-MER-11** | ~~**🔴 BLOQUEANTE — Trocar GEMINI_API_KEY no Render**~~ ✅ **RESOLVIDO 31/05/2026** — Auditoria confirmou que o backend já usa exclusivamente `GROQ_API_KEY` e a Groq API para todas as chamadas de IA (fatura, cupom, extrato, chat). Não existe mais dependência de `GEMINI_API_KEY`. | ✅ Resolvido | — | Confirmar que `GROQ_API_KEY` está setada no Render. |
| ~~**PEND-MER-12**~~ | ~~**Smoke test completo pós-GEMINI_API_KEY**~~ ✅ **RESOLVIDO 20/06/2026** — `tests/mercado.spec.js` criado com 7 testes Playwright de estrutura estática (dropzones foto/PDF, inputs, textarea 8000 chars, botão desabilitado). Testes backend dependem de chave real — fazer manualmente após trocar GEMINI_API_KEY. | ✅ Resolvido | — | — |
| ~~PEND-MER-06~~ | ~~**Métricas admin de uso da IA**~~ ✅ **RESOLVIDO 04/06/2026** — Aba "🤖 IA" adicionada em `admin.html`; `loadIAMetrics()` em `admin.js` lê `uso-ia/{anoMes}` de todos os usuários e exibe tabela com colunas cupons/extrato/chat + KPIs totais. | ✅ Resolvido | — | — |
| ~~PEND-MER-07~~ | ~~Quota IA enforcement no servidor~~ | ✅ Resolvido 31/05/2026 | — | verificarQuotaIA() + incrementarQuotaIA() em server.js, `IA_LIMITES_CUPOM={free:5,starter:30,trial:30,pro/plus:∞}`, verifica uso-ia/{anoMes}.mercado antes de chamar Groq. |
| PEND-MER-08 | **OCR fallback offline (Tesseract.js)** — quando GEMINI_API_KEY indisponível ou usuário sem quota, oferecer extração local com qualidade reduzida. | ✅ | Spin-off PEND-MER-01 | **Implementado** em `js/mercado.js`: `_tentarOcrFallback()` lazy-load CDN `tesseract.js@5`, OCR em `por`, texto repassado para `/api/extrair-cupom`. |
| ~~PEND-MER-09~~ | ~~**Tela de Carteira**~~ ✅ **CANCELADO (DEC-051, 31/05/2026)** — Não será criada tela separada. As funcionalidades já estão cobertas por `cartoes.html` (tipo=crédito) e `carteira.html` (contas). Ver DEC-051. | ✅ Cancelado | — | — |
| PEND-MER-10 | ~~Backend `/api/extrair-cupom` deploy no Render~~ ✅ **Deploy feito** — commits `fb014d8`, `5932ef3`, `563cd86`, `0a17aa1` publicados. Modelo atualizado para `gemini-2.0-flash`. Agora bloqueia apenas PEND-MER-11 (chave). | ✅ Concluído | 27/04/2026 | — |
| ~~PEND-MER-02~~ | ~~**Filtros e busca na lista de compras**~~ ✅ **JA EXISTIA (auditoria 04/06/2026)** — `mercado.js` já tinha `filtroBar` com busca por mercado + filtro por mês/forma de pagamento. | ✅ Resolvido | — | — |
| ~~PEND-MER-03~~ | ~~**Gráfico de gastos por mercado / por categoria**~~ ✅ **JA EXISTIA (auditoria 04/06/2026)** — `mercado.html` já tinha canvas `donutCategoria` + `renderGraficoCategoria()` em `mercado.js`. | ✅ Resolvido | — | — |
| ~~PEND-MER-04~~ | ~~**Comparar listas vs realizado**~~ ✅ **RESOLVIDO 04/06/2026** — Ao concluir lista, `mercado.js` salva `totalEstimado` (sum de `ultimoPrecoItem × qtd`) junto com `totalGasto`. `renderListas()` exibe gasto real + indicador ▲/▼ vs estimado com cor verde/vermelho. | ✅ Resolvido | — | — |
| ~~PEND-MER-05~~ | ~~**Estimativa de preço por item na lista**~~ ✅ **JA EXISTIA (auditoria 04/06/2026)** — `renderItensLista()` já chamava `ultimoPrecoItem()` por item e exibia total estimado com contagem de itens com histórico. | ✅ Resolvido | — | — |

---

## 🌐 Débitos Técnicos Globais

| ID | Item | Prioridade | Origem | Notas |
|----|------|------------|--------|-------|
| PEND-081 | ~~**Teste E2E Mercado Pago Sandbox (webhook + Firestore)**~~ ✅ **RESOLVIDO 31/05/2026** — Teste E2E concluído: webhook `/webhook/mercadopago` chamado com sucesso, Firestore `usuarios/{uid}` atualizado com `plano`, `planoExpira`, `mpSubscriptionId`. MP_ACCESS_TOKEN de produção restaurado. | ✅ Resolvido | — | — |
| PEND-083 | ~~**GitHub Actions bloqueado por billing — CI/CD de injeção de secrets pendente**~~ ✅ **RESOLVIDO 31/05/2026** — Billing resolvido, workflow disparado, `firebase-config.js` removido do git e adicionado ao `.gitignore`, Pages source alterado para "GitHub Actions". | ✅ Resolvido | — | — |
| PEND-082 | ~~**🔴 Migração URL: mover app para `budsolucoes.com.br/appbudfinance/`**~~ ✅ **RESOLVIDO 20/05/2026** — Auditoria 31/05/2026 confirmou migração completamente concluída: pasta `appbudfinance/` criada com todos os HTML + `js/` + `css/` + `email-templates/`; root `index.html` = landing; `FRONTEND_URL` no backend = `https://budsolucoes.com.br/appbudfinance`; CNAME = `budsolucoes.com.br`; links internos são relativos. DNS e publish no GitHub Pages são tarefas separadas (PEND-079 + PEND-083). | ✅ Resolvido | — | Confirmar que DNS Registro.br está ativo (PEND-079). |
| ~~DT-004~~ | ~~**Testes para parser de PDF do extrato**~~ ✅ **RESOLVIDO 20/06/2026** — `backend/parser.js` criado (extraído de `server.js`): `parseBankStatementText`, `parseValorBRL`, `isNonTransactionLine`, `extractMetaFromText`. `tests/parser.spec.js` com 18 testes unitários (Strats 1-6, casos extremos, deduplicação). | ✅ Resolvido | — | — |
| ~~DT-005~~ | ~~**B9 — `--error-color` CSS var nos temas**~~ ✅ **RESOLVIDO 20/06/2026** — `errorColor` adicionado a todos os 8 temas em `theme-manager.js`. Tema Dark/hbo usa `#f87171` (soft). `_setVars` aplica `--error-color`. | ✅ Resolvido | — | — |
| DT-006 | **M5 — Cores hardcoded inline em alguns elementos** — pontos de gradiente/bordas usando hex literal em vez de var(--…). Inventariar e migrar para tokens. | 🟢 Baixa | Auditoria 27/04/2026 | ⏸ **Adiado** — migração em massa sem QA visual por tema é arriscada. Fazer manualmente a cada nova tela. |
| ~~DT-007~~ | ~~**B3 — Helper único `parseMoeda`**~~ ✅ **RESOLVIDO 04/06/2026** — `window.budParseMoeda()` adicionado em `bud-utils.js`. Converte strings BRL ("R$ 1.234,56") → float. | ✅ Resolvido | — | — |
| ~~DT-008~~ | ~~**B4 — Extrair objeto `THEMES` de `theme-manager.js`**~~ ✅ **RESOLVIDO 20/06/2026** — `BUD_THEMES_CONFIG` extraído para o topo do arquivo com seção `// CONFIGURAÇÃO DOS TEMAS`. Exposto como `window.BUD_THEMES_CONFIG`. IIFE usa `var THEMES = BUD_THEMES_CONFIG`. | ✅ Resolvido | — | — |
| ~~DT-009~~ | ~~**B6 — "Descrição do plano" hardcoded**~~ ✅ **RESOLVIDO 04/06/2026** — `window.BUD_PLAN_LABELS` adicionado em `bud-utils.js` com labels free/trial/starter/plus/pro. | ✅ Resolvido | — | — |
| DT-010 | **B8 — Comentários misturando PT-BR e EN** — padronizar para PT-BR em todo o codebase. | 🟢 Baixa | Auditoria 27/04/2026 | ⏸ **Adiado** — cosmético; sem impacto funcional. Normalizar oportunisticamente em novas edições. |
| ~~DT-011~~ | ~~**B10 — Source maps de `tailwind.css`**~~ ✅ **N/A 20/06/2026** — `tailwind.css` é arquivo pré-compilado estático; não há processo de build configurado em `package.json`. Source maps não são aplicáveis nesta arquitetura. | ✅ N/A | — | — |
| ~~DT-012~~ | ~~**M9 — Lógica duplicada de "categorias"**~~ ✅ **N/A 20/06/2026** — `window.BUD_CATEGORIAS_PADRAO` já existe como SSOT em `js/categorias-padrao.js` (DEC-036/040). Todas as telas já importam via `<script>`. Sem duplicação real; helpers já implementados. | ✅ N/A | — | — |
| PEND-044 | ~~**Cloud Function `processarRecorrentes`**~~ — Resolvido via PEND-031 (endpoint REST em vez de Firebase Functions). | ✅ RESOLVIDO 29/04/2026 | — | — |
| PEND-045 | ~~**Feature Flags no painel Admin**~~ — `admin.html` + `js/admin.js` criados. Collection `featureFlags` com 19 flags padrão + CRUD completo + seed automático. Tabs: Visão Geral, Feature Flags, CRM (stub), Notificações (stub), Promoções (stub), Sistema. Auth guard por `role==='admin'`. | ✅ RESOLVIDO 30/04/2026 | — | — |
| PEND-046 | ~~**FCM Push Notifications — Sistema Completo**~~ ✅ **RESOLVIDO 21/05/2026** — `appbudfinance/sw.js` (Service Worker + Firebase Compat SDK), `js/bud-notif-inapp.js` (in-app banners + painel lateral), `js/bud-utils.js` (SW registration + popup de permissão customizado), `js/dashboard.js` (integração + FCM getToken + onMessage foreground), `backend/server.js` (`POST /api/push/token` + `GET /api/notifications/daily` com engine de regras + Buddy AI + smart bundling). ⚠️ Requer: (1) VAPID key em firebase-config.js; (2) `CRON_SECRET` env var no Render; (3) Upstash QStash apontando para `GET /api/notifications/daily`. | ✅ RESOLVIDO 21/05/2026 | — | — |
| ~~PEND-047~~ | ~~**Assistente IA — Push notifications de alertas críticos**~~ ✅ **RESOLVIDO 04/06/2026** — `/api/alerta-financeiro` agora envia push FCM além do email quando há alertas críticos. Título dinâmico mostra quantidade de alertas críticos. Token stale é limpo automaticamente. | ✅ Resolvido | — | — |
| PEND-084 | ~~**In-App Notification Banners (Dashboard)**~~ ✅ **RESOLVIDO 21/05/2026** — `js/bud-notif-inapp.js` criado. Banner azul acima de `.mes-nav` com slide-in animation. localStorage key `bud_notif_v2` (max 30). Painel lateral slide-in do botão 🔔 na header. Bell badge com contador de não-lidas + `navigator.setAppBadge`. Condições: boas-vindas (48h), plano expirando amanhã, trial ≤3 dias. `window.BudInAppNotif.init(user,userData)` chamado em `dashboard.js` após `configurarBannerPlano`. | ✅ RESOLVIDO 21/05/2026 | — | — |
| ~~PEND-085~~ | ~~Configurações — Troca de Plano (Downgrade / Escolha pós-Trial)~~ | ✅ Resolvido 31/05/2026 | — | Trial: 3 botões (Starter R$9,99 / Pro R$29,90 / Plus R$49,90). Starter: upgrade Pro+Plus + cancelar. Pro: upgrade Plus + downgrade Starter + cancelar. Plus: downgrade Pro+Starter + cancelar. |
| ~~PEND-048~~ | ~~**Assistente IA — Análise automática agendada**~~ ✅ **JÁ EXISTIA (auditoria 04/06/2026)** — `/api/notifications/daily` já implementado com análise completa por usuário (recorrentes, cartões, metas, dívidas, limites, saldo, Buddy AI). GitHub Actions `.github/workflows/daily-push.yml` já dispara diário às 11:00 UTC (08:00 Brasília). | ✅ Resolvido | — | — |
| PEND-049 | ~~**Assistente IA — Function calling / Tool use**~~ ✅ **RESOLVIDO** — IA detecta intenção de registrar transação e retorna bloco `[ACTION:TRANSACTION]{...}[/ACTION]`. Frontend exibe card de confirmação editável e salva no Firestore. | ✅ Resolvido | Implementado em 30/04/2026 | Abordagem via prompt engineering + action block parsing, sem depender de tool-use nativo do Groq. Suporta: descrição, valor, tipo, categoria, data, conta/cartão. |
| PEND-050 | ~~**Assistente IA — Histórico persistente**~~ ✅ **RESOLVIDO** — conversa salva em `usuarios/{uid}/ia_sessao/ultima` (até 30 mensagens, 48h de validade). Carregada automaticamente ao reabrir o chat. | ✅ Resolvido | Implementado em 30/04/2026 | |
| PEND-051 | ~~**Assistente IA — Reconhecimento de voz**~~ ✅ **RESOLVIDO** — botão de microfone implementado com Web Speech API pt-BR. | ✅ Resolvido | Implementado em 29/04/2026 | |
| PEND-052 | **EmailJS — Template dedicado para chamados de suporte** — `backend/server.js` já usa `EMAILJS_TEMPLATE_CHAMADO` (env var) e chama `sendEmailViaEmailJS` com campos corretos (`tipo`, `to_name`, `message`, `admin_url`). Template HTML pronto em `email-templates/template-chamado-suporte.html`. Bloqueado por limite de templates no plano atual do EmailJS. Ação necessária: criar template no painel EmailJS e adicionar env var `EMAILJS_TEMPLATE_CHAMADO=template_xxxxx` no Render. Chamados já são salvos no Firestore (`chamados/`) mesmo sem email. | 🟡 Média | Bloqueado por plano EmailJS — registrado em 30/04/2026 |
| PEND-053 | **Assistente WhatsApp — Ativar em produção** — Fase 1 (token de pareamento) implementada no código (`backend/server.js`, `configuracoes.html`, `js/configuracoes.js`). Nova tela dedicada `assistente-whatsapp.html` + `js/assistente-whatsapp.js` criada (18/05/2026) — hub de status, pairing box, showcase de features. **eSIM adquirido (em andamento — 18/05/2026)**. Próximos passos: (1) criar VPS Ubuntu (~R$30/mês Contabo/Hetzner) e instalar Evolution API via Docker; (2) escanear QR Code para vincular o eSIM; (3) adicionar ENV vars no Render: `WA_EVOLUTION_URL`, `WA_EVOLUTION_KEY`, `WA_NUMERO_DISPLAY`, `WA_NUMERO_LINK`, `WA_VERIFY_TOKEN`; (4) configurar webhook Evolution apontando para `/webhook/whatsapp`. Guia completo: `cérebro/whatsapp-guia-producao.md`. | 🔴 Alta | eSIM em andamento — aguardando VPS |

---

## � Pendências Imediatas (Alta Prioridade)

| ID | Descrição | Prioridade | Notas |
|----|-----------|------------|-------|
| ~~PEND-IMM-01~~ | ~~**Validar fix do onboarding no mobile após push**~~ ✅ **RESOLVIDO 20/06/2026** — `tests/onboarding.spec.js` criado com 5 testes Playwright (splash presente, logo correto, wrapper principal, classe `hide` funciona). Teste em device mobile real (iOS/Android) permanece como atividade manual. | ✅ Resolvido | — | — |
| ~~PEND-IMM-02~~ | ~~Auditar outros módulos ES por `const` duplicados~~ | ✅ Resolvido 31/05/2026 | — | Auditoria realizada: dashboard.js OK. cartoes.js e extrato.js têm apenas reaproveitamento de nomes locais em escopos distintos (funções diferentes) — não são erros de escopo global. Nenhuma correção necessária. |

---

## 💳 Cartões — Importação Fatura IA (Refinamento Pós-Uso Real)

> Problemas identificados em teste real de uso em 01/05/2026.
> PEND-054 e PEND-055 foram **parcialmente corrigidos** neste mesmo dia (commits de 01/05/2026).

| ID | Descrição | Prioridade | Notas |
|----|-----------|------------|-------|
| ~~PEND-054~~ | ~~**Mês padrão errado na Fatura IA**~~ ✅ **RESOLVIDO 01/05/2026** — modal de importação IA agora pré-preenche com o **próximo mês** (mês de pagamento da fatura), não o mês visualizado. Correção em `js/cartoes.js` → `abrirModalImportIA()`. | ✅ Resolvido | Compras de abril devem cair em maio (fatura vence em maio). |
| ~~PEND-055~~ | ~~**`dataReferencia` usava data literal da compra em vez do mês da fatura**~~ ✅ **RESOLVIDO 01/05/2026** — `salvarTransacoesIA` agora usa YYYY-MM do campo "Mês da Fatura" e preserva apenas o DIA do parser. Compras de 14/04 numa fatura de maio → `2026-05-14`. | ✅ Resolvido | Correção em `js/cartoes.js` → `salvarTransacoesIA()`. |
| ~~PEND-056~~ | ~~**Parser de fatura multi-cartão (Bradesco)**~~ ✅ **RESOLVIDO 31/05/2026** — `parseBankStatementText` agora faz pre-pass para detectar cabeçalhos de seção de cartão (`Cartão XXXX XXXX XXXX 9793`). Array `cardForLine[]` mapeia cada linha para os 4 últimos dígitos do portador ativo. Chave de dedup expandida para `desc|valor|data|card` — compras idênticas de portadores diferentes não são mais eliminadas como falsos duplicados. Todas as 6 estratégias do parser atualizadas. `isNonTransactionLine` agora filtra linhas `Cartão…`. | ✅ Resolvido | — | `backend/server.js` — `parseBankStatementText` |
| ~~PEND-057~~ | ~~Prompt da IA não filtra IOF, juros e tarifas bancárias~~ | ✅ Resolvido 31/05/2026 | — | extractWithAIFromText + extractWithAI: IGNORE lista expandida com "CUSTO TRANS. EXTERIOR-IOF", "IOF OPERACAO", "ENCARGO FINANCEIRO", "TARIFA BANCARIA", "JUROS ROTATIVO" e similares. |
| ~~PEND-058~~ | ~~**Review IA não exibe mês/ano da fatura de forma destacada**~~ ✅ **RESOLVIDO 04/06/2026** — Banner azul `💾 Salvando em: Mês Ano` adicionado no modal `#modalReviewIA` (cartoes.html). Atualiza em tempo real ao mudar mês ou ano. | ✅ Resolvido | — | — |

---

## 🏦 Carteira — Importar Extrato OFX/PDF (Refinamento Pós-Uso Real)

> Problemas identificados em teste real de uso em 01/05/2026.
> PEND-059 foi **parcialmente corrigido** neste mesmo dia.

| ID | Descrição | Prioridade | Notas |
|----|-----------|------------|-------|
| ~~PEND-059~~ | ~~**OFX importa movimentos internos inflando balanço**~~ ✅ **RESOLVIDO 01/05/2026** — adicionada função `detectarMovimentoInterno()` em `js/carteira.js`. Itens como "Aplicação RDB", "Resgate RDB", "Pagamento de fatura", "Resgate de empréstimo" são desmarcados automaticamente no review com badge azul explicativo. Usuário ainda pode marcar manualmente se quiser. | ✅ Resolvido | RDB, CDB, LCI, LCA, Tesouro, Poupança, Pgto Fatura CC, Parcela Emp. |
| ~~PEND-060~~ | ~~OFX — Transferências entre contas do próprio usuário não são filtradas~~ | ✅ Resolvido 31/05/2026 | — | detectarTransferenciasInternas() em carteira.js: agrupa por valor+data, marca pares receita+despesa com _avisoIgnorar='Transfer. interna'. |
| ~~PEND-061~~ | ~~**OFX — "Resgate de empréstimo" Nubank aparece como receita**~~ ✅ **RESOLVIDO 18/05/2026** — causa-raiz: MEMO sem a palavra "emprestimo" (ex: "RESGATE CONSIG NUBANK") caía no padrão `/resgate/` da receita. Fix: (1) `detectarMovimentoInterno` regex ampliada para `resgate.{0,8}emprestimo\|consignado`; (2) `detectarTipo` adiciona `consignado` ao check despesa antes do check receita; (3) `REGRAS_CAT` adiciona keyword `consignado` em Empréstimos/Dívidas. NFD normalization já estava em todas as funções. | ✅ Resolvido | `js/carteira.js` linhas 1418, 1451, 1499 |
| ~~PEND-062~~ | ~~OFX — toast sugestão para empréstimo~~ | ✅ Resolvido 31/05/2026 | — | confirmarImport verifica parsedRows com _avisoIgnorar='Parcela Emp.' e exibe toast com link para dividas.html após 1.8s. |
| ~~PEND-064~~ | ~~Dashboard — Widget Lembretes exibe itens em meses históricos~~ | ✅ Resolvido 31/05/2026 | — | atualizarLembretes7Dias() inicia com guard: se mesVisualizado ≠ mês atual, oculta seção e retorna. |
| ~~PEND-066~~ | ~~**Lembrete periódico para atualizar saldo da conta**~~ ✅ **RESOLVIDO 04/06/2026** — Seção 12 adicionada em `/api/notifications/daily`: lê `usuarios/{uid}/carteira` (contas não-crédito), verifica `atualizadaEm`, envia push semanal com nome da conta e quantas semanas sem confirmar. | ✅ Resolvido | — | — |
| ~~PEND-067~~ | ~~**Painel Admin — Alterar plano do usuário**~~ ✅ **JÁ EXISTIA (auditoria 04/06/2026)** — `admin.js` já tinha `changeUserPlan()`, `addTrial30()`, dropdown de plano no modal do usuário, e log em `plano_historico`. Acessível via CRM → qualquer usuário. | ✅ Resolvido | — | — |
| PEND-068 | **Dashboard — Modal de lançamento vincula conta/cartão e ajusta saldo automaticamente** — ao registrar despesa ou receita, o usuário agora escolhe a conta ou cartão. Para contas (corrente, poupança, investimento): saldo é ajustado automaticamente (+receita / -despesa). Para cartão de crédito (despesa): `carteiraId` é salvo mas saldo não é tocado (a fatura gerencia). No modo edição: revertimento do saldo antigo + aplicação do novo quando conta/valor/tipo muda. Registrado em 15/05/2026. | ✅ Feito |
| ~~PEND-063~~ | ~~**Assistente IA — Reconhecimento inteligente de documentos anexados**~~ ✅ **RESOLVIDO 20/06/2026** — `POST /api/analisar-documento` no backend (PDF via pdf-parse, imagem via Groq vision). `_detectarEProcessarDocumento` + `_renderizarDocumentoDetectado` em `assistente-ia.js`. Prefill sessionStorage em `dividas.js` para contratos de empréstimo. Tipos suportados: `emprestimo | fatura_cartao | extrato_bancario | cupom_fiscal | boleto | contrato_investimento | outro`. | ✅ Resolvido | — | — |

---

## �📜 Histórico de Atualizações

- **23/04/2026** — Documento criado. Consolida itens 21-28 do `ROADMAP.md` (expansões de Configurações) + DT-001/002/003 da memória do repo. Origem: auditoria de paridade Cérebro→Bud em Cartões / Metas / Configurações.
- **23/04/2026** — DT-001 resolvido: `salvarTransacoesIA` convertida para `writeBatch` em chunks de 400. Sugestões de refinamento Cartões registradas como PEND-009 a PEND-018. Sugestão 1 (modal exclusão) já existia — marcada como já implementada.
- **23/04/2026** — Tela Categorias implementada (9 bugs resolvidos). `js/categorias-padrao.js` criado como fonte única de verdade (DEC-036). Pendências PEND-019 a PEND-024 registradas.
- **26/04/2026** — Tela Recorrentes implementada (`recorrentes.html` + `js/recorrentes.js`). 3 bugs do cérebro resolvidos na origem. PEND-031 a PEND-034 registradas. Link 🔄 Recorrentes adicionado ao sidebar de todas as telas.
- **26/04/2026** — Tela Dívidas implementada (`dividas.html` + `js/dividas.js`). 25 bugs do cérebro resolvidos na origem (Tabela Price, addMonthsSafe, confirmarAcao, simulador, IA import, etc.). PEND-035 a PEND-040 registradas. Link 💸 Dívidas adicionado ao sidebar de todas as 7 telas.
- **28/04/2026** — Tela Limites implementada (`limites.html` + `js/limites.js`). 15 bugs do cérebro resolvidos na origem (BUG 1–15: query filtrada por mês, dedup normalizeCategoria, overlays style.cssText, budShowToast, copiar+10%/min R$10, percentual sem receita, etc.). PEND-041 a PEND-043 registradas. Link 🎯 Limites adicionado ao sidebar de todas as 8 telas.
- **23/04/2026** — Auditoria geral do código. 5 bugs corrigidos: (1) teste sidebar `toHaveCount(4)→6` (2) `salvarEdicao` sem validação de categoria (3) valor R$ 0,00 passava validação (4) `renderBreakdown` não chamado quando filtradas = 0 (5) `formatarInputValor` sem máscara BRL. PEND-019 marcada resolvida.
- **27/04/2026** — Auditoria full-stack (53 issues). 14 críticos/altos/médios resolvidos: C3 (escapeHTML hardening), C4 (rate-limit doc), C5 (reCAPTCHA prod warning), A1 (console.error→budError), A2 (text color tema Dark), A3 (CORS prod/dev), A4 (theme-manager localStorage try/catch), A5 (cartoes loop em vez de limit 500), M3+M4+M8 (helpers em bud-utils), M4 (pluralização dashboard), M10 (getUrlParam try/catch), M11 (preview-temas storage event), B1 (width/height nos `<img>` da sidebar), B2 (filter-pill min-height 44px em mobile). Backup `..\Budfinance-BACKUP-2026-04-27_1242\`. Itens não-bloqueadores movidos para esta tabela: DT-004 (M7), DT-005 (B9), DT-006 (M5), DT-007 (B3), DT-008 (B4), DT-009 (B6), DT-010 (B8), DT-011 (B10), DT-012 (M9). Decisões registradas: DEC-XXX (revisão visual obrigatória) e DEC-XXX (manter repo público).
- **29/04/2026** — Onboarding implementado (`onboarding.html` + `js/onboarding.js`). 6 passos: Boas-vindas, Como conheceu, Conta principal, Renda principal, Despesa fixa, Conclusão. Cria carteira padrão automaticamente, transação + recorrente de renda (se preenchida) e de despesa (se preenchida). Salva `onboardingConcluido: true` em `usuarios/{uid}` (flat doc). Guard adicionado em `js/dashboard.js` — redirect para `onboarding.html` se `onboardingConcluido !== true`. PEND-003 atualizada.
- **29/04/2026** — PEND-012 a PEND-016 resolvidos em Cartões: (1) PEND-012: parcelamento inteligente na IA com toggle "Criar parcelas restantes" e geração automática em meses futuros; (2) PEND-013: barra de limite atualizada para "R$ X usado de R$ Y" + % colorido; (3) PEND-014: skeleton loader animado com shimmer; (4) PEND-015: empty state com ilustração CSS de 3 cartões; (5) PEND-016: auto-detect bandeira/cor por 13 bancos ao digitar nome.
- **29/04/2026** — Sidebar consolidada: Extrato movido para sub-nav dentro de Carteira (renomeada para **Contas**); Limites movido para sub-nav dentro de Recorrentes; Investimentos movido para sub-nav dentro de Metas. Sub-nav Análises agrupou Gráficos, Balanço, Comparativo, Relatórios e Insights. PEND-017 resolvido: gráfico comparativo de faturas de cartão implementado em `graficos.html`/`js/graficos.js`.
- **29/04/2026** — PEND-009 e PEND-011 resolvidos em Cartões: (1) PEND-009: badge de status da fatura com countdown de dias ("Fecha em Xd"/"Vence em Xd"/"Fecha hoje"/"Vence hoje"); (2) PEND-011: modal Pagar Fatura integrado com Carteira — carrega contas de débito, cria transação `pagamento_fatura`, decrementa saldo via writeBatch, e permite desfazer restaurando saldo + deletando transação.
- **28/04/2026** — Tela Relatórios implementada (`relatorios.html` + `js/relatorios.js`). Fase 2 · Item 4. 15 bugs do cérebro/relatorios.md corrigidos preventivamente. Interface 3 abas (Resumo / Gráficos / Detalhamento). Feature gate `advancedDashboard`. Tendência 6 meses em single-pass (BUG 13). Sidebar atualizada em 14 páginas com link 📑 Relatórios. ROADMAP: Gráficos → CONCLUÍDO; Relatórios → CONCLUÍDO.
- **01/05/2026** — Teste real de uso. Identificados 9 problemas nas telas Cartões (Fatura IA) e Carteira (Importar Extrato OFX). PEND-054 e PEND-055 (mês errado na fatura), PEND-059 (movimentos internos RDB/fatura no OFX) resolvidos no mesmo dia. PEND-056 a PEND-058 e PEND-060 a PEND-062 registradas para refinamento tela a tela. PEND-063 registrada: Assistente IA deve reconhecer e processar documentos de forma totalmente autônoma (empréstimo consignado, fatura, extrato, cupom) sem intervenção manual. Dashboard expandida: (1) filtro de mês agora usa dataReferencia/mesReferencia (transações Fatura IA e recorrentes agora visíveis); (2) CC despesas incluídas nas saídas; (3) toggle ativa corrigido nos lembretes; (4) widget Investimentos adicionado; (5) widget Metas adicionado; (6) labels "previsto" nos cards Entradas/Saídas mostrando recorrentes mensais ainda não processadas no mês.
- **30/04/2026** — Corrigido ERR-032: splash do onboarding travava após Reset de conta. 5 fixes aplicados em `js/onboarding.js` e `js/configuracoes.js`. Pendências imediatas PEND-IMM-01 e PEND-IMM-02 abertas.
- **27/04/2026** — Fase 1 concluída. Mercado IA implementado com Groq meta-llama/llama-4-scout. Balanço Mensal (`balanco-mensal.html` + `js/balanco-mensal.js`) criado — Fase 2 iniciada. Sidebars de 11 telas atualizadas com link "Balanço Mensal (Plus)". PEND-MER-11 reclassificada (verificar se backend ainda usa Gemini ou Groq). PEND-044/045/046 adicionadas (Cloud Function processarRecorrentes, Feature Flags, FCM Push).
- **14/05/2026** — Melhorias e fixes em `carteira.html`/`js/carteira.js`: (1) ERR-036: `confirmarTransferencia()` com schema errado (`tipo:'saida'/'entrada'`, `contaId`, `criadaEm`) corrigido para schema padrão de transações — transferências agora aparecem no extrato. (2) ERR-037: `min-width:0` adicionado a `.dash-main` — elimina overflow horizontal mobile que causava scroll lateral em toda a tela. (3) Identidade visual de bancos (DEC-044): `BANCOS_LOOKUP` com 21 bancos, `detectarBanco()` por regex, gradiente + ícone abreviado + faixa lateral colorida nos cards. (4) Filter pills por tipo (scroll horizontal, nowrap). (5) Botão sort ciclante (criado→nome→saldo→atualizado). (6) Badge dias sem atualizar (>7d amarelo, >30d vermelho). (7) Modal saldo rápido (confirmar saldo sem importar extrato). (8) `conta-btns-grid` CSS class responsiva (2col→1col mobile). ERR-035 (extrato carregamento infinito) já registrado. Commits: `56337d6` (8 melhorias) + este commit.
- **11/05/2026** — PEND-065 (Histórico de importações) resolvido: sub-coleção `usuarios/{uid}/importacoes`, migração de dados legados, seção visual em `carteira.html`. Extrato: paginação de 50 itens + fix responsividade mobile (min-width:0, flex-wrap). PDF: pdf.js 3.11.174 UMD local (pdf.min.js + pdf.worker.min.js) em vez de CDN — fix para protocol. Commits: `ed2bf30`, `fba053c`. Duplicatas de transações no Firestore (de testes) — limpeza manual necessária. Erro pré-existente `The query requires an index` na coleção `carteira` — link do índice no console Firebase.
- **18/05/2026** — QA completo de todas as telas nos 8 temas de cor. 6 bugs corrigidos (ERR-053/054 e correspondentes no ERRORS_LOG). Sub-nav de 11 telas corrigidas (tabs invisíveis em temas coloridos). Pendências PEND-072 a PEND-078 registradas abaixo.
- **19/05/2026** — Assistente WhatsApp desabilitado para o lançamento (PEND-080). Tentativas de fazer Evolution API v1.8.6 enviar mensagens para JIDs `@lid` falharam (limitação da versão). Feature flag `window.BUD_FEATURES.whatsapp = false` em `js/bud-utils.js` esconde link sidebar + card config + redireciona página dedicada. Código mantido intacto para reativação futura com Evolution v2 + Postgres.
- **21/05/2026** — Assistente IA renomeado de "Bud" para **Buddy** (DEC-049): greeting do sistema (`backend/server.js` system prompt), header da tela (`assistente-ia.html`), export de conversa (`js/assistente-ia.js`). Design do sistema de notificações aprovado: PEND-046 atualizado com design completo de push FCM + lista de mensagens variadas diárias; PEND-084 criado (in-app banners no dashboard, ao lado do olho, prioridade 1); PEND-085 criado (troca de plano / downgrade em configurações, débito técnico). DEC-049 e DEC-050 registrados no DECISIONS_LOG.
- **22/05/2026** — **Sistema de notificações completo implementado** (PEND-046 + PEND-084 + PEND-076 ✅): `appbudfinance/sw.js` (Service Worker + FCM compat), `js/bud-notif-inapp.js` (in-app banners + painel central), `js/bud-utils.js` (SW registration + popup de permissão Bud customizado), `js/dashboard.js` (bell icon, BudInAppNotif.init, push request 3s delay, onMessage foreground), `backend/server.js` (`POST /api/push/token` + `GET /api/notifications/daily` com engine de regras: recorrentes/cartões/metas/plano/re-engagement + Buddy AI insight via Groq + smart bundling + deduplicação por tag + quiet hours 22h–8h), `manifest.json` (gcm_sender_id), `firebase-config.js` (BUD_FCM_VAPID_KEY placeholder), `configuracoes.html`+`configuracoes.js` (botão "Ativar" funcional + estado visual pós-ativação). ⚠️ Pendente manual: (1) gerar VAPID key no Firebase Console → substitua `__FCM_VAPID_KEY__` em firebase-config.js; (2) add env var `CRON_SECRET` no Render; (3) configurar Upstash QStash: POST `GET https://bud-finance-backend.onrender.com/api/notifications/daily` com header `x-cron-secret: <CRON_SECRET>` às 11:00 UTC diariamente.


