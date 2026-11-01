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
