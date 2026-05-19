#!/usr/bin/env bash
set -euo pipefail

# Redéploie la stack sur la VM (après git pull)
# Usage: bash deploy-vm.sh

INSTALL_DIR="${INSTALL_DIR:-/opt/fiber}"
cd "${INSTALL_DIR}/deploy"

docker compose -f docker-compose.prod.yml --env-file env/api.env up -d --build \
  || docker-compose -f docker-compose.prod.yml --env-file env/api.env up -d --build

docker compose -f docker-compose.prod.yml ps || docker-compose -f docker-compose.prod.yml ps
echo "[success] Déploiement terminé."
