# Importação de IA sem espera indefinida — 01/11/2026

## Diagnóstico

A mensagem da captura é emitida por `backend/ai-reader.js` ao receber HTTP 429 do provedor. O leitor tentava até 12 vezes, com esperas de até 180 segundos por tentativa; o cliente fazia polling sem prazo global. O heartbeat renovava a lease durante a espera e não havia prazo de execução do worker. Isso permitia manter a interface em andamento por vários minutos, sem resultado útil nem explicação de falha. A captura identifica esse caminho, mas o documento original do usuário e seus logs específicos não foram disponibilizados para reprodução da mesma leitura.

## Correção

- Provedor: até três tentativas, no máximo duas esperas curtas; espera individual até 15 segundos e acumulada até 20 segundos por solicitação. Limite persistente retorna erro de indisponibilidade, sem fingir leitura concluída. A fila é liberada depois da falha.
- Trabalho de leitura: prazo total de três minutos no backend em memória e persistente, encerramento com HTTP lógico 504 e código AI_JOB_TIMEOUT, cancelamento das chamadas à IA e descarte de resposta tardia.
- Firestore: o polling também encerra trabalhos antigos, mesmo que o heartbeat tenha continuado ou o worker tenha reiniciado. A admissão de novas leituras é liberada.
- Cliente compartilhado: prazo global de 210 segundos e prazo de 30 segundos por conexão, incluindo corpo da resposta. Erros recuperam a interface em vez de continuar consultando indefinidamente.
- Cartões: remove mensagem antiga de timeout de 45s que já não correspondia ao comportamento. Cancelamento mostra orientação correta.
- As correções compartilhadas atendem os outros leitores que usam budAIRequest e createJobs. Não inventam transações nem retornam resultados parciais em caso de falha.

## Validação

- 91 regressões aprovadas, zero falhas, incluindo arquivo com mais de 30 mil caracteres, PDF textual, PDF escaneado e imagem repartida.
- Casos adicionados: provedor sempre 429; espera longa recusada sem dormir minutos; fila liberada; worker travado em memória e persistente; resposta tardia descartada; registro antigo com lease ativa encerrado; polling sempre running; conexão sem resposta.
- A falha foi reproduzida de forma controlada com provedor e relógios emulados. Isso valida os estados e os prazos; não comprova que a capacidade contratada do provedor nunca será esgotada.

## Publicação

Em preparação nesta branch. Registrar commit integrado e confirmação de Render/Pages após implantação. A publicação anterior de indicações foi integrada no master em 3d6f5f4c831498a8938d4ba1ba463197a2c439ae; Pages 41344526378 aprovado, backend Render Live no mesmo commit. Publicação das regras de indicação aguarda concluir login local do Firebase CLI.

