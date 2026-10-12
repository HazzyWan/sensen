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
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

CLEAN_DIR = Path("data/clean")
SERVE_DIR = Path("data/serve")

app = FastAPI(
    title="SenSen API",
    version="0.3.0",
    description="Grocery prices for Selangor and Kuala Lumpur, from PriceCatcher (KPDN, DOSM, CC BY 4.0).",
)

# The app runs on a different address (port 5173) from the API (port 8000), so the
# browser blocks its requests unless the API says that address is allowed.
# The live app's address gets added here in M4.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# ---------- Data, loaded once when the server starts ----------

weekly = pd.read_parquet(CLEAN_DIR / "weekly.parquet")
labels = pd.read_parquet(CLEAN_DIR / "labels.parquet")
items = pd.read_parquet(SERVE_DIR / "items.parquet")
latest = pd.read_parquet(SERVE_DIR / "latest_prices.parquet")
movers = pd.read_parquet(CLEAN_DIR / "movers.parquet")
area_rows = pd.read_parquet(SERVE_DIR / "areas.parquet").sort_values(["region", "district"])

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
    towns: list[str] = Field(description="Main towns in the area, from shop addresses")


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


class BasketLine(BaseModel):
    item_code: int
    name: str
    price: float


class BasketShop(BaseModel):
    shop: str
    chain: str
    shop_type: str
    complete: bool
    total: float = Field(description="Sum of the items this shop has")
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
                 towns=[t for t in r.towns.split("|") if t])
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
        row, scope = label_for(it.item_code, district, region)
        results.append((it.relevance, SearchResult(
            item_code=it.item_code, name=it.item, unit=it.unit, category=it.item_category,
            cheapest_price=round(float(c.price), 2), cheapest_shop=c.premise,
            cheapest_chain=c.chain, price_date=c.date.date(),
            shops_with_price=int(shop_counts[it.item_code]),
            label=row.label if row is not None else None, label_scope=scope,
        )))

    # Best name match first, then items sold in more shops (the staples people want).
    results.sort(key=lambda pair: (pair[0], -pair[1].shops_with_price, pair[1].name))
    return [r for _, r in results[:limit]]


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

    Shops that have every item come first, cheapest total first. Shops missing
    items come after, fewest missing first, and list what they're missing.
    """
    check_district(req.district)
    wanted = list(dict.fromkeys(req.item_codes))  # drop duplicates, keep order
    unknown = sorted(set(wanted) - set(items["item_code"]))
    if unknown:
        raise HTTPException(404, f"Unknown item codes: {unknown}")
    names = items.set_index("item_code")["item"]

    here = latest[(latest["district"] == req.district) & latest["item_code"].isin(wanted)]

    # Baseline: each item bought wherever it is cheapest in the district.
    best = here.groupby("item_code")["price"].min()

    shops_out = []
    for (shop, chain, shop_type), g in here.groupby(["premise", "chain", "premise_type"]):
        found = set(g["item_code"])
        missing = [names[c] for c in wanted if c not in found]
        lines = [BasketLine(item_code=int(r.item_code), name=names[r.item_code],
                            price=round(float(r.price), 2))
                 for r in g.sort_values("item_code").itertuples()]
        shops_out.append(BasketShop(
            shop=shop, chain=chain, shop_type=shop_type, complete=not missing,
            total=round(float(g["price"].sum()), 2), items_found=len(found),
            missing=missing, lines=lines,
        ))

    shops_out.sort(key=lambda s: (len(s.missing), s.total))
    return BasketResult(
        district=req.district,
        items_requested=len(wanted),
        cheapest_mix_total=round(float(best.sum()), 2),
        cheapest_mix_covers=int(best.size),
        shops=shops_out[:10],
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