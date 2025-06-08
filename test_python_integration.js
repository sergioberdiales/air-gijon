#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

async function testPythonIntegration() {
  try {
    console.log('🧪 Testing Python integration...');
    
    const scriptPath = path.join(__dirname, 'modelos_prediccion', 'daily_predictions.py');
    const command = `python3 ${scriptPath} 2025-06-08`;
    
    console.log('📝 Comando:', command);
    
    const { stdout, stderr } = await execAsync(command, { 
      timeout: 60000,
      maxBuffer: 1024 * 1024
    });
    
    console.log('📊 STDOUT completo:');
    console.log('================');
    console.log(stdout);
    console.log('================');
    
    if (stderr) {
      console.log('⚠️ STDERR:');
      console.log(stderr);
    }
    
    // Método simple: buscar la última aparición de JSON
    const lastBraceIndex = stdout.lastIndexOf('}');
    if (lastBraceIndex === -1) {
      throw new Error('No se encontró } en la salida');
    }
    
    const firstBraceIndex = stdout.indexOf('{');
    if (firstBraceIndex === -1) {
      throw new Error('No se encontró { en la salida');
    }
    
    // Extraer JSON desde primera { hasta última }
    const jsonString = stdout.substring(firstBraceIndex, lastBraceIndex + 1);
    
    console.log('🔍 JSON extraído:');
    console.log('================');
    console.log(jsonString);
    console.log('================');
    
    const predictions = JSON.parse(jsonString);
    
    console.log('✅ JSON parseado exitosamente:');
    console.log(JSON.stringify(predictions, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testPythonIntegration(); 