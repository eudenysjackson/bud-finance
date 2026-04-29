# PENDENCIAS.md — Registro Centralizado de Pendências

**Projeto**: Bud Finance
**Criado em**: 23/04/2026
**Última atualização**: 27/04/2026 (Mercado IA concluído; Balanço Mensal criado — Fase 2 iniciada)

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

### ⚙️ Configurações

> MVP atual: 3 abas (Perfil / Personalização / Segurança) — funcionando.
> Cérebro descreve uma versão muito mais ampla (referência: `cérebro/configuracoes.md`).
> Auditoria de paridade em 23/04/2026 confirmou que os itens abaixo NÃO existem no código.

| ID | Item | Tipo | Dependências | Notas |
|---|---|---|---|---|
| PEND-001 | Gestão de Assinatura (Mercado Pago) — card premium, plano/trial/expiração, upgrade/downgrade, banner `pending`, cancelamento | 🚀 FUT | Backend `/mercadopago/create-subscription`, tela `vendas.html` | Depende de planos pagos estarem ativos |
| PEND-002 | Notificações Push (FCM) — `verificarEstadoPush()`, registro/revogação de token em `usuarios/{uid}/tokens/fcm`, modal de instalação iOS Safari → PWA | 🚀 FUT | Firebase Messaging, manifest PWA | — |
| PEND-003 | Reset do Tutorial — botão integrado a `NexoTutorial.resetAll()` | 🚀 FUT | Tela de Onboarding (ainda não existe) | — |
| PEND-004 | Assistente WhatsApp — `vincularWhatsApp()` / `desvincularWhatsApp()`, gravação de `whatsappVinculado`, badge de status | 🚀 FUT | Backend webhook (atualmente só loga) | Feature-gate plano Plus |
| PEND-005 | ~~LGPD: Exportar Dados Completo~~ — `exportarDadosJSON()` implementada em `configuracoes.js`: coleta 9 subcoleções (transacoes, carteira, cartoes, metas, limites, categorias, recorrentes, dividas, investimentos) + perfil, gera `.json` com replacer para Timestamps. Botão “Exportar JSON” no card Privacidade. | ✅ RESOLVIDO 29/04/2026 | — | — |
| PEND-006 | LGPD: Revogar Consentimento de Notificações — desativa FCM e marca `revogadoEm` em `tokens/fcm` | 🚀 FUT | Depende de PEND-002 (Push) | — |
| PEND-007 | ~~LGPD: Excluir Conta Permanentemente~~ — `confirmarExcluirConta()` implementada: modal com digitação "EXCLUIR", batch chunks de 400, deleta 13 subcoleções + doc principal + `user.delete()`. Trata `requires-recent-login` com re-login automático. Botão na aba Segurança. | ✅ RESOLVIDO 29/04/2026 | — | — |
| PEND-008 | ~~Reset Total da Conta~~ — `abrirModalReset()` + `executarReset()` implementados: modal com lista dos dados afetados, batch chunks de 400, limpa `nexo_tutorial_done_*` do localStorage, seta `onboardingConcluido: false`. Bot\u00e3o "Resetar Dados" na aba Seguran\u00e7a. | \u2705 RESOLVIDO 29/04/2026 | \u2014 | \u2014 |

### 💳 Cartões

> Auditoria de paridade em 23/04/2026 confirmou que TODOS os 12 bugs do cérebro foram evitados. DEC-034 aplicada com rigor. Nenhum bug ativo.
> DT-001 corrigido em 23/04/2026.
> Sugestão 1 (modal exclusão) já estava implementada — sem ação necessária.

