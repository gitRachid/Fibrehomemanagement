# Serveur VM Docker — Fiber Home Manage

Guide pour déployer le **backend** (API + MongoDB + Redis + MinIO + Nginx) sur une VM Linux avec Docker.

## Prérequis VM

| Élément | Détail |
|---------|--------|
| OS | Ubuntu **22.04 LTS** (recommandé) ou 20.04 |
| RAM | 2 Go minimum, 4 Go conseillé |
| Disque | 20 Go+ |
| Ports ouverts | `22` (SSH), `80` (HTTP), `443` (HTTPS optionnel) |
| Accès | SSH + dépôt Git (clé ou token) |

> MinIO (9000/9001) reste **interne** au réseau Docker en prod — ne pas l’exposer sur Internet.

---

## Option A — Bootstrap automatique (recommandé)

Sur la VM, en root :

```bash
git clone <votre-repo> /opt/fiber
cd /opt/fiber/deploy/scripts
chmod +x install-docker.sh bootstrap-vm.sh deploy-vm.sh

sudo bash bootstrap-vm.sh \
  --repo-url <votre_repo_git> \
  --public-url http://94.177.204.65 \
  --install-dir /opt/fiber \
  --branch main \
  --cors-origin "*"
```

- `--public-url` : URL utilisée par l’app mobile (`EXPO_PUBLIC_API_URL=<url>/api`)
- `--cors-origin` : origines autorisées (ou `*` en test)

Vérification :

```bash
curl http://94.177.204.65/health
curl http://94.177.204.65/api/health
```

---

## Option B — Installation manuelle

```bash
# 1. Docker
sudo bash /opt/fiber/deploy/scripts/install-docker.sh

# 2. Variables
cd /opt/fiber/deploy
cp env/api.env.example env/api.env
cp env/minio.env.example env/minio.env
nano env/api.env   # JWT_SECRET, PUBLIC_API_BASE_URL, CORS_ORIGIN, MONGODB_URI

# 3. Lancer la stack
docker compose -f docker-compose.prod.yml --env-file env/api.env up -d --build
```

Le replica set MongoDB est initialisé automatiquement (`mongo-init`).

---

## App mobile (Expo)

Sur la machine de build ou dans `.env` :

```bash
EXPO_PUBLIC_API_URL=http://94.177.204.65/api
```

Rebuild APK si l’URL a changé.

---

## HTTPS (Let's Encrypt)

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d api.votredomaine.ma

sudo cp /etc/letsencrypt/live/api.votredomaine.ma/fullchain.pem /opt/fiber/deploy/nginx/certs/
sudo cp /etc/letsencrypt/live/api.votredomaine.ma/privkey.pem /opt/fiber/deploy/nginx/certs/

cd /opt/fiber/deploy/nginx/conf.d
sudo cp app-ssl.conf.example app-ssl.conf
# Désactiver ou renommer app.conf si conflit de port 80

docker compose -f docker-compose.prod.yml restart nginx
```

Mettre à jour `PUBLIC_API_BASE_URL` et `CORS_ORIGIN` en `https://...`.

---

## Commandes utiles

```bash
cd /opt/fiber/deploy

# État
docker compose -f docker-compose.prod.yml ps

# Logs API
docker logs -f fiber-api

# Redéploiement après git pull
cd /opt/fiber && git pull
bash deploy/scripts/deploy-vm.sh

# Backup (voir deploy/scripts/backup.sh)
export MINIO_ROOT_USER=...
export MINIO_ROOT_PASSWORD=...
./deploy/scripts/backup.sh
```

---

## Architecture

```
Internet → VM:80/443 (nginx) → api:8084
                ├── mongodb (réseau interne)
                ├── redis
                └── minio
```

---

## Dépannage

### 502 Bad Gateway

```bash
docker logs fiber-api --tail 80
docker logs fiber-mongo-init
docker ps -a | grep fiber
```

Souvent : `Database connection failed` → MongoDB / replica set.

```bash
# Vérifier api.env : MONGODB_URI=mongodb://mongodb:27017/fiberhomemanage?replicaSet=rs0
docker exec fiber-mongodb mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'mongodb:27017'}]})"
docker compose -f docker-compose.prod.yml restart api
sleep 5
curl http://localhost/api/health
```

| Problème | Action |
|----------|--------|
| `curl /health` échoue | `docker logs fiber-nginx` et `docker logs fiber-api` |
| MongoDB | `docker logs fiber-mongo-init` puis `docker logs fiber-mongodb` |
| CORS app | Vérifier `CORS_ORIGIN` dans `env/api.env` |
| `git pull` déjà à jour | Faire `git push` sur le PC puis `git pull` sur la VM |

Voir aussi : `DEPLOY_VM.md`, `DOCKER.md`, `BOOTSTRAP_VM_STEP_BY_STEP.md` (Ubuntu 18.04).
