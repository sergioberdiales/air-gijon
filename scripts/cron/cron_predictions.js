#!/usr/bin/env node

// Cargar variables de entorno para ejecución directa del cron
if (process.env.NODE_ENV !== 'production') {
  // Asumimos que tienes un .env_local o .env en la raíz para desarrollo
  try {
    require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env_local') });
    console.log('📄 Variables de .env_local cargadas para el cron.');
    if (!process.env.MAIL_USER) {
      // Si .env_local no existe o no tiene las variables, intenta con .env
      require('dotenv').config(); 
      console.log('📄 Variables de .env cargadas para el cron (fallback).');
    }
  } catch (e) {
    // Si .env_local no existe, intenta con .env por defecto
    try {
        require('dotenv').config(); 
        console.log('📄 Variables de .env cargadas para el cron.');
    } catch (e2) {
        console.warn('⚠️ No se encontró .env_local ni .env, las variables de entorno deben estar definidas globalmente.')
    }
  }
}

// Script para generar predicciones diarias usando LightGBM
// Se ejecuta automáticamente para generar predicciones de PM2.5

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const { 
  pool, 
  getUsersForDailyPredictions, 
  createTables,      
  createIndexes      
} = require('./db');
const { sendNotificationEmail } = require('./mailer');

const execAsync = promisify(exec);

// Función para calcular el estado de calidad del aire según PM2.5
function getEstadoPM25(pm25) {
  if (pm25 <= 15) return 'Buena';
  if (pm25 <= 25) return 'Moderada';
  if (pm25 <= 50) return 'Regular';
  return 'Mala';
}

// Función para calcular estado OMS según PM2.5
function getEstadoOMS(pm25) {
  if (pm25 <= 15) return 'AQG';
  if (pm25 <= 25) return 'IT-4';
  if (pm25 <= 37.5) return 'IT-3';
  if (pm25 <= 50) return 'IT-2';
  if (pm25 <= 75) return 'IT-1';
  return '>IT-1';
}

