const express = require('express');
const { ClickHouse } = require('clickhouse');

const app = express();
app.use(express.json());

// ✅ CORS Setup
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// ✅ In-memory backup storage
const analyticsData = {
  pageViews: {},
  clicks: [],
  sessions: {},
  scrollDepths: [],
  pageTimes: [],
  sessionDurations: []
};

// ✅ ClickHouse client setup
const clickhouse = new ClickHouse({
  url: 'http://http://35.184.166.248:8123',
  basicAuth: {
    username: 'default',
    password: ''
  },
  isUseGzip: false,
  format: 'json'
});

// ✅ Track Event Endpoint
app.post('/track', async (req, res) => {
  const { eventType, pageUrl, sessionId, timeOnPage, depth, duration, element } = req.body;

  // In-memory tracking
  switch (eventType) {
    case 'page_view':
      analyticsData.pageViews[pageUrl] = (analyticsData.pageViews[pageUrl] || 0) + 1;
      break;

    case 'click':
      analyticsData.clicks.push({ pageUrl, element, timestamp: Date.now() });
      break;

    case 'session_start':
      analyticsData.sessions[sessionId] = {
        start: Date.now(),
        duration: 0,
        pageTimes: [],
        scrollDepths: []
      };
      break;

    case 'page_time':
      if (analyticsData.sessions[sessionId]) {
        analyticsData.sessions[sessionId].pageTimes.push(timeOnPage);
      }
      break;

    case 'scroll_depth':
      if (analyticsData.sessions[sessionId]) {
        analyticsData.sessions[sessionId].scrollDepths.push(depth);
      }
      break;

    case 'session_end':
      if (analyticsData.sessions[sessionId]) {
        analyticsData.sessions[sessionId].duration = duration;
      }
      break;
  }

  // Insert into ClickHouse
  try {
    await clickhouse.insert('INSERT INTO analytics_events FORMAT JSONEachRow', [
      {
        event_type: eventType,
        page_url: pageUrl || '',
        session_id: sessionId || '',
        element: element || '',
        time_on_page: timeOnPage || 0,
        scroll_depth: depth || 0,
        session_duration: duration || 0,
        timestamp: new Date().toISOString()
      }
    ]);
  } catch (error) {
    console.error('❌ ClickHouse insert failed:', error.message);
  }

  res.status(200).send('OK');
});

// ✅ Summary API for UI or debugging
app.get('/api/analytics', (req, res) => {
  const sessions = Object.values(analyticsData.sessions);
  const totalSessions = sessions.length;

  const averageSessionDuration = totalSessions > 0
    ? sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / totalSessions
    : 0;

  const allPageTimes = sessions.flatMap(s => s.pageTimes || []);
  const averagePageTime = allPageTimes.length > 0
    ? allPageTimes.reduce((a, b) => a + b, 0) / allPageTimes.length
    : 0;

  const allScrolls = sessions.flatMap(s => s.scrollDepths || []);
  const averageScrollDepth = allScrolls.length > 0
    ? allScrolls.reduce((a, b) => a + b, 0) / allScrolls.length
    : 0;

  res.json({
    pageViews: analyticsData.pageViews,
    topPages: Object.entries(analyticsData.pageViews)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    totalSessions,
    averageSessionDuration: averageSessionDuration.toFixed(2),
    averagePageTime: averagePageTime.toFixed(2),
    averageScrollDepth: averageScrollDepth.toFixed(2)
  });
});

// ✅ Healthcheck
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// ✅ Start Server
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🚀 Analytics service running on port ${PORT}`);
});
