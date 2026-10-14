"""Build the small tables the API serves.

Reads data/clean/prices.parquet (and the shop addresses in data/raw/) and
writes to data/serve/:
  items.parquet          every PriceCatcher item (except cooked food), with
                         English search words, even if no shop here prices it
  latest_prices.parquet  each shop's latest price per item, if fresh
  shops.parquet          each shop's name, chain, address, map position and
                         neighbourhood (from pipeline/geocache.csv, made by geocode.py)
  areas.parquet          each district's neighbourhoods, for the area picker

"Fresh" is measured from the newest date in the data, not from today,
because PriceCatcher is published with a delay.

Run from the repo root (after clean.py):
    python pipeline/publish.py
"""

import re
from collections import Counter
from pathlib import Path

import pandas as pd

from clean import load_items, tidy  # same item list and cooked-food rule as clean.py
from geocode import NOT_A_SUBURB, split_address  # address parts, and names people don't use

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
    "GANDUM": "wheat wholemeal", "BISKUT": "biscuit",
    "AIR": "water", "JUS": "juice", "SERBUK": "powder",
    "MARJERIN": "margarine", "MAJERIN": "margarine",
    "PENCUCI": "detergent washing", "DETERGEN": "detergent",
    "MINUMAN": "drinks", "SAPUAN": "spreads", "BIJIRIN": "cereal",
}


def chain_of(name, premise_type):
    for pattern, chain in CHAINS:
        if re.search(pattern, name):
            return chain
    return premise_type  # independents are grouped by shop type


# English names for PriceCatcher's item groups and categories, for the Browse
# screen and for search ("instant noodles" finds MI SEGERA).
GROUP_EN = {
    "BARANGAN SEGAR": "Fresh food",
    "BARANGAN KERING": "Dry goods",
    "BARANGAN BERBUNGKUS": "Packaged food",
    "MINUMAN": "Drinks",
    "SUSU DAN BARANGAN BAYI": "Baby milk and baby care",
    "PRODUK KEBERSIHAN": "Cleaning and personal care",
    "BARANGAN KEDAI SERBANEKA": "Convenience store items",
}
CATEGORY_EN = {
    # Fresh food
    "SAYUR-SAYURAN": "Vegetables", "BAHAN LAUT": "Seafood", "DAGING": "Meat",
    "BUAH-BUAHAN": "Fruit", "TELUR": "Eggs", "AYAM": "Chicken", "KELAPA": "Coconut",
    "IKAN DARAT": "Freshwater fish", "MEE/KUETIAU": "Fresh noodles", "TAUHU DAN TEMPE": "Tofu and tempeh",
    # Dry goods
    "BAWANG": "Onions and garlic", "KACANG": "Beans and nuts", "UBI KENTANG": "Potatoes",
    "HASIL LAUT KERING": "Dried seafood", "CILI KERING": "Dried chillies",
    # Packaged food
    "MINYAK DAN LEMAK": "Cooking oil and fats", "REMPAH RATUS (BERBUNGKUS)": "Spices (packed)",
    "REMPAH RATUS (TIDAK BERBUNGKUS)": "Spices (loose)", "KRIMER DAN SUSU TEPUNG": "Creamer and milk powder",
    "BERAS": "Rice", "KICAP DAN SOS": "Soy sauce and sauces", "SAPUAN (SPREADS)": "Spreads",
    "IKAN DALAM TIN": "Canned fish", "TEPUNG": "Flour", "BIHUN": "Rice vermicelli",
    "ESEN DAN RAGI": "Essence and yeast", "GULA": "Sugar", "SANTAN (KOTAK)": "Coconut milk",
    "MI SEGERA": "Instant noodles", "ROTI": "Bread", "MENTEGA": "Butter",
    # Drinks
    "TERSEDIA MINUM": "Ready to drink", "BAHAN-BAHAN MINUMAN": "Coffee, tea and drink mixes",
    # Baby
    "SUSU BAYI": "Infant formula", "LAMPIN PAKAI BUANG": "Diapers", "MAKANAN BAYI": "Baby food",
    # Cleaning and personal care
    "PENJAGAAN RUMAH": "Household cleaning", "PENJAGAAN DIRI": "Personal care",
    # Convenience store items
    "UBAT-UBATAN": "Medicine", "MINUMAN": "Drinks", "COKLAT": "Chocolate", "BISKUT": "Biscuits",
    "MAKANAN RINGAN": "Snacks", "ALAT TULIS DAN BAHAN BACAAN": "Stationery and reading",
    "MAKANAN SEGERA": "Instant food", "SYAMPU": "Shampoo", "MAJALAH": "Magazines",
    "TUALA WANITA": "Sanitary pads", "BERUS GIGI": "Toothbrushes", "MOUTH WASH": "Mouthwash",
    "PENGHALAU NYAMUK": "Mosquito repellent", "SABUN BADAN": "Body soap",
    "PEWANGI RUMAH": "Air freshener", "TISU": "Tissue", "UBAT GIGI": "Toothpaste",
}


