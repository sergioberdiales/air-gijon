const axios = require('axios');
const { pool } = require('./db');
require('dotenv').config();

class ApiClient {
    constructor() {
        this.baseUrl = 'https://gijon.opendatasoft.com/api/records/1.0/search';
        this.dataset = 'calidad-del-aire-datos-ultima-semana-temporales';
    }

    async fetchLatestData() {
        try {
            let allRecords = [];
            let start = 0;
            const rows = 100; // Máximo permitido por la API
            let totalRecords = null;

            do {
                const url = `${this.baseUrl}/?dataset=${this.dataset}`;
                console.log(`🔍 Obteniendo registros ${start} a ${start + rows}...`);
                
                const response = await axios.get(url, {
                    params: {
                        rows: rows,
                        start: start,
                        sort: '-fecha,-periodo',
                        timezone: 'UTC'
                    }
                });

                if (totalRecords === null) {
                    totalRecords = response.data.nhits;
                    console.log(`📊 Total de registros disponibles: ${totalRecords}`);
                }

                const records = response.data.records || [];
                allRecords = allRecords.concat(records);
                
                if (records.length === 0) break;
                
                start += rows;
                
                // Pequeña pausa para no sobrecargar la API
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } while (start < totalRecords);

            console.log(`✅ Se obtuvieron ${allRecords.length} registros en total`);
            
            if (allRecords.length > 0) {
                console.log('✅ Ejemplo de registro:', JSON.stringify(allRecords[0], null, 2));
            }

            return allRecords;
        } catch (error) {
            console.error('❌ Error fetching data from API:', error.message);
            if (error.response) {
                console.error('Response data:', JSON.stringify(error.response.data, null, 2));
                console.error('Response status:', error.response.status);
                console.error('Response headers:', error.response.headers);
            }
            throw error;
        }
    }

    async insertMedicion(record) {
        if (!record || !record.fields) {
            console.error('Registro inválido (null o undefined o sin fields)');
            return null;
        }

        const fields = record.fields;
        
        // Asegurarnos de que la fecha se maneje correctamente
        let fecha = fields.fecha;
        if (fecha) {
            // Asegurarnos de que la fecha esté en formato YYYY-MM-DD
            fecha = fecha.split('T')[0];
            console.log(`Procesando fecha: ${fecha}`);
        }
        
        const query = `
            INSERT INTO mediciones_api (
                estacion_id, fecha, periodo, so2, no, no2, co, pm10, o3,
                dd, vv, tmp, hr, prb, rs, ll, ben, tol, mxil, pm25,
                record_timestamp
            ) VALUES (
                $1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                $13, $14, $15, $16, $17, $18, $19, $20, $21
            )
            ON CONFLICT (estacion_id, fecha, periodo)
            DO UPDATE SET
                so2 = EXCLUDED.so2,
                no = EXCLUDED.no,
                no2 = EXCLUDED.no2,
                co = EXCLUDED.co,
                pm10 = EXCLUDED.pm10,
                o3 = EXCLUDED.o3,
                dd = EXCLUDED.dd,
                vv = EXCLUDED.vv,
                tmp = EXCLUDED.tmp,
                hr = EXCLUDED.hr,
                prb = EXCLUDED.prb,
                rs = EXCLUDED.rs,
                ll = EXCLUDED.ll,
                ben = EXCLUDED.ben,
                tol = EXCLUDED.tol,
                mxil = EXCLUDED.mxil,
                pm25 = EXCLUDED.pm25,
                record_timestamp = EXCLUDED.record_timestamp,
                updated_at = CURRENT_TIMESTAMP,
                is_validated = false
            RETURNING id;
        `;

        const values = [
            fields.estacion === undefined ? null : fields.estacion,
            fecha,
            fields.periodo === undefined ? null : fields.periodo,
            fields.so2 === undefined ? null : fields.so2,
            fields.no === undefined ? null : fields.no,
            fields.no2 === undefined ? null : fields.no2,
            fields.co === undefined ? null : fields.co,
            fields.pm10 === undefined ? null : fields.pm10,
            fields.o3 === undefined ? null : fields.o3,
            fields.dd === undefined ? null : fields.dd,
            fields.vv === undefined ? null : fields.vv,
            fields.tmp === undefined ? null : fields.tmp,
            fields.hr === undefined ? null : fields.hr,
            fields.prb === undefined ? null : fields.prb,
            fields.rs === undefined ? null : fields.rs,
            fields.ll === undefined ? null : fields.ll,
            fields.ben === undefined ? null : fields.ben,
            fields.tol === undefined ? null : fields.tol,
            fields.mxil === undefined ? null : fields.mxil,
            fields.pm25 === undefined ? null : fields.pm25,
            record.record_timestamp || new Date()
        ];

        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Error inserting medicion:', error);
            console.error('Values:', values);
            throw error;
        }
    }

    async updateLatestData() {
        try {
            console.log('📥 Fetching latest data from API...');
            const records = await this.fetchLatestData();
            
            if (!Array.isArray(records)) {
                throw new Error('No se recibieron registros válidos de la API');
            }
            
            console.log(`✅ Retrieved ${records.length} records`);
            
            // Usar una transacción para asegurar la consistencia
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                let insertedCount = 0;
                let totalCount = records.length;
                
                for (const record of records) {
                    const result = await this.insertMedicion(record);
                    if (result) {
                        insertedCount++;
                        if (insertedCount % 100 === 0) {
                            console.log(`📊 Progreso: ${insertedCount}/${totalCount} registros procesados`);
                        }
                    }
                }
                
                await client.query('COMMIT');
                console.log(`✅ ${insertedCount} records inserted successfully`);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('❌ Error updating latest data:', error);
            throw error;
        }
    }
}

module.exports = new ApiClient(); 