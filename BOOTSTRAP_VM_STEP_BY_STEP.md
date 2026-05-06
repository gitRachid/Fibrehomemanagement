# Bootstrap VM Ubuntu 18.04 - Guide pas a pas

Ce guide vous permet de deployer rapidement l'application sur une VM Ubuntu 18.04.1 LTS.

## 0) Prerequis

- VM Ubuntu 18.04.1 accessible en SSH
- Nom de domaine pointe vers l'IP de la VM
- Ports ouverts: `22`, `80`, `443`
- Depot Git accessible depuis la VM (SSH key ou token)

## 1) Se connecter en SSH

```bash
ssh <user>@<vm-ip>
```

## 2) Recuperer le script bootstrap

Si votre code est deja sur la VM:

```bash
cd /opt/fiber/deploy/scripts
chmod +x bootstrap-vm-ubuntu18.sh install-docker-ubuntu18.sh
```

Sinon, clonez d'abord le repo:

```bash
sudo mkdir -p /opt
sudo chown $USER:$USER /opt
git clone <votre_repo_git> /opt/fiber
cd /opt/fiber/deploy/scripts
chmod +x bootstrap-vm-ubuntu18.sh install-docker-ubuntu18.sh
```

## 3) Lancer le bootstrap complet

```bash
sudo bash /opt/fiber/deploy/scripts/bootstrap-vm-ubuntu18.sh \
  --repo-url <votre_repo_git> \
  --domain <votre_domaine_api> \
  --install-dir /opt/fiber \
  --branch main
```

Exemple:

```bash
sudo bash /opt/fiber/deploy/scripts/bootstrap-vm-ubuntu18.sh \
  --repo-url git@github.com:my-org/fiberhomemanage.git \
  --domain api.fiber.ma \
  --install-dir /opt/fiber \
  --branch main
```

## 4) Ajouter les certificats SSL

Copiez vos certificats ici:

- `/opt/fiber/deploy/nginx/certs/fullchain.pem`
- `/opt/fiber/deploy/nginx/certs/privkey.pem`

Puis redemarrer nginx:

```bash
cd /opt/fiber/deploy
docker compose -f docker-compose.prod.yml restart nginx || docker-compose -f docker-compose.prod.yml restart nginx
```

## 5) Verifier l'etat des services

```bash
cd /opt/fiber/deploy
docker compose -f docker-compose.prod.yml ps || docker-compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api || docker-compose -f docker-compose.prod.yml logs -f api
```

Test API:

```bash
curl -k https://<votre_domaine_api>/health
```

## 6) Configurer le backup

```bash
cd /opt/fiber/deploy/scripts
chmod +x backup.sh restore.sh
export MINIO_ROOT_USER="<minio-user>"
export MINIO_ROOT_PASSWORD="<minio-password>"
export BACKUP_DIR="/opt/fiber/backups"
./backup.sh
```

## 7) Mise a jour application

```bash
cd /opt/fiber
git pull origin main
cd deploy
docker compose -f docker-compose.prod.yml --env-file env/api.env up -d --build || \
docker-compose -f docker-compose.prod.yml --env-file env/api.env up -d --build
```

## 8) Depannage rapide

- Si `docker compose` n'existe pas, utilisez `docker-compose`.
- Si l'API ne repond pas, verifier:
  - `env/api.env` (variables critiques)
  - certificats SSL presents
  - logs `api` et `nginx`
- Si MongoDB bloque, relancer l'init replica set:

```bash
docker exec -it fiber-mongodb mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'mongodb:27017'}]})"
```
