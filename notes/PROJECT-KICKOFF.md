# Grocery Price Comparison App: project kickoff brief

*Original kickoff notes, October 2026. Current decisions are in the project docs.*

## 1. Goal
Build a full grocery price comparison app for Malaysia, starting with Selangor, and treat it as a properly documented software project. It needs a clear plan for the stack, language, database and architecture before any code is written.

The September 2026 prototype is a reference only (see `prototype/selangor-grocery-prices.html`, open it in a browser). The real project starts from scratch.

## 2. What the app does (from the prototype)
- **Home:** search products in English or Malay, category shortcuts, hot picks, cheapest items right now, and the cheapest stores.
- **Product page:** the cheapest store, the price at every store, how much you save, and shops filtered by district.
- **Deals:** products where choosing the right store saves the most, by RM or by %.
- **Stores:** a chain ranking; tap a store to see the products it's cheapest on.
- **Insights:** the price index, cheapest store per category, widest price ranges, and notes on the data.
- **Look and feel:** a mobile-app layout with a white background, colourful icons, and an orange and navy palette.

## 3. What we learned so far
- **PriceCatcher is the legal core data source.** It's KPDN and DOSM open data on data.gov.my, under CC BY 4.0, so commercial use with attribution is allowed.
  - It's split into 3 files: monthly prices (date, premise_code, item_code, price), `lookup_item` and `lookup_premise`.
  - It covers about 2,000 items and thousands of premises, and is updated monthly. September 2026 has 1.39M rows nationally.
  - Limitations:
    - It's monthly, not live.
    - It covers mostly staples rather than every product.
    - Some chains have only 1–4 outlets surveyed.
    - Item names are in Malay.
    - It contains some mis-typed prices, such as chicken at RM 1,359/kg.
  - It also includes restaurants and cooked food, which need filtering out.
- **Main competitor: ManaMurah (manamurah.com).** Study it first. It already turns PriceCatcher data into a consumer website covering about 297 items. It has:
  - Weekly national averages and week-on-week changes.
  - The biggest price risers and fallers each week.
  - Nearby stores priced below average.
  - A shopping list that works out the cheapest mix of nearby stores, including travel cost.
  - A price map, state and chain directories, yearly pages from 2022 to 2026, a blog, and an MCP server.
  - Its weaknesses: it's website-only and table-heavy, it relies only on PriceCatcher, and its prices are weekly aggregates.
- **Other competitors:**
  - The PriceCatcher app (government).
  - Hargapedia.
  - pricetracker.my.
  - SmartShopper Malaysia.
  - JimatBasket, reported as an open-source project combining PriceCatcher, online store data and crowdsourced receipts (not yet verified).
- **What doesn't work:** Asking users to scan receipts. Users won't go to that effort. Any feature has to fit into something people already do, such as chat or browsing, or serve a moment when they really need it.
- **Names already taken:** ManaMurah, Troli (a grocery budget app) and Cek Harga (Indonesia). Shortlist was SenSen, Banding, Bakul and KedaiMana; SenSen was chosen.
- **Possible ways to stand out:**
  - Basket optimiser (cheapest single store vs a mixed trip).
  - Receipt and shelf-tag photo scanning with OCR and computer vision to crowdsource in-store prices.
  - Price-drop alerts.
  - Promo leaflet extraction.
  - A B2B version for small food businesses.

## 4. Data processing rules from the prototype (to carry over or revisit)
- Keep grocery premise types only: Hypermarket, Supermarket, Pasar Mini, Pasar Basah, Kedai Runcit and Borong. Exclude the MAKANAN SIAP MASAK (cooked food) group.
- Take each outlet's price as the median of its readings for the month.
- Keep only items sold in at least 3 outlets.
- Drop prices more than 3× above or below an item's median as outliers.
- Group outlets into chains by name, counting Tesco as Lotus's.
- Calculate a chain index as the mean of outlet price divided by item median, clipped to the 0.5–2.0 range.
- Use an English–Malay keyword map for search.

## 5. Open decisions for the research phase
**Positioning against ManaMurah (decide this first)**
- What will this app do that ManaMurah doesn't?
- Candidate angles:
  - A mobile-first app experience instead of a website with tables.
  - A WhatsApp or Telegram bot ("harga ayam Shah Alam") with a weekly cheapest-staples message people can forward to family groups.
  - Deeper analytics and forecasting, such as district price indexes, price-spike alerts and trends.
  - Extra data sources beyond PriceCatcher.
  - A B2B version for small food businesses.
- Alternatively, treat it mainly as a portfolio project, where the quality of the architecture matters more than being first.

**Product scope**
- Who is the target user: consumers, small businesses, or both?
- What's in the MVP versus later versions?
- Should the first launch cover Selangor only, or the whole country?
- Platform: a web app, a PWA, native mobile, or cross-platform?
- What's the business model, such as ads, affiliate links, B2B subscriptions or a data product?

**Data**
- Which sources to use: PriceCatcher only at first, or also user receipts and promo leaflets?
- How to import it: a scheduled monthly ingest pipeline, and how to keep price history.
- How to match products across sources, which is entity resolution.
- How to tackle the data-quality problems: outliers, missing chains and stale prices.

**Tech stack** (compare options and justify each choice)
- Frontend framework and UI library.
- Backend language and framework.
- Database: relational, time-series or analytical, or a combination.
- Search engine with support for mixed Malay and English (fuzzy search, synonyms).
- Data pipeline and scheduler.
- Hosting and deployment, keeping cost in mind.
- Authentication, if accounts, alerts or saved baskets are included.
- OCR or computer vision pipeline, if receipt scanning is included.

**Architecture**
- System architecture diagram.
- Data model and ERD: items, premises, chains, prices, price history, users, baskets and alerts.
- API design.
- Caching and performance.
- Plans for privacy, licensing and attribution.

## 6. Documents the project should produce
1. Project overview, problem statement and positioning against ManaMurah
2. Requirements (functional and non-functional) and user stories
3. Competitor and market analysis
4. Data source analysis and data dictionary
5. Tech stack decision record, with options, trade-offs and the final choice
6. System architecture and diagrams
7. Database schema and ERD
8. API specification
9. UI/UX design: screens and user flows, using the prototype as reference
10. Implementation roadmap and milestones
11. Testing and deployment plan

## 7. Reference files from the prototype
All in the `prototype/` folder:
- `build.py`: the Python and pandas pipeline that joins the three PriceCatcher files and computes the comparisons.
- `template.html` and `selangor-grocery-prices.html`: the prototype app's code and the finished page.

Raw data is not stored in this repo. Download it from [data.gov.my](https://data.gov.my/data-catalogue/pricecatcher):
- The monthly prices file, e.g. `pricecatcher_2026-09.csv`
- `lookup_item.csv`
- `lookup_premise.csv`