async function obtenerModeloActivo() {
  try {
    const result = await pool.query(`
      SELECT id, nombre_modelo, roc_index
      FROM modelos_prediccion
      WHERE activo = true
      ORDER BY id DESC
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      throw new Error('No hay modelo activo configurado');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error obteniendo modelo activo:', error);
    throw error;
  }
}

async function ejecutarPrediccionesPython(fechaObjetivo) {
  try {
    console.log(`🐍 Ejecutando predicciones Python para fecha: ${fechaObjetivo}`);
    
    const scriptPath = path.join(__dirname, 'modelos_prediccion', 'daily_predictions.py');
    const command = `python3 ${scriptPath} ${fechaObjetivo}`;
    
    const { stdout, stderr } = await execAsync(command, { 
      timeout: 60000, // 60 segundos timeout
      maxBuffer: 1024 * 1024 // 1MB buffer
    });
    
    if (stderr && !stderr.includes('warnings.filterwarnings')) {
      console.warn('⚠️ Warning desde Python:', stderr);
    }
    
    // Parsear JSON de la salida
    const lines = stdout.trim().split('\n');
    
    // Buscar el JSON que empieza con { y termina con }
    let jsonStart = -1;
    let jsonEnd = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('{')) {
        jsonStart = i;
      }
      if (lines[i].trim() === '}' && jsonStart >= 0) {
        jsonEnd = i;
        break;
      }
    }
    
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('No se encontró JSON válido en la salida de Python');
    }
    
    const jsonLines = lines.slice(jsonStart, jsonEnd + 1);
    const jsonString = jsonLines.join('\n');
    
    console.log('🔍 JSON encontrado:', jsonString.substring(0, 100) + '...');
    
    const predictions = JSON.parse(jsonString);
    console.log('✅ Predicciones Python ejecutadas exitosamente');
    
    return predictions;
    
  } catch (error) {
    console.error('❌ Error ejecutando predicciones Python:', error);
    
    // Mostrar información detallada para debuggear
    console.error('📝 Salida completa stdout:', stdout);
    console.error('📝 Salida completa stderr:', stderr);
    console.error('📝 Comando ejecutado:', command);
    
    throw error;
  }
}

async function insertarPrediccion(fecha, estacionId, modeloId, parametro, valor, horizonteDias) {
  try {
    const result = await pool.query(`
      INSERT INTO predicciones (
        fecha, 
        estacion_id, 
        modelo_id, 
        parametro, 
        valor,
        horizonte_dias,
        fecha_generacion
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (fecha, estacion_id, modelo_id, parametro, horizonte_dias) 
      DO UPDATE SET
        valor = EXCLUDED.valor,
        fecha_generacion = CURRENT_TIMESTAMP
      RETURNING id
    `, [fecha, estacionId, modeloId, parametro, valor, horizonteDias]);
    
    return result.rows[0].id;
  } catch (error) {
    console.error(`❌ Error insertando predicción para ${fecha} (horizonte: ${horizonteDias}):`, error);
    throw error;
  }
}

async function inicializarBDParaCron() {
  try {
    console.log('⚙️ Asegurando estructura de BD para el cron...');
    await createTables();
    await createIndexes();
    console.log('✅ Estructura de BD para cron verificada.');
  } catch (error) {
    console.error('❌ Error inicializando BD para cron:', error);
    throw error; 
  }
}

async function generarPrediccionesDiarias() {
  try {
    // Asegurar que la BD esté lista ANTES de cualquier otra operación
    await inicializarBDParaCron();

    console.log('🔮 Iniciando generación de predicciones diarias con LightGBM...');
    
    // 1. Obtener modelo activo
    const modelo = await obtenerModeloActivo();
    console.log(`📊 Usando modelo: ${modelo.nombre_modelo} (ID: ${modelo.id}, ROC: ${modelo.roc_index})`);
    
    // 2. Ejecutar predicciones Python con LightGBM
    const hoy = new Date();
    const fechaObjetivo = hoy.toISOString().split('T')[0]; // Hoy
    
    console.log(`📅 Generando predicciones para objetivo: ${fechaObjetivo}`);
    const predictions = await ejecutarPrediccionesPython(fechaObjetivo);
    
    console.log(`🤖 Modelo utilizado: ${predictions.modelo_info.tipo} con ${predictions.modelo_info.variables_utilizadas} variables`);
    
    // 3. Insertar predicciones en la base de datos
    const estacionId = '6699'; // Avenida Constitución
    const parametro = 'pm25';
    const UMBRAL_ALERTA_PM25 = 25; // µg/m³ (Moderada o peor)
    
    let prediccionesGeneradas = 0;
    let alertasEnviadas = 0;
    
    // Insertar predicción día actual (horizonte_dias = 0)
    const predDiaActual = predictions.prediccion_dia_actual;
    const prediccionId1 = await insertarPrediccion(
      predDiaActual.fecha,
      estacionId,
      modelo.id,
      parametro,
      predDiaActual.valor,
      predDiaActual.horizonte_dias
    );
    
    const estado1 = getEstadoPM25(predDiaActual.valor);
    const estadoOMS1 = getEstadoOMS(predDiaActual.valor);
    console.log(`✅ Predicción día actual (${predDiaActual.fecha}): ${predDiaActual.valor} µg/m³ (${estado1}/${estadoOMS1}) - ID: ${prediccionId1}`);
    prediccionesGeneradas++;

    // Insertar predicción día siguiente (horizonte_dias = 1)
    const predDiaSiguiente = predictions.prediccion_dia_siguiente;
    const prediccionId2 = await insertarPrediccion(
      predDiaSiguiente.fecha,
      estacionId,
      modelo.id,
      parametro,
      predDiaSiguiente.valor,
      predDiaSiguiente.horizonte_dias
    );
    
    const estado2 = getEstadoPM25(predDiaSiguiente.valor);
    const estadoOMS2 = getEstadoOMS(predDiaSiguiente.valor);
    console.log(`✅ Predicción día siguiente (${predDiaSiguiente.fecha}): ${predDiaSiguiente.valor} µg/m³ (${estado2}/${estadoOMS2}) - ID: ${prediccionId2}`);
    prediccionesGeneradas++;

    // 4. Enviar alertas si se supera el umbral
    const prediccionesAlerta = [
      { ...predDiaActual, estado: estado1 },
      { ...predDiaSiguiente, estado: estado2 }
    ];

    for (const pred of prediccionesAlerta) {
      if (pred.valor > UMBRAL_ALERTA_PM25) {
        console.log(`🔔 ALERTA: PM2.5 (${pred.valor} µg/m³) supera el umbral de ${UMBRAL_ALERTA_PM25} µg/m³ para el ${pred.fecha}`);
        
        const usuariosSuscritos = await getUsersForDailyPredictions();
        
        if (usuariosSuscritos.length > 0) {
          console.log(`📨 Enviando alertas a ${usuariosSuscritos.length} usuarios...`);
          const asunto = `Alerta Calidad del Aire Gijón: PM2.5 ${pred.estado} el ${pred.fecha}`;
          const mensajeTexto = 
`Hola,

Te informamos que la predicción de PM2.5 para la estación Avenida Constitución el ${pred.fecha} es de ${pred.valor} µg/m³ (estado: ${pred.estado}).

Este valor supera el umbral de ${UMBRAL_ALERTA_PM25} µg/m³.

Predicción generada por modelo ${predictions.modelo_info.tipo} el ${new Date(predictions.fecha_generacion).toLocaleString('es-ES')}.

Para más detalles, visita la web.

Saludos,
Equipo Air Gijón.`
          ;

          for (const usuario of usuariosSuscritos) {
            await sendNotificationEmail(usuario.email, asunto, mensajeTexto);
            alertasEnviadas++;
          }
        }
      }
    }
    
    console.log(`🎯 Generadas ${prediccionesGeneradas} predicciones exitosamente`);
    if (alertasEnviadas > 0) {
      console.log(`📨 ${alertasEnviadas} alertas por correo enviadas.`);
    }
    
    // 5. Mostrar resumen de predicciones activas
    const resumen = await pool.query(`
      SELECT 
        p.fecha,
        p.valor,
        p.horizonte_dias,
        m.nombre_modelo
      FROM predicciones p
      JOIN modelos_prediccion m ON p.modelo_id = m.id
      WHERE p.fecha >= CURRENT_DATE
        AND p.estacion_id = $1
        AND p.parametro = $2
        AND m.activo = true
      ORDER BY p.fecha ASC, p.horizonte_dias ASC
    `, [estacionId, parametro]);
    
    console.log('\n📋 Predicciones activas:');
    resumen.rows.forEach(pred => {
      const estado = getEstadoPM25(pred.valor);
      const estadoOMS = getEstadoOMS(pred.valor);
      const horizonte = pred.horizonte_dias === 0 ? 'día actual' : 'día siguiente';
      console.log(`   ${pred.fecha} (${horizonte}): ${pred.valor} µg/m³ (${estado}/${estadoOMS}) - ${pred.nombre_modelo}`);
    });
    
    console.log('\n✅ Proceso de predicciones LightGBM completado');
    
  } catch (error) {
    console.error('❌ Error generando predicciones:', error);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  generarPrediccionesDiarias()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { 
  generarPrediccionesDiarias,
  obtenerModeloActivo,
  ejecutarPrediccionesPython
}; 