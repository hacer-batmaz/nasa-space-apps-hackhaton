from __future__ import annotations

import numpy as np
import pandas as pd
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
    data["sst_lag1"] = data["sst"].shift(1).bfill()
    data["wind_lag1"] = data["wind"].shift(1).bfill()
    data["chl_log"] = np.log10(data["chl"].clip(lower=1e-4))
    data["chl_log_lag1"] = data["chl_log"].shift(1).bfill()
    return data.reset_index(drop=True)


FEATURES = [
    "sst",
    "wind",
    "month_sin",
    "month_cos",
    "sst_lag1",
    "wind_lag1",
    "chl_log_lag1",
]


def train_and_evaluate(df: pd.DataFrame, region: str = "marmara", model_type: str = "rf") -> dict:
    sub = df[df["region"] == region].copy()
    data = prepare_features(sub)

    if len(data) < 48:
        return {"error": "Eğitim için yeterli veri yok."}

    train_df = data[data["date"].dt.year < 2020]
    test_df = data[data["date"].dt.year >= 2020]

    X_train, y_train = train_df[FEATURES], train_df["chl_log"]
    X_test, y_test = test_df[FEATURES], test_df["chl_log"]

    # Model Seçimi
    if model_type == "xgb":
        try:
            from xgboost import XGBRegressor
            model = XGBRegressor(n_estimators=150, learning_rate=0.05, max_depth=4, random_state=42)
            model_name = "XGBoost (Gradient Boosting)"
        except ImportError:
            model = RandomForestRegressor(n_estimators=200, max_depth=6, min_samples_leaf=3, random_state=42)
            model_name = "Random Forest (XGBoost bulunamadı)"
    elif model_type == "svr":
        model = make_pipeline(StandardScaler(), SVR(kernel='rbf', C=1.0, epsilon=0.1))
        model_name = "Support Vector Regression (SVR)"
    else:
        model = RandomForestRegressor(n_estimators=200, max_depth=6, min_samples_leaf=3, random_state=42)
        model_name = "Random Forest Regressor"

    model.fit(X_train, y_train)

    y_pred_log = model.predict(X_test)
    y_test_real = 10**y_test
    y_pred_real = 10**y_pred_log

    r2 = float(r2_score(y_test, y_pred_log))
    mae = float(mean_absolute_error(y_test_real, y_pred_real))

    # Feature Importance kontrolü (SVR'de bu özellik olmadığı için eşit dağılım veya dummy atıyoruz)
    if hasattr(model, "feature_importances_"):
        importances = {
            feat: round(float(imp) * 100, 1)
            for feat, imp in zip(FEATURES, model.feature_importances_)
        }
    else:
        importances = {feat: round(100.0 / len(FEATURES), 1) for feat in FEATURES}

    # Full model (tüm veriyle yeniden eğitim)
    if model_type == "xgb":
        from xgboost import XGBRegressor
        full_model = XGBRegressor(n_estimators=150, learning_rate=0.05, max_depth=4, random_state=42)
    elif model_type == "svr":
        full_model = make_pipeline(StandardScaler(), SVR(kernel='rbf', C=1.0, epsilon=0.1))
    else:
        full_model = RandomForestRegressor(n_estimators=200, max_depth=6, min_samples_leaf=3, random_state=42)

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
    row = pd.DataFrame([[sst, wind, month_sin, month_cos, sst, wind, chl_log_lag]], columns=FEATURES)
    pred_log = model.predict(row)[0]
    return round(float(10**pred_log), 3)