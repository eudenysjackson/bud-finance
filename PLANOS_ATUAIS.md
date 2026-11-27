# Planos Bud Finance — nomes preparados em 26/11/2026

Troca de nomes solicitada pelo titular, com novos preços e as mesmas funcionalidades. Esta tabela passa a orientar materiais novos após a publicação coordenada do app, site e backend.

| Nome comercial | Nome anterior | Preço mensal | Contas | Cartões | Lançamentos/mês | Importações/mês | IA/mês |
|---|---|---|---|---|---|---|---|
| Gratuito | Gratuito | Grátis | 1 | 1 | 5 | 0 | 0 |
| Starter | Starter | R$ 4,99 | 1 | 1 | 10 | 0 | 0 |
| Plus | Pro | R$ 14,99 | 2 | 2 | 15 | 5 | 5 |
| Pro | Plus | R$ 29,99 | Ilimitadas | Ilimitados | Ilimitados | Ilimitadas | Ilimitada |

O teste de três dias continua com os recursos do plano ilimitado, agora chamado Pro. Ao terminar sem assinatura, retorna ao Gratuito; dados excedentes permanecem guardados e bloqueados conforme as regras existentes. Cada parcela consome um lançamento no mês da fatura. IA depende da disponibilidade do serviço.

## Identificadores e clientes existentes

Assinantes atuais entram nos novos valores na próxima renovação, conforme decisão do titular. O ciclo já pago não será cobrado novamente. Descontos por indicação continuam respeitados.

Os códigos internos são identificadores permanentes, não os nomes comerciais: `plus` identifica o atual Pro ilimitado; `pro` identifica o atual Plus com cotas. Manter os campos `plano`, identificadores de trocas agendadas, upgrades pendentes e external_reference inalterados; atualizar os valores recorrentes pelo fluxo de migração. **Não executar uma troca global de pro/plus no Firestore.** Isso trocaria os benefícios em vez de apenas os nomes.

Com a versão publicada, um cliente cujo `plano` é `plus` passa a ver Pro automaticamente; `pro` passa a ver Plus. A redução de preços de assinaturas já ativas exige a atualização do valor recorrente no Mercado Pago, para a próxima renovação. Novas cobranças recebem os títulos comerciais atualizados; a execução da migração atualiza também o título das assinaturas existentes. Essa operação ainda não foi executada.

O Gestor com ficha de clientes está em branch separada, ainda não publicado. Ao integrar essa branch, aplicar também os novos rótulos em filtros, históricos e fichas, mantendo os mesmos identificadores. Não integrar o protótipo de Visão Geral/Vendas/Financeiro apenas para renomear planos.
