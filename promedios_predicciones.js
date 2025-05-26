const { pool } = require('./db');

/**
 * Calcula promedios diarios históricos desde mediciones_api
 */
async function calcularPromediosHistoricos() {
  try {
    console.log('📊 Calculando promedios diarios históricos...');
    
    const result = await pool.query(`
      INSERT INTO promedios_diarios (fecha, promedio_pm10, tipo, datos_utilizados, detalles)
      SELECT 
        DATE(fecha) as fecha,
        ROUND(AVG(valor), 2) as promedio_pm10,
        'historico' as tipo,
        COUNT(*) as datos_utilizados,
        jsonb_build_object(
          'min_valor', MIN(valor),
          'max_valor', MAX(valor),
          'desviacion', ROUND(STDDEV(valor), 2)
        ) as detalles
      FROM mediciones_api 
      WHERE estacion_id = '6699' 
        AND parametro = 'pm10' 
        AND valor IS NOT NULL
      GROUP BY DATE(fecha)
      ON CONFLICT (fecha) 
      DO UPDATE SET 
        promedio_pm10 = EXCLUDED.promedio_pm10,
        datos_utilizados = EXCLUDED.datos_utilizados,
        detalles = EXCLUDED.detalles,
        updated_at = CURRENT_TIMESTAMP
      WHERE promedios_diarios.tipo = 'historico'
    `);
    
    console.log(`✅ Promedios históricos actualizados: ${result.rowCount} días`);
    return result.rowCount;
  } catch (error) {
    console.error('❌ Error calculando promedios históricos:', error);
    throw error;
  }
}

/**
 * Calcula predicciones usando el algoritmo ponderado semanal
 */
async function calcularPredicciones() {
  try {
    console.log('🔮 Calculando predicciones...');
    
    const hoy = new Date();
    const mañana = new Date(hoy);
    mañana.setDate(mañana.getDate() + 1);
    
    // Calcular predicción para hoy
    const prediccionHoy = await calcularPrediccionDia(hoy);
    if (prediccionHoy) {
      await guardarPrediccion(hoy, prediccionHoy);
    }
    
    // Calcular predicción para mañana
    const prediccionMañana = await calcularPrediccionDia(mañana, prediccionHoy?.valor);
    if (prediccionMañana) {
      await guardarPrediccion(mañana, prediccionMañana);
    }
    
    console.log('✅ Predicciones calculadas correctamente');
    return { hoy: prediccionHoy, mañana: prediccionMañana };
  } catch (error) {
    console.error('❌ Error calculando predicciones:', error);
    throw error;
  }
}

/**
 * Calcula predicción para un día específico
 */
async function calcularPrediccionDia(fecha, valorDiaAnterior = null) {
  try {
    const fechaStr = fecha.toISOString().split('T')[0];
    const diaSemana = fecha.getDay(); // 0=domingo, 1=lunes, 6=sábado
    
    // Determinar pesos según día de la semana
    const esSabadoOLunes = diaSemana === 6 || diaSemana === 1;
    const pesoAyer = esSabadoOLunes ? 0.25 : 0.75;
    const pesoSemanaAnterior = esSabadoOLunes ? 0.75 : 0.25;
    
    // Obtener datos necesarios
    const ayer = new Date(fecha);
    ayer.setDate(ayer.getDate() - 1);
    const ayerStr = ayer.toISOString().split('T')[0];
    
    const hace7Dias = new Date(fecha);
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    const hace7DiasStr = hace7Dias.toISOString().split('T')[0];
    
    // Si tenemos valor del día anterior (para predicción de mañana), usarlo
    let promedioAyer = valorDiaAnterior;
    
    // Si no, obtener de la base de datos
    if (!promedioAyer) {
      const resultAyer = await pool.query(
        'SELECT promedio_pm10 FROM promedios_diarios WHERE fecha = $1',
        [ayerStr]
      );
      
      if (resultAyer.rows.length === 0) {
        console.log(`⚠️ No hay datos para ${ayerStr}, no se puede calcular predicción`);
        return null;
      }
      promedioAyer = parseFloat(resultAyer.rows[0].promedio_pm10);
    }
    
    // Obtener promedio de hace 7 días
    const resultHace7 = await pool.query(
      'SELECT promedio_pm10 FROM promedios_diarios WHERE fecha = $1 AND tipo = $2',
      [hace7DiasStr, 'historico']
    );
    
    if (resultHace7.rows.length === 0) {
      console.log(`⚠️ No hay datos históricos para ${hace7DiasStr}, usando fallback`);
      // Fallback: usar promedio de los últimos 7 días disponibles
      const fallbackResult = await pool.query(`
        SELECT AVG(promedio_pm10) as promedio_fallback 
        FROM (
          SELECT promedio_pm10
          FROM promedios_diarios 
          WHERE tipo = 'historico' 
            AND fecha < $1 
          ORDER BY fecha DESC 
          LIMIT 7
        ) AS ultimos_dias
      `, [fechaStr]);
      
      if (fallbackResult.rows.length === 0 || !fallbackResult.rows[0].promedio_fallback) {
        console.log('⚠️ No hay suficientes datos históricos para fallback');
        return null;
      }
      
      const promedioHace7 = parseFloat(fallbackResult.rows[0].promedio_fallback);
      const prediccion = (promedioAyer * pesoAyer) + (promedioHace7 * pesoSemanaAnterior);
      
      return {
        valor: Math.round(prediccion * 100) / 100,
        confianza: 0.6, // Menor confianza por usar fallback
        algoritmo: 'ponderado_semanal_fallback',
        detalles: {
          promedio_ayer: promedioAyer,
          promedio_hace_7_dias: promedioHace7,
          peso_ayer: pesoAyer,
          peso_semana_anterior: pesoSemanaAnterior,
          dia_semana: diaSemana,
          es_sabado_o_lunes: esSabadoOLunes,
          fallback_usado: true
        }
      };
    }
    
    const promedioHace7 = parseFloat(resultHace7.rows[0].promedio_pm10);
    const prediccion = (promedioAyer * pesoAyer) + (promedioHace7 * pesoSemanaAnterior);
    
    return {
      valor: Math.round(prediccion * 100) / 100,
      confianza: 0.8,
      algoritmo: 'ponderado_semanal',
      detalles: {
        promedio_ayer: promedioAyer,
        promedio_hace_7_dias: promedioHace7,
        peso_ayer: pesoAyer,
        peso_semana_anterior: pesoSemanaAnterior,
        dia_semana: diaSemana,
        es_sabado_o_lunes: esSabadoOLunes,
        fallback_usado: false
      }
    };
  } catch (error) {
    console.error('❌ Error calculando predicción para', fecha, ':', error);
    throw error;
  }
}

