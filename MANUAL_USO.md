# 📖 Manual de Uso — Bud Finanças

> Este documento explica como cada funcionalidade do Bud Finanças funciona, escrito de forma simples para qualquer usuário. Ideal para base de conhecimento, suporte e FAQ do site oficial.

---

## Índice

- [� Login e Cadastro](#-login-e-cadastro)
- [🏠 Dashboard](#-dashboard)
- [📋 Extrato](#-extrato)
- [🎯 Metas](#-metas)
- [💳 Cartões](#-cartões)
- [🏦 Carteira](#-carteira)
- [🏷️ Categorias](#-categorias)
- [🔄 Recorrentes](#-recorrentes)
- [💸 Dívidas](#-dívidas)
- [⛔ Limites](#-limites)
- [📊 Comparativo](#-comparativo)
- [📅 Balanço Mensal](#-balanço-mensal)
- [📑 Relatórios](#-relatórios)
- [📈 Gráficos](#-gráficos)
- [💡 Insights](#-insights)
- [🤖 Assistente IA](#-assistente-ia)
- [🛒 Compras / Mercado](#-compras--mercado)
- [📉 Investimentos](#-investimentos)
- [⚙️ Configurações](#-configurações)

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

*Última atualização: 20/05/2026*

---

## 🔐 Login e Cadastro

### Como criar uma conta
1. Acesse o Bud Finance e clique em **"Criar conta"**.
2. Preencha **nome**, **e-mail** e **senha** (mínimo 6 caracteres).
3. Um e-mail de verificação será enviado. Confirme antes de entrar.

### Como fazer login
- Informe seu e-mail e senha cadastrados.
- Caso esqueça a senha, clique em **"Esqueci a senha"** — você receberá um link de redefinição no e-mail.

### Planos
| Plano | Recursos |
|---|---|
| **Free** | Funcionalidades básicas |
| **Trial** (3 dias) | Acesso completo Pro, liberado automaticamente no cadastro |
| **Pro** | Sem limites, IA ilimitada, todas as funcionalidades |

> 💡 O trial Pro é ativado automaticamente nos primeiros 3 dias após o cadastro.

---

## 🏠 Dashboard

A tela inicial do Bud Finance. Mostra um resumo financeiro do mês atual.

### O que você vê
- **Saldo Total** — soma dos saldos de todas as contas cadastradas na Carteira.
- **Entradas / Saídas do mês** — totais de receitas e despesas registradas no mês.
- **Resumo por categoria** — gastos agrupados por categoria (top 5).
- **Últimas transações** — as transações mais recentes.

### Navegar por meses
Use as setas `< >` ao lado do mês para ver outros períodos.

### Registrar transação rápida
Clique no botão **"+ Nova Transação"** (flutuante na tela). Preencha: tipo, valor, descrição, categoria e data. Confirme.

### Alerta financeiro
Se seus gastos superarem 80% da renda cadastrada, o dashboard emite um alerta visual. Configure a renda em **Configurações → Perfil**.

---

## 📋 Extrato

Lista todas as transações do período selecionado.

### Filtros disponíveis
- **Mês/Ano** — navegue pelos meses com as setas.
- **Tipo** — todos, despesas ou receitas.
- **Categoria** — filtre por uma categoria específica.

### Editar/Excluir
Toque em uma transação para ver os detalhes, editar ou excluir.

### Pesquisa
Use o campo de busca para encontrar transações por descrição.

---

## 🎯 Metas

Planejamento de objetivos financeiros (viagem, reserva de emergência, etc.).

### Criar uma meta
1. Clique em **"+ Nova Meta"**.
2. Defina **nome**, **valor alvo**, **data limite** e **ícone**.

### Registrar aporte
Abra a meta e clique em **"+ Registrar Aporte"**. Informe o valor depositado.

### Conclusão
Quando a meta atingir 100%, é marcada como concluída automaticamente.

---

## 💳 Cartões

Gerenciamento de cartões de crédito e faturas.

### Adicionar cartão
1. Clique em **"+ Novo Cartão"**.
2. Informe **nome**, **banco**, **limite**, **dia de fechamento** e **dia de vencimento**.

### Importar fatura via IA (📤 Importar IA)
1. Clique em **"📤 Importar IA"** no cartão.
2. Selecione o **PDF ou foto** da fatura (até 10 MB).
3. A IA extrai todas as transações automaticamente.
4. **Revise** cada item e clique em **"Confirmar importação"**.

> ⚠️ Sempre revise antes de confirmar — a IA pode errar em layouts incomuns.

---

## 🏦 Carteira

Gestão de contas bancárias e controle de saldo.

### Adicionar conta
1. Clique em **"+ Nova Conta"**.
2. Defina **nome**, **tipo** (corrente, poupança, digital) e **saldo inicial**.

### Atualizar saldo
Abra a conta → **"Atualizar saldo"** → informe o saldo atual.

> 💡 O Bud envia notificação semanal se o saldo não for atualizado há mais de 7 dias.

### Importar extrato (OFX/PDF/CSV)
Na conta, clique em **"Importar Extrato"**. OFX é o formato mais preciso.

---

## 🏷️ Categorias

### Categorias padrão
Incluídas para despesas e receitas. Não podem ser excluídas.

### Criar categoria personalizada
1. Acesse **Categorias** no menu.
2. Clique em **"+ Nova Categoria"** e defina nome, emoji e tipo.

> 💡 Plano Free tem limite de categorias personalizadas. Upgrade para Pro para ilimitadas.

---

## 💸 Dívidas

Acompanhamento de empréstimos, financiamentos e outros débitos.

### Adicionar dívida
1. Clique em **"+ Nova Dívida"**.
2. Selecione o **tipo** (Empréstimo, Financiamento, etc.) e o **formato** (simples, com juros, via IA).
3. Preencha: credor, valor total, parcelas, taxa de juros, vencimento.

### Registrar pagamento
Abra a dívida → **"Registrar Pagamento"**. O progresso é atualizado automaticamente.

### Importar contrato via IA
Envie o PDF do contrato pelo **Assistente IA**. O app detecta e preenche o formulário automaticamente.

### Simulador de quitação
Abra uma dívida com juros → **"Simulador"** para ver o valor de quitação antecipada.

---

## ⛔ Limites

Controle de gastos por categoria (budget mensal).

### Criar limite
1. Acesse **Limites** no menu.
2. Clique em **"+ Novo Limite"**, selecione a **categoria** e defina o **valor máximo mensal**.

### Alertas
- **80% atingido** → badge amarelo.
- **100% atingido** → badge vermelho.

---

## 📊 Comparativo

Compara receitas e despesas entre dois períodos.

Selecione **período 1** e **período 2**. O gráfico exibe os totais por categoria side-by-side.

---

## 📅 Balanço Mensal

Visão consolidada de entradas, saídas e resultado líquido de cada mês.

- **Resultado positivo** → sobrou dinheiro.
- **Resultado negativo** → déficit no mês.
- Clique em **"Exportar PDF"** para baixar o balanço formatado.

---

## 📑 Relatórios

### Tipos disponíveis
- **Por período** — todas as transações de um intervalo de datas.
- **Por categoria** — detalhamento de uma categoria específica.
- **Por conta** — transações de uma conta específica.

### Exportar
Clique em **"Exportar"** e escolha **PDF** ou **CSV**.

---

## 📈 Gráficos

### Tipos de gráfico
- **Pizza** — distribuição por categoria.
- **Barras** — evolução mensal de receitas e despesas.
- **Linha** — tendência de saldo.

Use os filtros de período, tipo e categoria para personalizar.

---

## 💡 Insights

Análises automáticas da IA sobre seus hábitos financeiros.

A IA analisa as últimas transações e gera insights como: _"Seus gastos com Delivery aumentaram 40% este mês"_. Atualizados automaticamente a cada nova transação.

---

## 🤖 Assistente IA

Chat com IA para análise financeira e processamento de documentos.

### Fazer perguntas
Digite qualquer pergunta: _"Quanto gastei em restaurantes esse mês?"_ ou _"Qual foi minha maior despesa em Abril?"_.

### Enviar arquivo
Clique no ícone 📎 e selecione um arquivo:

| Tipo | O que acontece |
|---|---|
| **OFX/QFX** | Extrai transações bancárias automaticamente |
| **CSV/XLS/XLSX** | Importa planilhas financeiras |
| **PDF de fatura** | Extrai transações do cartão |
| **Foto de cupom fiscal** | Extrai itens da nota |
| **PDF de boleto** | Detecta credor, valor e vencimento |
| **PDF de contrato de empréstimo** | Detecta dados e oferece "Registrar Dívida" |
| **PDF de extrato bancário** | Identifica e redireciona para Carteira → Importar |

> 💡 O Assistente IA detecta o tipo do documento automaticamente — você não precisa informar antes de enviar.

### Registro por voz
Clique no ícone 🎤 e dite: _"Gastei R$ 50 no mercado ontem"_. A IA registra após confirmação.

---

## 🛒 Compras / Mercado

Registro e análise de compras no supermercado via cupom fiscal.

### Registrar compra
1. Clique em **"+ Nova Compra"**.
2. Fotografe o cupom fiscal ou faça upload do PDF.
3. A IA extrai itens, valores e estabelecimento.
4. Confirme e salve.

---

## 📉 Investimentos

Acompanhamento da carteira de investimentos.

### Adicionar ativo
1. Clique em **"+ Novo Investimento"**.
2. Selecione o **tipo** (Renda Fixa, Ações, FII, Tesouro, etc.).
3. Informe nome, valor investido, data e taxa/rendimento esperado.

### Importar via IA
Envie o PDF do contrato pelo **Assistente IA** — o app detecta e redireciona com os dados pré-identificados.

---

## ⚙️ Configurações

### Perfil
Altere **nome**, **foto** e **renda mensal** (usada para alertas de gasto excessivo).

### Segurança
- **Trocar senha**: acesse "Trocar Senha" e siga as instruções.

### Notificações
Ative/desative notificações push para alertas financeiros, lembretes de parcelas e saldo.

### Tema
8 temas disponíveis: Gelo (padrão), Dark, Azul, Roxo, Rosa, Amarelo, Verde e Vermelho.

### Tutorial
Para rever o tutorial inicial: **Configurações → Tutorial → Reiniciar tutorial**.

### Exportar dados
**Configurações → Dados** → exportar histórico completo em CSV.

### Excluir conta
**Configurações → Conta** → **"Excluir minha conta"** — apaga todos os dados permanentemente.

> ⚠️ Esta ação é **irreversível**.
