import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { pb } from "./pocketbase";

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
      const cleanEmail = email.trim();
      let authSuccess = false;

      // 2. Try regular admin account first[cite: 1, 2]
      try {
        await pb.collection("admins").authWithPassword(cleanEmail, password);
        console.log("✅ Successfully logged in as a regular Admin.");
        authSuccess = true;
      } catch {
        // Fixed: Removed (adminError) since it was unused
        console.log(
          "ℹ️ Not a regular admin, checking super_admins collection...",
        );
      }

      // 3. Fallback: Try your custom super_admins collection[cite: 2]
      if (!authSuccess) {
        await pb
          .collection("super_admins")
          .authWithPassword(cleanEmail, password);
        console.log("✅ Successfully logged in as a Super Admin.");
      }

      // 4. Move to dashboard if either completely resolved without an error
      navigate("/dashboard");
    } catch {
      // Fixed: Removed (error) since it was unused
      console.clear();
      console.warn("Security Block: Invalid login attempt detected.");
      alert("❌ Access Denied: Invalid Email or Password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.brandBox}>
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
            <label style={styles.label}>ACCOUNT CREDENTIALS</label>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
            />
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "AUTHENTICATING..." : "LOGIN"}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={{ fontSize: "13px", color: "#6b7280" }}>
            Need access?{" "}
            <Link to="/register" style={styles.link}>
              Request Admin Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// Consolidated Styles Object
const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3f4f6",
    fontFamily: "Arial, sans-serif",
    padding: "20px",
  },
  card: {
    background: "white",
    padding: "40px",
    borderRadius: "8px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
    width: "100%",
    maxWidth: "450px",
    boxSizing: "border-box",
  },
  brandBox: { textAlign: "center", marginBottom: "20px" },
  label: {
    fontSize: "11px",
    color: "#9ca3af",
    fontWeight: "bold",
    letterSpacing: "0.5px",
    marginBottom: "8px",
    display: "block",
    textTransform: "uppercase",
  },
  input: {
    width: "100%",
    padding: "12px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
    color: "#1f2937",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "12px",
    background: "#1a1c23",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "14px",
    marginTop: "10px",
  },
  footer: {
    textAlign: "center",
    marginTop: "25px",
    borderTop: "1px solid #f3f4f6",
    paddingTop: "20px",
  },
  link: {
    color: "#d32f2f",
    textDecoration: "none",
    fontWeight: "bold",
  },
};
