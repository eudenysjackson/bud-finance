# 📖 Manual de Uso — Bud Finanças

> Este documento explica como cada funcionalidade do Bud Finanças funciona, escrito de forma simples para qualquer usuário. Ideal para base de conhecimento, suporte e FAQ do site oficial.

---

## Índice

- [🔄 Recorrentes](#-recorrentes)

---

## 🔄 Recorrentes

> **Planos:** Pro · Plus · Trial

### O que é?

Recorrentes são contas e receitas que aparecem todo mês (ou toda semana, ou todo dia) de forma automática. Em vez de você lançar "Netflix R$ 45,90" toda vez, você cadastra uma vez e o Bud faz isso por você no dia certo.

**Exemplos de despesas recorrentes:** Netflix, Spotify, aluguel, academia, internet, plano de saúde, financiamento do carro.

**Exemplos de receitas recorrentes:** Salário, freelance fixo mensal, aluguel recebido, mesada.

---

### Como acessar?

No menu lateral, clique em **🔄 Recorrentes**.

> Se você estiver no plano Free ou Starter, verá uma mensagem pedindo para fazer upgrade. Esse recurso é exclusivo dos planos **Pro, Plus e Trial**.

---

### O que aparece na tela?

No topo, três cartões de resumo:

| Cartão | O que mostra |
|--------|-------------|
| **Ativas** | Quantas recorrentes estão ligadas (não pausadas) |
| **Despesas / mês** | Soma estimada de todas as suas despesas recorrentes ativas por mês |
| **Receitas / mês** | Soma estimada de todas as suas receitas recorrentes ativas por mês |

> **Como a estimativa mensal é calculada?**
> - Recorrentes **mensais**: somadas diretamente (ex: R$ 45,90)
> - Recorrentes **semanais**: multiplicadas por 4,3 (média de semanas no mês)
> - Recorrentes **diárias**: multiplicadas por 30

Abaixo dos cartões, aparece a lista com todas as suas recorrentes cadastradas.

---

### Como cadastrar uma nova recorrente?

Clique no botão **+ Nova Recorrente** no canto superior direito.

Um formulário vai abrir com os seguintes campos:

#### 1. Tipo
Escolha se é uma **Despesa** (dinheiro saindo) ou uma **Receita** (dinheiro entrando). Basta clicar no botão correspondente.

#### 2. Descrição
Digite o nome da conta. Exemplo: `Netflix`, `Aluguel`, `Salário`.

#### 3. Valor
Digite o valor em reais. Use vírgula para centavos. Exemplo: `45,90`.

#### 4. Categoria
Escolha uma categoria que faz sentido para esse gasto ou receita. A lista muda dependendo se você escolheu Despesa ou Receita.

Exemplos para despesa: Streaming, Moradia, Saúde, Transporte...
Exemplos para receita: Salário, Freelance, Aluguel recebido...

#### 5. Forma de Pagamento
Como essa conta é paga? As opções são:
- **PIX**
- **Débito** (débito na conta)
- **Crédito** (cartão de crédito)
- **Dinheiro**
- **Transferência**
- **Débito automático** (cobrança automática na conta)

> Se você escolher **Crédito**, aparece um campo extra para selecionar qual cartão de crédito é cobrado. Os cartões disponíveis são os mesmos que você cadastrou na tela de Cartões.

#### 6. Periodicidade
Com que frequência essa conta aparece?
- **Mensal** — uma vez por mês
- **Semanal** — uma vez por semana
- **Diária** — todo dia

#### 7. Dia do Vencimento
*(Só aparece se você escolheu periodicidade Mensal)*

Em que dia do mês vence? Digite um número de 1 a 31. O Bud calcula automaticamente a próxima data de vencimento a partir de hoje.

> **Dica:** Se você digitar 31 e o mês atual tem só 30 dias, o Bud usa o último dia do mês automaticamente.

Depois de preencher tudo, clique em **Salvar**.

---

### O que acontece depois que eu cadastro?

O Bud calcula a **próxima data** em que essa conta vai vencer e salva isso. Todos os dias de manhã, um sistema automático verifica quais recorrentes vencem naquele dia e **cria a transação automaticamente** no seu extrato.

Ou seja: você não precisa fazer nada. No dia do vencimento, a transação já vai aparecer no seu histórico.

> ⚠️ **Aviso Beta:** O lançamento automático ainda está em fase beta. Se você não ver a transação aparecer no dia esperado, registre manualmente no Extrato por enquanto.

---

### Como editar uma recorrente?

Clique em qualquer recorrente na lista. O mesmo formulário de cadastro vai abrir, já preenchido com as informações atuais. Altere o que quiser e clique em **Salvar**.

---

### Como pausar uma recorrente sem excluir?

Cada recorrente tem um **botão de toggle** (chave liga/desliga). Quando está **verde**, está ativa e vai ser lançada automaticamente. Quando está **cinza**, está pausada e não gera transações.

Use isso para contas sazonais — por exemplo, pausar a academia durante as férias sem precisar excluir e recadastrar depois.

---

### Como excluir uma recorrente?

Dentro do formulário de edição, clique em **Excluir** (botão vermelho).

> ⚠️ **Atenção:** Excluir a recorrente **não apaga** as transações que já foram geradas por ela no passado. Apenas para os lançamentos futuros.

---

### Perguntas frequentes

**Posso ter quantas recorrentes quiser?**
Sim, não há limite de cadastro.

**A recorrente já aparece no extrato antes do dia vencer?**
Não. Ela só aparece no extrato no próprio dia do vencimento (quando o sistema automático faz o lançamento).

**Se eu cadastrar uma recorrente hoje com vencimento no dia 5, mas hoje já é dia 10, quando vai aparecer?**
O Bud vai agendar para o dia 5 do mês seguinte.

**Se eu pausar uma recorrente no meio do mês, o que acontece com a transação desse mês?**
Se a transação já foi lançada, ela permanece no extrato. A pausa só impede lançamentos futuros.

**Posso vincular uma recorrente a um cartão de crédito?**
Sim! Ao escolher **Crédito** como forma de pagamento, selecione o cartão. O gasto vai aparecer nas faturas daquele cartão.

**A estimativa mensal é exata?**
Não, é uma estimativa. Para receitas/despesas semanais e diárias, o valor é calculado com uma média (4,3 semanas/mês ou 30 dias/mês).

---

*Última atualização: 26/04/2026*
