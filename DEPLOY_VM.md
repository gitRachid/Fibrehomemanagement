# FiberHomeManage VM Deployment Guide

This guide deploys the backend stack on a Linux VM using Docker Compose.

For a full one-command setup on Ubuntu 18.04, use:
- `deploy/scripts/bootstrap-vm-ubuntu18.sh`
- Detailed walkthrough: `BOOTSTRAP_VM_STEP_BY_STEP.md`

## 1) VM prerequisites

- Ubuntu 22.04+ (recommended for production)
- Ubuntu 18.04.1 LTS is supported in compatibility mode, but it is end-of-life and should be upgraded
- Domain name pointing to VM public IP
- Open ports: `22`, `80`, `443`
- Docker Engine installed
- Docker Compose available (`docker compose` preferred, `docker-compose` accepted on older systems)

## Ubuntu 18.04 compatibility notes

- If `docker compose` is not available, use `docker-compose` in all commands.
- If your host cannot run modern Docker packages cleanly, upgrade the VM to Ubuntu 22.04 before go-live.
- Security updates for 18.04 are limited; do not keep this OS for long-term production.

## 2) Clone and prepare

```bash
git clone <your-repository-url> /opt/fiber
cd /opt/fiber/deploy
mkdir -p nginx/certs env
cp env/api.env.example env/api.env
cp env/minio.env.example env/minio.env
```

Update `env/api.env` and set secure values:
- `JWT_SECRET`
- `MONGODB_URI`
- `CORS_ORIGIN`
- `PUBLIC_API_BASE_URL`
- `S3_*`

## 3) TLS certificates

Place your cert files here:
- `deploy/nginx/certs/fullchain.pem`
- `deploy/nginx/certs/privkey.pem`

If you use Let's Encrypt, renew and copy/symlink these files automatically.

## 4) Start services

```bash
cd /opt/fiber/deploy
docker compose -f docker-compose.prod.yml --env-file env/api.env up -d --build || \
docker-compose -f docker-compose.prod.yml --env-file env/api.env up -d --build
```

Initialize Mongo replica set once (required by current compose):

```bash
docker exec -it fiber-mongodb mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'mongodb:27017'}]})"
```

## 5) Validate

```bash
curl -k https://<your-domain>/health
docker compose -f docker-compose.prod.yml ps || docker-compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api || docker-compose -f docker-compose.prod.yml logs -f api
```

## 6) Update deployment

```bash
cd /opt/fiber
git pull
cd deploy
docker compose -f docker-compose.prod.yml --env-file env/api.env up -d --build || \
docker-compose -f docker-compose.prod.yml --env-file env/api.env up -d --build
```

## 8) Recommended upgrade path (important)

- Short term: deploy on Ubuntu 18.04.1 only for pilot/testing.
- Before production: migrate VM to Ubuntu 22.04 LTS.
- After migration: keep same project files and rerun compose commands.

## 7) Hardening checklist

- Disable password auth for SSH
- Restrict SSH by source IP
- Enable automatic security updates
- Configure daily backups + offsite copy
- Add monitoring and alerting
