#!/usr/bin/env bash
# Bouwt en test het AUR-pakket in een archlinux-container (aangeroepen door .github/workflows/aur.yml).
#
#   build-in-container.sh <map met PKGBUILD> <uitvoermap>
#
# Draait als root in de container. Doet:
#   1. base-devel + namcap + de `depends` van het PKGBUILD installeren;
#   2. makepkg als gewone gebruiker (makepkg weigert root), met de echte download uit `source`
#      en de controle van `sha256sums`;
#   3. .SRCINFO genereren (makepkg --printsrcinfo);
#   4. namcap op PKGBUILD en pakket: een E:-regel is fout, W:-regels komen in de log;
#   5. het pakket installeren en controleren: geen ontbrekende bibliotheken (ldd), en pacman
#      bezit /usr/bin/open-planner-studio (daarop herkent de app een AUR-installatie, zie src-tauri/src/commands/mod.rs).
# Uitvoer: <uitvoermap>/{PKGBUILD,.SRCINFO,*.pkg.tar.zst,namcap.txt}.
#
# AS_BUILDER: hoe een opdracht als gewone gebruiker draait. Standaard `runuser -u builder --`.
# Lokaal in een user namespace zonder subuids werkt runuser niet; daar kan
# `unshare --user --map-user=1000 --map-group=1000 --`.
set -euo pipefail

SRC="${1:?map met PKGBUILD}"
OUT="${2:?uitvoermap}"
AS_BUILDER="${AS_BUILDER:-runuser -u builder --}"
read -r -a as_builder <<< "$AS_BUILDER"

PACMAN=(pacman --noconfirm --needed)
# pacman 7 draait downloads in een sandbox als gebruiker `alpm`; in een container of user
# namespace werkt dat niet altijd. De container is wegwerp, dus zonder sandbox.
if pacman --help 2>/dev/null | grep -q -- '--disable-sandbox' || pacman -h -S 2>/dev/null | grep -q -- '--disable-sandbox'; then
  PACMAN+=(--disable-sandbox)
fi

"${PACMAN[@]}" -Syu base-devel namcap

id builder > /dev/null 2>&1 || useradd -m -u 1000 builder
BUILD=/home/builder/aur-build
rm -rf "$BUILD"
mkdir -p "$BUILD"
cp "$SRC/PKGBUILD" "$BUILD/PKGBUILD"
chown -R builder: /home/builder 2> /dev/null || true

mapfile -t deps < <(cd "$BUILD" && bash -c 'source ./PKGBUILD && printf "%s\n" "${depends[@]}"')
echo "depends: ${deps[*]}"
"${PACMAN[@]}" -S "${deps[@]}"

cd "$BUILD"
"${as_builder[@]}" makepkg --cleanbuild --noconfirm --nosign
"${as_builder[@]}" makepkg --printsrcinfo > .SRCINFO

shopt -s nullglob
pkgs=(./*.pkg.tar.zst)
[ "${#pkgs[@]}" -eq 1 ] || { echo "::error::verwacht precies één pakket, gevonden: ${pkgs[*]:-geen}" >&2; exit 1; }
PKG="${pkgs[0]}"

{
  echo "== namcap PKGBUILD"
  namcap PKGBUILD
  echo "== namcap $PKG"
  namcap "$PKG"
} | tee namcap.txt
if grep -qE '^[^ ]+ E: ' namcap.txt; then
  echo "::error::namcap meldt fouten (E:), zie namcap.txt" >&2
  exit 1
fi

pacman -Qlp "$PKG"
"${PACMAN[@]}" -U "$PKG"
owner="$(pacman -Qqo /usr/bin/open-planner-studio)"
[ "$owner" = open-planner-studio-bin ] || { echo "::error::/usr/bin/open-planner-studio is van '$owner'" >&2; exit 1; }
if ldd /usr/bin/open-planner-studio | grep 'not found'; then
  echo "::error::ontbrekende bibliotheken; vul depends aan" >&2
  exit 1
fi
test -f '/usr/share/applications/Open Planner Studio.desktop'

mkdir -p "$OUT"
cp PKGBUILD .SRCINFO namcap.txt "$PKG" "$OUT/"
echo "Klaar: $(basename "$PKG")"
