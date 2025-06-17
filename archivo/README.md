# 📂 Archivo del Proyecto Air Gijón

Este directorio contiene archivos que se han movido del proyecto principal para mantener el orden y permitir rollback si es necesario.

## 📁 Estructura

### `scripts_antiguos/`
Contiene versiones anteriores de scripts que han sido actualizados o reemplazados.

#### `modelos_prediccion/`
- `daily_predictions_version_antigua.py`: Versión anterior del script de predicciones (281 líneas, sin funciones de cálculo automático de promedios)
  - **Origen**: `desarrollo_modelos_prediccion/daily_predictions.py`
  - **Razón del archivo**: Duplicado del script activo pero sin las mejoras del 16/06/2025
  - **Script activo**: `scripts/cron/modelos_prediccion/daily_predictions.py` (481 líneas, con mejoras)

## 🔄 Rollback

Si necesitas restaurar algún archivo:
```bash
# Ejemplo para restaurar el script de predicciones
cp archivo/scripts_antiguos/modelos_prediccion/daily_predictions_version_antigua.py desarrollo_modelos_prediccion/daily_predictions.py
```

## 📅 Historial de Limpieza

- **16/06/2025**: Movido `daily_predictions.py` duplicado de `desarrollo_modelos_prediccion/` (versión sin mejoras de cálculo automático) 