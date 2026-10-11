"""Weekly prices, High / Normal / Low labels and weekly movers.

Reads data/clean/prices.parquet (from clean.py) and writes three tables
to data/clean/:
  weekly.parquet   one price per item, per area, per week
  labels.parquet   High / Normal / Low for the latest week
  movers.parquet   week-on-week change for the latest week

An "area" is either a district (e.g. Petaling) or a whole region
(Selangor, Kuala Lumpur). Region rows help when a district has too few
shops for an item.

Run from the repo root (after clean.py):
    python pipeline/weekly.py
"""

from pathlib import Path

import pandas as pd

CLEAN_DIR = Path("data/clean")

HISTORY_WEEKS = 26   # compare against up to this many earlier weeks
MIN_HISTORY = 8      # fewer earlier weeks than this -> no label
MIN_STORES = 3       # fewer shops than this in a week -> too thin to trust


def add_week(df):
    """Label each reading with the Monday that starts its week."""
    df["week"] = df["date"].dt.to_period("W-SUN").dt.start_time
    return df


def complete_weeks_only(df):
    """Drop partial weeks at either end (data starting mid-week or stopping before Sunday)."""
    first_day, last_day = df["date"].min(), df["date"].max()
    first_week = first_day.to_period("W-SUN").start_time
    last_week = last_day.to_period("W-SUN").start_time
    if first_day.dayofweek != 0:  # 0 = Monday
        first_week += pd.Timedelta(weeks=1)
    if last_day.dayofweek != 6:  # 6 = Sunday
        last_week -= pd.Timedelta(weeks=1)
    return df[(df["week"] >= first_week) & (df["week"] <= last_week)]


def weekly_prices(df):
    # Step 1: one price per shop per week, so busy shops don't dominate.
    shop_week = (df.groupby(["region", "district", "premise_code", "item_code", "week"])
                   ["price"].median().reset_index())

    def per_area(area_col, area_type):
        out = (shop_week.groupby([area_col, "item_code", "week"])
                        .agg(price=("price", "median"), n_stores=("premise_code", "nunique"))
                        .reset_index()
                        .rename(columns={area_col: "area"}))
        out.insert(0, "area_type", area_type)
        return out

    # Step 2: median across shops, for each district and each region.
    return pd.concat([per_area("district", "district"), per_area("region", "region")],
                     ignore_index=True)


def label_latest(weekly):
    latest_week = weekly["week"].max()
    rows = []
    for (area_type, area, item), g in weekly.groupby(["area_type", "area", "item_code"]):
        g = g.sort_values("week")
        now = g[g["week"] == latest_week]
        if now.empty or now["n_stores"].iloc[0] < MIN_STORES:
            continue
        history = g[g["week"] < latest_week].tail(HISTORY_WEEKS)
        if len(history) < MIN_HISTORY:
            continue
        price = now["price"].iloc[0]
        low, high = history["price"].quantile([0.25, 0.75])
        label = "Low" if price < low else "High" if price > high else "Normal"
        rows.append({
            "area_type": area_type, "area": area, "item_code": item,
            "week": latest_week, "price": price, "n_stores": int(now["n_stores"].iloc[0]),
            "usual_low": round(low, 2), "usual_high": round(high, 2),
            "history_weeks": len(history), "label": label,
        })
    return pd.DataFrame(rows)


def movers_latest(weekly):
    weeks = sorted(weekly["week"].unique())
    this_week, last_week = weeks[-1], weeks[-2]
    now = weekly[(weekly["week"] == this_week) & (weekly["n_stores"] >= MIN_STORES)]
    prev = weekly[(weekly["week"] == last_week) & (weekly["n_stores"] >= MIN_STORES)]
    m = now.merge(prev, on=["area_type", "area", "item_code"], suffixes=("", "_prev"))
    m["change_pct"] = (m["price"] / m["price_prev"] - 1) * 100
    return m[["area_type", "area", "item_code", "week", "price_prev", "price",
              "change_pct", "n_stores"]]


def main():
    prices = pd.read_parquet(CLEAN_DIR / "prices.parquet")
    names = prices[["item_code", "item", "unit"]].drop_duplicates("item_code")

    prices = complete_weeks_only(add_week(prices))
    weekly = weekly_prices(prices)
    labels = label_latest(weekly)
    movers = movers_latest(weekly)

    weekly.to_parquet(CLEAN_DIR / "weekly.parquet", index=False)
    labels.to_parquet(CLEAN_DIR / "labels.parquet", index=False)
    movers.to_parquet(CLEAN_DIR / "movers.parquet", index=False)

    first, last = weekly["week"].min().date(), weekly["week"].max().date()
    print(f"Weeks: {weekly['week'].nunique()} complete weeks, {first} to {last} (Mondays)")
    print(f"Weekly rows: {len(weekly):,}")

    print("\n=== Labels for the latest week (region level) ===")
    reg = labels[labels["area_type"] == "region"]
    print(reg.groupby(["area", "label"]).size().unstack(fill_value=0).to_string())
    print(f"Items with a label in at least one district: "
          f"{labels[labels['area_type'] == 'district']['item_code'].nunique()}")

    print("\n=== Biggest movers this week (region level) ===")
    rm = movers[movers["area_type"] == "region"].merge(names, on="item_code")
    for area, g in rm.groupby("area"):
        cols = ["item", "unit", "price_prev", "price", "change_pct"]
        risers = g[g["change_pct"] > 0].nlargest(5, "change_pct")
        fallers = g[g["change_pct"] < 0].nsmallest(5, "change_pct")
        print(f"\n{area}: top 5 risers")
        print(risers[cols].round(2).to_string(index=False))
        print(f"{area}: top 5 fallers")
        print(fallers[cols].round(2).to_string(index=False))


if __name__ == "__main__":
    main()