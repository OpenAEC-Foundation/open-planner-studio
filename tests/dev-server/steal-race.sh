#!/usr/bin/env bash
# Regressietest voor de race-veilige steal in scripts/dev-lock.mjs.
#
# Achtergrond: een naïeve `unlink`+`open('wx')`-steal laat twee gelijktijdige
# stelers van een verweesd (dode-pid) slot allebei winnen — de tweede unlinkt de
# net-gewonnen verse lock van de eerste. Voor de toewijzings-flock zou dat twee
# allocators tegelijk geven → zelfde poort → verkeerde build. De fix claimt de
# stale inode atomair via rename + verifieert (sameHolder) + herstelt via link.
#
# Deze test isoleert GELIJKTIJDIG eigenaarschap (geen sequentiële-handoff-ruis):
# N stelers, korte acquire-timeout, winnaar houdt LANGER vast dan de deadline en
# bewaakt continu z'n alleenrecht. Verwacht per ronde: exact 1 WIN, 0 CONFLICT.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DL="file://$ROOT/scripts/dev-lock.mjs"
ROUNDS="${STEAL_ROUNDS:-8}"
WORKERS="${STEAL_WORKERS:-8}"

CHILD="$(mktemp --suffix=.mjs)"
cat > "$CHILD" <<'EOF'
import { readFileSync } from 'node:fs';
const { acquireLock } = await import(process.env.DL);
const LOCK = process.env.LOCK;
const ownerPid = () => { try { return JSON.parse(readFileSync(LOCK, 'utf8')).pid; } catch { return null; } };
try {
  const rel = acquireLock(LOCK, { timeoutMs: 250, sleepMs: 10 });
  const me = process.pid; let conflict = false; const t0 = Date.now();
  while (Date.now() - t0 < 400) { if (ownerPid() !== me) { conflict = true; break; } }
  console.log(conflict ? 'CONFLICT' : 'WIN');
  rel();
} catch { console.log('LOSE'); }
EOF
trap 'rm -f "$CHILD"' EXIT

bad=0
for round in $(seq 1 "$ROUNDS"); do
  LOCK="$(mktemp -d)/race.lock"
  printf '{"pid":2147483646,"startedAt":1}' > "$LOCK"   # verweesd: dode pid
  OUT="$(mktemp)"
  for _ in $(seq 1 "$WORKERS"); do
    DL="$DL" LOCK="$LOCK" node "$CHILD" >>"$OUT" 2>&1 &
  done
  wait
  W=$(grep -c '^WIN' "$OUT"); C=$(grep -c '^CONFLICT' "$OUT"); L=$(grep -c '^LOSE' "$OUT")
  rm -rf "$(dirname "$LOCK")" "$OUT"
  if [ "$W" = "1" ] && [ "$C" = "0" ]; then
    echo "OK ronde $round: WIN=$W CONFLICT=$C LOSE=$L"
  else
    echo "XX ronde $round: WIN=$W CONFLICT=$C LOSE=$L (verwacht WIN=1 CONFLICT=0)"
    bad=$((bad + 1))
  fi
done

if [ "$bad" = "0" ]; then
  echo "TOTAAL: steal-race ${ROUNDS}x${WORKERS} groen — precies één winnaar, geen dubbel eigenaarschap"
  exit 0
fi
echo "TOTAAL: steal-race FAALT ($bad/$ROUNDS rondes met dubbel eigenaarschap)"
exit 1
