const express = require('express');
const { ClickHouse } = require('clickhouse');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// ClickHouse Connection (FIXED: Removed duplicate http://)
const clickhouse = new ClickHouse({
  host: '35.184.166.248',
  port: 8123,
  debug: true,
  database: 'analytics' // Explicitly specify database
});

// Initialize database and table
async function initDB() {
  try {
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
    console.log('✅ Database initialized');
  } catch (err) {
    console.error('❌ DB initialization failed:', err);
  }
}
initDB();

// Tracking endpoint (FIXED: Simplified query)
app.post('/track', async (req, res) => {
  const { eventType, pageUrl, sessionId, element, timeOnPage, depth, duration } = req.body;

  try {
    await clickhouse.insert(`
      INSERT INTO analytics.analytics_events (
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

app.listen(4000, () => console.log('🚀 Server running on port 4000'));