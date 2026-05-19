# Docker — Fiber Home Manage

## Développement local

À la racine du projet :

```bash
docker compose up -d --build
```

- **API** : http://localhost:8084/api/health  
- **MongoDB** : `mongodb://localhost:27017/fiberhomemanage`  
- **MinIO** : API `http://localhost:9000`, console `http://localhost:9001` (`minioadmin` / `minioadmin`)

Pour l’app mobile Expo, définir :

```bash
EXPO_PUBLIC_API_URL=http://<IP-LAN>:8084/api
```

Variables optionnelles : copier `deploy/env/api.dev.env.example` vers `deploy/env/api.dev.env`.

Arrêt :

```bash
docker compose down
```

## Production (VM / serveur)

Guide détaillé : **`SERVEUR_VM_DOCKER.md`**

Bootstrap rapide sur la VM :

```bash
sudo bash deploy/scripts/bootstrap-vm.sh \
  --repo-url <git-url> \
  --public-url http://<IP-VM> \
  --install-dir /opt/fiber
```

Manuel :

```bash
cd deploy
cp env/api.env.example env/api.env
cp env/minio.env.example env/minio.env
docker compose -f docker-compose.prod.yml --env-file env/api.env up -d --build
```

Nginx écoute sur **80** (et **443** si certificats + `app-ssl.conf`). Le replica set MongoDB est initialisé par le service `mongo-init`.

Voir aussi : `DEPLOY_VM.md`, `BOOTSTRAP_VM_STEP_BY_STEP.md`.
