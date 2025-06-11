const app = require('../../app.js');
const request = require('supertest');

async function testEndpoint() {
  try {
    console.log('🧪 Probando endpoint /api/air/constitucion/evolucion...\n');
    
    const response = await request(app)
      .get('/api/air/constitucion/evolucion')
      .expect(200);
    
    console.log('📊 Respuesta del endpoint:');
    console.log('Status:', response.status);
    console.log('Data keys:', Object.keys(response.body));
    
    if (response.body.data) {
      console.log('\n📈 Datos de evolución:');
      response.body.data.forEach(point => {
        console.log(`${point.date}: ${point.value} µg/m³ (${point.type})`);
      });
    }
    
    // Check if still generating placeholder data
    const dataString = JSON.stringify(response.body);
    if (dataString.includes('placeholder')) {
      console.log('\n⚠️  Todavía se están generando datos placeholder');
    } else {
      console.log('\n✅ Datos reales obtenidos (no placeholder)');
    }
    
  } catch (error) {
    console.error('❌ Error probando endpoint:', error.message);
  } finally {
    process.exit(0);
  }
}

testEndpoint(); 