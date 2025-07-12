class WebAnalytics {
  constructor(options = {}) {
    this.options = {
      endpoint: '/track',
      autoTrack: true,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      ...options
    };

    this.sessionId = this.generateSessionId();
    this.sessionStartTime = new Date();
    this.lastPageViewTime = null;
    this.trackedScrollDepths = new Set();
    this.currentPage = window.location.href;

    if (this.options.autoTrack) {
      this.init();
    }
  }

  init() {
    this.trackSessionStart();
    this.trackPageView();
    this.setupEventListeners();
    this.setupPageHideListener();
    this.setupVisibilityChangeListener();
  }

  // Core Tracking Methods
  trackEvent(eventType, data = {}) {
    const payload = {
      eventType,
      pageUrl: window.location.href,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      referrerUrl: document.referrer,
      deviceInfo: this.getDeviceInfo(),
      eventData: data,
      metrics: {}
    };

    if (eventType === 'page_view') {
      payload.metrics.timeOnPage = this.calculateTimeOnPage();
    }

    navigator.sendBeacon(this.options.endpoint, JSON.stringify(payload));
  }

  trackPageView() {
    if (this.lastPageViewTime) {
      const timeOnPage = (new Date() - this.lastPageViewTime) / 1000;
      this.trackEvent('page_view', { timeOnPage });
    } else {
      this.trackEvent('page_view');
    }
    this.lastPageViewTime = new Date();
    this.trackScrollDepth();
  }

  trackClick(element, metadata = {}) {
    const data = {
      element: element.tagName,
      id: element.id,
      class: element.className,
      text: element.innerText?.trim().substring(0, 100),
      ...metadata
    };
    this.trackEvent('click', data);
  }

  trackScrollDepth() {
    const scrollDepthPercentages = [25, 50, 75, 90, 100];
    
    const handleScroll = () => {
      const currentDepth = this.getScrollDepth();
      
      for (const percentage of scrollDepthPercentages) {
        if (currentDepth >= percentage && !this.trackedScrollDepths.has(percentage)) {
          this.trackEvent('scroll', { scrollDepth: percentage });
          this.trackedScrollDepths.add(percentage);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  trackSessionStart() {
    this.trackEvent('session_start');
    this.sessionTimer = setTimeout(() => {
      this.trackSessionEnd();
      this.startNewSession();
    }, this.options.sessionTimeout);
  }

  trackSessionEnd() {
    const duration = (new Date() - this.sessionStartTime) / 1000;
    this.trackEvent('session_end', { sessionDuration: duration });
    clearTimeout(this.sessionTimer);
  }

  // Helper Methods
  getScrollDepth() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    );
    
    return Math.round((scrollTop / (docHeight - windowHeight)) * 100);
  }

  calculateTimeOnPage() {
    return this.lastPageViewTime ? (new Date() - this.lastPageViewTime) / 1000 : 0;
  }

  generateSessionId() {
    return 'session_' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  getDeviceInfo() {
    return {
      type: this.getDeviceType(),
      browser: this.getBrowser(),
      os: this.getOS(),
      resolution: `${window.screen.width}x${window.screen.height}`
    };
  }

  getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  getBrowser() {
    const ua = navigator.userAgent;
    let browser = 'unknown';
    
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('SamsungBrowser')) browser = 'Samsung Browser';
    else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
    else if (ua.includes('Trident')) browser = 'Internet Explorer';
    else if (ua.includes('Edge')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    
    return browser;
  }

  getOS() {
    const ua = navigator.userAgent;
    let os = 'unknown';
    
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'MacOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || /iPhone|iPad|iPod/.test(ua)) os = 'iOS';
    
    return os;
  }

  // Event Listeners
  setupEventListeners() {
    // Track clicks on interactive elements
    document.addEventListener('click', (e) => {
      const interactiveElements = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
      if (interactiveElements.includes(e.target.tagName)) {
        this.trackClick(e.target);
      }
    });

    // Track outbound links
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && link.href && !link.href.startsWith(window.location.origin)) {
        this.trackEvent('outbound_link', { url: link.href });
      }
    });

    // Track form submissions
    document.addEventListener('submit', (e) => {
      if (e.target.tagName === 'FORM') {
        this.trackEvent('form_submit', { 
          formId: e.target.id,
          formAction: e.target.action 
        });
      }
    });
  }

  setupPageHideListener() {
    window.addEventListener('pagehide', () => {
      this.trackPageView();
      this.trackSessionEnd();
    });
  }

  setupVisibilityChangeListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.trackPageView();
      }
    });
  }

  // Session Management
  startNewSession() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = new Date();
    this.trackedScrollDepths.clear();
    this.trackSessionStart();
  }
}

// Initialize automatically if script is loaded directly
if (typeof window !== 'undefined') {
  window.WebAnalytics = WebAnalytics;
  window.analytics = new WebAnalytics({
    endpoint: 'http://your-analytics-service/track'
  });
}

export default WebAnalytics;