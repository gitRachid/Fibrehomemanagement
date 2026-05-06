#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <backup-folder>"
  exit 1
fi

SRC="$1"

if [ ! -d "${SRC}" ]; then
  echo "Backup folder not found: ${SRC}"
  exit 1
fi

if [ ! -f "${SRC}/mongo.archive.gz" ]; then
  echo "Missing file: ${SRC}/mongo.archive.gz"
  exit 1
fi

echo "[restore] restoring mongodb"
docker cp "${SRC}/mongo.archive.gz" fiber-mongodb:/tmp/mongo.archive.gz
docker exec fiber-mongodb mongorestore --drop --archive="/tmp/mongo.archive.gz" --gzip
docker exec fiber-mongodb rm -f /tmp/mongo.archive.gz

if [ -d "${SRC}/minio-fiber-media" ]; then
  echo "[restore] restoring minio bucket"
  docker run --rm \
    --network host \
    -e MC_HOST_minio="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@127.0.0.1:9000" \
    -v "${SRC}:/backup" \
    minio/mc:latest \
    sh -c "mc mirror --overwrite /backup/minio-fiber-media minio/fiber-media"
fi

echo "[restore] done"
