"""Copy the tables the API needs into api/data.

The pipeline keeps everything under data/ (raw downloads, cleaned prices,
helper tables). The API only needs six small tables. Copying them next to the
API makes api/ a complete package that can be deployed on its own.

Run from the repo root (after publish.py):
    python pipeline/ship.py
"""

import shutil
from pathlib import Path

# folder the pipeline wrote it to -> tables the API reads
NEEDED = {
    "data/clean": ["weekly.parquet", "labels.parquet", "movers.parquet"],
    "data/serve": ["items.parquet", "latest_prices.parquet", "areas.parquet"],
}
OUT_DIR = Path("api/data")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total = 0
    for folder, names in NEEDED.items():
        for name in names:
            src = Path(folder) / name
            shutil.copy2(src, OUT_DIR / name)  # copy2 also keeps the file's date
            size = src.stat().st_size
            total += size
            print(f"{name:<22} {size / 1e6:7.2f} MB")
    print(f"\n{total / 1e6:.2f} MB copied to {OUT_DIR}")


if __name__ == "__main__":
    main()