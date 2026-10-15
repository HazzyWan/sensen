"""Write the item list for the scan test page (web/public/scan-test/items.js).

Only items with a fresh price somewhere are included (about 300), since those
are the ones a scan can be matched to. Each gets an English label for the
image model ("egg, Eggs, Telur Itik") and the search words used for barcode matching.

Run from the repo root, after the pipeline (it reads api/data):
    python research/make_scan_items.py
"""

import json
import re
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, "pipeline")
from publish import ENGLISH  # the BM -> English word map the search uses

DATA = Path("api/data")
OUT = Path("web/public/scan-test/items.js")


def label(name, category):
    """English words, the English category, then the name: 'egg, Eggs, Telur Itik'."""
    words = re.findall(r"[A-Z]+", name.upper())
    english = []
    for w in words:
        for e in ENGLISH.get(w, "").split():
            if e not in english:
                english.append(e)
    return ", ".join(part for part in [" ".join(english), category, name.title()] if part)


def main():
    items = pd.read_parquet(DATA / "items.parquet")
    priced = set(pd.read_parquet(DATA / "latest_prices.parquet", columns=["item_code"])["item_code"])
    items = items[items["item_code"].isin(priced)]
    rows = []
    for r in items.sort_values("item").itertuples():
        category = r.category_en if isinstance(r.category_en, str) else r.item_category.title()
        rows.append({"code": int(r.item_code), "name": r.item, "unit": r.unit, "category": category,
                     "label": label(r.item, category), "search": r.search})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("// Made by research/make_scan_items.py. Do not edit by hand.\n"
                   f"window.SCAN_ITEMS = {json.dumps(rows, ensure_ascii=False)};\n", encoding="utf-8")
    print(f"{len(rows)} items written to {OUT}")


if __name__ == "__main__":
    main()