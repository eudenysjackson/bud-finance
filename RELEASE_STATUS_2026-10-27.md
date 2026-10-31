# Avanço para lançamento — 27/10/2026

Complementa RELEASE_IMPORTACOES_2026-10-27.md. Escopo desta etapa: correções locais independentes da disponibilidade do Render e verificação dos endereços públicos.

## Corrigido e validado localmente

- Metas: permissão específica de leitura/gravação de depósitos aninhados, restrita ao titular ou administrador. Aporte agora inclui histórico, saldo, meta e transação no mesmo batch; inclui dataReferencia/mesReferencia para aparecer nas análises. Aporte de R$10 e histórico conferidos no navegador.
- Exclusão de conta: frontend modular usa DELETE /api/account. Backend exige autenticação recente (5min), confirmação EXCLUIR e usa somente UID do token. Remove recursivamente o perfil e subcoleções (incluindo depósitos/cota) antes de remover Auth. Uma assinatura identificada bloqueia exclusão e exige cancelamento prévio, para evitar excluir perfil mantendo cobranças. A exceção a identificadores de teste exige ambiente emulado. Regras continuam impedindo exclusão direta do perfil pelo cliente.
- Relatórios: cartões consultados em carteira com tipo credito. Evolução de faturas também ignora pago=false. Carregamento e gráficos conferidos no navegador sem erros; aporte aparece nas despesas do mês.
- Push: CORS permite DELETE; preflight do domínio www e revogação autenticada confirmados no emulador. Entrega real FCM/VAPID/agendamento permanece dependente da configuração online.
- Página de verificação de e-mail: corrigida referência a favicon inexistente.
- Configurações deixa de anunciar WhatsApp como benefício disponível do Plus nesta versão.

## Evidência de testes

-21 testes automatizados passaram: npm run test:release.
-5 grupos de integração Auth/Firestore/HTTP passaram: npm run test:release:local, com backend e emuladores iniciados. O script cria e limpa somente contas descartáveis próprias; não altera usuários de produção.
-Testes de isolamento: outro titular não lê/escreve depósitos; plano/cota protegidos; batch financeiro rejeitado reverte todas as operações; exclusão não afeta o outro titular; assinatura bloqueia exclusão sem consultar Mercado Pago.
-Sintaxe de server.js, configuracoes.js, metas.js e relatorios.js aprovada.
-Verificados33 HTMLs locais; único recurso inexistente encontrado foi favicon.ico da verificação de e-mail, corrigido para logo.png.
-Evidências: test-results/qa-metas-historico.png, qa-relatorios-carteira.png, qa-pagina-vendas-local.png.
-Pacote frontend dist/site regenerado; pacote anterior preservado em dist/site-importacoes-previa-20261027. CI gera dist/site após injetar variáveis reais de produção. Nenhuma publicação feita nesta etapa.

## Endereços públicos conferidos

| Endereço | Resultado observado |
|---|---|
| https://www.budsolucoes.com.br/appbudfinance/ |200 após redirecionar para domínio sem www; página de login |
| https://budsolucoes.com.br/appbudfinance/ |200; página de login |
| https://budsolucoes.com.br/ |200; página comercial Bud Finance ainda na raiz |
| https://budsolucoes.com.br/budfinance/ |404; reorganização local ainda não publicada |

Localmente: raiz index.html institucional/em construção; budfinance/index.html página comercial; appbudfinance/index.html login. Os links da página comercial local apontam para /appbudfinance/ e /appbudfinance/cadastro.html. Não houve mudança dos destinos públicos nesta etapa. A comparação de conteúdo não é uma homologação dos serviços conectados à página.

## Ainda depende de publicação/configuração externa

1. Subir backend atualizado (incluindo account-lifecycle.js), publicar firestore.rules e frontend juntos. Sem essas regras em produção, aportes continuam sujeitos ao bloqueio anterior. Exclusão exige a nova rota disponível.
2. Reativar e validar Render, variáveis de e-mail/IA/Mercado Pago, webhook e ciclo real de assinatura. Usuário está verificando billing no Render.
3. Definir capacidade Groq; latência universal continua não garantida. Persistência da fila de IA continua pendente antes de operar com múltiplas instâncias.
4. Confirmar configuração de push/VAPID/agendamento se notificações estiverem no lançamento; o teste desta etapa validou revogação e CORS, não entrega real.
5. Revisar/integrar branch e publicar. Depois conferir cadastro, e-mail, cobrança, plano, aportes, exclusão e importações no domínio público.

