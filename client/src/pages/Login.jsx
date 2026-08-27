import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { pb } from "../config/pocketbase";
import { getLoginStyles } from "../themes/loginStyles";
import { useTheme } from "../themes/ThemeContext";
import { AlertTriangle, Eye, EyeOff, Loader, Mail, Lock, KeyRound } from "lucide-react";

function FloatingInput({
  id,
  type = "text",
  label,
  value,
  onChange,
  onBlur,
  icon: Icon,
  rightElement,
  error,
  required = false,
  styles,
  isDark = false,
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isFilled = Boolean(value && String(value).trim().length > 0);
  const isActive = focused || isFilled;

  return (
    <div style={styles.inputGroup}>
      <div
        style={styles.inputWrapper}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {Icon && (
          <div
            style={{
              ...styles.inputIconLeft,
              color: error
                ? "#ef4444"
                : focused || (isActive && isFilled)
                  ? (isDark ? "#4ade80" : "#15803d")
                  : hovered
                    ? (isDark ? "#22c55e" : "#16a34a")
                    : (isDark ? "#64748b" : "#94a3b8"),
              transition: "color 0.2s ease",
            }}
          >
            <Icon size={18} />
          </div>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false);
            if (onBlur) onBlur(e);
          }}
          required={required}
          style={{
            ...styles.inputElement,
            paddingLeft: Icon ? "42px" : "14px",
            paddingRight: rightElement ? "40px" : "14px",
            borderColor: error
              ? "#ef4444"
              : focused
                ? (isDark ? "#22c55e" : "#15803d")
                : hovered
                  ? (isDark ? "#16a34a" : "#16a34a")
                  : (isDark ? "#334155" : "#e2e8f0"),
            boxShadow: error
              ? "0 0 0 3px rgba(239, 68, 68, 0.15)"
              : focused
                ? isDark
                  ? "0 0 0 3.5px rgba(74, 222, 128, 0.18)"
                  : "0 0 0 3.5px rgba(21, 128, 61, 0.12)"
                : hovered
                  ? isDark
                    ? "0 2px 8px rgba(0, 0, 0, 0.3)"
                    : "0 2px 8px rgba(21, 128, 61, 0.08)"
                  : "none",
            backgroundColor: isDark
              ? focused
                ? "#1e293b"
                : hovered
                  ? "#243247"
                  : "#1e293b"
              : hovered && !focused
                ? "#fcfdfc"
                : "#ffffff",
          }}
        />
        <label
          htmlFor={id}
          style={{
            ...styles.floatingLabel,
            left: Icon ? "40px" : "14px",
            ...(isActive ? styles.floatingLabelActive : {}),
            color: error
              ? "#ef4444"
              : focused
                ? (isDark ? "#4ade80" : "#15803d")
                : isActive
                  ? (isDark ? "#94a3b8" : "#475569")
                  : hovered
                    ? (isDark ? "#cbd5e1" : "#16a34a")
                    : (isDark ? "#64748b" : "#94a3b8"),
          }}
        >
          {label}
        </label>
        {rightElement && (
          <div style={styles.inputIconRight}>
            {rightElement}
          </div>
        )}
      </div>
      {error && <p style={styles.errorText}>{error}</p>}
    </div>
  );
}

function PremiumButton({ children, disabled = false, type = "submit", onClick, styles }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        ...styles.button,
        backgroundColor: hovered ? "#166534" : "#15803d",
        transform: pressed ? "scale(0.98)" : hovered ? "translateY(-1px)" : "scale(1)",
        boxShadow: hovered
          ? "0 4px 14px rgba(21, 128, 61, 0.3)"
          : "0 2px 6px rgba(21, 128, 61, 0.2)",
        opacity: disabled ? 0.7 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span style={styles.buttonText}>{children}</span>
    </button>
  );
}

