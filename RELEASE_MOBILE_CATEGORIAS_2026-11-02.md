# Mobile, rotas e categorias — 02/11/2026

Candidato codex/mobile-rotas-categorias-20261102.

Reduz espera inicial por imagens, biblioteca de gráficos e consulta administrativa sem uso. Mantém validação de sessão. Nome/email/data da sessão atual aparecem antes do perfil remoto; falhas de consulta têm estado explícito, sem inventar planoFree ou saldo.

URLs sem.html preservam consultas e hashes; links antigos funcionam e featureflags continuam protegendo rotas. Popup de categorias central, responsivo, ordenado pelo nome em português e com busca sem acentos. Rótulos identificam receitas, despesas e Pix recebido/enviado. Crédito/débito explícito prevalece sobre texto; automático restaura direção original. Não altera lançamentos antigos nem fórmulas de total.

153 testes aprovados; pacote95arquivos conferido. Navegador local375px conferiu ordem, busca, seleção, fechamento, Escape/foco; dados fictícios, sem salvar em produção. Nenhum pagamento, email, push ou regra de produção nesta entrega. Publicação e QA online em preparação.


## Conferência publicada de mobile e categorias — 02/11/2026
PR42 publicado em652e074a92adb3fb1cf83e12aacfb7cbfd57418f. CI41549174764 e Pages41549239091 aprovados.153 regressões aprovadas. Navegador autenticado confirmou Cartões.html→/cartoes e Extrato.html→/extrato preservando inicio/fim; perfil/data/mês e lançamentos carregados. Popup real em Cartões e Extrato ficou central, com busca e ordem alfabética; escolhaMercado aplicada só ao formulário e formulário cancelado sem salvar. Extrato mostrou rótulos de saída/estorno e sinal visual correto; zero erros de console nesta conferência. /mercado continua redirecionando a /dashboard?recurso_indisponivel=compras, preservando recurso futuro desativado. Nenhum lançamento ou saldo real modificado.
Complemento da conferência: rótuloPix também deve considerar categoriaPix no Crédito em registros antigos que não mencionamPix na descrição. Ajustado e coberto por regressão; arquivo atualizado usa versão mobile2 para evitar cache antigo. Publicação do complemento em preparação na branch codex/qa-mobile-categorias-20261102. Não altera categoria, valor ou direção persistidos, apenas apresentação.
