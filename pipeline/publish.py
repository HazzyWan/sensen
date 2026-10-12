"""Build the small tables the API serves.

Reads data/clean/prices.parquet (and the shop addresses in data/raw/) and
writes to data/serve/:
  items.parquet          one row per item, with English search words
  latest_prices.parquet  each shop's latest price per item, if fresh
  areas.parquet          each district's main towns, for the district picker

"Fresh" is measured from the newest date in the data, not from today,
because PriceCatcher is published with a delay.

Run from the repo root (after clean.py):
    python pipeline/publish.py
"""

import re
from pathlib import Path

import pandas as pd
from clean import load_items, tidy  # same item list and cooked-food rule as clean.py

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

# Shops renamed since PriceCatcher listed them. Tesco Malaysia became Lotus's
# in 2021-2022, but many PriceCatcher shops still carry the old name, which
# confuses shoppers and Google Maps alike.
RENAMES = [
    (re.compile(r"^TESCO(\s+EXTRA)?\s+"), "LOTUS'S "),
]


def current_name(name):
    """'TESCO EXTRA ARA DAMANSARA' -> "LOTUS'S ARA DAMANSARA"."""
    for pattern, new in RENAMES:
        name = pattern.sub(new, name)
    return name

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
    "TOMATO": "tomato", "BROKOLI": "broccoli", "ROTI": "bread loaf",
    "GANDUM": "wheat wholemeal", "BIJIRIN": "cereal", "BISKUT": "biscuit",
    "AIR": "water", "JUS": "juice", "SERBUK": "powder",
    "MARJERIN": "margarine", "MAJERIN": "margarine",
    "PENCUCI": "detergent washing", "DETERGEN": "detergent",
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


RAW_DIR = Path("data/raw")
GEOCACHE = Path("pipeline/geocache.csv")

# Malaysian addresses end with "<postcode> <TOWN>, <STATE>". We read the town
# after the 5-digit postcode, e.g. "... 40150 SHAH ALAM, SELANGOR" -> "Shah Alam".
POSTCODE_TOWN = re.compile(r"\b\d{5}\s*,?\s*([A-Z][A-Z .'/-]*?)\s*(?:,|$)")
STATE_WORDS = re.compile(r"\s+(SELANGOR|W\.?P\.?\s*KUALA LUMPUR|WILAYAH PERSEKUTUAN.*)$")
NOT_A_HINT = {"KUALA LUMPUR", "SELANGOR"}  # says nothing new about where in the area
TOWNS_PER_AREA = 6  # the picker shows 3 and searches all 6


def town_of(address):
    m = POSTCODE_TOWN.search(str(address).upper())
    if not m:
        return None
    raw = m.group(1).strip(" .")
    town = STATE_WORDS.sub("", raw).strip(" .")
    # "KUALA SELANGOR" is a town, not "KUALA" + the state name.
    if town == "KUALA":
        town = raw
    return None if not town or town in NOT_A_HINT else town.title()


def same_town(name):
    """Treat spelling variants as one town: 'Kuala Kubu Baru' = 'Kuala Kubu Bharu'."""
    return name.upper().replace("BHARU", "BARU").replace("TANJUNG", "TANJONG")


def area_table(latest):
    """One row per district: region, shop count and its most common towns."""
    shops = latest[["premise_code", "district", "region"]].drop_duplicates("premise_code")
    premises = pd.read_parquet(RAW_DIR / "lookup_premise.parquet")[["premise_code", "address"]]
    shops = shops.merge(premises, on="premise_code", how="left")
    shops["town"] = shops["address"].map(town_of)

    rows = []
    for (district, region), g in shops.groupby(["district", "region"]):
        named = g.dropna(subset=["town"]).copy()
        named["key"] = named["town"].map(same_town)
        # Count each town once across spellings; show its most common spelling.
        counts = named.groupby("key").agg(n=("town", "size"), name=("town", lambda s: s.mode()[0]))
        counts = counts.sort_values("n", ascending=False)
        towns = [r.name for r in counts.itertuples()
                 if r.n >= 2 and r.Index != same_town(district)]
        rows.append({"district": district, "region": region, "shops": len(g),
                     "towns": "|".join(towns[:TOWNS_PER_AREA])})
    return pd.DataFrame(rows)

def shop_table(prices):
    """One row per shop: name, chain, type, area, address and map position.

    precision says how exact the position is (see geocode.py); shops with no
    position yet get precision "none" and are left out of "near me".
    """
    shops = (prices[["premise_code", "premise", "premise_type", "region", "district"]]
             .drop_duplicates("premise_code").reset_index(drop=True))
    shops["premise"] = shops["premise"].map(current_name)
    shops["chain"] = [chain_of(n, t) for n, t in zip(shops["premise"], shops["premise_type"])]
    addresses = pd.read_parquet(RAW_DIR / "lookup_premise.parquet")[["premise_code", "address"]]
    addresses["address"] = tidy(addresses["address"])
    shops = shops.merge(addresses, on="premise_code", how="left")
    if GEOCACHE.exists():
        geo = pd.read_csv(GEOCACHE, usecols=["premise_code", "lat", "lon", "precision"])
        shops = shops.merge(geo, on="premise_code", how="left")
    else:
        shops["lat"] = shops["lon"] = float("nan")
        shops["precision"] = None
    shops["precision"] = shops["precision"].fillna("none")
    return shops

def main():
    SERVE_DIR.mkdir(parents=True, exist_ok=True)
    prices = pd.read_parquet(CLEAN_DIR / "prices.parquet")

    # Every item PriceCatcher tracks, not only the ones priced in the last few
    # months here, so a search for "bread" can say "no recent price in your
    # area" instead of pretending the item doesn't exist.
    items = load_items()[["item_code", "item", "unit", "item_group", "item_category"]]
    items = items.drop_duplicates("item_code").reset_index(drop=True)
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
    latest["premise"] = latest["premise"].map(current_name)
    latest["chain"] = [chain_of(n, t) for n, t in zip(latest["premise"], latest["premise_type"])]
    latest.to_parquet(SERVE_DIR / "latest_prices.parquet", index=False)

    areas = area_table(latest)
    areas.to_parquet(SERVE_DIR / "areas.parquet", index=False)
    
    shops = shop_table(prices)
    shops.to_parquet(SERVE_DIR / "shops.parquet", index=False)

    priced = items["item_code"].isin(latest["item_code"]).sum()
    print(f"Items: {len(items)} tracked, {priced} with a fresh price somewhere in Selangor or KL")
    print(f"Data runs to {last_date.date()}; fresh = on or after "
          f"{(last_date - pd.Timedelta(days=FRESH_DAYS - 1)).date()}")
    print(f"Fresh shop prices: {len(latest):,} "
          f"({latest['premise_code'].nunique()} shops, {latest['item_code'].nunique()} items)")
    located = shops["precision"].value_counts()
    print(f"Shops: {len(shops)}, map position by precision: "
          + ", ".join(f"{k} {v}" for k, v in located.items()))
    print("Areas and their main towns:")
    for r in areas.itertuples():
        print(f"  {r.region:13} {r.district:16} {r.shops:>3} shops  {r.towns.replace('|', ', ')}")
    print("Shops per chain:")
    print(latest.groupby("chain")["premise_code"].nunique()
          .sort_values(ascending=False).to_string())


if __name__ == "__main__":
    main()