"""Find a map position (latitude, longitude) for every shop SenSen covers.

PriceCatcher gives each shop's address as text but no coordinates, so we ask
OpenStreetMap's free Nominatim service once per shop and keep the answers in
pipeline/geocache.csv. That file is committed to git: later runs (and the daily
GitHub Action) only look up shops that are new or whose address changed.

Nominatim's rules (https://operations.osmfoundation.org/policies/nominatim/):
  - at most 1 request a second, one at a time, and cache every answer
  - scheduled jobs: at most 4 requests a minute (here: 60 requests per run)
  - send a User-Agent that says who we are
It also looks up each shop's neighbourhood name ("Kota Damansara") from its
position, once, for the area picker.
So the first run takes a while: about 15 to 40 minutes for a few hundred shops,
a few hours for all of Malaysia. It saves after every shop, so you can stop it
with Ctrl+C and run it again to continue.

Run from the repo root (after clean.py):
    python pipeline/geocode.py
"""

import csv
import math
import os
import re
import time
from collections import defaultdict
from pathlib import Path
from statistics import median

import pandas as pd
import requests

from clean import CLEAN_DIR, load_premises

CACHE = Path("pipeline/geocache.csv")
FIELDS = ["premise_code", "address", "lat", "lon", "precision", "query", "strategy", "checked", "suburb"]

# Bump this when locate() learns new tricks: shops that found nothing with an
# older strategy are tried once more. Shops that were found are never redone.
STRATEGY = 3

URL = "https://nominatim.openstreetmap.org/search"
REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
HEADERS = {"User-Agent": "SenSen/0.5 (grocery price app; https://github.com/HazzyWan/sensen)"}

# On GitHub Actions (CI=true) we are a scheduled job: 4 requests a minute, and
# at most 60 requests per run (15 minutes), so one day's new shops can't hammer
# the service. Shops not reached are simply looked up in the next day's run.
IN_CI = os.environ.get("CI") == "true"
PAUSE = 15.0 if IN_CI else 1.1  # seconds between requests
MAX_REQUESTS = 60 if IN_CI else None

# A shop further than this from the middle of its own district's shops (or 3x
# the district's usual spread, if bigger) is probably a wrong match, e.g. a
# shop's name found at another branch of the same chain.
OUTLIER_MIN_KM = 8

# A result outside the shop's own state is a wrong match (another "Taman
# Melawati" in a different state). Rough boxes (south, north, west, east) with
# a little room; the district check below catches smaller mistakes.
STATE_BOX = {
    "Perlis": (6.2, 6.8, 100.05, 100.45),
    "Kedah": (5.0, 6.8, 99.55, 101.2),          # includes Langkawi
    "Pulau Pinang": (5.05, 5.65, 100.1, 100.65),
    "Perak": (3.55, 6.0, 100.25, 101.85),
    "Selangor": (2.55, 3.85, 100.75, 102.05),
    "Kuala Lumpur": (2.95, 3.3, 101.55, 101.8),
    "Putrajaya": (2.85, 3.0, 101.6, 101.76),
    "Negeri Sembilan": (2.35, 3.3, 101.55, 102.75),
    "Melaka": (1.95, 2.6, 101.95, 102.6),
    "Johor": (1.15, 2.95, 102.35, 104.65),
    "Pahang": (2.35, 4.85, 101.25, 103.75),
    "Terengganu": (3.85, 5.95, 102.25, 103.75),
    "Kelantan": (4.45, 6.3, 101.25, 102.7),
    "Sabah": (3.95, 7.45, 115.25, 119.35),
    "Sarawak": (0.8, 5.05, 109.5, 115.75),
    "Labuan": (5.15, 5.45, 115.1, 115.4),
}
MALAYSIA_BOX = (0.8, 7.45, 99.55, 119.35)  # for a state not in the list above
MAX_QUERY = 200  # characters; longer searches are cut at a comma

# Parts of an address, split at commas, sorted into kinds.
UNIT = re.compile(r"^(LOT|NO\.?|UNIT|BLOK|BLOCK|PT|PLOT)\b|^(?=.*\d)[\d\-/A-Z&.]{1,10}$")
FLOOR = re.compile(r"\b(FLOOR|FLR|GROUND|BASEMENT|MEZZANINE|ARAS|TINGKAT|UG|LG|GF)\b")
COMPANY = re.compile(r"\b(SDN\.?\s*BHD|BERHAD|ENTERPRISE|TRADING)\b")
POSTCODE_PART = re.compile(r"^(\d{5})\s*(.*)$")          # "40000 SHAH ALAM"
# A part that is only the state ("SELANGOR", "JOHOR DARUL TAKZIM", "W.P. LABUAN"):
# the search adds the state itself, so the part is dropped.
STATE_PART = re.compile(
    r"^(W\.?\s*P\.?|WILAYAH)|^(SELANGOR|JOHOR|KEDAH|KELANTAN|MELAKA|MALACCA|NEGERI SEMBILAN|N\.?\s*SEMBILAN"
    r"|PAHANG|PERAK|PERLIS|PULAU PINANG|P\.?\s*PINANG|PENANG|SABAH|SARAWAK|TERENGGANU|KUALA LUMPUR|LABUAN"
    r"|PUTRAJAYA)(\s+DARUL\s+\w+)?$")
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


