#!/usr/bin/env sh
# Configuração pública com escape JSON e normalização de variáveis.
set -eu
exec node scripts/inject-config.js
