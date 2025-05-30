const axios = require('axios');
const { subDays, format, startOfDay, endOfDay, utcToZonedTime, zonedTimeToUtc } = require('date-fns-tz');
const { getHours } = require('date-fns');

const WAQI_API_TOKEN = process.env.WAQI_TOKEN;
const STATION_ID = process.env.WAQI_STATION_ID || '6037'; // Default to Gijón/Constitución
const TIMEZONE = 'Europe/Madrid';

/**
 * Fetches data from the WAQI API with retries.
 * @param {number} retries Number of retries
 * @param {number} delay Delay between retries in ms
 * @returns {Promise<object>} The API response data.
 * @throws {Error} If the API request fails after all retries.
 */
async function fetchDataWithRetries(retries = 3, delay = 1000) {
    const url = `https://api.waqi.info/feed/@${STATION_ID}/?token=${WAQI_API_TOKEN}&history=1`;
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Attempt ${i + 1} to fetch data from WAQI API for station @${STATION_ID}`);
            const response = await axios.get(url, { timeout: 10000 }); // 10 second timeout
            if (response.data && response.data.status === 'ok') {
                console.log('Successfully fetched data from WAQI API.');
                return response.data.data;
            }
            console.warn(`WAQI API response status not 'ok': ${response.data ? response.data.status : 'No response data'}`);
        } catch (error) {
            console.error(`Error fetching data from WAQI (attempt ${i + 1}):`, error.message);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
            } else {
                throw new Error(`Failed to fetch data from WAQI API after ${retries} attempts for station @${STATION_ID}.`);
            }
        }
    }
    throw new Error(`Failed to fetch data from WAQI API after ${retries} attempts (unexpected exit from loop) for station @${STATION_ID}.`);
}

/**
 * Calculates the average PM2.5 value for yesterday based on hourly readings.
 * @param {Array<object>} historyData Array of hourly data objects from WAQI API.
 *                                     Each object has a 'time' (ISO string) and 'iaqi.pm25.v' (value).
 * @returns {{ averagePm25: number | null, readingsCount: number, missingReadings: number }}
 *           The average PM2.5, count of valid readings, and count of missing readings for yesterday.
 */
function calculateYesterdaysAveragePm25(historyData) {
    if (!historyData || historyData.length === 0) {
        console.warn('No history data provided for PM2.5 calculation.');
        return { averagePm25: null, readingsCount: 0, missingReadings: 24 };
    }

    const nowInMadrid = utcToZonedTime(new Date(), TIMEZONE);
    const yesterdayInMadrid = subDays(nowInMadrid, 1);
    const startOfYesterday = startOfDay(yesterdayInMadrid);
    const endOfYesterday = endOfDay(yesterdayInMadrid);

    console.log(`Calculating yesterday's average PM2.5 for date: ${format(startOfYesterday, 'yyyy-MM-dd', { timeZone: TIMEZONE })}`);

    let sumPm25 = 0;
    let readingsCount = 0;

    const yesterdayReadings = historyData.filter(record => {
        if (!record.time || !record.iaqi || !record.iaqi.pm25 || typeof record.iaqi.pm25.v !== 'number') {
            return false;
        }
        // The record.time from WAQI might be a string like "2024-05-27T09:00:00+02:00" or just a date "2024-05-27"
        // We need to ensure it's parsed correctly and compared in the target timezone.
        let recordTimeZoned;
        try {
            // Assuming record.time is an ISO string that can be directly parsed.
            // It might already include timezone info, which `utcToZonedTime` can handle if it's UTC,
            // or parse as local if no offset, then convert.
            // For safety, we treat it as if it could be UTC and convert to Madrid time.
            // If it has an offset like +02:00, utcToZonedTime will correctly interpret it.
            recordTimeZoned = utcToZonedTime(new Date(record.time), TIMEZONE);
        } catch (e) {
            console.warn(`Could not parse time for record: ${record.time}`, e);
            return false;
        }

        return recordTimeZoned >= startOfYesterday && recordTimeZoned <= endOfYesterday;
    });

    yesterdayReadings.forEach(record => {
        sumPm25 += record.iaqi.pm25.v;
        readingsCount++;
    });

    const missingReadings = 24 - readingsCount;

    if (readingsCount === 0) {
        console.warn(`No PM2.5 readings found for yesterday (${format(startOfYesterday, 'yyyy-MM-dd')}).`);
        return { averagePm25: null, readingsCount: 0, missingReadings: 24 };
    }

    const averagePm25 = sumPm25 / readingsCount;
    console.log(`Yesterday's PM2.5 average: ${averagePm25.toFixed(2)} µg/m³ from ${readingsCount} readings. Missing: ${missingReadings}`);

    if (missingReadings > 2) { // As per your spec: "alertas si ... faltan ≥2 lecturas"
        console.warn(`WARNING: ${missingReadings} PM2.5 readings missing for yesterday. Average might be inaccurate.`);
    }
     if (missingReadings >= 22) { // If 2 or fewer readings, consider it too unreliable
        console.error(`ERROR: Only ${readingsCount} PM2.5 readings available for yesterday. Average calculation aborted.`);
        return { averagePm25: null, readingsCount, missingReadings };
    }


    return { averagePm25, readingsCount, missingReadings };
}

