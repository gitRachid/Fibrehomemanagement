#!/usr/bin/env bash
set -euo pipefail

# Installe Docker Engine + Compose plugin (Ubuntu 20.04 / 22.04 / 24.04)
# Usage: sudo bash install-docker.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "[error] Exécutez en root : sudo bash install-docker.sh"
  exit 1
fi

apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

apt-get update
apt-get install -y ca-certificates curl gnupg lsb-release

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

ARCH="$(dpkg --print-architecture)"
CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME:-$(lsb_release -cs)}")"
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl restart docker

TARGET_USER="${SUDO_USER:-}"
if [ -n "${TARGET_USER}" ] && id -u "${TARGET_USER}" >/dev/null 2>&1; then
  usermod -aG docker "${TARGET_USER}" || true
  echo "[info] L'utilisateur ${TARGET_USER} doit se reconnecter pour utiliser docker sans sudo."
fi

docker --version
docker compose version
docker run --rm hello-world >/dev/null
echo "[success] Docker est prêt."
