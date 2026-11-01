# Protocolo de trabalho compartilhado por IAs

**Projeto:** Bud Finance  
**Idioma de comunicação e documentação:** português brasileiro  
**Fuso para datas operacionais:** America/Sao_Paulo  
**Fonte compartilhada:** este repositório GitHub

Este arquivo é a referência comum para Codex, Claude e qualquer outra IA que receba acesso ao repositório. Históricos de chat e memórias privadas de cada ferramenta não são compartilhados; decisões e estado que precisam sobreviver devem ser registrados aqui e nos documentos abaixo.

## Antes de começar qualquer tarefa

1. Leia este arquivo, `AGENTS.md` ou `CLAUDE.md` conforme a ferramenta, `AI_HANDOFF.md`, `PENDENCIAS.md`, `DECISIONS_LOG.md`, `ARCHITECTURE_MAP.md` e `PROJECT_RULES.md`. Leia também `ERRORS_LOG.md` e os relatórios `RELEASE_*.md` relacionados ao trabalho.
2. Verifique o branch, o commit atual e `git status`. Mudanças existentes podem ser trabalho do usuário ou de outra sessão: não as descarte, sobrescreva, resete ou faça commit sem entender a origem.
3. Confirme qual pendência está ativa e o último registro em `AI_HANDOFF.md`. Se o estado local divergir do GitHub, informe a diferença e use o commit/branch mais recente como referência para coordenação.
4. Se não houver pedido claro para uma ação externa, limite-se a preparar e validar a mudança. Nunca deduza autorização para publicar em produção, mexer em contas/dados reais, aceitar contratos, fazer cobranças/cancelamentos ou enviar mensagens a usuários.

## Coordenação entre agentes

- Cada agente trabalha em branch própria, com commits pequenos e identificáveis. Não trabalhem simultaneamente na mesma branch nem alterem os mesmos arquivos numa pasta de trabalho compartilhada.
- O GitHub é a fonte de sincronização: mudanças não são visíveis ao outro agente até serem commitadas e enviadas. Integre por Pull Request; não use push forçado.
- Antes de tocar em arquivos com alterações pendentes de outra sessão, pare e coordene pelo usuário. Não presuma que alterações não commitadas são descartáveis.
- Não afirme que outro agente concluiu algo sem verificar o commit, PR, teste ou implantação correspondente.
- Nunca coloque senhas, tokens, chaves, cookies, dados pessoais de clientes ou segredos em Markdown, commits, issues ou prompts. Segredos ficam apenas nos gerenciadores próprios (Render, GitHub Actions, Firebase etc.). Se um segredo aparecer em saída, pare de repeti-lo e registre a necessidade de revogação sem registrar o valor.

## Registro obrigatório da evolução

Ao assumir uma tarefa relevante, registre em `AI_HANDOFF.md` o objetivo e o status. Durante o trabalho longo, mantenha ali o progresso e os bloqueios. Ao encerrar cada tarefa, atualize o mesmo documento com:

- o que mudou e em quais arquivos;
- testes e validações executados, com resultado;
- commit/PR e estado da publicação, quando houver;
- o que ficou pendente, o motivo, o próximo passo concreto e quem precisa agir.

Mantenha os outros registros de forma coerente:

- `PENDENCIAS.md`: pendências reais, resoluções e histórico datado. Não implemente itens de backlog sem solicitação explícita.
- `DECISIONS_LOG.md`: decisões de produto ou arquitetura não óbvias, com motivo e consequências.
- `ARCHITECTURE_MAP.md`: telas, serviços, integrações e fluxos quando a arquitetura mudar.
- `ERRORS_LOG.md`: bugs ativos e correções relevantes.
- `RELEASE_*.md`: escopo, evidência de testes, commit e limites da validação de cada entrega.
- Não reescreva nem apague histórico para fazer o status parecer mais recente; adicione atualização datada.

## Validação e comunicação

- Faça as verificações apropriadas à mudança e registre exatamente o que foi executado. Não diga que algo funciona em produção só porque passou em testes locais ou em emulador.
- Para produção, confirme o commit implantado no serviço responsável e verifique o comportamento público sem produzir cobranças, cancelamentos ou envios reais não autorizados.
- Informe ao usuário, em português claro, o progresso, o que foi concluído, o que falta e qualquer risco concreto. Se a execução parar, atualize `AI_HANDOFF.md` antes de encerrar para que outra IA possa continuar sem depender deste chat.
- Respeite as instruções mais recentes do usuário. Em caso de conflito entre documentos antigos e o pedido atual, explique a inconsistência e use o pedido atual, registrando a decisão quando for relevante.

## Hierarquia de referência

1. Pedido e autorização atuais do usuário.
2. Este protocolo e as instruções de entrada da ferramenta (`AGENTS.md` / `CLAUDE.md`).
3. `AI_HANDOFF.md` para o estado atual e o próximo passo.
4. Código e configuração implantados no commit mais recente, `DECISIONS_LOG.md`, `ARCHITECTURE_MAP.md`, `PENDENCIAS.md`, `ERRORS_LOG.md` e relatórios de release relacionados.
5. Documentos antigos, somente quando ainda coerentes com as fontes acima.

Se algo essencial estiver contraditório ou não verificável, não invente uma resposta: registre a divergência no handoff e peça apenas a informação necessária.
