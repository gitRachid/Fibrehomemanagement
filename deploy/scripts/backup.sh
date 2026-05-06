#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/fiber/backups}"
DATE="$(date +%F-%H%M%S)"
DEST="${BACKUP_DIR}/${DATE}"

mkdir -p "${DEST}"

echo "[backup] creating backup at ${DEST}"

docker exec fiber-mongodb mongodump --archive="/tmp/mongo.archive" --gzip
docker cp fiber-mongodb:/tmp/mongo.archive "${DEST}/mongo.archive.gz"
docker exec fiber-mongodb rm -f /tmp/mongo.archive

docker run --rm \
  --network host \
  -e MC_HOST_minio="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@127.0.0.1:9000" \
  -v "${DEST}:/backup" \
  minio/mc:latest \
  sh -c "mc mirror --overwrite minio/fiber-media /backup/minio-fiber-media"

echo "[backup] done"
