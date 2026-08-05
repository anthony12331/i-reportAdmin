import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { pb } from "../config/pocketbase";
import { registerStyles as styles } from "../themes/registerStyles";

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    extension: "",
    position: "",
  });

  const handleRegister = async (e) => {
    e.preventDefault();

    // --- 1. CLIENT-SIDE VALIDATION ---
    if (
      !formData.email.trim() ||
      !formData.password ||
      !formData.first_name.trim() ||
      !formData.last_name.trim() ||
      !formData.position.trim()
    ) {
      alert("⚠️ Security Alert: All required fields must be filled.");
      return;
    }

    if (!formData.email.includes("@") || !formData.email.includes(".")) {
      alert("⚠️ Security Alert: Invalid email format.");
      return;
    }

    if (formData.password !== formData.passwordConfirm) {
      alert("⚠️ Security Alert: Passwords do not match.");
      return;
    }

    if (formData.password.length < 8) {
      alert("⚠️ Security Alert: Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      // --- 2. CROSS-COLLECTION DUPLICATION CHECK ---
      const superuserCheck = await pb.collection("_superusers").getList(1, 1, {
        filter: `email = "${formData.email.trim().toLowerCase()}"`,
      });

      if (superuserCheck.items.length > 0) {
        alert(
          "⛔ Registration Failed: This email is already reserved for a Superuser account."
        );
        setLoading(false);
        return;
      }

      // --- 3. SEND TO SERVER ---
      await pb.collection("admins").create(formData);
      alert("✅ Registration Successful! You may now login.");
      navigate("/");
    } catch {
      console.clear();
      console.warn("Registration blocked by server.");
      alert(
        "⛔ Registration Failed: Email may already be in use or system is restricted."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.brandBox}>
          <h2 style={styles.title}>Create Admin Profile</h2>
          <p style={styles.subtitle}>Register for System Access</p>
        </div>

        <form onSubmit={handleRegister} style={styles.form}>
          {/* SECTION 1: CREDENTIALS */}
          <div>
            <div style={styles.sectionLabel}>ACCOUNT CREDENTIALS</div>
            <input
              type="email"
              placeholder="Email Address"
              style={styles.input}
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>

          <div style={styles.row}>
            <input
              type="password"
              placeholder="Password"
              style={styles.input}
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
            <input
              type="password"
              placeholder="Confirm"
              style={styles.input}
              value={formData.passwordConfirm}
              onChange={(e) =>
                setFormData({ ...formData, passwordConfirm: e.target.value })
              }
            />
          </div>

          {/* SECTION 2: PERSONAL INFO */}
          <div>
            <div style={{ ...styles.sectionLabel, marginTop: "10px" }}>
              OFFICER DETAILS
            </div>
            <div style={styles.row}>
              <input
                type="text"
                placeholder="First Name"
                style={styles.input}
                value={formData.first_name}
                onChange={(e) =>
                  setFormData({ ...formData, first_name: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Last Name"
                style={styles.input}
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
              />
            </div>
          </div>

          <div style={styles.row}>
            <input
              type="text"
              placeholder="Middle Name"
              style={styles.input}
              value={formData.middle_name}
              onChange={(e) =>
                setFormData({ ...formData, middle_name: e.target.value })
              }
            />
            <input
              type="text"
              placeholder="Ext"
              style={{ ...styles.input, ...styles.extInput }}
              value={formData.extension}
              onChange={(e) =>
                setFormData({ ...formData, extension: e.target.value })
              }
            />
          </div>

          <input
            type="text"
            placeholder="Official Position (e.g. Head IT Officer)"
            style={styles.input}
            value={formData.position}
            onChange={(e) =>
              setFormData({ ...formData, position: e.target.value })
            }
          />

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "CREATING PROFILE..." : "REGISTER ACCOUNT"}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Already have access?{" "}
            <Link to="/" style={styles.link}>
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}


