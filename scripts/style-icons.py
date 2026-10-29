#!/usr/bin/env python3
"""Genereer de B2-iconen van de OpenAEC-Blueprint als compacte SVG-paden voor OPS.

Bron: `design/icon-set-b2/manifest.json` in https://github.com/OpenAEC-Foundation/OpenAEC-Blueprint
(vroeger de Style Repo), vastgezet op één release-tag in `src/components/icons/b2/b2.lock.json`
(`tag` + `commit` van die tag). De bestanden worden opgehaald op de commit uit het lockbestand, zodat een
verplaatste tag de uitvoer niet stilletjes verandert.

De Blueprint exporteert de iconen als gesamplede, gevulde contouren (~15 KB per icoon); dit script bouwt
uit de `construction`-geometrie (polylijnen met lijndikte, hoekafronding, cirkels en vlakken) dezelfde vorm
als stroke-paden, ~50× kleiner. De export is letterlijk `buffer(width/2, round, round)` van diezelfde
lijnen, dus een stroke met ronde kappen en verbindingen is er meetkundig gelijk aan. Twee gevallen kan een
stroke niet: `clear_primary` (een halo rond het accent, uit de hoofdkleur gesneden) en de
`rounded_joint`-iconen met een bijzondere naad; die krijgen de verliesvrije gevulde export, afgerond op
twee decimalen.

Gebruik (zelfde vorm als `scripts/style-tokens.py`):
  python3 scripts/style-icons.py                  # haal de vastgezette tag op en schrijf de bestanden opnieuw
  python3 scripts/style-icons.py --check          # genereer in het geheugen; exit 1 als de repo afwijkt
  python3 scripts/style-icons.py --tag v2026.45.1 # zet een andere tag vast en genereer opnieuw
  python3 scripts/style-icons.py --latest         # print de tag van de nieuwste Blueprint-release, verder niets
  python3 scripts/style-icons.py --report r.md    # schrijf ook het rapport (ontbrekende iconen) als Markdown

Welke iconen: alle B2-iconen met Planner als kandidaat-app, plus de ids in
`src/components/icons/b2/extra-ids.json` (algemene iconen die OPS verder nodig heeft). Staat een icoon dat
de code gebruikt niet meer in de Blueprint, dan noemt het script dat icoon met elk bestand en elke regel
waar het voorkomt (de typecheck faalt daarna ook, want `IconId` kent het niet meer).

Alleen de standaardbibliotheek. `GITHUB_TOKEN` (als die er is) gaat mee naar de GitHub-API.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src/components/icons/b2"
LOCK = OUT_DIR / "b2.lock.json"
EXTRA_IDS = OUT_DIR / "extra-ids.json"
GENERATED = OUT_DIR / "icons.generated.ts"
SCAN_DIRS = ("src", "tests/browser")
OWNER_REPO = "OpenAEC-Foundation/OpenAEC-Blueprint"
REPO_URL = f"https://github.com/{OWNER_REPO}"
RAW_URL = f"https://raw.githubusercontent.com/{OWNER_REPO}"
API_URL = f"https://api.github.com/repos/{OWNER_REPO}"
MANIFEST = "design/icon-set-b2/manifest.json"
LOSSLESS = "design/icon-set-b2/library-lossless"
APP = "Planner"
SIZES = ("16", "24")
TONES = {"primary": 0, "accent": 1}
STROKE, FILL = 0, 1
ID_LITERAL = re.compile(r"""['"`]([a-z0-9-]+\.[a-z0-9-]+)['"`]""")


# ---------------------------------------------------------------- bron

def fetch(url: str, *, api: bool = False) -> bytes:
    headers = {"User-Agent": "open-planner-studio/style-icons"}
    if api:
        headers["Accept"] = "application/vnd.github+json"
        token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
        if token:
            headers["Authorization"] = f"Bearer {token}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as response:
        return response.read()


