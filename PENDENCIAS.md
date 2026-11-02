# PENDENCIAS.md — Registro Centralizado de Pendências

**Projeto**: Bud Finance
**Criado em**: 23/04/2026
**Última atualização**: 01/11/2026

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



## Retomada IA — 27/10/2026

| ID | Item | Status |
|---|---|---|
| PEND-IA-001 | Validar faturas reais longas e definir capacidade da Groq para lançamento. A chave local tem 1000 tokens de saída/minuto; foi configurada saída de até 900. Documentos que ultrapassem o orçamento são recusados com orientação para dividir. Aumentar a variável sem ampliar a cota pode gerar 429. | Aberto — capacidade externa |
| PEND-IA-002 | Publicar backend corrigido no Render quando o serviço for reativado; conferir `GROQ_MODEL` e `GROQ_MAX_OUTPUT_TOKENS` conforme a cota de produção. A atualização atual foi validada somente no localhost. | Aberto — publicação |
| PEND-IA-003 | Buddy continua fora do lançamento e será trabalhado como atualização futura, conforme definição do usuário. Infraestrutura de modelo corrigida e conexão local testada; não equivale à homologação do produto nem à validação de entrega FCM. | Futuro |

### Atualização das pendências IA — 27/10/2026

- **PEND-IA-001**: divisão manual deixou de ser necessária; particionamento e espera por cota foram implementados. Homologação sintética de 24 compras/3 páginas e PDF escaneado aprovada. Continua pendente dimensionar capacidade do provedor para o volume e tempo de resposta desejados em produção e testar layouts reais variados.
- **PEND-IA-004**: persistir fila/resultados de leitura para resistir a reinícios e atender múltiplas réplicas em produção. Hoje `ai-jobs.js` mantém trabalhos em memória, com isolamento por usuário e expiração dos concluídos em 30 minutos.

### Validação de desempenho — 27/10/2026

- Layout Nubank textual: caminho direto implementado, teste de 24 compras com resultado em 1,536s via HTTP assíncrono e revisão conferida no navegador interno. Fatura local de sete páginas: 42 linhas e soma líquida reconciliada, sem chamada externa.
- Outros layouts/imagens continuam sujeitos à cota Groq; não há garantia de latência universal com a capacidade atual. Para reproduzir o erro final específico relatado, ainda é necessário o arquivo exato ou nova ocorrência com mensagem/log. Não houve publicação online.

### Candidata de lançamento — 27/10/2026

Homologação das importações em Cartões/Contas/Compras/Dívidas concluída no navegador interno. Backend e configuração online ainda precisam ser publicados e validados no domínio público; Groq mantém limites externos. Pendência de persistência da fila permanece. Escopo, evidências, comandos e condições em RELEASE_IMPORTACOES_2026-10-27.md.

### Bloqueios locais corrigidos — 27/10/2026

Metas/depósitos e atomicidade, exclusão modular/recursiva, cartões em Relatórios e CORS DELETE corrigidos e testados localmente. Publicar firestore.rules e a nova rota DELETE /api/account junto do frontend. Entrega FCM real, ciclo de pagamentos, e-mails e capacidade IA online continuam por validar após Render ativo. Organização local do site difere do publicado: /budfinance/ público ainda404 e raiz pública ainda comercial. Relatório completo em RELEASE_STATUS_2026-10-27.md.

### Fechamento de e-mail e checkout — 27/10/2026

Conexão Gmail do EmailJS renovada; template de recuperação salvo e teste visual registrado com sucesso. Candidata atualizada passou31 testes e7 grupos emulados, incluindo redefinição e checkout simulado. Publicar código/regras/configurações e repetir conferência real após deploy. Cobrança efetiva e entrega dos fluxos novos pela infraestrutura de produção permanecem por confirmar. Portal raiz preparado como catálogo de produtos Bud, com Finance e caminhos separados conforme pedido.

### Mercado Pago — correção de renovação (27/10/2026)

Código de cobrança recorrente, validação de webhook, reenvio e expiração corrigido e coberto por12 testes. Restam conferir eventos/segredo no painel MP, publicar e validar checkout com sessão real. Credenciais não foram expostas; teste de cobrança efetiva não executado.

### Checkout publicado verificado — 27/10/2026

Sessão online autenticada gerou checkout real do Starter (R$9,99), com página oficial Mercado Pago mostrando Bud Soluções. Pendência de abertura do checkout resolvida para a versão publicada. Permanecem aprovação financeira/webhook/liberação de plano e deploy das correções de recorrência. Nenhuma cobrança confirmada.

### Atualização Mercado Pago com contas fictícias — 27/10/2026

Checkout oficial entre vendedor/comprador fictícios aprovado (R$9,99), fatura approved/processed conferida por API, liberação Starter e cancelamento/free conferidos com código atualizado e Auth/Firestore Emulator. Pendente: entrega externa de webhook HTTPS, correspondência do segredo no Render, publicação e conferência da candidata online. URL de teste no painel real aponta para https://budsolucoes.com.br e precisa de receptor de homologação antes de testar eventos externos. O handler foi invocado localmente com HMAC de homologação; isso não certifica entrega externa. Recorrência futura agendada não executada. Nenhum pagamento real feito.
### Validação retomada — 31/10/2026

Troca no próximo ciclo implementada conforme escolha do usuário, testada com provider MP fictício e navegador/emuladores. E-mails de confirmação/recuperação passaram pelos handlers atualizados + EmailJS real; Render recebeu cinco variáveis autorizadas e reiniciou com build antigo Live. Publicar subscription-change.js, server.js, Configurações e regras juntos. Novos bloqueios: workflow de push e deploy estão desativados manualmente; última falha de cron por billing GitHub (independente do Render). Não executar disparo diário coletivo em homologação. Detalhes, evidências e pendências restantes em RELEASE_VALIDACOES_2026-10-31.md.

## Atualização de31/10/2026 — validações finais da candidata
51 regressões,7 grupos HTTP/emulador e4 de recuperação passaram. Oito importações reais passaram; fatura longa79,6s. Armazenamento persistente implementado, ainda precisa publicar regras/índices e backend. Checkout concorrente/pendente corrigido e testado com vendedor fictício, cancelado ao final. Push:FCM aceitou envio individual, usuário NÃO recebeu; corrigido falso estado ativo/renovação desnecessária, entrega segue pendente após publicação. GitHub autenticado não mostrou alerta atual de billing; workflows seguem desativados e execução não comprovada. Pendências externas: publicação autorizada da candidata, webhook público automático assinado, dispositivo push e execução Actions; Daily Push coletivo depende de autorização específica. Buddy/WhatsApp fora do lançamento. Detalhes em RELEASE_VALIDACOES_2026-10-31.md.

