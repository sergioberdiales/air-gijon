const cron = require('cron');
const apiClient = require('./api_client');

// Programar la actualización cada hora
const updateJob = new cron.CronJob('0 * * * *', async () => {
    console.log('🕒 Iniciando actualización programada...');
    try {
        await apiClient.updateLatestData();
        console.log('✅ Actualización completada');
    } catch (error) {
        console.error('❌ Error en la actualización programada:', error);
    }
});

// Función para iniciar el programador
function startScheduler() {
    console.log('🚀 Iniciando el programador de actualizaciones...');
    updateJob.start();
    
    // Ejecutar una actualización inmediata al iniciar
    apiClient.updateLatestData()
        .then(() => console.log('✅ Actualización inicial completada'))
        .catch(error => console.error('❌ Error en la actualización inicial:', error));
}

// Exportar la función de inicio
module.exports = {
    startScheduler
};

// Ejecutar el programador si este archivo se ejecuta directamente
if (require.main === module) {
    startScheduler();
} 