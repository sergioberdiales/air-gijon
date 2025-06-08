#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PM2.5 – LightGBM (lags filtrados)  +  ARIMA (con variables exógenas)
"""

from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, make_scorer
from sklearn.model_selection import TimeSeriesSplit
from lightgbm import LGBMRegressor
from statsmodels.tsa.statespace.sarimax import SARIMAX
import joblib, warnings

warnings.filterwarnings("ignore")

# ------------------------------------------------------------------------#
# 1. CONFIGURACIÓN
# ------------------------------------------------------------------------#
CSV_PATH  = Path("constitucion_asturias_air_quality.csv")
MIN_DATE  = "2019-01-01"
TEST_FRAC = 0.10
MODEL_OUT = Path("modelo_lgbm_pm25.joblib")

# LightGBM – hiperparámetros fijos (mejores anteriores)
lgbm_params = dict(
    n_estimators       = 1000,
    learning_rate      = 0.03,
    max_depth          = 6,
    num_leaves         = 31,
    min_child_samples  = 40,
    subsample          = 0.7,
    colsample_bytree   = 0.9,
    reg_lambda         = 1,
    objective          = "mae",
    random_state       = 42,
    n_jobs             = -1,
    verbosity          = -1
)

# ARIMA órdenes básicos (p,d,q); ajusta si quieres afinar
ARIMA_ORDER = (1, 1, 1)

# ------------------------------------------------------------------------#
# 2. CARGA Y LIMPIEZA
# ------------------------------------------------------------------------#
df = pd.read_csv(CSV_PATH)
df.columns = df.columns.str.strip().str.lower()

df = df[["date", "pm25"]].copy()
df["date"] = pd.to_datetime(df["date"], errors="coerce")
df["pm25"] = (df["pm25"]
              .astype(str)
              .str.replace(",", ".", regex=False)
              .str.strip())
df["pm25"] = pd.to_numeric(df["pm25"], errors="coerce")

df = (df.dropna(subset=["date"])
        .set_index("date").sort_index()
        .asfreq("D"))
df["pm25"] = df["pm25"].interpolate(limit_direction="both")

if MIN_DATE:
    df = df[df.index >= pd.Timestamp(MIN_DATE)]

# ------------------------------------------------------------------------#
# 3. FEATURE ENGINEERING
# ------------------------------------------------------------------------#
feat = pd.DataFrame(index=df.index)

# Lags 1-14 + 21 + 28
for k in list(range(1, 15)) + [21, 28]:
    feat[f"lag{k}"] = df["pm25"].shift(k)

# Diferencias absolutas solo entre lags 1-14
for k in range(1, 14):
    feat[f"diff_abs{k}"] = feat[f"lag{k}"] - feat[f"lag{k+1}"]

# Tendencia lineal + tendencia semanal aproximada
feat["trend"]  = (feat.index - feat.index[0]).days
feat["trend7"] = (feat["lag1"] - feat["lag7"]) / 6   # pendiente ~últimos 7 días

# Calendario
feat["wd"]    = feat.index.dayofweek
feat["month"] = feat.index.month

data = feat.join(df["pm25"]).dropna().astype(float)
X, y = data.drop(columns=["pm25"]), data["pm25"]

print(f"Dataset listo: {len(X):,} filas • {X.shape[1]} variables")
mae_persist = mean_absolute_error(y[1:], y.shift(1)[1:])
print(f"MAE persistencia (lag1): {mae_persist:.2f} µg/m³")

# ------------------------------------------------------------------------#
# 4. LIGHTGBM  (TimeSeries CV 5 folds)
# ------------------------------------------------------------------------#
tscv = TimeSeriesSplit(n_splits=5)
mae_scores = []
for train_idx, val_idx in tscv.split(X):
    model = LGBMRegressor(**lgbm_params)
    model.fit(X.iloc[train_idx], y.iloc[train_idx])
    pred = model.predict(X.iloc[val_idx])
    mae_scores.append(mean_absolute_error(y.iloc[val_idx], pred))

print(f"\nLightGBM MAE CV (5 folds): {np.mean(mae_scores):.3f} ± {np.std(mae_scores):.3f}")

# Hold-out
cut = int(len(X) * (1 - TEST_FRAC))
X_train, X_test = X.iloc[:cut], X.iloc[cut:]
y_train, y_test = y.iloc[:cut], y.iloc[cut:]

lgbm_final = LGBMRegressor(**lgbm_params).fit(X_train, y_train)
mae_lgbm_test = mean_absolute_error(y_test, lgbm_final.predict(X_test))
print(f"LightGBM MAE hold-out: {mae_lgbm_test:.2f} µg/m³")

joblib.dump(lgbm_final, MODEL_OUT)
print(f"Modelo LightGBM guardado: {MODEL_OUT.resolve()}")

imp = (pd.Series(lgbm_final.feature_importances_, index=X.columns)
         .sort_values(ascending=False))
print("\nTop-10 features (LightGBM):")
print(imp.head(10).round(2))

# ------------------------------------------------------------------------#
# 5. ARIMA (SARIMAX) con variables exógenas wd y month
# ------------------------------------------------------------------------#
exo = X[["wd", "month"]]   # exogenous regressors
exo_train, exo_test = exo.iloc[:cut], exo.iloc[cut:]

sarima = SARIMAX(y_train, exog=exo_train, order=ARIMA_ORDER, enforce_stationarity=False,
                 enforce_invertibility=False).fit(disp=False)

pred_arima = sarima.predict(start=y_test.index[0], end=y_test.index[-1], exog=exo_test)
mae_arima  = mean_absolute_error(y_test, pred_arima)

print(f"\nARIMA{ARIMA_ORDER} + exógenas MAE hold-out: {mae_arima:.2f} µg/m³")
