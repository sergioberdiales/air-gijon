# ✅ Lista de Verificación para Producción

## 🎯 Objetivo
Desplegar sistema LightGBM real (MAE: 8.37 µg/m³) reemplazando predicciones dummy en Render.

## 📋 Estado Actual - ✅ LISTO PARA PRODUCCIÓN

### ✅ **Archivos Preparados**
- [x] `cron_predictions_fixed.js` - Cron job con LightGBM
- [x] `modelos_prediccion/daily_predictions.py` - Script Python  
- [x] `modelos_prediccion/lightgbm_model_v1.pkl` - Modelo entrenado
- [x] `server.js` - Endpoints de testing agregados
- [x] `requirements.txt` - Dependencias Python
- [x] `package.json` - Postinstall script agregado

### ✅ **Base de Datos Lista**
- [x] Tabla `predicciones` con columna `horizonte_dias`
- [x] Constraint UNIQUE actualizado
- [x] Modelo_1.0 registrado con MAE correcto
- [x] Endpoints de testing funcionando localmente

### ✅ **Scripts de Testing Funcionando**
```bash
# ✅ Tested locally:
curl http://localhost:3000/api/test/status
# Response: {"modelo_activo":{"nombre_modelo":"Modelo_1.0","mae":"8.370"}}
```

## 🚀 PASOS PARA DEPLOY (Ejecutar en orden)

### 1. **Git Commit & Push**
```bash
git add .
git commit -m "feat: Sistema LightGBM listo para producción - MAE 8.37 µg/m³"
git push origin main
```

### 2. **Deploy Automático en Render**
- Render detectará el push y desplegará automáticamente
- Las migraciones de BD se ejecutarán automáticamente en `initializeServer()`
- El `postinstall` instalará las dependencias Python

### 3. **Verificar Deploy (5 minutos después)**
```bash
# Verificar estado del sistema
curl https://air-gijon.onrender.com/api/test/status

# Debe devolver:
{
  "modelo_activo": {
    "nombre_modelo": "Modelo_1.0", 
    "mae": 8.37
  },
  "tiene_predicciones_actuales": true
}
```

### 4. **Ejecutar Predicciones Test**
```bash
# Ejecutar predicciones manualmente
curl -X POST https://air-gijon.onrender.com/api/test/predicciones

# Debe devolver:
{
  "success": true,
  "predicciones_generadas": [...]
}
```

### 5. **Verificar Web App**
```bash
# Verificar evolución en la web
curl https://air-gijon.onrender.com/api/air/constitucion/evolucion

# Debe mostrar predicciones con modelo: "Modelo_1.0"
```

### 6. **Verificar Cron Job**
- Ir a Render Dashboard → Cron Jobs → "air-gijon-predictions"
- Verificar que el comando es: `npm run cron-predictions`
- Ejecutar manualmente para verificar (botón "Run Job")
- Revisar logs para confirmar: "Modelo_1.0 (MAE: 8.370 µg/m³)"

## 🎯 **Resultado Esperado**

### **Antes (Dummy)**
```
📊 Usando modelo: Modelo_0.0 (ROC: 0.6500)
🎲 Predicción aleatoria: 18.45 µg/m³
```

### **Después (LightGBM Real)**
```
📊 Usando modelo: Modelo_1.0 (MAE: 8.370 µg/m³)
🤖 Modelo utilizado: LightGBM con 33 variables
✅ Predicción día actual: 28.96 µg/m³ (Regular/IT-3)
```

## 🔍 **Troubleshooting (Si algo falla)**

### **Error: Python dependencies**
```bash
# SSH a Render y ejecutar:
pip3 install pandas numpy joblib lightgbm scikit-learn statsmodels psycopg2-binary
```

### **Error: horizonte_dias constraint**
```bash
# SSH a Render y ejecutar:
node fix_predicciones_table.js
```

### **Error: Modelo no encontrado**
```bash
# SSH a Render y ejecutar:
node create_lightgbm_model.js
```

## ⏰ **Timeline Esperado**

- **0 min**: Git push
- **2-3 min**: Deploy completado en Render
- **5 min**: Migraciones ejecutadas automáticamente  
- **6 min**: Sistema listo para testing
- **10 min**: Cron job verificado manualmente

## 🎉 **¡LISTO!**

Una vez completados estos pasos, tendrás:
- ✅ Predicciones LightGBM reales en producción
- ✅ MAE 8.37 µg/m³ mostrado correctamente
- ✅ Endpoints de testing funcionales
- ✅ Cron job diario ejecutándose automáticamente
- ✅ Sistema de alertas mantenido
- ✅ Frontend mostrando predicciones reales

**El sistema pasará de predicciones dummy a predicciones ML reales entrenadas con datos históricos.** 🚀 