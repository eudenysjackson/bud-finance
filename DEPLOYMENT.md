# Publicação do Bud Finance

## Antes de publicar

1. No Render, configure `ADMIN_INVITE_CODE` com um valor longo e exclusivo.
   Esse código cria administradores pelo backend e não deve ser salvo no
   Firestore ou compartilhado em páginas públicas.
2. Confirme que `FIREBASE_SERVICE_ACCOUNT`, `MP_ACCESS_TOKEN`,
   `MP_WEBHOOK_SECRET` e `EMAIL_VERIFICATION_SECRET` já estão configurados no
   serviço de produção.
3. Faça login no Firebase CLI e publique as regras:

   ```powershell
   npx firebase login
   npm run deploy:firestore-rules -- --project bud-finance
   ```

4. Envie ao GitHub somente após revisar as alterações do diretório de trabalho.
   O GitHub Pages publicará a raiz institucional em `/` e a landing do produto
   em `/budfinance/`.

## Verificação pós-publicação

- `https://budsolucoes.com.br/` mostra a página institucional em construção.
- `https://budsolucoes.com.br/budfinance/` abre a página comercial.
- `https://budsolucoes.com.br/appbudfinance/` continua abrindo o aplicativo.
- Criar administrador exige o código configurado no Render.
- Uma importação de fatura exige sessão autenticada e respeita a cota do plano.
