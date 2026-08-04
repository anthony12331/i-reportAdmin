import express from "express";
import httpProxy from "http-proxy";
import geoip from "geoip-lite";

const app = express();
const proxy = httpProxy.createProxyServer({});

const PORT = 8080;                  // The entry port cloudflared targets
const VITE_TARGET = "http://127.0.0.1:5173"; // Your front-end static production file host

// Thread-safe in-memory volatile cache registers
const requestTracker = {};
const banList = {};

// CONFIGURATION THRESHOLDS
const WINDOW_MS = 10000;         // 10-second sliding matrix window
const BAN_DURATION_MS = 60000;   // 1-minute temporary containment lockout duration

// Garbage collection interval to prevent memory leaking over sustained execution
setInterval(() => {
  const now = Date.now();
  Object.keys(banList).forEach((ip) => {
    if (now > banList[ip]) delete banList[ip];
  });
  Object.keys(requestTracker).forEach((ip) => {
    if (requestTracker[ip].length === 0) delete requestTracker[ip];
  });
}, 300000); // Runs auto-cleanup every 5 minutes

// =========================================================================
// 🛡️ LAYER 1: BROWSER SECURITY HEADERS & CSP ECOSYSTEM WHITELIST
// =========================================================================
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff"); // Blocks MIME-Sniffing Exploits
  res.setHeader("X-Frame-Options", "SAMEORIGIN");     // Blocks Clickjacking Attacks
  res.setHeader("X-XSS-Protection", "1; mode=block"); // Triggers browser XSS filters
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"); // Enforces multi-year HSTS SSL

  // Hardened Content Security Policy whitelisting your local backend and open maps APIs
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' http://127.0.0.1:8090 https:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; " +
      "worker-src 'self' blob:; " +
      "style-src 'self' 'unsafe-inline' https:; " +
      "img-src 'self' data: https: blob: http://127.0.0.1:8090; " +
      "connect-src 'self' http://127.0.0.1:8090 https: ws: wss: ws://127.0.0.1:8090 wss://127.0.0.1:8090; " +
      "frame-src 'self' https: http://127.0.0.1:8090 https://maps.google.com/ https://www.google.com/maps/ https://*.openstreetmap.org/; " +
      "media-src 'self' https: blob: data: http://127.0.0.1:8090; " +
      "object-src 'none';"
  );

  // Strip standard fingerprinting vectors
  res.removeHeader("X-Powered-By");
  next();
});

app.disable("x-powered-by");

// =========================================================================
// 🚨 LAYER 2: MULTI-TENANT TRACKING & SPATIAL GEOLOCATION DETECTION
// =========================================================================
app.use((req, res, next) => {
  // 1. Core IP extraction chain bypassing cloudflare account-less masking
  let clientIp = req.headers["cf-connecting-ip"] || req.ip;
  if (req.headers["x-forwarded-for"]) {
    clientIp = req.headers["x-forwarded-for"].split(",")[0].trim();
  }

  // 2. Extract Client User-Agent Fingerprint to construct a distinct identity
  const userAgent = req.headers["user-agent"] || "Unknown-Core-Script";
  
  // 3. TARGET THE ATTACK SIGNATURE:
  // Isolate automated scraping utilities (Python/Bombardier) from real browser sessions
  const isPythonOrBot = userAgent.toLowerCase().includes("python") || userAgent.toLowerCase().includes("bombardier");
  const trackingFingerprint = isPythonOrBot ? `ATTACKER_BOT_${clientIp}` : `CLEAN_USER_${clientIp}_${userAgent.replace(/\s+/g, '')}`;

  const now = Date.now();

  // 4. Evaluate Ban Status instantly against the isolated track string
  if (banList[trackingFingerprint]) {
    if (now < banList[trackingFingerprint]) {
      res.status(429).send("Anomaly mitigated. Connection contained.");
      return;
    } else {
      delete banList[trackingFingerprint];
      requestTracker[trackingFingerprint] = [];
    }
  }

  if (!requestTracker[trackingFingerprint]) {
    requestTracker[trackingFingerprint] = [];
  }

  // 5. Filter rolling execution window records
  requestTracker[trackingFingerprint] = requestTracker[trackingFingerprint].filter(
    (timestamp) => now - timestamp < WINDOW_MS
  );

  // 6. Enforce Structural Cutoff (Set to 40 requests to catch intense scripts instantly)
  if (requestTracker[trackingFingerprint].length >= 40) {
    banList[trackingFingerprint] = now + BAN_DURATION_MS;

    // Run spatial coordinate lookup against internal binary database
    const geo = geoip.lookup(clientIp);
    const city = geo ? geo.city : "Unknown City";
    const region = geo ? geo.region : "Unknown Region";
    const country = req.headers["cf-ipcountry"] || (geo ? geo.country : "PH");
    
    // Extract precise Latitude & Longitude map array: [lat, lon]
    const coordinates = geo && geo.ll ? geo.ll : [14.4137, 124.9042]; // Default fallback coordinates if testing locally

    console.log("\n=================== 🚨 SECURITY ALERT: ANOMALY LOCATED ===================");
    console.log(`👤 IDENTIFIED THREAT     : ${trackingFingerprint}`);
    console.log(`🌍 PUBLIC INTERNET IP     : ${clientIp}`);
    console.log(`🌆 TARGET CITY/PROVINCE   : ${city}, ${region}, ${country}`);
    console.log(`🛰️  GEOGRAPHIC COORDINATES : LAT: ${coordinates[0]}, LON: ${coordinates[1]}`);
    console.log(`🗺️  LIVE GOOGLE MAP LINK   : https://www.google.com/maps?q=${coordinates[0]},${coordinates[1]}`);
    console.log(`🛡️  CONTAINMENT ACTIONS   : Banned for 1 min. System core remains ONLINE.`);
    console.log("=========================================================================\n");

    res.status(429).send("Anomaly detected. Connection terminated.");
    return;
  }

  // Log the validated timestamp and move safely to reverse proxy
  requestTracker[trackingFingerprint].push(now);
  next();
});

// =========================================================================
// 🔗 LAYER 3: REVERSE PROXY DISTRIBUTION
// =========================================================================
app.use((req, res) => {
  proxy.web(req, res, { target: VITE_TARGET }, (err) => {
    console.error("Proxy Routing Fault:", err.message);
    res.status(502).send("Static build router server or dev ecosystem is offline.");
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🛡️  Security Gateway active on http://127.0.0.1:${PORT}`);
  console.log(`🔗 Forwarding safe traffic to Target at ${VITE_TARGET}\n`);
});