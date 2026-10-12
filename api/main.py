"""SenSen API: serves the tables the pipeline builds.

Run from the repo root (after pipeline/run.py):
    fastapi dev api/main.py
Then open http://127.0.0.1:8000/docs
"""

from pathlib import Path

import pandas as pd
from fastapi import FastAPI

DATA_DIR = Path("data/clean")

app = FastAPI(
    title="SenSen API",
    version="0.1.0",
    description="Grocery prices for Selangor and Kuala Lumpur, from PriceCatcher (KPDN, DOSM, CC BY 4.0).",
)

# Load once when the server starts, not on every request.
weekly = pd.read_parquet(DATA_DIR / "weekly.parquet")
labels = pd.read_parquet(DATA_DIR / "labels.parquet")


@app.get("/health")
def health():
    """Quick check that the server is up."""
    return {"status": "ok"}


@app.get("/meta")
def meta():
    """What data the API is serving: date range, regions and how many items."""
    return {
        "latest_week": str(weekly["week"].max().date()),
        "first_week": str(weekly["week"].min().date()),
        "weeks": int(weekly["week"].nunique()),
        "regions": sorted(weekly.loc[weekly["area_type"] == "region", "area"].unique().tolist()),
        "districts": int(weekly.loc[weekly["area_type"] == "district", "area"].nunique()),
        "items_with_label": int(labels["item_code"].nunique()),
        "source": "PriceCatcher, KPDN and DOSM, via data.gov.my (CC BY 4.0)",
    }