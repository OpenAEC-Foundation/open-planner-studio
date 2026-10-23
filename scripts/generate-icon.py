#!/usr/bin/env python3
"""Leidt alle app- en installer-iconen af uit het logopakket (alleen het beeldmerk, de kubus).

    python3 scripts/generate-icon.py      # vanuit de root; vraagt Pillow, numpy en scipy

Bron: docs/branding/open-planner-studio/ (logopakket kubus v4, PR #574). Dat pakket blijft
byte-identiek; 05-checks/SHA256SUMS.txt controleert het. Het woordmerk (logo met tekst) gebruikt de
app nergens.

Doorzichtig bovenvlak (besluit eigenaar 2026-10-23: "het bovenvlak moet natuurlijk doorzichtig
zijn", net als de zijvlakken). In het pakket is het bovenvlak #594124. Stap 1 maakt daarom twee open
masters met scripts/branding/bovenvlak_open.py en zet ze in docs/branding/app-iconbron/ (afgeleide
bron, in git):
- kubus-open-2048.png uit 01-png/open-planner-studio-symbol-transparent.png
- kubus-open-1024.png uit 01-png/app-icons/open-planner-studio-1024.png
Alle andere bestanden komen uit die twee masters:
- app-icon.png: kopie van kubus-open-1024.png (de Tauri-bron).
- src-tauri/icons/*: via `npx tauri icon` (ico, icns, Windows Store, Android, iOS). iOS eist een
  dichte achtergrond; die krijgt #2A2A32, de achtergrondkleur van de donkere pakketuitvoer.
  Windows (ico) en macOS (icns) blijven transparant, zoals het pakket.
- snap/gui/icon.png: 512 px, verkleind uit kubus-open-1024.png.
- public/icon.png (titelbalk, 18 CSS-px, dus 36 px voor 2x-schermen) en public/favicon-16.png /
  favicon-32.png: verkleind uit kubus-open-2048.png. Bij deze kleine maten is de lege marge rond de
  kubus weggesneden tot 4 %, anders blijft er op 16 px maar ongeveer 11 px kubus over. Het beeld zelf
  is niet vereenvoudigd.
- public/apple-touch-icon.png (180 px): kubus-open-2048.png op #2A2A32, met de marges van het pakket.

Verkleinen gebeurt met Lanczos (Pillow), in voorvermenigvuldigde alfa, zodat transparante pixels
geen donkere randen geven.
"""
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path.cwd()
PKG = ROOT / 'docs/branding/open-planner-studio/01-png'
BRON = ROOT / 'docs/branding/app-iconbron'
OPEN_SCRIPT = ROOT / 'scripts/branding/bovenvlak_open.py'
MASTER_2048 = BRON / 'kubus-open-2048.png'
MASTER_1024 = BRON / 'kubus-open-1024.png'
DARK_BG = '#2A2A32'
CROP_MARGIN = 0.04


def lanczos(im: Image.Image, size: int) -> Image.Image:
    # Pillow verkleint RGBA in voorvermenigvuldigde alfa als je via 'RGBa' gaat.
    return im.convert('RGBa').resize((size, size), Image.Resampling.LANCZOS).convert('RGBA')


def tight_square(im: Image.Image) -> Image.Image:
    left, top, right, bottom = im.getchannel('A').getbbox()
    side = max(right - left, bottom - top) * (1 + 2 * CROP_MARGIN)
    cx, cy = (left + right) / 2, (top + bottom) / 2
    box = tuple(round(v) for v in (cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2))
    return im.crop(box)


def main() -> None:
    src_2048 = PKG / 'open-planner-studio-symbol-transparent.png'
    src_1024 = PKG / 'app-icons/open-planner-studio-1024.png'
    if not src_1024.exists():
        sys.exit(f'Logopakket niet gevonden: {src_1024} (draai vanuit de root van de repository)')

    # 1. Open masters (afgeleide bron).
    BRON.mkdir(parents=True, exist_ok=True)
    for src, dst in [(src_2048, MASTER_2048), (src_1024, MASTER_1024)]:
        subprocess.run([sys.executable, str(OPEN_SCRIPT), str(src), str(dst)], check=True)

    # 2. Tauri: alle desktop- en mobiele formaten.
    shutil.copyfile(MASTER_1024, ROOT / 'app-icon.png')
    subprocess.run(['npx', 'tauri', 'icon', 'app-icon.png', '--ios-color', DARK_BG], cwd=ROOT, check=True)
    # 256x256.png en 512x512.png vullen de standaard-dpi hicolor-slots op Linux (dock/app-grid) en
    # staan in bundle.icon van tauri.conf.json; de standaardset van `tauri icon` maakt ze niet.
    subprocess.run(['npx', 'tauri', 'icon', 'app-icon.png', '--png', '256,512'], cwd=ROOT, check=True)

    # 3. Snap.
    (ROOT / 'snap/gui').mkdir(parents=True, exist_ok=True)
    lanczos(Image.open(MASTER_1024), 512).save(ROOT / 'snap/gui/icon.png', optimize=True)

    # 4. Web: titelbalk, favicons, apple-touch-icon.
    public = ROOT / 'public'
    master = Image.open(MASTER_2048).convert('RGBA')
    small = tight_square(master)
    for size, name in [(36, 'icon.png'), (16, 'favicon-16.png'), (32, 'favicon-32.png')]:
        lanczos(small, size).save(public / name, optimize=True)
    tile = Image.new('RGBA', master.size, DARK_BG)
    tile.alpha_composite(master)
    tile.convert('RGB').resize((180, 180), Image.Resampling.LANCZOS).save(
        public / 'apple-touch-icon.png', optimize=True)
    print('Iconen gemaakt uit het logopakket (doorzichtig bovenvlak).')


if __name__ == '__main__':
    main()
