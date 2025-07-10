const express = require('express');
const { ClickHouse } = require('clickhouse');
const app = express();
app.use(express.json());

const clickhouse = new ClickHouse({
  host: 'clickhouse',
  port: 8125
  
});

// Create table if not exists
async function initDB() {
  await clickhouse.query(`CREATE TABLE IF NOT EXISTS page_events (
    eventType String,
    pageUrl String,
    timestamp DateTime,
    eventData String
  ) ENGINE = MergeTree()
  ORDER BY timestamp`).toPromise();
}

initDB();

// Track events
app.post('/track', async (req, res) => {
  const { eventType, pageUrl, timestamp, eventData } = req.body;
  
  await clickhouse.query(`INSERT INTO page_events VALUES`, {
    eventType, 
    pageUrl, 
    timestamp: new Date(timestamp),
    eventData: eventData || ''
  }).toPromise();
  
  res.status(200).send();
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Analytics service running on port ${PORT}`);
});