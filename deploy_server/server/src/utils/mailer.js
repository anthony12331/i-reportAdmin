const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// Note: Until you verify a custom domain in Resend, 
// you can only send emails TO yourself using this generic FROM address.
const SENDER_EMAIL = "onboarding@resend.dev";

async function sendVerificationEmail(email, name) {
  return resend.emails.send({
    from: SENDER_EMAIL,
    to: email,
    subject: "Account Verified - LAGONGLONG INCIDENT REPORT",
    html: `<p>Hello ${name || "User"},</p><p>You are now verified in LAGONGLONG INCIDENT REPORT, your account can now login to the app.</p>`,
  });
}

async function sendRejectionEmail(email, reason) {
  return resend.emails.send({
    from: SENDER_EMAIL,
    to: email,
    subject: "Registration Update - LAGONGLONG INCIDENT REPORT",
    html: `<p>Your registration was not approved.</p><p>Reason: ${reason}</p><p>Please update your information and try again.</p>`,
  });
}

async function sendOtpEmail(email, otp) {
  return resend.emails.send({
    from: SENDER_EMAIL,
    to: email,
    subject: "Your OTP Code - LAGONGLONG INCIDENT REPORT",
    html: `<p>Your OTP code for password reset is: <strong>${otp}</strong></p><p>This code is valid for 10 minutes. Please do not share this with anyone.</p>`,
  });
}

module.exports = {
  sendVerificationEmail,
  sendRejectionEmail,
  sendOtpEmail,
};
