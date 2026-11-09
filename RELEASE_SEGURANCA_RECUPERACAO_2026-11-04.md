> Atualização04/11: Gestor e avisos administrativos foram separados da candidata Finance e preservados em deferred/budgestor-20261104. As descrições anteriores de integração/fila são históricas, não componentes ativos desta entrega. Finance:175 testes aprovados e pacote104arquivos. Sem publicação.

# Segurança, recuperação e avisos administrativos

Estado: implementado e validado localmente, sem publicação. Candidata em `codex/cancelamento-pendente`, junto às alterações de planos documentadas no release de 04/11. Nenhuma conta real, cobrança, cancelamento, envio ou backup de cliente foi operado.

## Controles entregues

- Configurações → Segurança: encerrar todas as sessões, exigindo login recente. A API usa somente o UID autenticado, grava barreira de revogação privada, desativa os dispositivos push e revoga refresh tokens. Regras e middleware bloqueiam tokens antigos. Novo login continua permitido. Isso não apaga cópias já baixadas em dispositivos nem substitui troca de senha quando comprometida.
- API com respostas privadas sem armazenamento em cache, proteção contra enquadramento e erros não tratados sem stack/corpo recebido. CORS em produção permite somente as origens públicas da Bud. Infraestrutura de autenticação indisponível bloqueia chamadas protegidas.
- `fcmToken`, `fcmTokens` e `pushEnabled` somente pelo backend/admin; cliente não pode contornar registro/consentimento gravando esses campos diretamente. Reset financeiro preserva preferências push; revogação tem fluxo próprio.
- CI verifica o pacote público antes da publicação. Bloqueia arquivos privados, cópias de recuperação e padrões de credenciais privadas. A chave pública Firebase não é uma credencial administrativa. A inspeção cobre padrões conhecidos, não detecta qualquer segredo concebível nem verifica o histórico Git inteiro.

## Avisos do proprietário

O titular escolheu **budsolucoes@gmail.com**. Esse é o destinatário padrão do servidor; `OWNER_NOTIFICATION_EMAIL` pode sobrescrever e `OWNER_NOTIFICATION_UID` fixa a identidade quando configurado. Não usar endereços pessoais de clientes como fallback. O envio exige conta Auth verificada, não desativada, documento `admins/{uid}`, perfil existente e consentimento push ativo. Não promove nenhuma conta automaticamente.

Eventos: cadastro com início do trial, primeira cobrança confirmada de cada assinatura e cancelamento de uma assinatura paga ativa/em atraso. Não envia por mera abertura/desistência de checkout, pausa, atribuição manual de plano ou repetição de webhook. O aviso não contém nome, e-mail, saldo ou detalhes financeiros do cliente na tela bloqueada; abre o painel administrativo para consulta autenticada.

Fila `_owner_events` no próprio usuário, gravada na mesma transação da mudança. Regras proíbem leitura/escrita pelo navegador, inclusive admin. IDs determinísticos evitam repetir eventos; lease coordena workers. Tentativas têm atraso crescente, até uma hora, por até sete dias. Aceites por dispositivo são lembrados para reenvio parcial. Deduplicadores permanecem no perfil e são removidos na exclusão dele. O worker verifica a fila na manutenção de 60 segundos; serviço dormindo/offline atrasa o envio. FCM aceito não prova exibição no aparelho. Se o processo cair entre o aceite pelo FCM e a confirmação no banco, um retry ainda pode repetir um aviso; tag estável reduz repetição visual, não é garantia de entrega exatamente uma vez.

Antes de ativar em produção: confirmar a conta corporativa como administradora e entrar nela no celular, ativar push, publicar o índice `_owner_events/state,nextAt` e conferir que a fila é consumida. Não enviar teste coletivo nem criar assinatura real para validar. No iOS, seguir o fluxo de instalação/permissão já suportado pelo app.

## Recuperação criptografada

`scripts/financial-recovery.cjs` exporta somente os dados financeiros permitidos de um UID, incluindo depósitos de metas. Não exporta Auth, senhas, tokens push, planos, credenciais ou fila administrativa. AES-256-GCM usa nonce aleatório e detecta adulteração/chave errada. `BACKUP_KEY` deve ser uma chave aleatória de 32 bytes em base64, guardada em cofre separado; não imprimir ou enviar no chat. Perder a chave impede recuperação.

Exportação exige `BACKUP_EXPORT_CONFIRMED=yes`, credencial administrativa via Application Default Credentials e caminho `.budbackup` **fora do repositório**. Não sobrescreve arquivo existente e não grava JSON em claro. Usar armazenamento com acesso restrito e criptografia de disco; a flag de permissão de arquivo não substitui ACL no Windows. Não exportar conta em exclusão.

Comandos do operador, somente após autorização para os dados envolvidos:

