# PENDENCIAS.md — Registro Centralizado de Pendências

**Projeto**: Bud Finance
**Criado em**: 23/04/2026
**Última atualização**: 23/04/2026

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
| PEND-005 | LGPD: Exportar Dados Completo (XLSX) — cobre 14 subcoleções (`transacoes`, `metas`, `metas/{id}/depositos`, `cartoes`/`carteira` tipo `credito`, `categorias`, `dividas`, `investimentos`, `limites`, `recorrentes`, `compras`, `listas-compras`, `tokens`, `notificacoes_eventos_enviadas`, `perfil/config`) via SheetJS | 🚀 FUT | SheetJS CDN, telas que ainda não existem (dívidas/investimentos/etc.) | Substitui DT-003 quando entrar em escopo |
| PEND-006 | LGPD: Revogar Consentimento de Notificações — desativa FCM e marca `revogadoEm` em `tokens/fcm` | 🚀 FUT | Depende de PEND-002 (Push) | — |
| PEND-007 | LGPD: Excluir Conta Permanentemente — modal com digitação "EXCLUIR", batch chunks de 400 deletando todas as subcoleções + `usuarios/{uid}` + `auth.currentUser.delete()` | 🚀 FUT | Todas as subcoleções precisam existir antes (telas das outras features) | Risco alto se feito prematuramente |
| PEND-008 | Reset Total da Conta — `executarReset()` apaga subcoleções financeiras (mantém doc do usuário) e redireciona para `onboarding.html` | 🚀 FUT | Tela de Onboarding + todas as subcoleções existirem | Mesmo risco do PEND-007 |

### 💳 Cartões

> Auditoria de paridade em 23/04/2026 confirmou que TODOS os 12 bugs do cérebro foram evitados. DEC-034 aplicada com rigor. Nenhum bug ativo.
> DT-001 corrigido em 23/04/2026.
> Sugestão 1 (modal exclusão) já estava implementada — sem ação necessária.

