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
