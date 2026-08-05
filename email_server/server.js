const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") }); // Load email_server's own .env
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Set up transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// --- ROUTE 1: APPROVALS ---
app.post("/send-verification", (req, res) => {
  const { email, name } = req.body;

  const mailOptions = {
    from: `"LAGONGLONG LGU" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Account Verified - LAGONGLONG INCIDENT REPORT",
    text: `Hello ${name || "User"},\n\nyou are now verified in LAGONGLONG INCIDENT REPORT, your account can now login to the app.`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) return res.status(500).send("Email failed: " + error.message);
    res.status(200).send("Verification email sent");
  });
});

// --- ROUTE 2: REJECTIONS ---
app.post("/send-rejection", (req, res) => {
  const { email, reason } = req.body;

  const mailOptions = {
    from: `"LAGONGLONG LGU" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Registration Update - LAGONGLONG INCIDENT REPORT",
    text: `Your registration was not approved.\n\nReason: ${reason}\n\nPlease update your information and try again.`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) return res.status(500).send("Email failed: " + error.message);
    res.status(200).send("Rejection email sent");
  });
});

// Use EMAIL_PORT or PORT, default to 5002
const PORT = process.env.EMAIL_PORT || process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log("Email Server is running on http://localhost:" + PORT);
});