def request(url, params):
    """One Nominatim request, within the rules: a pause first, and a budget in CI."""
    global requests_made
    if MAX_REQUESTS is not None and requests_made >= MAX_REQUESTS:
        raise OutOfRequests
    requests_made += 1
    time.sleep(PAUSE)
    resp = requests.get(url, params={**params, "format": "jsonv2"}, headers=HEADERS, timeout=30)
    if resp.status_code == 400:
        # Nominatim refused this one query (e.g. an address far too long to
        # search). That means "not found", not "the service is down": carry on.
        return None
    resp.raise_for_status()
    return resp.json()


def ask(params, box=MALAYSIA_BOX):
    """One search. Returns (lat, lon) inside the box (the shop's state), or None."""
    q = params.get("q")
    if q and len(q) > MAX_QUERY:
        # Very long addresses (several lot numbers, floors and blocks) fail the
        # search. Keep the part before the last comma that fits.
        params = {**params, "q": q[:MAX_QUERY].rsplit(",", 1)[0]}
    hits = request(URL, {**params, "countrycodes": "my", "limit": 1})
    if not hits:
        return None
    lat, lon = float(hits[0]["lat"]), float(hits[0]["lon"])
    south, north, west, east = box
    if south <= lat <= north and west <= lon <= east:
        return lat, lon
    return None


# Names people don't use for where they live: numbered sections ("Seksyen 7",
# "Presint 9", "Zon Perindustrian Seksyen 51"), industrial zones, council and
# staff-housing names ("Majlis Bandaraya Ipoh", "Kuarters ..."), longhouses ("RH. Maxwell"). These
# fall through to the next, bigger name ("Shah Alam", "Petaling Jaya").
NOT_A_SUBURB = re.compile(
    r"\b(SEKSYEN|SECTION|PRESINT|PRECINCT)\s*\d|PERINDUSTRIAN|INDUSTRIAL|^JALAN\b|^\d"
    r"|^(MAJLIS|KUARTERS|KEDIAMAN|PASUKAN)\b|QUARTERS|BALAI POLIS|^RH\.?\s",  # councils, staff housing, longhouse numbers
    re.IGNORECASE)


def suburb_of(lat, lon):
    """The standard neighbourhood name OpenStreetMap gives a point, e.g. 'Kota Damansara'.

    This is "reverse geocoding": a position in, a place name out. "-" if none.
    """
    hit = request(REVERSE_URL, {"lat": lat, "lon": lon, "zoom": 16, "addressdetails": 1})
    address = hit.get("address", {}) if isinstance(hit, dict) else {}
    for key in ("suburb", "quarter", "neighbourhood", "city_district", "village", "town", "city"):
        name = address.get(key)
        if name and not NOT_A_SUBURB.search(name):
            return name
    return "-"


def locate(shop, bounds=None):
    """Try the most exact search first, then fall back to rougher ones.

    precision tells the app how far to trust the spot:
      address  = the building, the shop itself or the full address was found
      street   = only the street was found (a long road can be a few km)
      postcode = the postcode area or the taman/bandar was found (about 1 to 3 km)
      town     = only the town or district was found (can be several km off)
      none     = nothing found; the shop is left out of distance searches
    bounds: extra Nominatim settings that keep every result inside a box.
    """
    address = "" if pd.isna(shop.address) else str(shop.address)
    a = split_address(address)
    # Where the shop is, for adding to short searches. Many KL addresses have
    # no postcode or town at all, so the district from PriceCatcher fills in.
    district = re.sub(r"\s*\(.*\)$", "", shop.district)  # "Rompin (Pahang)" -> "Rompin"
    place = a["town"] or district
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
    tries.append(("town", {"q": f"{district}, {shop.region}, Malaysia"}))

    seen = set()
    for precision, params in tries:
        key = tuple(sorted(params.items()))
        if key in seen or not any(params.values()):
            continue  # skip a query identical to one already tried
        seen.add(key)
        spot = ask({**params, **(bounds or {})}, STATE_BOX.get(shop.region, MALAYSIA_BOX))
        if spot:
            return {"lat": spot[0], "lon": spot[1], "precision": precision,
                    "query": next(iter(params.values())), "strategy": STRATEGY}
    return {"lat": "", "lon": "", "precision": "none", "query": "", "strategy": STRATEGY}


