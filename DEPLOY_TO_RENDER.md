# 🚀 Despliegue del Sistema LightGBM a Render

## 📋 Resumen de Cambios

### ✅ Sistema LightGBM Implementado
- **Modelo**: Modelo_1.0 con MAE 8.37 µg/m³
- **Variables**: 33 variables (16 lags, 13 diferencias, 2 tendencias, 2 exógenas)
- **Script**: `cron_predictions_fixed.js` (reemplaza predicciones dummy)
- **Métricas**: MAE en lugar de ROC (correcto para regresión)

## 🔧 Archivos Modificados/Nuevos

### **Archivos Principales**
- `cron_predictions_fixed.js` - Cron job con LightGBM real
- `modelos_prediccion/daily_predictions.py` - Script Python LightGBM  
- `modelos_prediccion/lightgbm_model_v1.pkl` - Modelo entrenado
- `server.js` - Endpoints actualizados + endpoints de testing

### **Scripts de Migración** (ejecutar una sola vez)
- `fix_predicciones_table.js` - Agrega columna `horizonte_dias`
- `fix_model_metrics.js` - Migra ROC → MAE
- `create_lightgbm_model.js` - Registra Modelo_1.0

### **Archivos de Testing**
- `test_python_integration.js` - Test local
- `fix_predicciones_table.sql` - SQL para migración manual

## 🚀 Pasos de Despliegue

### 1. **Commit y Push de Cambios**
```bash
git add .
git commit -m "feat: Implementar sistema LightGBM real con MAE 8.37 µg/m³"
git push origin main
```

### 2. **Actualizar Variables de Entorno en Render**
En el Dashboard de Render → Environment:
- ✅ `DATABASE_URL` (ya existe)
- ✅ `NODE_ENV=production` (ya existe) 
- ✅ `MAIL_*` variables (ya existen)

**No se requieren nuevas variables de entorno.**

### 3. **Ejecutar Migraciones de Base de Datos**

#### Opción A: Vía SSH en Render
```bash
# En el terminal de Render
node fix_predicciones_table.js
node fix_model_metrics.js  
node create_lightgbm_model.js
```

#### Opción B: Vía Endpoints de Testing (Recomendado)
Después del deploy, usar:
```bash
# Verificar estado
curl https://air-gijon.onrender.com/api/test/status

# Ejecutar migración manual (si necesario)
# Los scripts se ejecutarán automáticamente en initializeServer()
```

### 4. **Actualizar Cron Job en Render**

#### **Método 1: Reemplazar Cron Job Existente**
1. Ir a Render Dashboard → Cron Jobs → "air-gijon-predictions"
2. Cambiar comando de:
   ```bash
   npm run cron-predictions
   ```
   A:
   ```bash
   npm run cron-predictions
   ```
   (Mismo comando, pero usa el archivo actualizado)

#### **Método 2: Crear Nuevo Cron Job (Si es necesario)**
- **Name**: `air-gijon-lightgbm-predictions`
- **Command**: `npm run cron-predictions`
- **Schedule**: `30 4 * * *` (04:30 AM UTC diario)
- **Environment**: Same as main service

### 5. **Instalar Dependencias Python en Render**

Agregar al `package.json` script de post-install si no existe:
```json
{
  "scripts": {
    "postinstall": "pip3 install pandas numpy joblib lightgbm scikit-learn statsmodels psycopg2-binary"
  }
}
```

O asegurar que `requirements.txt` esté presente:
```txt
pandas>=1.5.0
numpy>=1.20.0
joblib>=1.0.0
lightgbm>=3.3.0
scikit-learn>=1.0.0
statsmodels>=0.13.0
psycopg2-binary>=2.9.0
```

## 🧪 Testing en Producción

### **Endpoints de Testing Añadidos**

#### 1. Estado del Sistema
```bash
GET https://air-gijon.onrender.com/api/test/status
```
**Respuesta esperada**:
```json
{
  "modelo_activo": {
    "nombre_modelo": "Modelo_1.0", 
    "mae": 8.37,
    "activo": true
  },
  "tiene_predicciones_actuales": true,
  "predicciones_hoy_manana": [...],
  "timestamp": "2025-06-08T18:41:27.879Z"
}
```

#### 2. Ejecutar Predicciones Manualmente
```bash
POST https://air-gijon.onrender.com/api/test/predicciones
```
**Respuesta esperada**:
```json
{
  "success": true,
  "mensaje": "Predicciones ejecutadas exitosamente",
  "predicciones_generadas": [
    {
      "fecha": "2025-06-08",
      "valor": 28.96,
      "horizonte_dias": 0,
      "nombre_modelo": "Modelo_1.0",
      "mae": 8.37
    }
  ]
}
```

#### 3. Verificar Evolución con Predicciones Reales
```bash
GET https://air-gijon.onrender.com/api/air/constitucion/evolucion
```
Debe mostrar predicciones con `modelo: "Modelo_1.0"` y `mae: 8.37`.

## ✅ Checklist de Verificación

### **Antes del Deploy**
- [ ] Todos los archivos commiteados y pusheados
- [ ] Tests locales ejecutados exitosamente
- [ ] Python dependencies instaladas localmente

### **Después del Deploy** 
- [ ] `GET /api/test/status` devuelve `modelo_activo: "Modelo_1.0"`
- [ ] `POST /api/test/predicciones` ejecuta exitosamente
- [ ] `GET /api/air/constitucion/evolucion` muestra predicciones reales
- [ ] Cron job se ejecuta sin errores (verificar logs)
- [ ] Alertas por email funcionando (si hay usuarios suscritos)

### **Verificación del Modelo**
- [ ] MAE mostrado: `8.370 µg/m³` (no ROC)
- [ ] Log muestra: `"LightGBM con 33 variables"`
- [ ] Predicciones coherentes (no aleatorias)
- [ ] Horizonte_dias = 0 (hoy) y 1 (mañana)

## 🔍 Troubleshooting

### Error: "Python not found"
```bash
# En Render, asegurar que el buildpack incluye Python
# O instalar vía package.json postinstall
```

### Error: "lightgbm module not found"
```bash
# Verificar requirements.txt o postinstall script
pip3 install lightgbm
```

### Error: "Model file not found"
```bash
# Verificar que lightgbm_model_v1.pkl esté en el repo
ls -la modelos_prediccion/
```

### Error: "horizonte_dias constraint"
```bash
# Ejecutar migración de tabla
node fix_predicciones_table.js
```

## 📊 Monitoreo Post-Deploy

### **Logs a Vigilar**
```bash
# En logs del cron job, buscar:
"📊 Usando modelo: Modelo_1.0 (ID: X, MAE: 8.370 µg/m³)"
"🤖 Modelo utilizado: LightGBM con 33 variables" 
"✅ Predicción día actual: XX.XX µg/m³"
```

### **Alertas Esperadas**
- Si PM2.5 > 25 µg/m³ → Email alerts enviados
- Predicciones realistas (15-40 µg/m³ típicamente)
- No errores de parseo JSON

## 🎉 Resultado Final

**Antes**: Predicciones dummy aleatorias
**Después**: Predicciones LightGBM reales con MAE 8.37 µg/m³

El sistema mantiene todas las funcionalidades existentes (emails, API endpoints, frontend) pero ahora con predicciones reales entrenadas con datos históricos. 