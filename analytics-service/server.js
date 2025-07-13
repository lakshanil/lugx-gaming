require('dotenv').config(); // Load environment variables from .env

const express = require('express');
const { ClickHouse } = require('clickhouse');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// ✅ ClickHouse client WITHOUT database (used for CREATE DATABASE)
const clickhouseRoot = new ClickHouse({
  url: `http://${process.env.CLICKHOUSE_HOST}`,
  port: 8123,
  debug: true,
  basicAuth: {
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
  },
  format: 'json',
});

// ✅ ClickHouse client WITH target database (used after DB is created)
const clickhouse = new ClickHouse({
  url: `http://${process.env.CLICKHOUSE_HOST}`,
  port: 8123,
  debug: true,
  basicAuth: {
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
  },
  format: 'json',
  config: {
    database: 'analytics',
  },
});

// ✅ Initialize database and table
async function initDB() {
  try {
    // Step 1: Create database using root client
    await clickhouseRoot.query('CREATE DATABASE IF NOT EXISTS analytics').toPromise();

    // Step 2: Create table using client with database
    await clickhouse.query(`
      CREATE TABLE IF NOT EXISTS analytics_events
      (
        event_type String,
        page_url String,
        session_id String,
        element String,
        time_on_page Float32,
        scroll_depth Float32,
        session_duration Float32,
        timestamp DateTime DEFAULT now()
      )
      ENGINE = MergeTree()
      ORDER BY (timestamp, session_id)
    `).toPromise();

    console.log('✅ Database and table initialized');
  } catch (err) {
    console.error('❌ DB initialization failed:', err);
  }
}
initDB();

// ✅ Tracking endpoint
app.post('/track', async (req, res) => {
  const { eventType, pageUrl, sessionId, element, timeOnPage, depth, duration } = req.body;

  try {
    await clickhouse.insert(`
      INSERT INTO analytics_events (
        event_type, page_url, session_id, element, 
        time_on_page, scroll_depth, session_duration
      ) VALUES
    `, [[
      eventType,
      pageUrl,
      sessionId,
      element || '',
      parseFloat(timeOnPage) || 0,
      parseFloat(depth) || 0,
      parseFloat(duration) || 0
    ]]).toPromise();

    res.status(200).send('OK');
  } catch (err) {
    console.error('INSERT ERROR:', err);
    res.status(500).send('Database error');
  }
});

// ✅ Start server
app.listen(4000, () => {
  console.log('🚀 Server running on port 4000');
});