/**
 * Guarda una predicción en la base de datos
 */
async function guardarPrediccion(fecha, prediccion) {
  try {
    const fechaStr = fecha.toISOString().split('T')[0];
    
    await pool.query(`
      INSERT INTO promedios_diarios (fecha, promedio_pm10, tipo, algoritmo, confianza, detalles)
      VALUES ($1, $2, 'prediccion', $3, $4, $5)
      ON CONFLICT (fecha) 
      DO UPDATE SET 
        promedio_pm10 = EXCLUDED.promedio_pm10,
        algoritmo = EXCLUDED.algoritmo,
        confianza = EXCLUDED.confianza,
        detalles = EXCLUDED.detalles,
        updated_at = CURRENT_TIMESTAMP
      WHERE promedios_diarios.tipo = 'prediccion'
    `, [fechaStr, prediccion.valor, prediccion.algoritmo, prediccion.confianza, JSON.stringify(prediccion.detalles)]);
    
    console.log(`✅ Predicción guardada para ${fechaStr}: ${prediccion.valor} µg/m³`);
  } catch (error) {
    console.error('❌ Error guardando predicción:', error);
    throw error;
  }
}

/**
 * Obtiene datos de evolución (últimos 5 días + 2 predicciones)
 */
async function obtenerEvolucion() {
  try {
    // Obtener últimos 5 días históricos
    const historicos = await pool.query(`
      SELECT fecha, promedio_pm10, tipo, confianza, datos_utilizados
      FROM promedios_diarios 
      WHERE tipo = 'historico'
      ORDER BY fecha DESC 
      LIMIT 5
    `);
    
    // Obtener predicciones (hoy y mañana)
    const hoy = new Date().toISOString().split('T')[0];
    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);
    const mañanaStr = mañana.toISOString().split('T')[0];
    
    const predicciones = await pool.query(`
      SELECT fecha, promedio_pm10, tipo, confianza, algoritmo
      FROM promedios_diarios 
      WHERE tipo = 'prediccion' 
        AND fecha IN ($1, $2)
      ORDER BY fecha ASC
    `, [hoy, mañanaStr]);
    
    // Combinar y ordenar por fecha
    const todos = [...historicos.rows, ...predicciones.rows]
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    
    return todos;
  } catch (error) {
    console.error('❌ Error obteniendo evolución:', error);
    throw error;
  }
}

/**
 * Proceso completo de actualización diaria
 */
async function actualizacionDiaria() {
  try {
    console.log('🌅 Iniciando actualización diaria de promedios y predicciones...');
    
    // 1. Calcular promedios históricos
    await calcularPromediosHistoricos();
    
    // 2. Calcular predicciones
    await calcularPredicciones();
    
    console.log('✅ Actualización diaria completada');
  } catch (error) {
    console.error('❌ Error en actualización diaria:', error);
    throw error;
  }
}

module.exports = {
  calcularPromediosHistoricos,
  calcularPredicciones,
  obtenerEvolucion,
  actualizacionDiaria
}; 