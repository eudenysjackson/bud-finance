# Monitoramento gratuito — preparação em 26/11/2026

Branch `codex/monitoramento-gratuito-20261126`, baseada no master `8be3966`. Não publicada nem ativada externamente. O titular pediu somente as opções gratuitas, manteve o serviço atual de e-mails e escolheu a conta corporativa da Bud para criar o Sentry.

## Entrega preparada

- Firebase Performance Monitoring: SDK10.8.1 com instrumentação automática desabilitada. Somente traços customizados de tela e operações da API, com nomes fixos, duração e status HTTP; não registra URLs, payloads ou consultas Firestore. Carga assíncrona após o primeiro carregamento. Na próxima injeção de configuração, Performance fica habilitado por padrão; pode ser desabilitado pela variável `PERFORMANCE_MONITORING_ENABLED=false`.
- Sentry: transporte de eventos pelo endpoint oficial de envelopes, sem SDK com gravação de sessão/analytics. Núcleo compartilhado reconstrói o evento por lista permitida: classe do erro, tela, operação, status e arquivos/linhas do código conhecidos. Não serializa mensagem original, request, usuário, breadcrumbs, documentos ou valores. URL Sentry validada; limite de10 eventos por instância da página/dia e100 por processo de backend/dia, deduplicação e pausa após sinalização de quota. Esses limites locais reiniciam ao recriar o contexto/processo; a conta Developer gratuita deve permanecer sem plano pago ou excedentes.
- App Check: cliente preparado para reCAPTCHA v3 somente quando `APP_CHECK_FREE_PROVIDER_CONFIRMED=true`; usa token já em cache nas chamadas ao próprio backend, sem esperar atestação para salvar. Verificador backend com modo padrão `off`; `observe` não bloqueia chamadas e não substitui autenticação. Pagamentos/webhooks do provedor não passam pelo guard. Não ativar `enforce` nesta entrega: é necessário primeiro garantir token desde o início das jornadas, registrar todos os apps e conferir as métricas, evitando bloquear clientes legítimos.
- Privacidade: preferência por dispositivo em Configurações → Dados → Privacidade e LGPD. Desativar diagnósticos opcionais não desativa App Check. Política1.9 e referência de aceite de novos cadastros atualizadas, sem reescrever aceites antigos.
- E-mails, Open Finance, Cloud Tasks, Document AI, pagamentos e dados reais não foram alterados.

## Validação

212 testes de release aprovados. Cobertura de remoção de conteúdo sensível, formato de envelope, domínios permitidos, quotas/rede, configuração segura, proteção de origem dos tokens, ambiente local sem telemetria, observação sem bloqueio, allowlist de aplicativos, timeout do verificador e opt-out preservando segurança. Sintaxe JS conferida. Pacote com121 arquivos públicos/23 arquivos de backend verificado e scanner de segredos aprovado. Testes de envio usaram transportes simulados, sem enviar eventos a fornecedores ou fazer operações em contas reais. Não afirmar que já existem eventos nos painéis dos provedores.

## Conta e ativação pendentes

Cadastro gratuito do Sentry preparado em `https://sentry.io/signup/?utm_source=agent`: Bud Soluções, conta corporativa solicitada pelo titular, região US. Campo de senha vazio; termos não aceitos; formulário não enviado. O titular deve revisar a região e completar o cadastro/termos pessoalmente, podendo usar Google. Não solicitar senha pelo chat nem cadastrar cartão. O site informa trial14dias seguido automaticamente do plano gratuito; confirmar Developer gratuito e ausência de cobrança/excedentes no painel.

Após retorno do titular:

1. Criar projeto JavaScript do Finance no Sentry, confirmar plano gratuito, mascaramento de IP/dados no painel e alertas para a conta corporativa. Não conectar repositórios nem conceder acessos amplos sem necessidade.
2. Obter o DSN de ingestão (chave pública, não token administrativo). Configurar `SENTRY_DSN` e `SENTRY_FREE_PLAN_CONFIRMED=true` no backend Render e nas variáveis públicas de build do GitHub. O DSN não é credencial de gerenciamento; nunca colocar tokens administrativos no frontend.
3. Conferir App Check/reCAPTCHA no Firebase. Não habilitar um provedor com cobrança automática excedente, não vincular faturamento nem contratar serviços pagos. Sem garantia verificável de gratuidade, manter App Check desligado e explicar essa pendência. Usar chave específica e registrar o app com TTL conservador, mantendo enforcement desligado. Configurar `APP_CHECK_SITE_KEY` e `APP_CHECK_FREE_PROVIDER_CONFIRMED=true` somente após essa conferência; no Render, `BUD_APP_CHECK_MODE=observe` e `BUD_APP_CHECK_APP_IDS` com o app ID esperado.
4. Antes da publicação, conferir valores públicos e realizar QA local de login/configurações sem tráfego de diagnóstico em localhost. Publicar somente após autorização aplicável, aguardando CI e revisão do backend. Não ativar contas fictícias em produção.
5. Conferir um evento técnico sintético sem PII no Sentry e um traço customizado no Firebase, registrando o resultado real. Documentar separadamente preparação de código, publicação, recebimento de eventos e enforcement. Ausência de DSN/chave não impede usar o aplicativo.

## Referências oficiais

- [Preço Firebase e Performance gratuito](https://firebase.google.com/pricing)
- [Performance: configuração de coleta](https://firebase.google.com/docs/reference/js/performance.performancesettings)
- [Sentry: formato de envelopes](https://develop.sentry.dev/sdk/foundations/envelopes/)
- [Sentry: plano Developer](https://sentry.io/pricing/)
- [App Check no web](https://firebase.google.com/docs/app-check/web/recaptcha-provider)
- [Verificação no backend](https://firebase.google.com/docs/app-check/custom-resource-backend)
