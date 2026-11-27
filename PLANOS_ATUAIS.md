# Planos Bud Finance — nomes preparados em 26/11/2026

Troca de nomes solicitada pelo titular, sem mudar preços ou funcionalidades. Esta tabela passa a orientar materiais novos após a publicação coordenada do app, site e backend.

| Nome comercial | Nome anterior | Preço mensal | Contas | Cartões | Lançamentos/mês | Importações/mês | IA/mês |
|---|---|---|---|---|---|---|---|
| Gratuito | Gratuito | Grátis | 1 | 1 | 5 | 0 | 0 |
| Starter | Starter | R$ 9,99 | 1 | 1 | 10 | 0 | 0 |
| Plus | Pro | R$ 29,90 | 2 | 2 | 15 | 5 | 5 |
| Pró | Plus | R$ 49,90 | Ilimitadas | Ilimitados | Ilimitados | Ilimitadas | Ilimitada |

O teste de três dias continua com os recursos do plano ilimitado, agora chamado Pró. Ao terminar sem assinatura, retorna ao Gratuito; dados excedentes permanecem guardados e bloqueados conforme as regras existentes. Cada parcela consome um lançamento no mês da fatura. IA depende da disponibilidade do serviço.

## Identificadores e clientes existentes

Os códigos internos são identificadores permanentes, não os nomes comerciais: `plus` identifica o atual Pró ilimitado; `pro` identifica o atual Plus com cotas. Manter os campos `plano`, trocas agendadas, upgrades pendentes, preços, external_reference e integrações inalterados. **Não executar uma troca global de pro/plus no Firestore.** Isso trocaria os benefícios em vez de apenas os nomes.

Com a versão publicada, um cliente cujo `plano` é `plus` passa a ver Pró automaticamente; `pro` passa a ver Plus. Não há migração de dados necessária. Novas cobranças recebem os títulos comerciais atualizados; descrições de assinaturas já existentes no provedor não foram alteradas por operação remota.

O Gestor com ficha de clientes está em branch separada, ainda não publicado. Ao integrar essa branch, aplicar também os novos rótulos em filtros, históricos e fichas, mantendo os mesmos identificadores. Não integrar o protótipo de Visão Geral/Vendas/Financeiro apenas para renomear planos.
