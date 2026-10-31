# Validações da candidata — 31/10/2026

## Resultados confirmados

- Sete importações com documentos fictícios e Groq real passaram: fatura direta1537ms, PDF1530ms, cupom texto3043ms, cupom imagem9101ms, fatura imagem1529ms, extrato imagem22738ms e PDF escaneado27232ms. São medições locais, não garantia de latência online nem capacidade para vários usuários.
- Sete grupos de Auth/Firestore Emulator e HTTP passaram: recuperação de uso único, pagamentos/alteração agendada/cancelamento, regras, rollback financeiro, CORS/revogação, exclusão recursiva e bloqueio com assinatura. Campos de troca/pagador e registros internos de verificação protegidos contra escrita pelo navegador.
- Confirmação e recuperação pelo backend atualizado enviaram e-mails reais ao destinatário autorizado. Histórico EmailJS confirmou sucesso. Código confirmou somente o usuário emulado, rejeitou reutilização e a recuperação redefiniu apenas senha descartável local. Usuário de teste criado por essa execução foi limpo; nenhuma senha de produção foi alterada.
- Render: com autorização específica do titular, adicionados EMAILJS_PRIVATE_KEY (valor local já utilizado), EMAILJS_TEMPLATE_BOAS_VINDAS, EMAIL_VERIFICATION_SECRET exclusivo de produção, GROQ_MODEL e GROQ_MAX_OUTPUT_TOKENS. Save and deploy reaplicou o build existente; revisão antiga3abb835 continuou Live após reinício de11,7s. Não equivale a publicar o código da candidata.

## Troca de plano na mesma assinatura

Regra escolhida expressamente pelo usuário: manter a assinatura e aplicar o novo plano após a próxima cobrança aprovada. backend/subscription-change.js e POST /mercadopago/change-subscription usam preço do servidor, conferem titular/vínculo, serializam alterações por transação/lease no Firestore, persistem intenção antes do PUT e conferem valor/data por GET. Não criam checkout novo nem alteram a data de cobrança. O plano atual permanece até pagamento do novo ciclo, com data e valor correspondentes. Status isolado ou pagamento antigo não antecipam a troca. Desconto de indicação existente é preservado.

O teste real revelou que o recurso de assinatura do MP pode omitir payer_email e retornar payer_id. Ajustado para conferir vínculo UID/assinatura e identificador do pagador, validando o e-mail quando disponível. mpPayerId é gravado pelo servidor e protegido nas regras.

Na conta fictícia: criada e aprovada nova Starter deR$9,99; troca para Pro29,90 e Plus49,90 preservou o mesmo ID, próxima data e acesso Starter. Painel oficial mostrou Plus agendado para30/nov. A troca foi desfeita, restaurando9,99 na mesma assinatura. Ao final, cancelamento confirmado no provedor e perfil emulado voltou a free. Nenhuma assinatura fictícia desta execução ficou ativa. Renovação futura não foi antecipada.

No navegador local, conta descartável mostrou Starter mantido, aviso de troca Pro para a próxima cobrança e ação para desfazer; desfazer passou. Botão de teste de push próprio deixa de depender de role admin; endpoint já permitia o teste individual autenticado. Modal de cancelamento deixa de prometer prazo contraditório: comportamento existente continua cancelamento imediato.

Evidências: test-results/qa-troca-plano-agendada-20261031.png, qa-mp-plus-proxima-cobranca-20261031.png e qa-render-variaveis-aplicadas-20261031.png.

## Bloqueios externos observados

- Site público ainda usa a versão antiga: /budfinance/404; recuperação ainda pelo cliente; importações sem o novo acompanhamento; CORS publicado ainda sem DELETE/X-Bud-Async. Backend /api/ping200 e checkout sem token401.
- GitHub Daily Push Notifications está desativado manualmente. Última execução#67, de02/08/2026, não iniciou por bloqueio de cobrança da conta GitHub. Deploy — Bud Finance também aparece desativado. Não reativado nem disparado envio coletivo. Fonte: https://github.com/eudenysjackson/bud-finance/actions/runs/30746960746 e página do workflow.
- Webhook de teste na aplicação real ainda aponta para a raiz do site; entrega externa do webhook não foi homologada. Eventos locais assinados continuam distintos de entrega pública do MP.
- Conferência final do código atualizado online, entrega real de push e execução do Actions ainda precisam ser concluídas. Não liberar o lançamento oficial enquanto os bloqueios aplicáveis permanecerem.

## Persistência e regressões finais

backend/ai-job-store.js persiste entradas/resultados em fragmentos de450KB no Firestore. Claims transacionais com lease/heartbeat impedem execução simultânea normal; após queda, o acompanhamento autenticado retoma quando o lease vence. A chamada externa pode se repetir se houver queda após resposta do provedor, mas a contabilização da cota é transacional e idempotente por trabalho. Nenhum bearer token é persistido. Resultados expiram após30min; trabalhos ativos após2h. Limpeza de documentos e fragmentos roda na aplicação a cada minuto, não depende de TTL contratado. Instâncias paradas não executam limpeza: a próxima inicialização remove expirados. Arquivos são temporariamente armazenados no Firebase do projeto, protegidos por regras, e removidos na conclusão. Não há recuperação automática após recarregar a página se o cliente perder o identificador do trabalho.

