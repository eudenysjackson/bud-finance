# Bud Gestor — preparação adiada

Separado em04/11/2026 por solicitação do titular. Não publicar ou carregar estes arquivos pelo Finance.

A pasta snapshot preserva22arquivos da candidata anterior. manifest.json contém SHA-256 e distingue arquivos exclusivos de arquivos compartilhados. Os compartilhados incluem alterações de Finance já existentes: NÃO copiá-los inteiros sobre uma versão futura. Comparar com a candidata Finance e reaplicar somente a integração do Gestor por branch/PR própria.

Escopo futuro: login Firebase nomeado bud-gestor, Web App distinto para evitar colisão FCM, URL /budgestor/, worker/manifest isolados, dispositivos _gestor_devices, eventos privados e leitura administrativa. Destinatário escolhido: conta corporativa budsolucoes@gmail.com com papel admin e e-mail verificado. Não usar tokens do Finance como fallback.

O Web App Firebase bud-gestor já foi registrado (appId público no config.js), mas site, backend, índices e regras não foram implantados por esta entrega. Não apagar o cadastro Firebase para separar código. Nenhuma conta real, cobrança ou envio foi operado.

Retomada: ler AI_WORKFLOW.md e AI_HANDOFF.md atuais; integrar os arquivos exclusivos no local correto e revisar diffs dos compartilhados. Revalidar autorizações, isolamento Auth/FCM, referências, e-mails, índice, limpeza de dados e logout. Os testes arquivados dependem das posições originais: não fazem parte da suíte Finance. Só depois preparar implantação e validação real autorizada.
