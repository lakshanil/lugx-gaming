const express = require('express');
const { ClickHouse } = require('clickhouse');
const { v4: uuidv4 } = require('uuid');
const userAgent = require('user-agent-parser');
const app = express();
app.use(express.json());

const clickhouse = new ClickHouse({
  host: process.env.CLICKHOUSE_HOST || 'clickhouse',
  port: process.env.CLICKHOUSE_PORT || 8123,
  user: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  format: 'json'
});

async function initDB() {
  try {
    await clickhouse.query(`
      CREATE TABLE IF NOT EXISTS web_analytics (
        event_id UUID,
        session_id String,
        user_id Nullable(String),
        event_type Enum8(
          'page_view' = 1,
          'click' = 2,
          'scroll' = 3,
          'session_start' = 4,
          'session_end' = 5
        ),
        page_url String,
        referrer_url Nullable(String),
        timestamp DateTime64(3),
        event_data String,
        device_type Nullable(String),
        browser Nullable(String),
        os Nullable(String),
        screen_resolution Nullable(String),
        ip_address Nullable(String),
        country Nullable(String),
        city Nullable(String),
        time_on_page Nullable(Float32),
        scroll_depth Nullable(Float32)
      ) ENGINE = MergeTree()
      ORDER BY (toDate(timestamp), event_type, page_url)
      TTL toDate(timestamp) + INTERVAL 6 MONTH
    `).toPromise();

    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
}

initDB();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Track events endpoint
app.post('/track', async (req, res) => {
  try {
    const { 
      eventType, 
      pageUrl, 
      timestamp = new Date().toISOString(),
      eventData = {}, 
      sessionId, 
      userId, 
      referrerUrl,
      deviceInfo = {},
      locationInfo = {},
      metrics = {}
    } = req.body;

    const userAgentInfo = userAgent(req.headers['user-agent']);

    await clickhouse.query(`
      INSERT INTO web_analytics (
        event_id, session_id, user_id, event_type, page_url,
        referrer_url, timestamp, event_data, device_type,
        browser, os, screen_resolution, ip_address,
        country, city, time_on_page, scroll_depth
      ) VALUES
    `, {
      event_id: uuidv4(),
      session_id: sessionId,
      user_id: userId || null,
      event_type: eventType,
      page_url: pageUrl,
      referrer_url: referrerUrl || null,
      timestamp: new Date(timestamp),
      event_data: JSON.stringify(eventData),
      device_type: deviceInfo.type || userAgentInfo.device.type || null,
      browser: deviceInfo.browser || userAgentInfo.browser.name || null,
      os: deviceInfo.os || userAgentInfo.os.name || null,
      screen_resolution: deviceInfo.resolution || null,
      ip_address: locationInfo.ip || req.ip || null,
      country: locationInfo.country || null,
      city: locationInfo.city || null,
      time_on_page: metrics.timeOnPage || null,
      scroll_depth: metrics.scrollDepth || null
    }).toPromise();

    res.status(200).send();
  } catch (error) {
    console.error('Tracking error:', error);
    res.status(500).json({ error: 'Tracking failed' });
  }
});

// Query endpoint for basic analytics
app.get('/analytics', async (req, res) => {
  try {
    const { query } = req.query;
    
    let result;
    switch (query) {
      case 'pageviews':
        result = await clickhouse.query(`
          SELECT page_url, COUNT(*) as views
          FROM web_analytics
          WHERE event_type = 'page_view'
          GROUP BY page_url
          ORDER BY views DESC
        `).toPromise();
        break;
      case 'sessions':
        result = await clickhouse.query(`
          SELECT count(DISTINCT session_id) as sessions
          FROM web_analytics
          WHERE toDate(timestamp) = today()
        `).toPromise();
        break;
      default:
        return res.status(400).json({ error: 'Invalid query parameter' });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Analytics query error:', error);
    res.status(500).json({ error: 'Query failed' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Analytics service running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  process.exit(0);
});