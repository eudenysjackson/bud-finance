# Homologação de indicações — 01/11/2026

## Resultado

Homologação dos descontos concluída para o código `438a21418128f562d965f6d3eb5587afaef83abe`, PR #5. Sem publicação nesta etapa.

| Cenário | Evidência | Resultado |
| --- | --- | --- |
| Indicado, Starter de R$ 9,99 | Fatura do Mercado Pago `processed`, pagamento `approved` por R$ 8,49 | 15% aprovado |
| Após a primeira cobrança de 15% | Handler candidato processou o pagamento consultado na API; GET da assinatura retornou R$ 9,99 | Preço normal restaurado |
| Indicador sem assinatura | Conversão anterior criou recompensa pendente; checkout futuro candidato retornou R$ 5,00; fatura oficial aprovada | 50% aprovado |
| Após a cobrança de 50% | GET da mesma assinatura retornou R$ 9,99; recompensa marcada `used` | Benefício de um ciclo |
| Indicado que depois indica amigo | Sua cobrança de R$ 8,49 foi concluída; nova conversão agendou R$ 5,00 na competência seguinte | Benefícios separados |
| Reenvio de pagamento e indicação excedente | Handlers reexecutados; recompensa existente e preço preservados | Sem novo desconto acumulado |
| Upgrade com 50% agendados | R$ 14,95 confirmado na API para Pro; evento futuro emulado aplicou Pro e restaurou R$ 29,90 na mesma assinatura | Preço do plano vigente preservado |
| Limpeza | Os sete contratos fictícios criados foram cancelados e relidos pela API | Nenhuma recorrência de teste aberta |

## Procedimento e alcance

- Vendedor validado por `/users/me`: identidade esperada, tag `test_user`, site MLB. Comprador com ID esperado e endereço `@testuser.com`; somente cartão fictício oficial, nome APRO.
- Código candidato executado numa cópia isolada da branch do PR. Auth e armazenamento transacional foram representados em memória; nenhum acesso ao Firebase de produção.
- Checkout pendente foi criado pela rota candidata e valor confirmado no provedor. O Mercado Pago recusou autorizar esse contrato por PUT do vendedor (`only the payer can`). Para testar a cobrança sem intervenção no checkout hospedado, foi criado contrato autorizado pelo endpoint oficial POST com token de cartão fictício e as mesmas condições; o contrato pendente foi encerrado.
- Pagamentos iniciais de 15% e 50% foram efetivamente aprovados no ambiente fictício do Mercado Pago. Reprocessamento executou os handlers candidatos consultando esses pagamentos na API.
- Próxima cobrança mensal do indicador e troca futura de plano: evento de pagamento emulado na data futura, com alterações de preço e leitura de confirmação reais no sandbox. Não afirmar que uma cobrança de dezembro já ocorreu.
- Entrega pública automática de webhook, interface do checkout hospedado e regras reais do Firestore não foram revalidadas por este harness. A evidência desta etapa cobre os valores aceitos pelo provedor e os handlers candidatos; não equivale a validar a implantação pública do novo código.
- O primeiro contrato autorizado foi cancelado antecipadamente por um erro de referência no harness privado; o harness foi corrigido e a sequência repetida em contrato autorizado ativo. Isso não exigiu alteração no código do produto. Todos os contratos dessa tentativa também entraram na limpeza.

## Regressões

- `node --test tests/checkout.test.js`: 37 aprovados, zero falhas.
- `npm run test:release`: 84 aprovados, zero falhas, na cópia candidata com dependências locais completas. A primeira tentativa sem dependências e a instalação incompleta falharam por módulos ausentes; resolvido reutilizando as dependências completas, sem alterar o código.
- Segredos, tokens de cartão, IDs de pagamentos e estado privado do harness permanecem fora do Git.

## Continuidade

PEND-REF-001: homologação financeira de sandbox resolvida. Integração do PR, deploy e verificação pública do novo fluxo continuam separados e pendentes; nenhuma publicação foi realizada nesta etapa.

