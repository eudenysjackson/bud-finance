# Regras de planos — candidata local

### Conferência final local — 04/11/2026
167/167 testes de release aprovados, incluindo8 testes de política/cotas e3 do adapter. Comparativo renderizado no Edge headless390px:4 cartões,28 benefícios, sem overflow; captura privada .tools/plan-comparison-mobile.png inspecionada. Uma execução real do teste plan-emulator passou com Auth/Firestore demo. Segunda repetição após retomada não concluiu porque o emulador anterior já não estava escutando; encerrada, sem usar produção como alternativa. Não contabilizar essa repetição como aprovação. Revisão visual concluída. Código não publicado: localhost13107 é prévia visual; gravações pelo novo adapter dependem de backend candidato, não testar dados reais contra backend antigo. Para implantação, revisar diff e executar rollout coordenado backend/frontend/regras, conforme autorização específica. O teste emulado não substitui conferência pós-deploy.

Limites: Free1/1/5/0/0; Starter1/1/10/0/0; Pro2/2/15/5/5; Plus sem cotas do app. Ordem: contas/cartões/lançamentos/importações/IA. Trial72h Plus, depois Free. Parcelas por competência conforme decisão do titular. Dados excedentes preservados. Preços inalterados.

Mudança arquitetural: escrita financeira autenticada e validada em transação no backend; cliente financeiro usa adapter, regras fecham escrita direta. Operações e contadores privados ficam sob usuarios/uid e são removidos pelo fluxo de exclusão da árvore. Publicar conjunto coordenado; não publicar regras isoladas.
