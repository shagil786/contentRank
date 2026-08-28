#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_BUCKET:?Set BACKUP_BUCKET to the private S3 backup bucket}"

postgres_container="${POSTGRES_CONTAINER:-backend-postgres-1}"
backup_root="${BACKUP_ROOT:-/var/backups/contentrank}"
retention_days="${LOCAL_RETENTION_DAYS:-3}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="${backup_root}/outrank-${timestamp}.dump"
checksum="${archive}.sha256"
manifest="${archive}.manifest"
s3_prefix="s3://${BACKUP_BUCKET}/postgres/${timestamp}"

mkdir -p "$backup_root"

if ! docker inspect "$postgres_container" >/dev/null 2>&1; then
  echo "PostgreSQL container not found: $postgres_container" >&2
  exit 1
fi
if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI is required to upload backups." >&2
  exit 1
fi

docker exec "$postgres_container" sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
  > "$archive"

sha256sum "$archive" > "$checksum"
cat > "$manifest" <<EOF
created_at=${timestamp}
format=postgresql-custom
archive=$(basename "$archive")
sha256=$(awk '{print $1}' "$checksum")
EOF

aws s3 cp "$archive" "${s3_prefix}/$(basename "$archive")" --sse AES256
aws s3 cp "$checksum" "${s3_prefix}/$(basename "$checksum")" --sse AES256
aws s3 cp "$manifest" "${s3_prefix}/$(basename "$manifest")" --sse AES256

find "$backup_root" -type f -mtime "+${retention_days}" -delete
echo "Uploaded PostgreSQL backup: ${s3_prefix}/$(basename "$archive")"
