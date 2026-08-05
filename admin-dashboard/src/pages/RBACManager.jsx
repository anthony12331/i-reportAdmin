import React, { useState, useEffect, useCallback } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { AVAILABLE_MODULES, rbacStyles } from "../themes/rbacStyles";
import {
  UserCheck,
  Save,
  Loader,
  Lock,
  Mail,
  Layers,
  CheckCircle2,
  XCircle,
} from "lucide-react";

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
    <div style={rbacStyles.shell}>
      <Sidebar />

      <main style={rbacStyles.main}>
        {/* Header */}
        <header style={rbacStyles.header}>
          <div>
            <div style={rbacStyles.titleWrapper}>
              <div style={rbacStyles.titleDot} />
              <h1 style={rbacStyles.titleText}>
                ROLE-BASED ACCESS CONTROL (RBAC)
              </h1>
            </div>
            <p style={rbacStyles.subtitle}>
              Configure granular administrative privileges and module access rules
            </p>
          </div>
        </header>

        {/* Main Content Layout */}
        <div style={rbacStyles.layoutGrid}>
          {/* Admin List Panel */}
          <div style={rbacStyles.leftPanel}>
            <div style={rbacStyles.leftPanelHeader}>
              <UserCheck size={18} color="#38bdf8" />
              <h2 style={rbacStyles.leftPanelTitle}>
                Admin Accounts ({admins.length})
              </h2>
            </div>

            {fetching ? (
              <div style={rbacStyles.loaderWrapper}>
                <Loader className="animate-spin" size={24} color="#38bdf8" />
              </div>
            ) : admins.length === 0 ? (
              <div style={rbacStyles.emptyListText}>
                No regular admin accounts found.
              </div>
            ) : (
              <div style={rbacStyles.adminListContainer}>
                {admins.map((admin) => {
                  const isSelected = selectedAdmin?.id === admin.id;
                  const activePermCount = (admin.permissions || []).length;

                  return (
                    <button
                      key={admin.id}
                      onClick={() => setSelectedAdmin(admin)}
                      style={rbacStyles.adminCardButton(isSelected)}
                    >
                      <div style={rbacStyles.adminCardName(isSelected)}>
                        {admin.first_name || admin.last_name
                          ? `${admin.first_name || ""} ${admin.last_name || ""}`.trim()
                          : "Administrator"}
                      </div>

                      <div style={rbacStyles.adminCardEmail}>
                        <Mail size={12} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {admin.email}
                        </span>
                      </div>

                      <div style={rbacStyles.adminCardFooter}>
                        <span style={rbacStyles.positionText}>
                          {admin.position || "Regular Admin"}
                        </span>
                        <span style={rbacStyles.moduleCountBadge(isSelected)}>
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
          <div style={rbacStyles.rightPanel}>
            {selectedAdmin ? (
              <div style={rbacStyles.activeAdminCard}>
                {/* Admin Header Detail */}
                <div style={rbacStyles.activeAdminHeader}>
                  <div>
                    <span style={rbacStyles.targetAccountLabel}>
                      Target Account
                    </span>
                    <h2 style={rbacStyles.activeAdminName}>
                      {selectedAdmin.first_name || selectedAdmin.last_name
                        ? `${selectedAdmin.first_name || ""} ${selectedAdmin.last_name || ""}`
                        : "Administrator"}
                    </h2>
                    <p style={rbacStyles.activeAdminSubtext}>
                      {selectedAdmin.email} • ID: <code style={{ color: "#cbd5e1" }}>{selectedAdmin.id}</code>
                    </p>
                  </div>

                  <div style={rbacStyles.actionBtnGroup}>
                    <button onClick={handleSelectAll} style={rbacStyles.selectAllBtn}>
                      <CheckCircle2 size={14} /> Select All
                    </button>
                    <button onClick={handleClearAll} style={rbacStyles.clearAllBtn}>
                      <XCircle size={14} /> Clear All
                    </button>
                  </div>
                </div>

                {/* Modules Checkbox Grid */}
                <h3 style={rbacStyles.moduleSectionTitle}>
                  <Layers size={16} color="#38bdf8" /> Authorizable Modules
                </h3>

                <div style={rbacStyles.moduleListContainer}>
                  {AVAILABLE_MODULES.map((module) => {
                    const hasAccess = (selectedAdmin.permissions || []).includes(module.id);

                    return (
                      <div
                        key={module.id}
                        onClick={() => handleTogglePermission(module.id)}
                        style={rbacStyles.moduleCard(hasAccess)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          <input
                            type="checkbox"
                            checked={hasAccess}
                            onChange={() => {}}
                            style={rbacStyles.checkboxInput}
                          />
                          <div>
                            <div style={rbacStyles.moduleLabel}>
                              {module.label}
                            </div>
                            <div style={rbacStyles.moduleDesc}>
                              {module.description}
                            </div>
                          </div>
                        </div>

                        <span style={rbacStyles.permissionBadge(hasAccess)}>
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
                  style={rbacStyles.saveRulesBtn(loading)}
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
              <div style={rbacStyles.unselectedPlaceholder}>
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


