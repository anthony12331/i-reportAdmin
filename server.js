const http = require("http");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 5001);
const POCKETBASE_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

// Change this to  exact frontend domain for production security
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

let adminCache = { token: "", expires: 0 };

// Global Security Header Definitions
const SECURITY_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",

  // Fixes from your ZAP/Nikto Scans:
  "X-Frame-Options": "DENY", // Blocks Clickjacking
  "X-Content-Type-Options": "nosniff", // Blocks MIME-type sniffing
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains", // Enforces HTTPS
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none';", // Strict API CSP
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, SECURITY_HEADERS);
  res.end(JSON.stringify(payload));
}

async function getAdminToken() {
  if (adminCache.token && adminCache.expires > Date.now() + 30_000) {
    return adminCache.token;
  }

  if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
    throw new Error(
      "Missing PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD environment variables.",
    );
  }

  const response = await fetch(
    `${POCKETBASE_URL}/api/admins/auth-with-password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: PB_ADMIN_EMAIL,
        password: PB_ADMIN_PASSWORD,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PocketBase admin auth failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  adminCache.token = data.token;
  adminCache.expires = Date.now() + (data.record?.tokenDuration || 3600) * 1000;
  return adminCache.token;
}

async function verifyUserRecord(userId) {
  const token = await getAdminToken();

  const response = await fetch(
    `${POCKETBASE_URL}/api/collections/users/records/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ verified: true }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PocketBase update failed: ${response.status} ${text}`);
  }

  return response.json();
}

const server = http.createServer(async (req, res) => {
  // Defensive check against HTTP parameter pollution / unexpected payloads
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // Handle CORS Preflight Requests safely
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "X-Frame-Options": "DENY",
    });
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { ok: true });
  }

  // Robust path verification using a Regular Expression instead of raw splitting
  const verifyRouteMatch = url.pathname.match(
    /^\/api\/users\/([a-zA-Z0-9_-]+)\/verify$/,
  );

  if (req.method === "POST" && verifyRouteMatch) {
    const userId = verifyRouteMatch[1]; // Safely grabs exactly the ID segment

    try {
      const record = await verifyUserRecord(userId);
      return sendJson(res, 200, { ok: true, record });
    } catch (error) {
      // Production best practice: Don't echo raw error messages to the client
      return sendJson(res, 500, {
        ok: false,
        error: "Internal verification routine failed.",
      });
    }
  }

  return sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Verification server listening on http://localhost:${PORT}`);
});
