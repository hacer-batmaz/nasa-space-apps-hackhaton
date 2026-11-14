"""
run_analysis.py
Runs the full analysis on data/processed/all_monthly.csv and saves results.

Outputs:
  outputs/tables/trend_results.csv           trend for every region x variable
  outputs/tables/event_2021_mucilage.csv     monthly anomalies, Jan 2020 – Dec 2021
  outputs/figures/trend_<variable>.png       12-month smoothed anomaly, 3 regions
  outputs/figures/event_2021_marmara.png     Marmara: all variables around the mucilage event

Usage (from the project root):
    python src/run_analysis.py
"""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

from analysis import (REGIONS, ROOT, VARIABLES, compute_anomaly, describe_trend, event_anomaly,
                      get_series, load_data, trend_test)

TABLE_DIR = ROOT / "outputs" / "tables"
FIGURE_DIR = ROOT / "outputs" / "figures"
EVENT_START, EVENT_END = "2020-01", "2021-12"
MUCILAGE_PEAK = (pd.Timestamp("2021-04-01"), pd.Timestamp("2021-07-01"))
REGION_COLORS = {"marmara": "#c0392b", "blacksea": "#2c3e50", "aegean": "#2980b9"}


def main():
    TABLE_DIR.mkdir(parents=True, exist_ok=True)
    FIGURE_DIR.mkdir(parents=True, exist_ok=True)
    df = load_data()

    # ---- 1. Trend table -------------------------------------------------------
    trend_rows, event_rows = [], []
    print("\nTREND RESULTS (2003–2024, deseasonalised)")
    print("-" * 100)
    for variable, (_, _, log_transform) in VARIABLES.items():
        for region in REGIONS:
            series = get_series(df, region, variable)
            if series.dropna().empty:
                continue
            res = trend_test(series, log_transform)
            trend_rows.append({"region": region, "variable": variable, **res})
            print("  " + describe_trend(region, variable, res))

            ev = event_anomaly(series, log_transform, EVENT_START, EVENT_END)
            ev = ev.reset_index().assign(region=region, variable=variable)
            event_rows.append(ev)

    pd.DataFrame(trend_rows).to_csv(TABLE_DIR / "trend_results.csv", index=False)
    events = pd.concat(event_rows, ignore_index=True)
    events.to_csv(TABLE_DIR / "event_2021_mucilage.csv", index=False)

    # ---- 2. Event summary (Marmara, mucilage peak) ----------------------------
    print("\nMARMARA – MUCILAGE PERIOD (Apr–Jun 2021), z-score vs normal for that month")
    print("  (z > +1: clearly above normal, z < -1: clearly below normal)")
    print("-" * 100)
    marmara = events[(events["region"] == "marmara")
                     & (events["date"] >= "2021-04-01") & (events["date"] <= "2021-06-01")]
    print(marmara.pivot(index="date", columns="variable", values="z_score").round(2).to_string())

    # ---- 3. Figures: one per variable, three regions --------------------------
    for variable, (name, unit, log_transform) in VARIABLES.items():
        fig, ax = plt.subplots(figsize=(11, 4))
        for region in REGIONS:
            series = get_series(df, region, variable)
            if series.dropna().empty:
                continue
            smoothed = compute_anomaly(series, log_transform).rolling(12, center=True, min_periods=9).mean()
            res = trend_test(series, log_transform)
            label = (f"{REGIONS[region]}: {res['change_per_decade']:+.2f} {res['change_unit']}"
                     f" (p={res['p_value']:.3f})")
            ax.plot(smoothed, color=REGION_COLORS[region], lw=2, label=label)
        ax.axhline(0, color="black", lw=0.7)
        ax.axvspan(*MUCILAGE_PEAK, color="orange", alpha=0.25, label="2021 mucilage")
        ylabel = "Anomaly (log10 units)" if log_transform else f"Anomaly ({unit})"
        ax.set(title=f"{name} – deseasonalised anomaly, 12-month mean", ylabel=ylabel)
        ax.legend(fontsize=8)
        ax.grid(alpha=0.3)
        fig.tight_layout()
        fig.savefig(FIGURE_DIR / f"trend_{variable}.png", dpi=150)
        plt.close(fig)

    # ---- 4. Figure: Marmara event, all variables -----------------------------
    m = events[events["region"] == "marmara"].pivot(index="date", columns="variable", values="z_score")
    fig, ax = plt.subplots(figsize=(11, 4))
    for variable in m.columns:
        ax.plot(m.index, m[variable], marker="o", lw=1.5, label=VARIABLES[variable][0])
    ax.axhline(0, color="black", lw=0.7)
    ax.axhspan(-1, 1, color="grey", alpha=0.1, label="normal range (±1 std)")
    ax.axvspan(*MUCILAGE_PEAK, color="orange", alpha=0.25, label="mucilage peak")
    ax.set(title="Sea of Marmara – monthly anomalies around the 2021 mucilage event",
           ylabel="z-score (std from normal)")
    ax.legend(fontsize=8, ncol=3)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(FIGURE_DIR / "event_2021_marmara.png", dpi=150)
    plt.close(fig)

    print(f"\nTables saved to:  {TABLE_DIR}")
    print(f"Figures saved to: {FIGURE_DIR}")


if __name__ == "__main__":
    main()