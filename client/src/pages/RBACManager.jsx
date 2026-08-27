import React, { useState, useEffect, useCallback } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { AVAILABLE_MODULES } from "../themes/rbacStyles";
import {
  UserCheck,
  Save,
  Loader,
  Lock,
  Mail,
  Layers,
  CheckCircle2,
  XCircle,
  Search,
  Shield,
  X,
} from "lucide-react";
import { useMessageBox } from "../components/MessageBox";

const getInitials = (admin) => {
  const first = admin.first_name ? admin.first_name.trim().charAt(0).toUpperCase() : "";
  const last = admin.last_name ? admin.last_name.trim().charAt(0).toUpperCase() : "";
  return (first + last) || (admin.email ? admin.email.charAt(0).toUpperCase() : "AD");
};

const getAvatarStyle = (name) => {
  const palettes = [
    { bg: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)", color: "#ffffff" },
    { bg: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", color: "#ffffff" },
    { bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#ffffff" },
    { bg: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)", color: "#ffffff" },
    { bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#ffffff" },
    { bg: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)", color: "#ffffff" },
    { bg: "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)", color: "#ffffff" },
  ];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palettes.length;
  return palettes[index];
};

export default function RBACManager() {
  const [admins, setAdmins] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { alert: showAlert } = useMessageBox();

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
    const load = async () => { await fetchAdmins(); };
    load();
  }, [fetchAdmins]);

  const handleTogglePermission = (moduleId) => {
    if (!selectedAdmin) return;

    const currentPermissions = selectedAdmin.permissions || [];
    const newPermissions = currentPermissions.includes(moduleId)
      ? currentPermissions.filter((p) => p !== moduleId)
      : [...currentPermissions, moduleId];

    setSelectedAdmin({ ...selectedAdmin, permissions: newPermissions });
    setHasChanges(true);
  };

  const handleSelectAll = () => {
    if (!selectedAdmin) return;
    const allIds = AVAILABLE_MODULES.map((m) => m.id);
    setSelectedAdmin({ ...selectedAdmin, permissions: allIds });
    setHasChanges(true);
  };

  const handleClearAll = () => {
    if (!selectedAdmin) return;
    setSelectedAdmin({ ...selectedAdmin, permissions: [] });
    setHasChanges(true);
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

      await showAlert(`Permissions updated successfully for ${adminName}`, { title: "Success" });
      setHasChanges(false);
      fetchAdmins();
    } catch (error) {
      console.error("Error updating permissions:", error);
      await showAlert("Failed to save permissions. Please try again.", { title: "Error" });
    } finally {
      setLoading(false);
    }
  };

  const filteredAdmins = admins.filter((admin) => {
    const name = `${admin.first_name || ""} ${admin.last_name || ""}`.toLowerCase();
    const email = (admin.email || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    return name.includes(term) || email.includes(term);
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* Header */}
        <header style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#15803d" }} />
            <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: "800", color: "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
              Role-Based Access Control (RBAC)
            </h1>
          </div>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
            Configure granular administrative privileges and module access rules.
          </p>
        </header>

        {/* Main Content Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "24px", alignItems: "start" }}>
          {/* Left Panel: Admins List */}
          <div className="premium-table-card" style={{ padding: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <UserCheck size={18} color="#15803d" />
                <h2 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                  Admin Accounts ({admins.length})
                </h2>
              </div>
            </div>

            {/* Search Input */}
            <div className="search-box-premium" style={{ width: "100%", marginBottom: "14px", minWidth: "100%", boxSizing: "border-box" }}>
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search admin name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ fontSize: "13px" }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "#94a3b8" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {fetching ? (
              <div style={{ padding: "30px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: "#15803d" }}>
                <Loader className="animate-spin" size={20} />
                <span style={{ fontSize: "13px" }}>Loading accounts...</span>
              </div>
            ) : filteredAdmins.length === 0 ? (
              <div style={{ padding: "30px 10px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                No administrator accounts found.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "620px", overflowY: "auto" }}>
                {filteredAdmins.map((admin) => {
                  const isSelected = selectedAdmin?.id === admin.id;
                  const fullName = `${admin.first_name || ""} ${admin.last_name || ""}`.trim() || "Administrator";
                  const initials = getInitials(admin);
                  const avatarStyle = getAvatarStyle(fullName);
                  const activePermCount = (admin.permissions || []).length;

                  return (
                    <div
                      key={admin.id}
                      onClick={() => {
                        setSelectedAdmin(admin);
                        setHasChanges(false);
                      }}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "12px",
                        border: isSelected ? "2px solid #15803d" : "1px solid #e2e8f0",
                        backgroundColor: isSelected ? "#f0fdf4" : "#ffffff",
                        cursor: "pointer",
                        transition: "all 0.18s ease",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          className="premium-avatar"
                          style={{
                            width: "36px",
                            height: "36px",
                            fontSize: "12px",
                            background: avatarStyle.bg,
                            color: avatarStyle.color,
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ display: "block", fontWeight: "700", color: isSelected ? "#14532d" : "#0f172a", fontSize: "13.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {fullName}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            <Mail size={11} /> {admin.email}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "4px", borderTop: "1px solid #f1f5f9", fontSize: "11.5px" }}>
                        <span style={{ color: "#64748b", fontWeight: "600" }}>{admin.position || "Regular Admin"}</span>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "10px",
                            backgroundColor: isSelected ? "#15803d" : "#f1f5f9",
                            color: isSelected ? "#ffffff" : "#475569",
                            fontWeight: "700",
                          }}
                        >
                          {activePermCount} / {AVAILABLE_MODULES.length} Modules
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel: Module Permissions */}
          <div className="premium-table-card" style={{ padding: "24px" }}>
            {selectedAdmin ? (
              <div>
                {/* Admin Header Details */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", paddingBottom: "20px", borderBottom: "1px solid #f1f5f9", marginBottom: "22px", flexWrap: "wrap", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      className="premium-avatar"
                      style={{
                        width: "48px",
                        height: "48px",
                        fontSize: "16px",
                        background: getAvatarStyle(`${selectedAdmin.first_name} ${selectedAdmin.last_name}`).bg,
                        color: "#fff",
                      }}
                    >
                      {getInitials(selectedAdmin)}
                    </div>
                    <div>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#15803d", textTransform: "uppercase", letterSpacing: "0.05em" }}>Target Account</span>
                      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: "2px 0 0 0" }}>
                        {selectedAdmin.first_name || selectedAdmin.last_name
                          ? `${selectedAdmin.first_name || ""} ${selectedAdmin.last_name || ""}`.trim()
                          : "Administrator"}
                      </h2>
                      <p style={{ margin: "2px 0 0 0", color: "#64748b", fontSize: "13px" }}>
                        {selectedAdmin.email} • ID: <code style={{ color: "#15803d", fontWeight: "600" }}>{selectedAdmin.id}</code>
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 12px",
                        borderRadius: "8px",
                        border: "1px solid #bbf7d0",
                        backgroundColor: "#f0fdf4",
                        color: "#15803d",
                        fontSize: "12.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      <CheckCircle2 size={14} /> Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 12px",
                        borderRadius: "8px",
                        border: "1px solid #fecaca",
                        backgroundColor: "#fef2f2",
                        color: "#b91c1c",
                        fontSize: "12.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      <XCircle size={14} /> Clear All
                    </button>
                  </div>
                </div>

                {/* Modules Grid */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                  <Layers size={17} color="#15803d" />
                  <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                    Authorizable System Modules
                  </h3>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "26px" }}>
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
                          padding: "16px 18px",
                          borderRadius: "12px",
                          border: hasAccess ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                          backgroundColor: hasAccess ? "#f0fdf4" : "#ffffff",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          <input
                            type="checkbox"
                            checked={hasAccess}
                            onChange={() => handleTogglePermission(module.id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: "18px",
                              height: "18px",
                              accentColor: "#15803d",
                              cursor: "pointer",
                            }}
                          />
                          <div>
                            <span style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>
                              {module.label}
                            </span>
                            <span style={{ fontSize: "12.5px", color: "#64748b" }}>
                              {module.description}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`premium-status-pill ${hasAccess ? "status-pill-active" : "status-pill-suspended"}`}
                          style={{ textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.04em" }}
                        >
                          {hasAccess ? "Granted" : "Revoked"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Save Button */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <button
                    type="button"
                    onClick={savePermissions}
                    disabled={loading}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "11px 24px",
                      borderRadius: "10px",
                      border: "none",
                      background: "linear-gradient(135deg, #15803d 0%, #166534 100%)",
                      color: "#ffffff",
                      fontSize: "14px",
                      fontWeight: "700",
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(21, 128, 61, 0.3)",
                      transition: "transform 0.15s ease",
                    }}
                  >
                    {loading ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                    {loading ? "Saving Access Rules..." : "Save Access Rules"}
                  </button>

                  {hasChanges && !loading && (
                    <span style={{ fontSize: "12.5px", color: "#d97706", fontWeight: "600", backgroundColor: "#fffbeb", padding: "6px 12px", borderRadius: "8px", border: "1px solid #fde68a" }}>
                      ● Unsaved permission changes
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b" }}>
                <Lock size={36} color="#94a3b8" style={{ marginBottom: "12px" }} />
                <h3 style={{ margin: "0 0 6px 0", color: "#1e293b", fontSize: "16px" }}>No Administrator Selected</h3>
                <p style={{ margin: 0, fontSize: "13.5px" }}>Select an administrator account from the left panel to configure module access.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