Buddy e assistente WhatsApp continuam fora do lançamento. Esta etapa não equivale a uma auditoria exaustiva de todos os fluxos do app ou a aprovação do funcionamento em produção.

## Atualização final de e-mails, checkout e portal — 27/10/2026

Esta candidata substitui os fluxos antigos; a homologação final passou a usar o código atualizado, conforme orientação do usuário.

-31 testes automatizados aprovados (npm run test:release), incluindo4 de e-mail e6 de checkout.
-7 grupos emulados aprovados (npm run test:release:local): recuperação com código real do Auth Emulator e uso único; fluxo HTTP de pagamento simulado pending/rejected/approved/cancel; isolamento de depósitos/cotas; rollback de batch rejeitado; CORS/revogação de push; exclusão recursiva isolada; bloqueio de exclusão com assinatura.
-Checkout valida identidade e preço no servidor, assinatura do webhook, falha do provedor e atualização de plano. Aprovação limpa pagamentoPendente e registra assinaturaStatus. Cancelamento simulado LOCAL_TEST não chama o Mercado Pago real. Uma cobrança real continua não realizada e não homologada por estes testes.
-Recuperação: geração do link agora inclui mode=resetPassword; tela aceita também links antigos sem mode. Parametrização mantém action_url e reset_url. Falha de transporte não mostra falso aviso de envio no navegador; logs do backend registram falha sem expor o código. Configurações deixa de recorrer silenciosamente ao e-mail Firebase sem identidade visual.
-Confirmação: código de6 dígitos, magic_link/verify_url e matrícula compatíveis com o template. Callback local conecta ao Auth Emulator.
-Portal raiz agora apresenta Produtos Bud e Bud Finance; links seguem /budfinance/ para vendas e /appbudfinance/ para login. Apenas o Bud Finance está identificado neste repositório como produto disponível; não foram inventados outros produtos.

### Serviço real de e-mail

O usuário autorizou testes para budsolucoes@gmail.com. O e-mail inicialmente recebido era o fallback padrão Firebase, confirmado por imagem. Histórico EmailJS registrou Gmail_API: Invalid grant. Please reconnect your Gmail account. O usuário refez a autorização Gmail; a conexão foi salva no EmailJS. Template de recuperação template_2mp7qgq atualizado com logo no domínio oficial, cores e layout Bud Finance; persistência conferida após recarregar. O template de confirmação já possui marca, código e link mágico e foi conferido no painel.

Envio visual identificado como teste foi aceito pela API EmailJS (200 OK) e pelo histórico (result1 em27/10/2026). O botão desse teste apenas abre o login; nenhuma senha real foi alterada. A recuperação pelo backend público retornou sucesso genérico, mas não produziu registro de entrega no histórico consultado; não é evidência suficiente para homologar esse backend antigo. A nova integração foi validada em ambiente atualizado e deverá ser conferida após publicação.

### Situação de publicação

Render voltou a responder200 em /api/ping após o pagamento informado. Produção observada ainda usa JS e CORS antigos; site comercial ainda estava na raiz, /budfinance/ retornava404 e /appbudfinance/ era login. Nenhum deploy foi feito nesta etapa. Publicar frontend, backend (incluindo todos os novos módulos), regras e variáveis compatíveis; executar uma conferência real após deploy. A aceitação em homologação não é garantia de variáveis externas, entrega em caixa de entrada ou aprovação de cobrança em produção.

Prévia visual: test-results/qa-email-identidade-bud.png. Template atualizado: backend/emailjs-template-comunicacao.html. Testes: tests/email-flows.test.js e tests/checkout.test.js.

## Correção adicional Mercado Pago — 27/10/2026

