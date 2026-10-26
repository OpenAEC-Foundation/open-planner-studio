"""Maak het bovenvlak van het Open Planner Studio-kubuslogo doorzichtig, net als de zijvlakken (besluit eigenaar 2026-10-23).
Gebruik: python3 bovenvlak_open.py <in.png> <uit.png>
Het bovenvlak is vlak #594124; de randpixels zijn een menging van dat bruin en de amber contour (#F59E0B).
Per pixel: projecteer op de lijn bruin→amber. Het amber aandeel blijft (als dekking), het bruine aandeel wordt doorzichtig."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

BRUIN = np.array([0x59, 0x41, 0x24], float)
AMBER = np.array([0xF5, 0x9E, 0x0B], float)


def main(src, dst):
    im = np.asarray(Image.open(src).convert("RGBA")).astype(float)
    rgb, a = im[..., :3], im[..., 3]
    d = AMBER - BRUIN
    t = np.clip(((rgb - BRUIN) @ d) / (d @ d), 0, 1)           # 0 = bruin, 1 = amber
    afstand = np.linalg.norm(rgb - (BRUIN + t[..., None] * d), axis=-1)
    raak = (afstand < 14) & (t < 0.97) & (a > 200)              # op de lijn bruin–amber, met een bruin aandeel, dekkend
    kern = raak & (t < 0.15)
    lab, n = ndimage.label(kern)
    if n == 0:
        raise SystemExit("geen bovenvlak gevonden")
    groot = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)  # het bovenvlak is het grootste bruine gebied
    gebied = ndimage.binary_dilation(groot, iterations=6) & raak
    nieuw_rgb, nieuw_a = rgb.copy(), a.copy()
    nieuw_rgb[gebied] = AMBER
    nieuw_a[gebied] = a[gebied] * t[gebied]
    uit = np.dstack([nieuw_rgb, nieuw_a]).round().clip(0, 255).astype(np.uint8)
    Image.fromarray(uit, "RGBA").save(dst, optimize=True)
    print(f"{gebied.sum()} pixels doorzichtig gemaakt in {src} -> {dst}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
