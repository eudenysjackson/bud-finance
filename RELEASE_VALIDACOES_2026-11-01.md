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

Não equivale a declarar lançamento completo. Recuperação visual do e-mail ainda depende da confirmação na caixa do destinatário. Buddy, WhatsApp e Compras/Mercado seguem fora da primeira versão, conforme confirmação do titular em 01/11.

## Avanço após a publicação 77ce5f2

Commit 77ce5f2 publicado com sucesso no Pages e Live no Render; oito verificações públicas repetidas e aprovadas. Área logada online: fatura PDF (duas compras, total R$75), extrato por imagem (entrada R$100/saída R$25) e contrato por texto (R$1.000, dez parcelas de R$100, primeiro vencimento10/12/2026) chegaram à revisão com valores corretos. Os dados fictícios não foram salvos. Solicitação de recuperação enviada pela tela pública para o destinatário autorizado budsolucoes@gmail.com; retorno à tela de login conforme fluxo de sucesso. Isso não comprova recebimento/identidade visual na caixa postal.

URL de teste da aplicação real corrigida do portal raiz para a rota de webhook do backend, preservando URL produtiva e segredo. Aplicação fictícia configurada com receptor HTTPS temporário Cloudflare e o código real do webhook, executado em banco Firebase emulado. Cliente oficial cloudflared teve assinatura Authenticode válida. Receptor só disponibiliza POST/webhook/mercadopago; demais rotas404, eventos sem HMAC401. Credenciais locais e túnel não integram a publicação.

Simulador oficial enviou recurso fictício válido ao receptor isolado:200. A primeira tentativa retornou503 porque o perfil descartável não estava na exportação antiga dos emuladores; recriado somente no banco local. Ao repetir evento cancelado antigo após preparar checkout novo, detectou-se falha real: a implementação anterior limpava mpCheckout e substituía o vínculo novo pelo antigo.

Correção: eventos precisam corresponder ao mpSubscriptionId/mpCheckout atuais; gravação protegida em transação com nova conferência do vínculo. Eventos de assinatura anterior são reconhecidos sem alterar a conta; checkout ainda sem ID recebe503 para reenvio posterior. Quatro regressões adicionadas (cancelamento antigo, checkout novo preservado, recusa antiga e corrida com reserva).67 testes e sete grupos HTTP/emulados aprovados. Nova entrega oficial assinada retornou200 preservando assinatura/checkout pendentes do teste atual, conferidos no emulador.

Ainda em andamento: aprovação do checkout fictício novo com entrega automática (sem simulador). O Mercado Pago pediu CAPTCHA na entrada do comprador; solicitado ao titular. Não há pagamento real envolvido.
