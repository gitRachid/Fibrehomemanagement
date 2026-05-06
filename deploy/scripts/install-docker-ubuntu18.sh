#!/usr/bin/env bash
set -euo pipefail

# Docker setup script for Ubuntu 18.04.x
# Usage:
#   chmod +x install-docker-ubuntu18.sh
#   ./install-docker-ubuntu18.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "[error] Run this script as root (sudo)."
  exit 1
fi

if ! command -v lsb_release >/dev/null 2>&1; then
  apt-get update
  apt-get install -y lsb-release
fi

DISTRO="$(lsb_release -is || true)"
RELEASE="$(lsb_release -rs || true)"

if [ "${DISTRO}" != "Ubuntu" ] || [[ "${RELEASE}" != 18.04* ]]; then
  echo "[warn] This script is intended for Ubuntu 18.04.x. Detected: ${DISTRO} ${RELEASE}"
  echo "[warn] Continuing anyway."
fi

echo "[step] Removing old Docker packages (if present)"
apt-get remove -y docker docker-engine docker.io containerd runc || true

echo "[step] Installing prerequisites"
apt-get update
apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  apt-transport-https \
  software-properties-common

echo "[step] Adding Docker GPG key"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "[step] Adding Docker repository"
ARCH="$(dpkg --print-architecture)"
CODENAME="$(lsb_release -cs)"
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

echo "[step] Installing Docker Engine and Compose plugin"
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin || true

if ! command -v docker >/dev/null 2>&1; then
  echo "[error] Docker installation failed."
  exit 1
fi

echo "[step] Enabling Docker service"
systemctl enable docker
systemctl restart docker

TARGET_USER="${SUDO_USER:-}"
if [ -n "${TARGET_USER}" ] && id -u "${TARGET_USER}" >/dev/null 2>&1; then
  echo "[step] Adding user '${TARGET_USER}' to docker group"
  usermod -aG docker "${TARGET_USER}" || true
  echo "[info] User '${TARGET_USER}' may need to log out and log back in."
fi

echo "[step] Verifying installation"
docker --version

if docker compose version >/dev/null 2>&1; then
  echo "[ok] docker compose is available"
  docker compose version
else
  echo "[warn] docker compose plugin not available, installing docker-compose binary fallback"
  COMPOSE_VERSION="v2.27.0"
  curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
    -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
  docker-compose --version
fi

echo "[step] Running hello-world container"
docker run --rm hello-world >/dev/null

echo "[success] Docker environment is ready on Ubuntu 18.04."