export default function Login() {
  const { isDark } = useTheme();
  const styles = useMemo(() => getLoginStyles(isDark), [isDark]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    import("./Dashboard").catch(() => {});
    import("../components/Sidebar").catch(() => {});

    try {
      fetch("https://api.ireportsystem.com/express-api/admin-login", {
        method: "OPTIONS",
        mode: "cors",
      }).catch(() => {});
      const savedEmail = localStorage.getItem("admin_remember_email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {}
  }, []);

  const [resetStep, setResetStep] = useState(0); 
  const [resetEmail, setResetEmail] = useState("");
  const [resetEmailError, setResetEmailError] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const isValidEmail = (val) => {
    if (!val || typeof val !== "string") return false;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(val.trim());
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    // Strict validation - prevent any trigger if email is empty or format is invalid
    if (!trimmedEmail) {
      setEmailError("Please enter your email.");
      showLoginAlert("Security Alert: Email field cannot be empty.");
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setEmailError("Please enter a valid email format (e.g. name@gmail.com).");
      showLoginAlert("Invalid Email: Please enter a valid email format before signing in.");
      return;
    }

    if (!trimmedPassword) {
      setPasswordError("Please enter your password.");
      showLoginAlert("Security Alert: Password field cannot be empty.");
      return;
    }

    unlockAlarmAudio();
    setEmailError("");
    setPasswordError("");
    setLoading(true);

    try {
      // High-priority POST request to Node API server
      const response = await fetch("https://api.ireportsystem.com/express-api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
        priority: "high",
        keepalive: true,
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        showLoginAlert(data.error || "Invalid email or password.");
        setLoading(false);
        return;
      }

      // Save PocketBase authStore session
      if (data.token && data.record) {
        pb.authStore.save(data.token, data.record);
      }

      // Handle Remember Me storage
      if (rememberMe) {
        try {
          localStorage.setItem("admin_remember_email", trimmedEmail);
        } catch {}
      } else {
        try {
          localStorage.removeItem("admin_remember_email");
        } catch {}
      }

      // Instant replace navigation
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Login fetch error:", err);
      showLoginAlert(
        "Network connection failed. Please verify your internet connection or server availability."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    const trimmed = resetEmail.trim();
    if (!trimmed) {
      setResetEmailError("Please enter your email.");
      showLoginAlert("Security Alert: Email field cannot be empty.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setResetEmailError("Please enter a valid email format.");
      showLoginAlert("Invalid Email: Please enter a valid email format.");
      return;
    }

    setResetEmailError("");
    setLoading(true);

    try {
      const res = await fetch("https://api.ireportsystem.com/express-api/forgot-password-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showLoginAlert(data.error || "Failed to send reset OTP.");
        setLoading(false);
        return;
      }

      showLoginAlert("If the email exists, an OTP code has been sent.");
      setResetStep(2);
    } catch (err) {
      showLoginAlert(err.message || "Failed to request password reset.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    if (e) e.preventDefault();
    if (!otp.trim()) {
      showLoginAlert("Please enter the OTP verification code.");
      return;
    }
    if (!newPassword.trim() || newPassword.length < 6) {
      showLoginAlert("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("https://api.ireportsystem.com/express-api/reset-password-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail.trim(),
          otp: otp.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showLoginAlert(data.error || "Invalid or expired OTP code.");
        setLoading(false);
        return;
      }

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
    <div style={styles.container}>
      <header style={styles.header}>
        <img src="/icon.ico" alt="Lagonglong seal" style={styles.headerLogo} />
        <span style={styles.headerTitle}>Lagonglong Incident System</span>
      </header>

      <main style={styles.content}>
        <div style={styles.cardWrapper}>
          <div style={styles.card}>
            <div style={styles.brandBox}>
              <img
                src="/icon.ico"
                alt="Lagonglong seal"
                style={styles.brandLogo}
              />
              <h1 style={styles.title}>
                {resetStep === 0 ? "Admin Login" : resetStep === 1 ? "Forgot Password" : "Reset Password"}
              </h1>
              <p style={styles.subtitle}>
                {resetStep === 0
                  ? "Barangay Lagonglong Incident Reporting System Management"
                  : resetStep === 1
                    ? "Enter your email to receive an OTP verification code"
                    : "Enter the OTP code and your new password"}
              </p>
            </div>

            {resetStep === 0 && (
              <form
                onSubmit={handleLogin}
                noValidate
                onPointerDownCapture={unlockAlarmAudio}
                onKeyDownCapture={unlockAlarmAudio}
                style={styles.form}
              >
                <FloatingInput
                  id="email"
                  type="email"
                  label="Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  onBlur={() => {
                    if (email.trim() && !isValidEmail(email.trim())) {
                      setEmailError("Please enter a valid email format (e.g. name@gmail.com).");
                    }
                  }}
                  icon={Mail}
                  error={emailError}
                  required
                  styles={styles}
                  isDark={isDark}
                />

                <FloatingInput
                  id="password"
                  type={showPassword ? "text" : "password"}
                  label="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  icon={Lock}
                  error={passwordError}
                  required
                  styles={styles}
                  isDark={isDark}
                  rightElement={
                    <div
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      style={{ cursor: "pointer", display: "flex" }}
                    >
                      {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                    </div>
                  }
                />

                <div style={styles.optionsRow}>
                  <label style={styles.rememberLabel}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRememberMe(checked);
                        if (!checked) {
                          try {
                            localStorage.removeItem("admin_remember_email");
                          } catch {}
                        }
                      }}
                      style={styles.customCheckbox}
                    />
                    <span>Remember me</span>
                  </label>
                  <span
                    onClick={() => {
                      setResetStep(1);
                      setEmailError("");
                      setPasswordError("");
                    }}
                    style={styles.forgotLink}
                  >
                    Forgot Password?
                  </span>
                </div>

                <PremiumButton disabled={loading} styles={styles}>
                  {loading ? (
                    <Loader className="animate-spin" size={20} />
                  ) : (
                    <span>Login</span>
                  )}
                </PremiumButton>
              </form>
            )}

            {resetStep === 1 && (
              <form onSubmit={handleRequestOtp} noValidate style={styles.form}>
                <FloatingInput
                  id="resetEmail"
                  type="email"
                  label="Email to receive OTP"
                  value={resetEmail}
                  onChange={(e) => {
                    setResetEmail(e.target.value);
                    if (resetEmailError) setResetEmailError("");
                  }}
                  onBlur={() => {
                    if (resetEmail.trim() && !isValidEmail(resetEmail.trim())) {
                      setResetEmailError("Please enter a valid email format (e.g. name@gmail.com).");
                    }
                  }}
                  icon={Mail}
                  error={resetEmailError}
                  required
                  styles={styles}
                  isDark={isDark}
                />

                <PremiumButton disabled={loading} styles={styles}>
                  {loading ? (
                    <Loader className="animate-spin" size={20} />
                  ) : (
                    <span>Send OTP</span>
                  )}
                </PremiumButton>

                <div style={styles.footer}>
                  <p style={styles.footerText}>
                    Remembered password?{" "}
                    <span
                      onClick={() => {
                        setResetStep(0);
                        setEmailError("");
                        setPasswordError("");
                        setResetEmailError("");
                      }}
                      style={styles.signUpLink}
                    >
                      Back to Login
                    </span>
                  </p>
                </div>
              </form>
            )}

            {resetStep === 2 && (
              <form onSubmit={handleResetPassword} noValidate style={styles.form}>
                <FloatingInput
                  id="otp"
                  type="text"
                  label="Enter OTP Code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  icon={KeyRound}
                  required
                  styles={styles}
                  isDark={isDark}
                />

                <FloatingInput
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  label="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  icon={Lock}
                  required
                  styles={styles}
                  isDark={isDark}
                  rightElement={
                    <div
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      style={{ cursor: "pointer", display: "flex" }}
                    >
                      {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                    </div>
                  }
                />

                <PremiumButton disabled={loading} styles={styles}>
                  {loading ? (
                    <Loader className="animate-spin" size={20} />
                  ) : (
                    <span>Reset Password</span>
                  )}
                </PremiumButton>

                <div style={styles.footer}>
                  <p style={styles.footerText}>
                    Remembered password?{" "}
                    <span
                      onClick={() => {
                        setResetStep(0);
                        setEmailError("");
                        setPasswordError("");
                      }}
                      style={styles.signUpLink}
                    >
                      Back to Login
                    </span>
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {loginAlertMessage && (
        <div
          style={{
            ...styles.alertOverlay,
            opacity: loginAlertVisible ? 1 : 0,
            pointerEvents: loginAlertClosing ? "none" : "auto",
          }}
          role="presentation"
        >
          <div
            style={{
              ...styles.alertDialog,
              opacity: loginAlertVisible ? 1 : 0,
              transform: loginAlertVisible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.97)",
            }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="login-alert-title"
          >
            <div style={styles.alertIcon}>
              <AlertTriangle size={26} />
            </div>
            <h2 id="login-alert-title" style={styles.alertTitle}>
              System Alert
            </h2>
            <p style={styles.alertMessage}>{loginAlertMessage}</p>
            <button
              type="button"
              style={styles.alertButton}
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


