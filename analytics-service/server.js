const express = require('express');
const { ClickHouse } = require('clickhouse');
const cors = require('cors'); // Added for CORS support
const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for all routes

// ✅ ClickHouse Client Setup
const clickhouse = new ClickHouse({
  url: 'http://35.184.166.248',
  port: 8123,
  debug: false,
  basicAuth: null,
  isUseGzip: false,
  format: "json",  
  raw: false,
  config: {
    database: 'analytics', // Specify database name
    session_timeout: 60,
  }
});

// Verify ClickHouse connection on startup
async function verifyClickHouseConnection() {
  try {
    await clickhouse.query('SHOW DATABASES').toPromise();
    console.log('✅ Connected to ClickHouse successfully');
    
    // Ensure database and table exist
    await clickhouse.query('CREATE DATABASE IF NOT EXISTS analytics').toPromise();
    await clickhouse.query(`
      CREATE TABLE IF NOT EXISTS analytics.analytics_events
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
    console.log('✅ Verified analytics_events table exists');
  } catch (err) {
    console.error('❌ ClickHouse connection failed:', err);
    process.exit(1);
  }
}

verifyClickHouseConnection();

// ✅ Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// ✅ Track Analytics Event
app.post('/track', async (req, res) => {
  const {
    eventType,
    pageUrl,
    sessionId,
    element = '',
    timeOnPage = 0,
    depth = 0,
    duration = 0
  } = req.body || {};

  if (!eventType || !pageUrl || !sessionId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const insertQuery = `
    INSERT INTO analytics.analytics_events (
      event_type, page_url, session_id, element,
      time_on_page, scroll_depth, session_duration
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  try {
    await clickhouse.insert(insertQuery, [
      eventType,
      pageUrl,
      sessionId,
      element,
      timeOnPage,
      depth,
      duration
    ]).toPromise();

    res.status(200).send('OK');
  } catch (err) {
    console.error("❌ ClickHouse INSERT ERROR:", err);
    res.status(500).send('Error writing to ClickHouse');
  }
});

// ✅ Analytics Summary
app.get('/api/analytics', async (req, res) => {
  try {
    const result = await clickhouse.query(`
      SELECT 
        page_url, 
        count(*) AS views,
        avg(time_on_page) AS avg_time,
        max(scroll_depth) AS avg_scroll_depth
      FROM analytics.analytics_events
      WHERE event_type = 'page_view'
      GROUP BY page_url
      ORDER BY views DESC
      LIMIT 10
    `).toPromise();

    res.json({ topPages: result.data });
  } catch (err) {
    console.error("❌ Query Error:", err);
    res.status(500).send('Error fetching analytics');
  }
});

// ✅ Start Server
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🚀 Analytics service running on port ${PORT}`);
});