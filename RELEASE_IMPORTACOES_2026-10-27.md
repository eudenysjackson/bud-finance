# Candidata de lançamento — importação de documentos

Data: 27/10/2026. Escopo: leitura/importação em Cartões, Contas, Compras e Dívidas. Buddy reservado para atualização futura. Esta homologação não é uma revisão completa de todas as funcionalidades do aplicativo.

## Resultado no navegador interno

| Tela | Caso executado | Resultado |
|---|---|---|
| Cartões | PDF textual Nubank fictício, 24 compras/R$300 | Revisão correta; leitura direta conciliada. Teste anterior 1,54s; repetição final após reinício 4,10s. |
| Contas | Imagem de extrato: receita100/despesa25 | Duas transações classificadas, revisadas e gravadas na conta fictícia local; saldo calculado75. |
| Compras | Cupom PDF de quatro páginas, quatro produtos/R$100 | Todas as páginas lidas; revisão correta e compra gravada no emulador. |
| Dívidas | PDF com dados somente na sexta página | R$1200/12xR$100 reconhecidos e dívida fictícia gravada. |
| Dívidas | PDF escaneado sem texto | OCR reconheceu R$1200/12xR$100; conferido na revisão. |
| Buddy | Abrir assistente-ia.html diretamente | Redireciona ao dashboard; link oculto. |

Todos os dados gravados pelos testes acima pertencem exclusivamente ao Firebase Emulator e à conta homologacao@bud.local. Evidências em test-results/qa-*.png. Nenhum teste confirmou cobrança ou assinatura real.

## Correções desta candidata

- Contas envia Bearer token no upload e apresenta a mensagem do backend.
- Compras envia o PDF original, preservando texto e todas as páginas; removeu conversão antecipada e corte de três páginas. Fallback OCR de imagem única não descarta os demais arquivos de um envio múltiplo.
- Dívidas lê todas as páginas e usa OCR em páginas sem texto, com liberação dos recursos.
- Upload de Compras alinhado ao limite exibido de8MB por arquivo, até3 arquivos; imagens maiores que3MB são normalizadas antes da chamada visual.
- Após revisão IA, cadastro de compra usa título Nova Compra.
- Buddy permanece desabilitado nesta versão mesmo com flags antigas em cache.
- Deploy executa regressões de importação e empacota apenas arquivos públicos, sem backend, testes, PDFs de exemplo, emuladores, logs ou variáveis locais.

## Pacotes e verificações

- Frontend: dist/site,84 arquivos públicos; verificado por lista permitida. CI gera novamente após injetar configuração de produção.
- Backend: backend/package.json e lockfile; instalar com npm ci na pasta backend, Node22. Incluir ai-reader.js, ai-jobs.js e invoice-reader.js junto do server.js/parser.js.
- npm run test:imports:15 testes aprovados. Sintaxe dos quatro módulos de tela aprovada.
- Testes com Groq: usar scripts/smoke-ia-local.js somente com backend/.env.local e emuladores. Resultados/tempos ficam no console; não grava movimentações.

## Condições para publicar

1. Reativar/validar o serviço Render e suas variáveis existentes. GROQ_MODEL=qwen/qwen3.8-27b; dimensionar GROQ_MAX_OUTPUT_TOKENS conforme capacidade contratada. A configuração local900 não elimina a cota do provedor.
2. Usar uma única instância/processo enquanto os trabalhos estiverem em memória; reinícios perdem leituras em andamento. Persistência compartilhada continua em PEND-IA-004.
3. Publicar backend atualizado antes do frontend. Validar /api/ping, CORS com X-Bud-Async, upload autenticado e acompanhamento /api/ia/jobs/:id pelo domínio público.
4. CI de Pages dispara em master; alterações locais ainda precisam de revisão e integração nessa branch. Nada foi enviado, mesclado ou publicado nesta tarefa.
5. Repetir um documento fictício por tela em produção e verificar totais, datas, cota e gravação. Esta etapa depende do serviço online ativo.

A candidata está preparada para revisão/publicação, mas a operação online e a latência de documentos que exigem IA ainda dependem do Render e da capacidade Groq. O parser direto é específico para layout Nubank reconhecido e conciliado; não é uma promessa de leitura universal.

## Execução final com provedor real

Sete casos aprovados: fatura direta4,10s; fatura PDF3,07s; cupom texto1,57s; cupom imagem3,05s; fatura imagem3,03s; extrato imagem24,21s; PDF escaneado30,31s. Tempos incluem acompanhamento assíncrono e eventual espera da cota; são medições locais desta execução, não um SLA.

## Complemento de fechamento local

Correções adicionais de Metas, exclusão, Relatórios e push foram concluídas e passaram em21 regressões mais5 grupos emulados. Estado atualizado e mapa de URLs em RELEASE_STATUS_2026-10-27.md.
