# Estado compartilhado e ponto de continuidade

**Atualizado em:** 01/11/2026 (America/Sao_Paulo)  
**Commit do código de inadimplência:** `c42e6405202c7a9bf3a2e212026932425e76ae16`  
**Protocolo compartilhado integrado:** PR [#2](https://github.com/eudenysjackson/bud-finance/pull/2), commit `9cad46ca8180eb1c21ba640be239cc7c013a4276`  
**Protocolo comum:** [AI_WORKFLOW.md](AI_WORKFLOW.md)

## Contexto

Foi implementada a regra de inadimplência da assinatura: 10 dias de tolerância, avisos por e-mail e push nos dias 0, 3, 7 e 10, reconciliação com Mercado Pago antes de cancelar, e retorno ao plano Gratuito após o cancelamento confirmado. A Política de Privacidade v1.6 informa a regra de não negativação. O escopo e as evidências estão em [RELEASE_INADIMPLENCIA_2026-11-01.md](RELEASE_INADIMPLENCIA_2026-11-01.md).

## Estado confirmado

- Código integrado ao `master` no commit `c42e6405202c7a9bf3a2e212026932425e76ae16`.
- GitHub Actions run [41333146559](https://github.com/eudenysjackson/bud-finance/actions/runs/41333146559) passou com 80 testes, empacotamento e deploy do GitHub Pages.
- A anotação do release foi atualizada no commit `f55bbad67c1fdddf5834307c7299de7a2eca7a81`; run [41333614878](https://github.com/eudenysjackson/bud-finance/actions/runs/41333614878) passou.
- Render confirmou o Static Site `bud-finance` ligado ao `master` no commit `f55bbad`.
- As regras do Firestore foram compiladas e publicadas no projeto `bud-finance`.
- O endpoint público `/api/ping` de `bud-finance-backend.onrender.com` respondeu `ok`.

## Pendente — confirmar backend em produção

O dashboard Render acessível na sessão de 01/11 mostrava somente o Static Site `bud-finance`, não o serviço Web `bud-finance-backend`. O ping confirma que algum backend responde, mas não identifica a revisão em execução. Portanto, ainda não declarar o fluxo automático de inadimplência totalmente publicado.

**Próxima ação:** abrir no Render o workspace/serviço Web que atende `bud-finance-backend.onrender.com` e verificar o último deploy, o commit implantado e as variáveis necessárias para e-mail, Mercado Pago e cron das 18h. Só concluir após confirmar revisão e configuração; não disparar e-mail/push, cobrar ou cancelar assinatura real como teste.

## Limites dos testes até aqui

- `npm run test:release`: 80 aprovados, 0 falhas; sintaxe dos arquivos alterados e `git diff --check` aprovados.
- Reconciliação e cancelamento verificados com Mercado Pago e Firestore simulados.
- Nenhum e-mail ou push foi enviado a usuários reais; nenhuma cobrança ou assinatura real foi alterada.
- Distinguir sempre testes locais/emulados de comportamento confirmado em produção.

## Evolução do trabalho compartilhado — 01/11/2026

PR [#2](https://github.com/eudenysjackson/bud-finance/pull/2) integrada ao `master` no commit `9cad46c`. Foram adicionados `AI_WORKFLOW.md`, `AGENTS.md`, `CLAUDE.md` e esta referência de handoff; também foram atualizados `PENDENCIAS.md`, `DECISIONS_LOG.md`, `ARCHITECTURE_MAP.md` e `PROJECT_RULES.md`. Todos os agentes devem ler o protocolo comum, usar branches separadas e registrar aqui avanços, validações e o ponto de continuidade. A automação da inadimplência ainda aguarda confirmação da revisão do backend Render descrita acima.

## Protocolo para a próxima IA

Leia [AI_WORKFLOW.md](AI_WORKFLOW.md), depois consulte [PENDENCIAS.md](PENDENCIAS.md), [DECISIONS_LOG.md](DECISIONS_LOG.md), [ARCHITECTURE_MAP.md](ARCHITECTURE_MAP.md), [PROJECT_RULES.md](PROJECT_RULES.md), [ERRORS_LOG.md](ERRORS_LOG.md) e o release acima. Verifique se o master avançou além do commit de referência antes de agir; este handoff pode ficar desatualizado conforme novas entregas forem feitas.
