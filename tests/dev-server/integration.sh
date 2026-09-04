#!/usr/bin/env bash
set -uo pipefail
ROOT_REPO="$(cd "$(dirname "$0")/../.." && pwd)"
fail() { echo "XX FAIL: $1"; exit 1; }
pass() { echo "OK: $1"; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git init -q "$TMP/main"
# Identiteit expliciet in de tijdelijke repo zetten: een CI-runner heeft geen
# globale user.name/user.email, en dan faalt `git commit` met "unable to
# auto-detect email address". Dat viel hier niet op omdat het script geen `-e`
# heeft — de commit mislukte stil en liet alleen een `fatal:` in de log achter.
git -C "$TMP/main" config user.email "dev-server-test@example.invalid"
git -C "$TMP/main" config user.name "dev-server test"
git -C "$TMP/main" commit -q --allow-empty -m init || fail "kon de basiscommit niet maken"
mkdir -p "$TMP/main/scripts"
cp "$ROOT_REPO"/scripts/dev-port.mjs "$ROOT_REPO"/scripts/dev-lock.mjs "$ROOT_REPO"/scripts/dev-server.mjs "$ROOT_REPO"/scripts/browser-test-server.mjs "$TMP/main/scripts/"

# Deel 1: --print-plan alloceert + claimt slot + print poort, zonder vite te spawnen
# (cd naar de worktree: dev-server.mjs leidt de root af uit process.cwd(), net als `npm run dev`)
( cd "$TMP/main" && node scripts/dev-server.mjs --print-plan ) >"$TMP/p1.txt" 2>&1 || fail "dev-server --print-plan gaf een fout: $(cat "$TMP/p1.txt")"
grep -q "worktree" "$TMP/p1.txt" || fail "dev-server --print-plan printte geen worktree/poort-plan"
pass "dev-server --print-plan werkt en kiest een poort"

# Deel 2: twee worktrees → twee VERSCHILLENDE poorten
git -C "$TMP/main" worktree add -q "$TMP/wt-a" -b wt-a
git -C "$TMP/main" worktree add -q "$TMP/wt-b" -b wt-b
for w in wt-a wt-b; do mkdir -p "$TMP/$w/scripts"; cp "$TMP/main/scripts/"*.mjs "$TMP/$w/scripts/"; done
PA=$( cd "$TMP/wt-a" && node scripts/dev-server.mjs --print-plan 2>&1 | grep -oE 'localhost:[0-9]+' | cut -d: -f2)
PB=$( cd "$TMP/wt-b" && node scripts/dev-server.mjs --print-plan 2>&1 | grep -oE 'localhost:[0-9]+' | cut -d: -f2)
[ -n "$PA" ] && [ -n "$PB" ] || fail "kon poorten niet uitlezen (A=$PA B=$PB)"
[ "$PA" != "$PB" ] || fail "twee worktrees kregen dezelfde poort ($PA)"
pass "twee worktrees → twee poorten (A=$PA, B=$PB)"

PA2=$( cd "$TMP/wt-a" && node scripts/dev-server.mjs --print-plan 2>&1 | grep -oE 'localhost:[0-9]+' | cut -d: -f2)
[ "$PA" = "$PA2" ] || fail "wt-a poort niet stabiel ($PA vs $PA2)"
pass "toewijzing is idempotent (wt-a blijft $PA)"

# De browserlane krijgt eigen markers en een eigen bereik. De bestaande
# devmarker en configurations[dev].port mogen daarbij niet veranderen.
BA=$( cd "$TMP/wt-a" && node --input-type=module -e '
  const ports = await import("./scripts/dev-port.mjs");
  console.log(await ports.allocateNamedPort(ports.worktreeRoot(), "browser"));
')
BB=$( cd "$TMP/wt-b" && node --input-type=module -e '
  const ports = await import("./scripts/dev-port.mjs");
  console.log(await ports.allocateNamedPort(ports.worktreeRoot(), "browser"));
')
[ -n "$BA" ] && [ -n "$BB" ] || fail "kon browserpoorten niet uitlezen (A=$BA B=$BB)"
[ "$BA" != "$BB" ] || fail "twee worktrees kregen dezelfde browserpoort ($BA)"
[ "$BA" -ge 3107 ] && [ "$BA" -le 3206 ] || fail "browserpoort A buiten lane: $BA"
[ "$BB" -ge 3107 ] && [ "$BB" -le 3206 ] || fail "browserpoort B buiten lane: $BB"
MARKERS_A=$(node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const json = JSON.parse(readFileSync(process.argv[1], "utf8"));
  const dev = json.configurations.find((entry) => entry?.name === "dev");
  console.log(`${json.opsDevPort}:${json.opsBrowserTestPort}:${dev?.port}`);
' "$TMP/wt-a/.claude/launch.json")
MARKERS_B=$(node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const json = JSON.parse(readFileSync(process.argv[1], "utf8"));
  const dev = json.configurations.find((entry) => entry?.name === "dev");
  console.log(`${json.opsDevPort}:${json.opsBrowserTestPort}:${dev?.port}`);
' "$TMP/wt-b/.claude/launch.json")
[ "$MARKERS_A" = "$PA:$BA:$PA" ] || fail "browserstempel wijzigde devgegevens A ($MARKERS_A)"
[ "$MARKERS_B" = "$PB:$BB:$PB" ] || fail "browserstempel wijzigde devgegevens B ($MARKERS_B)"
pass "browserlane isoleert twee worktrees en behoudt hun devmarkers (A=$BA, B=$BB)"

# De bewaakte browser-testserver houdt zijn eigen guard vast, stuurt SIGTERM
# door naar de child, retourneert diens echte exitcode en maakt de guard vrij.
mkdir -p "$TMP/wt-a/node_modules/.bin"
node --input-type=module -e '
  import { writeFileSync } from "node:fs";
  writeFileSync(process.argv[1], `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(
  process.env.OPS_FAKE_CHILD_READY,
  process.env.OPS_DEV_PORT + ":" + process.env.OPS_DEV_INSTANCE + ":" + process.argv.slice(2).join(","),
);
process.on("SIGTERM", () => process.exit(23));
setInterval(() => {}, 1000);
`, { mode: 0o755 });
' "$TMP/wt-a/node_modules/.bin/vite" || fail "kon fake Vite-child niet maken"
(
  cd "$TMP/wt-a" || exit 1
  exec env OPS_BROWSER_TEST_PORT="$BA" OPS_FAKE_CHILD_READY="$TMP/browser-child-ready.txt" node scripts/browser-test-server.mjs
) >"$TMP/browser-server.txt" 2>&1 &
BROWSER_SERVER_PID=$!
for _ in $(seq 1 100); do
  [ -f "$TMP/browser-child-ready.txt" ] && break
  kill -0 "$BROWSER_SERVER_PID" 2>/dev/null || break
  sleep 0.02
done
[ -f "$TMP/browser-child-ready.txt" ] || fail "fake Vite-child werd niet gereed: $(cat "$TMP/browser-server.txt")"
[ "$(cat "$TMP/browser-child-ready.txt")" = "$BA:wt-a-browser-test:--host,127.0.0.1" ] || fail "browser-server gaf verkeerde child-env/host door: $(cat "$TMP/browser-child-ready.txt")"
node --input-type=module -e '
  const locks = await import(process.argv[1]);
  const ports = await import(process.argv[2]);
  const root = ports.worktreeRoot(process.argv[3]);
  try { locks.acquireNamedGuardLock(root, Number(process.argv[4]), "browser"); process.exit(2); }
  catch { process.exit(0); }
' "file://$TMP/wt-a/scripts/dev-lock.mjs" "file://$TMP/wt-a/scripts/dev-port.mjs" "$TMP/wt-a" "$BA" || fail "tweede browserguard werd niet geweigerd"
kill -TERM "$BROWSER_SERVER_PID" || fail "kon browser-testserver niet stoppen"
wait "$BROWSER_SERVER_PID"
BROWSER_SERVER_RC=$?
[ "$BROWSER_SERVER_RC" -eq 23 ] || fail "browser-testserver verloor child-exitcode 23 (kreeg $BROWSER_SERVER_RC): $(cat "$TMP/browser-server.txt")"
node --input-type=module -e '
  const locks = await import(process.argv[1]);
  const ports = await import(process.argv[2]);
  const root = ports.worktreeRoot(process.argv[3]);
  const release = locks.acquireNamedGuardLock(root, Number(process.argv[4]), "browser");
  release();
' "file://$TMP/wt-a/scripts/dev-lock.mjs" "file://$TMP/wt-a/scripts/dev-port.mjs" "$TMP/wt-a" "$BA" || fail "browserguard was na child-exit niet opnieuw claimbaar"
pass "browser-testserver bewaakt dubbelstart en ruimt child plus guard op"

# Deel 3: dubbelstart-weigering (levend guard-slot → tweede claim gooit)
node -e '
import("'"$TMP"'/wt-a/scripts/dev-lock.mjs").then(async (m) => {
  const p = await import("'"$TMP"'/wt-a/scripts/dev-port.mjs");
  const root = p.worktreeRoot("'"$TMP"'/wt-a");
  const rel = m.acquireGuardLock(root, 3099);
  try { m.acquireGuardLock(root, 3099); console.log("GEEN-WEIGERING"); process.exit(2); }
  catch { console.log("WEIGERING-OK"); rel(); process.exit(0); }
});
' >"$TMP/dbl.txt" 2>&1
grep -q "WEIGERING-OK" "$TMP/dbl.txt" || fail "tweede bewaker werd niet geweigerd: $(cat "$TMP/dbl.txt")"
pass "dubbelstart in hetzelfde worktree wordt geweigerd"

# Deel 4: botsende stempels herstellen zichzelf (het echte pad: echte flock,
# echte `git worktree list`, echte launch.json). We forceren de situatie die in
# de praktijk optrad: twee worktrees met exact dezelfde opsDevPort.
node --input-type=module -e '
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
for (const p of process.argv.slice(1)) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ opsDevPort: 3105 }));
}
' "$TMP/wt-a/.claude/launch.json" "$TMP/wt-b/.claude/launch.json" || fail "kon de botsende stempels niet schrijven"
PC=$( cd "$TMP/wt-a" && node scripts/dev-server.mjs --print-plan 2>&1 | grep -oE 'localhost:[0-9]+' | cut -d: -f2)
PD=$( cd "$TMP/wt-b" && node scripts/dev-server.mjs --print-plan 2>&1 | grep -oE 'localhost:[0-9]+' | cut -d: -f2)
[ -n "$PC" ] && [ -n "$PD" ] || fail "kon poorten niet uitlezen na botsing (A=$PC B=$PD)"
[ "$PC" != "$PD" ] || fail "botsende stempels bleven botsen (beide $PC)"
pass "botsende stempels lossen zichzelf op (A=$PC, B=$PD)"

# Convergentie: geen ping-pong bij een volgende start
PC2=$( cd "$TMP/wt-a" && node scripts/dev-server.mjs --print-plan 2>&1 | grep -oE 'localhost:[0-9]+' | cut -d: -f2)
PD2=$( cd "$TMP/wt-b" && node scripts/dev-server.mjs --print-plan 2>&1 | grep -oE 'localhost:[0-9]+' | cut -d: -f2)
[ "$PC" = "$PC2" ] && [ "$PD" = "$PD2" ] || fail "poorten niet stabiel na herstel (A=$PC/$PC2 B=$PD/$PD2)"
pass "na herstel zijn de poorten stabiel (A=$PC, B=$PD)"

echo "TOTAAL: dev-server integratie deel 1 groen"