Quatro grupos do teste real no emulador passaram: arquivo/resultado maiores que1MiB; retomada por outra instância com cota única e rejeição de worker antigo; limite de duas leituras entre instâncias e limpeza; bloqueio de acesso direto pelo cliente autenticado. Uma falha inicial era do teste: callback transacional compilado em outro contexto JavaScript produzia Promise incompatível com a verificação do SDK. Ajustado o teste para o contexto nativo do servidor.

Nova execução HTTP com persistência passou nas oito importações: direta1614ms, PDF1636ms, texto1626ms, cupom imagem7815ms, fatura imagem7879ms, extrato18414ms, escaneado26068ms e fatura longa79633ms. Documento longo aguardou o orçamento do provedor; não afirmar garantia universal de menos de um minuto. O classificador opcional do Buddy retornou429 nessa sequência; Buddy continua fora da primeira versão. O smoke padrão cobre as oito importações do lançamento; classificações/chat exigem seleção explícita.

Regressões finais:51 casos passaram, incluindo push, concorrência de checkout, reutilização de link, bloqueio de resultado incerto e cancelamento pendente. Sete grupos HTTP/emulador e quatro de recuperação persistida passaram novamente após os últimos ajustes.

## Notificações e GitHub autenticado

Um envio FCM real foi aceito para exatamente uma conta autorizada, localizada por matrícula; o usuário confirmou que não recebeu. Transporte aceito não comprova entrega. Não foi disparado cron coletivo. Corrigidos na candidata: estado ativo só após registro confirmado; erro de registro deixa de ser silencioso; registro preserva subscription válida em vez de unsubscribe em toda abertura; listener anterior é removido para evitar alertas repetidos; timeout é limpo; teste individual disponível sem role admin. Revalidar em navegador/dispositivo compatível após publicação.

Conta GitHub eudenysjackson autenticada: Billing Overview de31/10 mostra Free, consumo Actions coberto por descontos e próxima cobrança sem valor informado. Não foi exibido alerta de bloqueio nessa tela; isso não prova execução liberada. Última falha de02/08 continua histórica. Workflows continuam desativados; nenhuma reativação ou publicação realizada.

Fechada a proteção adicional de checkout: reserva transacional no perfil antes da chamada externa; link/ID pendente persistidos e reutilizados para o mesmo plano; outro plano é bloqueado até cancelamento. Resultado incerto mantém bloqueio para conciliação, sem recriação por expiração de timeout. Três regressões adicionais passaram. Novo checkout real exclusivamente fictício confirmou mesmo link na repetição e rejeitou Pro enquanto Starter estava pendente; cancelamento no provedor foi confirmado, perfil free, sem pagamento. UI de Configurações permite continuar ou cancelar a contratação pendente, mesmo no plano free. mpCheckout é protegido contra escrita do cliente; regra403 confirmada no emulador.

## 31/10/2026 — revisão de notificações solicitada pelo titular
Publicação autorizada expressamente após esta correção. Causa dos avisos antigos:cache local bud_notif_v2 sem validade e leitura recorrente de notificacoes-globais no dashboard. O cliente novo apaga apenas esse cache e não carrega comunicados nem mantém histórico de push no sininho. Sininho/faixa mostram somente estado atual da assinatura: azul nos3dias anteriores à cobrança, vermelho vencida/past_due, upgrade no free; assinatura válida distante do vencimento não mostra faixa. Trial distante do fim também não mostra aviso.

Push financeiro passou a regras determinísticas em backend/financial-notifications.js: receitas previstas, contas recorrentes, faturas não pagas e próxima parcela de dívida. Confirmação do pagamento, financiamento da fatura, quitação e estornos são respeitados. Mais de3pendências geram resumo diário. Nada é marcado pago/recebido automaticamente. Removidos insights Buddy, reengajamento e promoções automáticas do cron. Data/hora usa America/Sao_Paulo e TTL3600evita alertas antigos após dias offline. A entrega também ocorre como notificação do sistema com app em primeiro plano; SW evita duplicação de payload notification.

Cadastro mantém até20tokens/dispositivos por conta; desativação atual retira só o dispositivo escolhido. Migração preserva token legado. Teste individual escolhe token registrado da própria conta; outro destino é rejeitado. Tokens múltiplos são protegidos por regras e excluídos da exportação pública do perfil.

59regressões passaram. Cinco casos novos validaram assinatura/regras financeiras e três validaram múltiplos dispositivos, revogação, isolamento do teste e formato FCM. Navegador confirmou cache antigo removido, assinatura regular sem faixa/histórico, faixa azul e vermelha com dados fictícios. Evidências:qa-assinatura-azul-20261031.png e qa-assinatura-vermelha-20261031.png. Recebimento físico após publicação e execução real do agendamento continuam a conferir; sucesso emulado não comprova entrega.
