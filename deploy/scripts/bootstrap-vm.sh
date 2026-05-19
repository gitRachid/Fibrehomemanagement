#!/usr/bin/env bash
set -euo pipefail

# Bootstrap VM Linux (Ubuntu 20.04+) — Docker + clone + stack prod
#
# sudo bash bootstrap-vm.sh \
#   --repo-url git@github.com:org/fiberhomemanage.git \
#   --public-url http://94.177.204.65 \
#   --install-dir /opt/fiber \
#   --branch main

REPO_URL=""
PUBLIC_URL=""
INSTALL_DIR="/opt/fiber"
BRANCH="main"
CORS_ORIGIN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-url) REPO_URL="$2"; shift 2 ;;
    --public-url) PUBLIC_URL="$2"; shift 2 ;;
    --domain) PUBLIC_URL="https://$2"; shift 2 ;;
    --install-dir) INSTALL_DIR="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --cors-origin) CORS_ORIGIN="$2"; shift 2 ;;
    *)
      echo "[error] Argument inconnu: $1"
      exit 1
      ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "[error] sudo bash bootstrap-vm.sh ..."
  exit 1
fi

if [ -z "${REPO_URL}" ] || [ -z "${PUBLIC_URL}" ]; then
  echo "[error] --repo-url et --public-url (ou --domain) sont obligatoires"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORS_ORIGIN="${CORS_ORIGIN:-${PUBLIC_URL}}"

echo "[1/7] Installation Docker"
bash "${SCRIPT_DIR}/install-docker.sh"

echo "[2/7] Clone / mise à jour du dépôt"
apt-get install -y git
if [ -d "${INSTALL_DIR}/.git" ]; then
  cd "${INSTALL_DIR}"
  git fetch --all
  git checkout "${BRANCH}"
  git pull origin "${BRANCH}"
else
  mkdir -p "$(dirname "${INSTALL_DIR}")"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${INSTALL_DIR}"
fi

echo "[3/7] Fichiers d'environnement"
cd "${INSTALL_DIR}/deploy"
mkdir -p env nginx/certs
[ -f env/api.env ] || cp env/api.env.example env/api.env
[ -f env/minio.env ] || cp env/minio.env.example env/minio.env

sed -i "s|^PUBLIC_API_BASE_URL=.*|PUBLIC_API_BASE_URL=${PUBLIC_URL}|g" env/api.env
sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=${CORS_ORIGIN}|g" env/api.env

if grep -q "replace_with_strong_random_secret" env/api.env; then
  JWT_SECRET="$(head -c 48 /dev/urandom | base64 | tr -d '\n' | cut -c1-64)"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|g" env/api.env
fi
if grep -q "replace_with_strong_password" env/minio.env; then
  MINIO_PASSWORD="$(head -c 36 /dev/urandom | base64 | tr -d '\n' | cut -c1-40)"
  sed -i "s|^MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}|g" env/minio.env
  sed -i "s|^S3_SECRET_KEY=.*|S3_SECRET_KEY=${MINIO_PASSWORD}|g" env/api.env
fi
if grep -q "replace_me" env/api.env; then
  S3_SECRET="$(head -c 36 /dev/urandom | base64 | tr -d '\n' | cut -c1-40)"
  sed -i "s|^S3_SECRET_KEY=.*|S3_SECRET_KEY=${S3_SECRET}|g" env/api.env
fi

echo "[4/7] Pare-feu (UFW) — ports 22, 80, 443"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  ufw --force enable || true
fi

echo "[5/7] Démarrage des conteneurs"
docker compose -f docker-compose.prod.yml --env-file env/api.env up -d --build \
  || docker-compose -f docker-compose.prod.yml --env-file env/api.env up -d --build

echo "[6/7] Attente santé API"
for i in $(seq 1 30); do
  if docker exec fiber-api wget -qO- "http://127.0.0.1:8084/api/health" >/dev/null 2>&1; then
    echo "[ok] API healthy"
    break
  fi
  sleep 3
done

echo "[7/7] État des services"
docker compose -f docker-compose.prod.yml ps || docker-compose -f docker-compose.prod.yml ps

echo ""
echo "[success] VM prête."
echo "  API (via nginx) : ${PUBLIC_URL}/api/health"
BASE_URL="${PUBLIC_URL%/}"
echo "  App mobile      : EXPO_PUBLIC_API_URL=${BASE_URL}/api"
echo "  Logs API        : docker logs -f fiber-api"
echo "  Mise à jour     : bash ${SCRIPT_DIR}/deploy-vm.sh"
