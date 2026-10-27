#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="scalitpus-test-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --rm --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust -d postgres:17-alpine >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < tests/bootstrap.sql
docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < supabase/schema.sql
# Test migration of an existing cumulative total, then verify idempotence.
docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < tests/migration-seed.sql
for verification in 1 2; do
  docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < supabase/schema.sql
  docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < tests/migration-check.sql
done
docker exec -i "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 < tests/database.sql
