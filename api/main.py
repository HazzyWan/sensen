"""SenSen API: serves the tables the pipeline builds.

Run from the repo root (after pipeline/run.py):
    fastapi dev api/main.py
Then open http://127.0.0.1:8000/docs
"""

import os
import re
from datetime import date
from pathlib import Path
from typing import Annotated, Literal

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

# The API reads its own copy of the tables (made by pipeline/ship.py), found
# next to this file. That way it works from any folder, and api/ can be
# deployed on its own.
DATA_DIR = Path(__file__).parent / "data"

app = FastAPI(
    title="SenSen API",
    version="0.3.0",
    description="Grocery prices for Selangor and Kuala Lumpur, from PriceCatcher (KPDN, DOSM, CC BY 4.0).",
)

# The app runs on a different address (port 5173) from the API (port 8000), so the
# browser blocks its requests unless the API says that address is allowed.
# The live app's address comes from the SENSEN_WEB_ORIGINS setting on the host
# (comma-separated), so it can change without touching the code.
LOCAL_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
WEB_ORIGINS = [o.strip() for o in os.environ.get("SENSEN_WEB_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=LOCAL_ORIGINS + WEB_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# ---------- Data, loaded once when the server starts ----------

weekly = pd.read_parquet(DATA_DIR / "weekly.parquet")
labels = pd.read_parquet(DATA_DIR / "labels.parquet")
items = pd.read_parquet(DATA_DIR / "items.parquet")
latest = pd.read_parquet(DATA_DIR / "latest_prices.parquet")
movers = pd.read_parquet(DATA_DIR / "movers.parquet")
area_rows = pd.read_parquet(DATA_DIR / "areas.parquet").sort_values(["region", "district"])
shops = pd.read_parquet(DATA_DIR / "shops.parquet")
if "suburb" not in shops:  # data made before neighbourhood names existed
    shops["suburb"] = None
if "places" not in area_rows:
    area_rows["places"] = area_rows["towns"]

# district -> [(lat, lon), ...] of its shops with a map position. The app finds
# the area nearest the user from these, on the phone, so the location never
# reaches this server.
POINTS = {d: [(round(float(r.lat), 4), round(float(r.lon), 4)) for r in g.itertuples()]
          for d, g in shops[shops["precision"] != "none"].dropna(subset=["lat", "lon"]).groupby("district")}

# district -> region, e.g. "Petaling" -> "Selangor"
DISTRICT_REGION = (latest[["district", "region"]].drop_duplicates()
                   .set_index("district")["region"].to_dict())

# (area_type, area, item_code) -> label row, for fast lookups. area_type is part
# of the key because "Kuala Lumpur" is both a district and a region.
LABEL_BY_AREA = {(r.area_type, r.area, r.item_code): r for r in labels.itertuples()}

HISTORY_MIN_WEEKS = 8  # fewer district weeks than this -> chart uses the region
STORE_MIN_ITEMS = 10   # a shop needs this many priced items to get a price index

# Typical (median) fresh price of each item in each district: the yardstick
# for "is this shop cheaper or dearer than usual around here?"
DISTRICT_MEDIAN = latest.groupby(["district", "item_code"])["price"].median()

# Items with a fresh price in at least one shop we cover. Some items in
# PriceCatcher's list (packaged bread, for one) haven't been priced anywhere
# for months, and the app says so instead of blaming the user's district.
PRICED_ANYWHERE = set(latest["item_code"])

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
    towns: list[str] = Field(description="Main neighbourhoods, to show as a hint (first 3) and search")
    places: list[str] = Field(description="Every neighbourhood and town in the area, for search")
    points: list[tuple[float, float]] = Field(
        description="(lat, lon) of the area's shops, so the app can pick the nearest area on the phone")


class SearchResult(BaseModel):
    item_code: int
    name: str
    unit: str
    category: str
    category_en: str | None = None
    # All None (and shops_with_price 0) when no shop in the district has a fresh price.
    cheapest_price: float | None
    cheapest_shop: str | None
    cheapest_chain: str | None
    price_date: date | None
    shops_with_price: int
    priced_anywhere: bool = Field(description="False if no shop in Selangor or KL has a fresh price")
    label: Label | None
    label_scope: Literal["district", "region"] | None


class Category(BaseModel):
    category: str
    category_en: str | None
    items: int = Field(description="Items PriceCatcher tracks in this category")
    priced: int = Field(description="Of those, items with a fresh price in the district")


class Group(BaseModel):
    group: str
    group_en: str | None
    items: int
    priced: int
    categories: list[Category]


class LabelInfo(BaseModel):
    label: Label
    scope: Literal["district", "region"]
    week: date
    weekly_price: float
    usual_low: float
    usual_high: float
    shops: int
    history_weeks: int


class ShopPrice(BaseModel):
    shop: str
    chain: str
    shop_type: str
    price: float
    price_date: date
    more_than_cheapest: float


class ShopLocated(BaseModel):
    shop: str
    chain: str
    shop_type: str
    district: str
    suburb: str | None = Field(description="Neighbourhood from the map, e.g. 'Kota Damansara'")
    address: str | None
    price: float
    price_date: date
    lat: float | None
    lon: float | None
    location: Literal["address", "street", "postcode", "town", "none"] = Field(
        description="How exact lat/lon is: the shop itself, its street, its postcode area, or only its town")


class WeekPoint(BaseModel):
    week: date
    price: float
    shops: int


class ItemDetail(BaseModel):
    item_code: int
    name: str
    unit: str
    category: str
    group: str
    district: str
    region: str
    shops_with_price: int
    priced_anywhere: bool = Field(description="False if no shop in Selangor or KL has a fresh price")
    district_median: float | None
    label: LabelInfo | None
    cheapest_shops: list[ShopPrice]
    history_scope: Literal["district", "region"]
    history: list[WeekPoint]


class StoreIndex(BaseModel):
    shop: str
    chain: str
    shop_type: str
    items_compared: int
    vs_district_pct: float = Field(description="Negative = cheaper than the district's usual price")
    cheapest_on: int = Field(description="Items where this shop has the district's lowest price")


class BasketRequest(BaseModel):
    district: str = Field(examples=["Petaling"])
    item_codes: list[int] = Field(min_length=1, max_length=30, examples=[[1, 2, 3]])
    quantities: list[Annotated[float, Field(gt=0, le=100)]] | None = Field(
        None, examples=[[2, 1, 0.5]],
        description="How many of each item (kg for per-kg items), in the same order as item_codes. Default 1 each.")
    include: int | None = Field(
        None, description="premise_code of a shop to return even if it isn't in the top 10 (the shop the user picked)")

    @model_validator(mode="after")
    def same_length(self):
        if self.quantities is not None and len(self.quantities) != len(self.item_codes):
            raise ValueError("quantities must have one number per item code")
        return self


class BasketLine(BaseModel):
    item_code: int
    name: str
    price: float = Field(description="Price of one unit at this shop")
    quantity: float
    line_total: float = Field(description="price x quantity")


class BasketItem(BaseModel):
    item_code: int
    name: str
    unit: str
    quantity: float
    cheapest_price: float | None = Field(description="Lowest fresh price of one unit in the district, if any")
    cheapest_shop: str | None


class BasketShop(BaseModel):
    premise_code: int
    shop: str
    chain: str
    shop_type: str
    complete: bool
    total: float = Field(description="Sum of price x quantity for the items this shop has")
    items_found: int
    missing: list[str]
    lines: list[BasketLine]


class Mover(BaseModel):
    item_code: int
    name: str
    unit: str
    price_before: float
    price_now: float
    change_pct: float


class Movers(BaseModel):
    scope: Literal["district", "region"]
    area: str
    week: date | None
    risers: list[Mover]
    fallers: list[Mover]


class Deal(BaseModel):
    item_code: int
    name: str
    unit: str
    cheapest_price: float
    cheapest_shop: str
    usual_low: float
    usual_high: float
    below_usual_pct: float = Field(description="How far this week's price sits below the middle of the usual range")
    label_scope: Literal["district", "region"]


class BasketResult(BaseModel):
    district: str
    items_requested: int
    cheapest_mix_total: float = Field(
        description="If you bought each item wherever it is cheapest in the district")
    cheapest_mix_covers: int
    items: list[BasketItem] = Field(description="Each item asked for, with its cheapest price in the district")
    shops: list[BasketShop]


# ---------- Helpers ----------

def check_district(district: str) -> str:
    if district not in DISTRICT_REGION:
        raise HTTPException(404, f"Unknown district '{district}'. See /areas for valid names.")
    return DISTRICT_REGION[district]


def label_for(item_code: int, district: str, region: str):
    """District label if there is one, otherwise fall back to the region's."""
    for area, scope in [(district, "district"), (region, "region")]:
        row = LABEL_BY_AREA.get((scope, area, item_code))
        if row is not None:
            return row, scope
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
    return [Area(district=r.district, region=r.region, shops=int(r.shops),
                 towns=[t for t in r.towns.split("|") if t],
                 places=[p for p in (r.places or "").split("|") if p],
                 points=POINTS.get(r.district, []))
            for r in area_rows.itertuples()]


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

    return results_for(found, district, region)[:limit]


def results_for(found, district, region):
    """Cheapest fresh price in the district for each item in `found`.

    `found` needs a `relevance` column (0 = best). Items with a price come
    first, then by relevance, then items sold in more shops (the staples).
    Items without a fresh price here are kept at the end, so the user knows why.
    """
    here = latest[(latest["district"] == district) & latest["item_code"].isin(found["item_code"])]
    cheapest = here.loc[here.groupby("item_code")["price"].idxmin()].set_index("item_code")
    shop_counts = here.groupby("item_code")["premise_code"].nunique()

    results = []
    for it in found.itertuples():
        base = dict(item_code=it.item_code, name=it.item, unit=it.unit, category=it.item_category,
                    category_en=None if pd.isna(it.category_en) else it.category_en)
        if it.item_code not in cheapest.index:
            results.append(((1, it.relevance), SearchResult(
                **base, cheapest_price=None, cheapest_shop=None, cheapest_chain=None,
                price_date=None, shops_with_price=0,
                priced_anywhere=it.item_code in PRICED_ANYWHERE, label=None, label_scope=None)))
            continue
        c = cheapest.loc[it.item_code]
        row, scope = label_for(it.item_code, district, region)
        results.append(((0, it.relevance), SearchResult(
            **base, cheapest_price=round(float(c.price), 2), cheapest_shop=c.premise,
            cheapest_chain=c.chain, price_date=c.date.date(),
            shops_with_price=int(shop_counts[it.item_code]), priced_anywhere=True,
            label=row.label if row is not None else None, label_scope=scope,
        )))

    results.sort(key=lambda pair: (pair[0], -pair[1].shops_with_price, pair[1].name))
    return [r for _, r in results]


@app.get("/categories", response_model=list[Group])
def categories(district: str = Query(description="District from /areas, e.g. 'Petaling'")):
    """Every item group and category PriceCatcher tracks, with how many items
    have a fresh price in the district. Groups with the most priced items first."""
    check_district(district)
    priced_here = set(latest.loc[latest["district"] == district, "item_code"])
    it = items.assign(priced=items["item_code"].isin(priced_here))

    groups = []
    for group, g in it.groupby("item_group"):
        cats = (g.groupby(["item_category"])
                 .agg(items=("item_code", "size"), priced=("priced", "sum"),
                      category_en=("category_en", "first"))
                 .reset_index()
                 .sort_values(["priced", "item_category"], ascending=[False, True]))
        group_en = g["group_en"].iloc[0]
        groups.append(Group(
            group=group, group_en=None if pd.isna(group_en) else group_en, items=len(g), priced=int(g["priced"].sum()),
            categories=[Category(category=c.item_category, items=int(c.items), priced=int(c.priced),
                                 category_en=None if pd.isna(c.category_en) else c.category_en)
                        for c in cats.itertuples()]))
    return sorted(groups, key=lambda g: (-g.priced, g.group))


@app.get("/browse", response_model=list[SearchResult])
def browse(
    district: str = Query(description="District from /areas, e.g. 'Petaling'"),
    category: str = Query(description="Category from /categories, e.g. 'AYAM'"),
):
    """All items in one category with their cheapest fresh price in the district."""
    region = check_district(district)
    found = items[items["item_category"] == category].assign(relevance=0)
    if found.empty:
        raise HTTPException(404, f"Unknown category {category!r}.")
    return results_for(found, district, region)


@app.get("/items/{item_code}/prices", response_model=list[ShopLocated])
def item_prices(item_code: int):
    """Every fresh price for one item across Selangor and KL, cheapest first,
    with each shop's map position.

    The app works out which shops are near the user on the phone itself, so
    the user's location is never sent to this server.
    """
    if not (items["item_code"] == item_code).any():
        raise HTTPException(404, f"Unknown item code {item_code}.")
    here = latest[latest["item_code"] == item_code].merge(
        shops[["premise_code", "address", "lat", "lon", "precision", "suburb"]], on="premise_code", how="left")
    here = here.sort_values(["price", "premise"])

    def num(v):
        return None if pd.isna(v) else round(float(v), 6)

    return [ShopLocated(shop=r.premise, chain=r.chain, shop_type=r.premise_type, district=r.district,
                        suburb=None if pd.isna(r.suburb) else r.suburb,
                        address=None if pd.isna(r.address) else r.address,
                        price=round(float(r.price), 2), price_date=r.date.date(),
                        lat=num(r.lat), lon=num(r.lon),
                        location="none" if pd.isna(r.precision) else r.precision)
            for r in here.itertuples()]


@app.get("/items/{item_code}", response_model=ItemDetail)
def item_detail(
    item_code: int,
    district: str = Query(description="District from /areas, e.g. 'Petaling'"),
):
    """One item in one district: cheapest shops, price label and 6-month history."""
    region = check_district(district)
    match = items[items["item_code"] == item_code]
    if match.empty:
        raise HTTPException(404, f"Unknown item code {item_code}.")
    it = match.iloc[0]

    # Cheapest 5 shops with a fresh price in this district.
    here = latest[(latest["district"] == district) & (latest["item_code"] == item_code)]
    here = here.sort_values(["price", "premise"])
    lowest = float(here["price"].min()) if not here.empty else None
    cheapest_shops = [
        ShopPrice(shop=r.premise, chain=r.chain, shop_type=r.premise_type,
                  price=round(float(r.price), 2), price_date=r.date.date(),
                  more_than_cheapest=round(float(r.price) - lowest, 2))
        for r in here.head(5).itertuples()
    ]

    # Label, with the usual range so the app can say "usually RM 8.54 to 9.29".
    row, scope = label_for(item_code, district, region)
    label = None if row is None else LabelInfo(
        label=row.label, scope=scope, week=row.week.date(),
        weekly_price=round(float(row.price), 2),
        usual_low=float(row.usual_low), usual_high=float(row.usual_high),
        shops=int(row.n_stores), history_weeks=int(row.history_weeks),
    )

    # Weekly history for the chart: the district if it has enough weeks, else the region.
    def series(area_type, area):
        return weekly[(weekly["area_type"] == area_type) & (weekly["area"] == area)
                      & (weekly["item_code"] == item_code)].sort_values("week")

    history, history_scope = series("district", district), "district"
    if len(history) < HISTORY_MIN_WEEKS:
        history, history_scope = series("region", region), "region"

    return ItemDetail(
        item_code=item_code, name=it["item"], unit=it["unit"],
        category=it["item_category"], group=it["item_group"],
        district=district, region=region,
        shops_with_price=int(here["premise_code"].nunique()),
        priced_anywhere=item_code in PRICED_ANYWHERE,
        district_median=round(float(here["price"].median()), 2) if not here.empty else None,
        label=label,
        cheapest_shops=cheapest_shops,
        history_scope=history_scope,
        history=[WeekPoint(week=r.week.date(), price=round(float(r.price), 2), shops=int(r.n_stores))
                 for r in history.itertuples()],
    )


@app.get("/stores", response_model=list[StoreIndex])
def stores(district: str = Query(description="District from /areas, e.g. 'Petaling'")):
    """Shops in the district ranked from cheapest to dearest overall.

    Each fresh price is compared with the district's usual price for that item.
    The ratios are clipped to 0.5-2.0 so one odd price can't swing a shop's
    score, then averaged (the prototype's price index, per district).
    """
    check_district(district)
    here = latest[latest["district"] == district].copy()
    here["usual"] = DISTRICT_MEDIAN.loc[district].reindex(here["item_code"]).to_numpy()
    here["ratio"] = (here["price"] / here["usual"]).clip(0.5, 2.0)

    lowest = here.groupby("item_code")["price"].transform("min")
    here["is_cheapest"] = here["price"] == lowest

    g = (here.groupby(["premise", "chain", "premise_type"])
             .agg(items=("item_code", "nunique"), index=("ratio", "mean"),
                  cheapest_on=("is_cheapest", "sum"))
             .reset_index())
    g = g[g["items"] >= STORE_MIN_ITEMS].sort_values("index")
    return [StoreIndex(shop=r.premise, chain=r.chain, shop_type=r.premise_type,
                       items_compared=int(r.items),
                       vs_district_pct=round((r.index - 1) * 100, 1),
                       cheapest_on=int(r.cheapest_on))
            for r in g.itertuples()]


@app.post("/basket", response_model=BasketResult)
def basket(req: BasketRequest):
    """Which single shop in the district is cheapest for the whole basket.

    Each item's price is multiplied by its quantity. Shops that have every item
    come first, cheapest total first. Shops missing items come after, fewest
    missing first, and list what they're missing. The top 10 are returned,
    plus the shop in `include` (the one the user picked) wherever it ranks.
    """
    check_district(req.district)
    qty = {}  # item_code -> quantity; a repeated code keeps its first quantity
    for k, code in enumerate(req.item_codes):
        qty.setdefault(code, req.quantities[k] if req.quantities else 1.0)
    wanted = list(qty)
    unknown = sorted(set(wanted) - set(items["item_code"]))
    if unknown:
        raise HTTPException(404, f"Unknown item codes: {unknown}")
    info = items.set_index("item_code")

    here = latest[(latest["district"] == req.district) & latest["item_code"].isin(wanted)].copy()
    here["quantity"] = here["item_code"].map(qty)
    here["line_total"] = here["price"] * here["quantity"]

    # Baseline: each item bought wherever it is cheapest in the district.
    cheapest = here.loc[here.groupby("item_code")["price"].idxmin()].set_index("item_code")
    basket_items = [BasketItem(
        item_code=int(c), name=info.at[c, "item"], unit=info.at[c, "unit"], quantity=qty[c],
        cheapest_price=round(float(cheapest.at[c, "price"]), 2) if c in cheapest.index else None,
        cheapest_shop=cheapest.at[c, "premise"] if c in cheapest.index else None,
    ) for c in wanted]
    mix_total = float((cheapest["price"] * cheapest.index.map(qty)).sum())

    shops_out = []
    for (code, shop, chain, shop_type), g in here.groupby(["premise_code", "premise", "chain", "premise_type"]):
        found = set(g["item_code"])
        missing = [info.at[c, "item"] for c in wanted if c not in found]
        lines = [BasketLine(item_code=int(r.item_code), name=info.at[r.item_code, "item"],
                            price=round(float(r.price), 2), quantity=float(r.quantity),
                            line_total=round(float(r.line_total), 2))
                 for r in g.sort_values("item_code").itertuples()]
        shops_out.append(BasketShop(
            premise_code=int(code), shop=shop, chain=chain, shop_type=shop_type, complete=not missing,
            total=round(float(g["line_total"].sum()), 2), items_found=len(found),
            missing=missing, lines=lines,
        ))

    shops_out.sort(key=lambda s: (len(s.missing), s.total))
    top = shops_out[:10]
    top += [s for s in shops_out[10:] if s.premise_code == req.include]
    return BasketResult(
        district=req.district,
        items_requested=len(wanted),
        cheapest_mix_total=round(mix_total, 2),
        cheapest_mix_covers=int(cheapest.shape[0]),
        items=basket_items,
        shops=top,
    )


MOVERS_MIN_ROWS = 6  # fewer district movers than this -> use the region's


@app.get("/movers", response_model=Movers)
def weekly_movers(
    district: str = Query(description="District from /areas, e.g. 'Petaling'"),
    limit: int = Query(5, ge=1, le=20),
):
    """Biggest week-on-week price rises and falls (only items seen in 3+ shops both weeks)."""
    region = check_district(district)
    scope, area = "district", district
    rows = movers[(movers["area_type"] == "district") & (movers["area"] == district)]
    if len(rows) < MOVERS_MIN_ROWS:
        scope, area = "region", region
        rows = movers[(movers["area_type"] == "region") & (movers["area"] == region)]
    rows = rows.merge(items[["item_code", "item", "unit"]], on="item_code")

    def to_list(df):
        return [Mover(item_code=int(r.item_code), name=r.item, unit=r.unit,
                      price_before=round(float(r.price_prev), 2), price_now=round(float(r.price), 2),
                      change_pct=round(float(r.change_pct), 1))
                for r in df.itertuples()]

    return Movers(
        scope=scope, area=area,
        week=rows["week"].max().date() if not rows.empty else None,
        risers=to_list(rows[rows["change_pct"] > 0].nlargest(limit, "change_pct")),
        fallers=to_list(rows[rows["change_pct"] < 0].nsmallest(limit, "change_pct")),
    )


@app.get("/deals", response_model=list[Deal])
def deals(
    district: str = Query(description="District from /areas, e.g. 'Petaling'"),
    limit: int = Query(10, ge=1, le=50),
):
    """Items labelled Low right now that you can buy in the district, best deal first."""
    region = check_district(district)
    here = latest[latest["district"] == district]
    cheapest = here.loc[here.groupby("item_code")["price"].idxmin()].set_index("item_code")
    names = items.set_index("item_code")

    out = []
    for code in cheapest.index:
        row, scope = label_for(code, district, region)
        if row is None or row.label != "Low":
            continue
        usual_mid = (row.usual_low + row.usual_high) / 2
        c = cheapest.loc[code]
        out.append(Deal(
            item_code=int(code), name=names.at[code, "item"], unit=names.at[code, "unit"],
            cheapest_price=round(float(c.price), 2), cheapest_shop=c.premise,
            usual_low=float(row.usual_low), usual_high=float(row.usual_high),
            below_usual_pct=round((1 - row.price / usual_mid) * 100, 1),
            label_scope=scope,
        ))
    out.sort(key=lambda d: -d.below_usual_pct)
    return out[:limit]