##31/10/2026 — publicação autorizada e notificações
Usuário autorizou publicar backend/site/regras/índices, condicionando à correção das notificações. Correção local concluída com59regressões: somente assinatura/upgrade no app e lembretes financeiros por push, vários dispositivos e revogação individual. Login Firebase concluído com conta titular; deploy de regras/índices iniciado. Ainda confirmar deploy/código público, webhook automático e entrega física de push antes de declarar lançamento concluído.


## Atualização de 01/11/2026 — protocolo de IA e estado da inadimplência

A implementação de tolerância de cobrança, e-mails/push e retorno ao Gratuito foi integrada no commit `c42e640` e publicada no Static Site do Render; o registro detalhado está em `RELEASE_INADIMPLENCIA_2026-11-01.md`. A versão pública da Política de Privacidade é 1.6. A suíte de release passou com 80 testes; regras Firestore foram implantadas. O workspace Render verificado mostrou apenas o Static Site; embora `/api/ping` responda, ainda falta confirmar qual revisão do serviço Web `bud-finance-backend` está em execução. Portanto, a automação backend permanece pendente de confirmação de deploy/configuração; não houve envio real, cobrança ou cancelamento de assinatura nesta validação. Próximo passo e evidências atuais: `AI_HANDOFF.md`.

A partir desta data, Codex, Claude e qualquer IA com acesso devem seguir `AI_WORKFLOW.md`, iniciado pelas instruções em `AGENTS.md`/`CLAUDE.md`. Atualizar o handoff versionado ao assumir e encerrar tarefas relevantes, além dos registros de pendência, decisão, arquitetura, erro e release que forem afetados.


## Atualização de 01/11/2026 — destino após confirmação do e-mail

### PEND-AUTH-086 — Link mágico da confirmação deve abrir onboarding primeiro

- **Status:** ✅ Resolvido, integrado e publicado no `master` em 01/11/2026 (commit `f3c0453`); GitHub Actions `41338154393` concluiu com sucesso, incluindo regressões de release e deploy do GitHub Pages.
- **Causa:** a confirmação autentica a conta com token customizado e enviava para a dashboard; o guard da dashboard detectava onboarding pendente e redirecionava novamente, causando o salto visível.
- **Correção:** após validar o link mágico e autenticar, o destino inicial agora é `onboarding.html`. O próprio fluxo do onboarding direciona à dashboard somente quando concluído.
- **Validação:** o workflow automático de release passou e o deploy do GitHub Pages concluiu. A jornada completa com cadastro novo e clique real no e-mail ainda precisa de validação manual ponta a ponta.


## PEND-REF-001 — programa de indicação (01/11/2026)

- **Status:** 🟡 Regra comercial decidida; implementação e suíte automatizada passaram em PR. Aguarda homologação do Mercado Pago sandbox, revisão final e publicação.
- **Decisão aprovada:** novo usuário com código válido recebe 15% de desconto apenas na primeira cobrança aprovada; quem indicou recebe 50% em uma próxima cobrança, uma única vez por conta. Os dois descontos nunca se acumulam no mesmo ciclo. Se o indicado também convidar outra pessoa, sua própria recompensa de 50% fica para uma cobrança posterior à sua cobrança inicial com 15%. Indicações excedentes não geram outra recompensa.
- **Implementação preparada:** código opcional por link, cadastro e etapa “Indicação” do onboarding; validação server-side antes do primeiro checkout; propagação para checkout autenticado; recompensa concedida somente após pagamento inicial aprovado; atualização e restauração do valor recorrente na assinatura existente; tela de Configurações mostra código e estado do benefício.
- **Próximo passo:** homologar cada sequência no sandbox (incluindo sem sobreposição e restauração do preço regular), então integrar e confirmar deploy. Nenhuma cobrança real foi executada.


## Homologação de indicações concluída — 01/11/2026

PEND-REF-001: etapa de sandbox RESOLVIDA no código 438a21418128f562d965f6d3eb5587afaef83abe. Pagamentos fictícios aprovados de R$ 8,49 (15%) e R$ 5,00 (50%); handlers restauraram R$ 9,99 via API. Indicação em cadeia agendou 50% na próxima competência, sem acúmulo por reenvio ou excedentes. Upgrade confirmou R$ 14,95 e restauração de R$ 29,90 após pagamento futuro emulado. Suíte: 84 aprovados, zero falhas. Sete contratos fictícios cancelados e conferidos. Auth/Firestore representados em memória; entrega pública do webhook e cobrança mensal futura não foram revalidadas nesta etapa. Relatório: RELEASE_HOMOLOGACAO_INDICACOES_2026-11-01.md. PR #5 ainda não integrado/publicado. Próximo passo: revisão final, integração/deploy autorizados e verificação pública. Workspace original preservado.


## Correção da espera de importação IA — 01/11/2026

ERR-071 / PEND-IA-ESPERA: a mensagem aguardando serviço vem do retry HTTP 429; até 12 esperas longas e polling/worker sem prazo mantinham a interface aberta. Correção em codex/corrige-importacao-ia-travada-20261101: tentativas curtas e limitadas, worker com prazo de 180s, registro persistente antigo encerrado, cliente com 210s totais/30s por conexão e mensagens de falha/cancelamento claras. 91 regressões aprovadas. Detalhes em RELEASE_IA_ESPERA_2026-11-01.md. Integração/deploy em preparação. Indicações: PR #5 integrado em 3d6f5f4; Pages 41344526378 aprovado e backend Render Live confirmado. Regras de indicação compiladas e publicadas no projeto bud-finance em 01/11/2026. Workspace original preservado.


## Publicação confirmada — indicações e importação IA (01/11/2026)

