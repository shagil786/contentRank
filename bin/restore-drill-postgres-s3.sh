#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_BUCKET:?Set BACKUP_BUCKET to the private S3 backup bucket}"
: "${BACKUP_KEY:?Set BACKUP_KEY to the S3 object key to restore-test}"

postgres_container="${POSTGRES_CONTAINER:-backend-postgres-1}"
local_archive="/tmp/contentrank-restore-drill-$$.dump"
container_archive="/tmp/contentrank-restore-drill.dump"
check_db="restore_check_$(date +%s)"
created_db=0

cleanup() {
  if [[ "$created_db" == 1 ]]; then
    docker exec "$postgres_container" sh -c \
      "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -h 127.0.0.1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -v ON_ERROR_STOP=1 -c \"DROP DATABASE IF EXISTS ${check_db}\"" \
      >/dev/null 2>&1 || true
  fi
  docker exec "$postgres_container" rm -f "$container_archive" >/dev/null 2>&1 || true
  rm -f "$local_archive"
}
trap cleanup EXIT

aws s3 cp "s3://${BACKUP_BUCKET}/${BACKUP_KEY}" "$local_archive" --sse AES256
docker cp "$local_archive" "${postgres_container}:${container_archive}"

docker exec "$postgres_container" sh -c \
  "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -h 127.0.0.1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -v ON_ERROR_STOP=1 -c \"CREATE DATABASE ${check_db}\"" \
  >/dev/null
created_db=1

docker exec "$postgres_container" sh -c \
  "PGPASSWORD=\"\$POSTGRES_PASSWORD\" pg_restore -h 127.0.0.1 -U \"\$POSTGRES_USER\" -d ${check_db} --no-owner --no-privileges ${container_archive}"

table_count="$(docker exec "$postgres_container" sh -c \
  "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -h 127.0.0.1 -U \"\$POSTGRES_USER\" -d ${check_db} -Atc \"SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public'\"" \
  | tr -d '[:space:]')"
echo "Restore drill passed: ${table_count} public tables restored into temporary database ${check_db}."