| ID | Item | Tipo | Dependências | Notas |
|---|---|---|---|---|
| ~~DT-001~~ | ~~`salvarTransacoesIA` usa loop de `addDoc`~~ | ✅ Resolvido | — | Convertido para `writeBatch` em chunks de 400 em 23/04/2026. |
| DT-002 | `perfilPlano = null` hardcoded em [js/cartoes.js#L824](js/cartoes.js#L824). Buscar `userData.plano` do Firestore quando feature de planos pagos for ativada. | ⚙️ DT | Depende de PEND-001 (Mercado Pago) estar ativo | Comentário no código diz "será obtido do perfil real em sprint futura" |
| ~~PEND-009~~ | ~~**Indicador fatura fechada vs aberta**~~ ✅ **RESOLVIDO 29/04/2026** — `calcularStatusFatura` agora retorna labels dinâmicos: "Fecha em Xd", "Fecha hoje", "Vence em Xd", "Vence hoje" quando próximo do prazo. | ✅ Resolvido | — | Implementado em `js/cartoes.js` |
| PEND-010 | **Filtro rápido por cartão na lista de transações** — chip clicável no topo para filtrar sem abrir detalhe do cartão. | 🟢 Baixa | — | — |
| ~~PEND-011~~ | ~~**Pagar fatura com 1 clique**~~ ✅ **RESOLVIDO 29/04/2026** — modal "Pagar Fatura" agora carrega contas de débito da Carteira. Ao confirmar com conta selecionada: writeBatch cria transação `pagamento_fatura` + decrementa `saldo` da conta. Ao desfazer: deleta transação + restaura saldo. Fallback: "Apenas marcar como paga" se sem contas. | ✅ Resolvido | — | Ver `js/cartoes.js` — `abrirModalPagarFatura`, `confirmarPagarFatura` |
| ~~PEND-012~~ | ~~**Parcelamento inteligente na importação IA**~~ ✅ **RESOLVIDO 29/04/2026** — modal Review IA exibe toggle "📅 Criar N parcelas restantes" por item quando parcelado detectado. Se ativado, `salvarTransacoesIA` gera as parcelas futuras (parcelaAtual+1 até totalParcelas) distribuindo em meses subsequentes via `_addMesesData`. Descrição atualizada automaticamente (ex: "02/12" vira "03/12", "04/12"...). | ✅ Resolvido | — | `js/cartoes.js` |
| ~~PEND-013~~ | ~~**Limite consumido visual**~~ ✅ **RESOLVIDO 29/04/2026** — barra agora mostra "R$ X usado de R$ Y" + percentual colorido (verde/amarelo/vermelho conforme uso). A barra em si já existia; texto e cor do % atualizados. | ✅ Resolvido | — | `buildCartaoEl` |
| ~~PEND-014~~ | ~~**Skeleton loader**~~ ✅ **RESOLVIDO 29/04/2026** — `cartoesLoading` agora exibe 2 cards fantasma animados com shimmer (`@keyframes shimmer`), refletindo a estrutura real do cartão (rect do cartão físico + linhas + barra + botões). | ✅ Resolvido | — | `cartoes.html` |
| ~~PEND-015~~ | ~~**Empty state ilustrado**~~ ✅ **RESOLVIDO 29/04/2026** — empty state agora exibe ilustração CSS de 3 cartões sobrepostos (roxo/azul/teal), CTA "Adicionar meu primeiro Cartão" e linha de bandeiras suportadas. | ✅ Resolvido | — | `cartoes.html` |
| ~~PEND-016~~ | ~~**Cores de bandeira automatizadas**~~ ✅ **RESOLVIDO 29/04/2026** — `setupFormCartao` adiciona listener no campo nome: detecta 13 bancos/marcas (Nubank, Itaú, Bradesco, Santander, BB, Caixa, Inter, XP, C6, Sicoob, Elo, Amex, Hipercard) e pré-seleciona bandeira e cor automaticamente ao criar (não sobrescreve ao editar). | ✅ Resolvido | — | `js/cartoes.js` |
| PEND-017 | **Comparativo mês-a-mês da fatura** — mini gráfico no detalhe do cartão mostrando histórico de faturas. | 🚀 FUT | Tela Gráficos (não existe ainda) | — |
| PEND-018 | **Alerta push de fatura fechando** — notificação "Sua fatura do Nubank fecha amanhã". | 🚀 FUT | PEND-002 (Push FCM) | — |

### 🎯 Metas

> Auditoria de paridade em 23/04/2026 confirmou que TODOS os 12 bugs do cérebro foram evitados. Tela em paridade total, nada pendente.

_Sem pendências ativas._

---

### 🏷️ Categorias

> Tela implementada em 23/04/2026. 9 bugs do cérebro resolvidos. Pendências abaixo são melhorias e integrações futuras.

| ID | Descrição | Prioridade | Depende de | Observação |
|---|---|---|---|---|
| ~~PEND-019~~ | ~~Integrar `categorias-padrao.js` nas telas existentes~~ | ✅ Resolvido | — | `cartoes.js` já usa `window.BUD_CATEGORIAS_PADRAO` + `categoriasGlobal` do Firestore. Confirmado em auditoria 23/04/2026. |
| PEND-020 | **Propagação de rename para coleções futuras** — ao renomear categoria personalizada, hoje só `transacoes` é atualizado via writeBatch. Quando `recorrentes`, `limites`, `extrato` existirem, devem ser propagados também. | 🟡 Média | Extrato/Recorrentes/Limites | Registrar nos docs dessas telas quando construídas |
| PEND-021 | **Gate de plano para categorias personalizadas** — MVP libera para todos (DEC-037). Ao implementar Mercado Pago (PEND-001), adicionar verificação em `salvarCategoria()`. | 🚀 FUT | PEND-001 | Comentário no código indica onde inserir |
| PEND-022 | **Skeleton loader para categorias** — enquanto `onSnapshot` carrega, exibir placeholders em vez de seção vazia. | 🟢 Baixa | — | — |
| PEND-023 | **Reordenação de categorias personalizadas** — drag-and-drop ou campo `ordem` em Firestore para o usuário ordenar seus atalhos. | 🚀 FUT | — | Não previsto no cérebro |
| PEND-024 | **Ícone de contagem de uso** — mostrar "usada em X transações" no tooltip/hover do card de categoria padrão ou personalizada. | 🚀 FUT | — | UX improvement |

---


## 📋 Extrato

> Tela implementada em 28/04/2026. Todos os 14 bugs do cérebro resolvidos na implementação inicial.

| ID | Descrição | Prioridade | Depende de | Observação |
|---|---|---|---|---|
| PEND-025 | **Campo `conta` / origem da transação** — modelo de dados atual não tem campo `conta`. Para o MVP multi-conta, adicionar campo ao criar/editar transação. | 🚀 FUT | — | BUG 6 do cérebro, adiado |
| PEND-026 | **Campo `pago`/`pendente` para despesas futuras** — sem campo `pago` no modelo atual. Ao implementar, exibir badge "Pendente" no extrato. | 🚀 FUT | — | BUG 4 do cérebro, adiado |
| PEND-027 | **Filtro de data avançado (intervalo)** — hoje só filtra por mês. Permitir filtro por período personalizado (data de → data até). | 🟡 Média | — | — |
| PEND-028 | **Anexo/comprovante na transação** — upload de imagem via Firebase Storage ligado à transação para exibir no extrato. | 🚀 FUT | — | Citado no cérebro/extrato.md |
| PEND-029 | **Gráfico de linha no extrato** — mini-gráfico de saldo acumulado no mês, abaixo dos cards de resumo. | 🚀 FUT | — | — |
| PEND-030 | **Propagação de rename de categoria para Extrato** — quando renomear categoria em categorias.html, atualizar campo `categoria` das transações (ver PEND-020). | 🔴 Alta | Categorias | — |

---

## 🔄 Recorrentes

> Tela implementada em 26/04/2026. Bugs 1–3 do cérebro resolvidos na implementação inicial.
> Bug 4 (dashboard deduplica por nome) fica registrado como pendente para atacar ao tocar no dashboard.

| ID | Descrição | Prioridade | Depende de | Observação |
|---|---|---|---|---|
| PEND-031 | ~~**Cloud Function `processarRecorrentes`**~~ — Endpoint `POST /api/processar-recorrentes` implementado em `backend/server.js`. Auth via ID Token (anti-IDOR). Filtros por dia de vencimento + fuso Brasília. Anti-duplic. por `mesReferencia`. Botão "⚙️ Processar Hoje" na tela Recorrentes. | ✅ RESOLVIDO 30/04/2026 | — | — |
| PEND-032 | **Cloud Function `enviarLembretesFinanceiros`** — cron `0 7 * * *`, envia FCM quando conta vence hoje/amanha. | 🚀 FUT | PEND-031 + PEND-002 (Push FCM) | Depen de de PEND-031 estar pronto |
| PEND-033 | **Integração dashboard** — seção “Contas Vencidas/Lembretes” do dashboard ainda usa match por nome em vez de `recorrenteId` (Bug 4 do cérebro). | 🟡 Média | — | Atacar na próxima alteração do dashboard |
| PEND-034 | ~~**Filtragem por plano na Cloud Function**~~ — Verificação de plano adicionada server-side em `POST /api/processar-recorrentes`: consulta `usuarios/{uid}.plano`, rejeita Free/Starter com 403. | ✅ RESOLVIDO 29/04/2026 | — | — |

---

## 💸 Dívidas

| ID | Descrição | Prioridade | Depende de | Observação |
|---|---|---|---|---|
| PEND-035 | **Previsão de quitação automática** — calcular data estimada de quitação baseada em parcelas restantes + exibir no card e modal Detalhes. | 🟡 Média | — | — |
| PEND-036 | **Notificações de vencimento de parcelas** — FCM push quando parcela vence hoje/amanhã. | 🚀 FUT | PEND-002 (Push FCM) | Depende de infra FCM |
| PEND-037 | **Histórico de datas de pagamento** — registrar data real em que cada parcela foi marcada como paga (não apenas flag pago/não-pago). | 🟡 Média | — | Requer sub-array `parcelasDatas` no Firestore |
| PEND-038 | **Exportar relatório de dívidas em PDF** — botão na tela principal para gerar PDF com resumo de todas as dívidas (saldo devedor, parcelas, projeção). | 🚀 FUT | PDF.js já importado | — |
| PEND-039 | **Campos CET, IOF e seguro no formulário manual** — campos opcionais para registro preciso do custo total do contrato. | 🟢 Baixa | — | Campos `cet`, `iof`, `seguro` já existem no modelo Firestore |
| PEND-040 | **MANUAL_USO.md** — criar documento com descrição de uso de todas as telas existentes: Dashboard, Extrato, Metas, Cartões, Categorias, Recorrentes, Dívidas, Limites, Configurações. | 🟡 Média | — | Útil para onboarding e suporte |
| PEND-041 | **Limites — Notificação push ao atingir 80% do limite** — FCM push quando gasto atingir ≥80% de um limite de categoria no mês vigente. | 🚀 FUT | PEND-002 (Push FCM) | Depende de Cloud Function + FCM |
| PEND-042 | **Limites — "Copiar do Mês Anterior" exclusivo para plano Plus** — Feature gate: bloquear o botão para planos Free/Starter com CTA de upgrade. | 🟡 Média | — | Padrão já existe em Recorrentes |
| PEND-043 | **Limites — Índice composto Firestore** — `transacoes` com index `data ASC` + `data DESC` (já em uso em Extrato); confirmar que índice existe para evitar fallback. | 🟢 Baixa | — | Ver extrato.js como referência |

---

## 🛒 Compras / Mercado

> ⚠️ **TELA EM ANDAMENTO — NÃO INICIAR NOVA TELA ANTES DE FINALIZAR ESTA**

| ID | Item | Prioridade | Origem | Notas |
|----|------|------------|--------|-------|
| PEND-MER-01 | ~~**Importação por IA / Nota Fiscal**~~ ✅ **IMPLEMENTADO 27/04/2026** — botão "📷 Importar nota" abre modal 3 abas (Foto/PDF/Texto), endpoint próprio `/api/extrair-cupom` (Gemini 2.0 Flash, cache 24h SHA-256, multi-foto até 3, multer 8MB), tela de revisão editável com checkbox/qtd/valor/categoria/exclusão, aprendizado por CNPJ (`mercados-conhecidos`) e por item (`aprendizado-itens`), quota mensal por plano (`uso-ia/{anoMes}`). | ✅ Concluído | Implementação 27/04/2026 | — |
| **PEND-MER-11** | **🔴 BLOQUEANTE — Trocar GEMINI_API_KEY no Render** — a chave atual (`AIzaSyBp5jt…`) tem `limit:0` para todos os modelos (projeto GCP sem billing/free tier). Gerar nova chave em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) e atualizar no painel Render → Environment → GEMINI_API_KEY → Save. Após salvo, redeploy automático (≈2min). Testar aba Texto com texto simples primeiro. | 🔴 Alta (BLOQUEANTE) | Diagnóstico 27/04/2026 | **⚠️ Verificar se ainda se aplica — backend foi migrado para Groq (PEND-MER-10 e cérebro/mercado.md). Se GROQ_API_KEY estiver ativa no Render, este item pode ser baixado para Baixa.** |
| **PEND-MER-12** | **🟡 Smoke test completo pós-GEMINI_API_KEY** — após trocar a chave, testar: (1) aba Texto: colar texto simples e verificar Review; (2) aba Foto: enviar uma foto de cupom; (3) modal Review: editar item, desmarcar, confirmar → modal Nova Compra pré-preenchido; (4) segunda submissão da mesma foto → deve responder do cache (`cached:true`). | 🟡 Média | Diagnóstico 27/04/2026 | Depende de PEND-MER-11. |
| PEND-MER-06 | **Métricas admin de uso da IA** — agregar `uso-ia/{anoMes}` por usuário no painel admin, custo estimado por extração. | 🟢 Baixa | Spin-off PEND-MER-01 | Útil para monitorar custos do Gemini. |
| PEND-MER-07 | **Quota IA enforcement no servidor** — hoje a checagem de limite é client-side; mover para `/api/extrair-cupom` (rate-limit por uid). | 🟡 Média | Spin-off PEND-MER-01 | Hardening contra cliente modificado. |
| PEND-MER-08 | **OCR fallback offline (Tesseract.js)** — quando GEMINI_API_KEY indisponível ou usuário sem quota, oferecer extração local com qualidade reduzida. | 🟢 Baixa | Spin-off PEND-MER-01 | — |
| PEND-MER-09 | **Tela de Carteira** — CRUD de `usuarios/{uid}/carteira/{id}` (conta corrente + cartões + vales + dinheiro). Mercado.js já consome essa collection no dropdown "Conta / Cartão" com fallback. | 🟡 Média | Solicitação 27/04/2026 | Ver `cérebro/carteira-importar.md` para schema completo. |
| PEND-MER-10 | ~~Backend `/api/extrair-cupom` deploy no Render~~ ✅ **Deploy feito** — commits `fb014d8`, `5932ef3`, `563cd86`, `0a17aa1` publicados. Modelo atualizado para `gemini-2.0-flash`. Agora bloqueia apenas PEND-MER-11 (chave). | ✅ Concluído | 27/04/2026 | — |
| PEND-MER-02 | **Filtros e busca na lista de compras** — busca por mercado, filtro por mês/forma de pagamento. Hoje só pagina. | 🟢 Baixa | Implementação inicial 27/04/2026 | — |
| PEND-MER-03 | **Gráfico de gastos por mercado / por categoria** — donut ou barras na aba Compras (top 5 mercados, distribuição de categorias). | 🟢 Baixa | Implementação inicial 27/04/2026 | Reutilizar Chart.js já carregado em outras telas. |
| PEND-MER-04 | **Comparar listas vs realizado** — ao concluir uma lista, mostrar diff (estimado vs gasto) por item. | 🟢 Baixa | Implementação inicial 27/04/2026 | Como a lista hoje não tem estimativa por item, depende de PEND-MER-05. |
| PEND-MER-05 | **Estimativa de preço por item na lista** — sugerir preço médio com base no histórico ao montar a lista. | 🟢 Baixa | Implementação inicial 27/04/2026 | Helper `categoriaMajoritaria` + `historicoPrecos` pode evoluir para isso. |

