import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { useMessageBox } from "../components/MessageBox";
import { useTheme } from "../themes/ThemeContext";
import { addAuditLog } from "../utils/auditLog";
import { getReadableAddress } from "../utils/utils";
import { formatWaitTime } from "../utils/timeUtils";
import CustomDropdown from "../components/CustomDropdown";
import DepartmentBadge from "../components/DepartmentBadge";
import PremiumSearchBar from "../components/PremiumSearchBar";
import CustomIcon from "../components/CustomIcon";
import assistantSvg from "../assets/icons/assistant.svg";
import {
  ShieldAlert,
  User,
  Radio,
  Clock,
  CheckCircle,
  CheckCircle2,
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
  Phone,
  Trash2,
  Maximize2,
  Eye,
  AlertTriangle,
  FileText,
  Check,
  Search,
  SlidersHorizontal,
} from "lucide-react";

export default function RequestBackup() {
  const { isDark } = useTheme();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableResponders, setAvailableResponders] = useState([]);
  const [selectedResponderIds, setSelectedResponderIds] = useState({});
  const [departmentFilters, setDepartmentFilters] = useState({});
  const [processingId, setProcessingId] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [addresses, setAddresses] = useState({});
  const [, setClockTick] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("ALL");

  const { confirm, alert: showAlert } = useMessageBox();
  const fetchedAddressIds = useRef(new Set());

  const resolveAddresses = useCallback(async (records) => {
    const pending = records.filter((r) => {
      const lat = r.expand?.requester_id?.latitude || r.latitude;
      const lng = r.expand?.requester_id?.longitude || r.longitude;
      return lat != null && lng != null && !fetchedAddressIds.current.has(r.id);
    });

    if (pending.length === 0) return;
    pending.forEach((r) => fetchedAddressIds.current.add(r.id));

    const resolved = await Promise.all(
      pending.map(async (record) => {
        const lat = record.expand?.requester_id?.latitude || record.latitude;
        const lng = record.expand?.requester_id?.longitude || record.longitude;
        try {
          const addr = await getReadableAddress(lat, lng);
          return [record.id, addr];
        } catch {
          return [record.id, `GPS (${lat?.toFixed(4)}, ${lng?.toFixed(4)})`];
        }
      })
    );

    setAddresses((prev) => ({ ...prev, ...Object.fromEntries(resolved) }));
  }, []);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const records = await pb.collection("backup_requests").getFullList({
        filter: 'dispatch_status = "pending"',
        sort: "-created",
        expand: "requester_id,incident_id,sos_id",
        requestKey: null,
      });
      setBackups(records);
      resolveAddresses(records);
    } catch (err) {
      if (!err.isAbort) console.error("Fetch backups error:", err);
    } finally {
      setLoading(false);
    }
  }, [resolveAddresses]);

  const fetchAvailableResponders = useCallback(async () => {
    try {
      const responders = await pb.collection("responder_accounts").getFullList({
        sort: "department, first_name",
        requestKey: null,
      });
      setAvailableResponders(responders.filter((r) => r.is_available === true && !r.is_suspended));
    } catch (err) {
      if (!err.isAbort) console.error("Fetch responders error:", err);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
    fetchAvailableResponders();

    let unsubscribeBackups;
    let unsubscribeResponders;

    const setupSubscriptions = async () => {
      let timeout1, timeout2;
      unsubscribeBackups = await pb.collection("backup_requests").subscribe("*", (e) => {
        clearTimeout(timeout1);
        timeout1 = setTimeout(() => fetchBackups(), 800);
      });
      unsubscribeResponders = await pb.collection("responder_accounts").subscribe("*", () => {
        clearTimeout(timeout2);
        timeout2 = setTimeout(() => fetchAvailableResponders(), 800);
      });
    };

    setupSubscriptions();
    const timer = setInterval(() => setClockTick((t) => t + 1), 60000);

    return () => {
      clearInterval(timer);
      if (unsubscribeBackups) unsubscribeBackups();
      if (unsubscribeResponders) unsubscribeResponders();
    };
  }, [fetchBackups, fetchAvailableResponders]);

  const filteredBackups = useMemo(() => {
    return backups.filter((b) => {
      const req = b.expand?.requester_id;
      const unitName = req?.unit_name || `${req?.first_name || ""} ${req?.last_name || ""}`;
      const searchTarget = `${unitName} ${b.department || ""} ${b.reason || ""} ${addresses[b.id] || ""}`.toLowerCase();

      if (searchTerm && !searchTarget.includes(searchTerm.toLowerCase())) return false;
      if (selectedDeptFilter !== "ALL" && (b.department || "").toUpperCase() !== selectedDeptFilter.toUpperCase()) return false;

      return true;
    });
  }, [backups, searchTerm, selectedDeptFilter, addresses]);

  const handleDispatch = async (backupId) => {
    const selectedIds = selectedResponderIds[backupId] || [];
    if (selectedIds.length === 0) {
      showAlert("Please select at least one responder unit before dispatching backup.", { title: "Unit Required" });
      return;
    }

    const respondersToDispatch = selectedIds.map((id) => availableResponders.find((r) => r.id === id)).filter(Boolean);
    const unitNames = respondersToDispatch
      .map((r) => r.unit_name || `${r.first_name} ${r.last_name}`)
      .join(", ");

    const isConfirmed = await confirm(
      `Dispatch ${respondersToDispatch.length} backup unit(s) [${unitNames}] to reinforce on-scene team?`,
      {
        title: "Confirm Backup Dispatch",
        primaryLabel: `Dispatch (${respondersToDispatch.length})`,
        secondaryLabel: "Cancel",
      }
    );

    if (!isConfirmed) return;

    setProcessingId(backupId);
    let createdDispatchIds = [];
    let reservedResponders = [];

    try {
      const targetBackup = backups.find((b) => b.id === backupId);

      for (const responder of respondersToDispatch) {
        await pb.collection("responder_accounts").update(responder.id, {
          is_available: false,
        });
        reservedResponders.push(responder);

        const dispatchPayload = {
          responder_id: responder.id,
          department: responder.department || targetBackup.department || "MDRRMO",
          status: "pending",
        };
        if (targetBackup?.incident_id) {
          dispatchPayload.incident_id = targetBackup.incident_id;
        }
        if (targetBackup?.sos_id) {
          dispatchPayload.sos_id = targetBackup.sos_id;
        }
        const dispatchRecord = await pb.collection("dispatches").create(dispatchPayload);
        createdDispatchIds.push(dispatchRecord.id);
      }

      // Update backup request
      const updateData = {
        assigned_responder: selectedIds[0], // primary
        dispatch_status: "dispatched",
      };
      if (createdDispatchIds.length > 0) {
        updateData.dispatch_id = createdDispatchIds[0];
      }
      await pb.collection("backup_requests").update(backupId, updateData);

      const requesterName = targetBackup?.expand?.requester_id
        ? `${targetBackup.expand.requester_id.first_name || ""} ${targetBackup.expand.requester_id.last_name || ""}`.trim()
        : "Field Responder";

      const currentAdmin = pb.authStore.model;
      const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

      addAuditLog({
        action: "BACKUP_RESPONDER_DISPATCHED",
        target: `Backup Request #${backupId}`,
        details: `Administrator ${adminName} dispatched ${respondersToDispatch.length} backup unit(s) [${unitNames}] to assist ${requesterName} (Department: ${targetBackup.department || "Field Team"}).`,
        actor: adminName,
      });

      showAlert(`Successfully dispatched ${respondersToDispatch.length} backup unit(s).`, { title: "Backup Dispatched" });
      setBackups((prev) => prev.filter((b) => b.id !== backupId));
      setSelectedBackup((cur) => (cur?.id === backupId ? null : cur));
      await fetchAvailableResponders();
    } catch (err) {
      console.error("Dispatch error:", err);
      for (const r of reservedResponders) {
        await pb.collection("responder_accounts").update(r.id, { is_available: true }).catch(() => {});
      }
      for (const dId of createdDispatchIds) {
        await pb.collection("dispatches").delete(dId).catch(() => {});
      }
      showAlert("Failed to dispatch backup unit: " + (err.message || "Unknown error"), { title: "Error" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (backup) => {
    const isConfirmed = await confirm("Are you sure you want to dismiss and reject this backup request?", {
      title: "Reject Backup Request",
      primaryLabel: "Reject Request",
      secondaryLabel: "Cancel",
    });

    if (!isConfirmed) return;

    setProcessingId(backup.id);
    try {
      await pb.collection("backup_requests").update(backup.id, {
        dispatch_status: "declined",
      });

      const currentAdmin = pb.authStore.model;
      const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

      addAuditLog({
        action: "BACKUP_REQUEST_DECLINED",
        target: `Backup Request #${backup.id}`,
        details: `Administrator ${adminName} declined backup request #${backup.id} (${backup.department || "General"} Backup).`,
        actor: adminName,
      });

      setBackups((prev) => prev.filter((b) => b.id !== backup.id));
      setSelectedBackup((cur) => (cur?.id === backup.id ? null : cur));
      showAlert("Backup request dismissed.", { title: "Request Declined" });
    } catch (err) {
      showAlert("Failed to dismiss request: " + (err.message || "Unknown error"), { title: "Error" });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: isDark ? "#090d16" : "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* Header */}
        <header style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span className="urgent-status-pulse" style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block" }} />
              <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: "800", color: isDark ? "#f8fafc" : "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
                Backup Requests
              </h1>
            </div>
            <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: "14px" }}>
              Review reinforcement and distress calls from on-scene responders and assign backup units.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
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
              <span>{backups.length} Backup Calls</span>
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

        {/* Toolbar Filter / Search Strip */}
        <div
          className="premium-table-card"
          style={{
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
            backgroundColor: isDark ? "#131c2e" : "#ffffff",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
          }}
        >
          <div style={{ flex: 1, minWidth: "260px" }}>
            <PremiumSearchBar
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by requesting unit, department, location, or reason..."
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b" }}>
              Filter Requested Dept:
            </span>
            {["ALL", "MDRRMO", "POLICE", "FIRE", "AMBULANCE"].map((dept) => {
              const isSelected = selectedDeptFilter === dept;
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setSelectedDeptFilter(dept)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: isSelected
                      ? (isDark ? "1.5px solid #4ade80" : "1.5px solid #15803d")
                      : (isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0"),
                    backgroundColor: isSelected
                      ? (isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4")
                      : (isDark ? "#172338" : "#ffffff"),
                    color: isSelected
                      ? (isDark ? "#4ade80" : "#15803d")
                      : (isDark ? "#cbd5e1" : "#475569"),
                    fontSize: "12px",
                    fontWeight: isSelected ? "800" : "600",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {dept === "ALL" ? "All Departments" : dept}
                </button>
              );
            })}
          </div>
        </div>

        {/* Empty State */}
        {!loading && filteredBackups.length === 0 && (
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
              {searchTerm || selectedDeptFilter !== "ALL" ? "No Matching Backup Requests" : "No Pending Backup Requests"}
            </h3>
            <p style={{ margin: 0, fontSize: "14.5px", color: isDark ? "#94a3b8" : "#64748b", maxWidth: "440px", lineHeight: "1.5" }}>
              {searchTerm || selectedDeptFilter !== "ALL"
                ? "Try adjusting your search criteria or clear the department filter."
                : "All field personnel are operating with adequate reinforcement. Incoming distress requests will appear live."}
            </p>
          </div>
        )}

        {loading && backups.length === 0 && (
          <div style={{ padding: "80px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", color: isDark ? "#4ade80" : "#15803d" }}>
            <Loader className="animate-spin" size={32} />
            <span style={{ fontWeight: "700", fontSize: "15px" }}>Loading backup requests...</span>
          </div>
        )}

        {/* Detailed Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(430px, 1fr))", gap: "22px" }}>
          {filteredBackups.map((backup) => {
            const requester = backup.expand?.requester_id;
            const reqName = requester ? requester.unit_name || `${requester.first_name || ""} ${requester.last_name || ""}`.trim() : "Field Unit";
            const incident = backup.expand?.incident_id;
            const sos = backup.expand?.sos_id;

            const lat = requester?.latitude || backup.latitude || incident?.latitude || sos?.latitude;
            const lng = requester?.longitude || backup.longitude || incident?.longitude || sos?.longitude;
            const address = addresses[backup.id] || (lat != null && lng != null ? `Coordinates (${lat.toFixed(5)}, ${lng.toFixed(5)})` : "GPS Telemetry Acquired");

            const currentSelected = selectedResponderIds[backup.id] || [];

            // Responder filtering inside this specific card
            const currentCardDeptFilter = departmentFilters[backup.id] || "";
            const filteredRespondersForCard = availableResponders.filter((r) => {
              if (currentCardDeptFilter) return (r.department || "").toLowerCase() === currentCardDeptFilter.toLowerCase();
              return true;
            });

            return (
              <div
                key={backup.id}
                className="premium-table-card"
                style={{
                  padding: "22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  borderTop: "4px solid #ef4444",
                  backgroundColor: isDark ? "#131c2e" : "#ffffff",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                  borderRadius: "16px",
                  boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.04)",
                  position: "relative",
                }}
              >
                {/* Top Badge & Time Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "800",
                        padding: "3px 9px",
                        borderRadius: "8px",
                        backgroundColor: isDark ? "rgba(239, 68, 68, 0.18)" : "#fef2f2",
                        color: isDark ? "#f87171" : "#b91c1c",
                        border: isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fecaca",
                        textTransform: "uppercase",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Siren size={12} /> {backup.department || "GENERAL"} BACKUP
                    </span>

                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        color: isDark ? "#fbbf24" : "#b45309",
                        backgroundColor: isDark ? "rgba(245, 158, 11, 0.16)" : "#fef3c7",
                        border: isDark ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid #fde68a",
                        padding: "3px 8px",
                        borderRadius: "8px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Clock size={11} /> {formatWaitTime(backup.created)}
                    </span>
                  </div>

                  <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600" }}>
                    {new Date(backup.created).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {/* Requesting Unit Profile Banner */}
                <div
                  onClick={() => setSelectedBackup(backup)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    backgroundColor: isDark ? "#172338" : "#f8fafc",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
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
                    <CustomIcon icon={assistantSvg} size={20} color={isDark ? "#fbbf24" : "#b45309"} />
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong style={{ fontSize: "14px", color: isDark ? "#f8fafc" : "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {reqName}
                      </strong>
                      <DepartmentBadge department={requester?.department || backup.department} isDark={isDark} size="sm" />
                    </div>
                    <span style={{ fontSize: "11.5px", color: isDark ? "#94a3b8" : "#64748b", display: "flex", alignItems: "center", gap: "5px", marginTop: "2px" }}>
                      <Phone size={11} /> {requester?.contact_number || requester?.phone || "Radio Contact Active"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBackup(backup);
                    }}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #cbd5e1",
                      backgroundColor: isDark ? "#1e293b" : "#ffffff",
                      color: isDark ? "#cbd5e1" : "#334155",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      flexShrink: 0,
                    }}
                  >
                    <Eye size={12} /> Inspect
                  </button>
                </div>

                {/* Linked Incident Context (if available) */}
                {(incident || sos) && (
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "10px",
                      backgroundColor: isDark ? "rgba(59, 130, 246, 0.12)" : "#eff6ff",
                      border: isDark ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid #bfdbfe",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      color: isDark ? "#93c5fd" : "#1e40af",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <Radio size={13} style={{ flexShrink: 0 }} />
                      <span style={{ fontWeight: "700" }}>
                        Linked Operation: {incident ? `Incident #${incident.id} (${(incident.type || "Emergency").toUpperCase()})` : `Live SOS #${sos?.id}`}
                      </span>
                    </div>
                    {incident?.type && (
                      <span style={{ fontWeight: "800", textTransform: "capitalize", fontSize: "11px", backgroundColor: isDark ? "rgba(59, 130, 246, 0.25)" : "#dbeafe", padding: "2px 6px", borderRadius: "4px" }}>
                        {incident.type}
                      </span>
                    )}
                  </div>
                )}

                {/* Field Reason / Callout Note */}
                {backup.reason ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      backgroundColor: isDark ? "#172338" : "#f8fafc",
                      border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                      fontSize: "13px",
                      color: isDark ? "#cbd5e1" : "#334155",
                      lineHeight: "1.45",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px", color: isDark ? "#fbbf24" : "#b45309", fontSize: "11.5px", fontWeight: "800", textTransform: "uppercase" }}>
                      <AlertTriangle size={13} /> Field Distress / Backup Reason:
                    </div>
                    <p style={{ margin: 0, fontStyle: "italic", color: isDark ? "#f8fafc" : "#0f172a", fontWeight: "600" }}>
                      "{backup.reason}"
                    </p>
                  </div>
                ) : (
                  <div style={{ fontSize: "12px", color: isDark ? "#64748b" : "#94a3b8", fontStyle: "italic" }}>
                    No specific field reason provided by responder.
                  </div>
                )}

                {/* Location & GPS Strip */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: "10px",
                    backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                    fontSize: "12.5px",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0 }}>
                    <MapPin size={15} color={isDark ? "#4ade80" : "#15803d"} style={{ flexShrink: 0 }} />
                    <span style={{ color: isDark ? "#f8fafc" : "#334155", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {address}
                    </span>
                  </div>

                  {lat != null && lng != null && (
                    <button
                      type="button"
                      onClick={() => setSelectedMap({ lat, lng, address })}
                      style={{
                        background: "none",
                        border: "none",
                        color: isDark ? "#4ade80" : "#15803d",
                        fontWeight: "800",
                        fontSize: "11.5px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        flexShrink: 0,
                      }}
                    >
                      <ExternalLink size={12} /> Map
                    </button>
                  )}
                </div>

                {/* Embedded Interactive Satellite Mini Map Preview */}
                {lat != null && lng != null && (
                  <div
                    onClick={() => setSelectedMap({ lat, lng, address })}
                    style={{
                      height: "130px",
                      borderRadius: "12px",
                      overflow: "hidden",
                      position: "relative",
                      border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                      cursor: "pointer",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                      backgroundColor: "#0f172a",
                    }}
                  >
                    <iframe
                      title={`Map Preview for Backup ${backup.id}`}
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://maps.google.com/maps?q=${lat},${lng}&z=16&t=k&output=embed`}
                      style={{ border: 0, pointerEvents: "none", width: "100%", height: "100%" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: "8px",
                        right: "8px",
                        backgroundColor: "rgba(15, 23, 42, 0.75)",
                        color: "#ffffff",
                        fontSize: "11px",
                        fontWeight: "700",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      <Maximize2 size={12} /> Enlarge Satellite Map
                    </div>
                  </div>
                )}

                {/* Responder Assignment Section */}
                <div style={{ borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", paddingTop: "14px", display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexShrink: 0 }}>
                    <label style={{ fontSize: "11.5px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", textTransform: "uppercase" }}>
                      Assign Backup Units ({currentSelected.length})
                    </label>

                    <CustomDropdown
                      size="sm"
                      minWidth="130px"
                      value={departmentFilters[backup.id] || ""}
                      onChange={(val) => setDepartmentFilters((prev) => ({ ...prev, [backup.id]: val }))}
                      options={[
                        { value: "", label: "All Departments" },
                        { value: "police", label: "Police" },
                        { value: "ambulance", label: "Ambulance" },
                        { value: "MDRRMO", label: "MDRRMO" },
                        { value: "Fire", label: "BFP (Fire)" },
                      ]}
                    />
                  </div>

                  {/* Responder Units Checkbox List */}
                  <div
                    style={{
                      maxHeight: "150px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      backgroundColor: isDark ? "#0c1322" : "#f8fafc",
                      padding: "6px",
                      borderRadius: "10px",
                      border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                      marginBottom: "12px",
                    }}
                  >
                    {availableResponders.length === 0 ? (
                      <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#94a3b8", textAlign: "center", padding: "8px" }}>
                        No Standby Responders Online
                      </span>
                    ) : filteredRespondersForCard.length === 0 ? (
                      <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#94a3b8", textAlign: "center", padding: "8px" }}>
                        No available responders in this department
                      </span>
                    ) : (
                      filteredRespondersForCard.map((r) => {
                        const isUnitSelected = currentSelected.includes(r.id);
                        const displayName = `${r.unit_name ? `${r.unit_name} - ` : ""}${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email || "Responder";

                        return (
                          <div
                            key={r.id}
                            onClick={() => {
                              setSelectedResponderIds((prev) => {
                                const current = prev[backup.id] || [];
                                return {
                                  ...prev,
                                  [backup.id]: current.includes(r.id) ? current.filter((id) => id !== r.id) : [...current, r.id],
                                };
                              });
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "10px",
                              padding: "7px 10px",
                              borderRadius: "8px",
                              backgroundColor: isUnitSelected
                                ? (isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4")
                                : (isDark ? "#172338" : "#ffffff"),
                              border: isUnitSelected
                                ? (isDark ? "1.5px solid #22c55e" : "1.5px solid #15803d")
                                : (isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0"),
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              boxShadow: isUnitSelected ? "0 2px 6px rgba(21, 128, 61, 0.15)" : "0 1px 2px rgba(0,0,0,0.02)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0, flex: 1 }}>
                              {/* Custom Checkbox */}
                              <div
                                style={{
                                  width: "18px",
                                  height: "18px",
                                  borderRadius: "5px",
                                  backgroundColor: isUnitSelected
                                    ? "#15803d"
                                    : (isDark ? "#0c1322" : "#ffffff"),
                                  border: isUnitSelected
                                    ? "none"
                                    : (isDark ? "1.5px solid rgba(255, 255, 255, 0.25)" : "1.5px solid #cbd5e1"),
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {isUnitSelected && <Check size={12} strokeWidth={3.5} color="#ffffff" />}
                              </div>

                              {/* Online status dot */}
                              <span
                                style={{
                                  width: "7px",
                                  height: "7px",
                                  borderRadius: "50%",
                                  backgroundColor: "#22c55e",
                                  boxShadow: "0 0 6px rgba(34, 197, 94, 0.6)",
                                  flexShrink: 0,
                                }}
                              />

                              {/* Responder Name */}
                              <span
                                style={{
                                  fontSize: "12.5px",
                                  fontWeight: isUnitSelected ? "800" : "600",
                                  color: isUnitSelected
                                    ? (isDark ? "#4ade80" : "#14532d")
                                    : (isDark ? "#f8fafc" : "#0f172a"),
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {displayName}
                              </span>
                            </div>

                            {/* Department Badge */}
                            <DepartmentBadge department={r.department} isDark={isDark} size="sm" />
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
                    <button
                      type="button"
                      onClick={() => handleDispatch(backup.id)}
                      disabled={processingId === backup.id || currentSelected.length === 0}
                      style={{
                        flex: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        padding: "10px 16px",
                        borderRadius: "10px",
                        border: "none",
                        background: currentSelected.length > 0
                          ? "linear-gradient(135deg, #15803d 0%, #166534 100%)"
                          : (isDark ? "#1e293b" : "#cbd5e1"),
                        color: "#ffffff",
                        fontSize: "13px",
                        fontWeight: "800",
                        cursor: currentSelected.length > 0 ? "pointer" : "not-allowed",
                        boxShadow: currentSelected.length > 0 ? "0 4px 12px rgba(21, 128, 61, 0.25)" : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {processingId === backup.id ? <Loader className="animate-spin" size={15} /> : <Send size={15} />}
                      <span>{processingId === backup.id ? "Deploying..." : `Dispatch (${currentSelected.length})`}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReject(backup)}
                      disabled={processingId === backup.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fecaca",
                        backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : "#fef2f2",
                        color: isDark ? "#f87171" : "#b91c1c",
                        fontSize: "13px",
                        fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={15} />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* FULLSCREEN MAP LIGHTBOX */}
      {selectedMap && (
        <div
          className="lightboxModalBackdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(3, 7, 18, 0.82)",
            backdropFilter: "blur(10px)",
            zIndex: 99999,
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
              maxWidth: "760px",
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
              borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
              backgroundColor: isDark ? "#172338" : "#f8fafc",
            }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin size={17} color={isDark ? "#4ade80" : "#15803d"} /> {selectedMap.address}
              </h3>
              <button
                type="button"
                className="animatedCloseButton"
                onClick={() => setSelectedMap(null)}
                style={{
                  width: "34px",
                  height: "34px",
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
              height="480px"
              frameBorder="0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${selectedMap.lat},${selectedMap.lng}&z=17&t=k&output=embed`}
              style={{ border: 0 }}
            />
          </div>
        </div>
      )}

      {/* INSPECTION DETAIL MODAL */}
      {selectedBackup && (
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
          onClick={() => setSelectedBackup(null)}
        >
          <div
            className="lightboxModalCard"
            style={{
              backgroundColor: isDark ? "#131c2e" : "#ffffff",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "640px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "26px",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "16px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "10px", backgroundColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fef2f2", color: isDark ? "#f87171" : "#b91c1c", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Siren size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a" }}>
                    Backup Request #{selectedBackup.id}
                  </h2>
                  <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>
                    Called at {new Date(selectedBackup.created).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="animatedCloseButton"
                onClick={() => setSelectedBackup(null)}
                style={{ width: "36px", height: "36px", borderRadius: "50%", border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0", backgroundColor: isDark ? "#1e293b" : "#fff", color: isDark ? "#cbd5e1" : "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Requesting Responder Full Data */}
            <div style={{ backgroundColor: isDark ? "#0f172a" : "#f8fafc", padding: "16px", borderRadius: "14px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", marginBottom: "18px" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", textTransform: "uppercase" }}>
                Requesting Responder Unit
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", fontSize: "13px" }}>
                <div><span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Unit Name:</span> <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{selectedBackup.expand?.requester_id?.unit_name || "Field Unit"}</strong></div>
                <div><span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Personnel:</span> <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{selectedBackup.expand?.requester_id?.first_name} {selectedBackup.expand?.requester_id?.last_name}</strong></div>
                <div><span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Department:</span> <strong style={{ color: isDark ? "#4ade80" : "#15803d" }}>{selectedBackup.expand?.requester_id?.department || selectedBackup.department || "MDRRMO"}</strong></div>
                <div><span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Contact:</span> <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{selectedBackup.expand?.requester_id?.contact_number || "N/A"}</strong></div>
              </div>
            </div>

            {/* Reason / Distress Call */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", textTransform: "uppercase" }}>
                Distress / Reinforcement Reason
              </h4>
              <div style={{ padding: "14px", borderRadius: "12px", backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#fef3c7", border: isDark ? "1px solid rgba(245, 158, 11, 0.25)" : "1px solid #fde68a", color: isDark ? "#fde68a" : "#92400e", fontSize: "13.5px", lineHeight: "1.5" }}>
                {selectedBackup.reason || "No explicit description given."}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setSelectedBackup(null)}
                style={{ padding: "10px 18px", borderRadius: "10px", border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1", background: isDark ? "#1e293b" : "#fff", color: isDark ? "#cbd5e1" : "#475569", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
