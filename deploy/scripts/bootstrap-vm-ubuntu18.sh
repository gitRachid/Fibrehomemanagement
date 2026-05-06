#!/usr/bin/env bash
set -euo pipefail

# Full bootstrap for Ubuntu 18.04 VM
# - Install Docker/Compose
# - Clone repository
# - Prepare deployment files
# - Start stack
#
# Usage example:
# sudo bash bootstrap-vm-ubuntu18.sh \
#   --repo-url git@github.com:your-org/fiberhomemanage.git \
#   --domain api.your-domain.com \
#   --install-dir /opt/fiber

REPO_URL=""
DOMAIN=""
INSTALL_DIR="/opt/fiber"
BRANCH="main"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-url)
      REPO_URL="$2"
      shift 2
      ;;
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    *)
      echo "[error] Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "[error] Run as root: sudo bash bootstrap-vm-ubuntu18.sh ..."
  exit 1
fi

if [ -z "${REPO_URL}" ]; then
  echo "[error] --repo-url is required"
  exit 1
fi

if [ -z "${DOMAIN}" ]; then
  echo "[error] --domain is required"
  exit 1
fi

echo "[1/8] Installing base packages"
apt-get update
apt-get install -y git curl ca-certificates lsb-release

echo "[2/8] Installing Docker stack"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/install-docker-ubuntu18.sh"

echo "[3/8] Cloning repository"
if [ -d "${INSTALL_DIR}/.git" ]; then
  echo "[info] Repo already exists in ${INSTALL_DIR}, pulling latest ${BRANCH}"
  cd "${INSTALL_DIR}"
  git fetch --all
  git checkout "${BRANCH}"
  git pull origin "${BRANCH}"
else
  mkdir -p "$(dirname "${INSTALL_DIR}")"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${INSTALL_DIR}"
fi

echo "[4/8] Preparing env files"
cd "${INSTALL_DIR}/deploy"
mkdir -p env nginx/certs
[ -f env/api.env ] || cp env/api.env.example env/api.env
[ -f env/minio.env ] || cp env/minio.env.example env/minio.env

echo "[5/8] Updating api.env with domain defaults"
sed -i "s|^PUBLIC_API_BASE_URL=.*|PUBLIC_API_BASE_URL=https://${DOMAIN}|g" env/api.env
sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=https://${DOMAIN}|g" env/api.env

if grep -q "replace_with_strong_random_secret" env/api.env; then
  JWT_SECRET="$(head -c 48 /dev/urandom | base64 | tr -d '\n' | cut -c1-64)"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|g" env/api.env
  echo "[info] JWT_SECRET generated automatically."
fi

if grep -q "replace_with_strong_password" env/minio.env; then
  MINIO_PASSWORD="$(head -c 36 /dev/urandom | base64 | tr -d '\n' | cut -c1-40)"
  sed -i "s|^MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}|g" env/minio.env
  echo "[info] MINIO_ROOT_PASSWORD generated automatically."
fi

if grep -q "replace_me" env/api.env; then
  S3_SECRET="$(head -c 36 /dev/urandom | base64 | tr -d '\n' | cut -c1-40)"
  sed -i "s|^S3_SECRET_KEY=.*|S3_SECRET_KEY=${S3_SECRET}|g" env/api.env
  echo "[info] S3_SECRET_KEY generated automatically."
fi

echo "[6/8] Starting containers"
docker compose -f docker-compose.prod.yml --env-file env/api.env up -d --build || \
docker-compose -f docker-compose.prod.yml --env-file env/api.env up -d --build

echo "[7/8] Initializing MongoDB replica set"
set +e
docker exec fiber-mongodb mongosh --eval "rs.status()" >/dev/null 2>&1
HAS_RS=$?
set -e
if [ "${HAS_RS}" -ne 0 ]; then
  docker exec fiber-mongodb mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'mongodb:27017'}]})"
else
  echo "[info] Replica set already initialized."
fi

echo "[8/8] Final checks"
docker compose -f docker-compose.prod.yml ps || docker-compose -f docker-compose.prod.yml ps
echo "[success] Bootstrap finished."
echo "[next] Place TLS certs in ${INSTALL_DIR}/deploy/nginx/certs and restart nginx service:"
echo "       docker compose -f ${INSTALL_DIR}/deploy/docker-compose.prod.yml restart nginx"
