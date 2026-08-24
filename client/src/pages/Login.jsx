import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { pb } from "../config/pocketbase";
import { loginStyles } from "../themes/loginStyles"; 
import { AlertTriangle, Eye, EyeOff } from "lucide-react"; 
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";

function RadialButton({ children, disabled = false, type = "submit" }) {
  const [hover, setHover] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");

  const updateOrigin = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    setOrigin(`${x}% ${y}%`);
  };

  return (
    <button
      type={type}
      style={loginStyles.button}
      disabled={disabled}
      onPointerEnter={(event) => {
        updateOrigin(event);
        setHover(true);
      }}
      onPointerLeave={(event) => {
        updateOrigin(event);
        setHover(false);
      }}
    >
      <span style={loginStyles.buttonText}>{children}</span>
      <span
        aria-hidden="true"
        style={{
          ...loginStyles.buttonReveal,
          clipPath: `circle(${hover ? "150%" : "0%"} at ${origin})`,
          WebkitClipPath: `circle(${hover ? "150%" : "0%"} at ${origin})`,
        }}
      >
        {children}
      </span>
    </button>
  );
}

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
  const [loginButtonHover, setLoginButtonHover] = useState(false);
  const [loginButtonOrigin, setLoginButtonOrigin] = useState("50% 50%");
  const [loginAlertMessage, setLoginAlertMessage] = useState("");
  const [loginAlertVisible, setLoginAlertVisible] = useState(false);
  const [loginAlertClosing, setLoginAlertClosing] = useState(false);

  const navigate = useNavigate();
  const unlockAlarmAudio = () => {
    window.dispatchEvent(new Event("alarm-audio-unlock"));
  };

  const showLoginAlert = (message) => {
    setLoginAlertMessage(String(message || ""));
    setLoginAlertClosing(false);
    setLoginAlertVisible(false);
    requestAnimationFrame(() => setLoginAlertVisible(true));
  };

  const closeLoginAlert = () => {
    setLoginAlertClosing(true);
    setLoginAlertVisible(false);
    window.setTimeout(() => {
      setLoginAlertMessage("");
      setLoginAlertClosing(false);
    }, 220);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    unlockAlarmAudio();

    // 1. Client-Side Validation
    if (!email.trim() || !password.trim()) {
      showLoginAlert("Security Alert: Fields cannot be empty.");
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
      showLoginAlert("Access Denied: Invalid Email or Password.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) return showLoginAlert("Please enter your email.");
    setLoading(true);
    try {
      const res = await fetch("https://api.ireportsystem.com/express-api/forgot-password-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error);
      showLoginAlert("If the email exists, an OTP has been sent.");
      setResetStep(2);
    } catch (err) {
      showLoginAlert(err.message || "Failed to request OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp.trim() || !newPassword.trim()) return showLoginAlert("OTP and New Password are required.");
    if (newPassword.length < 8) return showLoginAlert("Password must be at least 8 characters.");
    
    setLoading(true);
    try {
      const res = await fetch("https://api.ireportsystem.com/express-api/reset-password-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim(), otp: otp.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error);
      
      showLoginAlert("Password reset successfully! You can now log in.");
      setResetStep(0);
      setOtp("");
      setNewPassword("");
    } catch (err) {
      showLoginAlert(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={loginStyles.container}>
      <header style={loginStyles.header}>
        <img src="/icon.ico" alt="Lagonglong seal" style={loginStyles.headerLogo} />
        <span style={loginStyles.headerTitle}>Lagonglong Incident System</span>
      </header>
      <main style={loginStyles.content}>
        <div style={loginStyles.card}>
        <div style={loginStyles.brandBox}>
          <div style={loginStyles.accountIcon} aria-hidden="true">
            <img src="/assets/admin-panel.svg" alt="" width="60" height="60" />
          </div>
          <h2 style={loginStyles.title}>
            Admin Login
          </h2>
          <p style={loginStyles.subtitle}>
            Barangay Lagonglong Incident Reporting System Management
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
              <TextField
                type="email"
                label="Enter Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                variant="outlined"
                fullWidth
                sx={loginStyles.textField}
              />
            </div>

            <div>
              <TextField
                type={showPassword ? "text" : "password"}
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                variant="outlined"
                fullWidth
                sx={loginStyles.textField}
                slotProps={{ input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                } }}
              />
            </div>

            <button
              type="submit"
              style={loginStyles.button}
              disabled={loading}
              onPointerEnter={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                const x = ((event.clientX - bounds.left) / bounds.width) * 100;
                const y = ((event.clientY - bounds.top) / bounds.height) * 100;
                setLoginButtonOrigin(`${x}% ${y}%`);
                setLoginButtonHover(true);
              }}
              onPointerLeave={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                const x = ((event.clientX - bounds.left) / bounds.width) * 100;
                const y = ((event.clientY - bounds.top) / bounds.height) * 100;
                setLoginButtonOrigin(`${x}% ${y}%`);
                setLoginButtonHover(false);
              }}
            >
              <span style={loginStyles.buttonText}>
                {loading ? "AUTHENTICATING..." : "LOGIN"}
              </span>
              <span
                aria-hidden="true"
                style={{
                  ...loginStyles.buttonReveal,
                  clipPath: `circle(${loginButtonHover ? "150%" : "0%"} at ${loginButtonOrigin})`,
                  WebkitClipPath: `circle(${loginButtonHover ? "150%" : "0%"} at ${loginButtonOrigin})`,
                }}
              >
                {loading ? "AUTHENTICATING..." : "LOGIN"}
              </span>
            </button>
          </form>
        )}

        {resetStep === 1 && (
          <form onSubmit={handleRequestOtp} style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "15px" }}>
            <div>
              <TextField
                type="email"
                label="Enter Email to Receive OTP"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                variant="outlined"
                fullWidth
                sx={loginStyles.textField}
              />
            </div>
            <RadialButton disabled={loading}>
              {loading ? "SENDING..." : "SEND OTP"}
            </RadialButton>
          </form>
        )}

        {resetStep === 2 && (
          <form onSubmit={handleResetPassword} style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "15px" }}>
            <div>
              <TextField
                type="text"
                label="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                variant="outlined"
                fullWidth
                sx={loginStyles.textField}
              />
            </div>
            <div>
              <TextField
                  type={showPassword ? "text" : "password"}
                  label="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  variant="outlined"
                  fullWidth
                  sx={loginStyles.textField}
                  slotProps={{ input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          type="button"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  } }}
                />
            </div>
            <RadialButton disabled={loading}>
              {loading ? "UPDATING..." : "RESET PASSWORD"}
            </RadialButton>
          </form>
        )}

        <div style={loginStyles.footer}>
          {resetStep === 0 ? (
            <p style={{ fontSize: "14px", color: "#477257", fontWeight: "500" }}>
              Forgot your password?{" "}
              <span 
                onClick={() => setResetStep(1)} 
                style={{ ...loginStyles.link, cursor: "pointer" }}
              >
                Reset it here
              </span>
            </p>
          ) : (
            <p style={{ fontSize: "14px", color: "#477257", fontWeight: "500" }}>
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
      </main>
      {loginAlertMessage && (
        <div
          style={{
            ...loginStyles.alertOverlay,
            opacity: loginAlertVisible ? 1 : 0,
            pointerEvents: loginAlertClosing ? "none" : "auto",
          }}
          role="presentation"
        >
          <div
            style={{
              ...loginStyles.alertDialog,
              opacity: loginAlertVisible ? 1 : 0,
              transform: loginAlertVisible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.97)",
            }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="login-alert-title"
          >
            <div style={loginStyles.alertIcon}>
              <AlertTriangle size={24} />
            </div>
            <h2 id="login-alert-title" style={loginStyles.alertTitle}>
              System Alert
            </h2>
            <p style={loginStyles.alertMessage}>
              {loginAlertMessage}
            </p>
            <button
              type="button"
              style={loginStyles.alertButton}
              onClick={closeLoginAlert}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


