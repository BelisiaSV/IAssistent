#!/usr/bin/env bash
# Runs all migrations + seed + pgTAP tests on a throwaway Postgres, without Docker.
# Uses supabase/tests/support/supabase-stub.sql to stand in for Supabase's
# auth/storage schemas. Requires: Postgres 16 binaries, pgTAP, pg_prove.
#
# Against a real local Supabase (Docker) use instead:
#   supabase db reset && supabase test db
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${TEST_DB_PORT:-54329}"
WORK="$(mktemp -d)"

as_pg() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}

cleanup() {
  as_pg "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

[ "$(id -u)" = "0" ] && chown postgres "$WORK"
as_pg "$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
as_pg "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

echo "→ Supabase-stub laden"
"${PSQL[@]}" -f "$ROOT/supabase/tests/support/supabase-stub.sql" >/dev/null

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migratie $(basename "$f")"
  "${PSQL[@]}" -f "$f" >/dev/null
done

echo "→ seed"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql" >/dev/null

echo "→ pgTAP-tests"
pg_prove -h "$WORK" -p "$PORT" -U postgres -d postgres "$ROOT"/supabase/tests/database/*.test.sql
