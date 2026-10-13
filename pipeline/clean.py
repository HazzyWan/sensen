"""Turn the raw PriceCatcher files into one clean table for Selangor and KL.

Reads data/raw/, writes data/clean/prices.parquet with one row per price
reading, already joined to its item and shop details.

Run from the repo root (after download.py):
    python pipeline/clean.py
"""

from pathlib import Path

import pandas as pd

RAW_DIR = Path("data/raw")
CLEAN_DIR = Path("data/clean")

# Exact spellings from the data (checked with explore.py).
# PriceCatcher's state name -> the region name the app shows. Matched ignoring
# dots, spaces and case, so "W.P. Putrajaya" and "WP Putrajaya" both work.
STATES = {"Selangor": "Selangor", "W.P. Kuala Lumpur": "Kuala Lumpur", "W.P. Putrajaya": "Putrajaya"}

# Shops that sell groceries. Restaurants, food courts and medan selera are left out.
GROCERY_TYPES = [
    "Hypermarket",
    "Pasar Raya / Supermarket",
    "Pasar Mini",
    "Pasar Basah",
    "Kedai Runcit",
    "Kedai Serbaneka",
    "Borong",
]

COOKED_FOOD_GROUP = "MAKANAN SIAP MASAK"

# A reading more than 3x above or below the item's usual price is treated as a typo.
OUTLIER_FACTOR = 3


def tidy(s):
    """Trim text and squash repeated spaces: '  AYAM   BERSIH ' -> 'AYAM BERSIH'."""
    return s.astype("string").str.replace(r"\s+", " ", regex=True).str.strip()


def match_key(s):
    """Compare names ignoring spaces and case, so 'PasarBasah' matches 'Pasar Basah'."""
    return s.str.replace(" ", "", regex=False).str.lower()


def state_key(s):
    """'W.P. Kuala Lumpur' -> 'wpkualalumpur', so spelling details don't matter."""
    return s.str.lower().str.replace(r"[^a-z]", "", regex=True)


def load_premises():
    p = pd.read_parquet(RAW_DIR / "lookup_premise.parquet")
    for col in ["premise", "address", "premise_type", "state", "district"]:
        p[col] = tidy(p[col])
    p = p[p["premise_code"] > 0]  # -1 is a placeholder "Unknown Premise"

    wanted = set(match_key(pd.Series(GROCERY_TYPES)))
    region = state_key(p["state"]).map({state_key(pd.Series([k]))[0]: v for k, v in STATES.items()})
    p = p.assign(region=region)
    p = p[p["region"].notna() & match_key(p["premise_type"]).isin(wanted)].copy()

    # Store one consistent spelling of each premise type.
    canonical = dict(zip(match_key(pd.Series(GROCERY_TYPES)), GROCERY_TYPES))
    p["premise_type"] = match_key(p["premise_type"]).map(canonical)
    return p


def load_items():
    it = pd.read_parquet(RAW_DIR / "lookup_item.parquet")
    for col in ["item", "unit", "item_group", "item_category"]:
        it[col] = tidy(it[col])
    it = it[(it["item_code"] > 0) & (it["item_group"] != COOKED_FOOD_GROUP)]
    return it


def load_prices(premise_codes):
    files = sorted(RAW_DIR.glob("pricecatcher_*.parquet"))
    if not files:
        raise SystemExit("No price files in data/raw. Run pipeline/download.py first.")
    parts = []
    for f in files:
        # Only read rows for our shops, instead of all 1.8M rows per month.
        df = pd.read_parquet(f, filters=[("premise_code", "in", list(premise_codes))])
        parts.append(df)
        print(f"  {f.stem}: {len(df):>8,} rows for Selangor + KL")
    prices = pd.concat(parts, ignore_index=True)
    prices["date"] = pd.to_datetime(prices["date"])
    return prices


def drop_outliers(df):
    usual = df.groupby("item_code")["price"].transform("median")
    ratio = df["price"] / usual
    bad = (ratio > OUTLIER_FACTOR) | (ratio < 1 / OUTLIER_FACTOR)
    return df[~bad], df[bad]


def main():
    CLEAN_DIR.mkdir(parents=True, exist_ok=True)

    premises = load_premises()
    items = load_items()
    per_region = premises["region"].value_counts()
    print(f"Shops kept: {len(premises)} ("
          + ", ".join(f"{per_region.get(r, 0)} {r}" for r in STATES.values()) + ")")
    print(f"Items kept: {len(items)} (cooked food removed)")

    print("Reading prices:")
    prices = load_prices(premises["premise_code"])

    before = len(prices)
    prices = prices[prices["price"] > 0].drop_duplicates()
    prices = prices.merge(items, on="item_code", how="inner")  # drops cooked food
    prices = prices.merge(
        premises[["premise_code", "premise", "premise_type", "region", "district"]],
        on="premise_code",
        how="inner",
    )
    print(f"Rows after removing cooked food, zero prices and duplicates: "
          f"{len(prices):,} (from {before:,})")

    prices, outliers = drop_outliers(prices)
    print(f"Outliers removed (>{OUTLIER_FACTOR}x off the usual price): {len(outliers):,}")
    outliers.to_csv(CLEAN_DIR / "outliers.csv", index=False)  # kept for checking by hand

    prices = prices.sort_values(["date", "premise_code", "item_code"]).reset_index(drop=True)
    prices.to_parquet(CLEAN_DIR / "prices.parquet", index=False)

    print("\n=== Summary ===")
    print(f"Rows      : {len(prices):,}")
    print(f"Dates     : {prices.date.min().date()} to {prices.date.max().date()}")
    print(f"Shops     : {prices.premise_code.nunique()}")
    print(f"Items     : {prices.item_code.nunique()}")
    print("Rows per region and shop type:")
    print(prices.groupby(["region", "premise_type"]).size().to_string())
    print(f"\nSaved to {CLEAN_DIR / 'prices.parquet'}")


if __name__ == "__main__":
    main()