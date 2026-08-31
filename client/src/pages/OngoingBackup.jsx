import React, { useState, useEffect } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { useMessageBox } from "../components/MessageBox";
import { useTheme } from "../themes/ThemeContext";
import { addAuditLog } from "../utils/auditLog";
import {
  ShieldAlert,
  User,
  Radio,
  Clock,
  CheckCircle,
  Siren,
  Truck,
  Activity,
  MapPin,
  X,
  Loader,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

export default function OngoingBackup() {
  const { isDark } = useTheme();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);

  const { confirm, alert: showAlert } = useMessageBox();

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const records = await pb.collection("backup_requests").getFullList({
        filter: 'dispatch_status != "pending" && dispatch_status != "completed" && dispatch_status != "declined"',
        sort: "-created",
        expand: "requester_id,incident_id,sos_id,assigned_responder",
      });
      setBackups(records);
    } catch (err) {
      console.error("Fetch backups error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();

    let unsubscribeBackups;

    const setupSubscriptions = async () => {
      unsubscribeBackups = await pb.collection("backup_requests").subscribe("*", () => {
        fetchBackups();
      });
    };

    setupSubscriptions();

    return () => {
      if (unsubscribeBackups) unsubscribeBackups();
    };
  }, []);

  const handleResolve = async (backupId) => {
    const isConfirmed = await confirm(
      "Mark this backup deployment as completed and return unit to standby?",
      {
        title: "Complete Backup Deployment",
        primaryLabel: "Complete Backup",
        secondaryLabel: "Cancel",
      }
    );

    if (!isConfirmed) return;

    setProcessingId(backupId);
    try {
      const backup = backups.find((b) => b.id === backupId);
      if (backup?.assigned_responder) {
        await pb.collection("responder_accounts").update(backup.assigned_responder, {
          is_available: true,
        }).catch(() => {});
      }

      if (backup?.dispatch_id) {
        await pb.collection("dispatches").update(backup.dispatch_id, {
          status: "resolved",
        }).catch(() => {});
      }

      await pb.collection("backup_requests").update(backupId, {
        dispatch_status: "completed",
      });

      const responder = backup?.expand?.assigned_responder;
      const responderName = responder?.unit_name || `${responder?.first_name || ""} ${responder?.last_name || ""}`.trim() || "Backup Unit";
      const requester = backup?.expand?.requester_id;
      const requesterName = requester ? `${requester.first_name || ""} ${requester.last_name || ""}`.trim() : "Field Unit";

      const currentAdmin = pb.authStore.model;
      const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

      addAuditLog({
        action: "BACKUP_DEPLOYMENT_COMPLETED",
        target: `Backup Request #${backupId}`,
        details: `Administrator ${adminName} completed backup deployment for ${responderName} (${responder?.department || "Emergency Unit"}) supporting ${requesterName}. Unit returned to standby.`,
        actor: adminName,
      });

      await showAlert("Backup deployment marked as completed.", { title: "Backup Completed" });
      setBackups((prev) => prev.filter((b) => b.id !== backupId));
    } catch (error) {
      console.error("Resolve error:", error);
      await showAlert("Failed to complete backup: " + (error.message || "Unknown error"), { title: "Error" });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: isDark ? "#090d16" : "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* Header */}
        <header style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span className="urgent-status-pulse" style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#f59e0b", display: "inline-block" }} />
              <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: "800", color: isDark ? "#f8fafc" : "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
                Ongoing Backup
              </h1>
            </div>
            <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: "14px" }}>
              Track dispatched backup units currently assisting on scene in Lagonglong.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "20px",
                backgroundColor: backups.length > 0
                  ? (isDark ? "rgba(245, 158, 11, 0.18)" : "#fffbeb")
                  : (isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4"),
                border: backups.length > 0
                  ? (isDark ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid #fde68a")
                  : (isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0"),
                color: backups.length > 0
                  ? (isDark ? "#fbbf24" : "#b45309")
                  : (isDark ? "#4ade80" : "#15803d"),
                fontSize: "13px",
                fontWeight: "800",
              }}
            >
              <Activity size={14} />
              <span>{backups.length} Active Deployments</span>
            </span>

            <button
              type="button"
              onClick={fetchBackups}
              disabled={loading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "10px",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                backgroundColor: isDark ? "#172338" : "#ffffff",
                color: isDark ? "#cbd5e1" : "#475569",
                fontSize: "12.5px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Empty State */}
        {!loading && backups.length === 0 && (
          <div
            className="premium-table-card"
            style={{
              padding: "70px 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: isDark ? "#131c2e" : "linear-gradient(180deg, #ffffff 0%, #f6faf7 100%)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "24px",
                backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
                border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isDark ? "#4ade80" : "#15803d",
                marginBottom: "18px",
                boxShadow: isDark ? "0 10px 25px -5px rgba(0, 0, 0, 0.4)" : "0 10px 25px -5px rgba(21, 128, 61, 0.15)",
              }}
            >
              <CheckCircle size={36} />
            </div>
            <h3 style={{ color: isDark ? "#f8fafc" : "#0f172a", fontSize: "20px", fontWeight: "800", margin: "0 0 8px 0" }}>
              No Active Backup Operations
            </h3>
            <p style={{ margin: 0, fontSize: "14.5px", color: isDark ? "#94a3b8" : "#64748b", maxWidth: "440px", lineHeight: "1.5" }}>
              All secondary backup dispatches have been resolved and units returned to standby.
            </p>
          </div>
        )}

        {loading && backups.length === 0 && (
          <div style={{ padding: "80px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", color: isDark ? "#4ade80" : "#15803d" }}>
            <Loader className="animate-spin" size={32} />
            <span style={{ fontWeight: "700", fontSize: "15px" }}>Loading active backup deployments...</span>
          </div>
        )}

        {/* Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: "22px" }}>
          {backups.map((backup) => {
            const requester = backup.expand?.requester_id;
            const responder = backup.expand?.assigned_responder;
            const reqName = requester ? requester.unit_name || `${requester.first_name} ${requester.last_name}` : "Field Responder";
            const resName = responder ? responder.unit_name || `${responder.first_name} ${responder.last_name}` : "Assigned Unit";

            return (
              <div
                key={backup.id}
                className="premium-table-card"
                style={{
                  padding: "22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  borderTop: "4px solid #15803d",
                  backgroundColor: isDark ? "#131c2e" : "#ffffff",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
                        color: isDark ? "#4ade80" : "#15803d",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "800",
                        flexShrink: 0,
                      }}
                    >
                      <Truck size={18} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "15.5px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a" }}>
                        {resName}
                      </h3>
                      <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={12} /> Deployed to support {reqName}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "800",
                      padding: "3px 8px",
                      borderRadius: "8px",
                      backgroundColor: isDark ? "rgba(245, 158, 11, 0.18)" : "#fff7ed",
                      color: isDark ? "#fbbf24" : "#c2410c",
                      border: isDark ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid #fed7aa",
                      textTransform: "uppercase",
                    }}
                  >
                    {backup.dispatch_status?.replace("_", " ") || "EN ROUTE"}
                  </span>
                </div>

                {/* Reason */}
                {backup.reason && (
                  <div style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    backgroundColor: isDark ? "#172338" : "#f8fafc",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                    fontSize: "13px",
                    color: isDark ? "#cbd5e1" : "#334155",
                    lineHeight: "1.4"
                  }}>
                    <strong style={{ color: isDark ? "#f8fafc" : "#0f172a", display: "block", fontSize: "11.5px", textTransform: "uppercase", marginBottom: "3px" }}>Dispatch Reason:</strong>
                    {backup.reason}
                  </div>
                )}

                {/* Location */}
                {requester?.latitude != null && requester?.longitude != null && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: isDark ? "rgba(34, 197, 94, 0.12)" : "#f0fdf4",
                    border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #bbf7d0",
                    fontSize: "12px"
                  }}>
                    <span style={{ color: isDark ? "#4ade80" : "#15803d", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                      <MapPin size={13} /> Target: {requester.latitude.toFixed(4)}, {requester.longitude.toFixed(4)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedMap({ lat: requester.latitude, lng: requester.longitude, address: `Backup Location (${requester.latitude.toFixed(4)}, ${requester.longitude.toFixed(4)})` })}
                      style={{ background: "none", border: "none", color: isDark ? "#4ade80" : "#15803d", fontWeight: "800", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px" }}
                    >
                      <ExternalLink size={11} /> View Map
                    </button>
                  </div>
                )}

                {/* Complete Action Button */}
                <div style={{ marginTop: "auto", borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", paddingTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => handleResolve(backup.id)}
                    disabled={processingId === backup.id}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      borderRadius: "10px",
                      border: "none",
                      background: "linear-gradient(135deg, #15803d 0%, #166534 100%)",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: "800",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      boxShadow: "0 4px 12px rgba(21, 128, 61, 0.25)",
                    }}
                  >
                    {processingId === backup.id ? <Loader className="animate-spin" size={15} /> : <CheckCircle2 size={16} />}
                    <span>{processingId === backup.id ? "Completing..." : "Complete Backup Deployment"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* MAP MODAL */}
      {selectedMap && (
        <div
          className="lightboxModalBackdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(3, 7, 18, 0.82)",
            backdropFilter: "blur(10px)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "24px",
          }}
          onClick={() => setSelectedMap(null)}
        >
          <div
            className="lightboxModalCard"
            style={{
              backgroundColor: isDark ? "#131c2e" : "#ffffff",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "680px",
              overflow: "hidden",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
              boxShadow: isDark ? "0 25px 60px -15px rgba(0, 0, 0, 0.8)" : "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9"
            }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin size={17} color={isDark ? "#4ade80" : "#15803d"} /> {selectedMap.address}
              </h3>
              <button
                type="button"
                className="animatedCloseButton"
                onClick={() => setSelectedMap(null)}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                  backgroundColor: isDark ? "#1e293b" : "#fff",
                  color: isDark ? "#cbd5e1" : "#64748b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <X size={16} />
              </button>
            </div>
            <iframe
              title="Full Map"
              width="100%"
              height="420px"
              frameBorder="0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${selectedMap.lat},${selectedMap.lng}&z=17&t=k&output=embed`}
              style={{ border: 0 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
