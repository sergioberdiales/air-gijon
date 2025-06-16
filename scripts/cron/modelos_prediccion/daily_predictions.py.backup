#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script de producción para predicciones diarias de PM2.5
Genera las 33 variables del modelo LightGBM y ejecuta predicciones
Entrada: Fecha objetivo (día para el cual hacer predicción)
Salida: JSON con predicciones día actual y día siguiente
"""

import sys
import json
import os
from pathlib import Path
import pandas as pd
import numpy as np
import joblib
import psycopg2
from datetime import datetime, timedelta
import warnings

warnings.filterwarnings("ignore")

# Configuración
MODEL_PATH = Path(__file__).parent / "modelo_lgbm_pm25.joblib"
MIN_REQUIRED_DAYS = 28  # Reducido temporalmente para que funcione con datos limitados

def get_db_connection():
    """Obtiene conexión a PostgreSQL usando variables de entorno"""
    try:
        # En producción (Render) usa DATABASE_URL
        database_url = os.getenv('DATABASE_URL')
        if database_url:
            conn = psycopg2.connect(database_url)
        else:
            # En desarrollo local, construir la conexión
            conn = psycopg2.connect(
                host=os.getenv('DB_HOST', 'localhost'),
                database=os.getenv('DB_NAME', 'air_gijon'),
                user=os.getenv('DB_USER', 'sergio'),
                password=os.getenv('DB_PASSWORD', 'air')
            )
        return conn
    except Exception as e:
        print(f"❌ Error conectando a BD: {e}", file=sys.stderr)
        raise

def load_historical_data(target_date):
    """
    Carga datos históricos de promedios_diarios hasta la fecha objetivo
    
    Args:
        target_date (str): Fecha objetivo en formato YYYY-MM-DD
        
    Returns:
        pd.DataFrame: DataFrame con columnas ['fecha', 'valor'] ordenado por fecha
    """
    conn = get_db_connection()
    try:
        query = """
        SELECT fecha, valor
        FROM promedios_diarios 
        WHERE parametro = 'pm25' 
          AND fecha < %s
        ORDER BY fecha ASC
        """
        
        df = pd.read_sql_query(query, conn, params=[target_date])
        
        if len(df) < MIN_REQUIRED_DAYS:
            raise ValueError(f"Insuficientes datos históricos: {len(df)} días (mínimo: {MIN_REQUIRED_DAYS})")
        
        # Convertir fecha a datetime y establecer como índice
        df['fecha'] = pd.to_datetime(df['fecha'])
        df = df.set_index('fecha').sort_index()
        
        # Renombrar columna para consistencia con el código de entrenamiento
        df = df.rename(columns={'valor': 'pm25'})
        
        print(f"✅ Cargados {len(df)} días de datos históricos hasta {target_date}")
        return df
        
    finally:
        conn.close()

def generate_features(df, target_date):
    """
    Genera las 33 variables del modelo LightGBM solo para la fecha más reciente
    Optimizado para calcular únicamente las variables necesarias
    
    Args:
        df (pd.DataFrame): DataFrame con datos históricos
        target_date (str): Fecha objetivo para calcular variables exógenas
        
    Returns:
        dict: Diccionario con las 33 variables generadas
    """
    print("🔄 Generando 33 variables del modelo (optimizado)...")
    
    if len(df) < 28:
        raise ValueError(f"Insuficientes datos para lag28: {len(df)} días disponibles")
    
    # Usar los valores más recientes para calcular lags
    pm25_values = df["pm25"].values
    latest_date = df.index[-1]
    
    features = {}
    
    # 1. LAGS (16 variables): lag1-lag14, lag21, lag28
    lag_list = list(range(1, 15)) + [21, 28]
    for k in lag_list:
        if len(pm25_values) >= k:
            features[f"lag{k}"] = pm25_values[-k]  # Valor de k días atrás
        else:
            raise ValueError(f"Insuficientes datos para lag{k}")
    print(f"✅ Generados {len(lag_list)} lags")
    
    # 2. DIFERENCIAS ABSOLUTAS (13 variables): diff_abs1-diff_abs13
    for k in range(1, 14):
        features[f"diff_abs{k}"] = features[f"lag{k}"] - features[f"lag{k+1}"]
    print("✅ Generadas 13 diferencias absolutas")
    
    # 3. TENDENCIAS (2 variables)
    # trend: días transcurridos desde el primer dato
    features["trend"] = (latest_date - df.index[0]).days
    # trend7: pendiente últimos 7 días
    features["trend7"] = (features["lag1"] - features["lag7"]) / 6
    print("✅ Generadas 2 variables de tendencia")
    
    # 4. VARIABLES EXÓGENAS (2 variables)
    target_dt = pd.to_datetime(target_date)
    features["wd"] = target_dt.dayofweek  # día de la semana (0=Monday, 6=Sunday)
    features["month"] = target_dt.month   # mes (1-12)
    print("✅ Generadas 2 variables exógenas")
    
    print(f"✅ Features generadas: {len(features)} variables para fecha {target_date}")
    
    # Verificar que tenemos exactamente 33 variables
    expected_vars = 16 + 13 + 2 + 2  # lags + diffs + trends + exogenous
    if len(features) != expected_vars:
        print(f"⚠️ Advertencia: Se esperaban {expected_vars} variables, obtenidas {len(features)}")
    
    return features

def load_model():
    """Carga el modelo LightGBM entrenado"""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Modelo no encontrado en: {MODEL_PATH}")
    
    model = joblib.load(MODEL_PATH)
    print(f"✅ Modelo LightGBM cargado desde: {MODEL_PATH}")
    return model

def make_predictions(features_dict, model, target_date):
    """
    Realiza las dos predicciones: día actual y día siguiente
    
    Args:
        features_dict (dict): Diccionario con features generadas
        model: Modelo LightGBM cargado
        target_date (str): Fecha objetivo
        
    Returns:
        dict: Diccionario con las predicciones
    """
    print("🔮 Realizando predicciones...")
    
    target_dt = pd.to_datetime(target_date)
    
    # Convertir diccionario a DataFrame para el modelo
    features_df = pd.DataFrame([features_dict])
    
    # PREDICCIÓN 1: Día actual (horizonte_dias = 0)
    pred_day_0 = model.predict(features_df)[0]
    pred_day_0 = round(float(pred_day_0), 2)
    
    print(f"✅ Predicción día actual ({target_date}): {pred_day_0} µg/m³")
    
    # PREDICCIÓN 2: Día siguiente (horizonte_dias = 1)
    # Crear nuevas features para el día siguiente
    next_day_features = features_dict.copy()
    
    # Actualizar lags: desplazar todo y usar predicción como lag1
    for k in range(28, 1, -1):  # Empezar desde lag28 hacia lag2
        if f"lag{k}" in next_day_features and f"lag{k-1}" in next_day_features:
            next_day_features[f"lag{k}"] = next_day_features[f"lag{k-1}"]
    
    # La predicción del día actual se convierte en lag1 para el día siguiente
    next_day_features["lag1"] = pred_day_0
    
    # Actualizar diferencias absolutas con los nuevos lags
    for k in range(1, 14):
        if f"lag{k}" in next_day_features and f"lag{k+1}" in next_day_features:
            next_day_features[f"diff_abs{k}"] = next_day_features[f"lag{k}"] - next_day_features[f"lag{k+1}"]
    
    # Actualizar trend7 con el nuevo lag1
    if "lag7" in next_day_features:
        next_day_features["trend7"] = (next_day_features["lag1"] - next_day_features["lag7"]) / 6
    
    # Actualizar trend (agregar 1 día)
    next_day_features["trend"] = next_day_features["trend"] + 1
    
    # Actualizar variables exógenas para el día siguiente
    next_day_dt = target_dt + timedelta(days=1)
    next_day_features["wd"] = next_day_dt.dayofweek
    next_day_features["month"] = next_day_dt.month
    
    # Convertir a DataFrame y hacer predicción para día siguiente
    next_day_df = pd.DataFrame([next_day_features])
    pred_day_1 = model.predict(next_day_df)[0]
    pred_day_1 = round(float(pred_day_1), 2)
    
    next_day_str = next_day_dt.strftime('%Y-%m-%d')
    print(f"✅ Predicción día siguiente ({next_day_str}): {pred_day_1} µg/m³")
    
    return {
        "fecha_generacion": datetime.now().isoformat(),
        "prediccion_dia_actual": {
            "fecha": target_date,
            "valor": pred_day_0,
            "horizonte_dias": 0
        },
        "prediccion_dia_siguiente": {
            "fecha": next_day_str,
            "valor": pred_day_1,
            "horizonte_dias": 1
        },
        "modelo_info": {
            "tipo": "LightGBM",
            "variables_utilizadas": len(features_dict),
            "dias_historicos": "N/A (optimizado)"
        }
    }

def main():
    """Función principal del script"""
    if len(sys.argv) != 2:
        print("Uso: python daily_predictions.py YYYY-MM-DD", file=sys.stderr)
        sys.exit(1)
    
    target_date = sys.argv[1]
    
    try:
        # Validar formato de fecha
        datetime.strptime(target_date, '%Y-%m-%d')
        
        print(f"🚀 INICIO PREDICCIONES DIARIAS - {target_date}")
        print("=" * 50)
        
        # 1. Cargar datos históricos
        historical_data = load_historical_data(target_date)
        
        # 2. Generar features
        features = generate_features(historical_data, target_date)
        
        # 3. Cargar modelo
        model = load_model()
        
        # 4. Hacer predicciones
        predictions = make_predictions(features, model, target_date)
        
        print("\n✅ PREDICCIONES COMPLETADAS")
        print("=" * 50)
        
        # 5. Devolver resultado en JSON
        print(json.dumps(predictions, indent=2))
        
    except ValueError as e:
        error = {"error": "ValueError", "message": str(e)}
        print(json.dumps(error), file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError as e:
        error = {"error": "FileNotFoundError", "message": str(e)}
        print(json.dumps(error), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        error = {"error": "UnexpectedError", "message": str(e)}
        print(json.dumps(error), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 