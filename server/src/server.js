const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") }); require("dotenv").config({ path: path.join(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const { sendVerificationEmail, sendRejectionEmail, sendOtpEmail } = require("./utils/mailer");

const app = express();

const PORT = Number(process.env.PORT || 5001);
const POCKETBASE_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

let adminCache = { token: "", expires: 0 };
const otpCache = new Map(); // Store OTPs as { email: { otp, expiresAt, collectionId, recordId } }

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

  const response = await fetch(`${POCKETBASE_URL}/api/collections/_superusers/auth-with-password`, {
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
    // Optimization: Find which collection the user belongs to first (takes ~10ms)
    // instead of trying to hash the password 3 separate times (takes ~3000ms)
    const token = await getAdminToken();
    let targetCollection = null;
    let targetRole = null;

    // Check super_admins
    let searchRes = await fetch(`${POCKETBASE_URL}/api/collections/super_admins/records?filter=email='${cleanEmail}'`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    let searchData = await searchRes.json();
    if (searchData.items && searchData.items.length > 0) {
      targetCollection = "super_admins";
      targetRole = "super_admin";
    }

    // Check admins
    if (!targetCollection) {
      searchRes = await fetch(`${POCKETBASE_URL}/api/collections/admins/records?filter=email='${cleanEmail}'`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      searchData = await searchRes.json();
      if (searchData.items && searchData.items.length > 0) {
        targetCollection = "admins";
        targetRole = "admin";
      }
    }

    // Check _superusers (Master DB Admins)
    if (!targetCollection) {
      searchRes = await fetch(`${POCKETBASE_URL}/api/collections/_superusers/records?filter=email='${cleanEmail}'`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      searchData = await searchRes.json();
      if (searchData.items && searchData.items.length > 0) {
        targetCollection = "_superusers";
        targetRole = "super_admin"; // Master DB admins get super_admin UI rights
      }
    }

    // If email doesn't exist in any collection, fail instantly
    if (!targetCollection) {
      return res.status(401).json({ ok: false, error: "Invalid email or password." });
    }

    // Perform the heavy password hash ONLY ONCE on the correct collection
    const authRes = await fetch(`${POCKETBASE_URL}/api/collections/${targetCollection}/auth-with-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: cleanEmail, password }),
    });

    if (authRes.ok) {
      const data = await authRes.json();
      if (data.record?.suspended === true) {
        return res.status(403).json({ ok: false, error: "Account Suspended." });
      }
      return res.json({ ok: true, token: data.token, record: data.record, role: targetRole });
    } else {
      return res.status(401).json({ ok: false, error: "Invalid email or password." });
    }

  } catch (e) {
    console.error("[SERVER] Optimized Auth error:", e.message);
    if (e.cause?.code === 'ECONNREFUSED' || e.message.includes('fetch failed')) {
      return res.status(502).json({ ok: false, error: "Database connection failed. Please check PocketBase." });
    }
    return res.status(500).json({ ok: false, error: "Internal server error." });
  }
});

app.post("/api/forgot-password-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, error: "Email is required." });
  const cleanEmail = email.trim();

  try {
    const token = await getAdminToken();
    let targetRecord = null;
    let collectionName = "";

    // Search in super_admins
    let searchRes = await fetch(`${POCKETBASE_URL}/api/collections/super_admins/records?filter=email='${cleanEmail}'`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    let searchData = await searchRes.json();
    if (searchData.items && searchData.items.length > 0) {
      targetRecord = searchData.items[0];
      collectionName = "super_admins";
    }

    // If not found, search in admins
    if (!targetRecord) {
      searchRes = await fetch(`${POCKETBASE_URL}/api/collections/admins/records?filter=email='${cleanEmail}'`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      searchData = await searchRes.json();
      if (searchData.items && searchData.items.length > 0) {
        targetRecord = searchData.items[0];
        collectionName = "admins";
      }
    }

    if (!targetRecord) {
      // Return true anyway to prevent email enumeration attacks
      return res.json({ ok: true, message: "If an account exists, an OTP was sent." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    otpCache.set(cleanEmail, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      collectionName,
      recordId: targetRecord.id
    });

    await sendOtpEmail(cleanEmail, otp);
    return res.json({ ok: true, message: "If an account exists, an OTP was sent." });

  } catch (error) {
    console.error("[SERVER] Forgot Password error:", error);
    return res.status(500).json({ ok: false, error: "Internal server error." });
  }
});

app.post("/api/reset-password-otp", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ ok: false, error: "Missing required fields." });
  }

  const cleanEmail = email.trim();
  const cached = otpCache.get(cleanEmail);

  if (!cached || cached.otp !== otp || Date.now() > cached.expiresAt) {
    return res.status(400).json({ ok: false, error: "Invalid or expired OTP." });
  }

  try {
    const token = await getAdminToken();
    const pbResponse = await fetch(
      `${POCKETBASE_URL}/api/collections/${cached.collectionName}/records/${cached.recordId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: newPassword, passwordConfirm: newPassword }),
      }
    );

    if (!pbResponse.ok) {
      const text = await pbResponse.text();
      throw new Error(`PocketBase password update failed: ${pbResponse.status} ${text}`);
    }

    otpCache.delete(cleanEmail);
    return res.json({ ok: true, message: "Password updated successfully." });
  } catch (error) {
    console.error("[SERVER] Reset Password error:", error);
    return res.status(500).json({ ok: false, error: "Internal server error during password reset." });
  }
});

app.post("/api/send-verification", async (req, res) => {
  const { email, name } = req.body;

  if (!email) {
    return res.status(400).json({ ok: false, error: "Email is required." });
  }

  try {
    await sendVerificationEmail(email, name);
    return res.json({ ok: true, message: "Verification email sent successfully." });
  } catch (err) {
    console.error("[EMAIL] Failed to send verification email:", err.message);
    return res.status(500).json({ ok: false, error: "Failed to send email: " + err.message });
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
