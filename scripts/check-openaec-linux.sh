#!/usr/bin/env bash
# De echte uitgepakte release-AppImage, zonder FUSE/GPU/netwerk, onder headless Wayland.
set -euo pipefail
appimage=$(realpath "${1:?AppImage ontbreekt}")
out=$(realpath "${2:?Uitvoermap ontbreekt}")
[[ $(id -u) != 0 ]] || { echo 'De proef moet als gewone gebruiker draaien' >&2; exit 1; }
tmp=$(mktemp -d)
app_pid=''
compositor_pid=''
cleanup() {
  if [[ -n "$app_pid" ]]; then kill -KILL "$app_pid" 2>/dev/null || true; fi
  if [[ -n "$compositor_pid" ]]; then kill -TERM "$compositor_pid" 2>/dev/null || true; fi
  rm -rf "$tmp"
}
trap cleanup EXIT
print_failure() { local code=$?; echo "EXIT:$code"; }
trap print_failure ERR
cp "$appimage" "$tmp/app.AppImage"
chmod +x "$tmp/app.AppImage"
appimage="$tmp/app.AppImage"
export HOME="$tmp/home" XDG_RUNTIME_DIR="$tmp/runtime"
export XDG_CONFIG_HOME="$HOME/.config" XDG_DATA_HOME="$HOME/.local/share" XDG_CACHE_HOME="$HOME/.cache"
mkdir -p "$HOME" "$XDG_RUNTIME_DIR" "$tmp/openaec/plannen"
chmod 700 "$XDG_RUNTIME_DIR"
unset DISPLAY DBUS_SESSION_BUS_ADDRESS
export WLR_BACKENDS=headless WLR_RENDERER=pixman WLR_LIBINPUT_NO_DEVICES=1
labwc > "$out/compositor.log" 2>&1 &
compositor_pid=$!
for _ in $(seq 1 100); do
  socket=$(find "$XDG_RUNTIME_DIR" -maxdepth 1 -type s -name 'wayland-*' -print -quit)
  [[ -n "$socket" ]] && break
  kill -0 "$compositor_pid"
  sleep 0.2
done
test -n "${socket:-}"
export WAYLAND_DISPLAY="${socket##*/}" GDK_BACKEND=wayland
(cd "$tmp" && "$appimage" --appimage-extract > "$out/extract.log" 2>&1)
apprun="$tmp/squashfs-root/AppRun"
test -x "$apprun"
export OPENAEC_BEHEERD=1 OPENAEC_MAP="$tmp/openaec" OPENAEC_MCP_POORT=3877
# Alleen een vluchtig testtoken, nooit een organisatiegeheim of artifactinhoud.
OPENAEC_MCP_GEHEIM=$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')
export OPENAEC_MCP_GEHEIM
cp /src/examples/01-grachtenpand-amsterdam.ifc "$OPENAEC_MAP/plannen/proef é.ifc"

start_app() {
  local name=$1
  shift
  (cd "$tmp" && exec "$apprun" "$@") > "$out/$name.log" 2>&1 &
  app_pid=$!
}
stop_app() {
  kill -TERM "$app_pid"
  for _ in $(seq 1 150); do
    if ! kill -0 "$app_pid" 2>/dev/null; then break; fi
    sleep 0.2
  done
  if kill -0 "$app_pid" 2>/dev/null; then echo 'SIGTERM-timeout' >&2; exit 1; fi
  wait "$app_pid"
  app_pid=
}
start_app leeg
node /src/scripts/openaec-linux-probe.mjs idle "$out"
grim "$out/leeg.png"
# PSS van het hele procesgezin, gedeelde bibliotheken proportioneel meegerekend.
node /src/scripts/openaec-linux-probe.mjs memory "$out" "$app_pid"
stop_app

# Relatief startargument én een map met spatie/accent; OPENAEC_MAP is een andere werkmap.
start_app bestand 'openaec/plannen/proef é.ifc'
node /src/scripts/openaec-linux-probe.mjs file "$out"
grim "$out/bestand.png"
# De mutatie is zojuist gemaakt; de expliciete SIGTERM-flush moet de throttle vóór zijn.
stop_app
node /src/scripts/openaec-linux-probe.mjs recovery "$out" "$XDG_DATA_HOME"
if grep -RE 'panicked at|bwrap:|Failed to initialize gtk|cannot open display|SIGTERM.*niet bevestigd' "$out/"*.log; then exit 1; fi
# Ook logs mogen het vluchtige token niet bevatten.
if grep -RFq "$OPENAEC_MCP_GEHEIM" "$out"; then echo 'Testtoken in uitvoer' >&2; exit 1; fi
echo 'OK uitgepakte AppImage: Wayland, startbestand, MCP, software-rendering en herstel bij SIGTERM'
echo 'EXIT:0'
