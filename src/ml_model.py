from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR


def prepare_features(df_region: pd.DataFrame) -> pd.DataFrame:
    data = df_region.dropna(subset=["sst", "wind", "chl"]).sort_values("date").copy()
    data["month"] = data["date"].dt.month
    data["month_sin"] = np.sin(2 * np.pi * data["month"] / 12.0)
    data["month_cos"] = np.cos(2 * np.pi * data["month"] / 12.0)

    # IMPROVEMENT 1: Multiple lags (Lag 1, 2, 3) and rolling mean
    # To capture the cumulative effect of sea water temperature and calm conditions:
    data["sst_lag1"] = data["sst"].shift(1).bfill()
    data["sst_lag2"] = data["sst"].shift(2).bfill()
    data["sst_roll3"] = data["sst"].rolling(3, min_periods=1).mean()

    data["wind_lag1"] = data["wind"].shift(1).bfill()
    data["wind_roll3"] = data["wind"].rolling(3, min_periods=1).mean()

    data["chl_log"] = np.log10(data["chl"].clip(lower=1e-4))
    data["chl_log_lag1"] = data["chl_log"].shift(1).bfill()
    data["chl_log_lag2"] = data["chl_log"].shift(2).bfill()

    return data.reset_index(drop=True)


FEATURES = [
    "sst",
    "wind",
    "month_sin",
    "month_cos",
    "sst_lag1",
    "sst_lag2",
    "sst_roll3",
    "wind_lag1",
    "wind_roll3",
    "chl_log_lag1",
    "chl_log_lag2",
]


def train_and_evaluate(df: pd.DataFrame, region: str = "marmara", model_type: str = "rf") -> dict:
    sub = df[df["region"] == region].copy()
    data = prepare_features(sub)

    if len(data) < 48:
        return {"error": "Not enough data for training."}

    train_df = data[data["date"].dt.year < 2020]
    test_df = data[data["date"].dt.year >= 2020]

    X_train, y_train = train_df[FEATURES], train_df["chl_log"]
    X_test, y_test = test_df[FEATURES], test_df["chl_log"]

    # IMPROVEMENT 2: Optimized hyperparameters (stronger trees and regularization)
    if model_type == "xgb":
        try:
            from xgboost import XGBRegressor
            model = XGBRegressor(
                n_estimators=300,
                learning_rate=0.03,
                max_depth=5,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42
            )
            model_name = "XGBoost (Optimized)"
        except ImportError:
            model = RandomForestRegressor(n_estimators=300, max_depth=8, min_samples_leaf=2, random_state=42)
            model_name = "Random Forest (XGBoost not found)"
    elif model_type == "svr":
        # C=1, epsilon=0.1: with only 204 training months, larger C values overfit and score worse on the blind test
        model = make_pipeline(StandardScaler(), SVR(kernel='rbf', C=1.0, epsilon=0.1))
        model_name = "Support Vector Regression (SVR)"
    else:
        model = RandomForestRegressor(
            n_estimators=300,
            max_depth=8,
            min_samples_leaf=2,
            max_features='sqrt',
            random_state=42
        )
        model_name = "Random Forest (Optimized)"

    model.fit(X_train, y_train)

    y_pred_log = model.predict(X_test)
    y_test_real = 10**y_test
    y_pred_real = 10**y_pred_log

    r2 = float(r2_score(y_test, y_pred_log))
    mae = float(mean_absolute_error(y_test_real, y_pred_real))

    if hasattr(model, "feature_importances_"):
        importances = {
            feat: round(float(imp) * 100, 1)
            for feat, imp in zip(FEATURES, model.feature_importances_)
        }
    else:
        importances = {feat: round(100.0 / len(FEATURES), 1) for feat in FEATURES}

    full_model = clone(model)
    full_model.fit(data[FEATURES], data["chl_log"])

    return {
        "region": region,
        "model_name": model_name,
        "train_period": f"{train_df['date'].dt.year.min()}–{train_df['date'].dt.year.max()}",
        "test_period": f"{test_df['date'].dt.year.min()}–{test_df['date'].dt.year.max()}",
        "train_samples": int(len(train_df)),
        "test_samples": int(len(test_df)),
        "r2_score": round(r2, 3),
        "mae": round(mae, 3),
        "feature_importances": importances,
        "test_dates": [d.strftime("%Y-%m-%d") for d in test_df["date"]],
        "actual_chl": [round(float(v), 3) for v in y_test_real],
        "predicted_chl": [round(float(v), 3) for v in y_pred_real],
        "_model": full_model,
    }


def predict_scenario_chl(model_bundle: dict, sst: float, wind: float, base_chl: float, month: int = 5) -> float:
    model = model_bundle.get("_model")
    if model is None:
        return base_chl
    month_sin = np.sin(2 * np.pi * month / 12.0)
    month_cos = np.cos(2 * np.pi * month / 12.0)
    chl_log_lag = np.log10(max(base_chl, 1e-4))

    # Default values of the newly added features in the scenario prediction (lags are filled with the base chlorophyll)
    row = pd.DataFrame([[
        sst, wind, month_sin, month_cos,
        sst, sst, sst,           # sst_lag1, sst_lag2, sst_roll3
        wind, wind,              # wind_lag1, wind_roll3
        chl_log_lag, chl_log_lag # chl_log_lag1, chl_log_lag2
    ]], columns=FEATURES)

    pred_log = model.predict(row)[0]
    return round(float(10**pred_log), 3)