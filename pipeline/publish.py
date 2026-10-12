"""Build the small tables the API serves.

Reads data/clean/prices.parquet and writes to data/serve/:
  items.parquet          one row per item, with English search words
  latest_prices.parquet  each shop's latest price per item, if fresh

"Fresh" is measured from the newest date in the data, not from today,
because PriceCatcher is published with a delay.

Run from the repo root (after clean.py):
    python pipeline/publish.py
"""

import re
from pathlib import Path

import pandas as pd

CLEAN_DIR = Path("data/clean")
SERVE_DIR = Path("data/serve")
FRESH_DAYS = 14

# Chain names from shop names (carried over from the prototype). First match wins.
CHAINS = [
    (r"AEON", "AEON"),
    (r"LOTUS|TESCO", "Lotus's"),
    (r"GIANT", "Giant"),
    (r"MYDIN", "Mydin"),
    (r"ECONSAVE", "Econsave"),
    (r"99 SPEED", "99 Speedmart"),
    (r"SEGI", "Segi Fresh"),
    (r"\bHERO\b", "Hero"),
    (r"JAYA GROCER", "Jaya Grocer"),
    (r"^TF ", "TF Value-Mart"),
    (r"\bNSK\b", "NSK"),
    (r"ROSYAM", "ST Rosyam Mart"),
    (r"VILLAGE GROCER", "Village Grocer"),
]

# Malay words in item names -> English, so "chicken" finds AYAM.
ENGLISH = {
    "AYAM": "chicken", "TELUR": "egg eggs", "BERAS": "rice", "DAGING": "meat",
    "LEMBU": "beef", "KAMBING": "mutton goat lamb", "KERBAU": "buffalo",
    "IKAN": "fish", "UDANG": "prawn shrimp", "SOTONG": "squid", "KETAM": "crab",
    "SAYUR": "vegetable", "BAWANG": "onion garlic", "GULA": "sugar",
    "MINYAK": "oil", "MASAK": "cooking", "SUSU": "milk", "TEPUNG": "flour",
    "KICAP": "soy sauce", "SOS": "sauce", "LAMPIN": "diaper nappy",
    "BUAH": "fruit", "KELAPA": "coconut", "SANTAN": "coconut milk",
    "CILI": "chili chilli", "KUBIS": "cabbage", "KENTANG": "potato",
    "KACANG": "beans nuts", "GARAM": "salt", "MENTEGA": "butter",
    "MEE": "noodles", "BIHUN": "vermicelli", "KOPI": "coffee", "TEH": "tea",
    "SABUN": "soap", "PISANG": "banana", "EPAL": "apple", "LIMAU": "lime orange",
    "HALIA": "ginger", "LOBAK": "carrot radish", "TIMUN": "cucumber",
    "BAYAM": "spinach", "SAWI": "mustard greens", "KANGKUNG": "water spinach",
    "TAUHU": "tofu", "ANGGUR": "grapes", "NENAS": "pineapple",
    "TEMBIKAI": "watermelon", "BENDI": "okra ladies fingers", "BUNCIS": "french beans",
    "TOMATO": "tomato", "BROKOLI": "broccoli", "ROTI": "bread",
}


def chain_of(name, premise_type):
    for pattern, chain in CHAINS:
        if re.search(pattern, name):
            return chain
    return premise_type  # independents are grouped by shop type


def search_text(row):
    words = re.findall(r"[A-Z]+", f"{row['item']} {row['item_category']}".upper())
    english = " ".join(ENGLISH.get(w, "") for w in words)
    return f"{row['item']} {row['item_category']} {english}".lower()


def main():
    SERVE_DIR.mkdir(parents=True, exist_ok=True)
    prices = pd.read_parquet(CLEAN_DIR / "prices.parquet")

    items = (prices[["item_code", "item", "unit", "item_group", "item_category"]]
             .drop_duplicates("item_code").reset_index(drop=True))
    items["search"] = items.apply(search_text, axis=1)
    items.to_parquet(SERVE_DIR / "items.parquet", index=False)

    # Latest reading per shop per item; median if a shop has several that day.
    last_date = prices["date"].max()
    keys = ["premise_code", "item_code"]
    newest = prices.groupby(keys)["date"].transform("max")
    latest = (prices[prices["date"] == newest]
              .groupby(keys + ["date", "premise", "premise_type", "region", "district"])
              ["price"].median().reset_index())
    latest = latest[latest["date"] >= last_date - pd.Timedelta(days=FRESH_DAYS - 1)]
    latest["chain"] = [chain_of(n, t) for n, t in zip(latest["premise"], latest["premise_type"])]
    latest.to_parquet(SERVE_DIR / "latest_prices.parquet", index=False)

    print(f"Items: {len(items)}")
    print(f"Data runs to {last_date.date()}; fresh = on or after "
          f"{(last_date - pd.Timedelta(days=FRESH_DAYS - 1)).date()}")
    print(f"Fresh shop prices: {len(latest):,} "
          f"({latest['premise_code'].nunique()} shops, {latest['item_code'].nunique()} items)")
    print("Shops per chain:")
    print(latest.groupby("chain")["premise_code"].nunique()
          .sort_values(ascending=False).to_string())


if __name__ == "__main__":
    main()