-Processamento de subscription_authorized_payment via /authorized_payments/{id}, resolvendo preapproval_id da fatura quando o pagamento não informa esse vínculo.
-Webhook confirma200 somente após processar. Falha de consulta/gravação responde503 para permitir reenvio; o pagamento não é liberado quando a verificação do titular falha.
-Assinatura HMAC validada em tempo constante; IDs do corpo e query devem coincidir. Valores alfanuméricos normalizados para minúsculas conforme documentação.
-Expiração usa next_payment_date do Mercado Pago. Na ausência, preserva prazo existente em notificações repetidas, evitando extensão indevida; cálculo mensal trata meses curtos.
-12 testes específicos de checkout aprovados;37 regressões totais aprovadas. Testes usam respostas controladas, sem cobrança real.

Configuração necessária no painel Mercado Pago: webhook HTTPS do backend, eventos subscription_preapproval, subscription_authorized_payment e payment. Conferir MP_ACCESS_TOKEN e MP_WEBHOOK_SECRET no Render, sem expor os valores. Publicar server.js atualizado antes da conferência real.

Referências oficiais: https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks e https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/get-authorized-payment/get.

Abertura real do checkout permanece pendente: a aba pública consultada ainda estava no login, enquanto a conta de homologação .local pertence ao emulador. Solicitação de login enviada ao usuário; nenhuma senha ou sessão foi contornada. Nenhuma alteração desta etapa foi publicada.

## Checkout real aberto com sessão online — 27/10/2026

Após o usuário autenticar sua conta no domínio público, o botão Assinar Starter da página comercial publicada gerou a assinatura pendente e abriu a página oficial www.mercadopago.com.br. A tela exibiu Bud Soluções, Bud Finance Starter e R$9,99. Opções disponíveis: conta Mercado Pago, app Mercado Pago e cartão de crédito.

Confirmação desta etapa: sessão do app, chamada autenticada ao backend e geração do checkout no provedor funcionaram no ambiente publicado. Nenhum meio de pagamento foi preenchido e nenhum pagamento foi confirmado. Evidência: test-results/qa-checkout-real-starter.png. Não foram armazenados tokens de sessão ou links sensíveis no relatório.

Ainda falta validar aprovação financeira, recebimento do webhook e liberação/renovação do plano em cenário integrado real ou sandbox. O usuário foi consultado sobre contas de teste sem cobrança ou conclusão pessoal do pagamento real Starter de R$9,99/mês. A geração bem-sucedida do checkout não equivale a aprovação de pagamento. As correções locais adicionais de webhook e recorrência continuam precisando de publicação.

## Identificação da conta vendedora pelo Render — 27/10/2026

O usuário escolheu contas de teste, sem cobrança real, e autenticou o Render para ajudar a localizar a conta vendedora. No serviço bud-finance-backend (plano Starter), MP_ACCESS_TOKEN e MP_WEBHOOK_SECRET estão presentes. A presença das variáveis não comprova que o segredo corresponde ao webhook configurado no painel do provedor.

Consulta somente de leitura a GET /users/me, executada no Web Shell com o token já existente no ambiente, retornou HTTP200 e identificou uma conta brasileira de produção (test_user=false). O token não foi exibido, copiado para o repositório nem alterado. A identificação de acesso foi informada diretamente ao usuário, sem registrar seu e-mail neste relatório.

Aba oficial de integrações do Mercado Pago aberta para login do titular. Próxima etapa depende desse acesso: consultar contas de teste e conferir eventos/segredo do webhook. Nenhuma credencial de produção foi substituída e nenhuma cobrança foi feita. O checkout de produção aberto anteriormente não deve receber cartões de teste.

### Painel autenticado e contas de teste

Após o titular concluir as verificações exigidas pelo provedor, foi possível consultar a aplicação bud finance, configurada para Assinaturas, e duas contas brasileiras existentes (comprador e vendedor). Nenhuma conta nova foi criada. O painel orienta usar as credenciais produtivas da conta vendedora de teste para homologar Assinaturas; não substituir o token da conta real no Render.

Configuração observada de Webhooks: URL de produção https://bud-finance-backend.onrender.com/webhook/mercadopago; URL de teste https://budsolucoes.com.br. O destino de teste aponta para a página do site e precisa ser substituído por um receptor de homologação antes de validar a entrega real dos eventos nesse ambiente. Planos e assinaturas e Pagamentos (legacy) estavam selecionados. Nenhuma configuração foi salva ou segredo redefinido.

