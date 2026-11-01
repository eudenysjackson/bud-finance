# Correção de cadastro —01/11/2026

Cadastro criava Firebase Auth e tentava escrever status/bloqueado no perfil; as regras protegem esses campos e rejeitavam a gravação. A conta ficava sem perfil, o envio de verificação não era alcançado e repetir a tentativa retornava e-mail já cadastrado.

Removidos os campos protegidos, sem enfraquecer regras. E-mail já existente só retoma cadastro se a senha autenticar o titular e o perfil estiver ausente; nunca sobrescreve perfil existente. Falha no envio de verificação mantém a conta e mostra instrução persistente para reenviar pelo login, sem afirmar que o e-mail foi entregue.

Quatro regressões de cadastro adicionadas, junto das duas de renovação preparadas anteriormente.76 testes locais passaram. Cadastro.js versionado novamente para invalidar cache anterior.

Titular solicitou limpeza de todos os usuários para lançamento do zero. Inventário mínimo no projeto bud-finance:4 contas Auth,3 perfis,1 conta sem perfil e1 assinatura vinculada sem situação conhecida. Nenhuma conta excluída neste estágio. Exportação ampla foi rejeitada por conter hashes; alternativa usa apenas IDs e vínculo/status de assinatura, sem e-mails ou hashes. Cancelamento de eventual assinatura ativa depende de autorização específica solicitada ao titular. Configurações globais do produto não integram a limpeza de usuários.