def category_en(category):
    """English name for a category: from CATEGORY_EN, else from the keyword list.

    None if nothing is known; the app then shows the Malay name.
    """
    if category in CATEGORY_EN:
        return CATEGORY_EN[category]
    for word in re.findall(r"[A-Z]+", str(category).upper()):
        if word in ENGLISH:
            return ENGLISH[word].split()[0].capitalize()
    return None


def search_text(row):
    words = re.findall(r"[A-Z]+", f"{row['item']} {row['item_category']}".upper())
    english = " ".join(ENGLISH.get(w, "") for w in words)
    category = category_en(row["item_category"]) or ""
    return f"{row['item']} {row['item_category']} {english} {category}".lower()


RAW_DIR = Path("data/raw")
GEOCACHE = Path("pipeline/geocache.csv")

# Malaysian addresses end with "<postcode> <TOWN>, <STATE>". We read the town
# after the 5-digit postcode, e.g. "... 40150 SHAH ALAM, SELANGOR" -> "Shah Alam".
POSTCODE_TOWN = re.compile(r"\b\d{5}\s*,?\s*([A-Z][A-Z .'/-]*?)\s*(?:,|$)")
STATE_NAMES = ["SELANGOR", "JOHOR", "KEDAH", "KELANTAN", "MELAKA", "NEGERI SEMBILAN", "PAHANG", "PERAK",
               "PERLIS", "PULAU PINANG", "PENANG", "SABAH", "SARAWAK", "TERENGGANU", "KUALA LUMPUR",
               "LABUAN", "PUTRAJAYA"]
STATE_WORDS = re.compile(r"\s*((" + "|".join(STATE_NAMES) + r")(\s+DARUL\s+\w+)?|W\.?P\.?\s*\w[\w ]*|WILAYAH PERSEKUTUAN.*)$")
# "\s*": some addresses lose the space ("BAYAN BARUPULAU PINANG").
# Names that say nothing new about where in the area someone is.
NOT_A_HINT = set(STATE_NAMES) | {"WILAYAH PERSEKUTUAN KUALA LUMPUR", "MALAYSIA"}
TOWNS_PER_AREA = 6  # the picker shows 3 and searches all 6


def town_of(address):
    m = POSTCODE_TOWN.search(str(address).upper())
    if not m:
        return None
    raw = m.group(1).strip(" .")
    town = STATE_WORDS.sub("", raw).strip(" .")
    # "KUALA SELANGOR" and "KUALA TERENGGANU" are towns, not "KUALA" + the state name.
    if town in {"KUALA", "KOTA", "BANDAR", "PULAU"}:
        town = raw
    return None if not town or town in NOT_A_HINT else town.title()


def same_town(name):
    """Treat spelling variants as one town: 'Kuala Kubu Baru' = 'Kuala Kubu Bharu', 'Johor Bahru' = 'Johor Bharu'."""
    return name.upper().replace("BHARU", "BARU").replace("BAHRU", "BARU").replace("TANJUNG", "TANJONG")


def neighbourhoods(addresses, district, limit=4):
    """Neighbourhood names (Taman, Bandar, Kampung, Desa...) from shop addresses.

    Only used when a district has no neighbourhood names from the map yet (see
    geocode.py). The most common first, at most `limit`, never the district's
    own name.
    """
    counts = Counter()
    for address in addresses.dropna():
        for hood in split_address(address)["area"][:1]:
            if same_town(hood) != same_town(district):
                counts[hood.title()] += 1
    return [name for name, _ in counts.most_common(limit)]


# "Pusat Bandar Subang Jaya" (town centre) and "Bandaraya Klang" (city) are
# better known as just "Subang Jaya" and "Klang".
CITY_PREFIX = re.compile(r"^(PUSAT BANDAR|BANDARAYA)\s+", re.IGNORECASE)


