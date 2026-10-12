"""Download PriceCatcher data from data.gov.my into data/raw/.

Gets the last 6 complete months of prices plus the current month so far,
and the item and premise lookup tables. Older months already on disk are
skipped, so it is safe to run again.

Run from the repo root:
    python pipeline/download.py
"""

from datetime import date
from pathlib import Path

import requests

BASE_URL = "https://storage.data.gov.my/pricecatcher"
RAW_DIR = Path("data/raw")
MONTHS_OF_HISTORY = 6


def months_to_fetch(n, today=None):
    """Return the months to download as 'YYYY-MM', oldest first:
    the n most recent complete months, plus the current month so far.

    On 12 Oct 2026 with n=6 this gives 2026-04 to 2026-10.
    """
    today = today or date.today()
    year, month = today.year, today.month
    months = [f"{year}-{month:02d}"]  # the current month, still being filled
    for _ in range(n):
        month -= 1
        if month == 0:
            month, year = 12, year - 1
        months.append(f"{year}-{month:02d}")
    return list(reversed(months))


def download(url, dest, force=False):
    """Stream one file to disk. Skips it if it already exists.

    Returns False if the file is not published yet (404), True otherwise.
    """
    if dest.exists() and not force:
        print(f"  skip  {dest.name} (already downloaded)")
        return True
    print(f"  get   {dest.name} ...", end=" ", flush=True)
    with requests.get(url, stream=True, timeout=60) as resp:
        if resp.status_code == 404:
            print("not published yet")
            return False
        resp.raise_for_status()  # stop with a clear error on any other problem
        tmp = dest.with_suffix(".part")
        with open(tmp, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1 << 20):
                f.write(chunk)
        tmp.replace(dest)  # only rename once the whole file has arrived
    print(f"{dest.stat().st_size / 1e6:.1f} MB")
    return True


def main():
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    # Lookups change over time (new items, new shops), so always refresh them.
    print("Lookup tables:")
    for name in ["lookup_item", "lookup_premise"]:
        download(f"{BASE_URL}/{name}.parquet", RAW_DIR / f"{name}.parquet", force=True)

    months = months_to_fetch(MONTHS_OF_HISTORY)
    print(f"Monthly prices ({months[0]} to {months[-1]}):")
    for ym in months:
        name = f"pricecatcher_{ym}.parquet"
        # data.gov.my keeps adding readings to the current month, and late
        # readings to the month before it, so those two are always re-fetched.
        # Older months are final.
        recent = ym in months[-2:]
        if not download(f"{BASE_URL}/{name}", RAW_DIR / name, force=recent) and ym != months[-1]:
            raise SystemExit(f"{name} is missing on data.gov.my, stopping.")

    # Months that fell out of the window are deleted, so clean.py only sees
    # the months listed above.
    for old in RAW_DIR.glob("pricecatcher_*.parquet"):
        if old.stem.removeprefix("pricecatcher_") not in months:
            old.unlink()
            print(f"  drop  {old.name} (older than the window)")

    print("Done.")


if __name__ == "__main__":
    main()