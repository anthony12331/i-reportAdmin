const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const { sendVerificationEmail, sendRejectionEmail } = require("./utils/mailer");

const app = express();

const PORT = Number(process.env.PORT || 5001);
const POCKETBASE_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

let adminCache = { token: "", expires: 0 };

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// Security Headers
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none';");
  next();
});

async function getAdminToken() {
  if (adminCache.token && adminCache.expires > Date.now() + 30_000) {
    return adminCache.token;
  }

  if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
    throw new Error("Missing PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD env variables.");
  }

  const response = await fetch(`${POCKETBASE_URL}/api/admins/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity: PB_ADMIN_EMAIL,
      password: PB_ADMIN_PASSWORD,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PocketBase admin auth failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  adminCache.token = data.token;
  adminCache.expires = Date.now() + (data.record?.tokenDuration || 3600) * 1000;
  return adminCache.token;
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/admin-login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "Email and password are required." });
  }

  const cleanEmail = email.trim();

  try {
    const superRes = await fetch(`${POCKETBASE_URL}/api/collections/super_admins/auth-with-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: cleanEmail, password }),
    });

    if (superRes.ok) {
      const data = await superRes.json();
      return res.json({ ok: true, token: data.token, record: data.record, role: "super_admin" });
    }
  } catch (e) {}

  try {
    const adminRes = await fetch(`${POCKETBASE_URL}/api/collections/admins/auth-with-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: cleanEmail, password }),
    });

    if (adminRes.ok) {
      const data = await adminRes.json();
      return res.json({ ok: true, token: data.token, record: data.record, role: "admin" });
    }
  } catch (e) {}

  return res.status(401).json({ ok: false, error: "Invalid email or password." });
});

app.post("/api/users/:id/verify", async (req, res) => {
  const userId = req.params.id;
  const { email, name } = req.body;

  try {
    const token = await getAdminToken();

    const pbResponse = await fetch(
      `${POCKETBASE_URL}/api/collections/users/records/${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ verified: true }),
      }
    );

    if (!pbResponse.ok) {
      const text = await pbResponse.text();
      throw new Error(`PocketBase update failed: ${pbResponse.status} ${text}`);
    }

    const record = await pbResponse.json();

    if (email) {
      sendVerificationEmail(email, name).catch((err) =>
        console.error("[EMAIL] Failed to send verification email:", err.message)
      );
    }

    return res.json({ ok: true, record });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Internal verification routine failed." });
  }
});

app.post("/api/send-rejection", async (req, res) => {
  const { email, reason } = req.body;

  if (!email || !reason) {
    return res.status(400).json({ ok: false, error: "Email and reason are required." });
  }

  try {
    await sendRejectionEmail(email, reason);
    return res.json({ ok: true, message: "Rejection email sent successfully." });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Failed to send email: " + err.message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`[SERVER] Gateway and Mailer running on http://localhost:${PORT}`);
});

function gracefulShutdown(signal) {
  console.log(`\n[SERVER] Received ${signal}. Closing HTTP server...`);
  server.close(() => {
    console.log("[SERVER] Server closed cleanly.");
    process.exit(0);
  });
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
