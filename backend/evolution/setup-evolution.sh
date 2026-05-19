#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-evolution.sh — Script de instalação da Evolution API no VPS
# Bud Finance — WhatsApp Bot
#
# USO:
#   1. Conecte no VPS via SSH: ssh root@IP_DO_SEU_VPS
#   2. Faça upload deste script: scp setup-evolution.sh root@IP:/tmp/
#   3. Execute: bash /tmp/setup-evolution.sh
#
# OU copie e cole os comandos um a um no terminal do VPS.
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ── CONFIGURAÇÃO — edite antes de rodar ───────────────────────────────────────
CHAVE="BUD_CHAVE_FORTE_AQUI"          # ← troque por uma senha forte (sem espaços)
BACKEND_URL="https://bud-finance-backend.onrender.com"
INSTANCIA="bud"
# ─────────────────────────────────────────────────────────────────────────────

echo "=== [1/5] Instalando Docker ==="
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "=== [2/5] Criando pasta do projeto ==="
mkdir -p /opt/evolution && cd /opt/evolution

echo "=== [3/5] Criando docker-compose.yml ==="
cat > docker-compose.yml << EOF
version: '3'
services:
  evolution-api:
    image: atendai/evolution-api:latest
    container_name: bud-evolution
    restart: always
    ports:
      - "8080:8080"
    volumes:
      - evolution_data:/evolution/instances
    environment:
      AUTHENTICATION_TYPE: apikey
      AUTHENTICATION_API_KEY: ${CHAVE}
      WEBHOOK_GLOBAL_URL: ${BACKEND_URL}/webhook/evolution
      WEBHOOK_GLOBAL_ENABLED: "true"
      WEBHOOK_EVENTS_MESSAGES_UPSERT: "true"
      WEBHOOK_EVENTS_MESSAGES_UPDATE: "false"
      WEBHOOK_EVENTS_CONNECTION_UPDATE: "false"
      WEBHOOK_EVENTS_QRCODE_UPDATED: "false"
      WEBHOOK_EVENTS_SEND_MESSAGE: "false"
      SERVER_TYPE: http
      SERVER_PORT: "8080"
      LOG_LEVEL: ERROR
      DEL_INSTANCE: "false"
volumes:
  evolution_data:
EOF

echo "=== [4/5] Subindo Evolution API ==="
docker compose up -d

echo "=== Aguardando 20 segundos para a API iniciar... ==="
sleep 20

echo "=== [5/5] Criando instância '${INSTANCIA}' ==="
curl -s -X POST http://localhost:8080/instance/create \
  -H "apikey: ${CHAVE}" \
  -H "Content-Type: application/json" \
  -d "{\"instanceName\":\"${INSTANCIA}\",\"qrcode\":true,\"integration\":\"WHATSAPP-BAILEYS\"}"

echo ""
echo "==================================================================="
echo "✅ Evolution API instalada e instância '${INSTANCIA}' criada!"
echo ""
echo "PRÓXIMO PASSO — Pegar o QR Code:"
echo "  curl http://localhost:8080/instance/connect/${INSTANCIA} \\"
echo "       -H \"apikey: ${CHAVE}\""
echo ""
echo "Acesse https://base64.guru/converter/decode/image"
echo "Cole o campo 'qrcode.base64' → vai aparecer o QR para escanear"
echo ""
echo "VARIÁVEIS PARA ADICIONAR NO RENDER:"
echo "  WA_EVOLUTION_URL    = http://$(curl -s ifconfig.me):8080"
echo "  WA_EVOLUTION_KEY    = ${CHAVE}"
echo "  WA_EVOLUTION_INSTANCE = ${INSTANCIA}"
echo "==================================================================="
