# Estado compartilhado e ponto de continuidade

## Publicação confirmada — indicações e importação IA (01/11/2026)

- PEND-REF-001: descontos 15%/50% homologados e PUBLICADOS. PR #5 integrado em 3d6f5f4c831498a8938d4ba1ba463197a2c439ae; Pages 41344526378 aprovado e Render Live confirmado. Regras do Firestore compiladas e publicadas no projeto bud-finance após login do titular.
- ERR-071 / PEND-IA-ESPERA: RESOLVIDO E PUBLICADO pelo PR #6, commit e50356c715886cb9a25d371c67345c4096eebaab. CI do PR 41345953909 e Pages 41346014030 aprovados; Render Live no mesmo commit. HTTP 200 no JavaScript público confirmou prazo global de 210s, mensagem de conexão indisponível e retirada do aviso antigo de 45s.
- Validação: 91 regressões aprovadas; limites persistentes do provedor, workers travados, registro antigo com lease ativa, ausência de resposta e preservação de documentos extensos/PDF/imagem. Fluxos de falha emulados; a fatura original da captura não foi fornecida. Não afirmar que a capacidade do provedor de IA é ilimitada nem que a fatura original foi reimportada.
- Decisão operacional: três tentativas no provedor; esperas de até 15s e total de até 20s por solicitação; worker de 180s; cliente de 210s e conexão de 30s. Falha é explícita, libera a interface/admissão e não retorna transações parciais.
- Relatórios: RELEASE_IA_ESPERA_2026-11-01.md e RELEASE_HOMOLOGACAO_INDICACOES_2026-11-01.md. Código e alterações preexistentes do workspace original preservados; registros locais de continuidade foram atualizados. Próxima reprodução específica depende do documento original, se o usuário relatar erro após atualizar a página.


## Correção publicada: confirmação do cadastro e onboarding (01/11/2026)

