#!/usr/bin/env bash
# Controleert dat de AppImage de GTK-invoermodules voor IBus en Fcitx meelevert (issue #764).
#
# Waarom: de GTK-plugin van linuxdeploy zet in de AppImage GTK_IM_MODULE_FILE op een eigen
# immodules.cache. GTK zoekt een invoermethode dan alleen in die lijst. Staan ibus en fcitx daar
# niet in, dan negeert de app GTK_IM_MODULE=ibus/fcitx van de gebruiker en typt hij kale letters:
# geen Vietnamees (Telex/VNI), geen Chinees, Japans of Koreaans. De lijst bevat alleen de modules
# die op de bouwmachine geïnstalleerd waren; release.yml installeert daarom ibus-gtk3 en
# fcitx5-frontend-gtk3 vóór de build.
#
# Per vereiste module-id (ibus, fcitx, fcitx5) eist dit script:
# - een regel in de immodules.cache waar de hook GTK_IM_MODULE_FILE naar laat wijzen;
# - het modulebestand in de immodules-map naast die cache;
# - een werkende link in usr/lib. De cache noemt alleen de bestandsnaam, en GTK opent die met
#   dlopen via LD_LIBRARY_PATH (de plugin legt die links zelf aan).
#
# Gebruik: scripts/check-appimage-im-modules.sh <bestand.AppImage | uitgepakte AppDir>
# Een .AppImage wordt uitgepakt met --appimage-extract (geen FUSE nodig).
set -euo pipefail

SRC="${1:?AppImage of AppDir ontbreekt}"
REQUIRED_IDS=(ibus fcitx fcitx5)

if [ -d "$SRC" ]; then
  APPDIR="$(cd "$SRC" && pwd)"
else
  test -f "$SRC" || { echo "::error::$SRC bestaat niet" >&2; exit 1; }
  WORK="$(mktemp -d)"
  trap 'rm -rf "$WORK"' EXIT
  ABS="$(realpath "$SRC")"
  chmod +x "$ABS"
  (cd "$WORK" && "$ABS" --appimage-extract >/dev/null)
  APPDIR="$WORK/squashfs-root"
fi

HOOK="$APPDIR/apprun-hooks/linuxdeploy-plugin-gtk.sh"
test -f "$HOOK" || { echo "::error::geen GTK-hook in de AppImage ($HOOK)" >&2; exit 1; }

# export GTK_IM_MODULE_FILE="$APPDIR//usr/lib/gtk-3.0/3.0.0/immodules.cache"
# shellcheck disable=SC2016 # de $APPDIR in het patroon is letterlijke hooktekst, geen variabele
CACHE_REL="$(sed -n 's|^export GTK_IM_MODULE_FILE="\$APPDIR/*\([^"]*\)".*|\1|p' "$HOOK" | head -n 1)"
test -n "$CACHE_REL" || { echo "::error::de GTK-hook zet geen GTK_IM_MODULE_FILE" >&2; exit 1; }
CACHE="$APPDIR/$CACHE_REL"
test -f "$CACHE" || { echo "::error::immodules.cache ontbreekt: $CACHE_REL" >&2; exit 1; }
MODULE_DIR="$(dirname "$CACHE")/immodules"

# Cache-indeling: een regel met "bestand.so", daarna per id een regel "id" "naam" ...
MAP="$(awk '
  /^"[^"]*\.so"/ { split($0, a, "\""); file = a[2]; next }
  /^"/ && file != "" { split($0, a, "\""); print a[2] " " file }
' "$CACHE")"

echo "immodules.cache: $CACHE_REL"
echo "aanwezige module-id's: $(cut -d' ' -f1 <<<"$MAP" | tr '\n' ' ')"

fails=0
for id in "${REQUIRED_IDS[@]}"; do
  file="$(awk -v id="$id" '$1 == id { print $2; exit }' <<<"$MAP")"
  if [ -z "$file" ]; then
    echo "::error::module-id '$id' ontbreekt in immodules.cache"
    fails=$((fails + 1))
    continue
  fi
  base="$(basename "$file")"
  if [ ! -f "$MODULE_DIR/$base" ]; then
    echo "::error::'$id': $base staat in de cache maar niet in $(basename "$MODULE_DIR")/"
    fails=$((fails + 1))
    continue
  fi
  if [ ! -e "$APPDIR/usr/lib/$base" ]; then
    echo "::error::'$id': geen werkende link usr/lib/$base (GTK vindt de module dan niet)"
    fails=$((fails + 1))
    continue
  fi
  echo "OK  $id -> $base"
done

if [ "$fails" -gt 0 ]; then
  echo "::error::$fails invoermodule(s) ontbreken in de AppImage; IBus/Fcitx (Vietnamees, CJK) werken dan niet (issue #764)" >&2
  exit 1
fi
echo "Alle invoermodules aanwezig: ${REQUIRED_IDS[*]}"
