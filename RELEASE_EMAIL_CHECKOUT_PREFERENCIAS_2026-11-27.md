# Checkout e preferências de e-mail — 27/11/2026

## Preparado, sem publicação

Branch codex/email-preferencias-checkout-20261127 baseada em163d0b3. Não houve deploy, contratação real, alteração em preferências de cliente, e-mail V3 ou campanha coletiva.

## Contratação

checkout-entry.js reconhece o plano antes de pintar o formulário. Mostra Abrindo pagamento e só revela login quando o Firebase informa ausência de sessão. Preconnect e GET /api/ping sobrepõem abertura de conexão/inicialização do backend aos downloads e restauração de sessão. Ping nunca cria contratos; login comum e emuladores não aquecem produção. bud-utils dispensa flags/perfil redundantes somente nesta entrada.

Security-guard consulta exclusão/revogação em paralelo. Criar assinatura reutiliza req.budUser verificado pelo middleware, com fallback para handlers isolados. Login Google mantém verificação de perfil; reserva transacional, rate limiting e idempotência preservados. Sandbox-activate permanece original. Não colocar token/UID no card nem pré-gerar contratos para ocultar latência.

Não foi medida latência em produção. Render frio, Firebase e Mercado Pago ainda podem demorar; não prometer instantaneidade. Nenhum serviço/plano pago novo.

## E-mail

Texto adicional retirado; aviso contém somente: A assinatura tem renovação mensal. Você pode continuar usando o plano Gratuito se preferir.

Fale com a Bud aponta ao WhatsApp oficial. Buddy opaco/CID, preços e cards preservados. HTML/texto são templates: {{unsubscribe_url}} deve ser preenchido individualmente por marketing-preferences.prepare/render. Não enviar placeholder, link compartilhado ou imagem relativa sem CID.

## Descadastro

marketing-preferences.js fornece prepare/render/unsubscribe e POST /api/marketing/unsubscribe. preferencias-email.html/js recebe token HMAC em fragmento, confirma POST e só mostra sucesso após persistência. GET não altera estado, para evitar descadastro por leitores automáticos. Página não inicializa SDK, analytics ou diagnostics; referrer desativado. Token inválido não escreve; falha permite retry, sem falsa confirmação.

Coleção raiz _marketing_suppressions guarda documento SHA-256 do e-mail normalizado, unsubscribed/updatedAt, sem endereço em texto claro, UID ou dado financeiro. Regras atuais negam acesso direto à raiz não listada; apenas backend Admin SDK persiste, sem novas regras/índices. Supressão permanece após exclusão/recriação e rotação da chave; links antigos precisam ser reemitidos após rotação. O registro mínimo respeita a preferência; não é dado financeiro.

Sender EmailJS verifica preferência para email_category=marketing; mensagens transacionais mantidas. Falha de banco bloqueia marketing. prepare/render não retornam campanha para destinatário suprimido. Não cancela conta/plano/push nem remove mensagens em trânsito. Conector Gmail avulso NÃO recebe supressão automática: campanhas futuras devem usar prepare/render e conferir preferência antes de cada envio. Isso não substitui verificar consentimentos e elegibilidade do segmento.

Secret: MARKETING_PREFERENCES_SECRET opcional, fallback no EMAIL_VERIFICATION_SECRET existente, com separação de domínio HMAC. Não copiar segredo ao cliente/Git; nenhuma credencial foi lida/alterada.

## Validação

224 testes de release aprovados,10 novos casos: entrada imediata/GET único/sem aquecimento em emulador, consultas paralelas preservando bloqueios, assinatura/adulteração, persistência entre instâncias/rotação, falha de banco, supressão de render/EmailJS, confirmação/retry. Persistência automatizada em adaptador em memória, sem Firestore real.

Pacote isolado .tools/email-v3-artifact:124públicos/24backend, hashes/manifesto e scanner aprovados. dist/site anterior preservado. Scanner do helper temporário falhou inicialmente por require relativo; execução posterior por caminho absoluto aprovada.

Browser desktop local confirmou: rodapé simplificado/WhatsApp; confirmação de descadastro fictício; nova preparação para a mesma amostra bloqueada. Ledger fictício em .tools/marketing-demo.local.json ignorado. Entrada mostrou Abrindo pagamento Plus sem formulário e depois destino explicitamente simulado. Não houve Firebase/MP reais nessa demo. Testar UI não mede latência real.

Viewport mobile solicitado não foi aplicado: largura medida1265px. Não declarar QA mobile da V3; conferir em aparelho físico. V2 possuía QA375px, mas a página de preferências é nova.

## Próximo passo

Publicar frontend/backend juntos somente com autorização específica. Conferir revisão e página; preparar teste individual com token pessoal e CID pelo caminho que consulta supressões. Não enviar V3 com rota404/placeholder. Confirmação real de descadastro grava preferência e deve limitar-se ao destinatário de teste autorizado. Campanha coletiva continua sem autorização; verificar plano efetivo, consentimentos e supressões.

Prévia http://127.0.0.1:13249/email.html: destinatário fictício, ledger local e checkout simulado. Script .tools/email-v3-preview.local.cjs ignorado. Amostra de QA descadastrada é diferente da amostra padrão oferecida ao titular. Ler AI_HANDOFF.md na mesma branch para retomar em outra máquina.

## Atualização posterior — envio de prévia V3
Em27/11 o titular solicitou explicitamente uma prévia no endereço pessoal escolhido. Enviada via Gmail com PNG/CID e faixa informando ausência de publicação, velocidade pública anterior e descadastro apenas demonstrativo/local. SENT/INBOX confirmados; nenhuma leitura humana afirmada. Não houve deploy ou alteração de preferência real. Esta anotação substitui somente o status anterior de sem e-mail V3; limitações de produção e autorização coletiva permanecem.
