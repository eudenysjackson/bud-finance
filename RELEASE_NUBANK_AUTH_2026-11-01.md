
## Correção de importação e renovação de sessão — 01/11/2026

ERR-072 / PEND-IA-006: correção implementada. PDF Nubank real analisado localmente com o mesmo readPDF de produção: 51 linhas, diferença de um centavo entre soma e total. Parser aceita apenas variação de até 1 centavo, preserva linhas/total e retorna differenceCents/requiresReview; revisão mostra aviso explícito. Diferenças maiores seguem para IA. Não cria ajuste e não presume arredondamento do banco. Rótulo de total permite moeda adjacente. Nenhum dado financeiro real incluído em fixtures ou Git.

Firebase: chave Bud Finance Web não permitia securetoken.googleapis.com, bloqueando renovação de sessão. Serviço acrescentado à lista existente sem remover restrições; operação concluída e probe com refresh inválido retornou INVALID_REFRESH_TOKEN, em vez de API_SERVICE_BLOCKED. A confirmação com sessão real do titular ainda depende de abrir novamente o app.

Validação: 92 testes aprovados, zero falhas; PDF real aceito pelo parser local sem chamada Groq, 51 linhas e aviso de um centavo. Não confundir isso com validação autenticada no navegador online. Groq permanece para layouts desconhecidos/imagens; capacidade externa continua finita (DEC-070). Publicação em preparação.

## Complemento após teste online (01/11/2026)
Primeiro deploy 9f52582 (PR #10) chegou ao Render Live e abriu revisão online com51 linhas. A conferência revelou heurística cliente que confundia compras de mesmo valor com estornos e seleção não preservava a soma líquida. Corrigido no caminho PDF validado: signedAmounts mantém sinais/linhas, créditos negativos selecionados individualmente, nenhuma inferência por valor. Script versionado para evitar cache antigo. 93 testes aprovados. Somente revisão testada; nenhum lançamento salvo. Publicação complementar em preparação.


## Confirmação final — Nubank e sessão online (01/11/2026)

RESOLVIDO E PUBLICADO: PR #10 (9f52582) e PR #11 (aea9b41b572f40a71d9ac6bf9301b4c53f48bc32). Render confirmou Live aea9b41; Pages 41359548750 concluído com sucesso. 93 regressões aprovadas; CI do PR11 41359482382/41359476868 aprovado. No navegador interno autenticado, o PDF real abriu a revisão com 51 linhas e 51 checkboxes selecionados, preservando sinais, sem depender de chamada Groq. Aviso explícito da diferença de R$0,01 exibido. Revisão ficou aberta para o titular; nenhum lançamento salvo. Após rollout, repetir leitura confirmou correção também da seleção (primeira tentativa durante troca de instância ainda usou resultado antigo). Firebase Secure Token API está permitida na chave Web; probe retornou INVALID_REFRESH_TOKEN para token propositalmente inválido, eliminando API_SERVICE_BLOCKED, e login/análise autenticada passaram. PEND-IA-006 / ERR-072 resolvidos para este layout; outros layouts/imagens permanecem sujeitos à capacidade Groq. Não generalizar a validação desta fatura para qualquer documento.
