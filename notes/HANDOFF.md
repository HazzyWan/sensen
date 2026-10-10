# Selangor Grocery Prices: prototype summary

*Technical summary of the September 2026 prototype that SenSen grew out of.*

## What it is
A mobile-style web app that compares grocery prices for the same product across Selangor stores. It uses KPDN's PriceCatcher open data for September 2026 (CC BY 4.0, data.gov.my).

To see it, open `prototype/selangor-grocery-prices.html` in a browser.

## Data
- `pricecatcher_2026-09.csv` has 1.39M rows with the columns date, premise_code, item_code and price.
- `lookup_item.csv` maps item_code to the item name, unit, item_group and item_category.
- `lookup_premise.csv` maps premise_code to the shop name, address, premise_type, state and district.
- Raw data is not stored in this repo. Download it from [data.gov.my](https://data.gov.my/data-catalogue/pricecatcher).

## Processing (build.py)
- Filters to Selangor grocery outlets only: Hypermarket, Supermarket, Pasar Mini, Pasar Basah, Kedai Runcit and Borong. Restaurants and the MAKANAN SIAP MASAK (cooked food) group are excluded.
- Takes each outlet's price as the median of its readings for the month.
- Keeps only items sold in at least 3 outlets.
- Drops prices more than 3× above or below an item's median as typing errors. 3 rows were dropped.
- Groups outlets into chains by name using regex: AEON BiG, Lotus's (Tesco counts as Lotus's), Giant, Mydin, Econsave, 99 Speedmart, Segi Fresh, Hero, Jaya Grocer, TF Value-Mart, NSK and ST Rosyam Mart. Every other outlet falls back to its premise type.
- Computes a chain price index as the mean of the outlet price divided by the item median, clipped to the 0.5–2.0 range.
- Writes data.json, about 1.1 MB. It is embedded into template.html at the `__DATA__` placeholder to produce the final page.

## Results (September 2026)
- 136 outlets, 273 products and 105,827 price records.
- Cheapest chains: Lotus's at −9.0% and Econsave at −7.8%. Econsave is the cheapest chain on the most items, 78 of them.
- Priciest: Jaya Grocer at +16.3% and kedai runcit at +16.7%. Wet markets average +6.5%.

## Design (v4)
- A phone-width app with four bottom tabs.
  - **Home:** search, category tiles, a promo banner, hot picks, cheapest right now, and top stores.
  - **Deals:** sortable by RM saved or by % below the usual price, with group filters.
  - **Stores:** the ranking; tap a store to see the items it's cheapest on.
  - **Insights:** the index chart, cheapest store per category, widest price ranges, and notes on the data.
- A product detail screen shows the cheapest store, the comparison across stores, and shops filtered by district.
- Style: white background, orange (#ff5b22) brand colour with navy, 15 full-colour inline SVG product icons, a colour badge for each store, and Sora and Manrope fonts.
- Search works in English and Malay through a keyword map, so "chicken" finds AYAM.
- Hot picks is a hand-picked list of staples, because the data has no popularity signal.

## Where this goes next
The MVP plan (6 months of history, Selangor and KL, a small API and a PWA) is in the project docs.