- **Causa:** o login por link mágico confirmava o e-mail, autenticava a conta e apontava para `dashboard.html`; o guard da dashboard fazia um segundo redirecionamento ao onboarding.
- **Correção:** `appbudfinance/js/index.js` agora envia o link mágico diretamente a `onboarding.html`. O onboarding continua conduzindo à dashboard somente após conclusão.
- **Registros atualizados:** PEND-AUTH-086 em `PENDENCIAS.md` (resolvido e publicado; validação manual ponta a ponta pendente); ERR-069 em `ERRORS_LOG.md`; DEC-062 em `DECISIONS_LOG.md`; fluxo em `ARCHITECTURE_MAP.md`.
- **Branch/PR:** `codex/fix-confirmation-onboarding-20261101`, [PR #3](https://github.com/eudenysjackson/bud-finance/pull/3), integrada no commit `f3c0453` do `master`; GitHub Pages publicado.
- **Validação:** GitHub Actions [41338154393](https://github.com/eudenysjackson/bud-finance/actions/runs/41338154393) passou regressões e deploy do GitHub Pages. A navegação real com cadastro novo, link de e-mail e conclusão do onboarding ainda não foi exercitada ponta a ponta.


**Atualizado em:** 01/11/2026 (America/Sao_Paulo)  
**Commit do código de inadimplência:** `c42e6405202c7a9bf3a2e212026932425e76ae16`  
**Protocolo compartilhado integrado:** PR [#2](https://github.com/eudenysjackson/bud-finance/pull/2), commit `9cad46ca8180eb1c21ba640be239cc7c013a4276`  
**Protocolo comum:** [AI_WORKFLOW.md](AI_WORKFLOW.md)

## Contexto

Foi implementada a regra de inadimplência da assinatura: 10 dias de tolerância, avisos por e-mail e push nos dias 0, 3, 7 e 10, reconciliação com Mercado Pago antes de cancelar, e retorno ao plano Gratuito após o cancelamento confirmado. A Política de Privacidade v1.6 informa a regra de não negativação. O escopo e as evidências estão em [RELEASE_INADIMPLENCIA_2026-11-01.md](RELEASE_INADIMPLENCIA_2026-11-01.md).

## Estado confirmado

- Código integrado ao `master` no commit `c42e6405202c7a9bf3a2e212026932425e76ae16`.
- GitHub Actions run [41333146559](https://github.com/eudenysjackson/bud-finance/actions/runs/41333146559) passou com 80 testes, empacotamento e deploy do GitHub Pages.
- A anotação do release foi atualizada no commit `f55bbad67c1fdddf5834307c7299de7a2eca7a81`; run [41333614878](https://github.com/eudenysjackson/bud-finance/actions/runs/41333614878) passou.
- Render confirmou o Static Site `bud-finance` ligado ao `master` no commit `f55bbad`.
- As regras do Firestore foram compiladas e publicadas no projeto `bud-finance`.
- O endpoint público `/api/ping` de `bud-finance-backend.onrender.com` respondeu `ok`.

## Pendente — confirmar backend em produção

O dashboard Render acessível na sessão de 01/11 mostrava somente o Static Site `bud-finance`, não o serviço Web `bud-finance-backend`. O ping confirma que algum backend responde, mas não identifica a revisão em execução. Portanto, ainda não declarar o fluxo automático de inadimplência totalmente publicado.

**Próxima ação:** abrir no Render o workspace/serviço Web que atende `bud-finance-backend.onrender.com` e verificar o último deploy, o commit implantado e as variáveis necessárias para e-mail, Mercado Pago e cron das 18h. Só concluir após confirmar revisão e configuração; não disparar e-mail/push, cobrar ou cancelar assinatura real como teste.

## Limites dos testes até aqui

- `npm run test:release`: 80 aprovados, 0 falhas; sintaxe dos arquivos alterados e `git diff --check` aprovados.
- Reconciliação e cancelamento verificados com Mercado Pago e Firestore simulados.
- Nenhum e-mail ou push foi enviado a usuários reais; nenhuma cobrança ou assinatura real foi alterada.
- Distinguir sempre testes locais/emulados de comportamento confirmado em produção.

## Evolução do trabalho compartilhado — 01/11/2026

PR [#2](https://github.com/eudenysjackson/bud-finance/pull/2) integrada ao `master` no commit `9cad46c`. Foram adicionados `AI_WORKFLOW.md`, `AGENTS.md`, `CLAUDE.md` e esta referência de handoff; também foram atualizados `PENDENCIAS.md`, `DECISIONS_LOG.md`, `ARCHITECTURE_MAP.md` e `PROJECT_RULES.md`. Todos os agentes devem ler o protocolo comum, usar branches separadas e registrar aqui avanços, validações e o ponto de continuidade. A automação da inadimplência ainda aguarda confirmação da revisão do backend Render descrita acima.

## Protocolo para a próxima IA

Leia [AI_WORKFLOW.md](AI_WORKFLOW.md), depois consulte [PENDENCIAS.md](PENDENCIAS.md), [DECISIONS_LOG.md](DECISIONS_LOG.md), [ARCHITECTURE_MAP.md](ARCHITECTURE_MAP.md), [PROJECT_RULES.md](PROJECT_RULES.md), [ERRORS_LOG.md](ERRORS_LOG.md) e o release acima. Verifique se o master avançou além do commit de referência antes de agir; este handoff pode ficar desatualizado conforme novas entregas forem feitas.


## Atualização de continuidade — confirmação e onboarding (01/11/2026)

- Correção integrada no PR [#3](https://github.com/eudenysjackson/bud-finance/pull/3), commit `f3c0453` no `master`.
- `entrarPorLinkMagico()` agora encaminha diretamente para `onboarding.html`; após completar o onboarding, o próprio fluxo direciona para a dashboard.
- GitHub Actions [run 41338154393](https://github.com/eudenysjackson/bud-finance/actions/runs/41338154393) concluiu com sucesso, incluindo regressões de release e deploy do GitHub Pages.
- A página pública de login carregou, mas a jornada real de cadastro novo → e-mail → confirmação → onboarding → dashboard ainda não foi exercitada ponta a ponta. Não afirmar validação manual completa.
- O próximo agente deve manter essa verificação como pendência de validação manual, sem criar conta ou enviar e-mail real sem necessidade.
- A automação de inadimplência ainda depende de confirmar no Render a revisão ativa do backend Web, conforme registrado acima.


## Auditoria da indicação — 01/11/2026

- A opção “Indicação” em `onboarding.html` salva apenas `comoConheceu`; não abre código nem dá benefício automaticamente.
- Há código opcional no cadastro, mas não é preenchido pelo parâmetro `?ref=`; perfil grava 30% enquanto o backend aplica 10%; o checkout autenticado da página comercial não envia `ref`.
- Webhook só registra a conversão em `indicacoes`; não existe crédito, pagamento ou mês grátis para o indicador.
- Documentado em PEND-REF-001, ERR-070, DEC-068 e ARCHITECTURE_MAP. Não implemente regra promocional até decisão explícita sobre benefício, percentual e elegibilidade.
- Próximo passo: perguntar ao titular quais benefícios quer para indicador/indicado; então corrigir e homologar atribuição do link/código ao checkout.


## Continuidade — programa de indicação 15%/50% (01/11/2026)

- **Decisão aprovada:** DEC-069. O indicado recebe 15% somente na primeira cobrança aprovada. O indicador recebe desconto de 50% em uma cobrança futura, uma vez por conta e somente após a primeira cobrança aprovada do indicado. Não acumular os benefícios no mesmo ciclo; indicação excedente não concede nova recompensa.
- **Branch de trabalho:** codex/beneficios-indicacao-15-50-20261101. Código e documentos dessa mudança estão apenas nessa branch; não estão publicados.
- **Preparado:** validação e atribuição do código no backend; onboarding/cadastro/link de venda e configurações; ajuste do valor recorrente via API do Mercado Pago; restauração do preço regular no webhook; estados protegidos nas regras do Firestore. Fixture tests/checkout.test.js alinhado para 15%/50%.
- **Validação pendente:** quatro regressões foram adicionadas ao checkout. O workflow .github/workflows/validate-pr.yml executou a suíte sem deploy; Actions runs 41341578144, 41341608813 e 41341678748 concluíram com sucesso. A homologação Mercado Pago sandbox segue pendente para validar as cobranças subsequentes, restauração e troca de plano. Não usar cobrança real.
- **Próximo passo:** homologar em sandbox e então integrar/publicar somente após a revisão final; confirmar deploy. Manter a cópia local codex/ajustes-locais intacta: há alterações preexistentes sem commit e ela diverge da branch remota.


## Homologação de indicações concluída — 01/11/2026

PEND-REF-001: etapa de sandbox RESOLVIDA no código 438a21418128f562d965f6d3eb5587afaef83abe. Pagamentos fictícios aprovados de R$ 8,49 (15%) e R$ 5,00 (50%); handlers restauraram R$ 9,99 via API. Indicação em cadeia agendou 50% na próxima competência, sem acúmulo por reenvio ou excedentes. Upgrade confirmou R$ 14,95 e restauração de R$ 29,90 após pagamento futuro emulado. Suíte: 84 aprovados, zero falhas. Sete contratos fictícios cancelados e conferidos. Auth/Firestore representados em memória; entrega pública do webhook e cobrança mensal futura não foram revalidadas nesta etapa. Relatório: RELEASE_HOMOLOGACAO_INDICACOES_2026-11-01.md. PR #5 ainda não integrado/publicado. Próximo passo: revisão final, integração/deploy autorizados e verificação pública. Workspace original preservado.


## Correção da espera de importação IA — 01/11/2026

ERR-071 / PEND-IA-ESPERA: a mensagem aguardando serviço vem do retry HTTP 429; até 12 esperas longas e polling/worker sem prazo mantinham a interface aberta. Correção em codex/corrige-importacao-ia-travada-20261101: tentativas curtas e limitadas, worker com prazo de 180s, registro persistente antigo encerrado, cliente com 210s totais/30s por conexão e mensagens de falha/cancelamento claras. 91 regressões aprovadas. Detalhes em RELEASE_IA_ESPERA_2026-11-01.md. Integração/deploy em preparação. Indicações: PR #5 integrado em 3d6f5f4; Pages 41344526378 aprovado e backend Render Live confirmado. Regras de indicação compiladas e publicadas no projeto bud-finance em 01/11/2026. Workspace original preservado.

## Continuidade — falha de capacidade IA observada (01/11/2026)

Captura às 17:24 mostra o retry de um trecho da fatura após HTTP 429 da Groq: aguardando 10 segundos, primeira de até duas esperas curtas desta chamada. O usuário relata que a fatura não foi lida; a captura não mostra o resultado final. O encerramento de esperas infinitas está publicado no commit e50356c, mas não aumenta a cota do fornecedor. Cotas do Bud: Free 0, Starter 3, Trial 10, Pro 10, Plus ilimitado no app; qualquer plano continua sujeito à cota da organização Groq. Aquisição Groq Developer futura e avaliação híbrida/própria registradas em DEC-069/PEND-IA-005. Para reprodução do layout específico, solicitar o PDF original ou log da tentativa.

## Diagnóstico da fatura Nubank enviada e cotas Groq — 01/11/2026

- Análise local, sem chamada à Groq nem gravação de transações: PDF textual pesquisável de 7 páginas. O leitor reconhece Nubank, mas o atalho determinístico não aceita o arquivo: o rótulo `Total a pagar` aparece junto a `R$` sem espaço e, ao tolerar essa variação em diagnóstico isolado, as linhas capturadas ainda não conciliam com o total. O fluxo encaminha o documento à IA, sujeita a HTTP 429. Não registrar no Git nem no chat valores, nomes ou estabelecimentos do documento.
- A resposta de limite tem janelas próprias. Groq fornece `retry-after` no 429 e `x-ratelimit-reset-requests` / `x-ratelimit-reset-tokens`; cada limite ativo (RPM/RPD/TPM/TPD e, se configurados, limites separados de entrada/saída) pode ter reset distinto. A espera de 10s da tela é o retry indicado para aquela chamada, não garantia de que todos os trechos ou cotas diárias estejam livres.
- Próximo passo: corrigir o parser Nubank com fixtures sintéticas sem PII e conciliação rigorosa; planejar filas com fairness e contingência para escala. Developer continua aquisição futura DEC-069; não garante capacidade ilimitada.
- Não houve importação autenticada no navegador nem validação da fatura pela Groq; não declarar o arquivo lido.

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

## Estornos e total após salvar — 01/11/2026
Correção ativa: ver RELEASE_ESTORNOS_2026-11-01.md. A confirmação anterior cobriu somente análise/revisão e não comprovou persistência. Agora os testes cobrem salvar e recalcular a fatura, pares de estorno desmarcados e crédito sem compra identificada contabilizado separadamente. Reparação limitada dos registros da importação real realizada com precondições, cópia privada e readback. Nenhuma exclusão. Publicação em preparação.


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

Validação completa da categoria: 100 regressões passaram, zero falhas. Entrega no PR #20; após integração, este registro passa a indicar implementação resolvida. Conferir estado do PR/deploy ao retomar. Não alterar tipo financeiro para receita e não migrar registros antigos automaticamente.
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


