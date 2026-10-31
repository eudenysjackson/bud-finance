# Publicação do Bud Finance

## Antes de publicar

1. No Render, configure `ADMIN_INVITE_CODE` com um valor longo e exclusivo.
   Esse código cria administradores pelo backend e não deve ser salvo no
   Firestore ou compartilhado em páginas públicas.
2. Confirme que `FIREBASE_SERVICE_ACCOUNT`, `MP_ACCESS_TOKEN`,
   `MP_WEBHOOK_SECRET` e `EMAIL_VERIFICATION_SECRET` já estão configurados no
   serviço de produção.
3. Faça login no Firebase CLI e publique as regras:

   ```powershell
   npx firebase login
   npm run deploy:firestore-rules -- --project bud-finance
   ```

4. Envie ao GitHub somente após revisar as alterações do diretório de trabalho.
   O GitHub Pages publicará a raiz institucional em `/` e a landing do produto
   em `/budfinance/`.

## Verificação pós-publicação

- `https://budsolucoes.com.br/` mostra a página institucional em construção.
- `https://budsolucoes.com.br/budfinance/` abre a página comercial.
- `https://budsolucoes.com.br/appbudfinance/` continua abrindo o aplicativo.
- Criar administrador exige o código configurado no Render.
- Uma importação de fatura exige sessão autenticada e respeita a cota do plano.

## Configuração de IA (retomada em 27/10/2026)

- `GROQ_API_KEY`: chave do backend, nunca do frontend.
- `GROQ_MODEL=qwen/qwen3.8-27b`: modelo multimodal validado com a chave local. Remover eventual override antigo `qwen/qwen3.6-27b`.
- `GROQ_MAX_OUTPUT_TOKENS`: saída por extração; servidor usa 8192 quando ausente. A conta local exige 900 pela cota atual de saída. Conferir a capacidade real da conta antes de definir produção. Documentos longos podem precisar ser divididos.
- Reiniciar o backend após mudar variáveis.
- Validação local: iniciar Auth/Firestore Emulator e backend com `backend/.env.local`; executar `node --env-file=backend/.env.local scripts/smoke-ia-local.js`. Os documentos em `tests/fixtures/ia` são fictícios. O script pode criar a conta de homologação Plus no emulador e consumir chamadas reais Groq; não envia notificações nem grava movimentações financeiras.

## Atualização da leitura longa (27/10/2026)

- Usar Node >=20.9 no Render e instalar dependências pelo lockfile do backend (`npm ci` na pasta `backend`).
- Publicar backend e frontend juntos: o navegador usa `X-Bud-Async` e acompanha `GET /api/ia/jobs/:id`. CORS permite o novo header.
- A divisão de texto/imagem e a espera por cota são automáticas; o usuário envia o arquivo inteiro. O orçamento 900 é por trecho, não por documento.
- Verificação automatizada: `node --test tests/ai-reader.test.js tests/ai-jobs.test.js tests/ai-client.test.js`.
- Verificação com provedor: `node --env-file=backend/.env.local scripts/smoke-ia-local.js "Fatura longa" "PDF escaneado"`. Pode aguardar minutos pela cota externa; não grava transações.
- Histórico de27/10: trabalhos eram mantidos na memória. A candidata de31/10 substitui essa implementação pelo armazenamento compartilhado descrito abaixo.

## Candidata de importações — 27/10/2026

Consultar RELEASE_IMPORTACOES_2026-10-27.md. Executar npm run test:imports antes da publicação. Pages agora publica somente dist/site, gerado por npm run package:release após injeção de variáveis. O empacotador recusa sobrescrever um artefato existente; preservar/mover a pasta anterior antes de gerar novamente. CI parte de checkout limpo. Backend exige os novos módulos ai-reader/ai-jobs/invoice-reader. Esta tarefa não realizou deploy online.

## Correções de regras e conta — 27/10/2026

Antes de publicar: npm run test:release. Em ambiente local com backend/emuladores: npm run test:release:local. Incluir backend/account-lifecycle.js e publicar firestore.rules atualizado. Subir backend e regras antes do frontend que usa DELETE /api/account. Nova rota exige login recente e bloqueia exclusão enquanto houver assinatura identificada; cancelamento continua no fluxo de Plano Atual. Site público ainda não reflete a separação local raiz institucional /budfinance vendas /appbudfinance login. Consultar RELEASE_STATUS_2026-10-27.md.

## Versão final de homologação — 27/10/2026

