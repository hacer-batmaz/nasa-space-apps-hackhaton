"""
merge_data.py
Reads every Giovanni CSV in data/raw/ and merges them into one table.

Output: data/processed/all_monthly.csv  ->  columns: time, region, chl, flh, sst, wind

Usage (from the project root):
    python src/merge_data.py
"""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUTPUT_PATH = ROOT / "data" / "processed" / "all_monthly.csv"


def read_giovanni(path: Path) -> pd.DataFrame:
    """Read one Giovanni area-averaged time series CSV into long format."""
    lines = path.read_text(encoding="utf-8").splitlines()
    fill_value = float(lines[6].split(",")[1])                      # line 7: "Fill Value"
    header_row = next(i for i, line in enumerate(lines) if line.startswith("time"))

    df = pd.read_csv(path, skiprows=header_row)
    df.columns = ["time", "value"]
    # SST timestamps include a time of day (e.g. 00:50:01) -> round to the first day of the month
    df["time"] = pd.to_datetime(df["time"]).dt.to_period("M").dt.to_timestamp()
    df.loc[df["value"] == fill_value, "value"] = None               # fill value -> NaN

    region, variable = path.stem.split("_")[:2]                     # marmara_chl_... -> marmara, chl
    df["region"] = region
    df["variable"] = variable
    return df


def main():
    files = sorted(RAW_DIR.rglob("*.csv"))
    print(f"{len(files)} files found")

    long_df = pd.concat([read_giovanni(f) for f in files], ignore_index=True)

    wide_df = (
        long_df.pivot_table(index=["time", "region"], columns="variable", values="value", aggfunc="first")
        .reset_index()
    )
    wide_df.columns.name = None

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    wide_df.to_csv(OUTPUT_PATH, index=False)

    print(f"Saved: {OUTPUT_PATH}")
    print(f"Rows: {len(wide_df)}  (expected: 264 months x 3 regions = 792)")
    print("Empty cells per column:\n" + wide_df.isna().sum().to_string())
    print(wide_df.head())


if __name__ == "__main__":
    main()