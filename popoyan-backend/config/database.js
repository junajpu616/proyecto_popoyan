const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const testConnection = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('Base de datos conectada correctamente.');
  } catch (error) {
    console.error('Error al conectarse a la base de datos:', error);
    throw error;
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  testConnection
};