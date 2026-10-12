"""SenSen API: serves the tables the pipeline builds.

Run from the repo root (after pipeline/run.py):
    fastapi dev api/main.py
Then open http://127.0.0.1:8000/docs
"""

import re
from datetime import date
from pathlib import Path
from typing import Literal

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

CLEAN_DIR = Path("data/clean")
SERVE_DIR = Path("data/serve")

app = FastAPI(
    title="SenSen API",
    version="0.2.0",
    description="Grocery prices for Selangor and Kuala Lumpur, from PriceCatcher (KPDN, DOSM, CC BY 4.0).",
)

# ---------- Data, loaded once when the server starts ----------

weekly = pd.read_parquet(CLEAN_DIR / "weekly.parquet")
labels = pd.read_parquet(CLEAN_DIR / "labels.parquet")
items = pd.read_parquet(SERVE_DIR / "items.parquet")
latest = pd.read_parquet(SERVE_DIR / "latest_prices.parquet")

# district -> region, e.g. "Petaling" -> "Selangor"
DISTRICT_REGION = (latest[["district", "region"]].drop_duplicates()
                   .set_index("district")["region"].to_dict())

# (area, item_code) -> label row, for fast lookups
LABEL_BY_AREA = {(r.area, r.item_code): r for r in labels.itertuples()}

# ---------- Response shapes (these also drive the /docs page) ----------

Label = Literal["High", "Normal", "Low"]


class Meta(BaseModel):
    latest_week: date
    first_week: date
    weeks: int
    regions: list[str]
    districts: int
    items_with_label: int
    source: str


class Area(BaseModel):
    district: str
    region: str
    shops: int


class SearchResult(BaseModel):
    item_code: int
    name: str
    unit: str
    category: str
    cheapest_price: float
    cheapest_shop: str
    cheapest_chain: str
    price_date: date
    shops_with_price: int
    label: Label | None
    label_scope: Literal["district", "region"] | None


# ---------- Helpers ----------

def check_district(district: str) -> str:
    if district not in DISTRICT_REGION:
        raise HTTPException(404, f"Unknown district '{district}'. See /areas for valid names.")
    return DISTRICT_REGION[district]


def label_for(item_code: int, district: str, region: str):
    """District label if there is one, otherwise fall back to the region's."""
    for area, scope in [(district, "district"), (region, "region")]:
        row = LABEL_BY_AREA.get((area, item_code))
        if row is not None:
            return row.label, scope
    return None, None


# ---------- Endpoints ----------

@app.get("/health")
def health():
    """Quick check that the server is up."""
    return {"status": "ok"}


@app.get("/meta", response_model=Meta)
def meta():
    """What data the API is serving: date range, regions and how many items."""
    return Meta(
        latest_week=weekly["week"].max().date(),
        first_week=weekly["week"].min().date(),
        weeks=weekly["week"].nunique(),
        regions=sorted(weekly.loc[weekly["area_type"] == "region", "area"].unique()),
        districts=weekly.loc[weekly["area_type"] == "district", "area"].nunique(),
        items_with_label=labels["item_code"].nunique(),
        source="PriceCatcher, KPDN and DOSM, via data.gov.my (CC BY 4.0)",
    )


@app.get("/areas", response_model=list[Area])
def areas():
    """Districts the app can show, for the district picker."""
    counts = latest.groupby(["district", "region"])["premise_code"].nunique().reset_index()
    counts = counts.sort_values(["region", "district"])
    return [Area(district=r.district, region=r.region, shops=r.premise_code)
            for r in counts.itertuples()]


@app.get("/items/search", response_model=list[SearchResult])
def search_items(
    q: str = Query(min_length=2, description="Item name in English or BM, e.g. 'chicken' or 'ayam'"),
    district: str = Query(description="District from /areas, e.g. 'Petaling'"),
    limit: int = Query(20, ge=1, le=50),
):
    """Find items by name and show the cheapest fresh price in the district."""
    region = check_district(district)

    # Each word must match the START of a word: "ayam" finds AYAM but not BAYAM,
    # and "chick" still finds chicken. re.escape stops symbols in q acting as regex.
    patterns = [re.compile(r"\b" + re.escape(t)) for t in q.lower().split()]
    found = items[items["search"].apply(lambda s: all(p.search(s) for p in patterns))].copy()
    if found.empty:
        return []

    # Relevance: name starts with the first word (0), word appears in the name (1),
    # matched only through category or English words (2).
    first = patterns[0]
    found["relevance"] = [
        0 if first.match(name.lower()) else 1 if first.search(name.lower()) else 2
        for name in found["item"]
    ]

    here = latest[(latest["district"] == district) & latest["item_code"].isin(found["item_code"])]
    if here.empty:
        return []

    cheapest = here.loc[here.groupby("item_code")["price"].idxmin()].set_index("item_code")
    shop_counts = here.groupby("item_code")["premise_code"].nunique()

    results = []
    for it in found.itertuples():
        if it.item_code not in cheapest.index:
            continue  # no fresh price for this item in this district
        c = cheapest.loc[it.item_code]
        label, scope = label_for(it.item_code, district, region)
        results.append((it.relevance, SearchResult(
            item_code=it.item_code, name=it.item, unit=it.unit, category=it.item_category,
            cheapest_price=round(float(c.price), 2), cheapest_shop=c.premise,
            cheapest_chain=c.chain, price_date=c.date.date(),
            shops_with_price=int(shop_counts[it.item_code]),
            label=label, label_scope=scope,
        )))

    # Best name match first, then items sold in more shops (the staples people want).
    results.sort(key=lambda pair: (pair[0], -pair[1].shops_with_price, pair[1].name))
    return [r for _, r in results[:limit]]