/**
 * Main function to fetch WAQI data, process it, and prepare for storage/prediction.
 * @returns {Promise<{
 *   yesterdayPm25Average: number | null,
 *   yesterdayDate: string,
 *   hourlyData: Array<object> // Contains { time: string, pm25: number | null, pm10: number | null ... }
 * } | null>}
 *  Processed data or null if critical error.
 */
async function fetchAndProcessWaqiData() {
    if (!WAQI_API_TOKEN) {
        console.error('WAQI_API_TOKEN is not set in environment variables. Aborting.');
        return null;
    }
    console.log(`Starting WAQI data fetch and processing for station @${STATION_ID}`);

    try {
        const waqiData = await fetchDataWithRetries();

        if (!waqiData || !waqiData.history) {
            console.error('No data or no history field in WAQI API response.');
            return null;
        }
        
        // Extract and structure hourly data for storage (optional, as per your plan)
        const hourlyData = waqiData.history.map(record => {
            const recordTimeZoned = utcToZonedTime(new Date(record.time), TIMEZONE);
            return {
                // Store time in UTC for consistency in DB
                time: zonedTimeToUtc(recordTimeZoned, TIMEZONE).toISOString(), 
                pm25: record.iaqi.pm25 ? record.iaqi.pm25.v : null,
                pm10: record.iaqi.pm10 ? record.iaqi.pm10.v : null,
                // Add other pollutants if needed
            };
        }).filter(record => record.pm25 !== null || record.pm10 !== null); // Filter out records with no relevant data


        const { averagePm25, readingsCount, missingReadings } = calculateYesterdaysAveragePm25(waqiData.history);

        const nowInMadrid = utcToZonedTime(new Date(), TIMEZONE);
        const yesterdayInMadrid = subDays(nowInMadrid, 1);
        const yesterdayDate = format(startOfDay(yesterdayInMadrid), 'yyyy-MM-dd');

        if (averagePm25 === null) {
            console.error(`Critical: Could not calculate yesterday's PM2.5 average for ${yesterdayDate}. Readings: ${readingsCount}, Missing: ${missingReadings}.`);
            // Potentially trigger an alert here
        }

        console.log(`Finished WAQI data processing. Yesterday (${yesterdayDate}) PM2.5 Average: ${averagePm25 ? averagePm25.toFixed(2) : 'N/A'}`);
        
        return {
            yesterdayPm25Average: averagePm25,
            yesterdayDate: yesterdayDate, // Date string 'YYYY-MM-DD' for Madrid's yesterday
            hourlyData: hourlyData, // Full history fetched (approx 48h)
            rawWaqiResponse: waqiData // For potential further use or debugging
        };

    } catch (error) {
        console.error('Error in fetchAndProcessWaqiData:', error.message);
        // Potentially trigger an alert here
        return null;
    }
}

// Example usage (for testing, remove or comment out for production)
// (async () => {
//     // Ensure WAQI_API_TOKEN is set in your environment for this test
//     if (!process.env.WAQI_API_TOKEN) {
//         console.error("Please set WAQI_API_TOKEN environment variable for testing.");
//         return;
//     }
//     const result = await fetchAndProcessWaqiData();
//     if (result) {
//         console.log("Processed data:", JSON.stringify(result, null, 2));
//     }
// })();

module.exports = {
    fetchAndProcessWaqiData,
    calculateYesterdaysAveragePm25, // Export for testing
    STATION_ID,
    TIMEZONE
}; 