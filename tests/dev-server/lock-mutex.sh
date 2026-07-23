#!/usr/bin/env bash
# Deterministische mutex-test voor scripts/dev-lock.mjs.
#
# Wat GEGARANDEERD is en hier getest wordt: gelijktijdige VERSE acquire (het slot
# bestaat nog niet) levert door `open('wx')` (O_EXCL) altijd precies één winnaar.
# Dit is de eigenschap die de kern-garanties draagt:
#   - twee bewakers van hetzelfde worktree → de tweede ziet een levende houder en
#     weigert (geen steal betrokken);
#   - twee allocators → één houdt de flock, de rest wacht.
# Beide leunen op verse-acquire-single-winner + levende-houder-weigering, niet op
# stelen. (Die twee worden ook door de node-units gedekt.)
#
# LET OP — bewust NIET als harde gate: het STELEN van een verweesd (gecrasht) slot
# is post-crash-herstel. De rename-claim+verify+link-steal is single-winner voor
# realistische gelijktijdigheid, maar onder pathologische, gelijktijdige steal van
# één gecrashte lock (8+ processen in dezelfde milliseconde) resteert een theoretische
# dubbel-claim. Dat scenario doet zich met een handvol worktrees niet voor, en de
# HARDE backstop is `strictPort`: twee worktrees met dezelfde poort → de kernel laat
# er maar één binden, de ander faalt schoon met EADDRINUSE (nooit een verkeerde build).
# Zie docs/superpowers/specs/2026-07-23-dev-server-dual-guard-prevention-design.md §3.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DL="file://$ROOT/scripts/dev-lock.mjs"
ROUNDS="${MUTEX_ROUNDS:-20}"
WORKERS="${MUTEX_WORKERS:-8}"

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
  # VERSE lock: pad bestaat nog niet → puur O_EXCL, geen steal.
  LOCK="$(mktemp -d)/fresh.lock"
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
  echo "TOTAAL: lock-mutex ${ROUNDS}x${WORKERS} groen — verse concurrent acquire geeft precies één winnaar"
  exit 0
fi
echo "TOTAAL: lock-mutex FAALT ($bad/$ROUNDS rondes met dubbel eigenaarschap)"
exit 1
