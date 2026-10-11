"""Quick look at the raw PriceCatcher files before we build the pipeline.
 
Prints what is in the data so we can choose the right filters.
Nothing is written to disk.
 
Run from the repo root:
    python pipeline/explore.py
"""
from pathlib import Path

import pandas as pd

RAW_DIR = Path("data/raw")

items = pd.read_parquet(RAW_DIR / "lookup_item.parquet")
premises = pd.read_parquet(RAW_DIR / "lookup_premise.parquet")
month_files = sorted(RAW_DIR.glob("pricecatcher_*.parquet"))

print("=== Monthly price files ===")
for f in month_files:
    df = pd.read_parquet(f)
    print(f"{f.stem}: {len(df):>9,} rows, dates {df['date'].min()} to {df['date'].max()}")

print("\n=== Columns ===")
print("prices :", list(pd.read_parquet(month_files[-1]).columns))
print("items :", list(items.columns))
print("premise:", list(premises.columns))

print("\n=== States (exact spelling matters for our filter)===")
print(premises["state"].value_counts().to_string())

print("\n=== Premise types ===")
print(premises["premise_type"].value_counts().to_string())

print("\n=== Item groups ===")
print(items["item_group"].value_counts().to_string())

print("\n=== Sample rows ===")
print(items.head(5).to_string())
print(premises.head(5).to_string())
