#!/usr/bin/env python3
"""Leidt alle app- en installer-iconen af uit het logopakket (alleen het beeldmerk, de kubus).

    python3 -I scripts/generate-icon.py      # vanuit de root van de repository; vraagt Pillow

Bron: docs/branding/open-planner-studio/ (logopakket kubus v4, PR #574). Dat pakket blijft
byte-identiek; 05-checks/SHA256SUMS.txt controleert het. Dit script schrijft alleen afgeleide
bestanden op hun eigen plek. Het woordmerk (logo met tekst) gebruikt de app nergens.

Wat het maakt:
- app-icon.png: byte-kopie van het pakket-icoon van 1024 px (de Tauri-bron).
- src-tauri/icons/*: via `npx tauri icon` uit app-icon.png (ico, icns, Windows Store, Android, iOS).
  iOS eist een dichte achtergrond; die krijgt #2A2A32, de achtergrondkleur van de donkere
  pakketuitvoer. Windows (ico) en macOS (icns) blijven transparant, zoals het pakket.
- snap/gui/icon.png: byte-kopie van het pakket-icoon van 512 px.
- public/icon.png (titelbalk, 18 CSS-px, dus 36 px voor 2x-schermen) en public/favicon-16.png /
  favicon-32.png: verkleind uit de master van 2048 px. Bij deze kleine maten is de lege marge rond de
  kubus weggesneden tot 4 %, anders blijft er op 16 px maar ongeveer 11 px kubus over. Het beeld zelf
  is niet vereenvoudigd of aangepast.
- public/apple-touch-icon.png (180 px): verkleind uit de donkere master (met eigen achtergrond),
  met de marges van het pakket.

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
ICON_1024 = PKG / 'app-icons/open-planner-studio-1024.png'
ICON_512 = PKG / 'app-icons/open-planner-studio-512.png'
MASTER = PKG / 'open-planner-studio-symbol-transparent.png'
MASTER_DARK = PKG / 'open-planner-studio-symbol-dark.png'
IOS_BG = '#2A2A32'
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
    if not ICON_1024.exists():
        sys.exit(f'Logopakket niet gevonden: {ICON_1024} (draai vanuit de root van de repository)')

    shutil.copyfile(ICON_1024, ROOT / 'app-icon.png')
    subprocess.run(['npx', 'tauri', 'icon', 'app-icon.png', '--ios-color', IOS_BG], cwd=ROOT, check=True)
    # 256x256.png en 512x512.png vullen de standaard-dpi hicolor-slots op Linux (dock/app-grid) en
    # staan in bundle.icon van tauri.conf.json; de standaardset van `tauri icon` maakt ze niet.
    subprocess.run(['npx', 'tauri', 'icon', 'app-icon.png', '--png', '256,512'], cwd=ROOT, check=True)

    (ROOT / 'snap/gui').mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ICON_512, ROOT / 'snap/gui/icon.png')

    public = ROOT / 'public'
    small = tight_square(Image.open(MASTER).convert('RGBA'))
    for size, name in [(36, 'icon.png'), (16, 'favicon-16.png'), (32, 'favicon-32.png')]:
        lanczos(small, size).save(public / name, optimize=True)
    Image.open(MASTER_DARK).convert('RGB').resize((180, 180), Image.Resampling.LANCZOS).save(
        public / 'apple-touch-icon.png', optimize=True)
    print('Iconen gemaakt uit het logopakket.')


if __name__ == '__main__':
    main()
