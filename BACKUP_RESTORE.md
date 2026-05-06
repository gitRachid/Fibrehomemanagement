# Backup and Restore Runbook

## Backup scope

- MongoDB data (all collections)
- MinIO bucket (`fiber-media`)

## Required environment variables

Before running scripts:

```bash
export MINIO_ROOT_USER="<minio-user>"
export MINIO_ROOT_PASSWORD="<minio-password>"
export BACKUP_DIR="/opt/fiber/backups"
```

## Create backup

```bash
cd /opt/fiber/deploy/scripts
chmod +x backup.sh restore.sh
./backup.sh
```

Expected output path:
- `/opt/fiber/backups/<yyyy-mm-dd-hhmmss>/mongo.archive.gz`
- `/opt/fiber/backups/<yyyy-mm-dd-hhmmss>/minio-fiber-media/`

## Restore backup

```bash
cd /opt/fiber/deploy/scripts
./restore.sh /opt/fiber/backups/<yyyy-mm-dd-hhmmss>
```

## Backup policy recommendation

- Daily incremental + weekly full
- Keep 30 daily + 12 monthly snapshots
- Store encrypted copy in external storage
- Test restore at least once per month
