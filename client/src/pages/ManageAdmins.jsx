import { useState, useEffect } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { Loader, Search, UserPlus, Shield, ShieldCheck, ShieldAlert, UserX, UserCheck, ArrowUpRight, X } from "lucide-react";
import { useMessageBox } from "../components/MessageBox";

const getInitials = (admin) => {
  const first = admin.first_name ? admin.first_name.trim().charAt(0).toUpperCase() : "";
  const last = admin.last_name ? admin.last_name.trim().charAt(0).toUpperCase() : "";
  return (first + last) || (admin.email ? admin.email.charAt(0).toUpperCase() : "A");
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

export default function ManageAdmins() {
  const [admins, setAdmins] = useState([]);
  const [superAdmins, setSuperAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Admin Form State
  const [newEmail, setNewEmail] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { confirm, alert: showMsgAlert } = useMessageBox();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [adminsRes, superAdminsRes] = await Promise.all([
        pb.collection("admins").getFullList({ requestKey: null }),
        pb.collection("super_admins").getFullList({ requestKey: null }),
      ]);
      setAdmins(adminsRes);
      setSuperAdmins(superAdminsRes);
    } catch (err) {
      console.error("Failed to fetch admins:", err);
      alert("Error fetching admin lists.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!newEmail || !newFirstName || !newLastName) {
      return alert("Email, First Name, and Last Name are required.");
    }

    setIsCreating(true);
    try {
      await pb.collection("admins").create({
        email: newEmail.trim(),
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        middle_name: "",
        extension: "",
        position: "Admin",
        password: "12345678",
        passwordConfirm: "12345678",
        emailVisibility: true,
        suspended: false,
      });
      await showMsgAlert(
        "Administrator account created successfully. The initial temporary password is set to 12345678.",
        { title: "Account Created" }
      );
      setNewEmail("");
      setNewFirstName("");
      setNewLastName("");
      setShowCreateModal(false);
      fetchUsers();
    } catch (err) {
      console.error("Failed to create admin:", err);
      alert(err.message || "Failed to create administrator account.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleSuspend = async (admin, collectionName) => {
    const isSuspending = !admin.suspended;
    const adminName = (`${admin.first_name || ""} ${admin.last_name || ""}`.trim()) || admin.email || "this administrator";
    
    const shouldContinue = await confirm(
      isSuspending
        ? `Are you sure you want to suspend ${adminName}? They will not be able to log in until their access is restored.`
        : `Are you sure you want to restore access for ${adminName}?`,
      {
        title: isSuspending ? "Confirm Suspension" : "Restore Access",
        primaryLabel: isSuspending ? "Suspend Administrator" : "Restore Access",
        secondaryLabel: "Cancel",
      }
    );
    if (!shouldContinue) return;

    try {
      await pb.collection(collectionName).update(admin.id, {
        suspended: isSuspending,
      });
      fetchUsers();
    } catch (err) {
      console.error(`Failed to update administrator status:`, err);
      alert(`Error: ${err.message}`);
    }
  };

  const handlePromote = async (admin) => {
    const adminName = (`${admin.first_name || ""} ${admin.last_name || ""}`.trim()) || admin.email || "this administrator";
    const shouldContinue = await confirm(
      `Are you sure you want to promote ${adminName} to Super Administrator? This grants full system permissions.`,
      {
        title: "Confirm Role Promotion",
        primaryLabel: "Promote to Super Admin",
        secondaryLabel: "Cancel",
      }
    );
    if (!shouldContinue) return;

    try {
      await pb.collection("super_admins").create({
        email: admin.email,
        first_name: admin.first_name || "",
        last_name: admin.last_name || "",
        middle_name: admin.middle_name || "",
        extension: admin.extension || "",
        position: admin.position || "Super Admin",
        password: "12345678",
        passwordConfirm: "12345678",
        emailVisibility: true,
        suspended: admin.suspended || false,
      });

      await pb.collection("admins").delete(admin.id);
      fetchUsers();
      await showMsgAlert(
        `Successfully promoted ${adminName} to Super Administrator. Their credentials are now active.`,
        { title: "Promotion Complete" }
      );
    } catch (err) {
      console.error("Failed to promote admin:", err);
      alert(`Error promoting administrator: ${err.message}`);
    }
  };

  const filterList = (list) => {
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter((item) => {
      const name = `${item.first_name || ""} ${item.last_name || ""}`.toLowerCase();
      const email = (item.email || "").toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  };

  const filteredSuperAdmins = filterList(superAdmins);
  const filteredAdmins = filterList(admins);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* Header */}
        <header style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: "800", color: "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
            Admin Management Console
          </h1>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
            Manage privileged administrator and super administrator credentials.
          </p>
        </header>

        {/* Top Action Card */}
        <div className="premium-table-card" style={{ marginBottom: "24px" }}>
          <div className="table-toolbar">
            <div className="search-box-premium">
              <Search size={18} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search administrators by name or email..."
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
              <button
                type="button"
                className="premium-btn-action"
                onClick={() => setShowCreateModal(true)}
              >
                <UserPlus size={16} />
                <span>Create New Admin</span>
              </button>
            </div>
          </div>
        </div>

        {/* Super Admins Card */}
        <div className="premium-table-card" style={{ marginBottom: "28px" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#15803d" }} />
              <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: 0 }}>Super Administrators</h2>
            </div>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>{filteredSuperAdmins.length} Super Admins</span>
          </div>

          {loading ? (
            <div style={{ padding: "40px", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", color: "#15803d" }}>
              <Loader className="animate-spin" size={24} />
              <span>Loading super admins...</span>
            </div>
          ) : (
            <div className="premium-table-wrapper" style={{ overflowX: "auto" }}>
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Administrator</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuperAdmins.map((admin) => {
                    const fullName = `${admin.first_name || ""} ${admin.last_name || ""}`.trim() || "Super Admin";
                    const initials = getInitials(admin);
                    const avatarStyle = getAvatarStyle(fullName);
                    const isSelf = pb.authStore.model?.id === admin.id;

                    return (
                      <tr key={admin.id}>
                        <td>
                          <div className="premium-user-cell">
                            <div className="premium-avatar" style={{ background: avatarStyle.bg, color: avatarStyle.color }}>
                              {initials}
                            </div>
                            <div className="premium-user-info">
                              <span className="premium-user-name">{fullName}</span>
                              <span className="premium-user-sub">{admin.email || "Primary Super Admin"}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "12px", backgroundColor: "#fef3c7", color: "#92400e", fontSize: "12px", fontWeight: "700" }}>
                            <Shield size={13} /> Super Admin
                          </span>
                        </td>
                        <td>
                          <span className={`premium-status-pill ${admin.suspended ? "status-pill-suspended" : "status-pill-active"}`}>
                            {admin.suspended ? "Suspended" : "Active"}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {!isSelf ? (
                            <button
                              type="button"
                              className="premium-action-btn"
                              style={{
                                color: admin.suspended ? "#15803d" : "#ef4444",
                                borderColor: admin.suspended ? "#bbf7d0" : "#fecaca",
                                backgroundColor: admin.suspended ? "#f0fdf4" : "#fef2f2",
                              }}
                              onClick={() => handleToggleSuspend(admin, "super_admins")}
                            >
                              {admin.suspended ? "Unsuspend" : "Suspend"}
                            </button>
                          ) : (
                            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600" }}>Current Account</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSuperAdmins.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: "center", padding: "28px", color: "#64748b" }}>
                        No super administrators found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Standard Admins Card */}
        <div className="premium-table-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#3b82f6" }} />
              <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: 0 }}>Standard Administrators</h2>
            </div>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>{filteredAdmins.length} Admins</span>
          </div>

          {loading ? (
            <div style={{ padding: "40px", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", color: "#15803d" }}>
              <Loader className="animate-spin" size={24} />
              <span>Loading administrators...</span>
            </div>
          ) : (
            <div className="premium-table-wrapper" style={{ overflowX: "auto" }}>
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Administrator</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdmins.map((admin) => {
                    const fullName = `${admin.first_name || ""} ${admin.last_name || ""}`.trim() || "Administrator";
                    const initials = getInitials(admin);
                    const avatarStyle = getAvatarStyle(fullName);

                    return (
                      <tr key={admin.id}>
                        <td>
                          <div className="premium-user-cell">
                            <div className="premium-avatar" style={{ background: avatarStyle.bg, color: avatarStyle.color }}>
                              {initials}
                            </div>
                            <div className="premium-user-info">
                              <span className="premium-user-name">{fullName}</span>
                              <span className="premium-user-sub">{admin.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "12px", backgroundColor: "#eff6ff", color: "#1d4ed8", fontSize: "12px", fontWeight: "700" }}>
                            <ShieldCheck size={13} /> Admin
                          </span>
                        </td>
                        <td>
                          <span className={`premium-status-pill ${admin.suspended ? "status-pill-suspended" : "status-pill-active"}`}>
                            {admin.suspended ? "Suspended" : "Active"}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "inline-flex", gap: "8px" }}>
                            <button
                              type="button"
                              className="premium-action-btn"
                              onClick={() => handlePromote(admin)}
                              style={{ color: "#d97706", borderColor: "#fde68a", backgroundColor: "#fffbeb" }}
                            >
                              Promote to Super
                            </button>
                            <button
                              type="button"
                              className="premium-action-btn"
                              style={{
                                color: admin.suspended ? "#15803d" : "#ef4444",
                                borderColor: admin.suspended ? "#bbf7d0" : "#fecaca",
                                backgroundColor: admin.suspended ? "#f0fdf4" : "#fef2f2",
                              }}
                              onClick={() => handleToggleSuspend(admin, "admins")}
                            >
                              {admin.suspended ? "Unsuspend" : "Suspend"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAdmins.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: "center", padding: "28px", color: "#64748b" }}>
                        No standard administrators found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create New Admin Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "480px",
              padding: "28px 24px",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", color: "#15803d" }}>
                  <UserPlus size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>Create New Admin</h3>
              </div>
              <button
                type="button"
                className="animatedCloseButton"
                onClick={() => setShowCreateModal(false)}
                style={{ width: "32px", height: "32px", borderRadius: "50%", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin}>
              <div style={{ display: "flex", gap: "12px", marginBottom: "14px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>First Name</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Last Name</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: "20px", fontSize: "12.5px", color: "#166534" }}>
                Temporary initial password will automatically be set to <strong>12345678</strong>.
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  style={{ padding: "9px 18px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #15803d 0%, #166534 100%)", color: "#fff", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
                >
                  {isCreating ? "Creating..." : "Confirm & Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