| ID | Item | Tipo | Dependências | Notas |
|---|---|---|---|---|
| ~~DT-001~~ | ~~`salvarTransacoesIA` usa loop de `addDoc`~~ | ✅ Resolvido | — | Convertido para `writeBatch` em chunks de 400 em 23/04/2026. |
| DT-002 | `perfilPlano = null` hardcoded em [js/cartoes.js#L824](js/cartoes.js#L824). Buscar `userData.plano` do Firestore quando feature de planos pagos for ativada. | ⚙️ DT | Depende de PEND-001 (Mercado Pago) estar ativo | Comentário no código diz "será obtido do perfil real em sprint futura" |
| PEND-009 | **Indicador fatura fechada vs aberta** — badge "Fechada em DD/MM" ou "Fecha em X dias" no card do cartão. Usuário sabe o valor mas não sabe se ainda pode lançar. | 🟡 Média | — | Alto valor UX, baixo esforço |
| PEND-010 | **Filtro rápido por cartão na lista de transações** — chip clicável no topo para filtrar sem abrir detalhe do cartão. | 🟢 Baixa | — | — |
| PEND-011 | **Pagar fatura com 1 clique** — botão "Marcar fatura como paga" que cria transação de saída na conta principal vinculada. Hoje é manual. | 🟡 Média | Tela Extrato / contas bancárias | — |
| PEND-012 | **Parcelamento inteligente na importação IA** — ao detectar "PARC 03/12", criar 12 transações futuras automaticamente. Hoje o usuário precisa replicar manualmente. | 🟡 Média | — | Melhora muito o fluxo de IA |
| PEND-013 | **Limite consumido visual** — barra de progresso no card mostrando `fatura_atual / limite_total`. Vermelho quando > 80%. | 🟢 Baixa | — | Dado já existe (`calcularFatura`) |
| PEND-014 | **Skeleton loader** — enquanto Firestore carrega, exibir cards fantasma em vez de tela em branco. | 🟢 Baixa | — | — |
| PEND-015 | **Empty state ilustrado** — "Nenhum cartão cadastrado" com ícone e CTA, em vez de div vazia. | 🟢 Baixa | — | — |
| PEND-016 | **Cores de bandeira automatizadas** — detectar Visa/Master/Elo pelo nome e aplicar cor correspondente no card automaticamente. | 🟢 Baixa | — | Hoje todos os cards têm a mesma cor |
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
| PEND-031 | **Cloud Function `processarRecorrentes`** — cron `0 6 * * *` (horario Brasilia) que cria transações automáticas quando `proximaData <= hoje`. Não existe ainda no backend. | 🔴 Alta | `backend/server.js` ou Firebase Cloud Functions | Front-end está completo; aviso Beta visível ao usuário |
| PEND-032 | **Cloud Function `enviarLembretesFinanceiros`** — cron `0 7 * * *`, envia FCM quando conta vence hoje/amanha. | 🚀 FUT | PEND-031 + PEND-002 (Push FCM) | Depen de de PEND-031 estar pronto |
| PEND-033 | **Integração dashboard** — seção “Contas Vencidas/Lembretes” do dashboard ainda usa match por nome em vez de `recorrenteId` (Bug 4 do cérebro). | 🟡 Média | — | Atacar na próxima alteração do dashboard |
| PEND-034 | **Filtragem por plano na Cloud Function** — CF deve pular usuários Free/Starter para consistência (Bug 2 do cérebro). | 🟡 Média | PEND-031 | Já documentado em recorrentes.js com comentário |

---

## 💸 Dívidas

| ID | Descrição | Prioridade | Depende de | Observação |
|---|---|---|---|---|
| PEND-035 | **Previsão de quitação automática** — calcular data estimada de quitação baseada em parcelas restantes + exibir no card e modal Detalhes. | 🟡 Média | — | — |
| PEND-036 | **Notificações de vencimento de parcelas** — FCM push quando parcela vence hoje/amanhã. | 🚀 FUT | PEND-002 (Push FCM) | Depende de infra FCM |
| PEND-037 | **Histórico de datas de pagamento** — registrar data real em que cada parcela foi marcada como paga (não apenas flag pago/não-pago). | 🟡 Média | — | Requer sub-array `parcelasDatas` no Firestore |
| PEND-038 | **Exportar relatório de dívidas em PDF** — botão na tela principal para gerar PDF com resumo de todas as dívidas (saldo devedor, parcelas, projeção). | 🚀 FUT | PDF.js já importado | — |
| PEND-039 | **Campos CET, IOF e seguro no formulário manual** — campos opcionais para registro preciso do custo total do contrato. | 🟢 Baixa | — | Campos `cet`, `iof`, `seguro` já existem no modelo Firestore |
| PEND-040 | **MANUAL_USO.md** — criar documento com descrição de uso de todas as telas existentes: Dashboard, Extrato, Metas, Cartões, Categorias, Recorrentes, Dívidas, Configurações. | 🟡 Média | — | Útil para onboarding e suporte |

---

## 🌐 Débitos Técnicos Globais

_(Itens que afetam mais de uma tela ou o projeto como um todo. Vazio por enquanto.)_

---

## 📜 Histórico de Atualizações

- **23/04/2026** — Documento criado. Consolida itens 21-28 do `ROADMAP.md` (expansões de Configurações) + DT-001/002/003 da memória do repo. Origem: auditoria de paridade Cérebro→Bud em Cartões / Metas / Configurações.
- **23/04/2026** — DT-001 resolvido: `salvarTransacoesIA` convertida para `writeBatch` em chunks de 400. Sugestões de refinamento Cartões registradas como PEND-009 a PEND-018. Sugestão 1 (modal exclusão) já existia — marcada como já implementada.
- **23/04/2026** — Tela Categorias implementada (9 bugs resolvidos). `js/categorias-padrao.js` criado como fonte única de verdade (DEC-036). Pendências PEND-019 a PEND-024 registradas.
- **26/04/2026** — Tela Recorrentes implementada (`recorrentes.html` + `js/recorrentes.js`). 3 bugs do cérebro resolvidos na origem. PEND-031 a PEND-034 registradas. Link 🔄 Recorrentes adicionado ao sidebar de todas as telas.
- **26/04/2026** — Tela Dívidas implementada (`dividas.html` + `js/dividas.js`). 25 bugs do cérebro resolvidos na origem (Tabela Price, addMonthsSafe, confirmarAcao, simulador, IA import, etc.). PEND-035 a PEND-040 registradas. Link 💸 Dívidas adicionado ao sidebar de todas as 7 telas.
- **23/04/2026** — Auditoria geral do código. 5 bugs corrigidos: (1) teste sidebar `toHaveCount(4)→6` (2) `salvarEdicao` sem validação de categoria (3) valor R$ 0,00 passava validação (4) `renderBreakdown` não chamado quando filtradas = 0 (5) `formatarInputValor` sem máscara BRL. PEND-019 marcada resolvida.


