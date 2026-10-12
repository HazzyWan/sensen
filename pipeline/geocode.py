"""Find a map position (latitude, longitude) for every shop SenSen covers.

PriceCatcher gives each shop's address as text but no coordinates, so we ask
OpenStreetMap's free Nominatim service once per shop and keep the answers in
pipeline/geocache.csv. That file is committed to git: later runs (and the daily
GitHub Action) only look up shops that are new or whose address changed.

Nominatim's rules (https://operations.osmfoundation.org/policies/nominatim/):
  - at most 1 request a second, one at a time, and cache every answer
  - scheduled jobs: at most 4 requests a minute (here: 60 requests per run)
  - send a User-Agent that says who we are
So the first run takes a while (roughly 15 to 40 minutes). It saves after every
shop, so you can stop it with Ctrl+C and run it again to continue.

Run from the repo root (after clean.py):
    python pipeline/geocode.py
"""

import csv
import os
import re
import time
from pathlib import Path

import pandas as pd
import requests

from clean import CLEAN_DIR, load_premises

CACHE = Path("pipeline/geocache.csv")
FIELDS = ["premise_code", "address", "lat", "lon", "precision", "query", "strategy"]

# Bump this when locate() learns new tricks: shops that found nothing with an
# older strategy are tried once more. Shops that were found are never redone.
STRATEGY = 3

URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "SenSen/0.5 (grocery price app; https://github.com/HazzyWan/sensen)"}

# On GitHub Actions (CI=true) we are a scheduled job: 4 requests a minute, and
# at most 60 requests per run (15 minutes), so one day's new shops can't hammer
# the service. Shops not reached are simply looked up in the next day's run.
IN_CI = os.environ.get("CI") == "true"
PAUSE = 15.0 if IN_CI else 1.1  # seconds between requests
MAX_REQUESTS = 60 if IN_CI else None

# Anything outside this box is a wrong match (another "Taman Melawati" elsewhere).
LAT_RANGE = (2.55, 3.85)   # Selangor + KL, with a little room
LON_RANGE = (100.75, 102.05)

# Parts of an address, split at commas, sorted into kinds.
UNIT = re.compile(r"^(LOT|NO\.?|UNIT|BLOK|BLOCK|PT|PLOT)\b|^(?=.*\d)[\d\-/A-Z&.]{1,10}$")
FLOOR = re.compile(r"\b(FLOOR|FLR|GROUND|BASEMENT|MEZZANINE|ARAS|TINGKAT|UG|LG|GF)\b")
COMPANY = re.compile(r"\b(SDN\.?\s*BHD|BERHAD|ENTERPRISE|TRADING)\b")
POSTCODE_PART = re.compile(r"^(\d{5})\s*(.*)$")          # "40000 SHAH ALAM"
STATE_PART = re.compile(r"^(SELANGOR|W\.?\s*P\.?|WILAYAH|KUALA LUMPUR$)")
LANDMARK = re.compile(r"PLAZA|MALL|KOMPLEKS|COMPLEX|CENTRE|CENTER|SQUARE|@|MEDAN|PASAR|ARCADE|AVENUE|GALERIA|PARADE")
STREET = re.compile(r"^(OFF\s+)?(JALAN|JLN|PERSIARAN|LEBUH|LEBUHRAYA|LORONG|LRG)\b")
AREA = re.compile(r"^(TAMAN|TMN|BANDAR|PUSAT BANDAR|SEKSYEN|DESA|KAMPUNG|KG|SAUJANA)\b")


class OutOfRequests(Exception):
    """This run's request budget (CI only) is used up."""


requests_made = 0


def split_address(address):
    """Sort an address into the parts a map search can use.

    'LOT GF22, GROUND FLOOR, THE WATERFRONT@DESA PARKCITY, 5, PERSIARAN RESIDEN,'
      -> landmarks ['THE WATERFRONT@DESA PARKCITY'], streets ['PERSIARAN RESIDEN'], ...
    Lot and unit numbers, floors and company names are dropped: they are rarely on the map.
    """
    parts = {"landmark": [], "street": [], "area": [], "postcode": "", "town": "", "kept": []}
    for raw in address.upper().split(","):
        p = raw.strip(" .")
        m = POSTCODE_PART.match(p)
        if m:  # checked first: "43000 KAJANG" must not count as a unit number
            parts["postcode"], parts["town"] = m.group(1), m.group(2).strip()
            parts["kept"].append(p)
            continue
        if not p or UNIT.match(p) or FLOOR.search(p) or COMPANY.search(p) or STATE_PART.match(p):
            continue
        p = re.sub(r"^OFF\s+", "", p)  # "OFF JALAN IMBI" -> "JALAN IMBI"
        if LANDMARK.search(p):
            parts["landmark"].append(p)
        elif STREET.match(p):
            parts["street"].append(p)
        elif AREA.match(p):
            parts["area"].append(p)
        parts["kept"].append(p)
    return parts