- PEND-REF-001: descontos 15%/50% homologados e PUBLICADOS. PR #5 integrado em 3d6f5f4c831498a8938d4ba1ba463197a2c439ae; Pages 41344526378 aprovado e Render Live confirmado. Regras do Firestore compiladas e publicadas no projeto bud-finance após login do titular.
- ERR-071 / PEND-IA-ESPERA: RESOLVIDO E PUBLICADO pelo PR #6, commit e50356c715886cb9a25d371c67345c4096eebaab. CI do PR 41345953909 e Pages 41346014030 aprovados; Render Live no mesmo commit. HTTP 200 no JavaScript público confirmou prazo global de 210s, mensagem de conexão indisponível e retirada do aviso antigo de 45s.
- Validação: 91 regressões aprovadas; limites persistentes do provedor, workers travados, registro antigo com lease ativa, ausência de resposta e preservação de documentos extensos/PDF/imagem. Fluxos de falha emulados; a fatura original da captura não foi fornecida. Não afirmar que a capacidade do provedor de IA é ilimitada nem que a fatura original foi reimportada.
- Decisão operacional: três tentativas no provedor; esperas de até 15s e total de até 20s por solicitação; worker de 180s; cliente de 210s e conexão de 30s. Falha é explícita, libera a interface/admissão e não retorna transações parciais.
- Relatórios: RELEASE_IA_ESPERA_2026-11-01.md e RELEASE_HOMOLOGACAO_INDICACOES_2026-11-01.md. Código e alterações preexistentes do workspace original preservados; registros locais de continuidade foram atualizados. Próxima reprodução específica depende do documento original, se o usuário relatar erro após atualizar a página.

## Atualização de capacidade de IA — 01/11/2026

- **PEND-IA-002 — RESOLVIDO/PUBLICADO:** backend com encerramento explícito das tentativas, prazos e cancelamento de trabalhos travados está no Render desde o commit `e50356c`. A captura do usuário, feita às 17:24, mostra a mensagem `Serviço de IA ocupado. Nova tentativa em 10 segundos (1/2)`, emitida pelo leitor após resposta HTTP 429 da Groq. É a primeira tentativa de espera deste segmento da leitura; se a capacidade continuar indisponível, o backend encerra com erro. A mensagem confirma limite/capacidade do provedor para esta chamada, não uma leitura concluída nem falha comprovada de parsing.
- **PEND-IA-001 — segue aberta:** medir consumo, limites efetivos e taxa de sucesso em faturas reais variadas. A contratação do Groq Developer fica para o futuro (DEC-069); aumenta capacidade, mas não remove limites nem garante disponibilidade ilimitada.
- **PEND-IA-005 — FUTURO:** avaliar arquitetura própria/híbrida para reduzir dependência de um único fornecedor: extração direta de texto e parsers de layouts conhecidos, OCR local e modelo visual de pesos abertos em infraestrutura com GPU. Comparar precisão em faturas reais anonimizadas, velocidade, custo de GPU, manutenção e necessidade de fallback. Não contratar infraestrutura nem implementar sem decisão posterior.
- Cotas do produto e do provedor são camadas diferentes. O master define processamentos inteligentes mensais por usuário: Free 0, Starter 3, Trial 10, Pro 10 e Plus sem limite prático no app. Mesmo Plus depende da capacidade global da organização Groq; a captura mostra 429 do fornecedor, não bloqueio do plano Bud.
- A captura é apenas da tela de progresso. Para reproduzir o layout e identificar por que esta fatura caiu na IA, é necessário o PDF original ou registros de uma nova tentativa.

## Diagnóstico adicional IA — 01/11/2026

- **PEND-IA-006 — ABERTA:** corrigir/testar parser determinístico Nubank para variações de extração de texto e linhas de total, usando fixtures sintéticas sem dados pessoais; aceitar o caminho direto somente quando a soma conciliar exatamente. O PDF real enviado foi reconhecido como Nubank, mas não conciliou e iria para IA. Nenhum dado do documento foi armazenado ou enviado à Groq durante esta análise.
- Cotas Groq têm janelas independentes por organização/modelo (requisições e tokens por minuto/dia); usar `retry-after` e `x-ratelimit-reset-*` para entender o reset concreto. Um retry de 10s não comprova que todas as cotas estarão disponíveis depois dele.

## Correção de importação e renovação de sessão — 01/11/2026

ERR-072 / PEND-IA-006: correção implementada. PDF Nubank real analisado localmente com o mesmo readPDF de produção: 51 linhas, diferença de um centavo entre soma e total. Parser aceita apenas variação de até 1 centavo, preserva linhas/total e retorna differenceCents/requiresReview; revisão mostra aviso explícito. Diferenças maiores seguem para IA. Não cria ajuste e não presume arredondamento do banco. Rótulo de total permite moeda adjacente. Nenhum dado financeiro real incluído em fixtures ou Git.

Firebase: chave Bud Finance Web não permitia securetoken.googleapis.com, bloqueando renovação de sessão. Serviço acrescentado à lista existente sem remover restrições; operação concluída e probe com refresh inválido retornou INVALID_REFRESH_TOKEN, em vez de API_SERVICE_BLOCKED. A confirmação com sessão real do titular ainda depende de abrir novamente o app.

Validação: 92 testes aprovados, zero falhas; PDF real aceito pelo parser local sem chamada Groq, 51 linhas e aviso de um centavo. Não confundir isso com validação autenticada no navegador online. Groq permanece para layouts desconhecidos/imagens; capacidade externa continua finita (DEC-070). Publicação em preparação.


## Correção de importação e renovação de sessão — 01/11/2026

ERR-072 / PEND-IA-006: correção implementada. PDF Nubank real analisado localmente com o mesmo readPDF de produção: 51 linhas, diferença de um centavo entre soma e total. Parser aceita apenas variação de até 1 centavo, preserva linhas/total e retorna differenceCents/requiresReview; revisão mostra aviso explícito. Diferenças maiores seguem para IA. Não cria ajuste e não presume arredondamento do banco. Rótulo de total permite moeda adjacente. Nenhum dado financeiro real incluído em fixtures ou Git.

Firebase: chave Bud Finance Web não permitia securetoken.googleapis.com, bloqueando renovação de sessão. Serviço acrescentado à lista existente sem remover restrições; operação concluída e probe com refresh inválido retornou INVALID_REFRESH_TOKEN, em vez de API_SERVICE_BLOCKED. A confirmação com sessão real do titular ainda depende de abrir novamente o app.

Validação: 92 testes aprovados, zero falhas; PDF real aceito pelo parser local sem chamada Groq, 51 linhas e aviso de um centavo. Não confundir isso com validação autenticada no navegador online. Groq permanece para layouts desconhecidos/imagens; capacidade externa continua finita (DEC-070). Publicação em preparação.

