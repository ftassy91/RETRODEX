import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
QA_PATH = ROOT / "demo_subset_qa.json"
COVERAGE_PATH = ROOT / "market_coverage_report.json"
OUT_JSON = ROOT / "demo_status.json"
OUT_JS = ROOT / "demo_status.js"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    qa = read_json(QA_PATH)
    coverage = read_json(COVERAGE_PATH)

    counts = qa.get("counts", {})
    status = {
        "generatedAt": "2026-03-14",
        "showcaseGames": counts.get("games", 0),
        "showcaseConsoles": 4,
        "topCardsReady": counts.get("withAnyLocalTopAsset", 0),
        "bottomCardsReady": counts.get("bottomCardReady", 0),
        "verifiedSalesGames": coverage.get("sales_games", 0),
        "verifiedHistoryGames": coverage.get("history_games", 0),
        "trackedGames": coverage.get("tracked_games", 0),
    }

    OUT_JSON.write_text(json.dumps(status, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    OUT_JS.write_text("window.RETRODEX_DEMO_STATUS = " + json.dumps(status, indent=2, ensure_ascii=False) + ";\n", encoding="utf-8")

    print(f"Wrote {OUT_JSON}")
    print(f"Wrote {OUT_JS}")


if __name__ == "__main__":
    main()
