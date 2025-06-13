#!/usr/bin/env node

/**
 * SCRIPT URGENTE: Cargar datos históricos PM2.5 en PRODUCCIÓN
 * 
 * PROBLEMA: La tabla promedios_diarios de producción está vacía
 * SOLUCIÓN: Cargar datos históricos de mayo-junio 2025
 * 
 * INSTRUCCIONES:
 * Este script se ejecutará automáticamente en el próximo deploy de Render.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// --- INICIO DEL PARCHE ---
// Esta función corrige el archivo server.js en el servidor de Render
function patchServerFile() {
  const serverPath = path.join(__dirname, 'src', 'server.js');
  try {
    console.log(`PATCH: Leyendo ${serverPath}...`);
    let content = fs.readFileSync(serverPath, 'utf8');

    const corrections = {
      "./database/db": "./database/db.js",
      "./auth/auth": "./auth/auth.js",
      "./routes": "./routes/index.js"
    };

    let modified = false;
    for (const [original, replacement] of Object.entries(corrections)) {
      if (content.includes(`require('${original}')`)) {
        content = content.replace(`require('${original}')`, `require('${replacement}')`);
        console.log(`PATCH: Reemplazando '${original}' por '${replacement}'`);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(serverPath, content, 'utf8');
      console.log(`PATCH: Archivo ${serverPath} corregido y guardado.`);
    } else {
      console.log(`PATCH: No se necesitaron correcciones en ${serverPath}.`);
    }
  } catch (error) {
    console.error(`PATCH: Fallo al intentar parchear ${serverPath}:`, error);
    // No lanzamos error para no detener el proceso principal
  }
}
// --- FIN DEL PARCHE ---

// Configuración BD producción
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function getEstadoPM25(valor) {
  if (valor <= 12) return 'Buena';
  if (valor <= 35) return 'Regular';
  if (valor <= 55) return 'Insalubre para grupos sensibles';
  if (valor <= 150) return 'Insalubre';
  if (valor <= 250) return 'Muy Insalubre';
  return 'Peligrosa';
}

// Datos históricos PM2.5 (mayo-junio 2025)
const datosHistoricos = [
  { fecha: '2025-05-01', pm25: 21 }, { fecha: '2025-05-02', pm25: 35 },
  { fecha: '2025-05-03', pm25: 25 }, { fecha: '2025-05-04', pm25: 26 },
  { fecha: '2025-05-05', pm25: 26 }, { fecha: '2025-05-06', pm25: 30 },
  { fecha: '2025-05-07', pm25: 27 }, { fecha: '2025-05-08', pm25: 43 },
  { fecha: '2025-05-09', pm25: 29 }, { fecha: '2025-05-10', pm25: 30 },
  { fecha: '2025-05-11', pm25: 26 }, { fecha: '2025-05-12', pm25: 27 },
  { fecha: '2025-05-13', pm25: 22 }, { fecha: '2025-05-14', pm25: 27 },
  { fecha: '2025-05-15', pm25: 26 }, { fecha: '2025-05-16', pm25: 44 },
  { fecha: '2025-05-17', pm25: 37 }, { fecha: '2025-05-18', pm25: 48 },
  { fecha: '2025-05-19', pm25: 33 }, { fecha: '2025-05-20', pm25: 37 },
  { fecha: '2025-05-21', pm25: 45 }, { fecha: '2025-05-22', pm25: 26 },
  { fecha: '2025-05-23', pm25: 28 }, { fecha: '2025-05-24', pm25: 29 },
  { fecha: '2025-05-25', pm25: 34 }, { fecha: '2025-05-26', pm25: 22 },
  { fecha: '2025-05-27', pm25: 23 }, { fecha: '2025-05-28', pm25: 37 },
  { fecha: '2025-05-29', pm25: 40 }, { fecha: '2025-05-30', pm25: 44 },
  { fecha: '2025-05-31', pm25: 21 }, { fecha: '2025-06-01', pm25: 26 },
  { fecha: '2025-06-02', pm25: 24 }, { fecha: '2025-06-03', pm25: 24 },
  { fecha: '2025-06-04', pm25: 32 }, { fecha: '2025-06-05', pm25: 29 },
  { fecha: '2025-06-06', pm25: 27 }, { fecha: '2025-06-07', pm25: 26 },
  { fecha: '2025-06-08', pm25: 37 }, { fecha: '2025-06-09', pm25: 47 },
  { fecha: '2025-06-10', pm25: 48 }
];

async function cargarDatos() {
  const client = await pool.connect();
  try {
    console.log('🚀 CARGANDO DATOS HISTÓRICOS EN PRODUCCIÓN');
    console.log('===============================================');
    
    await client.query('BEGIN');

    let insertados = 0;
    let actualizados = 0;
    
    console.log('\n🔄 Procesando datos...');
    
    for (const dato of datosHistoricos) {
      const estado = getEstadoPM25(dato.pm25);
      
      const res = await client.query(`
        INSERT INTO promedios_diarios (fecha, parametro, valor, estado, source, detalles)
        VALUES ($1, 'pm25', $2, $3, 'csv_historical', 'Datos históricos Estación Constitución')
        ON CONFLICT (fecha, parametro) DO UPDATE 
        SET valor = EXCLUDED.valor, 
            estado = EXCLUDED.estado, 
            source = EXCLUDED.source, 
            updated_at = CURRENT_TIMESTAMP
        RETURNING xmax;
      `, [dato.fecha, dato.pm25, estado]);
      
      if (res.rows[0].xmax === '0') {
        insertados++;
        console.log(`✅ ${dato.fecha}: ${dato.pm25} µg/m³ - INSERTADO`);
      } else {
        actualizados++;
        console.log(`🔄 ${dato.fecha}: ${dato.pm25} µg/m³ - ACTUALIZADO`);
      }
    }
    
    await client.query('COMMIT');

    console.log('\n📊 RESUMEN:');
    console.log(`✅ Insertados: ${insertados}`);
    console.log(`🔄 Actualizados: ${actualizados}`);
    
    console.log('\n🎉 ¡DATOS CARGADOS EXITOSAMENTE!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ ERROR DURANTE LA CARGA. ROLLBACK REALIZADO:', error.message);
    console.error('Stack:', error.stack);
    // No salimos con process.exit(1) para permitir que el servidor arranque después
    throw error;
  } finally {
    client.release();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  // Primero aplicamos el parche, luego cargamos datos
  patchServerFile();
  
  cargarDatos().catch((e) => {
    console.error("Error en la ejecución de carga de datos:", e);
    process.exit(1);
  });
}

module.exports = { cargarDatos }; 