## Complemento após teste online (01/11/2026)
Primeiro deploy 9f52582 (PR #10) chegou ao Render Live e abriu revisão online com51 linhas. A conferência revelou heurística cliente que confundia compras de mesmo valor com estornos e seleção não preservava a soma líquida. Corrigido no caminho PDF validado: signedAmounts mantém sinais/linhas, créditos negativos selecionados individualmente, nenhuma inferência por valor. Script versionado para evitar cache antigo. 93 testes aprovados. Somente revisão testada; nenhum lançamento salvo. Publicação complementar em preparação.



## Confirmação final — Nubank e sessão online (01/11/2026)

RESOLVIDO E PUBLICADO: PR #10 (9f52582) e PR #11 (aea9b41b572f40a71d9ac6bf9301b4c53f48bc32). Render confirmou Live aea9b41; Pages 41359548750 concluído com sucesso. 93 regressões aprovadas; CI do PR11 41359482382/41359476868 aprovado. No navegador interno autenticado, o PDF real abriu a revisão com 51 linhas e 51 checkboxes selecionados, preservando sinais, sem depender de chamada Groq. Aviso explícito da diferença de R$0,01 exibido. Revisão ficou aberta para o titular; nenhum lançamento salvo. Após rollout, repetir leitura confirmou correção também da seleção (primeira tentativa durante troca de instância ainda usou resultado antigo). Firebase Secure Token API está permitida na chave Web; probe retornou INVALID_REFRESH_TOKEN para token propositalmente inválido, eliminando API_SERVICE_BLOCKED, e login/análise autenticada passaram. PEND-IA-006 / ERR-072 resolvidos para este layout; outros layouts/imagens permanecem sujeitos à capacidade Groq. Não generalizar a validação desta fatura para qualquer documento.

## PEND-IA-ESTORNOS — correção de regressão após salvar (01/11/2026)
Implementada e validada localmente com 95 regressões; publicação em preparação. Pares comprovados compra/estorno são excluídos juntos; crédito sem par reduz a fatura. Total selecionado reflete o que será salvo; bloqueios contra seleção divergente e duplicação. Registros reais afetados foram reparados transacionalmente sem exclusões; detalhes sem PII em RELEASE_ESTORNOS_2026-11-01.md. Retifica conclusão anterior que validou apenas revisão.


## Identificação de estornos por linha — 01/11/2026
A regra de pareamento DEC-072 foi revogada: sem vínculo explícito do fornecedor, semelhança de descrição/data/valor não comprova cancelamento de compra. Cada valor positivo permanece compra ativa. Cada valor negativo explícito permanece devolução, com rótulo Estorno / devolução — abate o total da fatura; status interno credito representa abatimento de despesa, nunca receita. No caminho PDF validado todas as linhas originais são elegíveis, com controles habilitados; saldo líquido e guard de conciliação impedem salvar apenas compras omitindo devoluções. Removidos pareamento e rótulo crédito sem compra identificada. 95 regressões aprovadas, incluindo compras/devoluções na mesma data com mesmo valor e persistência/recálculo. Tentativa de rever reparação anterior foi interrompida sem gravações por precondição; consulta atual encontrou zero lançamentos na fatura/cartão anterior, portanto nada foi recriado. Não sobrescrever alterações do titular. Publicação em preparação. Esta atualização substitui os registros anteriores de exclusão automática dos pares.
## Revisão segura de estornos e conferência — 01/11/2026

Regra aprovada pelo titular: compra e devolução ficam desmarcadas juntas apenas com vínculo seguro; recompra permanece ativa. Identidade por mesmo valor/estabelecimento/data não basta. Implementação usa identificador bancário OFX compartilhado, exatamente duas linhas de sinais opostos e saldo zero; grupos ambíguos e estornos parciais permanecem separados. Sem identificador, o PDF mantém compras e abatimentos assinados e exige revisão; não declarar que os estornos desse PDF foram todos pareados. Seleção de um par identificado é conjunta; alteração que quebre saldo zero é bloqueada antes de salvar. Ação em massa Compras e abatimentos preserva devoluções sem par. Edição preserva sinal negativo.

Barra de conferência restaurada como progressbar visível e atualizada a cada seleção/valor: compara a soma selecionada ao total declarado, informa divergência exata, inclusive um centavo, e não afirma precisão universal nem 100% para OFX. Sem referência, informa impossibilidade de conciliação automática. Valores originais preservados, sem ajustes sintéticos. Guardas de duplicação e total permanecem.

Histórico verificado: e50356c (espera infinita) alterou apenas 2 linhas de cartoes.js relacionadas à espera; a classificação anterior já continha exclusão de negativos, FITID e inferência por valor. Portanto, a regra segura atual não era integralmente garantida antes. Alterações posteriores do parser/seleção alteraram o comportamento, documentadas nos PR10/11/13/14.

Validação: 97 regressões passaram; após ampliar o teste de persistência do par+recompra, 10 testes específicos passaram. Teste VM executa processamento, gravação e recálculo reais com Firestore emulado: somente a recompra é salva; valores repetidos sem identificador não são associados. Teste da barra cobre seleção que aumenta o total e divergência de um centavo. Deploy e inspeção pública pendentes neste registro.

Conta do titular: Plus concedido por autorização expressa e precondição Firestore; expiração de trial removida, nenhuma cobrança criada. Validação anterior online do PR14 abriu 51 linhas selecionadas e zero controles bloqueados, sem gravar lançamentos. Esta concessão substituiu a proposta de devolver quatro usos. Groq permanece com capacidade finita para imagens/layouts sem parser; Developer é aquisição futura. Não anunciar disponibilidade universal ilimitada.

Continuidade Claude/Codex: workspace original tem alterações preexistentes; preservá-las. Trabalho isolado em .tools/invoice-reconciliation-ui, branch codex/revisao-estornos-conciliacao-20261101. Próximo passo: conferir CI/publicação e a barra no app online. Nenhum dado financeiro privado incluído no Git; nenhum registro do usuário recriado ou salvo nesta entrega.


## Complemento da validação real — 01/11/2026
PR16 integrado em 00dcd47; CI41365013209/41365000333 e Pages41365083232 passaram. PDF real abriu revisão online com barra e aviso de um centavo, sem salvar. Ao desmarcar um abatimento, o total mudou mas o badge não atualizou: a inspeção real detectou integração ausente entre resumo e badge, causada por substituição que não correspondeu aos finais de linha CRLF. Corrigido com chamada explícita no resumo e teste que executa esse caminho real, em vez de chamar apenas o badge. Propriedade refundPair e handler conjunto também integrados e cobertos por teste de clique; recompra preservada. PR17 a92b1e1 preserva pagamento recebido fora dos abatimentos OFX. Suite final: 99 testes aprovados, incluindo pagamento anterior, par seguro, recompra, persistência e recálculo, seleção e atualização da barra. Nova publicação em preparação; não declarar o clique online corrigido até validá-lo após deploy. Nenhum lançamento do titular gravado.




## Conferência online encerrada — 02/11/2026
RESOLVIDA a pendência de conferência visual após o PR18 (ab1e2796f639655dbc2e113c41b632bfe63dee0f; Pages41365552682 aprovado anteriormente). Nesta sessão, o app online autenticado carregou invoice-refunds.js e cartoes.js na versão 20261101-refund-reconcile2. O PDF real abriu revisão com 51 linhas selecionadas e barra visível. Ao desmarcar uma devolução, total e divergência do badge mudaram juntos; ao remarcar, a soma original e o aviso de diferença de um centavo foram restaurados. Resultado correto no clique real, sem salvar novos lançamentos. O cartão já apresentava 51 registros ao abrir a sessão; não foram alterados nem recriados.
A validação abrange análise, seleção e atualização visual em produção. Pares identificados e recompra seguem cobertos pelas 99 regressões da entrega; não afirmar que este PDF tem identificador suficiente para parear devoluções. Divergência de um centavo permanece revisão explícita, sem ajuste inventado. Limites globais Groq continuam pendência operacional independente. Claude/Codex: este registro substitui o status anterior de última conferência pendente; preservar alterações preexistentes e documentar próximos avanços.


## Categoria padrão de estorno — 02/11/2026
A pedido do titular, Estorno / devolução incluída exclusivamente nas categorias padrão de despesa (categorias-padrao.js). A revisão de faturas (cartoes.js) prioriza esta categoria para status credito e descrições explícitas de estorno/devolução/reembolso; não usa Outros nem a categoria do estabelecimento para esses itens. Preserva valores negativos, seleção, pares, conciliação e persistência como despesa; não cria receita. Compras normais e pagamentos de fatura mantêm a classificação anterior. Não migra registros existentes. Teste específico cobre categoria padrão presente uma vez em despesas e ausente em receitas, classificação e sinais; 13 testes de fatura aprovados. Publicação em preparação na branch codex/categoria-estorno-padrao-20261102. Claude/Codex: preservar a regra de abatimento, sem inflar renda.
## Correção de leitura de contratos em Dívidas — 02/11/2026

Diagnóstico reproduzido com os dois PDFs privados do titular (80 e 6 páginas): Dívidas extraía texto/OCR localmente e aplicava regexes genéricas, sem chamar Groq. Capturava quantidade de parcelas de material educativo anterior ao quadro resumo e banco mencionado em outro contexto; locação não tinha regras para aluguel inicial e prazo escrito entre parênteses. Percentual da captura era soma de campos preenchidos, não confiança de IA. Também permitia salvar dívida com valores zerados.

Implementação: contract-reader.js puro, carregado antes de dividas.js. Prioriza seção contratual do quadro resumo, separa entrada, parcela financiamento bancário, pré-chaves, intermediárias e pós-obra. Usuário escolhe explicitamente um bloco; totais de séries mensais são nominais e não incluem reajustes. Não presume prazo ou prestação do banco quando o contrato de compra não os informa; não usa preço do imóvel como saldo devedor e não presume entrada paga. Locação extrai aluguel mensal, prazo, total base e início; não transforma multa/juros de atraso em taxa de financiamento, banco de recebimento em credor, início ou tolerância em primeira data de vencimento. Último dia útil requer confirmação manual de data; reajustes e feriados não são automatizados nesta entrega.

UI: mostra blocos selecionáveis, avisos e campos essenciais identificados, em vez de percentual de confiança artificial. Salvar direto bloqueado sem total, quantidade, valor de parcela e primeiro vencimento válido; edição manual preserva os campos encontrados. Seleção vazia/mudança de bloco não mistura obrigações. Parcela paga é apenas a confirmada pelo usuário; atraso não conta como pagamento.

Validação: 103 regressões passaram, inclusive testes de resumo versus exemplos, obrigações separadas, aluguel com tolerância, datas inválidas e execução do preview/seleção/save com Firestore emulado. PDFs reais extraídos integralmente em leitura local, reconhecidos com os campos previstos; páginas financeiras conferidas visualmente. Dados privados, PDFs, extrações e PNGs permanecem fora do Git em .tools/contracts-private. Nenhuma dívida do titular salva ou alterada. Publicação e teste no navegador online ainda pendentes neste registro.

Arquivos: appbudfinance/js/contract-reader.js, appbudfinance/js/dividas.js, appbudfinance/dividas.html, tests/contract-reader.test.js, package.json. Branch codex/corrige-leitura-contratos-20261102 em .tools/contracts-fix. Claude/Codex devem preservar separação de obrigações e não afirmar leitura universal infalível nem substituir confirmação de dados ausentes por zeros. Limites Groq são independentes; estes dois caminhos rodam localmente.




## Contratos validados online — 02/11/2026
RESOLVIDO E PUBLICADO: PR21 integrado em25b88bd54f0a4f28101f25bf943ad2485b055d69; CI41476451260/41476434268 e Pages41476609879 aprovados. Navegador autenticado leu os dois PDFs reais: Tenda identificou sete obrigações, seleção pré-chaves mostrou os quatro campos essenciais e liberou salvar; parcela bancária permaneceu bloqueada por ausência de prestação/prazo/vencimento. Aluguel mostrou valor mensal, prazo e total base, sem confundir banco de recebimento/juros de mora com financiamento; pediu confirmação da primeira data efetiva. Nenhuma dívida real foi salva. Inspeção via DOM confirmou ausência de erro visível nos dois casos. Extrações privadas não estão no Git.
Ajuste final de apresentação: antes de escolher bloco, mostrar quantidade de obrigações e instrução de seleção, em vez de zero campos/nenhum dado. Três regressões específicas passaram após esse texto; suíte de103 aprovada antes. Nova versão de cache20261102-contracts2. Este ajuste visual ainda aguarda publicação nesta anotação; a extração financeira já foi validada em produção. Claude/Codex: não assumir prestação bancária, pagamento realizado, correção futura ou data útil que o contrato não forneça. Pode exigir revisão manual de campos ausentes; não é falha do Groq e não usa cota externa nesses dois layouts.


## Encerramento da correção de contratos — 02/11/2026
RESOLVIDO E PUBLICADO. PR21 (25b88bd) corrigiu extração/seleção e PR22 (b0bc0520eb4be4ca41d6904a37a20da0683ce04a) finalizou apresentação; Pages41477488655 e CI41477333202/41477315962 aprovados. Versão pública20261102-contracts2 conferida por HTTP e DOM. Ambos os PDFs reais foram testados em produção autenticada, sem salvar dívidas. Pré-chaves mostrou os quatro campos essenciais corretos; banco sem condições completas permaneceu bloqueado. Aluguel mostrou mensalidade/prazo/total base e pediu primeiro vencimento, preservando valores no formulário manual. Após o último deploy, Tenda mostrou sete obrigações e instrução de seleção, sem a mensagem falsa de nenhum dado; salvar bloqueado até escolher bloco válido. 103 regressões aprovadas e testes específicos do ajuste visual aprovados.
A pendência desta correção está encerrada. Permanecem limitações declaradas: prestação/prazo efetivo do banco dependem do contrato bancário, vencimentos úteis e reajustes futuros exigem confirmação; nenhum valor ausente é inventado. Não migrar ou criar dívidas do titular a partir desta validação. PDFs/extrações/PNGs privados não foram enviados ao Git. Esta anotação atualiza os estados anteriores de publicação/validação pendente para continuidade Claude/Codex.
## Cadastro conjunto de obrigações contratuais — 02/11/2026

Pedido do titular: selecionar várias/todas as obrigações de um documento, completar dados por obrigação e cadastrar as completas juntas, preservando pendências na revisão. Substitui a limitação de um bloco por importação do PR21/22.

Implementação: seleção por checkbox, Marcar todas / Só completas / Desmarcar todas; revisão individual de nome/credor, instituição, valor total/base, quantidade, parcela, primeiro vencimento e pagas. Completar uma obrigação não altera as demais. Totais nominais derivados acompanham parcela/quantidade; total editado manualmente não é sobrescrito (principal bancário pode diferir da soma de prestações). Contagem do botão informa quantas completas serão cadastradas e quantas selecionadas ficam pendentes. Rascunho permanece nesta revisão, em memória; trocar documento/iniciar nova dívida/recarregar descarta o rascunho não salvo, informado na tela. Não prometer persistência entre sessões.

Persistência: uma transação Firestore cria um documento por obrigação completa, de forma atômica. ID determinístico combina SHA-256 do texto normalizado do contrato com índice do bloco, no namespace da conta. Lê antes de criar: retry/reenvio do mesmo texto/bloco não duplica nem sobrescreve registro existente. Não equivale a detecção universal de contratos exportados com texto diferente nem migra importações antigas com IDs aleatórios. Em erro, seleção/campos são preservados; resposta incerta pode ser reconsultada com o mesmo ID. Callback transacional não altera UI durante retries. Botão duplo e mudança de arquivo enquanto salva são bloqueados. Obrigações já confirmadas ficam desabilitadas; pendentes selecionadas mantêm edições para completar e salvar depois na mesma revisão. Nenhuma pendente recebe zeros ou datas inventadas.

Testes:108 regressões aprovadas. Cobrem seleção múltipla, quatro blocos completos de fixture mais duas pendências, completar pendentes depois, documentos separados com seus valores e pagos, clique repetido, falha antes do commit sem gravação, resposta incerta após commit e retry sem duplicar/alterar registro já editado pelo titular; edição isolada e datas/pagas inválidas; hash estável por espaços; troca de contrato para aluguel sem vazar estado; fluxo singular de aluguel preservado. O teste de PDF de seis páginas inclui o novo estado de salvamento no harness.

Arquivos: contract-reader.js (fingerprint/pendências/plano), dividas.js (UI e transação), dividas.html (cache20261102-contracts-batch), testes contract-reader e import-screens. Sem mudanças de backend ou regras. Nenhuma dívida real cadastrada ou alterada nos testes. Publicação e QA online pendentes nesta anotação. Trabalho isolado em .tools/contracts-batch-fix, branch codex/cadastro-multiplo-contratos-20261102. Claude/Codex: preservar semântica de obrigações separadas, não misturar parcelas bancárias e da construtora, não gravar dados reais sem autorização específica, e manter os registros atualizados.




## Cadastro múltiplo publicado e conferido — 02/11/2026
RESOLVIDO E PUBLICADO no PR24, commitafb6a43494855922a11565f869207e0d8adf0f30. CI41480813091/41480798809 e Pages41481162416 aprovados. Versão pública20261102-contracts-batch conferida por HTTP e navegador autenticado. Contrato real abriu sete checkboxes e49 campos individuais. Marcar todas selecionou sete e informou cinco completas/duas pendentes; botão das cinco completas disponível. Só completas selecionou cinco sem pendências selecionadas; voltar a Marcar todas preservou os valores. Edição da parcela pré-chaves com o próprio valor do documento foi preservada na alternância e não alterou a pós-obra. Sem erro visível. Nenhum botão de cadastro foi acionado na conta real, nenhuma dívida criada/alterada.
Gravação atômica, retry e proteção contra duplicação/sobrescrita foram validados em simulação pelos108 testes aprovados, não por gravação real em produção. Pendências ficam na revisão em memória; trocar documento/iniciar nova dívida/recarregar descarta o que não foi salvo, conforme aviso da tela. Autorização atual é de implementação/publicação, não de criar dívidas de teste na conta do titular. Esta anotação encerra a pendência de UI/publicação e substitui os estados anteriores; Claude/Codex devem manter o mesmo registro de evidências e limites.
## Identidade visual, data e encerramento do cadastro contratual — 02/11/2026

Pedidos do titular: aplicar IDV aos botões, identificar/formatar data e fechar popup ao concluir o cadastro. Mudanças em dividas.html/dividas.js: ações de seleção uniformes com cores do tema, tipografia herdada, bordas arredondadas, hover/foco/disabled e adaptação mobile; botão de cadastrar reutiliza wizard-btn-next; revisar/completar tem estilo próprio coerente e campos usam modal-input. Data tem ícone de calendário, placeholder DD/MM/AAAA, teclado numérico e máscara aplicarMascaraData já usada no app;10102026 torna-se10/10/2026, validada antes de salvar, sem converter datas inválidas.

Sucesso confirmado da transação fecha o popup, inclusive quando apenas as completas foram cadastradas; falha mantém revisão/campos para nova tentativa. Havendo pendentes selecionadas após sucesso, aviso na lista de Dívidas permite Revisar pendentes ou Descartar rascunho; iniciar Nova dívida retoma a pendência em vez de apagá-la silenciosamente. Descartar limpa apenas memória, nunca documentos salvos. Trocar documento ou recarregar ainda descarta rascunho não salvo, avisado na interface. Esta decisão substitui manter popup aberto após cadastro parcial, descrito no release de lote. Nenhum dado financeiro alterado por estes ajustes de interface.

109 regressões aprovadas: máscara com8 dígitos, validação de data, fechar após sucesso com pendentes, manter aberto em falha, retomar revisão preservada e descartar sem excluir dívidas, além da suíte financeira anterior. Testes de persistência seguem em simulação; não cadastrar dívidas reais para conferir interface. Branch codex/design-e-data-contratos-20261102, cópia .tools/contracts-design-fix. Publicação e conferência visual online pendentes neste registro. Atualizar handoff/pendências após implantação para Claude/Codex.




## Interface contratual publicada e validada — 02/11/2026
RESOLVIDO E PUBLICADO no PR26, commitff14e909fe6a41584d71dbffbb8ea3691a4fa5e6. CI41483774957/41483754440 e Pages41483903534 aprovados; versão20261102-contracts-design confirmada por HTTP e navegador autenticado. Botões de seleção conferidos visualmente e por DOM: Inter, peso700, raio12px, estados do app; CTA reutiliza wizard-btn-next e campos modal-input. Teste real digitou10102026 na data da entrada e recebeu10/10/2026 com ícone de calendário, placeholderDD/MM/AAAA e validação; o campo de teste foi limpo em seguida. Nenhum cadastro acionado em produção e registros preexistentes do titular preservados.
109 regressões aprovadas, incluindo fechamento após confirmação de cadastro com pendências, manutenção do popup em falha, retomada das pendentes e descarte apenas do rascunho sem excluir dívidas. Fechamento/retomada foram validados em simulação, não com nova gravação real. Fluxo final: _salvarBlocosContrato confirma transação, fecha popup e atualizarAvisoPendenciasContrato cria aviso na lista; _retomarPendenciasContrato reabre a revisão preservada. Nova dívida retoma pendência existente após sucesso; descartar limpa memória. Recarregar/trocar documento ainda perde rascunho não salvo, conforme avisos. Esta anotação encerra publicação/QA pendentes dos registros anteriores e é a referência atual para Claude/Codex.

## Pagamento de parcelas na própria dívida — 02/11/2026
Implementado e validado localmente; publicação em preparação. Dívidas abre popup com data DD/MM/AAAA e escolha entre conta e apenas marcar como pago; não exige Dashboard. Com conta, uma transação Firestore grava parcela, despesa, saldo e histórico. Sem conta, apenas dívida e histórico, sem despesa geral. A aba Extrato mostra valor, data efetiva, vencimento, conta/modo e desfazer; registros antigos sem esses dados ficam explicitamente incompletos, sem inferir conta do contrato. Dashboard reutiliza serviço e popup para dívidas. Não realiza transferência bancária.
Preserva modelo de parcelas pagas consecutivas: clicar numa parcela posterior pede confirmação explícita de todo o intervalo pendente e seu total. Desfazer apenas a última; devolve à conta original do pagamento, não à conta padrão atual, e mantém auditoria. Parcelamento de fatura libera limite reservado nas duas opções; desfazer restaura o valor exato liberado. Migração legada não fabrica despesas para registros novos sem conta.
Arquivos novos debt-payments.js e debt-payment-dialog.js; integração em dividas.js/html e dashboard.js/html. Histórico em usuarios/{uid}/pagamentos-dividas; regras genéricas existentes de proprietário já cobrem a coleção. Sem backend/regras novas. 117 testes de release aprovados (8 novos casos financeiros com adaptador transacional em memória). Teste local em Edge headless 375px passou: seleção de conta, máscara, erro preservado, retry, fechamento, marcar sem conta e cancelar. Sintaxe e diff conferidos. Não afirmar teste de escrita real no Firestore: nenhuma parcela/conta real foi alterada. Branch codex/pagamento-parcelas-na-divida-20261102, clone .tools/debt-payment-fix. Próximo passo: publicar e conferir popup/extrato online sem confirmar pagamento real. Atualizar este registro com commit e deploy para Claude/Codex.


## Pagamento em Dívidas publicado e conferido — 02/11/2026
RESOLVIDO E PUBLICADO pelo PR28, commit36822e65fe1bcb9247a74147fb6611e4b218984e. CI41488897583/41488880756 e Pages41489122282 aprovados. HTTP200 confirmou versão20261102-payment e serviço público. No navegador autenticado: clicar na primeira parcela abriu popup na própria Dívidas; data local correta; contas de débito/espécie carregadas; seleção de conta e opção apenas marcar funcionaram; confirmar ficou disponível após escolha. Clicar na segunda parcela mostrou explicitamente intervalo1a2 e valor total dobrado. Ambos cancelados sem confirmar. Aba Extrato consultou a coleção com sucesso e mostrou vazio para dívida sem pagamentos. Nenhuma parcela, dívida, transação ou saldo real foi alterado nesta conferência.
117 regressões aprovadas e teste local mobile Edge aprovado; gravação, idempotência e reversão financeira validadas com adaptador transacional em memória, não por escrita real no Firestore. Não afirmar execução de transferência bancária: o app só registra o pagamento informado. Extrato preserva data efetiva, vencimento, valor, conta/modo e desfazer; sem conta não gera despesa geral. O código compartilhado também atende lembretes de dívida da Dashboard. Esta anotação encerra publicação/QA pendentes do registro anterior; Claude/Codex devem preservar estas regras e atualizar os documentos a cada evolução. PDF privado não foi enviado ao Git.



## Aviso no simulador de quitação — 02/11/2026
Pedido do titular implementado em appbudfinance/dividas.html: aviso permanente no rodapé do popup, comum a Pagamento Extra e Quitar Tudo. Texto: “Estimativa baseada nos dados informados por você ou extraídos por IA. O valor pode diferir do cobrado pelo credor. Confirme diretamente com ele antes de pagar.” Usa tipografia e cor secundária do tema. Não muda fórmulas nem registros financeiros. Validação visual local e publicação em preparação na branch codex/aviso-simulador-20261102, cópia .tools/debt-simulator-note. Próximo passo: validar layout, publicar e conferir aviso público; atualizar continuidade para Claude/Codex.



## Metas: compra mista, extrato por conta e conclusão — 02/11/2026
IMPLEMENTADO E VALIDADO LOCALMENTE; publicação pendente. Titular autorizou planejamento e confirmação de compra com reserva, várias contas e cartões parcelados; acrescentou extrato de aportes e bloqueio de novos depósitos após alcançar meta.
Diagnóstico online somente leitura: busca Aporte no Extrato encontrou os registros existentes, incluindo o valor relatado. Estavam após os50 primeiros itens por haver compras de cartão com datas futuras no mesmo extrato geral. Nenhuma transação recriada nem saldo do titular alterado. Botão Extrato de cada conta agora informa contaId; página filtra carteiraId/contaId sem incluir crédito, incluindo registros antigos. Aportes antigos sem categoria ganham rótulo Metas na apresentação; novos levam categoria, conta, data e status explícitos.
Nova opção Meta de compra no cadastro/edição (metas antigas continuam reserva até escolha explícita). Botão Planejar compra admite até8 formas diferentes e1a48 parcelas por cartão, data DD/MM/AAAA, valor final e reserva. Salvar plano não movimenta saldo/limite e permite distribuição incompleta. Confirmar exige declaração de compra já realizada e soma exata; valida saldo/limite/datas atuais. Valores informados devem incluir juros acordados: não contrata crédito nem calcula CET. Dia do fechamento envia para próximo ciclo; vencimento anterior/igual ao fechamento cai no mês seguinte; meses curtos são ajustados. Centavos distribuídos sem alterar total. Usuário deve conferir datas com emissor.
Depósitos já debitam a conta e são despesas desde o modelo anterior: consumir reserva não debita nem gera despesa de novo. Valor inicial já guardado é considerado reserva externa às contas, explicado no popup. Compra usa reserva até valorAtual e preserva restante; porção nova em conta debita só ela, porção crédito gera parcelas ordinárias com cartaoId e referência de fatura. Coleção usuarios/{uid}/compras-metas/{metaId} e campo compraRealizada mantêm valor, data, fontes, parcelas e IDs. Uma transação Firestore confirma tudo; metaId é identidade única da compra, repetição não duplica. Confirmação relê carteiras e lançamentos existentes, e toca versão do cartão para serializar confirmações de metas concorrentes. Não equivale a integração bancária em tempo real nem garantia sobre compras/importações concorrentes em fluxos legados que não compartilham o mesmo lock.
Cartões calcula disponível sobre todas as faturas ainda não pagas, incluindo parcelas futuras e limiteReservado de financiamento; pagar fatura libera parcela naturalmente sem reserva duplicada. Removido corte de5000 transações do listener de Cartões para não omitir compromissos antigos. Meta comprada fica concluída separadamente do dinheiro guardado e guarda histórico; não significa parcelas quitadas. Edição/exclusão da meta comprada e edição avulsa de movimentos de meta no Extrato são bloqueadas para preservar vínculos. Não há fluxo novo de cancelamento/estorno de compra nesta entrega.
Metas alcançadas não exibem Depositar; abrir formulário e confirmar validam conclusão. Aporte agora usa transação com leitura fresca e ID de operação estável em retries da mesma tentativa: débito, despesa, depósito e meta juntos. Continua permitindo saldo negativo de origem, conforme pedido do titular, mas bloqueia ultrapassar alvo, cartão como conta e meta já alcançada/comprada. Exclusão de meta sem compra usa transação e devolve aportes vinculados; compra registrada é preservada.
129 regressões aprovadas (12 casos novos e integração do formulário atualizada), sintaxe/diff aprovados. Edge headless mobile375px conferiu escolha de conta/cartão,3parcelas, consentimento, erro preservado/retry/fechamento e ausência de Depositar em meta alcançada. Financeiro validado por adaptador transacional em memória, sem escrita de teste em produção. Screenshot local em .tools/goal-purchase/goal-purchase-mobile.png, não versionar. Branch codex/metas-compra-mista-20261102 no clone .tools/goal-purchase. Próximo passo: PR/deploy e QA online somente de interface. Claude/Codex: preservar regras, distinguir simulação de produção e atualizar este status após publicação.

## Pendência documental anterior encerrada — 02/11/2026
Aviso do simulador publicado pelo PR30, commitec60b19a31679e469a25c680ace3c967fca52ab7; Pages41491108722 aprovado e HTTP200 confirmou avisoEstimativaQuitacao. Layout mobile nas duas abas conferido localmente. A anotação final remota da sessão anterior foi impedida por limite de uso da revisão automática; esta atualização registra a evidência sem repetir publicação do código.


## Estado de publicação — metas — 02/11/2026
PR31 integrado em bf123935aa7542248a93ac05b5c5d8e2be9985b8; CI41518480035/41518472096 e Pages41518619911 aprovados. HTTP200 confirmou metaCompra, versão20261102-purchase e serviço público. Navegador autenticado mostrou a meta alcançada sem botão Depositar e o cadastro com opção Meta de compra. Nenhuma meta real foi criada/convertida, compra registrada ou saldo alterado. Compra completa e gravação foram homologadas em simulação pelos129 testes; interação mobile de confirmação/retry testada localmente, não por compra real em produção. Valores acima do alvo já existentes foram preservados, sem correção de dados do titular. Pendente nesta anotação apenas finalizar conferência do extrato individual e registrar seu resultado.


## Conferência online das metas concluída — 02/11/2026
RESOLVIDO E PUBLICADO no PR31 (bf123935aa7542248a93ac05b5c5d8e2be9985b8; Pages41518619911 aprovado). Conferência final: link Extrato do cartão de conta em Contas carregou URL com contaId; página exibiu Extrato da conta, aportes existentes com rótulo Metas e sem as compras do cartão de crédito. Sem erro visível e sem recriar movimentos. A meta alcançada não oferece Depositar; nova meta apresenta opção Meta de compra, formulário cancelado sem salvar. Nenhum saldo, conta ou meta real foi alterado. Encerrada a pendência de QA/publicação dos registros anteriores. A funcionalidade completa de compra foi validada em simulação (129 testes e UI mobile), sem registrar compra real do titular. Para usar em meta existente: editar e marcar Meta de compra, depois Planejar compra. Preservar esses limites de evidência nas próximas sessões Claude/Codex.




## Correção de valores e parcelas das metas — 02/11/2026
Implementado na branch codex/correcao-valores-metas-20261102, clone .tools/goal-input-fix. Campos monetários selecionam o conteúdo ao receber foco e formatam ao sair; digitar substitui o valor inicial. Confirmação informa Registrando imediatamente, consulta somente os cartões usados e relê transações em paralelo preservando commit atômico/idempotência; não prometer latência zero do Firebase. Cartões mostra comprometimento global coerente com a barra e lista parcelas futuras de metas com valor/data/descrição. Caso relatado: compra em02/11, fechamento1/vencimento10,500 em8x resulta62,50 de dezembro2026 a julho2027; novembro zero é coerente com o ciclo, não ausência de lançamentos. Teste sintético específico aprovado; suíte130/130 aprovada. Não houve leitura autenticada de registros nem alteração dos dados do titular. Publicação em preparação; QA online pendente. Claude/Codex devem preservar registros e limites de evidência.

