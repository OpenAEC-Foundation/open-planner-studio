"""Vergelijk bewijs uit één CI-job; tijden beschrijven de toetsenroute, geen losse adapter."""

import json
import math
import statistics
import sys
from pathlib import Path


def compare(folder: Path, base_sha: str, head_sha: str) -> dict:
    def read(name: str) -> dict:
        return json.loads((folder / name).read_text())

    base_contract = read("base-contract.json")
    head_contract = read("head-contract.json")
    assert base_contract["cases"] == head_contract["cases"] == 4800
    assert [row["count"] for row in base_contract["budgets"]] == [1000, 5000, 10000]
    assert [row["count"] for row in head_contract["budgets"]] == [1000, 5000, 10000]
    for before, after in zip(base_contract["budgets"], head_contract["budgets"]):
        n = before["count"]
        assert before["outputSha256"] == after["outputSha256"]
        assert before["rhsReads"] == n * (n + 1) // 2
        assert after["rhsReads"] <= n

    base = read("base-browser.json")
    head = read("head-browser.json")
    assert base["revision"] == base_sha
    assert head["revision"] == head_sha
    expected = [(20, False), (20, True), (1000, True), (5000, True), (10000, True)]
    assert [(r["count"], r["sorted"]) for r in base["reports"]] == expected
    assert [(r["count"], r["sorted"]) for r in head["reports"]] == expected
    comparisons = []
    for before, after in zip(base["reports"], head["reports"]):
        n = before["count"]
        assert before["columns"] == after["columns"]
        runs = 5 if n > 20 else 1
        for report in (before, after):
            assert report["runs"] == runs
            assert report["warmups"] == (2 if n > 20 else 0)
            assert len(report["samplesMs"]) == len(report["outputHashes"]) == runs
            assert all(math.isfinite(t) and t > 0 for t in report["samplesMs"])
        assert len(set(before["outputHashes"] + after["outputHashes"])) == 1
        before_ms = statistics.median(before["samplesMs"])
        after_ms = statistics.median(after["samplesMs"])
        comparisons.append({
            "count": n, "sorted": before["sorted"],
            "baseSamplesMs": before["samplesMs"], "headSamplesMs": after["samplesMs"],
            "baseMedianMs": before_ms, "headMedianMs": after_ms,
            "medianRatioBaseOverHead": before_ms / after_ms,
            "outputSha256": before["outputHashes"][0],
        })
    return {
        "base": base_sha, "head": head_sha, "timing": head["description"],
        "note": "Eén runner, achtereenvolgens basis en head, twee opwarmingen en vijf samples per grote fixture. Geen productiebuild en geen harde tijdpoort; werkbudget en uitvoergelijkheid zijn wel poorten.",
        "baseContract": base_contract, "headContract": head_contract, "comparisons": comparisons,
    }


if __name__ == "__main__":
    folder = Path(sys.argv[1])
    result = compare(folder, sys.argv[2], sys.argv[3])
    output = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
    (folder / "comparison.json").write_text(output)
    print(output)
