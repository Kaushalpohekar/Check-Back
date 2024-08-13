const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  max: 20,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionTimeoutMillis: 10000,
});

pool.connect((err, client, done) => {
  if (err) {
    console.error('Error connecting to database:', err.stack);
    return;
  }
  console.log('Connected to database');
});

module.exports = pool;