def ranked(names, district):
    """Distinct names, most common first, without the district's own name or
    names that say nothing ('Kuala Lumpur'). Spelling variants count as one."""
    counts, spelling = Counter(), {}
    for name in names:
        if not isinstance(name, str) or not name.strip() or name.strip() == "-":
            continue
        name = CITY_PREFIX.sub("", name.strip())
        if NOT_A_SUBURB.search(name):
            continue
        key = same_town(name)
        if key == same_town(district) or key in NOT_A_HINT:
            continue
        counts[key] += 1
        spelling.setdefault(key, Counter())[name] += 1
    return [(spelling[k].most_common(1)[0][0], n) for k, n in counts.most_common()]


def area_table(latest, shops):
    """One row per district: region, shop count, hint names and searchable places.

    towns:  up to 6 well-known neighbourhoods, the picker shows the first 3.
            They come from the map (OpenStreetMap's suburb for each shop's
            position, e.g. 'Kota Damansara', 'Ara Damansara'), so every
            district's hints are the same kind of name. Districts whose shops
            have no map name yet fall back to the town after the postcode, then
            to the Taman/Bandar in the address.
    places: every neighbourhood and town in the district, so typing 'Ampang'
            or 'Cyberjaya' finds the district it belongs to.
    """
    fresh = shops[shops["premise_code"].isin(latest["premise_code"])].copy()
    fresh["town"] = fresh["address"].map(town_of)

    rows = []
    for (district, region), g in fresh.groupby(["district", "region"]):
        suburbs = ranked(g["suburb"], district)
        towns = ranked(g["town"], district)
        hints = [name for name, _ in suburbs]
        if not hints:
            hints = [name for name, n in towns if n >= 2] or neighbourhoods(g["address"], district)
        places = list(dict.fromkeys(  # keeps order, drops repeats
            [name for name, _ in suburbs] + [name for name, _ in towns] + hints))
        rows.append({"district": district, "region": region, "shops": len(g),
                     "towns": "|".join(hints[:TOWNS_PER_AREA]), "places": "|".join(places)})
    return pd.DataFrame(rows)


def shop_table(prices):
    """One row per shop: name, chain, type, area, address, map position and
    neighbourhood name (suburb).

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
        geo = pd.read_csv(GEOCACHE, dtype={"suburb": "string"})
        if "suburb" not in geo:  # cache made before neighbourhood names existed
            geo["suburb"] = pd.NA
        shops = shops.merge(geo[["premise_code", "lat", "lon", "precision", "suburb"]],
                            on="premise_code", how="left")
    else:
        shops["lat"] = shops["lon"] = float("nan")
        shops["precision"] = None
        shops["suburb"] = pd.NA
    shops["precision"] = shops["precision"].fillna("none")
    # "-" in the cache means "looked up, no name"; the app just sees no name.
    shops["suburb"] = shops["suburb"].replace("-", pd.NA).astype("string")
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
    items["category_en"] = items["item_category"].map(category_en)
    items["group_en"] = items["item_group"].map(GROUP_EN)
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

    shops = shop_table(prices)
    shops.to_parquet(SERVE_DIR / "shops.parquet", index=False)

    areas = area_table(latest, shops)
    areas.to_parquet(SERVE_DIR / "areas.parquet", index=False)

    priced = items["item_code"].isin(latest["item_code"]).sum()
    print(f"Items: {len(items)} tracked, {priced} with a fresh price somewhere in Malaysia")
    print(f"Data runs to {last_date.date()}; fresh = on or after "
          f"{(last_date - pd.Timedelta(days=FRESH_DAYS - 1)).date()}")
    print(f"Fresh shop prices: {len(latest):,} "
          f"({latest['premise_code'].nunique()} shops, {latest['item_code'].nunique()} items)")
    located = shops["precision"].value_counts()
    print(f"Shops: {len(shops)}, map position by precision: "
          + ", ".join(f"{k} {v}" for k, v in located.items()))
    print("Groups and categories (items tracked):")
    for group, g in items.groupby("item_group"):
        cats = g.groupby("item_category").size().sort_values(ascending=False)
        print(f"  {group} = {GROUP_EN.get(group, '?')} ({len(g)}): " + ", ".join(
            f"{c}{' = ' + category_en(c) if category_en(c) else ''} {n}" for c, n in cats.items()))
    named = shops["suburb"].notna().sum()
    print(f"Areas and their main neighbourhoods ({named} of {len(shops)} shops have a map name):")
    for r in areas.itertuples():
        print(f"  {r.region:13} {r.district:16} {r.shops:>3} shops  {r.towns.replace('|', ', ')}")
    print("Shops per chain:")
    print(latest.groupby("chain")["premise_code"].nunique()
          .sort_values(ascending=False).to_string())


if __name__ == "__main__":
    main()