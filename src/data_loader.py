"""
data_loader.py
Reads NASA Giovanni area-averaged monthly time series (CSV or XLSX) from data/raw/
and merges them into one tidy monthly table.

Expected layout:
    data/raw/<variable>/<region>_<variable>_<source>_<timestep>_<years>.csv|xlsx
    e.g. data/raw/sst/marmara_sst_modisa_mo_2003-2024.csv

Output of load_all():
    DataFrame with columns: date, region, chl, flh, sst, wind  (missing variables -> NaN)
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
CATALOG_PATH = ROOT / "data" / "data_catalog.csv"

KNOWN_VARIABLES = ("chl", "flh", "sst", "wind")
KNOWN_REGIONS = ("marmara", "aegean", "blacksea")
MODIS_FILL = -32767.0
MERRA2_FILL_THRESHOLD = 1e14


def _parse_fill_value(header_lines: list[str]) -> float | None:
    """Return the fill value declared in the Giovanni header ('Fill Value (...):, -32767')."""
    for line in header_lines:
        if line.lower().startswith("fill value"):
            try:
                return float(str(line).split(",")[-1].strip())
            except ValueError:
                return None
    return None


def read_giovanni_file(path: Path) -> pd.DataFrame:
    """
    Read one Giovanni file and return a clean frame with columns: date, value.
    - skips the metadata header automatically (finds the row starting with 'time')
    - rounds timestamps to the first day of the month (SST rows carry a time of day)
    - converts fill values to NaN and tolerates decimal commas (Excel, Turkish locale)
    """
    if path.suffix.lower() == ".csv":
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        header_row = next(i for i, line in enumerate(lines) if line.strip().lower().startswith("time"))
        fill_value = _parse_fill_value(lines[:header_row])
        df = pd.read_csv(path, skiprows=header_row)
    elif path.suffix.lower() in (".xlsx", ".xls"):
        raw = pd.read_excel(path, header=None)
        first_col = raw.iloc[:, 0].astype(str)
        header_row = int(first_col.index[first_col.str.strip().str.lower().str.startswith("time")][0])
        fill_value = _parse_fill_value(
            [",".join(map(str, row.dropna().tolist())) for _, row in raw.iloc[:header_row].iterrows()]
        )
        df = raw.iloc[header_row + 1:, :2].copy()
    else:
        raise ValueError(f"Unsupported file type: {path.name}")

    df = df.iloc[:, :2]
    df.columns = ["date", "value"]
    df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.to_period("M").dt.to_timestamp()
    df["value"] = pd.to_numeric(df["value"].astype(str).str.replace(",", ".", regex=False), errors="coerce")

    is_fill = (df["value"] <= MODIS_FILL + 1) | (df["value"] >= MERRA2_FILL_THRESHOLD)
    if fill_value is not None:
        is_fill |= np.isclose(df["value"], fill_value)
    df.loc[is_fill, "value"] = np.nan

    df = df.dropna(subset=["date"])
    # one value per month (guards against accidental duplicates)
    return df.groupby("date", as_index=False)["value"].mean()


def parse_file_name(path: Path) -> tuple[str, str] | None:
    """'marmara_sst_modisa_mo_2003-2024.csv' -> ('marmara', 'sst'); None if not recognised."""
    parts = path.stem.lower().split("_")
    if len(parts) < 2 or parts[0] not in KNOWN_REGIONS or parts[1] not in KNOWN_VARIABLES:
        return None
    return parts[0], parts[1]


def load_all(raw_dir: Path = RAW_DIR) -> pd.DataFrame:
    """Read every recognised file under raw_dir and return the merged monthly table."""
    frames = []
    for path in sorted(raw_dir.rglob("*")):
        if path.suffix.lower() not in (".csv", ".xlsx", ".xls"):
            continue
        key = parse_file_name(path)
        if key is None:
            continue
        region, variable = key
        frame = read_giovanni_file(path)
        frame["region"] = region
        frame["variable"] = variable
        frames.append(frame)

    if not frames:
        raise FileNotFoundError(f"No Giovanni files found under {raw_dir}")

    long_df = pd.concat(frames, ignore_index=True)
    wide = (long_df.pivot_table(index=["date", "region"], columns="variable", values="value", aggfunc="mean")
                   .reset_index())
    wide.columns.name = None
    for variable in KNOWN_VARIABLES:
        if variable not in wide.columns:
            wide[variable] = np.nan
    return wide[["date", "region", *KNOWN_VARIABLES]].sort_values(["region", "date"]).reset_index(drop=True)


def load_catalog(path: Path = CATALOG_PATH) -> pd.DataFrame:
    """Load the data catalog (metadata + Giovanni reproduce links). Empty frame if missing."""
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


if __name__ == "__main__":
    table = load_all()
    print(table.head())
    print(f"\nRows: {len(table)}")
    print("Non-empty values per variable:\n" + table[list(KNOWN_VARIABLES)].notna().sum().to_string())