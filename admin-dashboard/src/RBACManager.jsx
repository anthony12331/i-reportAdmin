import React, { useState, useEffect, useCallback } from "react";
import { pb } from "./pocketbase";
import Sidebar from "./Sidebar";
import {
  ShieldCheck,
  UserCheck,
  Save,
  Loader,
  AlertCircle,
  Lock,
  Mail,
  Briefcase,
  Layers,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const AVAILABLE_MODULES = [
  {
    id: "incidents",
    label: "Incidents Management",
    description: "Manage incoming emergency reports, assign units, and update case statuses.",
  },
  {
    id: "sos",
    label: "SOS Tracking",
    description: "Live spatial tracking of active emergency SOS signals and dispatch telemetry.",
  },
  {
    id: "users",
    label: "User Registration Management",
    description: "Audit and verify civilian account registrations and submitted credentials.",
  },
  {
    id: "reports",
    label: "Data & Reports Analytics",
    description: "Access system analytics, generate telemetry graphs, and export official PDF logs.",
  },
];

export default function RBACManager() {
  const [admins, setAdmins] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const fetchAdmins = useCallback(async () => {
    setFetching(true);
    try {
      const records = await pb.collection("admins").getFullList({
        sort: "-created",
        requestKey: null,
      });
      setAdmins(records);
      setSelectedAdmin((prev) => prev || (records.length > 0 ? records[0] : null));
    } catch (error) {
      if (!error.isAbort) {
        console.error("Failed to fetch admins:", error);
      }
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleTogglePermission = (moduleId) => {
    if (!selectedAdmin) return;

    const currentPermissions = selectedAdmin.permissions || [];
    const newPermissions = currentPermissions.includes(moduleId)
      ? currentPermissions.filter((p) => p !== moduleId)
      : [...currentPermissions, moduleId];

    setSelectedAdmin({ ...selectedAdmin, permissions: newPermissions });
  };

  const handleSelectAll = () => {
    if (!selectedAdmin) return;
    const allIds = AVAILABLE_MODULES.map((m) => m.id);
    setSelectedAdmin({ ...selectedAdmin, permissions: allIds });
  };

  const handleClearAll = () => {
    if (!selectedAdmin) return;
    setSelectedAdmin({ ...selectedAdmin, permissions: [] });
  };

  const savePermissions = async () => {
    if (!selectedAdmin) return;
    setLoading(true);
    try {
      const updatedRecord = await pb
        .collection("admins")
        .update(selectedAdmin.id, {
          permissions: selectedAdmin.permissions || [],
        });

      if (pb.authStore.model && pb.authStore.model.id === selectedAdmin.id) {
        pb.authStore.save(pb.authStore.token, updatedRecord);
      }

      const adminName =
        `${selectedAdmin.first_name || ""} ${selectedAdmin.last_name || ""}`.trim() ||
        selectedAdmin.email;

      alert(`✅ Permissions updated for ${adminName}`);
      fetchAdmins();
    } catch (error) {
      console.error("Error updating permissions:", error);
      alert("❌ Failed to save permissions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#0b0f19",
        color: "#f8fafc",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <Sidebar />

      <main style={{ flex: 1, padding: "32px", marginLeft: "260px" }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "28px",
            paddingBottom: "20px",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "#38bdf8",
                  boxShadow: "0 0 12px #38bdf8",
                }}
              />
              <h1
                style={{
                  fontSize: "28px",
                  fontWeight: "900",
                  letterSpacing: "-0.5px",
                  color: "#ffffff",
                  margin: 0,
                }}
              >
                ROLE-BASED ACCESS CONTROL (RBAC)
              </h1>
            </div>
            <p
              style={{
                color: "#94a3b8",
                fontSize: "14px",
                margin: "6px 0 0 24px",
                fontWeight: "500",
              }}
            >
              Configure granular administrative privileges and module access rules
            </p>
          </div>
        </header>

        {/* Main Content Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "24px" }}>
          {/* Admin List Panel */}
          <div
            style={{
              backgroundColor: "#1e293b",
              borderRadius: "16px",
              border: "1px solid #334155",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                paddingBottom: "12px",
                borderBottom: "1px solid #334155",
              }}
            >
              <UserCheck size={18} color="#38bdf8" />
              <h2
                style={{
                  fontSize: "14px",
                  fontWeight: "800",
                  color: "#f8fafc",
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Admin Accounts ({admins.length})
              </h2>
            </div>

            {fetching ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                <Loader className="animate-spin" size={24} color="#38bdf8" />
              </div>
            ) : admins.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#64748b", fontSize: "13px" }}>
                No regular admin accounts found.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {admins.map((admin) => {
                  const isSelected = selectedAdmin?.id === admin.id;
                  const activePermCount = (admin.permissions || []).length;

                  return (
                    <button
                      key={admin.id}
                      onClick={() => setSelectedAdmin(admin)}
                      style={{
                        padding: "14px",
                        textAlign: "left",
                        cursor: "pointer",
                        backgroundColor: isSelected ? "rgba(56, 189, 248, 0.1)" : "#0f172a",
                        border: isSelected ? "1px solid #38bdf8" : "1px solid #334155",
                        borderRadius: "12px",
                        transition: "all 0.2s ease",
                        outline: "none",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "800",
                          color: isSelected ? "#38bdf8" : "#f8fafc",
                          fontSize: "14px",
                          marginBottom: "4px",
                        }}
                      >
                        {admin.first_name || admin.last_name
                          ? `${admin.first_name || ""} ${admin.last_name || ""}`.trim()
                          : "Administrator"}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          color: "#94a3b8",
                          fontSize: "12px",
                          marginBottom: "10px",
                        }}
                      >
                        <Mail size={12} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {admin.email}
                        </span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>
                          {admin.position || "Regular Admin"}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: "800",
                            backgroundColor: isSelected ? "#38bdf8" : "#334155",
                            color: isSelected ? "#0f172a" : "#94a3b8",
                            padding: "2px 8px",
                            borderRadius: "6px",
                          }}
                        >
                          {activePermCount} / {AVAILABLE_MODULES.length} Modules
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Module Permissions Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {selectedAdmin ? (
              <div
                style={{
                  backgroundColor: "#1e293b",
                  borderRadius: "16px",
                  border: "1px solid #334155",
                  padding: "24px",
                }}
              >
                {/* Admin Header Detail */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: "20px",
                    borderBottom: "1px solid #334155",
                    marginBottom: "24px",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#38bdf8", textTransform: "uppercase" }}>
                      Target Account
                    </span>
                    <h2 style={{ margin: "4px 0 0 0", fontSize: "20px", fontWeight: "800", color: "#f8fafc" }}>
                      {selectedAdmin.first_name || selectedAdmin.last_name
                        ? `${selectedAdmin.first_name || ""} ${selectedAdmin.last_name || ""}`
                        : "Administrator"}
                    </h2>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>
                      {selectedAdmin.email} • ID: <code style={{ color: "#cbd5e1" }}>{selectedAdmin.id}</code>
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={handleSelectAll}
                      style={{
                        padding: "8px 14px",
                        backgroundColor: "#0f172a",
                        color: "#38bdf8",
                        border: "1px solid #38bdf8",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "700",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <CheckCircle2 size={14} /> Select All
                    </button>
                    <button
                      onClick={handleClearAll}
                      style={{
                        padding: "8px 14px",
                        backgroundColor: "#0f172a",
                        color: "#f87171",
                        border: "1px solid #ef4444",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "700",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <XCircle size={14} /> Clear All
                    </button>
                  </div>
                </div>

                {/* Modules Checkbox Grid */}
                <h3
                  style={{
                    fontSize: "13px",
                    fontWeight: "800",
                    color: "#94a3b8",
                    marginBottom: "16px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Layers size={16} color="#38bdf8" /> Authorizable Modules
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
                  {AVAILABLE_MODULES.map((module) => {
                    const hasAccess = (selectedAdmin.permissions || []).includes(module.id);

                    return (
                      <div
                        key={module.id}
                        onClick={() => handleTogglePermission(module.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "16px",
                          backgroundColor: hasAccess ? "rgba(16, 185, 129, 0.08)" : "#0f172a",
                          border: `1px solid ${hasAccess ? "#10b981" : "#334155"}`,
                          borderRadius: "12px",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          <input
                            type="checkbox"
                            checked={hasAccess}
                            onChange={() => {}} // Handled by parent container click
                            style={{
                              width: "18px",
                              height: "18px",
                              accentColor: "#10b981",
                              cursor: "pointer",
                            }}
                          />
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: "800", color: "#f8fafc" }}>
                              {module.label}
                            </div>
                            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                              {module.description}
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "800",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            backgroundColor: hasAccess ? "rgba(16, 185, 129, 0.2)" : "rgba(148, 163, 184, 0.1)",
                            color: hasAccess ? "#34d399" : "#94a3b8",
                            border: `1px solid ${hasAccess ? "#10b981" : "#475569"}`,
                          }}
                        >
                          {hasAccess ? "GRANTED" : "REVOKED"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Submit Action Button */}
                <button
                  onClick={savePermissions}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "12px 20px",
                    backgroundColor: "#10b981",
                    color: "#0f172a",
                    border: "none",
                    borderRadius: "10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    fontWeight: "900",
                    fontSize: "14px",
                    transition: "opacity 0.2s",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? (
                    <Loader className="animate-spin" size={18} />
                  ) : (
                    <Save size={18} />
                  )}
                  {loading ? "SAVING ACCESS RULES..." : "SAVE ACCESS RULES"}
                </button>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: "#1e293b",
                  borderRadius: "16px",
                  border: "2px dashed #334155",
                  padding: "60px",
                  textAlign: "center",
                  color: "#94a3b8",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <Lock size={32} color="#64748b" />
                <div style={{ fontSize: "16px", fontWeight: "700" }}>No Administrator Selected</div>
                <div style={{ fontSize: "13px", color: "#64748b" }}>
                  Select an account from the left pane to edit module privileges.
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}