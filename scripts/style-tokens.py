#!/usr/bin/env python3
"""Haal de OpenAEC-tokens (web/openaec-tokens.css) uit de OpenAEC-Blueprint en zet ze in OPS.

Bron: https://github.com/OpenAEC-Foundation/OpenAEC-Blueprint, vastgezet op een release-tag in
`src/styles/openaec-tokens.lock.json` ({"tag", "commit", "path", "sha256"}). Het bestand komt
byte-identiek in `src/styles/openaec-tokens.css`; `globals.css` importeert het en leidt de
`--theme-*`-variabelen er per thema uit af (het brugblok).

Gebruik:
  python3 scripts/style-tokens.py                 # haal de vastgezette tag op en schrijf opnieuw
  python3 scripts/style-tokens.py --check         # exit 1 als de repo afwijkt van de vastgezette tag
  python3 scripts/style-tokens.py --tag v2026.45.1  # zet een andere tag vast en schrijf opnieuw
  python3 scripts/style-tokens.py --latest        # print de tag van de nieuwste Blueprint-release

Het bestand wordt bij de commit van de tag opgehaald, niet bij de tagnaam: een verplaatste tag
geeft zo een duidelijke fout in plaats van stil andere kleuren. Een `GITHUB_TOKEN` in de omgeving
wordt meegestuurd (hogere limiet in CI), maar is niet nodig. Alleen de standaardbibliotheek.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "src/styles/openaec-tokens.css"
LOCK = ROOT / "src/styles/openaec-tokens.lock.json"
OWNER_REPO = "OpenAEC-Foundation/OpenAEC-Blueprint"
SOURCE_PATH = "web/openaec-tokens.css"
API = f"https://api.github.com/repos/{OWNER_REPO}"
RAW = f"https://raw.githubusercontent.com/{OWNER_REPO}"


def fetch(url: str, *, api: bool) -> bytes:
    headers = {"User-Agent": "open-planner-studio-style-tokens"}
    if api:
        headers["Accept"] = "application/vnd.github+json"
        token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
        if token:
            headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        raise SystemExit(f"style-tokens: {url} gaf HTTP {error.code}") from error
    except urllib.error.URLError as error:
        raise SystemExit(f"style-tokens: {url} niet bereikbaar ({error.reason})") from error


def api_json(path: str) -> dict:
    return json.loads(fetch(f"{API}/{path}", api=True))


def latest_tag() -> str:
    tag = api_json("releases/latest").get("tag_name")
    if not tag:
        raise SystemExit("style-tokens: de nieuwste Blueprint-release heeft geen tag")
    return tag


def tag_commit(tag: str) -> str:
    """De commit achter een tag; een geannoteerde tag wordt eerst afgepeld."""
    obj = api_json(f"git/ref/tags/{tag}")["object"]
    while obj["type"] == "tag":
        obj = api_json(f"git/tags/{obj['sha']}")["object"]
    if obj["type"] != "commit":
        raise SystemExit(f"style-tokens: tag {tag} wijst niet naar een commit ({obj['type']})")
    return obj["sha"]


def build(tag: str) -> tuple[bytes, dict]:
    commit = tag_commit(tag)
    data = fetch(f"{RAW}/{commit}/{SOURCE_PATH}", api=False)
    lock = {
        "source": f"https://github.com/{OWNER_REPO}",
        "tag": tag,
        "commit": commit,
        "path": SOURCE_PATH,
        "sha256": hashlib.sha256(data).hexdigest(),
    }
    return data, lock


def lock_text(lock: dict) -> str:
    return json.dumps(lock, indent=2) + "\n"


def read_lock() -> dict:
    if not LOCK.exists():
        raise SystemExit(f"style-tokens: {LOCK.relative_to(ROOT)} ontbreekt; zet een tag vast met --tag <tag>")
    return json.loads(LOCK.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="alleen controleren; niets schrijven")
    mode.add_argument("--tag", help="zet deze Blueprint-tag vast en schrijf opnieuw")
    mode.add_argument("--latest", action="store_true", help="print de tag van de nieuwste Blueprint-release")
    args = parser.parse_args()

    if args.latest:
        print(latest_tag())
        return 0

    tag = args.tag or read_lock().get("tag")
    if not tag:
        raise SystemExit("style-tokens: het lockbestand heeft geen tag")
    data, lock = build(tag)

    if args.check:
        problems = []
        old = read_lock()
        if old.get("commit") != lock["commit"]:
            problems.append(f"tag {tag} wijst nu naar {lock['commit'][:12]}, het lockbestand zegt "
                            f"{str(old.get('commit'))[:12]}")
        if LOCK.read_text(encoding="utf-8") != lock_text(lock):
            problems.append(f"{LOCK.relative_to(ROOT)} past niet bij {tag}")
        if not TARGET.exists() or TARGET.read_bytes() != data:
            problems.append(f"{TARGET.relative_to(ROOT)} wijkt af van {SOURCE_PATH} op {tag}")
        if problems:
            for problem in problems:
                print(f"style-tokens: {problem}", file=sys.stderr)
            print("style-tokens: draai `python3 scripts/style-tokens.py` en commit het resultaat", file=sys.stderr)
            return 1
        print(f"style-tokens: actueel ({tag} @ {lock['commit'][:12]})")
        return 0

    TARGET.write_bytes(data)
    LOCK.write_text(lock_text(lock), encoding="utf-8")
    print(f"style-tokens: {TARGET.relative_to(ROOT)} geschreven uit {tag} @ {lock['commit'][:12]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