---

## 🌐 Débitos Técnicos Globais

| ID | Item | Prioridade | Origem | Notas |
|----|------|------------|--------|-------|
| DT-004 | **Testes para parser de PDF do extrato (cartoes/dividas IA)** — adicionar suíte unitária com fixtures de PDFs reais (Itaú, Nubank, BB) para o parser do backend. | 🟢 Baixa | Auditoria 27/04/2026 (M7) | Sem testes, alterações no parser podem regredir silenciosamente. |
| DT-005 | **B9 — Gradiente vermelho/erro no tema Dark (HBO)** — tons como `#dc2626`/`#ef4444` ficam contrastantes mas saturados sobre fundo `#0f1419`. Avaliar versão mais "soft" para Dark (ex: `#f87171`). | 🟢 Baixa | Auditoria 27/04/2026 | Não bloqueia uso; revisão visual manual recomendada com usuário. |
| DT-006 | **M5 — Cores hardcoded inline em alguns elementos** — pontos de gradiente/bordas usando hex literal em vez de var(--…). Inventariar e migrar para tokens. | 🟢 Baixa | Auditoria 27/04/2026 | Refatorar sem revisão visual em todos os 8 temas é arriscado (ver DEC abaixo). |
| DT-007 | **B3 — Helper único `formatMoeda` / `parseMoeda`** — hoje cada tela reimplementa parsing/formatação BRL com ligeiras diferenças. Centralizar em `bud-utils.js`. | 🟢 Baixa | Auditoria 27/04/2026 | `budFormatarValor` já existe (formatação); falta o parser. |
| DT-008 | **B4 — Extrair objeto `THEMES` de `theme-manager.js` para JSON** — facilitar adição/edição de temas sem tocar JS. | 🟢 Baixa | Auditoria 27/04/2026 | 8 temas hoje; arquivo cresce a cada novo tema. |
| DT-009 | **B6 — "Descrição do plano" hardcoded** — strings de descrição dos planos espalhadas em configuracoes.js/cartoes.js. Centralizar em constantes. | 🟢 Baixa | Auditoria 27/04/2026 | — |
| DT-010 | **B8 — Comentários misturando PT-BR e EN** — padronizar para PT-BR em todo o codebase. | 🟢 Baixa | Auditoria 27/04/2026 | Cosmético. |
| DT-011 | **B10 — Source maps de `tailwind.css`** — gerar `.map` em build dev para facilitar debug de classes. | 🟢 Baixa | Auditoria 27/04/2026 | Build atual não emite sourcemap. |
| DT-012 | **M9 — Lógica duplicada de "categorias" em metas.js / extrato.js / dashboard.js** — extrair para `js/categorias-helpers.js` reaproveitando `categorias-padrao.js`. | 🟡 Média | Auditoria 27/04/2026 | Pode causar drift entre telas se um lado mudar. |
| PEND-044 | ~~**Cloud Function `processarRecorrentes`**~~ — Resolvido via PEND-031 (endpoint REST em vez de Firebase Functions). | ✅ RESOLVIDO 29/04/2026 | — | — |
| PEND-045 | **Feature Flags no painel Admin** — tela admin já tem aba "Feature Flags" mas sem implementação. Criar collection `feature_flags/{flag}` no Firestore e botão toggle no admin. Consumir via `getDoc` no startup de cada tela que precise. | 🟡 Média | ROADMAP Fase 2 | Permite activar features para segmento de usuários sem deploy. |
| PEND-046 | **FCM Push Notifications** — implementar `verificarEstadoPush()` em `configuracoes.js`, registrar token em `usuarios/{uid}/tokens/fcm`, enviar notificações de alertas de limites e metas do backend. Depende de Service Worker (PWA). | 🟢 Baixa | ROADMAP Fase 2 / tela Insights | Bloqueia Insights. |

