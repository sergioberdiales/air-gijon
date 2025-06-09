const { pool } = require('./db');
const { getEstadoPM25, getEstadoPM10 } = require('./utils'); // Asumiendo que utils.js está en la misma raíz

// Definición de la nueva estructura de la tabla (para crearla si no existe)
const NUEVA_TABLA_PROMEDIOS_SQL = `
  CREATE TABLE IF NOT EXISTS promedios_diarios (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    parametro VARCHAR(20) NOT NULL,
    valor REAL,
    estado TEXT,
    source TEXT DEFAULT 'calculated' NOT NULL,
    detalles TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fecha, parametro, source)
  );
`;

// Columnas esperadas en la estructura antigua
const COLUMNAS_ANTIGUAS = ['pm25_promedio', 'pm10_promedio', 'confianza', 'pm25_estado', 'pm10_estado'];

async function tablaTieneEstructuraNueva(client) {
  try {
    const result = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'promedios_diarios' AND column_name = 'parametro';
    `);
    return result.rows.length > 0;
  } catch (error) {
    // Si la tabla no existe, information_schema no devolverá error, sino 0 filas.
    // Si hay otro error, lo relanzamos.
    if (error.message.includes('relation "promedios_diarios" does not exist')) {
        return false; // La tabla no existe, por lo tanto no tiene la nueva estructura.
    }
    console.error("Error al verificar estructura de 'promedios_diarios':", error);
    throw error;
  }
}

async function tablaPromediosDiariosExiste(client, tableName = 'promedios_diarios') {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = $1
    );
  `, [tableName]);
  return result.rows[0].exists;
}


async function migrarDatosPromedios(client) {
  console.log('🔄 Iniciando migración de datos de promedios_diarios...');
  let countMigradosPM25 = 0;
  let countMigradosPM10 = 0;

  const oldData = await client.query('SELECT * FROM promedios_diarios_old');

  for (const row of oldData.rows) {
    const fecha = row.fecha;
    const source = row.source || 'calculated'; // Asumir 'calculated' si no existe
    const detallesAntiguos = row.detalles ? JSON.parse(row.detalles) : {}; // Asegurar que detalles sea un objeto
    
    // Migrar PM2.5
    if (row.pm25_promedio !== null && row.pm25_promedio !== undefined) {
      const estado = getEstadoPM25(row.pm25_promedio);
      // Mantener detalles originales y añadir confianza si existe
      const detallesPM25 = { ...detallesAntiguos };
      if (row.confianza !== null && row.confianza !== undefined) {
        detallesPM25.confianza_original = row.confianza; // Guardar la confianza antigua
      }
      if (row.pm25_estado !== null && row.pm25_estado !== undefined) {
          detallesPM25.estado_original_pm25 = row.pm25_estado;
      }


      await client.query(
        `INSERT INTO promedios_diarios (fecha, parametro, valor, estado, source, detalles)
         VALUES ($1, 'pm25', $2, $3, $4, $5)
         ON CONFLICT (fecha, parametro, source) DO NOTHING`, // Evitar duplicados si se re-ejecuta
        [fecha, row.pm25_promedio, estado, source, JSON.stringify(detallesPM25)]
      );
      countMigradosPM25++;
    }

    // Migrar PM10
    if (row.pm10_promedio !== null && row.pm10_promedio !== undefined) {
      const estado = getEstadoPM10(row.pm10_promedio);
      const detallesPM10 = { ...detallesAntiguos };
       if (row.confianza !== null && row.confianza !== undefined) {
        detallesPM10.confianza_original = row.confianza;
      }
      if (row.pm10_estado !== null && row.pm10_estado !== undefined) {
        detallesPM10.estado_original_pm10 = row.pm10_estado;
      }

      await client.query(
        `INSERT INTO promedios_diarios (fecha, parametro, valor, estado, source, detalles)
         VALUES ($1, 'pm10', $2, $3, $4, $5)
         ON CONFLICT (fecha, parametro, source) DO NOTHING`,
        [fecha, row.pm10_promedio, estado, source, JSON.stringify(detallesPM10)]
      );
      countMigradosPM10++;
    }
  }
  console.log(`✅ Datos migrados: ${countMigradosPM25} registros de PM2.5, ${countMigradosPM10} registros de PM10.`);
}

async function ejecutarMigracionEstructuraPromedios() {
  console.log('🚀 Ejecutando script de migración para la estructura de promedios_diarios...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existePromediosDiarios = await tablaPromediosDiariosExiste(client);

    if (existePromediosDiarios) {
      const esNuevaEstructura = await tablaTieneEstructuraNueva(client);

      if (esNuevaEstructura) {
        console.log('✅ La tabla promedios_diarios ya tiene la nueva estructura. No se requiere migración.');
        await client.query('COMMIT');
        return;
      }

      // Si existe y no es la nueva estructura, es la antigua.
      console.log('⏳ Estructura antigua detectada. Procediendo a migrar...');
      
      // 1. Renombrar tabla antigua
      // Primero verificar si promedios_diarios_old existe para evitar error si se re-ejecuta
      const existeOldTable = await tablaPromediosDiariosExiste(client, 'promedios_diarios_old');
      if (existeOldTable) {
          console.log('🗑️ Tabla promedios_diarios_old ya existe. Se eliminará para continuar.');
          await client.query('DROP TABLE promedios_diarios_old CASCADE');
      }
      await client.query('ALTER TABLE promedios_diarios RENAME TO promedios_diarios_old');
      console.log('🏷️ Tabla antigua renombrada a promedios_diarios_old.');

      // 2. Crear nueva tabla
      await client.query(NUEVA_TABLA_PROMEDIOS_SQL);
      console.log('✨ Nueva tabla promedios_diarios creada con la estructura parametro/valor.');

      // 3. Migrar datos
      await migrarDatosPromedios(client);
      
      // 4. Opcional: Eliminar tabla antigua después de verificar
      // Por seguridad, lo dejamos comentado. Se puede hacer manualmente.
      // await client.query('DROP TABLE promedios_diarios_old CASCADE');
      // console.log('🗑️ Tabla promedios_diarios_old eliminada.');

    } else {
      // Si no existe ninguna tabla promedios_diarios, simplemente crear la nueva.
      console.log('ℹ️ La tabla promedios_diarios no existe. Se creará con la nueva estructura.');
      await client.query(NUEVA_TABLA_PROMEDIOS_SQL);
      console.log('✨ Nueva tabla promedios_diarios creada.');
    }

    await client.query('COMMIT');
    console.log('🎉 Migración de estructura de promedios_diarios completada exitosamente.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la migración de estructura de promedios_diarios:', error);
    // Es importante relanzar el error para que el proceso de inicio del servidor falle si la migración no es exitosa.
    throw error; 
  } finally {
    client.release();
  }
}

// Si el script se ejecuta directamente, llamar a la función de migración
if (require.main === module) {
  ejecutarMigracionEstructuraPromedios()
    .then(() => {
      console.log('🏁 Script de migración finalizado.');
      pool.end(); // Cerrar el pool si se ejecuta como script independiente
    })
    .catch(err => {
      console.error('💥 Fallo crítico en el script de migración:', err);
      pool.end(); // Asegurar que el pool se cierre también en caso de error
      process.exit(1);
    });
}

module.exports = { ejecutarMigracionEstructuraPromedios }; 