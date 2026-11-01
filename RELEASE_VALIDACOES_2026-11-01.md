# Retomada de lançamento — 01/11/2026

## Verificações públicas

`node scripts/smoke-production-public.cjs`: oito verificações aprovadas. Portal, vendas, login e saúde do backend retornam 200; checkout/troca de plano sem login, cron sem segredo e webhook sem assinatura retornam 401. O teste não envia e-mails, não grava lançamentos e não realiza pagamentos.

## Mercado Pago

Senha do vendedor fictício recuperada no painel oficial de contas de teste, sem necessidade de redefinição. Acesso ao vendedor fictício confirmado. Aplicação 7543918615481171 ainda sem configuração de Webhooks; isso é distinto da aplicação real.

Na aplicação real 7518961180308151, a URL de produção já aponta para `https://bud-finance-backend.onrender.com/webhook/mercadopago`; eventos Planos e assinaturas e Pagamentos estão selecionados. A URL de teste ainda aponta para o portal raiz e não deve ser usada como evidência de processamento financeiro.

O simulador oficial enviou `subscription_preapproval` ao receptor de produção com ID propositalmente inexistente `9999999999999999999`. Retorno 503; o log do Render confirmou `[MP webhook] MP subscription HTTP 404`. Isso comprova chegada pública e passagem pelo HMAC, pois a consulta ao provedor só ocorre após validar a assinatura. O 503 nesse ensaio não indica indisponibilidade geral: o recurso fictício não existe. Não houve alteração de planos ou cobrança.

Continua pendente: evento financeiro válido entre contas fictícias recebido automaticamente por receptor público isolado, com atualização do plano. Token/segredo do vendedor fictício não podem substituir os de produção. Simulador com ID inexistente não comprova aprovação, recorrência ou liberação automática.

## Dependências

Consulta npm: nove moderadas, zero altas/críticas. Atualização global de `qs` para 6.16.2 via overrides mantém versão principal e elimina seu alerta: oito moderadas restantes. Instalação com `--omit=dev --ignore-scripts`; sem `--force`. As 63 regressões passaram com a dependência atualizada.

Restantes: Firebase Admin/Firestore/Storage, google-gax/gaxios/retry-request/teeny-request/uuid. A correção completa indicada pelo npm envolve Firebase Admin 14.5.0, uma migração principal. Os usos de uuid inspecionados nessas bibliotecas utilizam v4; o alerta refere-se a v3/v5/v6 com buffer fornecido. Essa inspeção não prova ausência de todos os caminhos afetados. Não há uso direto de qs ou uuid no backend do app. Express usa qs para interpretar consultas; por isso a atualização foi aplicada.

Os sete grupos HTTP/emulados também passaram: recuperação e código de uso único, checkout/troca/cancelamento simulados, regras, atomicidade financeira, CORS/push, exclusão e isolamento de contas. Emuladores foram reiniciados antes da execução; falhas de conexão anteriores ocorreram antes de estarem prontos.

## Notificações

Cron permanece `0 21 * * *` (18h America/Sao_Paulo). Consulta de execuções no período da manhã ainda mostra como última execução a validação manual bem-sucedida de 31/10. A execução automática de 01/11 às 18h ainda deve ser observada. Não foi disparado envio coletivo manual nesta retomada.

## Limites desta validação

Não equivale a declarar lançamento completo. Área logada publicada, importações de IA e recuperação visual do e-mail ainda dependem da conferência final com sessão válida. Buddy e WhatsApp seguem fora da primeira versão.
