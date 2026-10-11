"""Download PriceCatcher data from data.gov.my into data/raw/.

Gets the last 6 complete months of prices, plus the item and premise
lookup tables. Files already on disk are skipped, so it is safe to run
again.

Run from the repo root:
    python pipeline/download.py
"""

from datetime import date
from pathlib import Path

import requests

BASE_URL = "https://storage.data.gov.my/pricecatcher"
RAW_DIR = Path("data/raw")
MONTHS_OF_HISTORY = 6


def last_complete_months(n, today=None):
    """Return the n most recent complete months as 'YYYY-MM', oldest first.

    The current month is still being filled in, so it is never included.
    On 11 Oct 2026 with n=6 this gives 2026-04 to 2026-09.
    """
    today = today or date.today()
    year, month = today.year, today.month
    months = []
    for _ in range(n):
        month -= 1
        if month == 0:
            month, year = 12, year - 1
        months.append(f"{year}-{month:02d}")
    return list(reversed(months))


def download(url, dest, force=False):
    """Stream one file to disk. Skips it if it already exists."""
    if dest.exists() and not force:
        print(f"  skip  {dest.name} (already downloaded)")
        return
    print(f"  get   {dest.name} ...", end=" ", flush=True)
    with requests.get(url, stream=True, timeout=60) as resp:
        resp.raise_for_status()  # stop with a clear error on 404 etc.
        tmp = dest.with_suffix(".part")
        with open(tmp, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1 << 20):
                f.write(chunk)
        tmp.replace(dest)  # only rename once the whole file has arrived
    print(f"{dest.stat().st_size / 1e6:.1f} MB")


def main():
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    # Lookups change over time (new items, new shops), so always refresh them.
    print("Lookup tables:")
    for name in ["lookup_item", "lookup_premise"]:
        download(f"{BASE_URL}/{name}.parquet", RAW_DIR / f"{name}.parquet", force=True)

    print(f"Monthly prices ({MONTHS_OF_HISTORY} months):")
    months = last_complete_months(MONTHS_OF_HISTORY)
    for ym in months:
        name = f"pricecatcher_{ym}.parquet"
        # data.gov.my keeps adding late readings to the newest month for a
        # while, so always re-fetch it. Older months are final.
        download(f"{BASE_URL}/{name}", RAW_DIR / name, force=(ym == months[-1]))

    print("Done.")


if __name__ == "__main__":
    main()