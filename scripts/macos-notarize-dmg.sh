#!/usr/bin/env bash
# Notariseert en stapelt de dmg zelf. Tauri notariseert en stapelt alleen de
# app; de dmg eromheen bouwt het daarna en signeert het alleen. Apple eist voor
# de container een eigen notarisatie, anders kan een ongenotariseerde dmg
# gepubliceerd worden. Zelfde App Store Connect API-key als de app-notarisatie.
# Gebruik: scripts/macos-notarize-dmg.sh <map-met-dmg>
# Env: APPLE_API_KEY (key-id), APPLE_API_ISSUER, APPLE_API_KEY_PATH (.p8-bestand).
set -euo pipefail
DMG_DIR="${1:?map met de dmg ontbreekt}"
: "${APPLE_API_KEY:?}" "${APPLE_API_ISSUER:?}" "${APPLE_API_KEY_PATH:?}"
DMG_PATH="$(find "$DMG_DIR" -name '*.dmg' -print -quit)"
test -n "$DMG_PATH" || { echo "geen dmg in $DMG_DIR" >&2; exit 1; }
AUTH=(--key "$APPLE_API_KEY_PATH" --key-id "$APPLE_API_KEY" --issuer "$APPLE_API_ISSUER")
LOG="$(mktemp)"

echo "dmg notariseren: $DMG_PATH"
# Oordeel op de status, niet op de exitcode van notarytool.
xcrun notarytool submit "$DMG_PATH" "${AUTH[@]}" --wait 2>&1 | tee "$LOG" || true
if ! grep -qE '^ *status: Accepted' "$LOG"; then
  ID="$(awk '/^ *id: /{print $2; exit}' "$LOG")"
  echo "::error::dmg-notarisatie niet geaccepteerd" >&2
  if [ -n "$ID" ]; then xcrun notarytool log "$ID" "${AUTH[@]}" || true; fi
  exit 1
fi
xcrun stapler staple "$DMG_PATH"
echo "dmg-notarisatie: Accepted, ticket vastgeniet"
