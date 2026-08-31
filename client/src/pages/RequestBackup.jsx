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
  MapPin,
  X,
  Loader,
  ShieldCheck,
  RotateCcw,
  ExternalLink,
  Send,
  Activity,
  Users,
} from "lucide-react";
import CustomIcon from "../components/CustomIcon";
import assistantSvg from "../assets/icons/assistant.svg";

const matchesDepartment = (respDept = "", requestedDept = "") => {
  if (!requestedDept || requestedDept.toUpperCase() === "ANY" || requestedDept.toUpperCase() === "ALL") {
    return true;
  }
  const rd = (respDept || "").toLowerCase().trim();
  const req = (requestedDept || "").toLowerCase().trim();
  if (rd === req) return true;
  if ((rd.includes("fire") || rd === "bfp") && (req.includes("fire") || req === "bfp")) return true;
  if ((rd.includes("police") || rd === "pnp") && (req.includes("police") || req === "pnp")) return true;
  if (
    (rd.includes("ambulance") || rd.includes("ems") || rd.includes("medical")) &&
    (req.includes("ambulance") || req.includes("ems") || req.includes("medical"))
  ) return true;
  if (rd.includes("mdrrmo") && req.includes("mdrrmo")) return true;
  return false;
};

export default function RequestBackup() {
  const { isDark } = useTheme();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableResponders, setAvailableResponders] = useState([]);
  const [selectedResponderIds, setSelectedResponderIds] = useState({});
  const [processingId, setProcessingId] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);

  const { confirm, alert: showAlert } = useMessageBox();

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const records = await pb.collection("backup_requests").getFullList({
        filter: 'dispatch_status = "pending"',
        sort: "-created",
        expand: "requester_id,incident_id,sos_id",
        requestKey: null,
      });
      setBackups(records);
    } catch (err) {
      if (!err.isAbort) console.error("Fetch backups error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableResponders = async () => {
    try {
      const responders = await pb.collection("responder_accounts").getFullList({
        sort: "department, first_name",
        requestKey: null,
      });
      setAvailableResponders(responders.filter((r) => r.is_available === true && !r.is_suspended));
    } catch (err) {
      if (!err.isAbort) console.error("Fetch responders error:", err);
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchAvailableResponders();

    let unsubscribeBackups;
    let unsubscribeResponders;

    const setupSubscriptions = async () => {
      unsubscribeBackups = await pb.collection("backup_requests").subscribe("*", () => {
        fetchBackups();
      });
      unsubscribeResponders = await pb.collection("responder_accounts").subscribe("*", () => {
        fetchAvailableResponders();
      });
    };

    setupSubscriptions();

    return () => {
      if (unsubscribeBackups) unsubscribeBackups();
      if (unsubscribeResponders) unsubscribeResponders();
    };
  }, []);

  const handleDispatch = async (backupId) => {
    const responderId = selectedResponderIds[backupId];
    if (!responderId) {
      showAlert("Please select a responder unit before dispatching backup.", { title: "Unit Required" });
      return;
    }

    const responder = availableResponders.find((r) => r.id === responderId);

    const isConfirmed = await confirm(
      `Dispatch ${responder?.unit_name || `${responder?.first_name} ${responder?.last_name}`} (${responder?.department}) as backup?`,
      {
        title: "Confirm Backup Dispatch",
        primaryLabel: "Dispatch Backup",
        secondaryLabel: "Cancel",
      }
    );

    if (!isConfirmed) return;

    setProcessingId(backupId);
    let createdDispatchId = null;
    try {
      const targetBackup = backups.find((b) => b.id === backupId);

      // 1. Create dispatch record so responder app receives the incident assignment
      try {
        const dispatchPayload = {
          responder_id: responderId,
          department: responder?.department || "MDRRMO",
          status: "pending",
        };
        if (targetBackup?.incident_id) {
          dispatchPayload.incident_id = targetBackup.incident_id;
        }
        if (targetBackup?.sos_id) {
          dispatchPayload.sos_id = targetBackup.sos_id;
        }
        const dispatchRecord = await pb.collection("dispatches").create(dispatchPayload);
        createdDispatchId = dispatchRecord.id;
      } catch (dispatchErr) {
        console.warn("Could not create dispatch entry for backup:", dispatchErr);
      }

      // 2. Update backup request with assigned responder and dispatch_id
      const updateData = {
        assigned_responder: responderId,
        dispatch_status: "dispatched",
      };
      if (createdDispatchId) {
        updateData.dispatch_id = createdDispatchId;
      }
      await pb.collection("backup_requests").update(backupId, updateData);

      // 3. Mark responder unavailable
      await pb.collection("responder_accounts").update(responderId, {
        is_available: false,
      });

      const unitName = responder?.unit_name || `${responder?.first_name || ""} ${responder?.last_name || ""}`.trim() || responder?.name || "Backup Unit";
      const requesterName = targetBackup?.expand?.requester_id
        ? `${targetBackup.expand.requester_id.first_name || ""} ${targetBackup.expand.requester_id.last_name || ""}`.trim()
        : "Field Responder";

      const currentAdmin = pb.authStore.model;
      const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

      addAuditLog({
        action: "BACKUP_RESPONDER_DISPATCHED",
        target: `Backup Request #${backupId}`,
        details: `Administrator ${adminName} dispatched backup unit ${unitName} (${responder?.department || "Emergency Unit"}) in response to reinforcement request from ${requesterName}.`,
        actor: adminName,
      });

      showAlert("Backup unit successfully dispatched.", { title: "Backup Dispatched" });
      setBackups((prev) => prev.filter((b) => b.id !== backupId));
    } catch (err) {
      console.error("Dispatch error:", err);
      if (createdDispatchId) {
        await pb.collection("dispatches").delete(createdDispatchId).catch(() => {});
      }
      showAlert("Failed to dispatch backup unit: " + (err.message || "Unknown error"), { title: "Error" });
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
              <span className="urgent-status-pulse" style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block" }} />
              <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: "800", color: isDark ? "#f8fafc" : "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
                Backup Requests
              </h1>
            </div>
            <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: "14px" }}>
              Review backup and reinforcement calls from on-scene responders and assign additional units.
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
                  ? (isDark ? "rgba(239, 68, 68, 0.18)" : "#fef2f2")
                  : (isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4"),
                border: backups.length > 0
                  ? (isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fecaca")
                  : (isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0"),
                color: backups.length > 0
                  ? (isDark ? "#f87171" : "#b91c1c")
                  : (isDark ? "#4ade80" : "#15803d"),
                fontSize: "13px",
                fontWeight: "800",
              }}
            >
              <ShieldAlert size={14} />
              <span>{backups.length} Backup Requests</span>
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
              No Pending Backup Requests
            </h3>
            <p style={{ margin: 0, fontSize: "14.5px", color: isDark ? "#94a3b8" : "#64748b", maxWidth: "440px", lineHeight: "1.5" }}>
              All field personnel are operating with adequate reinforcement. Incoming distress requests will appear live.
            </p>
          </div>
        )}

        {loading && backups.length === 0 && (
          <div style={{ padding: "80px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", color: isDark ? "#4ade80" : "#15803d" }}>
            <Loader className="animate-spin" size={32} />
            <span style={{ fontWeight: "700", fontSize: "15px" }}>Loading backup requests...</span>
          </div>
        )}

        {/* Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: "22px" }}>
          {backups.map((backup) => {
            const requester = backup.expand?.requester_id;
            const reqName = requester ? requester.unit_name || `${requester.first_name} ${requester.last_name}` : "Field Responder";
            const isSelected = !!selectedResponderIds[backup.id];

            return (
              <div
                key={backup.id}
                className="premium-table-card"
                style={{
                  padding: "22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  borderTop: "4px solid #f59e0b",
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
                        backgroundColor: isDark ? "rgba(245, 158, 11, 0.2)" : "#fef3c7",
                        color: isDark ? "#fbbf24" : "#b45309",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "800",
                        flexShrink: 0,
                      }}
                    >
                      <CustomIcon icon={assistantSvg} size={18} color={isDark ? "#fbbf24" : "#b45309"} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "15.5px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a" }}>
                        {reqName}
                      </h3>
                      <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={12} /> {new Date(backup.created).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "800",
                      padding: "3px 8px",
                      borderRadius: "8px",
                      backgroundColor: isDark ? "rgba(239, 68, 68, 0.18)" : "#fef2f2",
                      color: isDark ? "#f87171" : "#b91c1c",
                      border: isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fecaca",
                      textTransform: "uppercase",
                    }}
                  >
                    {backup.department || "ANY"} BACKUP
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
                    <strong style={{ color: isDark ? "#f8fafc" : "#0f172a", display: "block", fontSize: "11.5px", textTransform: "uppercase", marginBottom: "3px" }}>Field Reason:</strong>
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
                      <MapPin size={13} /> GPS: {requester.latitude.toFixed(4)}, {requester.longitude.toFixed(4)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedMap({ lat: requester.latitude, lng: requester.longitude, address: `Backup Request (${requester.latitude.toFixed(4)}, ${requester.longitude.toFixed(4)})` })}
                      style={{ background: "none", border: "none", color: isDark ? "#4ade80" : "#15803d", fontWeight: "800", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px" }}
                    >
                      <ExternalLink size={11} /> View Map
                    </button>
                  </div>
                )}

                {/* Assign Unit Selector */}
                <div style={{ borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", paddingTop: "12px" }}>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", textTransform: "uppercase", marginBottom: "6px" }}>
                    Assign Available Responder Unit:
                  </label>

                  <div style={{
                    maxHeight: "140px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                    padding: "6px",
                    borderRadius: "8px",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                    marginBottom: "12px"
                  }}>
                    {availableResponders.length === 0 ? (
                      <span style={{ fontSize: "11.5px", color: isDark ? "#94a3b8" : "#94a3b8", textAlign: "center", padding: "8px" }}>No standby units available</span>
                    ) : (() => {
                      const matched = availableResponders.filter((r) => matchesDepartment(r.department, backup.department));
                      const displayList = matched.length > 0 ? matched : availableResponders;
                      const isFallback = matched.length === 0 && availableResponders.length > 0;

                      return (
                        <>
                          {isFallback && (
                            <span style={{ fontSize: "10.5px", color: "#eab308", padding: "2px 6px", fontWeight: "700" }}>
                              No direct {backup.department} units on standby. Showing all available responders:
                            </span>
                          )}
                          {displayList.map((r) => {
                            const isUnitSelected = selectedResponderIds[backup.id] === r.id;
                            return (
                              <label
                                key={r.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "6px 8px",
                                  borderRadius: "6px",
                                  backgroundColor: isUnitSelected
                                    ? (isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4")
                                    : (isDark ? "#172338" : "#ffffff"),
                                  border: isUnitSelected
                                    ? (isDark ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid #bbf7d0")
                                    : (isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0"),
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                <input
                                  type="radio"
                                  name={`backup-resp-${backup.id}`}
                                  checked={isUnitSelected}
                                  onChange={() => setSelectedResponderIds((prev) => ({ ...prev, [backup.id]: r.id }))}
                                  style={{ accentColor: "#15803d" }}
                                />
                                <span style={{
                                  fontWeight: isUnitSelected ? "700" : "600",
                                  color: isUnitSelected
                                    ? (isDark ? "#4ade80" : "#14532d")
                                    : (isDark ? "#cbd5e1" : "#334155")
                                }}>
                                  {r.unit_name || `${r.first_name} ${r.last_name}`} ({r.department})
                                </span>
                              </label>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDispatch(backup.id)}
                    disabled={processingId === backup.id || !isSelected}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      borderRadius: "10px",
                      border: "none",
                      background: isSelected
                        ? "linear-gradient(135deg, #15803d 0%, #166534 100%)"
                        : (isDark ? "#1e293b" : "#cbd5e1"),
                      color: isSelected ? "#ffffff" : (isDark ? "#64748b" : "#ffffff"),
                      fontSize: "13px",
                      fontWeight: "800",
                      cursor: isSelected ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      boxShadow: isSelected ? "0 4px 12px rgba(21, 128, 61, 0.25)" : "none",
                    }}
                  >
                    {processingId === backup.id ? <Loader className="animate-spin" size={15} /> : <Send size={15} />}
                    <span>{processingId === backup.id ? "Deploying..." : "Dispatch Backup Unit"}</span>
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
