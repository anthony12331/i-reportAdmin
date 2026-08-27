import React, { useState, useEffect } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { useMessageBox } from "../components/MessageBox";
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

export default function RequestBackup() {
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
      });
      setBackups(records);
    } catch (err) {
      console.error("Fetch backups error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableResponders = async () => {
    try {
      const responders = await pb.collection("responder_accounts").getFullList({
        filter: "is_available = true",
        sort: "department, first_name",
      });
      setAvailableResponders(responders);
    } catch (err) {
      console.error("Fetch responders error:", err);
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
    try {
      await pb.collection("backup_requests").update(backupId, {
        assigned_responder: responderId,
        dispatch_status: "dispatched",
      });

      await pb.collection("responder_accounts").update(responderId, {
        is_available: false,
      });

      showAlert("Backup unit successfully dispatched.", { title: "Backup Dispatched" });
      setBackups((prev) => prev.filter((b) => b.id !== backupId));
    } catch (err) {
      console.error("Dispatch error:", err);
      showAlert("Failed to dispatch backup unit: " + (err.message || "Unknown error"), { title: "Error" });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* Header */}
        <header style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span className="urgent-status-pulse" style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block" }} />
              <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: "800", color: "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
                Pending Backup Requests
              </h1>
            </div>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
              Field responder reinforcement requests requiring rapid secondary unit dispatch.
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
                backgroundColor: backups.length > 0 ? "#fef2f2" : "#f0fdf4",
                border: backups.length > 0 ? "1px solid #fecaca" : "1px solid #bbf7d0",
                color: backups.length > 0 ? "#b91c1c" : "#15803d",
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
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                color: "#475569",
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
              background: "linear-gradient(180deg, #ffffff 0%, #f6faf7 100%)",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "24px",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#15803d",
                marginBottom: "18px",
                boxShadow: "0 10px 25px -5px rgba(21, 128, 61, 0.15)",
              }}
            >
              <CheckCircle size={36} />
            </div>
            <h3 style={{ color: "#0f172a", fontSize: "20px", fontWeight: "800", margin: "0 0 8px 0" }}>
              No Pending Backup Requests
            </h3>
            <p style={{ margin: 0, fontSize: "14.5px", color: "#64748b", maxWidth: "440px", lineHeight: "1.5" }}>
              All field personnel are operating with adequate reinforcement. Incoming distress requests will appear live.
            </p>
          </div>
        )}

        {loading && backups.length === 0 && (
          <div style={{ padding: "80px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", color: "#15803d" }}>
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
                        backgroundColor: "#fef3c7",
                        color: "#b45309",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "800",
                        flexShrink: 0,
                      }}
                    >
                      <Siren size={18} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "15.5px", fontWeight: "800", color: "#0f172a" }}>
                        {reqName}
                      </h3>
                      <span style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
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
                      backgroundColor: "#fef2f2",
                      color: "#b91c1c",
                      border: "1px solid #fecaca",
                      textTransform: "uppercase",
                    }}
                  >
                    {backup.department || "ANY"} BACKUP
                  </span>
                </div>

                {/* Reason */}
                {backup.reason && (
                  <div style={{ padding: "10px 12px", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "13px", color: "#334155", lineHeight: "1.4" }}>
                    <strong style={{ color: "#0f172a", display: "block", fontSize: "11.5px", textTransform: "uppercase", marginBottom: "3px" }}>Field Reason:</strong>
                    {backup.reason}
                  </div>
                )}

                {/* Location */}
                {requester?.latitude != null && requester?.longitude != null && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: "8px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: "12px" }}>
                    <span style={{ color: "#15803d", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                      <MapPin size={13} /> GPS: {requester.latitude.toFixed(4)}, {requester.longitude.toFixed(4)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedMap({ lat: requester.latitude, lng: requester.longitude, address: `Backup Request (${requester.latitude.toFixed(4)}, ${requester.longitude.toFixed(4)})` })}
                      style={{ background: "none", border: "none", color: "#15803d", fontWeight: "800", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px" }}
                    >
                      <ExternalLink size={11} /> View Map
                    </button>
                  </div>
                )}

                {/* Assign Unit Selector */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: "800", color: "#0f172a", textTransform: "uppercase", marginBottom: "6px" }}>
                    Assign Available Responder Unit:
                  </label>

                  <div style={{ maxHeight: "110px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", backgroundColor: "#f8fafc", padding: "6px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "12px" }}>
                    {availableResponders.length === 0 ? (
                      <span style={{ fontSize: "11.5px", color: "#94a3b8", textAlign: "center", padding: "4px" }}>No standby units available</span>
                    ) : (
                      availableResponders
                        .filter((r) => !backup.department || r.department === backup.department || backup.department === "ANY")
                        .map((r) => {
                          const isUnitSelected = selectedResponderIds[backup.id] === r.id;
                          return (
                            <label
                              key={r.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "5px 8px",
                                borderRadius: "6px",
                                backgroundColor: isUnitSelected ? "#f0fdf4" : "#ffffff",
                                border: isUnitSelected ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                            >
                              <input
                                type="radio"
                                name={`backup-resp-${backup.id}`}
                                checked={isUnitSelected}
                                onChange={() => setSelectedResponderIds((prev) => ({ ...prev, [backup.id]: r.id }))}
                              />
                              <span style={{ fontWeight: isUnitSelected ? "700" : "600", color: isUnitSelected ? "#14532d" : "#334155" }}>
                                {r.unit_name || `${r.first_name} ${r.last_name}`} ({r.department})
                              </span>
                            </label>
                          );
                        })
                    )}
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
                      background: isSelected ? "linear-gradient(135deg, #15803d 0%, #166534 100%)" : "#cbd5e1",
                      color: "#ffffff",
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
            backgroundColor: "rgba(15, 23, 42, 0.75)",
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
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "680px",
              overflow: "hidden",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin size={17} color="#15803d" /> {selectedMap.address}
              </h3>
              <button
                type="button"
                className="animatedCloseButton"
                onClick={() => setSelectedMap(null)}
                style={{ width: "32px", height: "32px", borderRadius: "50%", border: "1px solid #e2e8f0", backgroundColor: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
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
