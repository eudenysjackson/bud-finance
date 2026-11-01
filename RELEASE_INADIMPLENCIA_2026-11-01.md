# Cobrança recusada: e-mails, tolerância e retorno ao Gratuito

## Regra definida

- Tolerância de 10 dias corridos, contados desde a primeira recusa da cobrança.
- Avisos por e-mail nos dias 0, 3, 7 e 10; push nos mesmos marcos somente para dispositivos que ativaram notificações.
- A assinatura permanece disponível durante a tolerância. No dia 10 o aviso informa que é o último dia.
- Após a tolerância, a rotina confere novamente a fatura, o último pagamento e o estado/vínculo da assinatura no Mercado Pago. Só cancela quando o pagamento continua recusado, a assinatura ainda pertence ao mesmo usuário e o provedor confirma o cancelamento.
- Se o pagamento foi aprovado, está em processamento, a consulta falha ou o vínculo mudou, o backend não cancela e deixa a próxima execução reconciliar.
- Após confirmação do cancelamento, o perfil retorna ao plano Gratuito e limpa os campos da assinatura pendente. O usuário poderá contratar um plano manualmente.
- A política informa que a Bud Soluções não negativará nem enviará a cadastros de proteção ao crédito dados de inadimplência referentes à assinatura do Bud Finance.

## Alterações nesta entrega

- Backend: primeira data de recusa, pagamento associado, retomada da tolerância após ciclo novo e verificação contra aprovações posteriores.
- Sequência de e-mails com identidade visual já configurada, datas e ação para Configurações; idempotência por usuário, ciclo e marco.
- Push de assinatura com tags deduplicadas por ciclo e marco, enviado pela execução diária das 18h de Brasília.
- Plano pago preservado nos limites do servidor e do app durante os dez dias; estado visível na área da assinatura.
- Campos de cobrança e histórico de avisos protegidos contra gravação direta do navegador no Firestore.
- Política de privacidade versão 1.6; novos cadastros registram `2026-11-01-v1.6`.
- Testes adicionados para marcos de aviso, deduplicação, fim da tolerância e cancelamento confirmado; correção do contexto de data no teste do webhook.

## Validação

- `npm run test:release`: 80 testes aprovados, 0 falhas.
- Sintaxe JavaScript dos arquivos alterados e `git diff --check`: aprovados.
- A homologação do cancelamento usa Mercado Pago e Firestore simulados. Não executou cobrança, cancelamento ou disparo de e-mails em contas reais.

## Publicação

Commit `c42e6405202c7a9bf3a2e212026932425e76ae16` integrado ao `master`. GitHub Actions run `41333146559` concluiu com sucesso: regressões, empacotamento e GitHub Pages deploy.

A política pública foi conferida em `https://budsolucoes.com.br/appbudfinance/politica-privacidade.html`: versão 1.6, tolerância, retorno ao Gratuito e não negativação publicados. As regras Firestore foram compiladas e liberadas no projeto `bud-finance`.

O painel Render conferido nesta sessão mostra o Static Site `bud-finance` ligado ao `master` e implantado no commit `c42e640`. O endpoint `https://bud-finance-backend.onrender.com/api/ping` respondeu `{"ok":true}`. No workspace Render aberto, porém, só aparece o serviço Static Site; não foi possível identificar a revisão em execução do serviço Web `bud-finance-backend`. Confirmar essa revisão no workspace/serviço correto antes de considerar o fluxo automático de inadimplência integralmente publicado.

Não foi disparado e-mail ou push para usuários reais; não houve cobrança nem cancelamento real. O cancelamento automático foi validado apenas com Mercado Pago e Firestore simulados.
