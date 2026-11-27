# Entrada de contratação mínima — 27/11/2026

Candidata não publicada na branch codex/checkout-direto-leve-20261127, baseada em4409249. Inclui as preparações anteriores de e-mail/descadastro, sem autorizar campanha, cobrança, preferência real ou implantação.

## Evidência do vídeo

Gravação11,57s analisada localmente: amostra3s página em branco,6s formulário de login público e9s carregamento do Mercado Pago. O endereço exibido era a rota pública antiga /appbudfinance/?checkout=pro. Esses instantes não são uma medição separada da API e não provam que toda a espera seja do Render. E-mails/IDs de checkout visíveis não foram copiados ao Git. Vídeo original preservado; frames/leitor de vídeo em .tools ignorada.

## Mudança

assinar.html/js substitui a tela inteira de login por entrada mínima: Firebase App/Auth e checkout-client compartilhado. Não importa Firestore, bud-utils, temas, fontes, seletor de categorias, flags ou mascote. Usa sessão persistente no mesmo navegador e o token em memória, enviado no Authorization. Sem UID/credencial/link de pagamento pré-gerado no e-mail.

Sem sessão ou e-mail não verificado, volta ao login com plano/referral e marcador entrar=1. O marcador evita redirecionamento circular; não concede acesso. Login existente mantém modal de verificação. Emulador conserva simulador antigo, sem MP.

Links antigos recebem encaminhamento no começo do head, antes do app-shell, apenas nos hosts oficiais e sem entrar=1, magic_verification ou email_destino. Mantém plano/referral e preserva verificação de e-mail. Novos cards apontam diretamente a assinar.html?checkout=starter/pro/plus (Plus comercial usa pro interno; Pro comercial usa plus interno).

Backend agora verifica email_verified, bloqueio e compatibilidade de e-mail do cadastro, pois entrada leve não faz leitura de perfil no cliente. Guarda de sessão/deleção/revogação/rate limit, reserva transacional, preços do servidor e idempotência mantidos. checkout-client preserva status/code para orientar nova autenticação, retry explícito ou gerenciamento de assinatura existente. Eventos repetidos de Auth não disparam outro pedido.

## Validação

235 testes de release aprovados. Cobrem três planos, sessão presente/ausente/não verificada, referral, eventos Auth concorrentes/repetidos, erro/retry, sessão encerrada, contrato já existente, emulador, plano inválido, compatibilidade de links antigos/verificação e bloqueios no backend.

Pacote isolado .tools/direct-checkout-artifact:126 arquivos públicos/24 backend, hashes/manifesto/scanner aprovados; artefatos anteriores preservados. Sintaxe e git diff --check aprovados. Não houve teste com escrita de conta real ou criação de preapproval real.

Browser local executou o módulo real da entrada com SDK de Auth e resposta de checkout fictícios. Chegou ao checkout simulado Plus, sem passar pelo formulário. Os links da prévia local apontam à entrada nova. Isso comprova encadeamento/interface, não latência real de Firebase/Render/Mercado Pago. Não foi validado em celular físico.

Prévia http://127.0.0.1:13250/email.html; script .tools/direct-checkout-preview.local.cjs ignorado, servidor loopback. O adaptador local só aceita token fictício e nunca navega ao Mercado Pago; substitui a navegação por checkout-simulado. Preferências de e-mail continuam fictícias nessa demonstração. Nenhum envio V4, campanha ou deploy.

## Publicação e limites

Publicar frontend/backend coordenados somente após autorização específica, incluindo descadastro anterior. Não enviar os cards novos antes de existir a rota pública. Testar depois o destinatário individual já autorizado e sua preferência, sem disparo coletivo.

O vídeo/e-mail anterior continua usando código público antigo até a publicação; reenviar HTML sozinho não ativa a otimização. Ainda será necessário obter a resposta autenticada e criar/reutilizar o checkout no Mercado Pago. Inicialização do servidor, rede e carregamento do provedor podem demorar; não prometer instantaneidade ou atribuir um tempo novo sem medição real.

## Publicação confirmada — 27/11/2026

Autorização específica do titular recebida antes da integração. PR74: https://github.com/eudenysjackson/bud-finance/pull/74. Revisão integrada e publicada:4f933bcd37d6548cf24fa2fd6fe81621bc88487f.235 regressões locais aprovadas novamente; CI46078511688 aprovado, incluindo pacote e scanner. Pages46078765435 concluído com sucesso após gate do backend: https://github.com/eudenysjackson/bud-finance/actions/runs/46078765435.

Render bud-finance-backend mostrou4f933bc como Live/Deployed, deploy dep-dc50h2ojo6nc73c9vda0. GET /api/ping confirmou a revisão completa. Serviço existente Starter preservado, sem mudança de plano/env/regras/índices. Não atribuir esta espera a um plano gratuito do Render.

GETs públicos200 e conteúdo igual ao candidato após normalizar CRLF/LF: assinar.html, js/assinar.js, js/checkout-entry.js, js/checkout-client.js, preferencias-email.html, js/email-preferences.js e index.html. Browser público confirmou rejeição de plano inválido sem contratar e página de preferências sem token pedindo link completo, sem gravar preferência.

A otimização está publicada e inclui encaminhamento dos cards antigos. Velocidade real no celular ainda depende da avaliação do titular e dos tempos de Auth/rede/Mercado Pago; esta conferência não criou contratos para medir tempo. Sem pagamento, cancelamento, preferência real alterada ou campanha coletiva. Não foi enviado novo e-mail V4: a V3 recebida anteriormente continua com descadastro apenas demonstrativo/local; não reutilizá-la como campanha nem afirmar que seu link de descadastro antigo virou produção. Um próximo teste completo do e-mail deve ser preparado por marketing-preferences.prepare/render com supressão consultada e link individual de produção, preservando CID.