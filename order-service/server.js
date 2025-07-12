const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

const pool = new Pool({
  user: 'postgres',
  host: 'postgres',
  database: 'orders',
  password: '1234',
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

// 📖 Get all orders
app.get('/api/orders', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 📖 Get order by ID
app.get('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✏️ Fixed: Create order
app.post('/api/orders', async (req, res) => {
  const { items, total } = req.body;
  try {
    // Stringify JSON data before insertion
    const itemsJson = JSON.stringify(items);
    const result = await pool.query(
      'INSERT INTO orders(items, total) VALUES($1, $2) RETURNING *',
      [itemsJson, total]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✏️ Fixed: Update order by ID
app.put('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { items, total } = req.body;
  try {
    // Stringify JSON data before update
    const itemsJson = JSON.stringify(items);
    const result = await pool.query(
      'UPDATE orders SET items = $1, total = $2 WHERE id = $3 RETURNING *',
      [itemsJson, total, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 🗑️ Delete order by ID
app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    console.error('Error deleting order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Order service running on port ${PORT}`);
});