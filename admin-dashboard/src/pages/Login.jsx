import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { pb } from "../config/pocketbase";
import { loginStyles } from "../themes/loginStyles"; // 

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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
      const response = await fetch("http://localhost:5001/api/admin-login", {
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

  return (
    <div style={loginStyles.container}>
      <div style={loginStyles.card}>
        <div style={loginStyles.brandBox}>
          <h2 style={{ margin: 0, color: "#111827", fontSize: "24px" }}>
            Admin Login
          </h2>
          <p style={{ margin: "5px 0 0", color: "#666", fontSize: "14px" }}>
            Sign in to Command Center
          </p>
        </div>

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

          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={loginStyles.input}
            />
          </div>

          <button type="submit" style={loginStyles.button} disabled={loading}>
            {loading ? "AUTHENTICATING..." : "LOGIN"}
          </button>
        </form>

        <div style={loginStyles.footer}>
          <p style={{ fontSize: "13px", color: "#6b7280" }}>
            Need access?{" "}
            <Link to="/register" style={loginStyles.link}>
              Request Admin Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}


