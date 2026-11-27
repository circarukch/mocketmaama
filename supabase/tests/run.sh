#!/usr/bin/env bash
# Runs the migrations and SQL tests against a throwaway database on a local
# Postgres 15+ server. Usage: supabase/tests/run.sh [psql connection args]
set -euo pipefail
cd "$(dirname "$0")/.."
DB="mocket_test_$$"
createdb "$@" "$DB"
trap 'dropdb "$@" --if-exists "$DB"' EXIT
psql "$@" -d "$DB" -q -v ON_ERROR_STOP=1 -f tests/supabase_stub.sql
for f in migrations/*.sql; do psql "$@" -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f"; done
psql "$@" -d "$DB" -q -v ON_ERROR_STOP=1 -f seed.sql
psql "$@" -d "$DB" -q -v ON_ERROR_STOP=1 -o /dev/null -f tests/trading_core.test.sql
