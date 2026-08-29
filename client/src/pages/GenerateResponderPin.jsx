import React, { useState, useEffect } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { useMessageBox } from "../components/MessageBox";
import { useTheme } from "../themes/ThemeContext";
import { Copy, KeyRound, RefreshCw, ShieldAlert, Loader, Check, Search, X } from "lucide-react";
import { addAuditLog } from "../utils/auditLog";

export default function GenerateResponderPin() {
  const { isDark } = useTheme();
  const [accessRecords, setAccessRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedRecordId, setCopiedRecordId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { alert: showAlert, confirm } = useMessageBox();

  useEffect(() => {
    let isMounted = true;

    const fetchRecords = async () => {
      try {
        const records = await pb.collection("registration_access").getFullList({
          sort: "department",
          requestKey: null,
        });
        if (isMounted) {
          setAccessRecords(records);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching access records:", error);
        if (isMounted) setLoading(false);
      }
    };

    fetchRecords();

    // Real-time subscription
    let unsubscribe;
    pb.collection("registration_access")
      .subscribe("*", (e) => {
        if (!isMounted) return;
        if (e.action === "create") {
          setAccessRecords((prev) => [...prev, e.record]);
        } else if (e.action === "update") {
          setAccessRecords((prev) =>
            prev.map((record) => (record.id === e.record.id ? e.record : record))
          );
        } else if (e.action === "delete") {
          setAccessRecords((prev) => prev.filter((r) => r.id !== e.record.id));
        }
      })
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch((err) => console.error("Subscription error:", err));

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const generateNewPin = async (record) => {
    const isConfirmed = await confirm(
      `Are you sure you want to generate a new PIN for the ${record.department} department? The old PIN will be invalidated immediately.`,
      {
        title: "Confirm PIN Generation",
        primaryLabel: "Generate New PIN",
      }
    );

    if (!isConfirmed) return;

    // Generate random 5 character alphanumeric PIN
    const newPin = Math.random().toString(36).substring(2, 7).toUpperCase();

    try {
      await pb.collection("registration_access").update(record.id, {
        pin: newPin,
      });

      const currentAdmin = pb.authStore.model;
      const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

      addAuditLog({
        action: "RESPONDER_PIN_GENERATED",
        target: `${record.department} Access PIN`,
        details: `Administrator ${adminName} generated a new registration PIN for the ${record.department} department.`,
        actor: adminName,
      });

      await showAlert(`Successfully generated new PIN for ${record.department}: ${newPin}`, {
        title: "PIN Generated",
      });
    } catch (error) {
      console.error("Failed to generate PIN:", error);
      await showAlert("Failed to generate new PIN. Please try again.", {
        title: "Error",
      });
    }
  };

  const toggleStatus = async (record) => {
    const action = record.is_active ? "Deactivate" : "Activate";
    const isConfirmed = await confirm(
      `Are you sure you want to ${action.toLowerCase()} PIN access for ${record.department}?`,
      {
        title: `Confirm ${action}`,
        primaryLabel: action,
      }
    );

    if (!isConfirmed) return;

    try {
      const newStatus = !record.is_active;
      await pb.collection("registration_access").update(record.id, {
        is_active: newStatus,
      });

      const currentAdmin = pb.authStore.model;
      const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

      addAuditLog({
        action: newStatus ? "RESPONDER_PIN_ACTIVATED" : "RESPONDER_PIN_DEACTIVATED",
        target: `${record.department} Access PIN`,
        details: `Administrator ${adminName} ${newStatus ? "Activated (allowed)" : "Deactivated (blocked)"} registration PIN authorization for ${record.department}.`,
        actor: adminName,
      });
    } catch (error) {
      console.error("Failed to toggle status:", error);
      await showAlert("Failed to update status. Please try again.", {
        title: "Error",
      });
    }
  };

  const copyPin = async (record) => {
    try {
      await navigator.clipboard.writeText(record.pin);
      setCopiedRecordId(record.id);
      window.setTimeout(() => setCopiedRecordId((current) => (current === record.id ? null : current)), 1800);
    } catch (error) {
      console.error("Failed to copy PIN:", error);
      await showAlert("Unable to copy the PIN. Please copy it manually.", { title: "Copy Failed" });
    }
  };

  const filteredRecords = accessRecords.filter((rec) =>
    (rec.department || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (rec.pin || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: isDark ? "#090d16" : "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* Header */}
        <header style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: isDark ? "#4ade80" : "#15803d" }} />
            <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: "800", color: isDark ? "#f8fafc" : "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
              Responder PINs
            </h1>
          </div>
          <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: "14px" }}>
            Generate and manage access PINs for emergency responder mobile apps.
          </p>
        </header>

        {/* Premium Table Card */}
        <div className="premium-table-card">
          {/* Top Toolbar */}
          <div className="table-toolbar">
            <div className="search-box-premium">
              <Search size={18} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search department or PIN code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "#94a3b8" }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="table-toolbar-actions">
              <span style={{ fontSize: "13px", fontWeight: "600", color: isDark ? "#94a3b8" : "#64748b" }}>
                Active Departments: <strong style={{ color: isDark ? "#4ade80" : "#0f172a" }}>{filteredRecords.length}</strong>
              </span>
            </div>
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 16px",
            backgroundColor: isDark ? "rgba(34, 197, 94, 0.12)" : "#f0fdf4",
            border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #bbf7d0",
            borderRadius: "10px",
            margin: "0 0 20px 0",
            fontSize: "13px",
            color: isDark ? "#86efac" : "#166534",
            lineHeight: "1.4"
          }}>
            <ShieldAlert size={18} color={isDark ? "#4ade80" : "#166534"} style={{ flexShrink: 0 }} />
            <span>
              <strong>Security Notice:</strong> Field personnel must enter their department PIN during app registration. Generating a new PIN immediately replaces and invalidates the previous code.
            </span>
          </div>

          {loading ? (
            <div style={{ padding: "50px", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", color: isDark ? "#4ade80" : "#15803d" }}>
              <Loader className="animate-spin" size={26} />
              <span>Loading responder PIN access records...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ padding: "50px 20px", textAlign: "center", color: isDark ? "#94a3b8" : "#64748b" }}>
              <KeyRound size={40} color="#94a3b8" style={{ marginBottom: "12px" }} />
              <h3 style={{ margin: "0 0 6px 0", color: isDark ? "#f8fafc" : "#1e293b", fontSize: "16px" }}>No Departments Found</h3>
              <p style={{ margin: 0, fontSize: "13.5px" }}>No access records match your query.</p>
            </div>
          ) : (
            <div className="premium-table-wrapper" style={{ overflowX: "auto" }}>
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Current Access PIN</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "38px",
                              height: "38px",
                              borderRadius: "10px",
                              backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
                              border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: isDark ? "#4ade80" : "#15803d",
                              fontWeight: "800",
                              fontSize: "14px",
                            }}
                          >
                            {record.department ? record.department.slice(0, 2).toUpperCase() : "DP"}
                          </div>
                          <div>
                            <span style={{ fontWeight: "700", color: isDark ? "#f8fafc" : "#1e293b", fontSize: "14px", display: "block" }}>
                              {record.department ? record.department.toUpperCase() : "GENERAL"}
                            </span>
                            <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>Authorized Responder Unit</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: "16px",
                              fontWeight: "800",
                              letterSpacing: "0.15em",
                              backgroundColor: isDark ? "#172338" : "#f8fafc",
                              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              color: isDark ? "#4ade80" : "#0f172a",
                            }}
                          >
                            {record.pin}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyPin(record)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "6px 10px",
                              borderRadius: "6px",
                              border: copiedRecordId === record.id
                                ? (isDark ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid #bbf7d0")
                                : (isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1"),
                              backgroundColor: copiedRecordId === record.id
                                ? (isDark ? "rgba(34, 197, 94, 0.22)" : "#f0fdf4")
                                : (isDark ? "#172338" : "#ffffff"),
                              color: copiedRecordId === record.id
                                ? (isDark ? "#4ade80" : "#15803d")
                                : (isDark ? "#cbd5e1" : "#475569"),
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            title="Copy PIN"
                          >
                            {copiedRecordId === record.id ? <Check size={13} /> : <Copy size={13} />}
                            {copiedRecordId === record.id ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`premium-status-pill ${
                            record.is_active ? "status-pill-active" : "status-pill-suspended"
                          }`}
                        >
                          {record.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: "8px" }}>
                          <button
                            type="button"
                            className="premium-action-btn"
                            onClick={() => generateNewPin(record)}
                            style={{
                              color: isDark ? "#4ade80" : "#15803d",
                              borderColor: isDark ? "rgba(34, 197, 94, 0.35)" : "#bbf7d0",
                              backgroundColor: isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4",
                            }}
                            title="Generate a new secure PIN"
                          >
                            <RefreshCw size={13} />
                            <span>New PIN</span>
                          </button>

                          <button
                            type="button"
                            className="premium-action-btn"
                            style={{
                              color: record.is_active
                                ? (isDark ? "#f87171" : "#ef4444")
                                : (isDark ? "#4ade80" : "#15803d"),
                              borderColor: record.is_active
                                ? (isDark ? "rgba(239, 68, 68, 0.35)" : "#fecaca")
                                : (isDark ? "rgba(34, 197, 94, 0.35)" : "#bbf7d0"),
                              backgroundColor: record.is_active
                                ? (isDark ? "rgba(239, 68, 68, 0.16)" : "#fef2f2")
                                : (isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4"),
                            }}
                            onClick={() => toggleStatus(record)}
                          >
                            {record.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