Iniciado login no vendedor de teste existente; o provedor exigiu reCAPTCHA antes da senha. Solicitada conclusão pelo titular na aba aberta. Aprovação, entrega externa do webhook e liberação do plano com essa conta ainda não foram executadas. Não confundir este bloqueio de login do provedor com falha do checkout da aplicação.

Após o titular resolver o CAPTCHA, login no vendedor fictício concluído com sua senha existente. O painel mostrou que essa conta ainda não possui aplicações. Preparado formulário de Assinaturas com nome Bud Finance Homologacao Assinaturas; a criação exige aceite de termos e declaração de privacidade. Solicitada autorização específica ao titular antes desse aceite. Aplicação e credenciais de homologação ainda não criadas; produção permanece sem alteração.

O titular autorizou explicitamente o aceite e a criação. Aplicação de teste criada com sucesso (7543918615481171), vinculada ao vendedor fictício, e tela de credenciais disponível. Evidência sem chaves: test-results/qa-mp-aplicacao-teste-criada.png. O navegador oculta o valor privado nos campos e a cópia automatizada retornou vazia; solicitado ao titular copiar o Access Token da conta fictícia para .tools/mp-sandbox.credentials.local (diretório ignorado pelo Git), sem enviar pelo chat. Arquivo preparado com accessToken vazio e IDs esperados para conferência antes do teste. Não foi renovada nenhuma credencial nem alterado o token do Render. Testes financeiros e webhook integrado permanecem pendentes.

## Assinatura integrada com contas fictícias aprovada — 27/10/2026

O titular salvou a credencial localmente pelo Bloco de Notas. GET /users/me retornou200, ID correspondente ao vendedor esperado e tag test_user. Comprador fictício autenticado após CAPTCHA concluído pelo titular; seu e-mail foi conferido no perfil do provedor. Nenhuma credencial foi incluída em artefatos públicos.

Executado o código das rotas de cobrança da candidata atualizada, extraído de backend/server.js, com Firebase Auth/Firestore reais dos emuladores locais do projeto bud-finance-local. Harness privado .tools/mp-sandbox-integration.cjs limita a credencial ao vendedor fictício esperado e cria somente usuário com prefixo mp-sandbox-. Não usa o Firebase de produção nem troca variáveis no Render.

Resultados:

- POST create-subscription com token real do Auth Emulator gerou checkout oficial Starter de R$9,99 na conta fictícia. Plano permaneceu free enquanto pendente.
- Navegador autenticado no comprador fictício concluiu o checkout usando Mastercard de teste, titular APRO e documento de teste da documentação oficial. Tela confirmou a assinatura e o valor de R$9,99.
- Consulta ao recurso do provedor confirmou status authorized. Handler de webhook da candidata, invocado localmente com assinatura HMAC de homologação, consultou o recurso real da conta fictícia, retornou200, ativou Starter e limpou pagamentoPendente.
- Repetição do evento manteve a mesma expiração.
- Rota de cancelamento autenticada da candidata cancelou a assinatura no Mercado Pago e restaurou free no Firestore emulado. A tela do comprador confirmou Cancelada.
- GET /authorized_payments/search filtrado pela assinatura retornou fatura processed, payment.status approved e valor9,99. Trata-se de dinheiro fictício; nenhuma cobrança real foi feita.

Limite do teste: a assinatura foi criada sem notification_url nesta execução isolada. O evento local foi assinado pelo harness, não entregue pela infraestrutura externa do Mercado Pago. Isso valida o processamento da candidata com recursos reais de teste, mas não certifica alcance público, configuração de eventos nem correspondência do segredo do painel com o Render. Renovação futura agendada não foi antecipada ou executada. Entrega externa e recorrência online continuam pendentes antes da homologação final de produção.

Evidências: test-results/qa-mp-assinatura-teste-aprovada.png e test-results/qa-mp-assinatura-teste-cancelada.png. Configuração pública, frontend, regras e backend continuam sem deploy nesta etapa. Destino de webhook de teste na aplicação real permanece apontando para a raiz do site; só deve mudar quando houver um receptor de homologação adequado.