def latest_tag() -> str:
    try:
        return json.loads(fetch(f"{API_URL}/releases/latest", api=True))["tag_name"]
    except Exception:  # API-limiet zonder token: de redirect van de releasepagina noemt dezelfde tag
        request = urllib.request.Request(f"{REPO_URL}/releases/latest", method="HEAD",
                                         headers={"User-Agent": "open-planner-studio/style-icons"})
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.geturl().rstrip("/").rsplit("/", 1)[-1]


def commit_of_tag(tag: str) -> str:
    """De commit achter een tag; een geannoteerde tag wordt doorverwezen naar zijn commit."""
    obj = json.loads(fetch(f"{API_URL}/git/ref/tags/{tag}", api=True))["object"]
    while obj["type"] == "tag":
        obj = json.loads(fetch(obj["url"], api=True))["object"]
    return obj["sha"]


class Source:
    """De bestanden van de Blueprint op de vastgezette commit."""

    def __init__(self, commit: str):
        self.commit = commit
        self._cache: dict[str, bytes] = {}

    def read(self, path: str) -> bytes:
        if path not in self._cache:
            self._cache[path] = fetch(f"{RAW_URL}/{self.commit}/{path}")
        return self._cache[path]


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


def build(source: Source, lock: dict, extra_ids: list[str], catalog_wanted: bool):
    manifest_bytes = source.read(MANIFEST)
    manifest_sha = hashlib.sha256(manifest_bytes).hexdigest()
    manifest = json.loads(manifest_bytes)
    by_id = {icon["id"]: icon for icon in manifest["icons"]}
    chosen = sorted({i["id"] for i in manifest["icons"] if APP in (i.get("candidate_apps") or [])}
                    | {i for i in extra_ids if i in by_id})

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
        f"// Gegenereerd door scripts/style-icons.py uit {REPO_URL} @ {lock['tag']} ({lock['commit'][:12]})",
        f"// (B2-revisie {manifest['revision']}, {len(defs)} iconen). Niet met de hand bewerken; zie de kop van dat script.",
        "// Bron en licentie van de iconen: de Blueprint (voorlopig LGPL-3.0-only, besluit over een eigen",
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
        "  /** Het hele icoon in de accentkleur (Blueprint: `whole_icon_accent`). */",
        "  readonly accent?: true;",
        "  /** Statuskleur uit het thema (Blueprint: `semantic_color`). */",
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
    if catalog_wanted:
        catalog = []
        for icon in manifest["icons"]:
            example = icon.get("source_example") or {}
            catalog.append({
                "id": icon["id"], "label": icon.get("label"), "group": icon.get("group"),
                "meaning": icon.get("meaning"), "apps": icon.get("candidate_apps") or [],
                "planner": APP in (icon.get("candidate_apps") or []),
                "example": {k: example.get(k) for k in ("app", "name", "path", "line", "context")} if example else None,
            })
    return generated, manifest_sha, manifest["revision"], set(by_id), export_used, catalog


# ---------------------------------------------------------------- iconen die uit de Blueprint verdwenen

def known_ids() -> set[str]:
    """De ids die OPS nu kent: de `IconId`-union van het huidige gegenereerde bestand plus extra-ids.json."""
    ids: set[str] = set()
    if GENERATED.exists():
        ids |= set(re.findall(r'^  \| "([^"]+)"', GENERATED.read_text(encoding="utf-8"), re.M))
    if EXTRA_IDS.exists():
        ids |= set(json.loads(EXTRA_IDS.read_text(encoding="utf-8")))
    return ids


def usages(ids: set[str]) -> dict[str, list[str]]:
    """Per id elke plek (`pad:regel`) in de code en de browsertests waar het als tekst voorkomt."""
    found: dict[str, list[str]] = {i: [] for i in ids}
    if not ids:
        return found
    for base in SCAN_DIRS:
        for path in sorted((ROOT / base).rglob("*")):
            if path.suffix not in (".ts", ".tsx") or path == GENERATED or not path.is_file():
                continue
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                for match in ID_LITERAL.finditer(line):
                    if match.group(1) in found:
                        found[match.group(1)].append(f"{path.relative_to(ROOT)}:{number}")
    return found


