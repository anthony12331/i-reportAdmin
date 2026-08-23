import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { pb } from "../config/pocketbase";
import { loginStyles } from "../themes/loginStyles"; 
import { Eye, EyeOff } from "lucide-react"; 

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Forgot Password State
  const [resetStep, setResetStep] = useState(0); // 0 = login, 1 = email, 2 = otp+password
  const [resetEmail, setResetEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const unlockAlarmAudio = () => {
    window.dispatchEvent(new Event("alarm-audio-unlock"));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    unlockAlarmAudio();

    // 1. Client-Side Validation
    if (!email.trim() || !password.trim()) {
      alert("⚠️ Security Alert: Fields cannot be empty.");
      return;
    }

    setLoading(true);

    try {
      // 2. Single POST request to Node API server

      const response = await fetch("https://api.ireportsystem.com/express-api/admin-login", {
      
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // 3. Save auth token and account record to PocketBase client session
      pb.authStore.save(data.token, data.record);

      console.log(` Logged in successfully as ${data.role}`);
      navigate("/dashboard");
    } catch (err) {
      console.warn("Security Block:", err.message);
      alert(" Access Denied: Invalid Email or Password.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) return alert("Please enter your email.");
    setLoading(true);
    try {
      const res = await fetch("https://api.ireportsystem.com/express-api/forgot-password-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error);
      alert("If the email exists, an OTP has been sent.");
      setResetStep(2);
    } catch (err) {
      alert(err.message || "Failed to request OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp.trim() || !newPassword.trim()) return alert("OTP and New Password are required.");
    if (newPassword.length < 8) return alert("Password must be at least 8 characters.");
    
    setLoading(true);
    try {
      const res = await fetch("https://api.ireportsystem.com/express-api/reset-password-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim(), otp: otp.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error);
      
      alert("Password reset successfully! You can now log in.");
      setResetStep(0);
      setOtp("");
      setNewPassword("");
    } catch (err) {
      alert(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={loginStyles.container}>
      <div style={loginStyles.card}>
        <div style={loginStyles.brandBox}>
          <h2 style={{ margin: 0, color: "#f8fafc", fontSize: "28px", fontWeight: "800", textShadow: "0 0 10px rgba(255,255,255,0.2)" }}>
            Admin Login
          </h2>
          <p style={{ margin: "5px 0 0", color: "#cbd5e1", fontSize: "15px", fontWeight: "500" }}>
            Sign in to Command Center
          </p>
        </div>

        {resetStep === 0 && (
          <form
            onSubmit={handleLogin}
            onPointerDownCapture={unlockAlarmAudio}
            onKeyDownCapture={unlockAlarmAudio}
            style={{
              marginTop: "30px",
              display: "flex",
              flexDirection: "column",
              gap: "15px",
            }}
          >
            <div>
              <label style={loginStyles.label}>ACCOUNT CREDENTIALS</label>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={loginStyles.input}
              />
            </div>

            <div style={{ position: "relative", marginBottom: "24px" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...loginStyles.input, paddingRight: "40px", marginBottom: 0 }}
              />
              <div 
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#cbd5e1", display: "flex", alignItems: "center" }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </div>
            </div>

            <button type="submit" style={loginStyles.button} disabled={loading}>
              {loading ? "AUTHENTICATING..." : "LOGIN"}
            </button>
          </form>
        )}

        {resetStep === 1 && (
          <form onSubmit={handleRequestOtp} style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "15px" }}>
            <div>
              <label style={loginStyles.label}>ENTER EMAIL TO RECEIVE OTP</label>
              <input
                type="email"
                placeholder="Email Address"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                style={loginStyles.input}
              />
            </div>
            <button type="submit" style={loginStyles.button} disabled={loading}>
              {loading ? "SENDING..." : "SEND OTP"}
            </button>
          </form>
        )}

        {resetStep === 2 && (
          <form onSubmit={handleResetPassword} style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "15px" }}>
            <div>
              <label style={loginStyles.label}>ENTER OTP</label>
              <input
                type="text"
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                style={loginStyles.input}
              />
            </div>
            <div>
              <label style={loginStyles.label}>NEW PASSWORD</label>
              <div style={{ position: "relative", marginBottom: "24px" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="New Password (min 8 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ ...loginStyles.input, paddingRight: "40px", marginBottom: 0 }}
                />
                <div 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#cbd5e1", display: "flex", alignItems: "center" }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </div>
              </div>
            </div>
            <button type="submit" style={loginStyles.button} disabled={loading}>
              {loading ? "UPDATING..." : "RESET PASSWORD"}
            </button>
          </form>
        )}

        <div style={loginStyles.footer}>
          {resetStep === 0 ? (
            <p style={{ fontSize: "14px", color: "#cbd5e1", fontWeight: "500" }}>
              Forgot your password?{" "}
              <span 
                onClick={() => setResetStep(1)} 
                style={{ ...loginStyles.link, cursor: "pointer" }}
              >
                Reset it here
              </span>
            </p>
          ) : (
            <p style={{ fontSize: "14px", color: "#cbd5e1", fontWeight: "500" }}>
              Remembered your password?{" "}
              <span 
                onClick={() => setResetStep(0)} 
                style={{ ...loginStyles.link, cursor: "pointer" }}
              >
                Back to Login
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}