def load_cache():
    if not CACHE.exists():
        return {}
    with open(CACHE, newline="", encoding="utf-8") as f:
        return {int(r["premise_code"]): r for r in csv.DictReader(f)}


def km_between(a, b):
    """Straight-line distance in km between two (lat, lon) points (haversine)."""
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def far_from_district(cache, shops):
    """Shops placed far from the other shops in their own district.

    PriceCatcher says which district each shop is in, so a shop whose spot is
    much further from its district's shops than they are from each other was
    most likely matched to the wrong place (another branch, a street with the
    same name). Returns (shop, km away, the district's limit in km, box around
    the district's other shops, the district's middle).
    """
    by_district = defaultdict(list)
    for s in shops.itertuples():
        r = cache.get(s.premise_code)
        if r and r["precision"] != "none" and r["lat"] not in ("", None):
            by_district[s.district].append((s, (float(r["lat"]), float(r["lon"]))))

    found = []
    for pts in by_district.values():
        if len(pts) < 3:
            continue  # too few shops to know what "normal" looks like
        centre = (median(p[0] for _, p in pts), median(p[1] for _, p in pts))
        dists = [km_between(p, centre) for _, p in pts]
        limit = max(OUTLIER_MIN_KM, 3 * median(dists))
        good = [p for (_, p), d in zip(pts, dists) if d <= limit]
        pad = 0.02  # about 2 km around the outermost good shops
        box = (min(p[0] for p in good) - pad, max(p[0] for p in good) + pad,
               min(p[1] for p in good) - pad, max(p[1] for p in good) + pad)
        found += [(s, d, limit, box, centre) for (s, _), d in zip(pts, dists) if d > limit]
    return found


def save(cache):
    # Rewrite the whole file each time: small, and nothing is lost on Ctrl+C.
    with open(CACHE, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for code in sorted(cache):
            w.writerow(cache[code])


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

    changed = False
    try:
        for n, shop in enumerate(todo, 1):
            found = locate(shop)
            cache[shop.premise_code] = {"premise_code": shop.premise_code, "address": shop.address, **found}
            save(cache)
            changed = True
            print(f"  [{n}/{len(todo)}] {found['precision']:8} {shop.premise[:45]}")

        # Second pass: shops far from the rest of their district are searched
        # again, this time only inside the area where that district's shops are.
        suspects = [x for x in far_from_district(cache, shops)
                    if not cache[x[0].premise_code].get("checked")]
        if suspects:
            print(f"\n{len(suspects)} shops are far from the rest of their district; searching again inside it:")
        for shop, away, limit, (south, north, west, east), centre in suspects:
            bounds = {"viewbox": f"{west},{north},{east},{south}", "bounded": 1}
            found = locate(shop, bounds)
            # Big districts (Hulu Selangor, Petaling) have towns far apart, so
            # a shop a bit past the limit may well be right. Only a precise new
            # match replaces it, unless it was very far out (over 2x the limit).
            very_far = away > 2 * limit
            if found["precision"] == "address" or (very_far and found["precision"] != "none"):
                verdict = f"moved -> {found['precision']}"
            elif very_far:
                found.update(lat=round(centre[0], 6), lon=round(centre[1], 6), precision="town",
                             query=f"middle of {shop.district}")
                verdict = "moved -> middle of district (town)"
            else:
                found, verdict = dict(cache[shop.premise_code]), "kept (no better match inside the district)"
            cache[shop.premise_code] = {**found, "premise_code": shop.premise_code,
                                        "address": shop.address, "checked": "done"}
            save(cache)
            changed = True
            print(f"  {shop.premise[:38]:38} {away:4.1f} km out (limit {limit:.0f}) {verdict}")

        # Third pass: the standard neighbourhood name of each shop's spot, for
        # the area picker. Only for shops placed closer than "somewhere in town".
        # Also redoes names saved before NOT_A_SUBURB learned to skip them.
        def needs_name(r):
            name = r.get("suburb") or ""
            return not name or (name != "-" and NOT_A_SUBURB.search(name))
        named = [s for s in shops.itertuples()
                 if needs_name(cache[s.premise_code])
                 and cache[s.premise_code]["precision"] in ("address", "street", "postcode")]
        if named:
            print(f"\nLooking up the neighbourhood of {len(named)} shops:")
        for n, shop in enumerate(named, 1):
            r = cache[shop.premise_code]
            r["suburb"] = suburb_of(r["lat"], r["lon"])
            save(cache)
            changed = True
            print(f"  [{n}/{len(named)}] {r['suburb']:28} {shop.premise[:40]}")
    except OutOfRequests:
        print("  Request limit for this run reached; the rest waits for the next run.")
    except requests.RequestException as e:
        # Service busy or down: keep what we have and try the rest next run.
        print(f"  Nominatim error ({e}); stopping lookups for now.")

    if changed:
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