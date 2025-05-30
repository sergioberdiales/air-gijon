const { pool, getPromediosDiariosAnteriores, insertarPredicciones, getPromedioDiarioPorFecha, upsertPromedioDiario, upsertWaqiDailyAverage, batchInsertHourlyWaqiReadings, getHourlyReadingsForDate } = require('./db');
const { estaciones, getEstadoPM25 } = require('./utils');
const { fetchAndProcessWaqiData, TIMEZONE: WAQI_TIMEZONE } = require('./waqiDataFetcher.js');
const { subDays, startOfDay, addDays, format } = require('date-fns');

const PESO_RECIENTE = 0.7; // Factor de ponderación para el promedio más reciente
const PESO_ANTIGUO = 0.3;  // Factor de ponderación para el promedio más antiguo
const DIAS_HISTORICOS_PARA_PROMEDIO_AYER = 7; // Número de días históricos para calcular el promedio de ayer si WAQI falla
const MAIN_TIMEZONE = 'Europe/Madrid'; // Usar una constante consistente

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
        AND parametro = 'pm25' 
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
 * Valida si hay suficientes datos del día anterior para hacer predicciones
 */
async function validarDatosAyer(fechaAyer) {
  try {
    const fechaAyerStr = fechaAyer.toISOString().split('T')[0];
    
    // Obtener todas las mediciones del día anterior
    const result = await pool.query(`
      SELECT EXTRACT(HOUR FROM fecha) as hora, valor
      FROM mediciones_api 
      WHERE estacion_id = '6699' 
        AND parametro = 'pm25' 
        AND DATE(fecha) = $1
        AND valor IS NOT NULL
      ORDER BY hora
    `, [fechaAyerStr]);
    
    const mediciones = result.rows;
    const totalEsperado = 24; // 24 horas
    const totalObtenido = mediciones.length;
    
    // Crear array de horas presentes
    const horasPresentes = mediciones.map(m => parseInt(m.hora));
    const horasFaltantes = [];
    
    for (let hora = 0; hora < 24; hora++) {
      if (!horasPresentes.includes(hora)) {
        horasFaltantes.push(hora);
      }
    }
    
    const totalFaltantes = horasFaltantes.length;
    
    // Verificar datos consecutivos faltantes
    let maxConsecutivos = 0;
    let consecutivosActuales = 0;
    
    for (let hora = 0; hora < 24; hora++) {
      if (horasFaltantes.includes(hora)) {
        consecutivosActuales++;
        maxConsecutivos = Math.max(maxConsecutivos, consecutivosActuales);
      } else {
        consecutivosActuales = 0;
      }
    }
    
    // Determinar estado
    let estado = 'completo';
    let mensaje = '';
    let puedeGenerarPredicciones = true;
    
    if (totalFaltantes === 0) {
      estado = 'completo';
      mensaje = 'Datos del día anterior completos (24/24 horas)';
    } else if (maxConsecutivos >= 3 || totalFaltantes >= 6) {
      estado = 'insuficiente';
      puedeGenerarPredicciones = false;
      mensaje = `Datos insuficientes: ${totalFaltantes} horas faltantes, máximo ${maxConsecutivos} consecutivas`;
    } else {
      estado = 'incompleto';
      mensaje = `Datos incompletos: faltan ${totalFaltantes} horas (${horasFaltantes.join(', ')})`;
    }
    
    return {
      puedeGenerarPredicciones,
      estado,
      mensaje,
      totalObtenido,
      totalEsperado,
      totalFaltantes,
      horasFaltantes,
      maxConsecutivos,
      promedio: totalObtenido > 0 ? parseFloat((mediciones.reduce((sum, m) => sum + parseFloat(m.valor), 0) / totalObtenido).toFixed(2)) : null
    };
  } catch (error) {
    console.error('❌ Error validando datos del día anterior:', error);
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
    
    // Si no, usar el promedio de la validación o obtener de la base de datos
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
      
      // Determinar confianza basada en validación
      let confianza = 0.6; // Menor confianza por usar fallback
      if (esSabadoOLunes) {
        confianza = 0.5; // Aún menor si es sábado o lunes
      }
      
      return {
        valor: Math.round(prediccion * 100) / 100,
        confianza,
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
    
    // Determinar confianza basada en validación
    let confianza = 0.8;
    if (esSabadoOLunes) {
      confianza = 0.7; // Menor confianza si es sábado o lunes
    }
    
    return {
      valor: Math.round(prediccion * 100) / 100,
      confianza,
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
 * Obtiene datos de evolución de PM2.5 (últimos 5 días históricos + predicciones para hoy y mañana).
 */
async function obtenerEvolucion() {
  try {
    // Usar un enfoque más simple para las fechas
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    const mananaStr = manana.toISOString().split('T')[0];

    // Obtener directamente los datos con una query SQL
    // Usar los nombres de columna reales: promedio_pm10 (que contiene PM2.5), tipo, confianza, etc.
    const result = await pool.query(`
      (SELECT fecha, promedio_pm10, tipo, confianza, created_at, updated_at 
       FROM promedios_diarios 
       WHERE tipo = 'historico' AND fecha < $1 
       ORDER BY fecha DESC 
       LIMIT 5) 
      UNION ALL 
      (SELECT fecha, promedio_pm10, tipo, confianza, created_at, updated_at 
       FROM promedios_diarios 
       WHERE tipo = 'prediccion' AND fecha IN ($1, $2)) 
      ORDER BY fecha ASC
    `, [hoyStr, mananaStr]);

    if (!result.rows || result.rows.length === 0) {
      return [];
    }
    
    // Mapeo final para asegurar la estructura esperada, enfocada en PM2.5
    const datosFormateados = result.rows.map(dia => ({
      fecha: dia.fecha instanceof Date ? dia.fecha.toISOString().split('T')[0] : dia.fecha,
      promedio_pm10: dia.promedio_pm10 !== null ? parseFloat(dia.promedio_pm10) : null, // Mantener el nombre original
      tipo: dia.tipo,
      estado: dia.promedio_pm10 !== null ? getEstadoPM25(parseFloat(dia.promedio_pm10)) : null,
      confianza: dia.confianza !== null ? parseFloat(dia.confianza) : null,
    }));

    return datosFormateados;

  } catch (error) {
    console.error('❌ Error obteniendo evolución PM2.5:', error);
    throw error;
  }
}

/**
 * Proceso completo de actualización diaria
 */
async function actualizacionDiaria() {
  console.warn('DEPRECATED: actualizacionDiaria() ha sido reemplazada por runDailyUpdateAndPredictions(). Ejecutando la nueva función...');
  await runDailyUpdateAndPredictions();
}

/**
 * Orquesta la actualización diaria de datos y la generación de predicciones.
 * 1. Intenta obtener datos de WAQI.
 * 2. Almacena el promedio diario de ayer y los datos horarios de WAQI.
 * 3. Calcula las predicciones basadas en los datos más fiables disponibles.
 */
async function runDailyUpdateAndPredictions() {
    console.log('Iniciando el proceso diario de actualización de datos y predicciones...');
    let yesterdayPm25AverageFromWaqi = null;
    let yesterdayDateWaqi = null;

    try {
        const waqiResult = await fetchAndProcessWaqiData();
        if (waqiResult && waqiResult.yesterdayPm25Average !== null) {
            yesterdayPm25AverageFromWaqi = waqiResult.yesterdayPm25Average;
            yesterdayDateWaqi = waqiResult.yesterdayDate; // 'YYYY-MM-DD'
            console.log(`Promedio PM2.5 de ayer (WAQI - ${yesterdayDateWaqi}): ${yesterdayPm25AverageFromWaqi.toFixed(2)} µg/m³`);
            await upsertWaqiDailyAverage(yesterdayDateWaqi, yesterdayPm25AverageFromWaqi);
            
            if (waqiResult.hourlyData && waqiResult.hourlyData.length > 0) {
                await batchInsertHourlyWaqiReadings(waqiResult.hourlyData);
            }
        } else {
            console.warn('No se pudo obtener el promedio de ayer desde WAQI. Se intentarán métodos alternativos.');
        }
    } catch (error) {
        console.error('Error durante la obtención o almacenamiento de datos de WAQI:', error);
        // Continuar para intentar calcular predicciones con datos existentes si es posible
    }

    // Ahora, con el promedio de ayer (idealmente de WAQI) o mediante fallback, calcular predicciones.
    try {
        // calcularPromedioAyer ahora debe ser más inteligente o esta lógica se integra aquí.
        const promedioAyer = await obtenerMejorPromedioAyer(yesterdayDateWaqi, yesterdayPm25AverageFromWaqi);

        if (promedioAyer && promedioAyer.valor !== null) {
            console.log(`Valor base para predicción (Ayer - ${promedioAyer.fecha}): ${promedioAyer.valor.toFixed(2)} µg/m³ (Fuente: ${promedioAyer.source})`);
            const datosHistoricos = await getPromediosDiariosAnteriores(promedioAyer.fecha, 7, 'pm25'); 
            // Pasar el promedio de ayer y los datos históricos relevantes a calcularPredicciones
            await calcularPredicciones(promedioAyer, datosHistoricos);
        } else {
            console.error('No se pudo obtener un promedio de PM2.5 para ayer. No se pueden generar predicciones.');
        }
    } catch (error) {
        console.error('Error durante el cálculo de predicciones:', error);
    }
    console.log('Proceso diario de actualización y predicciones completado.');
}

/**
 * Obtiene el mejor promedio de PM2.5 disponible para ayer.
 * Prioriza: WAQI directo -> WAQI de DB -> Cálculo desde mediciones_api.
 * @param {string | null} yesterdayDateWaqi - Fecha 'YYYY-MM-DD' de ayer según WAQI.
 * @param {number | null} yesterdayPm25FromWaqi - Promedio PM2.5 de ayer de WAQI (directo).
 * @returns {Promise<{fecha: string, valor: number | null, source: string} | null>}
 */
async function obtenerMejorPromedioAyer(yesterdayDateWaqi, yesterdayPm25FromWaqi) {
    const today = new Date();
    const yesterday = subDays(today, 1);
    const yesterdayFormatted = format(yesterday, 'yyyy-MM-dd');

    if (yesterdayPm25FromWaqi !== null && yesterdayDateWaqi === yesterdayFormatted) {
        console.log(`Usando promedio PM2.5 de ayer (directo de WAQI): ${yesterdayPm25FromWaqi}`);
        return { fecha: yesterdayFormatted, valor: yesterdayPm25FromWaqi, source: 'WAQI_direct' };
    }

    // Intentar obtener de la DB un registro de WAQI para ayer
    const promedioAyerDbWaqi = await getPromedioDiarioPorFecha(yesterdayFormatted);
    if (promedioAyerDbWaqi && promedioAyerDbWaqi.source === 'WAQI' && promedioAyerDbWaqi.pm25_promedio !== null) {
        console.log(`Usando promedio PM2.5 de ayer (WAQI desde DB): ${promedioAyerDbWaqi.pm25_promedio}`);
        return { fecha: yesterdayFormatted, valor: promedioAyerDbWaqi.pm25_promedio, source: 'WAQI_DB' };
    }

    // Fallback: Calcular promedio de ayer desde mediciones_api (lógica anterior adaptada)
    console.log('Fallback: Calculando promedio PM2.5 de ayer desde mediciones_api.');
    const promedioCalculado = await calcularPromedioPm25AyerDesdeHorarios(yesterdayFormatted);
    if (promedioCalculado !== null) {
        console.log(`Usando promedio PM2.5 de ayer (calculado de horarios DB): ${promedioCalculado}`);
        return { fecha: yesterdayFormatted, valor: promedioCalculado, source: 'calculated_hourly' };
    }

    console.warn('No se pudo obtener ningún promedio de PM2.5 para ayer.');
    return { fecha: yesterdayFormatted, valor: null, source: 'none' };
}

/**
 * Calcula el promedio de PM2.5 para una fecha dada a partir de los datos horarios en mediciones_api.
 * @param {string} fechaStr - Fecha en formato 'YYYY-MM-DD'.
 * @returns {Promise<number | null>} El promedio de PM2.5 o null si no hay datos suficientes.
 */
async function calcularPromedioPm25AyerDesdeHorarios(fechaStr) {
    console.log(`Calculando promedio PM2.5 para ${fechaStr} desde datos horarios locales.`);
    try {
        const hourlyReadings = await getHourlyReadingsForDate(fechaStr);
        
        if (!hourlyReadings || hourlyReadings.length === 0) {
            console.warn(`No se encontraron lecturas horarias de PM2.5 para ${fechaStr} en la DB local.`);
            return null;
        }

        const validPm25Readings = hourlyReadings.filter(r => r.pm25 !== null && typeof r.pm25 === 'number');

        if (validPm25Readings.length < 1) { // Podríamos poner un umbral más alto, ej. 18 lecturas (75% del día)
            console.warn(`Muy pocas lecturas horarias válidas de PM2.5 (${validPm25Readings.length}) para ${fechaStr}. No se calculará el promedio.`);
            return null;
        }
        
        const sum = validPm25Readings.reduce((acc, curr) => acc + curr.pm25, 0);
        const average = sum / validPm25Readings.length;
        
        console.log(`Promedio PM2.5 calculado para ${fechaStr} desde ${validPm25Readings.length} lecturas horarias locales: ${average.toFixed(2)} µg/m³`);
        return parseFloat(average.toFixed(2));

    } catch (error) {
        console.error(`Error calculando promedio PM2.5 desde horarios para ${fechaStr}:`, error);
        return null;
    }
}

/**
 * Calcula la predicción de PM2.5 para un día específico.
 * @param {Date} fechaPrediccion - La fecha para la cual calcular la predicción.
 * @param {number} valorAyer - El valor de PM2.5 del día anterior.
 * @param {number} valorHace7Dias - El valor de PM2.5 de hace 7 días.
 * @returns {{prediccion: number, confianza: number}} - La predicción y un valor de confianza (placeholder).
 */
function calcularPrediccionDia(fechaPrediccion, valorAyer, valorHace7Dias) {
    let prediccion;
    // Lógica de predicción simple: promedio ponderado del valor de ayer y hace 7 días.
    if (valorAyer !== null && valorHace7Dias !== null) {
        prediccion = (valorAyer * PESO_RECIENTE) + (valorHace7Dias * PESO_ANTIGUO);
    } else if (valorAyer !== null) {
        prediccion = valorAyer; // Si solo tenemos el de ayer, lo usamos con un pequeño ajuste al alza (ejemplo)
        prediccion *= 1.05; 
    } else {
        console.warn(`No hay suficientes datos para calcular la predicción del ${format(fechaPrediccion, 'yyyy-MM-dd')}. Usando fallback simple.`);
        prediccion = 15; // Un valor de fallback muy genérico, idealmente se mejoraría
    }
    // Simulación de confianza basada en la disponibilidad de datos
    let confianza = 0.5; // Confianza base
    if (valorAyer !== null) confianza += 0.2;
    if (valorHace7Dias !== null) confianza += 0.2;
    confianza = Math.min(confianza, 0.9); // Capar confianza en 0.9

    console.log(`Predicción PM2.5 para ${format(fechaPrediccion, 'yyyy-MM-dd')}: ${prediccion.toFixed(2)} µg/m³, Confianza: ${confianza.toFixed(2)}`);
    return { prediccion: parseFloat(prediccion.toFixed(2)), confianza: parseFloat(confianza.toFixed(2)) };
}

/**
 * Calcula y almacena las predicciones de PM2.5 para hoy y mañana.
 * @param {{fecha: string, valor: number}} promedioAyerInfo - Info del promedio de PM2.5 de ayer.
 * @param {Array<object>} datosHistoricos - Array de promedios diarios históricos (para obtener valor de hace 7 días).
 */
async function calcularPredicciones(promedioAyerInfo, datosHistoricos) {
    if (!promedioAyerInfo || promedioAyerInfo.valor === null) {
        console.error('Promedio de ayer no disponible, no se pueden generar predicciones.');
        return;
    }

    const valorAyer = promedioAyerInfo.valor;
    // const fechaAyer = new Date(promedioAyerInfo.fecha + 'T00:00:00Z');
    // Convertir la fecha de ayer (que es YYYY-MM-DD para MAIN_TIMEZONE) a un objeto Date correcto.
    // startOfDay asegura que estamos al inicio del día en la zona horaria correcta antes de sumar días.
    const fechaAyer = startOfDay(new Date(promedioAyerInfo.fecha));

    const hoy = addDays(fechaAyer, 1);
    const manana = addDays(fechaAyer, 2);

    // Encontrar el valor de hace 7 días respecto a 'ayer' para la predicción de 'hoy'
    const hace7DiasParaHoyTargetDate = format(subDays(fechaAyer, 6), 'yyyy-MM-dd'); 
    // Encontrar el valor de hace 7 días respecto a 'hoy' para la predicción de 'mañana'
    const hace7DiasParaMananaTargetDate = format(subDays(hoy, 6), 'yyyy-MM-dd');

    const valorHace7DiasParaHoy = datosHistoricos.find(d => d.fecha === hace7DiasParaHoyTargetDate)?.pm25_promedio || null;
    const valorHace7DiasParaManana = datosHistoricos.find(d => d.fecha === hace7DiasParaMananaTargetDate)?.pm25_promedio || null;
    
    if(valorHace7DiasParaHoy === null){
        console.warn(`No se encontró el valor de PM2.5 para ${hace7DiasParaHoyTargetDate} (necesario para la predicción de hoy).`);
    }
    if(valorHace7DiasParaManana === null){
        console.warn(`No se encontró el valor de PM2.5 para ${hace7DiasParaMananaTargetDate} (necesario para la predicción de mañana).`);
    }

    const prediccionHoy = calcularPrediccionDia(hoy, valorAyer, valorHace7DiasParaHoy);
    const prediccionManana = calcularPrediccionDia(manana, prediccionHoy.prediccion, valorHace7DiasParaManana); // Usar la predicción de hoy como base para mañana

    const prediccionesParaGuardar = [
        {
            fecha: format(hoy, 'yyyy-MM-dd'),
            pm25Promedio: prediccionHoy.prediccion,
            tipo: 'prediccion',
            confianza: prediccionHoy.confianza,
            source: 'model_v2' // Identificar la fuente del modelo
        },
        {
            fecha: format(manana, 'yyyy-MM-dd'),
            pm25Promedio: prediccionManana.prediccion,
            tipo: 'prediccion',
            confianza: prediccionManana.confianza,
            source: 'model_v2'
        }
    ];

    console.log('Predicciones PM2.5 generadas:', prediccionesParaGuardar);
    await insertarPredicciones(prediccionesParaGuardar, 'pm25'); // Modificar insertarPredicciones para que acepte el tipo de contaminante
}

module.exports = {
  calcularPromediosHistoricos,
  calcularPredicciones,
  obtenerEvolucion,
  actualizacionDiaria,
  runDailyUpdateAndPredictions,
  obtenerMejorPromedioAyer,
  calcularPrediccionDia,
  calcularPredicciones
}; 