```
node scripts/financial-recovery.cjs export CAMINHO_FORA_DO_REPOSITORIO.budbackup UID
node scripts/financial-recovery.cjs verify CAMINHO_FORA_DO_REPOSITORIO.budbackup UID
node scripts/financial-recovery.cjs restore-demo CAMINHO_FORA_DO_REPOSITORIO.budbackup UID
```

Restauração bloqueada fora de `demo-bud-security` no Firestore local `127.0.0.1:18080`, exige destino vazio e mesmo UID. Valida todos os caminhos/valores antes de escrever. Falha parcial no emulador exige novo destino vazio; não sobrescreve silenciosamente. O perfil restaurado é fictício/Gratuito, sem Auth ou privilégios. Nenhum comando desse utilitário restaura em produção.

Limites: exportação por páginas não é um snapshot transacional da base inteira; usar uma janela sem gravações para recuperação financeira consistente. Não é backup automático do sistema e não substitui backup gerenciado do Firestore, Auth, configuração ou armazenamento externo.

## Recuperação completa da infraestrutura — ativação pendente

Backups gerenciados do Firestore exigem Blaze e cobram armazenamento/restauração. Não ativados nem contratados nesta entrega. Proposta operacional: cópia diária, retenção curta de sete dias, acesso restrito e ensaio periódico em banco isolado. Antes de ativar, confirmar custos, política de retenção/exclusão e autorização do titular. Ver [documentação oficial de backup/restauração](https://firebase.google.com/docs/firestore/backups).

Após autorização, consultar primeiro os agendamentos existentes para não criar duplicatas:

```
firebase firestore:backups:schedules:list --database "(default)" --project bud-finance
firebase firestore:backups:schedules:create --database "(default)" --recurrence DAILY --retention 7d --project bud-finance
```

Conferir a criação e a conclusão do primeiro backup no console. Restaurar primeiro em um **novo banco isolado**, nunca sobre a base ativa; conferir integridade, regras, índices, contas excluídas, cotas, referências e reconciliação de pagamentos antes de qualquer promoção. Backup do Firestore não recupera usuários Auth, segredos ou políticas TTL; manter configuração versionada e segredos no cofre, sem exportar senhas neste projeto. Não reativar contas excluídas ou assinaturas/cobranças a partir de um snapshot antigo. Uma eventual restauração produtiva é outra operação autorizada e deve ter plano de reversão.

## Evidências

- 179 testes de release: aprovados.
- 8 cenários reais em Auth/Firestore emulados: aprovados. Isolamento entre contas, bloqueio de privilégios/filas privadas, quotas concorrentes, exclusão, rate limit persistente, API, uploads, revogação imediata e recuperação criptografada sem sobrescrita.
- Pacote público: 104 arquivos; manifest validado e varredura de credenciais aprovada.
- Sem pentest externo, certificação, garantia de invulnerabilidade ou entrega física de novo push.

## Implantação coordenada

Revisar diff combinado, integrar pelo GitHub e implantar backend, frontend e regras compatíveis com a entrega de planos; publicar também o novo índice da fila e esperar disponibilidade. Não publicar regras financeiras sozinhas. Confirmar revisão do backend e página pública, conta administrativa, permissão push e processamento de evento autorizado. App Check, WAF, revisão especializada e backups gerenciados ainda são frentes de infraestrutura; não afirmar que estão ativos.
Titular autorizou publicar a candidata Finance segregada; Gestor permanece arquivado.175 testes repetidos com sucesso, pacote104arquivos e scanner aprovados, master remoto confirmado8fc3ade sem avanço. Firebase autenticado acessível. Deploy deve aguardar revisão do backend antes de publicar frontend; regras somente depois de ambos. Não operar dados/envios/cobranças reais para testar. Pendências do admin legado continuam fora do escopo.

## Publicação concluída — Finance segregado (09/11/2026)
RESOLVIDO E PUBLICADO: PR54 integrado em e6a8a1723c1b6a184f816b028be412365f43666d. CI41928973998 aprovado; deploy42719259070 aprovado, incluindo175 testes e verificação do pacote público. Gate confirmou backend na mesma revisão antes de publicar Pages. Ping público confirmou e6a8a172; financial-firestore.js respondeu200 com endpoint financeiro. Firebase CLI compilou/publicou regras e índices no projeto bud-finance após confirmação de frontend/backend. Configurações pública200 com versão20261104 e sem redirecionamento Gestor.
Escopo: planos/cotas/trial72h, desistência pendente distinta de cancelamento, sessão/segurança/recuperação. Gestor continua arquivado fora dos serviços ativos; admin legado preservado e suas pendências permanecem. Não houve cobrança, cancelamento, exclusão, envio real ou backup de dados de clientes para testar. Validação funcional autenticada em dispositivos reais não foi repetida nesta publicação; não declarar pentest integral nem entrega física de push. Próximo: correções de admin legado quando solicitado; Gestor após concluir Finance.
