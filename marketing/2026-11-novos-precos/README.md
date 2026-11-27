# E-mail de novos preços — novembro/2026

## Escopo e decisão do titular

Preparar identidade visual e enviar somente um teste ao titular. Disparo aos clientes do Gratuito depende de aprovação posterior. Nenhuma publicação ou alteração no serviço transacional EmailJS está prevista.

O pedido inicial mencionou Black Friday, mas a decisão final foi **divulgar somente a redução permanente, sem prazo promocional**. Os preços já estão vigentes para todos; não anunciar encerramento em30/11 às22h, desconto percentual, preço anterior riscado ou exclusividade para novas assinaturas.

- Assunto: **Os preços baixaram. Sua organização pode ir além.**
- Preheader: Starter R$4,99 · Plus R$14,99 · Pro R$29,99 por mês. Conheça os novos valores do Bud Finance.
- CTAs atuais por card: Starter → https://budsolucoes.com.br/appbudfinance/assinar.html?checkout=starter; Plus → https://budsolucoes.com.br/appbudfinance/assinar.html?checkout=pro; Pro → https://budsolucoes.com.br/appbudfinance/assinar.html?checkout=plus
- HTML: `email.html`, tabelas de apresentação e CSS inline, sem JavaScript, formulários, pixels de rastreamento ou fontes externas. Alternativa textual equivalente em `email.txt`.
- Referência de conteúdo: `PLANOS_ATUAIS.md`, `backend/plan-policy.js` e abertura da aba Dados em `appbudfinance/js/configuracoes.js`.
- Identidade: selo público existente, Buddy opaco em assets/buddy-email-v2.png e cartões individuais azul/verde/branco. No envio, substituir a imagem relativa por CID e incorporar o PNG como parte MIME inline (multipart/related); nunca enviar src relativo nem base64 dentro do HTML.

## Antes de um eventual disparo coletivo

Revisar a prévia recebida, aprovar a campanha e definir remetente oficial. O teste visual via Gmail conectado não altera o EmailJS e não comprova a entrega pelo remetente oficial. Não confundir aceitação pelo Gmail com confirmação de leitura pelo titular.

Segmentar pelo plano efetivo, preservando clientes em trial ou gratuidade administrativa; aplicar consentimentos e exclusões de marketing existentes. O rodapé permite solicitar remoção por resposta, mas este arquivo não implementa supressão automática: registrar e respeitar remoções antes de qualquer novo disparo. Não criar lista nominal nem copiar contatos de clientes para Git/Markdown.

Nenhuma regra financeira, plano, cobrança, prazo de assinatura ou configuração de produção é alterada por este material.

## Histórico da primeira versão e envio

Concluída em26/11/2026: conferência visual desktop1265px e mobile375px, sem rolagem horizontal e com as duas imagens carregadas. Imagens, Configurações→Dados e política responderamHTTP200. CSS responsivo foi conferido no navegador Chromium; não equivale a homologação em todos os clientes de e-mail. Buddy usaWebP, portanto conferir especialmente clientes que não suportem esse formato antes de ampliar a campanha.

Um único teste foi enviado pelo Gmail pessoal conectado ao endereço corporativo explicitamente escolhido pelo titular. Assunto com prefixo `[TESTE]` e faixa visível identificam a prévia. MIME multipart/alternative com HTML e textoUTF-8; metadados retornados e releitura confirmaram destinatário, assunto e marcadorSENT. A entrega/leitura na caixa corporativa depende da avaliação do titular; não foi afirmada. Metadados privados do envio ficam fora do Git.

Pendente: avaliação visual do teste pelo titular; ajustes se pedidos; aprovação específica e preparação do remetente/supressões/segmento antes de qualquer campanha coletiva. **Zero envios a clientes, zero mudanças no app e nenhuma publicação.**


## Revisão V2 — 27/11/2026 (estado vigente)

O PDF fornecido pelo titular confirmou retângulo preto e serrilhado no Buddy da primeira versão. Substituído WebP com alpha por PNG RGB opaco1083×1452, exibido a180px desktop/130px mobile sobre branco. Imagem preparada com a ferramenta image_gen, sem substituir mascotes do app; prompt e origem em assets/PROMPT.md. Nenhum prazo promocional ou preço foi alterado.

Cada card inteiro agora é um único link de contratação, com nome/preço/benefícios e rótulo Assinar. Não há CTA genérico para procurar novamente em Configurações. Identificadores permanentes preservados: pro interno=Plus; plus interno=Pro. Os links apontam para o login existente com checkout selecionado. Sessão ativa naquele navegador segue ao checkout autenticado; sem sessão, login preserva o parâmetro do plano. Sessões não são compartilhadas automaticamente entre PWA, navegadores ou aparelhos. Nenhum UID, token ou senha em URLs.

64 testes existentes de checkout/upgrade/navegação/nomes aprovados com prestadores fictícios. Fonte pública index.js e checkout-client.js conferida porGET/HTTP200: fluxo já publicado aceita checkout e usa getIdToken. Não foi criada contratação real para homologar; não declarar pagamento real ponta a ponta. Não houve mudança em código do app/backend ou publicação.

Conferência visual Chromium desktop1265px/mobile375px: imagem carregada e sem overflow; três cards são âncoras block com destinos corretos. PNG colorType2, sem alpha, sem WebP no HTML. Nova prévia local http://127.0.0.1:13248/email.html. Não confundir esta prévia com renderização de todos os clientes de e-mail.

Teste V2 enviado somente ao endereço corporativo confirmado do titular via Gmail conectado. Assunto [TESTE V2] Bud Finance — Buddy corrigido e contratação pelo card. Releitura confirmou SENT, destinatário e MIME multipart/related → multipart/alternative (texto/HTML) + image/png inline com Content-ID correspondente; HTML sem src relativo no envio. Não houve publicação para hospedar a imagem. A aparência/entrega no Gmail de destino ainda depende da avaliação do titular. Nenhum disparo coletivo.

Próximo passo: titular avaliar o V2 e os links; ajustes se pedidos; campanha somente após autorização específica e preparação de segmento/supressões/remetente conforme acima. O teste anterior permanece no histórico, mas seu HTML/CTA/Buddy não são mais a versão recomendada.


## V3 preparada — 27/11/2026 (aguarda publicação)
Bloco adicional de checkout retirado; mantida só a frase mensal/gratuito. Contato WhatsApp; descadastro individual {{unsubscribe_url}} gerado por marketing-preferences.prepare/render. Não enviar template diretamente: deve consultar supressão, incorporar CID e abrir confirmação POST, sem login/mailto. Página/backend ainda não publicados; nenhum teste de e-mail V3 com rota indisponível. Demonstração local até autorizar implantação. Ver RELEASE_EMAIL_CHECKOUT_PREFERENCIAS_2026-11-27.md:224 testes, pacote e limites. Remoção por resposta da V1 é histórica e não deve ser reutilizada.


## Entrada direta mínima preparada — 27/11/2026
Cards agora apontam a /appbudfinance/assinar.html?checkout=starter/pro/plus, preservando nomes/direitos e os preços. Links antigos ganham encaminhamento antes do app-shell após implantação. Sem sessão, plano/referral seguem ao login; com sessão válida, não carrega formulário/Firestore cliente. Backend preserva todas as guardas e verifica e-mail/cadastro. Sem publicação e sem envio dos novos links enquanto a rota pública não existir. Ler RELEASE_CHECKOUT_DIRETO_2026-11-27.md:235 testes aprovados, demonstração local e limites de latência.