---

## 📜 Histórico de Atualizações

- **23/04/2026** — Documento criado. Consolida itens 21-28 do `ROADMAP.md` (expansões de Configurações) + DT-001/002/003 da memória do repo. Origem: auditoria de paridade Cérebro→Bud em Cartões / Metas / Configurações.
- **23/04/2026** — DT-001 resolvido: `salvarTransacoesIA` convertida para `writeBatch` em chunks de 400. Sugestões de refinamento Cartões registradas como PEND-009 a PEND-018. Sugestão 1 (modal exclusão) já existia — marcada como já implementada.
- **23/04/2026** — Tela Categorias implementada (9 bugs resolvidos). `js/categorias-padrao.js` criado como fonte única de verdade (DEC-036). Pendências PEND-019 a PEND-024 registradas.
- **26/04/2026** — Tela Recorrentes implementada (`recorrentes.html` + `js/recorrentes.js`). 3 bugs do cérebro resolvidos na origem. PEND-031 a PEND-034 registradas. Link 🔄 Recorrentes adicionado ao sidebar de todas as telas.
- **26/04/2026** — Tela Dívidas implementada (`dividas.html` + `js/dividas.js`). 25 bugs do cérebro resolvidos na origem (Tabela Price, addMonthsSafe, confirmarAcao, simulador, IA import, etc.). PEND-035 a PEND-040 registradas. Link 💸 Dívidas adicionado ao sidebar de todas as 7 telas.
- **28/04/2026** — Tela Limites implementada (`limites.html` + `js/limites.js`). 15 bugs do cérebro resolvidos na origem (BUG 1–15: query filtrada por mês, dedup normalizeCategoria, overlays style.cssText, budShowToast, copiar+10%/min R$10, percentual sem receita, etc.). PEND-041 a PEND-043 registradas. Link 🎯 Limites adicionado ao sidebar de todas as 8 telas.
- **23/04/2026** — Auditoria geral do código. 5 bugs corrigidos: (1) teste sidebar `toHaveCount(4)→6` (2) `salvarEdicao` sem validação de categoria (3) valor R$ 0,00 passava validação (4) `renderBreakdown` não chamado quando filtradas = 0 (5) `formatarInputValor` sem máscara BRL. PEND-019 marcada resolvida.
- **27/04/2026** — Auditoria full-stack (53 issues). 14 críticos/altos/médios resolvidos: C3 (escapeHTML hardening), C4 (rate-limit doc), C5 (reCAPTCHA prod warning), A1 (console.error→budError), A2 (text color tema Dark), A3 (CORS prod/dev), A4 (theme-manager localStorage try/catch), A5 (cartoes loop em vez de limit 500), M3+M4+M8 (helpers em bud-utils), M4 (pluralização dashboard), M10 (getUrlParam try/catch), M11 (preview-temas storage event), B1 (width/height nos `<img>` da sidebar), B2 (filter-pill min-height 44px em mobile). Backup `..\Budfinance-BACKUP-2026-04-27_1242\`. Itens não-bloqueadores movidos para esta tabela: DT-004 (M7), DT-005 (B9), DT-006 (M5), DT-007 (B3), DT-008 (B4), DT-009 (B6), DT-010 (B8), DT-011 (B10), DT-012 (M9). Decisões registradas: DEC-XXX (revisão visual obrigatória) e DEC-XXX (manter repo público).
- **29/04/2026** — PEND-012 a PEND-016 resolvidos em Cartões: (1) PEND-012: parcelamento inteligente na IA com toggle "Criar parcelas restantes" e geração automática em meses futuros; (2) PEND-013: barra de limite atualizada para "R$ X usado de R$ Y" + % colorido; (3) PEND-014: skeleton loader animado com shimmer; (4) PEND-015: empty state com ilustração CSS de 3 cartões; (5) PEND-016: auto-detect bandeira/cor por 13 bancos ao digitar nome.
- **29/04/2026** — PEND-009 e PEND-011 resolvidos em Cartões: (1) PEND-009: badge de status da fatura com countdown de dias ("Fecha em Xd"/"Vence em Xd"/"Fecha hoje"/"Vence hoje"); (2) PEND-011: modal Pagar Fatura integrado com Carteira — carrega contas de débito, cria transação `pagamento_fatura`, decrementa saldo via writeBatch, e permite desfazer restaurando saldo + deletando transação.
- **28/04/2026** — Tela Relatórios implementada (`relatorios.html` + `js/relatorios.js`). Fase 2 · Item 4. 15 bugs do cérebro/relatorios.md corrigidos preventivamente. Interface 3 abas (Resumo / Gráficos / Detalhamento). Feature gate `advancedDashboard`. Tendência 6 meses em single-pass (BUG 13). Sidebar atualizada em 14 páginas com link 📑 Relatórios. ROADMAP: Gráficos → CONCLUÍDO; Relatórios → CONCLUÍDO.
- **27/04/2026** — Fase 1 concluída. Mercado IA implementado com Groq meta-llama/llama-4-scout. Balanço Mensal (`balanco-mensal.html` + `js/balanco-mensal.js`) criado — Fase 2 iniciada. Sidebars de 11 telas atualizadas com link "Balanço Mensal (Plus)". PEND-MER-11 reclassificada (verificar se backend ainda usa Gemini ou Groq). PEND-044/045/046 adicionadas (Cloud Function processarRecorrentes, Feature Flags, FCM Push).


