# FAQ — Perguntas Frequentes · Bud Finance

> Dúvidas comuns de uso, organizadas por tema.  
> Última atualização: 29/04/2026

---

## 💳 Cartões de Crédito

### "Parcelei a fatura do meu cartão porque não consegui pagar o valor cheio. Como registro isso?"

Essa situação — transformar uma fatura em um parcelamento com juros — envolve dois passos no app:

**1. Marque a fatura original como paga**  
Na tela de **Cartões**, no mês onde os gastos estão, clique em **"Pagar Fatura"**.  
Você pode *não* vincular a uma conta de débito (clique em Confirmar sem selecionar conta). Isso quita visualmente a fatura e libera o visual do cartão.

**2. Registre o parcelamento como Dívida**  
Vá em **Dívidas → Nova Dívida** e preencha:
- **Tipo**: Cartão de Crédito
- **Formato**: Parcelas Fixas
- **Nome**: ex. "Parcelamento Fatura Nubank Março"
- **Valor total**: R$ 200,00
- **Número de parcelas**: 4
- **Primeira parcela**: data do vencimento do próximo pagamento

A partir daí, a cada mês você acessa a dívida e marca a parcela paga (R$ 50,00).

**Por que não usar Recorrentes?**  
Recorrentes cria lançamentos automáticos no extrato mas não rastreia saldo devedor.  
Dívidas é mais preciso: mostra quanto ainda falta, avisa vencimentos e calcula juros pagos.

**E o limite do cartão?**  
Com a fatura parcelada, o banco normalmente retém parte do limite até quitar. No app, o limite disponível reflete o que você configurou — ajuste manualmente o campo "Limite" do cartão se o banco bloqueou parte dele.

---

### "Ao importar fatura por IA/PDF, como funciona o parcelamento automático?"

Quando o app detecta descrições como "PARC 02/06" ou "3/12", aparece um toggle por item na tela de revisão:

> 📅 Criar 4 parcelas restantes (03/06 até 06/06)

Se você marcar o toggle, ao salvar o app cria automaticamente as parcelas futuras distribuídas nos meses corretos (fevereiro, março, abril...). A descrição é atualizada em cada transação (ex: "Amazon 03/06", "Amazon 04/06"...).

Se preferir registrar manualmente (ex: parcelas têm valores diferentes), deixe o toggle desmarcado.

---

### "O app mostra 'R$ 0,00 usado de R$ 1.000,00' mas eu tenho gastos no cartão"

Verifique se os gastos estão lançados no mês correto. Use a navegação `← Mês →` para ir ao mês onde os gastos foram registrados. A fatura só agrupa transações cujo campo `dataReferencia` cai dentro do ciclo de fechamento do cartão.

---

### "Como sei qual mês pertence um gasto do cartão?"

O mês da fatura é determinado pela **data de referência** do gasto:
- Se a data do gasto é **antes do dia de fechamento** → entra na fatura do mês atual
- Se a data é **após o fechamento** → entra na fatura do mês seguinte

Exemplo: Cartão fecha dia 10. Um gasto em 15/04 entra na fatura de **maio**.

---

## 📊 Extrato e Transações

### "Adicionei uma despesa mas ela não aparece no Dashboard"

O Dashboard mostra transações do **mês atual**. Se a `dataReferencia` da transação for de outro mês, ela não aparece. Navegue pelo mês no Dashboard ou confira no Extrato com filtro por data.

---

## 💸 Dívidas

### "Qual a diferença entre 'Com Juros' e 'Parcelas Fixas'?"

- **Parcelas Fixas (SAC/Price)**: você informa o valor total e o número de parcelas; o app calcula as parcelas usando a fórmula PMT e rastreia juros pagos.
- **Com Juros (livre)**: você informa cada parcela manualmente. Útil para dívidas com prestações variáveis ou empréstimos informais.

---

## 🎯 Metas

### "O aporte na meta desconta do meu saldo automaticamente?"

Sim. Ao registrar um aporte, o app usa um `writeBatch` atômico que:
1. Incrementa `valorAtual` da meta
2. Cria uma transação no Extrato
3. Decrementa o saldo da conta selecionada

Se qualquer parte falhar, nenhuma operação é salva (atomicidade garantida).

---

## ⚙️ Geral

### "Posso usar o app em mais de um dispositivo ao mesmo tempo?"

Sim. O app usa listeners em tempo real do Firestore (`onSnapshot`). Qualquer alteração feita em um dispositivo aparece automaticamente nos outros sem precisar recarregar.

### "Meus dados ficam salvos onde?"

Todos os dados são salvos no Firebase Firestore, associados à sua conta. O app não armazena informações financeiras localmente (o localStorage é usado apenas para preferências de tema e estado de UI).

### "O app funciona offline?"

Não há suporte offline nesta versão. O app requer conexão para carregar e salvar dados.

---

*Para reportar bugs ou sugerir melhorias, use a opção **Suporte** em Configurações.*
