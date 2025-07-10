const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

const pool = new Pool({
  user: 'postgres',
  host: 'postgres',
  database: 'orders',
  password: 'password',
  port: 5432,
});

// Create orders table
async function initDB() {
  await pool.query(`CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    items JSONB,
    total DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW()
  )`);
}

initDB();

// Create order
app.post('/api/orders', async (req, res) => {
  const { items, total } = req.body;
  const result = await pool.query(
    'INSERT INTO orders(items, total) VALUES($1, $2) RETURNING *',
    [items, total]
  );
  res.json(result.rows[0]);
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Order service running on port ${PORT}`);
});