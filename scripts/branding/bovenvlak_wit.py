"""Kleur het bovenvlak van het Open Planner Studio-kubuslogo wit (besluit eigenaar 2026-10-23).
Gebruik: python3 bovenvlak_wit.py <in.png> <uit.png>
Het bovenvlak is vlak #594124; de randpixels zijn een menging van dat bruin en de amber contour (#F59E0B).
Per pixel: projecteer op de lijn bruin→amber, en vervang het bruine aandeel door wit."""
import sys
import numpy as np
from PIL import Image

BRUIN = np.array([0x59, 0x41, 0x24], float)
AMBER = np.array([0xF5, 0x9E, 0x0B], float)
WIT = np.array([255, 255, 255], float)

def main(src, dst):
    im = np.asarray(Image.open(src).convert("RGBA")).astype(float)
    rgb, a = im[..., :3], im[..., 3]
    d = AMBER - BRUIN
    t = np.clip(((rgb - BRUIN) @ d) / (d @ d), 0, 1)           # 0 = bruin, 1 = amber
    proj = BRUIN + t[..., None] * d
    afstand = np.linalg.norm(rgb - proj, axis=-1)
    # alleen pixels die echt op de lijn bruin–amber liggen, met een bruin aandeel, en (bijna) dekkend
    raak = (afstand < 14) & (t < 0.97) & (a > 200)
    # het bovenvlak is één samenhangend gebied: houd alleen de grootste component van de bruine kern + zijn rand
    from scipy import ndimage
    kern = raak & (t < 0.15)
    lab, n = ndimage.label(kern)
    if n == 0:
        raise SystemExit("geen bovenvlak gevonden")
    groot = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
    gebied = ndimage.binary_dilation(groot, iterations=6) & raak
    nieuw = rgb.copy()
    nieuw[gebied] = (WIT + t[gebied][:, None] * (AMBER - WIT))
    uit = np.dstack([nieuw, a]).round().clip(0, 255).astype(np.uint8)
    Image.fromarray(uit, "RGBA").save(dst, optimize=True)
    print(f"{gebied.sum()} pixels omgekleurd in {src} -> {dst}")

if __name__ == "__main__":
    main(*sys.argv[1:3])
