require('dotenv').config();
const { getAirQualityData, storeAirQualityData } = require('./api_aqicn');

async function main() {
  try {
    const STATION_ID = '6699'; // Avenida Constitución
    const data = await getAirQualityData(STATION_ID);
    await storeAirQualityData(data);
    console.log('✅ Datos de AQICN actualizados correctamente');
  } catch (error) {
    console.error('❌ Error actualizando datos de AQICN:', error);
    process.exit(1);
  }
}

main(); 