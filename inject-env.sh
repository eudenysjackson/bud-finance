#!/usr/bin/env sh
# inject-env.sh — Bud Finance
# Substitui placeholders no firebase-config.js pelas variáveis de ambiente do CI/CD.
# Executado automaticamente pelo comando: npm run build
#
# Variáveis de ambiente necessárias:
#   FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
#   FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID,
#   BACKEND_URL, EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID,
#   EMAILJS_TEMPLATE_BOAS_VINDAS, EMAILJS_TEMPLATE_RECUPERAR_SENHA,
#   RECAPTCHA_SITE_KEY (opcional)

set -e

TARGET="appbudfinance/js/firebase-config.js"
EXAMPLE="appbudfinance/js/firebase-config.example.js"

# Em CI/CD o firebase-config.js não existe (está no .gitignore).
# Copia o template como ponto de partida.
if [ ! -f "$TARGET" ]; then
  echo "→ $TARGET não encontrado. Copiando do template..."
  cp "$EXAMPLE" "$TARGET"
fi

# Verifica se as variáveis obrigatórias estão definidas
MISSING=""
for VAR in FIREBASE_API_KEY FIREBASE_AUTH_DOMAIN FIREBASE_PROJECT_ID \
           FIREBASE_STORAGE_BUCKET FIREBASE_MESSAGING_SENDER_ID FIREBASE_APP_ID \
           BACKEND_URL EMAILJS_PUBLIC_KEY EMAILJS_SERVICE_ID \
           EMAILJS_TEMPLATE_BOAS_VINDAS EMAILJS_TEMPLATE_RECUPERAR_SENHA; do
  eval "VAL=\$$VAR"
  if [ -z "$VAL" ]; then
    MISSING="$MISSING $VAR"
  fi
done

if [ -n "$MISSING" ]; then
  echo "ERRO: Variáveis de ambiente não definidas:$MISSING"
  exit 1
fi

# Substitui os placeholders (compatível com Linux/CI; no macOS use sed -i '')
sed -i "s|__FIREBASE_API_KEY__|${FIREBASE_API_KEY}|g"                       "$TARGET"
sed -i "s|__FIREBASE_AUTH_DOMAIN__|${FIREBASE_AUTH_DOMAIN}|g"               "$TARGET"
sed -i "s|__FIREBASE_PROJECT_ID__|${FIREBASE_PROJECT_ID}|g"                 "$TARGET"
sed -i "s|__FIREBASE_STORAGE_BUCKET__|${FIREBASE_STORAGE_BUCKET}|g"         "$TARGET"
sed -i "s|__FIREBASE_MESSAGING_SENDER_ID__|${FIREBASE_MESSAGING_SENDER_ID}|g" "$TARGET"
sed -i "s|__FIREBASE_APP_ID__|${FIREBASE_APP_ID}|g"                         "$TARGET"
sed -i "s|__BACKEND_URL__|${BACKEND_URL}|g"                                  "$TARGET"
sed -i "s|__EMAILJS_PUBLIC_KEY__|${EMAILJS_PUBLIC_KEY}|g"                    "$TARGET"
sed -i "s|__EMAILJS_SERVICE_ID__|${EMAILJS_SERVICE_ID}|g"                    "$TARGET"
sed -i "s|__EMAILJS_TEMPLATE_BOAS_VINDAS__|${EMAILJS_TEMPLATE_BOAS_VINDAS}|g" "$TARGET"
sed -i "s|__EMAILJS_TEMPLATE_RECUPERAR_SENHA__|${EMAILJS_TEMPLATE_RECUPERAR_SENHA}|g" "$TARGET"

# RECAPTCHA_SITE_KEY é opcional
if [ -n "$RECAPTCHA_SITE_KEY" ]; then
  sed -i "s|__RECAPTCHA_SITE_KEY__|${RECAPTCHA_SITE_KEY}|g" "$TARGET"
fi

echo "✓ inject-env.sh: placeholders substituídos em $TARGET"
