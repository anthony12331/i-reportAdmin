const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendVerificationEmail(email, name) {
  const mailOptions = {
    from: `"LAGONGLONG LGU" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Account Verified - LAGONGLONG INCIDENT REPORT",
    text: `Hello ${name || "User"},\n\nyou are now verified in LAGONGLONG INCIDENT REPORT, your account can now login to the app.`,
  };

  return transporter.sendMail(mailOptions);
}

async function sendRejectionEmail(email, reason) {
  const mailOptions = {
    from: `"LAGONGLONG LGU" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Registration Update - LAGONGLONG INCIDENT REPORT",
    text: `Your registration was not approved.\n\nReason: ${reason}\n\nPlease update your information and try again.`,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendVerificationEmail,
  sendRejectionEmail,
};
