# E-mail de novos preços — novembro/2026

## Escopo e decisão do titular

Preparar identidade visual e enviar somente um teste ao titular. Disparo aos clientes do Gratuito depende de aprovação posterior. Nenhuma publicação ou alteração no serviço transacional EmailJS está prevista.

O pedido inicial mencionou Black Friday, mas a decisão final foi **divulgar somente a redução permanente, sem prazo promocional**. Os preços já estão vigentes para todos; não anunciar encerramento em30/11 às22h, desconto percentual, preço anterior riscado ou exclusividade para novas assinaturas.

- Assunto: **Os preços baixaram. Sua organização pode ir além.**
- Preheader: Starter R$4,99 · Plus R$14,99 · Pro R$29,99 por mês. Conheça os novos valores do Bud Finance.
- CTA: https://budsolucoes.com.br/appbudfinance/configuracoes?aba=dados
- HTML: `email.html`, tabelas de apresentação e CSS inline, sem JavaScript, formulários, pixels de rastreamento ou fontes externas. Alternativa textual equivalente em `email.txt`.
- Referência de conteúdo: `PLANOS_ATUAIS.md`, `backend/plan-policy.js` e abertura da aba Dados em `appbudfinance/js/configuracoes.js`.
- Identidade: selo e Buddy públicos já existentes, azul/verde/branco, cartões individuais por plano.

## Antes de um eventual disparo coletivo

Revisar a prévia recebida, aprovar a campanha e definir remetente oficial. O teste visual via Gmail conectado não altera o EmailJS e não comprova a entrega pelo remetente oficial. Não confundir aceitação pelo Gmail com confirmação de leitura pelo titular.

Segmentar pelo plano efetivo, preservando clientes em trial ou gratuidade administrativa; aplicar consentimentos e exclusões de marketing existentes. O rodapé permite solicitar remoção por resposta, mas este arquivo não implementa supressão automática: registrar e respeitar remoções antes de qualquer novo disparo. Não criar lista nominal nem copiar contatos de clientes para Git/Markdown.

Nenhuma regra financeira, plano, cobrança, prazo de assinatura ou configuração de produção é alterada por este material.

## Validação e envio

Concluída em26/11/2026: conferência visual desktop1265px e mobile375px, sem rolagem horizontal e com as duas imagens carregadas. Imagens, Configurações→Dados e política responderamHTTP200. CSS responsivo foi conferido no navegador Chromium; não equivale a homologação em todos os clientes de e-mail. Buddy usaWebP, portanto conferir especialmente clientes que não suportem esse formato antes de ampliar a campanha.

Um único teste foi enviado pelo Gmail pessoal conectado ao endereço corporativo explicitamente escolhido pelo titular. Assunto com prefixo `[TESTE]` e faixa visível identificam a prévia. MIME multipart/alternative com HTML e textoUTF-8; metadados retornados e releitura confirmaram destinatário, assunto e marcadorSENT. A entrega/leitura na caixa corporativa depende da avaliação do titular; não foi afirmada. Metadados privados do envio ficam fora do Git.

Pendente: avaliação visual do teste pelo titular; ajustes se pedidos; aprovação específica e preparação do remetente/supressões/segmento antes de qualquer campanha coletiva. **Zero envios a clientes, zero mudanças no app e nenhuma publicação.**
