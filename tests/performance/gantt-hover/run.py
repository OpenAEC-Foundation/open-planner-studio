"""Begrensde voor/nameting op één GitHub-runner, met dezelfde browserharnasbestanden."""
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess


ROOT = Path.cwd()
BASE = os.environ["PERF_BASE_REVISION"]
assert len(BASE) == 40 and all(c in "0123456789abcdef" for c in BASE), BASE
OUT = ROOT / "output" / "gantt-hover-comparison"
OUT.mkdir(parents=True, exist_ok=True)
BEFORE = Path(os.environ["RUNNER_TEMP"]) / "gantt-hover-before"
HOOK = "src/components/canvas/hooks/useGanttHistogramInteraction.ts"
SPEC = "tests/browser/gantt-histogram.spec.ts"
HARNESS = "tests/performance/gantt-hover"


def git(*args, cwd=ROOT):
    return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()


def run(args, *, cwd=ROOT, env=None, timeout=180):
    result = subprocess.run(args, cwd=cwd, env=env, timeout=timeout, check=False)
    print(f"Exitcode {result.returncode}: {' '.join(args)}", flush=True)
    if result.returncode:
        raise SystemExit(result.returncode)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


head = git("rev-parse", "HEAD")
git("merge-base", "--is-ancestor", BASE, head)
assert git("diff", "--name-only", BASE, head, "--", "package.json", "package-lock.json") == ""
changed_product = git("diff", "--name-only", BASE, head, "--", "src").splitlines()
assert changed_product == [HOOK], changed_product
run(["git", "worktree", "add", "--detach", str(BEFORE), BASE])
try:
    # Alleen harnasoverlays; de volledige productboom vóór blijft exact gelijk aan BASE.
    shutil.copy2(ROOT / SPEC, BEFORE / SPEC)
    shutil.copytree(ROOT / HARNESS, BEFORE / HARNESS)
    (BEFORE / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)
    assert git("diff", "--name-only", "--", "src", cwd=BEFORE) == ""
    provenance = {
        "runId": os.environ["GITHUB_RUN_ID"], "attempt": os.environ["GITHUB_RUN_ATTEMPT"],
        "runner": platform.platform(), "base": BASE, "head": head,
        "order": ["before-1", "after-1", "after-2", "before-2"],
        "productTrees": {"before": git("rev-parse", "HEAD:src", cwd=BEFORE),
                         "after": git("rev-parse", "HEAD:src")},
        "hookSha256": {"before": digest(BEFORE / HOOK), "after": digest(ROOT / HOOK)},
        "harnessSha256": {path: digest(ROOT / path) for path in [SPEC, f"{HARNESS}/measure.ts", f"{HARNESS}/run.py",
                                                              ".github/workflows/measure-gantt-hover.yml"]},
    }
    assert digest(BEFORE / SPEC) == digest(ROOT / SPEC)
    assert digest(BEFORE / HARNESS / "measure.ts") == digest(ROOT / HARNESS / "measure.ts")
    (OUT / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    results = {}
    for label in provenance["order"]:
        cwd = BEFORE if label.startswith("before") else ROOT
        output = OUT / f"{label}.json"
        env = dict(os.environ, OPS_MEASURE_GANTT_HOVER="1", OPS_GANTT_HOVER_OUT=str(output))
        run(["node", "scripts/run-browser-tests.mjs", SPEC, "--grep", "histogram picker wisselt"], cwd=cwd, env=env)
        results[label] = json.loads(output.read_text())
        assert results[label]["commit"] == (BASE if label.startswith("before") else head)
        # Bewaar visueel bewijs van beide kanten, ook wanneer de volgende browserstart opruimt.
        screenshots = list((cwd / "test-results").rglob("histogram-hover.png"))
        assert screenshots, label
        shutil.copy2(screenshots[0], OUT / f"{label}.png")
    reference = results["before-1"]
    for label, result in results.items():
        assert result["fixture"] == reference["fixture"], label
        assert result["environment"] == reference["environment"], label
        assert len(result["samples"]) == len(reference["samples"]), label
        for expected, actual in zip(reference["samples"], result["samples"]):
            for key in ["label", "isoDate", "lines", "contributors", "contributorsHash", "before", "after", "fixedDelayMs"]:
                assert actual[key] == expected[key], (label, actual["label"], key)
    rows = []
    for label, result in results.items():
        for sample in result["samples"]:
            rows.append({"run": label, "sample": sample["label"], "eventToTooltipMs": sample["eventToTooltipMs"],
                         "fixedDelayMs": sample["fixedDelayMs"], "timerWaitMs": sample["timerWaitMs"],
                         "callbackMs": sample["callbackMs"]})
    (OUT / "times.json").write_text(json.dumps(rows, indent=2) + "\n")
    print(json.dumps(rows, indent=2), flush=True)
    print("Exacte tooltiptekst, volledige referentiebijdragers en invoer-/storehashes gelijk in alle vier browserruns.", flush=True)
finally:
    # Bewijs uit de baseline bewaren bij een mislukte browsercheck.
    if (BEFORE / "test-results").exists():
        shutil.copytree(BEFORE / "test-results", OUT / "baseline-test-results", dirs_exist_ok=True)
    run(["git", "worktree", "remove", "--force", str(BEFORE)], timeout=30)