Executar npm run test:release (31 casos) e npm run test:release:local com emuladores/backend ativo (7 grupos). Publicar a candidata atualizada e não usar os resultados da versão antiga online como homologação dela. EmailJS Gmail foi reconectado e template_2mp7qgq salvo no serviço. Conferir EMAILJS_SERVICE_ID, PUBLIC_KEY, PRIVATE_KEY e templates no Render; FRONTEND_URL deve ser https://budsolucoes.com.br/appbudfinance sem barra final. Raiz agora é Produtos Bud, /budfinance vendas, /appbudfinance login. Render pago já responde, mas ainda é necessário subir os novos arquivos. Detalhes em RELEASE_STATUS_2026-10-27.md.

## Correção adicional Mercado Pago — 27/10/2026

-Processamento de subscription_authorized_payment via /authorized_payments/{id}, resolvendo preapproval_id da fatura quando o pagamento não informa esse vínculo.
-Webhook confirma200 somente após processar. Falha de consulta/gravação responde503 para permitir reenvio; o pagamento não é liberado quando a verificação do titular falha.
-Assinatura HMAC validada em tempo constante; IDs do corpo e query devem coincidir. Valores alfanuméricos normalizados para minúsculas conforme documentação.
-Expiração usa next_payment_date do Mercado Pago. Na ausência, preserva prazo existente em notificações repetidas, evitando extensão indevida; cálculo mensal trata meses curtos.
-12 testes específicos de checkout aprovados;37 regressões totais aprovadas. Testes usam respostas controladas, sem cobrança real.

Configuração necessária no painel Mercado Pago: webhook HTTPS do backend, eventos subscription_preapproval, subscription_authorized_payment e payment. Conferir MP_ACCESS_TOKEN e MP_WEBHOOK_SECRET no Render, sem expor os valores. Publicar server.js atualizado antes da conferência real.

Referências oficiais: https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks e https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/get-authorized-payment/get.

Abertura real do checkout permanece pendente: a aba pública consultada ainda estava no login, enquanto a conta de homologação .local pertence ao emulador. Solicitação de login enviada ao usuário; nenhuma senha ou sessão foi contornada. Nenhuma alteração desta etapa foi publicada.

## Candidata validada em31/10/2026

Estado atual e evidências: RELEASE_VALIDACOES_2026-10-31.md. O histórico acima registra etapas anteriores, não a aprovação online desta candidata.

1. Executar npm run test:release (51 casos), npm run test:release:local (7 grupos) e npm run test:ai:recovery (4 grupos, emuladores). Os oito testes reais de importação passaram; a fatura longa levou79,6s com a cota externa atual.
2. Publicar firestore.rules e firestore.indexes.json no projeto bud-finance e aguardar os índices de collection-group expiresAt ficarem READY. Com Firebase CLI autenticado: npx firebase deploy --only firestore:rules,firestore:indexes --project bud-finance. As regras bloqueiam _seguranca, _ai_jobs e seus fragmentos e protegem mpCheckout/planoTroca/mpPayerId.
3. Publicar backend com account-lifecycle.js, ai-reader.js, ai-jobs.js, ai-job-store.js, invoice-reader.js e subscription-change.js, além de server.js e lockfile. Confirmar índices antes de expor uploads persistidos; a limpeza temporária depende dessas consultas. Cada minuto o processo remove expirados; entradas são apagadas na conclusão, resultados retidos30min e trabalhos ativos no máximo2h. Arquivos temporários ficam no Firebase do projeto, sem token de autenticação salvo. Retomada após reinício depende de polling autenticado com jobId ainda conhecido pelo navegador.
4. Render já recebeu as cinco variáveis autorizadas e reiniciou com o build antigo. Não é necessário gerar outro secret por causa do deploy. Conferir as demais variáveis existentes sem expor valores. Não usar credencial de vendedor fictício em produção.
5. Gerar dist/site por npm run package:release após injeção das variáveis públicas. Preservar artefato anterior, revisar e publicar somente essa pasta no Pages. Não publicar .tools, env, dados de emuladores ou evidências de contas.
6. Reativar/executar workflow de deploy apenas após autorização de publicação. Actions estava desativado; Billing atual não mostrou alerta, mas execução ainda precisa ser comprovada. Não reativar Daily Push Notifications sem autorização para o envio aos usuários.
7. Homologar a versão nova em produção: autenticação, confirmação/recuperação com identidade visual, oito importações, troca/cancelamento e entrega externa do webhook público de Mercado Pago com assinatura válida. Testes financeiros continuam com contas fictícias, sem cobrança real. Confirmar push no dispositivo; o envio FCM aceito nesta etapa não foi recebido pelo usuário.

Checkout: reservas transacionais impedem criação concorrente. Checkout pendente do mesmo plano reutiliza link/ID; outro plano exige cancelar a contratação existente. Em timeout ou resposta incerta, o bloqueio fica retido para conciliação pelo suporte, sem recriar cobrança automaticamente. Consultar o recurso no MP e resolver a assinatura antes de liberar manualmente o registro mpCheckout; nunca apagar o bloqueio apenas pelo tempo transcorrido.
