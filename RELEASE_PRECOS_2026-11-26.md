# Publicação da tabela de preços — 26/11/2026

Preparada, não publicada. Starter R$4,99, Plus R$14,99 e Pro R$29,99. As cotas, planos internos e teste de três dias permanecem iguais. A decisão do titular é reduzir também o valor das assinaturas atuais na próxima renovação.

## Validação

200 testes de release aprovados, sintaxe dos JS aprovada, pacote público com119 arquivos conferido e scanner de segredos aprovado. Migração validada com provedor simulado, sem chamar pagamentos reais. Não foram consultadas ou alteradas assinaturas de produção nesta tarefa.

## Bloqueio e sequência de implantação

A revisão automática rejeitou a implantação de regras em produção por falta de autorização específica nesta nova tarefa. Não contornar. Após autorização explícita:

1. Conferir branch e revisão remota, preservar alterações de outras tarefas e implantar `firestore.rules` no projeto bud-finance. A diferença acrescenta `planoPreco` e `cicloPrecoBase` à lista de campos de cobrança que o cliente não pode alterar.
2. Abrir PR, aguardar validação e integrar. Conferir auto-deploy do Render e Pages na mesma revisão. Nenhuma nova variável secreta é necessária. O módulo `backend/subscription-pricing.js` deve acompanhar o backend.
3. No ambiente privado do backend, com as credenciais existentes de Firebase Admin e Mercado Pago, executar primeiro o relatório somente leitura:

```sh
node ../scripts/update-subscription-prices.js --report /tmp/bud-prices-dryrun.local.json
```

4. Conferir o resumo e o relatório privadamente. Não copiar UID, contato, token ou dados de assinatura para Git/chat. Para aplicar a alteração de próxima renovação autorizada:

```sh
node ../scripts/update-subscription-prices.js --apply --production --report /tmp/bud-prices-apply.local.json
```

Os exemplos assumem diretório `backend` no Render. A rotina usa apenas GET/PUT de `/preapproval/{id}`, preserva a data da próxima cobrança e não cria pagamento. Faz paginação em perfis; ignora perfis sem assinatura ativa, não infere que um plano concedido manualmente representa uma cobrança. Não afirmar migração concluída se o relatório retornar erros ou pendências. O processo retorna código2 nesses casos. Para resposta incerta, repetir e conferir por leitura; o estado planejado é salvo antes do PUT e o estado confirmado só após verificar o provedor.

Cobrança a menos de uma hora, primeiro pagamento pendente e upgrade em andamento exigem repetição ou revisão antes do vencimento. Nunca apagar checkout, trocar cotas ou cancelar pagamentos para forçar a migração. Se não houver assinaturas elegíveis, registrar resumo zero sem inventar atualizações.

5. Conferir site/app/labels, catálogo e revisão do backend; confirmar migração pelo relatório sem realizar cobrança de teste. Registrar contagens, commit, CI/deploy e pendências no AI_HANDOFF.md. A ficha Gestor não publicada permanece separada e deve adotar o catálogo ao ser retomada.

## Referência

O Mercado Pago documenta a alteração do valor recorrente com `PUT /preapproval/{id}`, usando `auto_recurring.transaction_amount` e `currency_id`: [Gerenciamento de assinaturas](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/subscription-management). O script não envia campo de data, status, cartão ou operação de pagamento.

## Fechamento publicado
Publicado em26/11/2026 por PR69/70. Regras Firebase aprovadas, backend1907b3a e frontend8be3966 (backend sem diferenças).201 testes aprovados; preços renderizados e indicação confirmados. Dry-run/apply no Render encontraram0 assinaturas elegíveis e1 vínculo sem status authorized, sem erros ou alterações em contratos. Conferência pública final e IDs de execução em AI_HANDOFF.md. Nenhuma pendência de publicação desta entrega.
