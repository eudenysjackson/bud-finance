# Estornos, total selecionado e persistência — 01/11/2026

A importação anterior foi validada só até a revisão e alterou indevidamente a regra de estornos no caminho PDF. Desmarcar os créditos e manter as compras elevava a fatura salva. Essa entrega corrige a passagem completa revisão → persistência → recálculo (DEC-034).

- Parser continua preservando linhas originais; classificação de pares exige descrição normalizada, data e valor exatos e candidato único. Pares compra/estorno ficam desmarcados/inativos. Valor isolado ou ambiguidade não identifica compra.
- Crédito sem compra identificável na mesma fatura é mostrado como Crédito na fatura e abate o saldo como valor negativo; não é confundido com o par cancelado.
- Total selecionado mostra o valor realmente persistível; total declarado é separado. Salvar bloqueia seleção divergente em mais de um centavo e repetição de importação no mesmo cartão/competência. Não fabrica ajuste de arredondamento.
- A correção da importação real existente foi transacional, com precondições de updateTime e cópia privada anterior: correspondência de todas as 41 compras ao PDF; nove compras marcadas estornadas, um crédito original omitido incluído; 33 registros ativos no readback. Nenhum documento apagado, nenhuma cobrança efetuada. A soma real das linhas permanece um centavo abaixo do total declarado, de forma explícita.
- 95 regressões aprovadas; testes exercitam salvar com Firestore simulado e recálculo da fatura após leitura dos documentos persistidos, exclusão dos pares, preservação de crédito órfão, ambiguidade, bloqueio de seleção errada e duplicação. O fixture de teste foi ajustado para reabrir o cartão após salvar, como a UI real.
- Publicação e teste visual final em preparação. Não declarar 100% de precisão para qualquer arquivo ou disponibilidade ilimitada Groq. A validação deste PDF não chama Groq.