def removed_report(lost: set[str], tag: str) -> str:
    if not lost:
        return ""
    places = usages(lost)
    lines = [f"### Iconen die niet meer in de Blueprint staan ({tag})", "",
             "Deze iconen gebruikt OPS nog, maar de Blueprint levert ze niet meer. Kies per plek een ander B2-icoon",
             "(of haal het id uit `src/components/icons/b2/extra-ids.json`); tot dan faalt de typecheck.", ""]
    for icon_id in sorted(lost):
        where = places.get(icon_id) or []
        lines.append(f"- `{icon_id}`" + ("" if where else " (geen plek in de code gevonden; alleen in extra-ids.json)"))
        lines += [f"  - `{place}`" for place in where]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="genereer in het geheugen; exit 1 als de bestanden in de repo afwijken")
    mode.add_argument("--tag", help="zet deze Blueprint-tag vast en genereer opnieuw")
    mode.add_argument("--latest", action="store_true", help="print de tag van de nieuwste Blueprint-release en niets anders")
    parser.add_argument("--report", type=Path, help="schrijf het rapport (ontbrekende iconen) als Markdown naar dit pad")
    parser.add_argument("--catalog", type=Path, help="schrijf ook de volledige B2-catalogus als JSON naar dit pad")
    args = parser.parse_args()

    if args.latest:
        print(latest_tag())
        return 0

    lock = json.loads(LOCK.read_text(encoding="utf-8")) if LOCK.exists() else {}
    if args.tag:
        lock = {"tag": args.tag, "commit": commit_of_tag(args.tag)}
    if not lock.get("tag") or not lock.get("commit"):
        parser.error(f"{LOCK.relative_to(ROOT)} mist `tag` of `commit`; zet een tag vast met --tag")

    extra_ids = json.loads(EXTRA_IDS.read_text(encoding="utf-8")) if EXTRA_IDS.exists() else []
    before = known_ids()
    generated, manifest_sha, revision, blueprint_ids, export_used, catalog = build(
        Source(lock["commit"]), lock, extra_ids, args.catalog is not None)
    report = removed_report(before - blueprint_ids, lock["tag"])
    if args.report is not None:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(report, encoding="utf-8")
    if report:
        print(report, file=sys.stderr)

    new_lock = {"blueprint": REPO_URL, "tag": lock["tag"], "commit": lock["commit"],
                "b2Revision": revision, "manifestSha256": manifest_sha}
    if args.check:
        problems = []
        if lock != new_lock:
            problems.append(f"{LOCK.relative_to(ROOT)} past niet bij het manifest op {lock['tag']} ({lock['commit'][:12]})")
        if not GENERATED.exists() or GENERATED.read_text(encoding="utf-8") != generated:
            problems.append(f"{GENERATED.relative_to(ROOT)} wijkt af van wat {lock['tag']} oplevert; "
                            "draai `python3 scripts/style-icons.py` en commit het resultaat")
        if report:
            problems.append("de code gebruikt iconen die niet in de Blueprint staan (zie hierboven)")
        for problem in problems:
            print(f"style-icons: {problem}", file=sys.stderr)
        print(f"style-icons: {'ROOD' if problems else 'GROEN'} ({lock['tag']}, B2-revisie {revision})")
        return 1 if problems else 0

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED.write_text(generated, encoding="utf-8")
    LOCK.write_text(json.dumps(new_lock, indent=2) + "\n", encoding="utf-8")
    if args.catalog is not None and catalog is not None:
        args.catalog.parent.mkdir(parents=True, exist_ok=True)
        args.catalog.write_text(json.dumps(catalog, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"style-icons: {GENERATED.relative_to(ROOT)} geschreven voor {lock['tag']} "
          f"({len(generated.encode('utf-8')) / 1024:.0f} KB, B2-revisie {revision}, "
          f"{len(export_used)} masters uit de gevulde export)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
