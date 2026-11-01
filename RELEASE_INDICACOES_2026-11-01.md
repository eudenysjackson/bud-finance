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
- Testes: quatro regressões foram adicionadas ao checkout e um workflow sem deploy foi criado para PRs/branches codex. Execução Actions 41341578144 iniciada em 01/11/2026; resultado ainda pendente.
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
