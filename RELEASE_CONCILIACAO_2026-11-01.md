## Revisão segura de estornos e conferência — 01/11/2026

Regra aprovada pelo titular: compra e devolução ficam desmarcadas juntas apenas com vínculo seguro; recompra permanece ativa. Identidade por mesmo valor/estabelecimento/data não basta. Implementação usa identificador bancário OFX compartilhado, exatamente duas linhas de sinais opostos e saldo zero; grupos ambíguos e estornos parciais permanecem separados. Sem identificador, o PDF mantém compras e abatimentos assinados e exige revisão; não declarar que os estornos desse PDF foram todos pareados. Seleção de um par identificado é conjunta; alteração que quebre saldo zero é bloqueada antes de salvar. Ação em massa Compras e abatimentos preserva devoluções sem par. Edição preserva sinal negativo.

Barra de conferência restaurada como progressbar visível e atualizada a cada seleção/valor: compara a soma selecionada ao total declarado, informa divergência exata, inclusive um centavo, e não afirma precisão universal nem 100% para OFX. Sem referência, informa impossibilidade de conciliação automática. Valores originais preservados, sem ajustes sintéticos. Guardas de duplicação e total permanecem.

Histórico verificado: e50356c (espera infinita) alterou apenas 2 linhas de cartoes.js relacionadas à espera; a classificação anterior já continha exclusão de negativos, FITID e inferência por valor. Portanto, a regra segura atual não era integralmente garantida antes. Alterações posteriores do parser/seleção alteraram o comportamento, documentadas nos PR10/11/13/14.

Validação: 97 regressões passaram; após ampliar o teste de persistência do par+recompra, 10 testes específicos passaram. Teste VM executa processamento, gravação e recálculo reais com Firestore emulado: somente a recompra é salva; valores repetidos sem identificador não são associados. Teste da barra cobre seleção que aumenta o total e divergência de um centavo. Deploy e inspeção pública pendentes neste registro.

Conta do titular: Plus concedido por autorização expressa e precondição Firestore; expiração de trial removida, nenhuma cobrança criada. Validação anterior online do PR14 abriu 51 linhas selecionadas e zero controles bloqueados, sem gravar lançamentos. Esta concessão substituiu a proposta de devolver quatro usos. Groq permanece com capacidade finita para imagens/layouts sem parser; Developer é aquisição futura. Não anunciar disponibilidade universal ilimitada.

Continuidade Claude/Codex: workspace original tem alterações preexistentes; preservá-las. Trabalho isolado em .tools/invoice-reconciliation-ui, branch codex/revisao-estornos-conciliacao-20261101. Próximo passo: conferir CI/publicação e a barra no app online. Nenhum dado financeiro privado incluído no Git; nenhum registro do usuário recriado ou salvo nesta entrega.

