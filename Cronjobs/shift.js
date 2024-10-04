// cronJobs.js
const cron = require('node-cron');
const pool = require('../db');

async function updateShifts() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        const updateQuery = `
            UPDATE checklist_submissions
            SET shift = CASE
                WHEN EXTRACT(HOUR FROM submission_date) >= 0.5 AND EXTRACT(HOUR FROM submission_date) < 8.5 THEN 'A'
                WHEN EXTRACT(HOUR FROM submission_date) >= 8.5 AND EXTRACT(HOUR FROM submission_date) < 16.5 THEN 'B'
                ELSE 'C'
            END
            WHERE submission_date >= NOW() - INTERVAL '24 hours'
            RETURNING *;
        `;
        
        const result = await client.query(updateQuery);
        await client.query('COMMIT');
        console.log(`Shifts updated successfully: ${result.rowCount} rows at`, new Date());

        if (result.rows.length > 0) {
            //console.log('Updated rows:', result.rows);
        }
    } catch (error) {
        console.error('Error updating shifts:', error);
        await client.query('ROLLBACK');
    } finally {
        client.release();
    }
}

function startCronJobs() {
    // Schedule the updateShifts function to run every 5 seconds
    cron.schedule('*/5 * * * * *', () => {
        updateShifts().catch(console.error);
    });
}

module.exports = { startCronJobs };
