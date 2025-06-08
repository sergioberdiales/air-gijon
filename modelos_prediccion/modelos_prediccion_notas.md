# Análisis de Modelos de Predicción de PM2.5

## Resumen del Dataset
- **Tamaño del dataset:** 2,319 filas
- **Número de variables:** 33

## Modelos Implementados

### 1. Modelo de Persistencia
- **Descripción:** Predicción a 1 día basada en el promedio de PM2.5 del día anterior
- **MAE:** 8.87 µg/m³

### 2. Modelo LightGBM
- **Descripción:** Modelo con variables autorregresivas (valores pasados de PM2.5) y categóricas exógenas (wd y month)
- **Métricas:**
  - MAE Cross-Validation (5 folds): 9.062 ± 1.063
  - MAE hold-out: 8.37 µg/m³
- **Ubicación del modelo guardado:** `/Users/sergio/projects/air-gijon/modelos_prediccion/modelo_lgbm_pm25.joblib`

#### Top 10 Features (Importancia)
| Feature    | Importancia |
|------------|-------------|
| trend      | 650         |
| diff_abs11 | 638         |
| lag28      | 538         |
| diff_abs3  | 536         |
| diff_abs10 | 522         |
| lag1       | 513         |
| diff_abs4  | 501         |
| diff_abs5  | 490         |
| lag14      | 488         |
| lag21      | 487         |

### 3. Modelo ARIMA
- **Configuración:** ARIMA(1, 1, 1) + variables exógenas
- **MAE hold-out:** 13.92 µg/m³

## Conclusiones
- El modelo LightGBM muestra el mejor rendimiento en el conjunto de hold-out con un MAE de 8.37 µg/m³
- Las variables más importantes para el modelo LightGBM son principalmente tendencias y diferencias absolutas
- El modelo ARIMA muestra un rendimiento inferior en comparación con los otros dos modelos