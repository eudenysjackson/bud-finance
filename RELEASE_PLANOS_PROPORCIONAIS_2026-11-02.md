# Checkout e troca de planos — 02/11/2026

Candidato na branch codex/checkout-planos-20261102.

- Checkout autenticado direto; não desvia para login/dashboard.
- Upgrade com diferença proporcional ao ciclo pago; downgrade na renovação. Mantém data e assinatura mensal.
- Novo plano só após pagamento confirmado; cotação e identidade de pagamento validadas no servidor, sem valores arbitrados pelo cliente.
- Descontos de indicação preservados conforme ciclo. Falhas, replays, duplicidades e aprovação tardia testados em memória.
-147 testes aprovados; sintaxe e pacote público93arquivos verificados. Preferência de vendedor fictício aceita201 e checkout exibiu9,96; preferência expirada ao concluir, nenhum pagamento realizado. Aprovação completa foi simulada, não pagamento real nem sandbox ponta a ponta.
- Regras de acesso e implantação aguardam conclusão. Nenhuma conta real cobrada/cancelada/excluída.

Validação adicional:5 grupos de segurança emulados aprovados, incluindo recusa de escrita nos novos campos de cobrança e recusa de leitura/escrita do ledger privado por cliente. Pacote público verificado; não contém backend/segredos.

Regras novas compiladas e publicadas no Firestore de produção com sucesso pelo CLI.148 regressões aprovadas após proteção adicional contra evento de assinatura com plano lido antes do upgrade concorrente; evento deve ser reprocessado sem rebaixar indevidamente. Publicação de app/backend continua em preparação.


## Checkout e planos publicados e conferidos — 02/11/2026
RESOLVIDO E PUBLICADO pelo PR40, commit0fa27fd92864d7f87cf68d86717d83ea5dc3cadc. CI41545789833 e Pages41546043108 aprovados.148 regressões e5 grupos de segurança emulados aprovados. Regras compiladas/publicadas. Ping Render confirmou exatamente0fa27fd e proratedUpgradeVersion1; frontend confirmou helper, configuração20261102-plans, listener de plano e política1.8. Área autenticada abriu Configurações→Dados com plano/botões carregados e zero erros de console; não clicado para criar cobrança real. Endpoint de upgrade sem login401/nosniff.
Regra vigente: upgrade cobra diferença proporcional ao ciclo pago e libera após aprovação; downgrade na renovação, mesma assinatura/data mensal. Preferência real do vendedor fictício aceita201 e checkout exibiu9,96; expirada ao concluir, sem pagamento. Aprovação/aplicação, idempotência e restituições previstas validadas por simulação; não afirmar pagamento sandbox ponta a ponta ou cobrança real homologada nesta entrega. Nenhuma conta real cobrada/cancelada/excluída. Emuladores locais encerrados.
Esta anotação encerra publicação e QA pendentes dos registros acima. Revisão complementar de segurança PEND-SEG-REVISAO permanece PENDENTE a pedido do titular, sem desfazer proteções existentes. Claude/Codex devem preservar a decisão e manter evidências/status atualizados.
