#!/usr/bin/env bash
set -uo pipefail
ROOT_REPO="$(cd "$(dirname "$0")/../.." && pwd)"
fail() { echo "XX FAIL: $1"; exit 1; }
pass() { echo "OK: $1"; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git init -q "$TMP/main"
( cd "$TMP/main" && git commit -q --allow-empty -m init )
mkdir -p "$TMP/main/scripts"
cp "$ROOT_REPO"/scripts/dev-port.mjs "$ROOT_REPO"/scripts/dev-lock.mjs "$ROOT_REPO"/scripts/dev-server.mjs "$TMP/main/scripts/"

# Deel 1: --print-plan alloceert + claimt slot + print poort, zonder vite te spawnen
node "$TMP/main/scripts/dev-server.mjs" --print-plan >"$TMP/p1.txt" 2>&1 || fail "dev-server --print-plan gaf een fout: $(cat "$TMP/p1.txt")"
grep -q "worktree" "$TMP/p1.txt" || fail "dev-server --print-plan printte geen worktree/poort-plan"
pass "dev-server --print-plan werkt en kiest een poort"

echo "TOTAAL: dev-server integratie deel 1 groen"
