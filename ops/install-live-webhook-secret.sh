#!/usr/bin/env bash
set -euo pipefail

secret_file="/tmp/contentrank-live-webhook-secret"
env_file="/opt/contentrank/backend/.env"
secret="$(cat "$secret_file")"

if [[ -z "$secret" ]]; then
  echo "Live webhook secret is empty." >&2
  exit 1
fi

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file" "$secret_file"' EXIT
grep -v '^DODO_WEBHOOK_SECRET=' "$env_file" > "$tmp_file"
printf 'DODO_WEBHOOK_SECRET=%s\n' "$secret" >> "$tmp_file"
install -m 600 "$tmp_file" "$env_file"
echo "Live webhook secret installed alongside the test secret."
