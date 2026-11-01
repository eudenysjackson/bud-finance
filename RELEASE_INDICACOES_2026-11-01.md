# Programa de indicação — 01/11/2026

## Regra comercial

- O indicado com código válido tem 15% de desconto apenas na primeira cobrança aprovada.
- O indicador recebe 50% de desconto em uma cobrança futura, após a primeira cobrança aprovada do indicado.
- Cada conta pode receber uma recompensa de indicador uma única vez. Indicações excedentes não geram outro benefício.
- Os descontos não se acumulam no mesmo ciclo. Se um usuário indicado também tiver recompensa de 50%, a cobrança inicial com 15% ocorre primeiro e o benefício de 50% fica para um ciclo posterior.
- Sem código validado antes de iniciar a assinatura, não há desconto de indicado. Autoindicação é recusada.

## Escopo da implementação

- backend/server.js: validar e vincular códigos, aplicar descontos, registrar conversão após pagamento aprovado e atualizar/restaurar o valor da assinatura recorrente.
- backend/subscription-change.js: preservar regra da recompensa ao agendar troca de plano.
- appbudfinance/cadastro.html e appbudfinance/js/cadastro.js: campo opcional, link ref=, validação e associação no cadastro.
- appbudfinance/onboarding.html e appbudfinance/js/onboarding.js: permitir informar código ao selecionar “Indicação”.
- appbudfinance/js/vendas.js: propagar o código ao checkout e exibir preço inicial com desconto.
- appbudfinance/configuracoes.html e appbudfinance/js/configuracoes.js: exibir o código pessoal, copiar link e estado do benefício.
- firestore.rules: proteger estados de cobrança e recompensa.
- tests/checkout.test.js: fixture do desconto alinhada aos percentuais aprovados.

## Estado desta entrega

- Branch: codex/beneficios-indicacao-15-50-20261101.
- Estado: revisão preparada em PR rascunho; ainda não integrado nem publicado.
- Testes: quatro regressões foram adicionadas ao checkout. GitHub Actions [41341578144](https://github.com/eudenysjackson/bud-finance/actions/runs/41341578144), [41341608813](https://github.com/eudenysjackson/bud-finance/actions/runs/41341608813) e [41341678748](https://github.com/eudenysjackson/bud-finance/actions/runs/41341678748) concluíram com sucesso, incluindo a suíte completa.
- Homologação Mercado Pago: pendente; usar exclusivamente usuários e meios de pagamento de teste.
- Cobranças reais: nenhuma realizada.
- Fonte oficial para a mudança de valor recorrente: [Gerenciamento de assinaturas do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/subscription-management) e [referência da API para atualizar assinatura](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/update-preapproval/put).

## Critérios para concluir

- Checkout indicado mostra e cobra 15% a menos na primeira competência.
- Após a cobrança promocional, a mesma assinatura volta ao preço cheio e as renovações seguintes mantêm o valor.
- Conversão e recompensa ocorrem somente após pagamento aprovado; reenvio de webhook não duplica a recompensa.
- Indicador ativo recebe 50% na próxima competência; após aprovada, o valor retorna ao preço vigente do plano.
- Indicador sem plano recebe benefício pendente e o usa no primeiro checkout futuro.
- Uma conta não recebe mais de uma recompensa por indicações adicionais.
- Se 15% e 50% forem devidos à mesma pessoa, os benefícios ficam em competências distintas.
- Upgrade/downgrade no período promocional preserva a promoção uma vez e restaura o preço do plano vigente.


## Homologação de indicações concluída — 01/11/2026

PEND-REF-001: etapa de sandbox RESOLVIDA no código 438a21418128f562d965f6d3eb5587afaef83abe. Pagamentos fictícios aprovados de R$ 8,49 (15%) e R$ 5,00 (50%); handlers restauraram R$ 9,99 via API. Indicação em cadeia agendou 50% na próxima competência, sem acúmulo por reenvio ou excedentes. Upgrade confirmou R$ 14,95 e restauração de R$ 29,90 após pagamento futuro emulado. Suíte: 84 aprovados, zero falhas. Sete contratos fictícios cancelados e conferidos. Auth/Firestore representados em memória; entrega pública do webhook e cobrança mensal futura não foram revalidadas nesta etapa. Relatório: RELEASE_HOMOLOGACAO_INDICACOES_2026-11-01.md. PR #5 ainda não integrado/publicado. Próximo passo: revisão final, integração/deploy autorizados e verificação pública. Workspace original preservado.


## Publicação confirmada — indicações e importação IA (01/11/2026)

- PEND-REF-001: descontos 15%/50% homologados e PUBLICADOS. PR #5 integrado em 3d6f5f4c831498a8938d4ba1ba463197a2c439ae; Pages 41344526378 aprovado e Render Live confirmado. Regras do Firestore compiladas e publicadas no projeto bud-finance após login do titular.
- ERR-071 / PEND-IA-ESPERA: RESOLVIDO E PUBLICADO pelo PR #6, commit e50356c715886cb9a25d371c67345c4096eebaab. CI do PR 41345953909 e Pages 41346014030 aprovados; Render Live no mesmo commit. HTTP 200 no JavaScript público confirmou prazo global de 210s, mensagem de conexão indisponível e retirada do aviso antigo de 45s.
- Validação: 91 regressões aprovadas; limites persistentes do provedor, workers travados, registro antigo com lease ativa, ausência de resposta e preservação de documentos extensos/PDF/imagem. Fluxos de falha emulados; a fatura original da captura não foi fornecida. Não afirmar que a capacidade do provedor de IA é ilimitada nem que a fatura original foi reimportada.
- Decisão operacional: três tentativas no provedor; esperas de até 15s e total de até 20s por solicitação; worker de 180s; cliente de 210s e conexão de 30s. Falha é explícita, libera a interface/admissão e não retorna transações parciais.
- Relatórios: RELEASE_IA_ESPERA_2026-11-01.md e RELEASE_HOMOLOGACAO_INDICACOES_2026-11-01.md. Nenhuma alteração no workspace original divergente. Próxima reprodução específica depende do documento original, se o usuário relatar erro após atualizar a página.