def ask(params):
    """One Nominatim request. Returns (lat, lon) inside Selangor/KL, or None."""
    global requests_made
    if MAX_REQUESTS is not None and requests_made >= MAX_REQUESTS:
        raise OutOfRequests
    requests_made += 1
    time.sleep(PAUSE)
    resp = requests.get(URL, params={**params, "format": "jsonv2", "countrycodes": "my", "limit": 1},
                        headers=HEADERS, timeout=30)
    resp.raise_for_status()
    hits = resp.json()
    if not hits:
        return None
    lat, lon = float(hits[0]["lat"]), float(hits[0]["lon"])
    if LAT_RANGE[0] <= lat <= LAT_RANGE[1] and LON_RANGE[0] <= lon <= LON_RANGE[1]:
        return lat, lon
    return None


def locate(shop):
    """Try the most exact search first, then fall back to rougher ones.

    precision tells the app how far to trust the spot:
      address  = the building, the shop itself or the full address was found
      street   = only the street was found (a long road can be a few km)
      postcode = the postcode area or the taman/bandar was found (about 1 to 3 km)
      town     = only the town or district was found (can be several km off)
      none     = nothing found; the shop is left out of distance searches
    """
    address = "" if pd.isna(shop.address) else str(shop.address)
    a = split_address(address)
    # Where the shop is, for adding to short searches. Many KL addresses have
    # no postcode or town at all, so the district from PriceCatcher fills in.
    place = a["town"] or shop.district
    where = f"{place}, {shop.region}, Malaysia"

    tries = [
        ("address", {"q": address}),
        ("address", {"q": ", ".join(a["kept"] + [shop.region, "Malaysia"])}),
        ("address", {"q": f"{shop.premise}, {where}"}),  # chains are often on the map by name
    ]
    tries += [("address", {"q": f"{lm}, {where}"}) for lm in a["landmark"]]
    tries += [("street", {"q": f"{st}, {where}"}) for st in a["street"][:2]]
    if a["postcode"]:
        tries.append(("postcode", {"postalcode": a["postcode"]}))
        tries.append(("postcode", {"q": f"{a['postcode']} {a['town']}, Malaysia"}))
    tries += [("postcode", {"q": f"{ar}, {where}"}) for ar in a["area"][:1]]
    if a["town"]:
        tries.append(("town", {"q": f"{a['town']}, {shop.region}, Malaysia"}))
    tries.append(("town", {"q": f"{shop.district}, {shop.region}, Malaysia"}))

    seen = set()
    for precision, params in tries:
        key = tuple(sorted(params.items()))
        if key in seen or not any(params.values()):
            continue  # skip a query identical to one already tried
        seen.add(key)
        spot = ask(params)
        if spot:
            return {"lat": spot[0], "lon": spot[1], "precision": precision,
                    "query": next(iter(params.values())), "strategy": STRATEGY}
    return {"lat": "", "lon": "", "precision": "none", "query": "", "strategy": STRATEGY}


def load_cache():
    if not CACHE.exists():
        return {}
    with open(CACHE, newline="", encoding="utf-8") as f:
        return {int(r["premise_code"]): r for r in csv.DictReader(f)}


def main():
    # Only shops that actually appear in our price data.
    prices = pd.read_parquet(CLEAN_DIR / "prices.parquet", columns=["premise_code"])
    shops = load_premises()
    shops = shops[shops["premise_code"].isin(prices["premise_code"].unique())]

    cache = load_cache()

    def needs_lookup(s):
        old = cache.get(s.premise_code)
        if old is None or old["address"] != s.address:
            return True  # new shop, or it moved
        # Not found before, and locate() has learned new tricks since.
        return old["precision"] == "none" and int(old.get("strategy") or 1) < STRATEGY

    todo = [s for s in shops.itertuples() if needs_lookup(s)]
    print(f"{len(shops)} shops, {len(shops) - len(todo)} already in the cache, {len(todo)} to look up")

    new_file = not CACHE.exists()
    for n, shop in enumerate(todo, 1):
        try:
            found = locate(shop)
        except OutOfRequests:
            print(f"  Request limit for this run reached; {len(todo) - n + 1} shops left for the next run.")
            break
        except requests.RequestException as e:
            # Service busy or down: keep what we have and try the rest next run.
            print(f"  Nominatim error ({e}); stopping lookups for now.")
            break
        cache[shop.premise_code] = {"premise_code": shop.premise_code, "address": shop.address, **found}
        # Rewrite the whole file each time: small, and nothing is lost on Ctrl+C.
        with open(CACHE, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS)
            w.writeheader()
            for code in sorted(cache):
                w.writerow(cache[code])
        print(f"  [{n}/{len(todo)}] {found['precision']:8} {shop.premise[:45]}")

    if new_file or todo:
        counts = pd.Series([r["precision"] for r in cache.values()]).value_counts()
        print("\nCache now holds:")
        print(counts.to_string())
        missing = [r["address"] for r in cache.values() if r["precision"] == "none"]
        if missing:
            print(f"\nStill not found ({len(missing)}), for example:")
            for a in missing[:10]:
                print(f"  {a}")


if __name__ == "__main__":
    main()