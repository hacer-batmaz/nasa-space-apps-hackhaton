"""
data_check.py
Quality check for all Giovanni files in data/raw/.

Usage (from the project root):
    python src/data_check.py

Checks:
  1. File name follows the convention  {region}_{variable}_{source}_{timestep}_{years}.csv
  2. Date range (first and last month)
  3. Missing months (gaps in the monthly sequence)
  4. Duplicate dates
  5. Empty / fill values (MODIS: -32767, MERRA-2: 1e15)
  6. Physically implausible values (per-variable valid range)
  7. Outliers (median ± 4*MAD, log scale for chl) – flagged only, never removed
  8. Common period across all files

Output: summary printed to screen + outputs/tables/data_check_report.csv
"""
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "outputs" / "tables"

MODIS_FILL = -32767
MERRA2_FILL_THRESHOLD = 1e14

FILENAME_PATTERN = re.compile(
    r"^(marmara|blacksea|aegean)_(chl|sst|wind|flh)_([a-z0-9]+)_(mo|8d)_([0-9-]+)\.(csv|xlsx)$"
)

# Physically plausible ranges (values outside = likely error or unit problem)
VALID_RANGE = {
    "chl":  (0.01, 100),   # mg m-3
    "sst":  (-2, 35),      # degC (Kelvin would be ~275-305 -> flagged)
    "wind": (0, 30),       # m s-1
    "flh":  (-0.1, 2),     # W m-2 um-1 sr-1
}


def read_giovanni(path: Path) -> pd.DataFrame:
    """Read a Giovanni CSV (or an XLSX converted from it). Returns columns 'time' and 'value'."""
    if path.suffix == ".csv":
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        header_row = next(i for i, line in enumerate(lines) if line.lower().startswith("time"))
        df = pd.read_csv(path, skiprows=header_row)
    else:
        raw = pd.read_excel(path, header=None)
        header_row = raw.index[raw.iloc[:, 0].astype(str).str.lower().str.startswith("time")][0]
        df = raw.iloc[header_row + 1:, :2].copy()

    df = df.iloc[:, :2]
    df.columns = ["time", "value"]
    # SST timestamps include a time of day (e.g. 00:50:01) -> round to the first day of the month
    df["time"] = pd.to_datetime(df["time"], errors="coerce").dt.to_period("M").dt.to_timestamp()
    # Guard against decimal commas (e.g. "0,35") from Excel with Turkish locale
    df["value"] = pd.to_numeric(df["value"].astype(str).str.replace(",", ".", regex=False), errors="coerce")
    return df


def is_fill(values: pd.Series) -> pd.Series:
    """True where the value is a fill value (MODIS -32767 or MERRA-2 1e15)."""
    return (values <= MODIS_FILL + 1) | (values >= MERRA2_FILL_THRESHOLD)


def check_file(path: Path) -> dict:
    result = {"file": str(path.relative_to(RAW_DIR)), "issues": []}

    match = FILENAME_PATTERN.match(path.name)
    if not match:
        result["issues"].append("File name does not follow the naming convention")
        variable = path.parent.name
    else:
        variable = match.group(2)
        if variable != path.parent.name:
            result["issues"].append(f"Wrong folder ({path.parent.name}/), expected: {variable}/")

    try:
        df = read_giovanni(path)
    except Exception as err:  # noqa: BLE001
        result["issues"].append(f"COULD NOT READ: {err}")
        return result

    bad_dates = df["time"].isna().sum()
    if bad_dates:
        result["issues"].append(f"{bad_dates} rows with unreadable dates")
    df = df.dropna(subset=["time"])

    result["start"] = df["time"].min().strftime("%Y-%m")
    result["end"] = df["time"].max().strftime("%Y-%m")
    result["rows"] = len(df)

    # Duplicate dates
    n_duplicates = int(df["time"].duplicated().sum())
    result["duplicates"] = n_duplicates
    if n_duplicates:
        result["issues"].append(f"{n_duplicates} duplicate dates")

    # Missing months
    full_range = pd.date_range(df["time"].min(), df["time"].max(), freq="MS")
    missing = full_range.difference(df["time"])
    result["missing_months"] = len(missing)
    if len(missing):
        preview = ", ".join(d.strftime("%Y-%m") for d in missing[:6])
        result["issues"].append(f"{len(missing)} missing months: {preview}" + (" ..." if len(missing) > 6 else ""))

    # Fill / empty values
    n_fill = int(is_fill(df["value"]).sum())
    n_nan = int(df["value"].isna().sum())
    result["fill_or_empty"] = n_fill + n_nan
    if n_fill + n_nan:
        result["issues"].append(f"{n_fill + n_nan} empty/fill values (keep as NaN, do not delete)")
    values = df.loc[~is_fill(df["value"]), "value"].dropna()

    # Physical range
    low, high = VALID_RANGE.get(variable, (-np.inf, np.inf))
    n_out_of_range = int(((values < low) | (values > high)).sum())
    if n_out_of_range:
        result["issues"].append(f"{n_out_of_range} values outside plausible range [{low}, {high}] – check units")
    result["min"], result["max"], result["mean"] = round(values.min(), 3), round(values.max(), 3), round(values.mean(), 3)

    # Outliers (informational only)
    x = np.log10(values.clip(lower=1e-6)) if variable == "chl" else values
    median = x.median()
    mad = (x - median).abs().median()
    if mad > 0:
        result["outliers_flagged"] = int(((x - median).abs() > 4 * 1.4826 * mad).sum())

    return result


def main():
    files = sorted(p for p in RAW_DIR.rglob("*") if p.suffix in (".csv", ".xlsx"))
    if not files:
        sys.exit(f"No files found in: {RAW_DIR}")
    results = [check_file(p) for p in files]

    print("=" * 92)
    print(f"{'File':<45}{'Start':>9}{'End':>9}{'Rows':>7}{'Missing':>9}{'Dupl.':>7}{'Empty':>7}")
    print("-" * 92)
    for r in results:
        print(f"{r['file']:<45}{r.get('start', '-'):>9}{r.get('end', '-'):>9}{r.get('rows', 0):>7}"
              f"{r.get('missing_months', 0):>9}{r.get('duplicates', 0):>7}{r.get('fill_or_empty', 0):>7}")
    print("=" * 92)

    print("\nISSUES:")
    any_issue = False
    for r in results:
        for issue in r["issues"]:
            any_issue = True
            print(f"  ⚠ {r['file']}: {issue}")
    if not any_issue:
        print("  ✓ No file-level issues found")

    # Common period
    starts = [r["start"] for r in results if "start" in r]
    ends = [r["end"] for r in results if "end" in r]
    if len(set(starts)) > 1 or len(set(ends)) > 1:
        print(f"\n  ⚠ Date ranges differ! Common period: {max(starts)} → {min(ends)}")
        for r in results:
            if r.get("end") != max(ends) or r.get("start") != min(starts):
                print(f"     - {r['file']}: {r.get('start')} → {r.get('end')}")
    else:
        print(f"\n  ✓ All files cover the same period: {starts[0]} → {ends[0]}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    report = pd.DataFrame([{k: (" | ".join(v) if k == "issues" else v) for k, v in r.items()} for r in results])
    report_path = OUT_DIR / "data_check_report.csv"
    report.to_csv(report_path, index=False)
    print(f"\nReport saved: {report_path}")


if __name__ == "__main__":
    main()