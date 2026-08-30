import React, { useState, useEffect, useCallback, useRef } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { getReadableAddress } from "../utils/utils";
import { useMessageBox } from "../components/MessageBox";
import { addAuditLog } from "../utils/auditLog";
import { formatWaitTime } from "../utils/timeUtils";
import CustomDropdown from "../components/CustomDropdown";
import {
  MapPin,
  User,
  ImageIcon,
  Activity,
  X,
  Phone,
  ShieldCheck,
  Maximize2,
  CheckCircle,
  Loader,
  Search,
  RotateCcw,
  Shield,
  Flame,
  Ambulance,
  Car,
  AlertOctagon,
  Radio,
  Clock,
  ExternalLink,
  ShieldAlert,
  Send,
  Users,
  Building2,
  CheckCircle2,
  ChevronDown,
  Check,
} from "lucide-react";

const renderDepartmentBadge = (dept) => {
  const d = (dept || "").toLowerCase();
  if (d.includes("fire")) {
    return (
      <span className="dept-badge-fire" style={{ fontSize: "10.5px", fontWeight: "800", color: "#b91c1c", backgroundColor: "#fef2f2", border: "1px solid #fecaca", padding: "2px 7px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
        <Flame size={10} /> BFP
      </span>
    );
  }
  if (d.includes("police")) {
    return (
      <span className="dept-badge-police" style={{ fontSize: "10.5px", fontWeight: "800", color: "#6d28d9", backgroundColor: "#f5f3ff", border: "1px solid #ddd6fe", padding: "2px 7px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
        <Shield size={10} /> PNP
      </span>
    );
  }
  if (d.includes("ambulance") || d.includes("ems") || d.includes("medical")) {
    return (
      <span className="dept-badge-ems" style={{ fontSize: "10.5px", fontWeight: "800", color: "#0369a1", backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", padding: "2px 7px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
        <Ambulance size={10} /> EMS
      </span>
    );
  }
  return (
    <span className="dept-badge-mdrrmo" style={{ fontSize: "10.5px", fontWeight: "800", color: "#15803d", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "2px 7px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
      <Activity size={10} /> MDRRMO
    </span>
  );
};

export default function OngoingIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("ALL");
  const [departmentFilters, setDepartmentFilters] = useState({});
  const [selectedResponderIds, setSelectedResponderIds] = useState({});
  const [availableResponders, setAvailableResponders] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  const fetchedAddressIds = useRef(new Set());
  const { confirm, alert: showAlert } = useMessageBox();

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const allDispatches = await pb.collection("dispatches").getFullList({
        expand: "responder_id",
        requestKey: null,
      });
      setDispatches(allDispatches);

      const activeDispatches = allDispatches.filter((d) => d.status?.toLowerCase() !== "resolved");
      const activeIncidentIds = [...new Set(activeDispatches.map((d) => d.incident_id).filter((id) => !!id))];
      let filterString = 'status = "ongoing" || status = "accepted" || status = "en_route" || status = "at_scene" || status = "dispatched"';
      if (activeIncidentIds.length > 0) {
        const idFilters = activeIncidentIds.map((id) => `id = "${id}"`).join(" || ");
        filterString = `(${filterString}) || (${idFilters})`;
      }

      const records = await pb.collection("incident_reports").getFullList({
        filter: filterString,
        sort: "-created",
        expand: "users",
        requestKey: null,
      });
      setIncidents(records);

      const responders = await pb.collection("responder_accounts").getFullList({
        filter: "is_available = true",
        sort: "department, first_name, last_name",
        requestKey: null,
      });
      setAvailableResponders(responders);

      const pendingAddresses = records.filter(
        (record) => record.latitude != null && record.longitude != null && !fetchedAddressIds.current.has(record.id)
      );

      if (pendingAddresses.length > 0) {
        const resolved = await Promise.all(
          pendingAddresses.map(async (record) => {
            fetchedAddressIds.current.add(record.id);
            return [record.id, await getReadableAddress(record.latitude, record.longitude)];
          })
        );
        setAddresses((prev) => ({ ...prev, ...Object.fromEntries(resolved) }));
      }
    } catch (error) {
      if (!error.isAbort) console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let unsubIncidents;
    let unsubDispatches;
    let unsubResponders;

    const loadAndSubscribe = async () => {
      await fetchIncidents();
      if (!isMounted) return;

      unsubIncidents = await pb.collection("incident_reports").subscribe("*", () => {
        if (isMounted) fetchIncidents();
      });
      unsubDispatches = await pb.collection("dispatches").subscribe("*", () => {
        if (isMounted) fetchIncidents();
      });
      unsubResponders = await pb.collection("responder_accounts").subscribe("*", () => {
        if (isMounted) fetchIncidents();
      });
    };

    loadAndSubscribe();

    return () => {
      isMounted = false;
      if (typeof unsubIncidents === "function") unsubIncidents().catch(() => {});
      if (typeof unsubDispatches === "function") unsubDispatches().catch(() => {});
      if (typeof unsubResponders === "function") unsubResponders().catch(() => {});
    };
  }, [fetchIncidents]);

  const updateStatus = async (incident, newStatus, responderIds = selectedResponderIds[incident.id] || []) => {
    setProcessingId(incident.id);
    let reservedResponders = [];
    let dispatchesCreated = [];
    try {
      if (!responderIds || responderIds.length === 0) {
        showAlert("Please select at least one standby responder unit to dispatch.", { title: "Unit Selection Required" });
        setProcessingId(null);
        return;
      }

      const selectedResponders = responderIds.map((id) => availableResponders.find((r) => r.id === id)).filter(Boolean);

      for (const r of selectedResponders) {
        await pb.collection("responder_accounts").update(r.id, { is_available: false });
        reservedResponders.push(r);

        const dispatch = await pb.collection("dispatches").create({
          incident_id: incident.id,
          responder_id: r.id,
          department: r.department,
          status: "pending",
        });
        dispatchesCreated.push(dispatch);
      }

      const unitDescriptions = selectedResponders
        .map((r) => {
          const name = r.unit_name || `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.name || "Unit";
          return `${name} (${r.department || "Field Team"})`;
        })
        .join(", ");

      const locDisplay = incident.location || incident.barangay || "Barangay Lagonglong";

      const currentAdmin = pb.authStore.model;
      const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

      await pb.collection("incident_reports").update(incident.id, { status: newStatus });
      addAuditLog({
        action: "BACKUP_RESPONDERS_DISPATCHED",
        target: `Incident #${incident.id} [${incident.type || "Emergency"}]`,
        details: `Administrator ${adminName} dispatched +${responderIds.length} additional backup unit(s) [${unitDescriptions}] to reinforce ongoing ${incident.type || "incident"} at ${locDisplay}.`,
        actor: adminName,
      });

      setSelectedResponderIds((prev) => ({ ...prev, [incident.id]: [] }));
      await fetchIncidents();
      await showAlert(`Dispatched ${responderIds.length} additional responder unit(s).`, { title: "Backup Dispatched" });
    } catch (error) {
      console.error("Failed to deploy units:", error);
      for (const r of reservedResponders) {
        await pb.collection("responder_accounts").update(r.id, { is_available: true }).catch(() => {});
      }
      for (const d of dispatchesCreated) {
        await pb.collection("dispatches").delete(d.id).catch(() => {});
      }
      await showAlert("Failed to dispatch units: " + (error.message || "Unknown error"), { title: "Error" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleResolveIncident = async (incident) => {
    const shouldResolve = await confirm(
      `Mark ${incident.type || "incident"} (#${incident.id}) as fully resolved? All active dispatches will be closed and units returned to standby.`,
      {
        title: "Confirm Incident Resolution",
        primaryLabel: "Resolve Incident",
        secondaryLabel: "Cancel",
      }
    );
    if (!shouldResolve) return;

    setProcessingId(incident.id);
    try {
      const activeDispatches = dispatches.filter(
        (d) => d.incident_id === incident.id && d.status?.toLowerCase() !== "resolved"
      );

      for (const d of activeDispatches) {
        await pb.collection("dispatches").update(d.id, { status: "resolved" });
        if (d.responder_id) {
          await pb.collection("responder_accounts").update(d.responder_id, { is_available: true }).catch(() => {});
        }
      }

      await pb.collection("incident_reports").update(incident.id, { status: "resolved" });
      const locDisplay = incident.location || incident.barangay || "Barangay Lagonglong";
      
      const currentAdmin = pb.authStore.model;
      const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

      addAuditLog({
        action: "INCIDENT_RESOLVED",
        target: `Incident #${incident.id} [${incident.type || "Emergency"}]`,
        details: `Administrator ${adminName} marked ${incident.type || "incident"} (#${incident.id}) at ${locDisplay} as resolved. Discharged and released ${activeDispatches.length} active responder unit(s) back to standby.`,
        actor: adminName,
      });

      setIncidents((prev) => prev.filter((i) => i.id !== incident.id));
      await showAlert("Incident has been marked as resolved and logged in history.", { title: "Incident Resolved" });
    } catch (error) {
      console.error("Resolution error:", error);
      await showAlert("Failed to resolve incident: " + (error.message || "Unknown error"), { title: "Error" });
    } finally {
      setProcessingId(null);
    }
  };

  const typeCounts = incidents.reduce((acc, inc) => {
    const type = inc.type?.toUpperCase() || "OTHER";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const filteredIncidents = incidents.filter((incident) => {
    if (selectedTypeFilter === "ALL") return true;
    return incident.type?.toUpperCase() === selectedTypeFilter;
  });

  const getCategoryMeta = (type = "") => {
    const t = type.toLowerCase();
    if (t.includes("fire")) return { icon: <Flame size={17} color="#ef4444" />, bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
    if (t.includes("medical") || t.includes("health")) return { icon: <Ambulance size={17} color="#f97316" />, bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
    if (t.includes("traffic") || t.includes("accident") || t.includes("car")) return { icon: <Car size={17} color="#15803d" />, bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" };
    if (t.includes("flood") || t.includes("landslide") || t.includes("rescue")) return { icon: <ShieldAlert size={17} color="#0284c7" />, bg: "#f0f9ff", color: "#0369a1", border: "#bae6fd" };
    return { icon: <AlertOctagon size={17} color="#8b5cf6" />, bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe" };
  };

  const getDispatchStatusPill = (status = "") => {
    const s = status.toLowerCase();
    if (s === "at_scene" || s === "on scene") return { bg: "#f0fdf4", color: "#15803d", label: "AT SCENE" };
    if (s === "en_route" || s === "en route") return { bg: "#fff7ed", color: "#c2410c", label: "EN ROUTE" };
    if (s === "accepted") return { bg: "#eff6ff", color: "#1d4ed8", label: "ACCEPTED" };
    return { bg: "#fef2f2", color: "#b91c1c", label: "DISPATCHED" };
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main className="ongoing-incidents-main" style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* HEADER */}
        <header className="ongoing-incidents-header" style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span className="urgent-status-pulse" style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#f59e0b", display: "inline-block" }} />
              <h1 style={{ fontSize: "clamp(20px, 3vw, 28px)", fontWeight: "800", color: "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
                Ongoing Incidents
              </h1>
            </div>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "13.5px" }}>
              Track responder units in the field and mark incidents as resolved once completed.
            </p>
          </div>

          <div className="ongoing-header-actions" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span
              className="ongoing-ops-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "20px",
                backgroundColor: filteredIncidents.length > 0 ? "#fffbeb" : "#f0fdf4",
                border: filteredIncidents.length > 0 ? "1px solid #fde68a" : "1px solid #bbf7d0",
                color: filteredIncidents.length > 0 ? "#b45309" : "#15803d",
                fontSize: "12.5px",
                fontWeight: "800",
              }}
            >
              <Activity size={14} />
              <span>{filteredIncidents.length} Active Operations</span>
            </span>

            <button
              type="button"
              className="ongoing-refresh-btn"
              onClick={fetchIncidents}
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
              <RotateCcw size={13} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* CATEGORY FILTER TABS */}
        <div
          className="premium-table-card ongoing-filter-ribbon"
          style={{
            padding: "12px 18px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className={`ongoing-filter-tab ${selectedTypeFilter === "ALL" ? "active" : ""}`}
            onClick={() => setSelectedTypeFilter("ALL")}
            style={{
              padding: "7px 14px",
              borderRadius: "10px",
              border: selectedTypeFilter === "ALL" ? "none" : "1px solid #e2e8f0",
              backgroundColor: selectedTypeFilter === "ALL" ? "#15803d" : "#ffffff",
              color: selectedTypeFilter === "ALL" ? "#ffffff" : "#475569",
              fontSize: "12.5px",
              fontWeight: "800",
              cursor: "pointer",
              boxShadow: selectedTypeFilter === "ALL" ? "0 2px 8px rgba(21, 128, 61, 0.25)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            All Active ({incidents.length})
          </button>

          {Object.entries(typeCounts).map(([type, count]) => (
            <button
              key={type}
              type="button"
              className={`ongoing-filter-tab ${selectedTypeFilter === type ? "active" : ""}`}
              onClick={() => setSelectedTypeFilter(type)}
              style={{
                padding: "7px 14px",
                borderRadius: "10px",
                border: selectedTypeFilter === type ? "none" : "1px solid #e2e8f0",
                backgroundColor: selectedTypeFilter === type ? "#15803d" : "#ffffff",
                color: selectedTypeFilter === type ? "#ffffff" : "#475569",
                fontSize: "12.5px",
                fontWeight: "800",
                cursor: "pointer",
                boxShadow: selectedTypeFilter === type ? "0 2px 8px rgba(21, 128, 61, 0.25)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {type} ({count})
            </button>
          ))}
        </div>

        {/* INCIDENT CARDS GRID */}
        {loading && incidents.length === 0 ? (
          <div style={{ padding: "80px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", color: "#15803d" }}>
            <Loader className="animate-spin" size={32} />
            <span style={{ fontWeight: "700", fontSize: "15px" }}>Loading ongoing emergency incidents...</span>
          </div>
        ) : filteredIncidents.length === 0 ? (
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
              No Active Operations
            </h3>
            <p style={{ margin: 0, fontSize: "14.5px", color: "#64748b", maxWidth: "440px", lineHeight: "1.5" }}>
              All deployed emergency response units have completed and resolved their assignments.
            </p>
          </div>
        ) : (
          <div className="ongoing-incidents-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 380px), 1fr))", gap: "22px" }}>
            {filteredIncidents.map((incident) => {
              const reporter = incident.expand?.users || incident.expand?.user;
              const reporterAvatarUrl = reporter ? (
                (reporter.selfie ? pb.files.getURL(reporter, reporter.selfie) : null) ||
                (reporter.avatar ? pb.files.getURL(reporter, reporter.avatar) : null) ||
                (reporter.profile_picture ? pb.files.getURL(reporter, reporter.profile_picture) : null)
              ) : null;
              const incidentDispatches = dispatches.filter((d) => d.incident_id === incident.id);
              const activeIncidentDispatches = incidentDispatches.filter((d) => d.status?.toLowerCase() !== "resolved");
              const previouslyDispatchedIds = new Set(incidentDispatches.map((d) => d.responder_id));
              const cat = getCategoryMeta(incident.type);
              const selectedResponders = selectedResponderIds[incident.id] || [];
              const sameLocationCount = Number(incident.reporters_count) > 0 ? Number(incident.reporters_count) : 1;

              return (
                <div
                  key={incident.id}
                  className="premium-table-card ongoing-incident-card"
                  style={{
                    padding: "22px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    borderTop: `4px solid ${cat.color}`,
                    position: "relative",
                  }}
                >
                  {/* Card Header Bar */}
                  <div className="ongoing-card-header-bar" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "10px",
                          backgroundColor: cat.bg,
                          border: `1px solid ${cat.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {cat.icon}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", textTransform: "uppercase" }}>
                          {incident.type || "EMERGENCY INCIDENT"}
                        </h3>
                        <span style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                          <Clock size={12} /> Active for: {formatWaitTime(incident.created)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {/* Reporters Count Badge */}
                      <span
                        className="ongoing-reporter-count-badge"
                        style={{
                          fontSize: "11px",
                          fontWeight: "800",
                          padding: "3px 8px",
                          borderRadius: "10px",
                          backgroundColor: sameLocationCount > 1 ? "#f0fdf4" : "#f1f5f9",
                          color: sameLocationCount > 1 ? "#15803d" : "#475569",
                          border: sameLocationCount > 1 ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {sameLocationCount > 1 ? <ShieldCheck size={12} color="#15803d" /> : <Users size={12} />}
                        {sameLocationCount > 1
                          ? `+${sameLocationCount - 1} More Resident • Likely Reliable`
                          : "1 Resident Reported"}
                      </span>

                      <span
                        className="ongoing-status-badge"
                        style={{
                          fontSize: "11px",
                          fontWeight: "800",
                          padding: "3px 8px",
                          borderRadius: "10px",
                          backgroundColor: "#fff7ed",
                          color: "#c2410c",
                          border: "1px solid #fed7aa",
                          textTransform: "uppercase",
                        }}
                      >
                        {incident.status?.replace("_", " ") || "ONGOING"}
                      </span>
                    </div>
                  </div>

                  {/* High Reliability Multi-Resident Report Banner */}
                  {sameLocationCount > 1 && (
                    <div
                      className="ongoing-reliability-banner"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        backgroundColor: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        color: "#15803d",
                        fontSize: "12px",
                        fontWeight: "700",
                      }}
                    >
                      <ShieldCheck size={16} color="#15803d" style={{ flexShrink: 0 }} />
                      <span>
                        <strong>Most Likely Reliable:</strong> {sameLocationCount - 1 === 1 ? "1 more resident has" : `${sameLocationCount - 1} more residents have`} reported this same incident ({sameLocationCount} total reports).
                      </span>
                    </div>
                  )}

                  {/* Incident Location & Address Strip */}
                  <div
                    className="ongoing-location-strip"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      fontSize: "12.5px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      <MapPin size={15} color="#15803d" style={{ flexShrink: 0 }} />
                      <span style={{ color: "#334155", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {addresses[incident.id] || "Acquiring GPS Telemetry..."}
                      </span>
                    </div>

                    {incident.latitude && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMap({
                            lat: incident.latitude,
                            lng: incident.longitude,
                            address: addresses[incident.id] || `Incident Coordinates (${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)})`,
                          });
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#15803d",
                          fontWeight: "700",
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

                  {/* Embedded Interactive Mini Map Preview (Satellite View) */}
                  {incident.latitude != null && incident.longitude != null && (
                    <div
                      onClick={() =>
                        setSelectedMap({
                          lat: incident.latitude,
                          lng: incident.longitude,
                          address: addresses[incident.id] || `Incident Location (${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)})`,
                        })
                      }
                      style={{
                        height: "140px",
                        borderRadius: "12px",
                        overflow: "hidden",
                        position: "relative",
                        border: "1px solid #e2e8f0",
                        cursor: "pointer",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                        backgroundColor: "#f1f5f9",
                      }}
                    >
                      <iframe
                        title={`Map Preview for Incident ${incident.id}`}
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        scrolling="no"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://maps.google.com/maps?q=${incident.latitude},${incident.longitude}&z=16&t=k&output=embed`}
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
                        <Maximize2 size={12} /> Enlarge Map
                      </div>
                    </div>
                  )}

                  {/* Citizen Reporter Card */}
                  <div
                    className="ongoing-citizen-card"
                    onClick={() => setSelectedIncident(incident)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      borderRadius: "12px",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "10px",
                        backgroundColor: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        color: "#15803d",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "800",
                        fontSize: "13px",
                        flexShrink: 0,
                        overflow: "hidden",
                      }}
                    >
                      {reporterAvatarUrl ? (
                        <img
                          src={reporterAvatarUrl}
                          alt="Citizen"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <User size={18} />
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: "5px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <strong style={{ display: "block", fontSize: "13px", color: "#0f172a", textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {reporter?.first_name || "Citizen"} {reporter?.last_name || "Reporter"}
                        </strong>
                        <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#15803d", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "1px 6px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
                          <ShieldCheck size={11} /> Verified
                        </span>
                      </div>
                      <span style={{ fontSize: "11.5px", color: "#64748b", display: "flex", alignItems: "center", gap: "5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: "1.2" }}>
                        <Phone size={11} style={{ flexShrink: 0 }} /> {reporter?.contact_number || "No contact"} • Brgy. {reporter?.baranggay || reporter?.barangay || "Lagonglong"}
                      </span>
                    </div>
                  </div>

                  {/* Deployed Field Responders */}
                  <div
                    className="ongoing-deployed-units-box"
                    style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase" }}>
                        <Users size={14} color="#15803d" /> Deployed Units ({activeIncidentDispatches.length})
                      </span>
                    </div>

                    {activeIncidentDispatches.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>No active responder units found.</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {activeIncidentDispatches.map((d) => {
                          const r = d.expand?.responder_id;
                          const statusPill = getDispatchStatusPill(d.status);

                          return (
                            <div
                              key={d.id}
                              className="ongoing-deployed-unit-item"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "8px 10px",
                                backgroundColor: "#ffffff",
                                borderRadius: "8px",
                                border: "1px solid #e2e8f0",
                                fontSize: "12px",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                                <strong style={{ color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {r ? `${r.first_name} ${r.last_name}` : d.department}
                                </strong>
                                <span style={{ fontSize: "11px", backgroundColor: "#f1f5f9", color: "#475569", padding: "1px 6px", borderRadius: "6px", fontWeight: "700" }}>
                                  {r?.department || d.department}
                                </span>
                              </div>

                              <span
                                style={{
                                  fontSize: "10.5px",
                                  fontWeight: "800",
                                  padding: "2px 6px",
                                  borderRadius: "6px",
                                  backgroundColor: statusPill.bg,
                                  color: statusPill.color,
                                }}
                              >
                                {statusPill.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Deploy Additional Responders */}
                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "14px" }}>
                    <div className="ongoing-dispatch-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                      <label style={{ fontSize: "12px", fontWeight: "800", color: "#0f172a", textTransform: "uppercase" }}>
                        Dispatch Additional Units
                      </label>
                      <CustomDropdown
                        size="sm"
                        minWidth="135px"
                        value={departmentFilters[incident.id] || ""}
                        onChange={(val) => setDepartmentFilters((prev) => ({ ...prev, [incident.id]: val }))}
                        options={[
                          { value: "", label: "All Departments" },
                          { value: "police", label: "Police" },
                          { value: "ambulance", label: "Ambulance" },
                          { value: "MDRRMO", label: "MDRRMO" },
                          { value: "Fire", label: "BFP (Fire)" },
                        ]}
                      />
                    </div>

                    <div
                      className="ongoing-responder-list-wrap"
                      style={{ maxHeight: "110px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "5px", backgroundColor: "#f8fafc", padding: "6px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "8px" }}
                    >
                      {availableResponders.length === 0 ? (
                        <span style={{ fontSize: "11.5px", color: "#94a3b8", textAlign: "center", padding: "6px" }}>No standby responders</span>
                      ) : (() => {
                        const filtered = availableResponders.filter(
                          (r) =>
                            !previouslyDispatchedIds.has(r.id) &&
                            (!departmentFilters[incident.id] || r.department === departmentFilters[incident.id])
                        );
                        if (filtered.length === 0) {
                          return <span style={{ fontSize: "11.5px", color: "#94a3b8", textAlign: "center", padding: "6px" }}>No standby units in this department</span>;
                        }
                        return filtered.map((r) => {
                          const isSelected = selectedResponders.includes(r.id);
                          return (
                            <div
                              key={r.id}
                              className={`ongoing-responder-item ${isSelected ? "selected" : ""}`}
                              onClick={() => {
                                setSelectedResponderIds((prev) => {
                                  const current = prev[incident.id] || [];
                                  return {
                                    ...prev,
                                    [incident.id]: current.includes(r.id) ? current.filter((id) => id !== r.id) : [...current, r.id],
                                  };
                                });
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                                padding: "6px 9px",
                                borderRadius: "8px",
                                backgroundColor: isSelected ? "#f0fdf4" : "#ffffff",
                                border: isSelected ? "1.5px solid #15803d" : "1px solid #e2e8f0",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                boxShadow: isSelected ? "0 2px 6px rgba(21, 128, 61, 0.12)" : "0 1px 2px rgba(0,0,0,0.02)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                                {/* Custom Checkbox */}
                                <div
                                  className={`ongoing-custom-checkbox ${isSelected ? "checked" : ""}`}
                                  style={{
                                    width: "16px",
                                    height: "16px",
                                    borderRadius: "4px",
                                    backgroundColor: isSelected ? "#15803d" : "#ffffff",
                                    border: isSelected ? "none" : "1.5px solid #cbd5e1",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    transition: "all 0.15s ease",
                                  }}
                                >
                                  {isSelected && <Check size={11} strokeWidth={3.5} color="#ffffff" />}
                                </div>

                                {/* Online status dot */}
                                <span
                                  style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    backgroundColor: "#22c55e",
                                    flexShrink: 0,
                                  }}
                                />

                                {/* Responder Name */}
                                <span
                                  className={`ongoing-responder-name ${isSelected ? "selected" : ""}`}
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: isSelected ? "800" : "700",
                                    color: isSelected ? "#14532d" : "#0f172a",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {r.first_name} {r.last_name}
                                </span>
                              </div>

                              {/* Department Badge */}
                              {renderDepartmentBadge(r.department)}
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {selectedResponders.length > 0 && (
                      <button
                        type="button"
                        className="ongoing-deploy-extra-btn"
                        onClick={() => updateStatus(incident, "ongoing", selectedResponders)}
                        disabled={processingId === incident.id}
                        style={{
                          width: "100%",
                          padding: "7px 12px",
                          borderRadius: "8px",
                          border: "none",
                          backgroundColor: "#15803d",
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: "800",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          marginBottom: "12px",
                        }}
                      >
                        <Send size={13} /> Deploy +{selectedResponders.length} Additional Unit(s)
                      </button>
                    )}
                  </div>

                  {/* Incident Resolution Action Bar */}
                  <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>


                    <button
                      type="button"
                      className="ongoing-inspect-btn"
                      onClick={() => setSelectedIncident(incident)}
                      style={{
                        width: "100%",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        backgroundColor: "#ffffff",
                        color: "#475569",
                        fontSize: "13px",
                        fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      <Maximize2 size={15} />
                      <span>Inspect Operation</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* FULLSCREEN MAP LIGHTBOX */}
      {selectedMap && (
        <div
          className="lightboxModalBackdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
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
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "760px",
              overflow: "hidden",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lightbox-modal-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin size={17} color="#15803d" /> {selectedMap.address}
              </h3>
              <button
                type="button"
                className="animatedCloseButton"
                onClick={() => setSelectedMap(null)}
                style={{ width: "34px", height: "34px", borderRadius: "50%", border: "1px solid #e2e8f0", backgroundColor: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
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
      {selectedIncident && (
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
          onClick={() => setSelectedIncident(null)}
        >
          <div
            className="lightboxModalCard"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "26px",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lightbox-modal-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "16px", borderBottom: "1px solid #f1f5f9", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#fff7ed", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Activity size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>
                    Active Operation #{selectedIncident.id}
                  </h2>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Reported on {new Date(selectedIncident.created).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="animatedCloseButton"
                onClick={() => setSelectedIncident(null)}
                style={{ width: "36px", height: "36px", borderRadius: "50%", border: "1px solid #e2e8f0", backgroundColor: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Multi-Resident Confirmation if applicable */}
            {(Number(selectedIncident.reporters_count) || 1) > 1 && (
              <div
                className="modal-reliability-banner"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#15803d",
                  fontSize: "13px",
                  fontWeight: "700",
                  marginBottom: "16px",
                }}
              >
                <ShieldCheck size={18} color="#15803d" />
                <span>
                  <strong>High Reliability:</strong> +{(Number(selectedIncident.reporters_count) || 1) - 1} more resident has reported this incident, which indicates this is a verified and highly reliable emergency operation.
                </span>
              </div>
            )}

            {/* Reporter Full Profile */}
            <div className="pending-reporter-box" style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "18px" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "800", color: "#0f172a", textTransform: "uppercase" }}>
                Caller Profile
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", fontSize: "13px" }}>
                <div><span style={{ color: "#64748b" }}>Name:</span> <strong style={{ color: "#0f172a" }}>{selectedIncident.expand?.users?.first_name} {selectedIncident.expand?.users?.last_name}</strong></div>
                <div><span style={{ color: "#64748b" }}>Phone:</span> <strong style={{ color: "#0f172a" }}>{selectedIncident.expand?.users?.contact_number || "N/A"}</strong></div>
                <div><span style={{ color: "#64748b" }}>Reporters Count:</span> <strong style={{ color: "#b45309" }}>{Number(selectedIncident.reporters_count) || 1} resident(s)</strong></div>
                <div><span style={{ color: "#64748b" }}>Barangay:</span> <strong style={{ color: "#0f172a" }}>{selectedIncident.expand?.users?.baranggay || "Lagonglong"}</strong></div>
              </div>
            </div>

            {/* Incident Description */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "800", color: "#0f172a", textTransform: "uppercase" }}>
                Incident Description & Field Notes
              </h4>
              <div className="pending-notes-box" style={{ padding: "14px", borderRadius: "12px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", color: "#14532d", fontSize: "13.5px", lineHeight: "1.5" }}>
                {selectedIncident.description || selectedIncident.remarks || "No additional description provided."}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedIncident(null)}
                style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
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
