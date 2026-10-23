#!/usr/bin/env python3
"""Genereer de B2-iconen van de OpenAEC Style Repo als compacte SVG-paden voor OPS.

Bron: `design/icon-set-b2/manifest.json` in
https://github.com/OpenAEC-Foundation/OpenAEC-Style-Repo, gepind op één commit in
`src/components/icons/b2/b2.lock.json`. De Style Repo exporteert de iconen als gesamplede, gevulde
contouren (~15 KB per icoon); dit script bouwt uit de `construction`-geometrie (polylijnen met
lijndikte, hoekafronding, cirkels en vlakken) dezelfde vorm als stroke-paden, ~50× kleiner. De export
is letterlijk `buffer(width/2, round, round)` van diezelfde lijnen, dus een stroke met ronde kappen en
verbindingen is er meetkundig gelijk aan. Twee gevallen kan een stroke niet: `clear_primary` (een halo
rond het accent, uit de hoofdkleur gesneden) en de vier `rounded_joint`-iconen met een bijzondere naad;
die krijgen de verliesvrije gevulde export, afgerond op twee decimalen.

Gebruik:
  python3 scripts/style-icons.py --repo ../OpenAEC-Style-Repo        # genereren uit een lokale checkout
  python3 scripts/style-icons.py                                      # genereren; haalt de gepinde bestanden van GitHub
  python3 scripts/style-icons.py --check                              # faalt als het gegenereerde bestand niet actueel is
  python3 scripts/style-icons.py --repo ../OpenAEC-Style-Repo --pin   # pin op de HEAD van die checkout en genereer
  python3 scripts/style-icons.py --catalog build/b2-catalog.json      # schrijft ook de catalogus (id, label, betekenis, bronvoorbeeld)

Welke iconen: alle B2-iconen met Planner als kandidaat-app, plus de ids in
`src/components/icons/b2/extra-ids.json` (algemene iconen die OPS verder nodig heeft).
Geen Node, geen afhankelijkheden buiten de standaardbibliotheek.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src/components/icons/b2"
LOCK = OUT_DIR / "b2.lock.json"
EXTRA_IDS = OUT_DIR / "extra-ids.json"
GENERATED = OUT_DIR / "icons.generated.ts"
REPO_URL = "https://github.com/OpenAEC-Foundation/OpenAEC-Style-Repo"
RAW_URL = "https://raw.githubusercontent.com/OpenAEC-Foundation/OpenAEC-Style-Repo"
MANIFEST = "design/icon-set-b2/manifest.json"
LOSSLESS = "design/icon-set-b2/library-lossless"
APP = "Planner"
SIZES = ("16", "24")
TONES = {"primary": 0, "accent": 1}
STROKE, FILL = 0, 1


# ---------------------------------------------------------------- bron

class Source:
    """De gepinde bestanden van de Style Repo: uit een lokale checkout of van GitHub."""

    def __init__(self, repo: Path | None, commit: str):
        self.repo = repo
        self.commit = commit
        self._cache: dict[str, bytes] = {}

    def read(self, path: str) -> bytes:
        if path in self._cache:
            return self._cache[path]
        if self.repo is not None:
            data = subprocess.run(["git", "-C", str(self.repo), "show", f"{self.commit}:{path}"],
                                  check=True, capture_output=True).stdout
        else:
            with urllib.request.urlopen(f"{RAW_URL}/{self.commit}/{path}", timeout=60) as response:
                data = response.read()
        self._cache[path] = data
        return data


def head_commit(repo: Path) -> str:
    return subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"], check=True,
                          capture_output=True, text=True).stdout.strip()


# ---------------------------------------------------------------- geometrie

def num(value: float) -> str:
    """Twee decimalen zonder overbodige nullen; -0 wordt 0."""
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return "0" if text in ("-0", "") else text


def xy(point) -> str:
    return f"{num(point[0])} {num(point[1])}"


def mix(a, b, t: float):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def rounded_corners(points, closed: bool, radius: float):
    """Per hoekpunt (inkomend, uitgaand) zoals `rounded_edges` in de Style Repo: de hoek wordt een
    kwadratische boog met het hoekpunt als controlepunt; uiteinden van een open lijn blijven scherp."""
    n = len(points)
    corners = []
    for i, v in enumerate(points):
        if not closed and i in (0, n - 1):
            corners.append((v, v))
            continue
        prev, nxt = points[(i - 1) % n], points[(i + 1) % n]
        before, after = math.dist(prev, v), math.dist(v, nxt)
        trim = min(radius, before * 0.32, after * 0.32)
        if trim <= 1e-9 or before <= 1e-9 or after <= 1e-9:
            corners.append((v, v))
            continue
        corners.append((mix(v, prev, trim / before), mix(v, nxt, trim / after)))
    return corners


def polyline_path(points, closed: bool, radius: float) -> str:
    points = [tuple(p) for p in points]
    n = len(points)
    if n == 1:
        return f"M{xy(points[0])}"
    corners = rounded_corners(points, closed, radius)

    def corner(i: int) -> str:
        incoming, outgoing = corners[i]
        v = points[i]
        if incoming == outgoing:
            return f"L{xy(v)}"
        return f"L{xy(incoming)}Q{xy(v)} {xy(outgoing)}"

    if closed:
        d = f"M{xy(corners[0][1])}"
        for i in range(1, n):
            d += corner(i)
        d += corner(0) + "Z"
        return d
    d = f"M{xy(points[0])}"
    for i in range(1, n - 1):
        d += corner(i)
    d += f"L{xy(points[n - 1])}"
    return d


def circle_path(x: float, y: float, r: float) -> str:
    rr = num(r)
    return f"M{num(x - r)} {num(y)}A{rr} {rr} 0 1 0 {num(x + r)} {num(y)}A{rr} {rr} 0 1 0 {num(x - r)} {num(y)}Z"


def rings_path(rings) -> str:
    return "".join("M" + "L".join(xy(p) for p in ring) + "Z" for ring in rings if len(ring) >= 3)


def round_export_path(d: str) -> str:
    """De verliesvrije export (zes decimalen) afronden op twee; 1/100 px is onzichtbaar bij 16 en 24 px."""
    return re.sub(r"-?\d+\.\d+", lambda m: num(float(m.group(0))), d)


def compact_parts(spec: dict, paint_order: list[str]) -> list[tuple[int, int, str]]:
    """De stroke-/vulonderdelen van één master, in tekenvolgorde (achterste kleur eerst)."""
    by_tone: dict[str, list[tuple[int, int, str]]] = {"primary": [], "accent": []}
    for path in spec["paths"]:
        by_tone[path["tone"]].append((STROKE, TONES[path["tone"]],
                                      polyline_path(path["points"], bool(path["closed"]), float(path["radius"]))))
    for circle in spec.get("circles", []):
        kind = FILL if circle["filled"] else STROKE
        by_tone[circle["tone"]].append((kind, TONES[circle["tone"]], circle_path(circle["x"], circle["y"], circle["r"])))
    for fill in spec.get("fills", []):
        by_tone[fill["tone"]].append((FILL, TONES[fill["tone"]], rings_path(fill["rings"])))
    return [part for tone in paint_order for part in by_tone[tone]]


def export_parts(svg: str) -> list[tuple[int, int, str]]:
    """De twee gevulde paden van de verliesvrije export, in de volgorde waarin de export ze tekent."""
    parts = []
    for tone, d in re.findall(r'<path data-part="(primary|accent)"[^>]*? d="([^"]*)"', svg):
        if d:
            parts.append((FILL, TONES[tone], round_export_path(d)))
    return parts


def needs_export(icon: dict, spec: dict) -> bool:
    return bool(spec.get("clear_primary")) or bool(icon.get("rounded_joint"))


# ---------------------------------------------------------------- uitvoer

def ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def build(source: Source, lock: dict, extra_ids: list[str], catalog_path: Path | None):
    manifest_bytes = source.read(MANIFEST)
    manifest_sha = hashlib.sha256(manifest_bytes).hexdigest()
    manifest = json.loads(manifest_bytes)
    by_id = {icon["id"]: icon for icon in manifest["icons"]}
    missing = [i for i in extra_ids if i not in by_id]
    if missing:
        raise SystemExit(f"extra-ids.json noemt onbekende B2-iconen: {', '.join(missing)}")
    chosen = sorted({i["id"] for i in manifest["icons"] if APP in (i.get("candidate_apps") or [])} | set(extra_ids))

    defs = []
    export_used = []
    for icon_id in chosen:
        icon = by_id[icon_id]
        masters = {}
        for size in SIZES:
            spec = icon["construction"][size]
            if needs_export(icon, spec):
                svgz = source.read(f"{LOSSLESS}/{size}/{icon_id}.svgz")
                parts = export_parts(gzip.decompress(svgz).decode("utf-8"))
                export_used.append(f"{icon_id}@{size}")
            else:
                parts = compact_parts(spec, icon["paint_order"])
            masters[size] = (float(spec["width"]), parts)
        defs.append((icon_id, icon, masters))

    lines = [
        f"// Gegenereerd door scripts/style-icons.py uit {REPO_URL} @ {lock['styleRepoCommit'][:12]}",
        f"// (B2-revisie {manifest['revision']}, {len(defs)} iconen). Niet met de hand bewerken; zie de kop van dat script.",
        "// Bron en licentie van de iconen: de Style Repo (voorlopig LGPL-3.0-only, besluit over een eigen",
        "// iconenlicentie open in issue #15 daar). Hoofdkleur `currentColor`, accent `var(--icon-accent)`.",
        "",
        "/** Eén tekenonderdeel: soort (0 = lijn met ronde kappen, 1 = vlak evenodd), kleur (0 = hoofd, 1 = accent), pad. */",
        "export type IconPart = readonly [kind: 0 | 1, tone: 0 | 1, d: string];",
        "",
        "/** Eén master (16 of 24 px): lijndikte en onderdelen in tekenvolgorde. */",
        "export interface IconMaster { readonly w: number; readonly parts: readonly IconPart[]; }",
        "",
        "export interface IconDef {",
        "  readonly s16: IconMaster;",
        "  readonly s24: IconMaster;",
        "  /** Het hele icoon in de accentkleur (Style Repo: `whole_icon_accent`). */",
        "  readonly accent?: true;",
        "  /** Statuskleur uit het thema (Style Repo: `semantic_color`). */",
        "  readonly semantic?: 'error' | 'success' | 'warning' | 'info' | 'text-secondary';",
        "}",
        "",
        "export type IconId =",
    ]
    lines += [f"  | {ts_string(icon_id)}" for icon_id, _, _ in defs]
    lines[-1] += ";"
    lines += ["", "export const B2_ICONS: Readonly<Record<IconId, IconDef>> = {"]
    for icon_id, icon, masters in defs:
        flags = ""
        if icon.get("whole_icon_accent"):
            flags += " accent: true,"
        if icon.get("semantic_color"):
            flags += f" semantic: {ts_string(icon['semantic_color'])},"
        lines.append(f"  {ts_string(icon_id)}: {{{flags}")
        for size in SIZES:
            width, parts = masters[size]
            parts_ts = ", ".join(f"[{k}, {t}, {ts_string(d)}]" for k, t, d in parts)
            lines.append(f"    s{size}: {{ w: {width:g}, parts: [{parts_ts}] }},")
        lines.append("  },")
    lines += ["};", ""]
    generated = "\n".join(lines)

    catalog = None
    if catalog_path is not None:
        catalog = []
        for icon in manifest["icons"]:
            example = icon.get("source_example") or {}
            catalog.append({
                "id": icon["id"], "label": icon.get("label"), "group": icon.get("group"),
                "meaning": icon.get("meaning"), "apps": icon.get("candidate_apps") or [],
                "planner": APP in (icon.get("candidate_apps") or []),
                "example": {k: example.get(k) for k in ("app", "name", "path", "line", "context")} if example else None,
            })
    return generated, manifest_sha, manifest["revision"], export_used, catalog


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo", type=Path, help="lokale checkout van de Style Repo (anders: GitHub op de gepinde commit)")
    parser.add_argument("--pin", action="store_true", help="pin op de HEAD van --repo en schrijf b2.lock.json")
    parser.add_argument("--check", action="store_true", help="alleen controleren; niets schrijven")
    parser.add_argument("--catalog", type=Path, help="schrijf de volledige B2-catalogus als JSON naar dit pad")
    args = parser.parse_args()

    lock = json.loads(LOCK.read_text(encoding="utf-8")) if LOCK.exists() else {}
    if args.pin:
        if args.repo is None:
            parser.error("--pin vraagt --repo")
        lock = {"styleRepo": REPO_URL, "styleRepoCommit": head_commit(args.repo)}
    if not lock.get("styleRepoCommit"):
        parser.error("geen gepinde commit: geef --repo met --pin, of maak src/components/icons/b2/b2.lock.json")

    extra_ids = json.loads(EXTRA_IDS.read_text(encoding="utf-8")) if EXTRA_IDS.exists() else []
    source = Source(args.repo, lock["styleRepoCommit"])
    generated, manifest_sha, revision, export_used, catalog = build(source, lock, extra_ids, args.catalog)

    new_lock = {"styleRepo": REPO_URL, "styleRepoCommit": lock["styleRepoCommit"],
                "b2Revision": revision, "manifestSha256": manifest_sha}
    if args.check:
        problems = []
        if lock.get("manifestSha256") != manifest_sha or lock.get("b2Revision") != revision:
            problems.append("b2.lock.json past niet bij het manifest op de gepinde commit")
        if not GENERATED.exists() or GENERATED.read_text(encoding="utf-8") != generated:
            problems.append(f"{GENERATED.relative_to(ROOT)} is niet actueel; draai scripts/style-icons.py")
        for problem in problems:
            print(f"style-icons: {problem}", file=sys.stderr)
        print(f"style-icons: {'ROOD' if problems else 'GROEN'} ({len(generated.splitlines())} regels, B2-revisie {revision})")
        return 1 if problems else 0

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED.write_text(generated, encoding="utf-8")
    LOCK.write_text(json.dumps(new_lock, indent=2) + "\n", encoding="utf-8")
    if args.catalog is not None and catalog is not None:
        args.catalog.parent.mkdir(parents=True, exist_ok=True)
        args.catalog.write_text(json.dumps(catalog, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"style-icons: {GENERATED.relative_to(ROOT)} geschreven ({len(generated.encode('utf-8')) / 1024:.0f} KB, "
          f"B2-revisie {revision}, {len(export_used)} masters uit de gevulde export: {', '.join(export_used)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
