

## Correção de valores e parcelas das metas — 02/11/2026
Implementado na branch codex/correcao-valores-metas-20261102, clone .tools/goal-input-fix. Campos monetários selecionam o conteúdo ao receber foco e formatam ao sair; digitar substitui o valor inicial. Confirmação informa Registrando imediatamente, consulta somente os cartões usados e relê transações em paralelo preservando commit atômico/idempotência; não prometer latência zero do Firebase. Cartões mostra comprometimento global coerente com a barra e lista parcelas futuras de metas com valor/data/descrição. Caso relatado: compra em02/11, fechamento1/vencimento10,500 em8x resulta62,50 de dezembro2026 a julho2027; novembro zero é coerente com o ciclo, não ausência de lançamentos. Teste sintético específico aprovado; suíte130/130 aprovada. Não houve leitura autenticada de registros nem alteração dos dados do titular. Publicação em preparação; QA online pendente. Claude/Codex devem preservar registros e limites de evidência.

