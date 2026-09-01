import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { getReadableAddress } from "../utils/utils";
import { useMessageBox } from "../components/MessageBox";
import {
  getPriorityLabel,
  sortIncidentReportsByPriority,
} from "../utils/incidentPriority";
import { addAuditLog } from "../utils/auditLog";
import { formatWaitTime } from "../utils/timeUtils";
import { isIncidentReviewed, markIncidentReviewed } from "../utils/incidentReview";
import { getResponderOptionLabel } from "../utils/responderOptions";
import CustomDropdown from "../components/CustomDropdown";
import AdvancedImageModal from "../components/AdvancedImageModal";
import PremiumSearchBar from "../components/PremiumSearchBar";
import {
  MapPin,
  User,
  ImageIcon,
  Activity,
  X,
  Phone,
  Clock,
  CheckCircle2,
  Send,
  Trash2,
  SlidersHorizontal,
  Flame,
  Ambulance,
  Car,
  AlertOctagon,
  Volume2,
  VolumeX,
  Loader,
  Search,
  RotateCcw,
  Shield,
  ShieldCheck,
  Maximize2,
  ExternalLink,
  ShieldAlert,
  Radio,
  FileText,
  AlertTriangle,
  Users,
  ChevronDown,
  Eye,
  Mountain,
  Check,
} from "lucide-react";
import DepartmentBadge from "../components/DepartmentBadge";
import CustomIcon from "../components/CustomIcon";
import { getCategoryBadgeMeta } from "../utils/categoryIcons";
import { useTheme } from "../themes/ThemeContext";

export default function PendingIncidents() {
  const { isDark } = useTheme();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});

  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [availableResponders, setAvailableResponders] = useState([]);
  const [selectedResponderIds, setSelectedResponderIds] = useState({});
  const [departmentFilters, setDepartmentFilters] = useState({});

  const [filters, setFilters] = useState({
    type: "",
    barangay: "",
    priority: "",
  });
  const [, setClockTick] = useState(0);
  const { confirm, alert: showAlert } = useMessageBox();

  const fetchedAddressIds = useRef(new Set());

  const triggerEmergencyAlert = useCallback(() => {
    try {
      const audio = new Audio("/notification_sound.mp3");
      audio.play().catch(() => {}).catch((e) => console.warn("Autoplay block or missing file:", e));
    } catch (e) {
      console.warn("Audio alert failed:", e);
    }
  }, []);

  const isOpenIncident = useCallback((record) => ["new", "pending"].includes(record?.status), []);

  const resolveAddresses = useCallback(async (records) => {
    const pendingAddresses = records.filter(
      (record) => record.latitude != null && record.longitude != null && !fetchedAddressIds.current.has(record.id)
    );
    if (pendingAddresses.length === 0) return;

    pendingAddresses.forEach((r) => fetchedAddressIds.current.add(r.id));

    const resolved = await Promise.all(
      pendingAddresses.map(async (record) => {
        try {
          const addr = await getReadableAddress(record.latitude, record.longitude);
          return [record.id, addr];
        } catch {
          return [record.id, "GPS Telemetry Acquired"];
        }
      })
    );

    setAddresses((prev) => ({ ...prev, ...Object.fromEntries(resolved) }));
  }, []);

  const fetchAvailableResponders = useCallback(async () => {
    try {
      const records = await pb.collection("responder_accounts").getFullList({
        sort: "department, first_name",
        requestKey: null,
      });
      setAvailableResponders(records.filter((r) => r.is_available === true && !r.is_suspended));
    } catch (error) {
      if (!error.isAbort) console.error("Error fetching available responders:", error);
    }
  }, []);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const records = await pb.collection("incident_reports").getFullList({
        filter: 'status = "new" || status = "pending"',
        sort: "-created",
        expand: "users",
        requestKey: null,
      });

      const sorted = sortIncidentReportsByPriority(records);
      setIncidents(sorted);
      resolveAddresses(sorted);
    } catch (error) {
      if (!error.isAbort) console.error("Failed to fetch pending incidents:", error);
    } finally {
      setLoading(false);
    }
  }, [resolveAddresses]);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe;

    const loadAndSubscribe = async () => {
      await fetchIncidents();
      if (!isMounted) return;

      unsubscribe = await pb.collection("incident_reports").subscribe(
        "*",
        (e) => {
          if (!isMounted) return;

          if (e.action === "create" && isOpenIncident(e.record)) {
            triggerEmergencyAlert();
          }

          if (e.action === "delete" || (e.action === "update" && !isOpenIncident(e.record))) {
            setIncidents((prev) => prev.filter((i) => i.id !== e.record.id));
          } else if (isOpenIncident(e.record)) {
            setIncidents((prev) => {
              const exists = prev.find((i) => i.id === e.record.id);
              const updated = exists ? prev.map((i) => (i.id === e.record.id ? e.record : i)) : [e.record, ...prev];
              return sortIncidentReportsByPriority(updated);
            });
            resolveAddresses([e.record]);
          }
        },
        { expand: "users" }
      );
    };

    loadAndSubscribe();
    const timer = setInterval(() => setClockTick((t) => t + 1), 60000);

    return () => {
      isMounted = false;
      clearInterval(timer);
      if (typeof unsubscribe === "function") unsubscribe().catch(() => {});
    };
  }, [fetchIncidents, isOpenIncident, resolveAddresses, triggerEmergencyAlert]);

  useEffect(() => {
    fetchAvailableResponders();
    let unsubscribe;
    let timeout;
    const startResponderSubscription = async () => {
      unsubscribe = await pb.collection("responder_accounts").subscribe("*", () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fetchAvailableResponders(), 800);
      });
    };
    startResponderSubscription();
    return () => {
      if (typeof unsubscribe === "function") unsubscribe().catch(() => {});
      clearTimeout(timeout);
    };
  }, [fetchAvailableResponders]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const reporter = incident.expand?.users || incident.expand?.user;
      const barangay = reporter?.baranggay || reporter?.barangay || "";

      if (filters.type && incident.type?.toLowerCase() !== filters.type.toLowerCase()) return false;
      if (filters.barangay && !barangay.toLowerCase().includes(filters.barangay.toLowerCase())) return false;
      if (filters.priority && getPriorityLabel(incident) !== filters.priority) return false;

      return true;
    });
  }, [incidents, filters]);

  const reviewIncident = useCallback((id) => {
    markIncidentReviewed(id);
    setIncidents((prev) => [...prev]);
  }, []);

  const openIncidentDetails = useCallback((incident) => {
    reviewIncident(incident.id);
    setSelectedIncident(incident);
  }, [reviewIncident]);

  const updateStatus = async (incident, newStatus, responderIds = selectedResponderIds[incident.id] || []) => {
    setProcessingId(incident.id);
    let reservedResponders = [];
    let dispatchesCreated = [];
    let selectedResponders = [];
    try {
      const updateData = { status: newStatus };

      if (newStatus === "ongoing") {
        if (!responderIds || responderIds.length === 0) {
          showAlert("Please assign at least one standby responder unit before dispatching.", { title: "Responder Required" });
          setProcessingId(null);
          return;
        }

        selectedResponders = responderIds.map((id) => availableResponders.find((r) => r.id === id)).filter(Boolean);

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
      }

      await pb.collection("incident_reports").update(incident.id, updateData);
      reviewIncident(incident.id);
      window.dispatchEvent(new Event("incident-handled"));

      const unitDescriptions = selectedResponders
        .map((r) => {
          const name = r.unit_name || `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.name || "Unit";
          return `${name} (${r.department || "Field Team"})`;
        })
        .join(", ");

      const priority = getPriorityLabel(incident);
      const locDisplay = incident.location || incident.barangay || "Barangay Lagonglong";

      const currentAdmin = pb.authStore.model;
      const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

      addAuditLog({
        action: "RESPONDER_DISPATCHED",
        target: `Incident #${incident.id} [${incident.type || "Emergency"}]`,
        details: `Administrator ${adminName} dispatched ${responderIds.length} responder unit(s) [${unitDescriptions}] to ${incident.type || "incident"} at ${locDisplay}. Priority level: ${priority}.`,
        actor: adminName,
      });

      setIncidents((prev) => prev.filter((i) => i.id !== incident.id));
      setSelectedIncident((current) => (current?.id === incident.id ? null : current));
      await fetchAvailableResponders();
      await showAlert(`Successfully dispatched ${responderIds.length} responder unit(s) to ${incident.type || "incident"}.`, { title: "Units Dispatched" });
    } catch (error) {
      console.error("Failed to update status:", error);
      for (const r of reservedResponders) {
        await pb.collection("responder_accounts").update(r.id, { is_available: true }).catch(() => {});
      }
      for (const d of dispatchesCreated) {
        await pb.collection("dispatches").delete(d.id).catch(() => {});
      }
      await showAlert("Failed to update status: " + (error.message || "Unknown error"), { title: "Dispatch Error" });
    }
    setProcessingId(null);
  };

  const getCategoryMeta = (type = "") => {
    const meta = getCategoryBadgeMeta(type, false, isDark);
    return {
      icon: <CustomIcon icon={meta.icon} size={17} color={meta.accent} />,
      bg: meta.bg,
      color: meta.color,
      border: meta.border,
      label: meta.label,
    };
  };

  const getPriorityBadge = (incident) => {
    const p = getPriorityLabel(incident);
    if (p === "Critical") return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
    if (p === "High") return { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
    if (p === "Elevated") return { bg: "#fefce8", color: "#854d0e", border: "#fef08a" };
    return { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" };
  };

  const typeOptions = useMemo(() => {
    const types = [...new Set(incidents.map((i) => i.type?.toLowerCase()).filter(Boolean))];
    return [
      { value: "", label: "All Incident Types" },
      ...types.map((type) => ({
        value: type,
        label: type.toUpperCase(),
      })),
    ];
  }, [incidents]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* HEADER */}
        <header style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span className="urgent-status-pulse" style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block" }} />
              <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: "800", color: "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
                Pending Incident Reports
              </h1>
            </div>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
              Review incoming citizen emergency reports, check location and details, and dispatch responders.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span
              className="pending-feed-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "20px",
                backgroundColor: filteredIncidents.length > 0 ? "#fef2f2" : "#f0fdf4",
                border: filteredIncidents.length > 0 ? "1px solid #fecaca" : "1px solid #bbf7d0",
                color: filteredIncidents.length > 0 ? "#b91c1c" : "#15803d",
                fontSize: "13px",
                fontWeight: "800",
              }}
            >
              <Radio size={14} />
              <span>{filteredIncidents.length} Pending Feed</span>
            </span>

            <button
              type="button"
              className="pending-refresh-btn"
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

        {/* TACTICAL FILTER BAR */}
        <div
          className="premium-table-card"
          style={{
            position: "relative",
            zIndex: 100,
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#15803d", fontWeight: "800", fontSize: "13px" }}>
            <SlidersHorizontal size={16} />
            <span>Filter Queue:</span>
          </div>

          <CustomDropdown
            minWidth="165px"
            value={filters.type}
            onChange={(type) => setFilters({ ...filters, type })}
            placeholder="All Incident Types"
            options={typeOptions}
          />

          <CustomDropdown
            minWidth="150px"
            value={filters.priority}
            onChange={(priority) => setFilters({ ...filters, priority })}
            placeholder="All Priorities"
            options={[
              { value: "", label: "All Priorities" },
              { value: "Critical", label: "Critical Priority" },
              { value: "High", label: "High Priority" },
              { value: "Elevated", label: "Elevated Priority" },
              { value: "Normal", label: "Normal Priority" },
            ]}
          />

          <PremiumSearchBar
            value={filters.barangay}
            onChange={(e) => setFilters({ ...filters, barangay: e.target.value })}
            onClear={() => setFilters({ ...filters, barangay: "" })}
            placeholder="Search by Barangay..."
            expandedWidth="280px"
          />

          {(filters.type || filters.priority || filters.barangay) && (
            <button
              type="button"
              className="pending-clear-filters-btn"
              onClick={() => setFilters({ type: "", priority: "", barangay: "" })}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#f8fafc",
                color: "#64748b",
                fontSize: "12.5px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* INCIDENT CARDS GRID */}
        {loading && incidents.length === 0 ? (
          <div style={{ padding: "80px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", color: "#15803d" }}>
            <Loader className="animate-spin" size={32} />
            <span style={{ fontWeight: "700", fontSize: "15px" }}>Loading pending emergency incidents...</span>
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
              <CheckCircle2 size={36} />
            </div>
            <h3 style={{ color: "#0f172a", fontSize: "20px", fontWeight: "800", margin: "0 0 8px 0" }}>
              Emergency Queue All Clear!
            </h3>
            <p style={{ margin: 0, fontSize: "14.5px", color: "#64748b", maxWidth: "440px", lineHeight: "1.5" }}>
              There are no pending emergency reports awaiting dispatch. New citizen submissions will stream here live with audio alerts.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: "22px" }}>
            {filteredIncidents.map((incident) => {
              const imgUrl = incident.incident_image ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_image}` : null;
              const videoUrl = incident.incident_video ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_video}` : null;
              const isNew = !isIncidentReviewed(incident.id);
              const cat = getCategoryMeta(incident.type);
              const priority = getPriorityBadge(incident);
              const selectedResponders = selectedResponderIds[incident.id] || [];
              const sameLocationCount = Number(incident.reporters_count) > 0 ? Number(incident.reporters_count) : 1;
              const reporter = incident.expand?.users || incident.expand?.user;
              const reporterAvatarUrl = reporter ? (
                (reporter.selfie ? pb.files.getURL(reporter, reporter.selfie) : null) ||
                (reporter.avatar ? pb.files.getURL(reporter, reporter.avatar) : null) ||
                (reporter.profile_picture ? pb.files.getURL(reporter, reporter.profile_picture) : null)
              ) : null;

              return (
                <div
                  key={incident.id}
                  className="premium-table-card"
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
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
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
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", textTransform: "uppercase" }}>
                            {incident.type || "EMERGENCY INCIDENT"}
                          </h3>
                          {isNew && (
                            <span style={{ fontSize: "10px", fontWeight: "800", backgroundColor: "#fee2e2", color: "#dc2626", padding: "1px 6px", borderRadius: "6px" }}>
                              NEW
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                          <Clock size={12} /> Waiting: {formatWaitTime(incident.created)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {/* Reporters Count Badge */}
                      <span
                        className="pending-reporter-count-badge"
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
                        style={{
                          fontSize: "11px",
                          fontWeight: "800",
                          padding: "3px 8px",
                          borderRadius: "10px",
                          backgroundColor: priority.bg,
                          color: priority.color,
                          border: `1px solid ${priority.border}`,
                          textTransform: "uppercase",
                        }}
                      >
                        {getPriorityLabel(incident)}
                      </span>
                    </div>
                  </div>

                  {/* High Reliability Multi-Resident Report Banner */}
                  {sameLocationCount > 1 && (
                    <div
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
                    className="pending-location-strip"
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
                        onClick={(e) => {
                          e.stopPropagation();
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

                  {/* Embedded Interactive Mini Map Preview (Satellite Mode) */}
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
                    className="pending-citizen-card"
                    onClick={() => openIncidentDetails(incident)}
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
                    <button
                      type="button"
                      className="pending-inspect-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openIncidentDetails(incident);
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        backgroundColor: "#ffffff",
                        color: "#334155",
                        fontSize: "11.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        flexShrink: 0,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Eye size={12} /> Inspect
                    </button>
                  </div>

                  {/* Media Evidence Previews */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div
                      onClick={() => imgUrl && setSelectedImage(imgUrl)}
                      style={{
                        height: "120px",
                        borderRadius: "10px",
                        backgroundColor: "#0f172a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: imgUrl ? "zoom-in" : "default",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      {imgUrl ? (
                        <>
                          <img src={imgUrl} alt="Evidence" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <div style={{ position: "absolute", bottom: "6px", right: "6px", backgroundColor: "rgba(0,0,0,0.65)", padding: "2px 6px", borderRadius: "4px", color: "#fff", fontSize: "10px", display: "flex", alignItems: "center", gap: "3px" }}>
                            <Maximize2 size={10} /> Photo
                          </div>
                        </>
                      ) : (
                        <span style={{ color: "#64748b", fontSize: "11.5px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <ImageIcon size={14} /> No photo
                        </span>
                      )}
                    </div>

                    <div
                      onClick={() => videoUrl && setSelectedImage(videoUrl)}
                      style={{
                        height: "120px",
                        borderRadius: "10px",
                        backgroundColor: "#0f172a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: videoUrl ? "zoom-in" : "default",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      {videoUrl ? (
                        <>
                          <video src={videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <div style={{ position: "absolute", bottom: "6px", right: "6px", backgroundColor: "rgba(0,0,0,0.65)", padding: "2px 6px", borderRadius: "4px", color: "#fff", fontSize: "10px", display: "flex", alignItems: "center", gap: "3px" }}>
                            <Activity size={10} /> Video
                          </div>
                        </>
                      ) : (
                        <span style={{ color: "#64748b", fontSize: "11.5px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Activity size={14} /> No video
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Responder Assignment Section */}
                  <div style={{ borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", paddingTop: "14px", display: "flex", flexDirection: "column", flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexShrink: 0 }}>
                      <label style={{ fontSize: "12px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", textTransform: "uppercase" }}>
                        Assign Standby Units ({selectedResponders.length})
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

                    {/* Responder List Checkboxes */}
                    <div
                      className="pending-responder-list-wrap"
                      style={{
                        flex: 1,
                        minHeight: "120px",
                        maxHeight: "320px",
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
                      ) : (() => {
                        const filtered = availableResponders.filter(
                          (r) => !departmentFilters[incident.id] || r.department === departmentFilters[incident.id]
                        );
                        if (filtered.length === 0) {
                          return <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#94a3b8", textAlign: "center", padding: "8px" }}>No responders in this department</span>;
                        }
                        return filtered.map((r) => {
                          const isSelected = selectedResponders.includes(r.id);
                          const displayName = `${r.unit_name ? `${r.unit_name} - ` : ""}${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email || "Responder";

                          return (
                            <div
                              key={r.id}
                              className={`pending-responder-item ${isSelected ? "selected" : ""}`}
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
                                gap: "10px",
                                padding: "7px 10px",
                                borderRadius: "8px",
                                backgroundColor: isSelected
                                  ? (isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4")
                                  : (isDark ? "#172338" : "#ffffff"),
                                border: isSelected
                                  ? "1.5px solid #22c55e"
                                  : (isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0"),
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                boxShadow: isSelected ? "0 2px 6px rgba(21, 128, 61, 0.15)" : "0 1px 2px rgba(0,0,0,0.02)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0, flex: 1 }}>
                                {/* Custom Checkbox */}
                                <div
                                  className={`pending-custom-checkbox ${isSelected ? "checked" : ""}`}
                                  style={{
                                    width: "18px",
                                    height: "18px",
                                    borderRadius: "5px",
                                    backgroundColor: isSelected
                                      ? "#15803d"
                                      : (isDark ? "#0c1322" : "#ffffff"),
                                    border: isSelected
                                      ? "none"
                                      : (isDark ? "1.5px solid rgba(255, 255, 255, 0.25)" : "1.5px solid #cbd5e1"),
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    transition: "all 0.15s ease",
                                  }}
                                >
                                  {isSelected && <Check size={12} strokeWidth={3.5} color="#ffffff" />}
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
                                  className={`pending-responder-name ${isSelected ? "selected" : ""}`}
                                  style={{
                                    fontSize: "12.5px",
                                    fontWeight: isSelected ? "800" : "600",
                                    color: isSelected
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
                        });
                      })()}
                    </div>
                  </div>

                  {/* Dispatch Action Buttons */}
                  <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
                    <button
                      type="button"
                      className={`pending-dispatch-btn ${selectedResponders.length > 0 ? "active" : "disabled"}`}
                      onClick={() => updateStatus(incident, "ongoing", selectedResponders)}
                      disabled={processingId === incident.id || selectedResponders.length === 0}
                      style={{
                        flex: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        padding: "10px 16px",
                        borderRadius: "10px",
                        border: "none",
                        background: selectedResponders.length > 0 ? "linear-gradient(135deg, #15803d 0%, #166534 100%)" : "#cbd5e1",
                        color: "#ffffff",
                        fontSize: "13px",
                        fontWeight: "800",
                        cursor: selectedResponders.length > 0 ? "pointer" : "not-allowed",
                        boxShadow: selectedResponders.length > 0 ? "0 4px 12px rgba(21, 128, 61, 0.25)" : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {processingId === incident.id ? <Loader className="animate-spin" size={15} /> : <Send size={15} />}
                      <span>{processingId === incident.id ? "Deploying..." : `Dispatch (${selectedResponders.length})`}</span>
                    </button>

                    <button
                      type="button"
                      className="pending-reject-btn"
                      onClick={async () => {
                        const shouldReject = await confirm("Permanently reject this emergency report or mark as false alarm?", {
                          title: "Reject Emergency Report",
                          primaryLabel: "Reject Report",
                          secondaryLabel: "Cancel",
                        });
                        if (shouldReject) {
                          setProcessingId(incident.id);
                          try {
                            const reporter = incident.expand?.users || incident.expand?.user;
                            const reporterName = reporter ? `${reporter.first_name || ""} ${reporter.last_name || ""}`.trim() : "Citizen";
                            const locDisplay = addresses[incident.id] || incident.location || incident.barangay || "Barangay Lagonglong";

                            const currentAdmin = pb.authStore.model;
                            const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

                            await pb.collection("incident_reports").delete(incident.id);

                            addAuditLog({
                              action: "REPORT_REJECTED",
                              target: `Incident #${incident.id} [${incident.type || "Emergency"}]`,
                              details: `Administrator ${adminName} rejected and deleted emergency incident report #${incident.id} (${(incident.type || "Emergency").toUpperCase()}) submitted by ${reporterName} at ${locDisplay}.`,
                              actor: adminName,
                            });

                            setIncidents((prev) => prev.filter((i) => i.id !== incident.id));
                            await showAlert("Incident report rejected and removed.", { title: "Report Rejected" });
                          } catch (err) {
                            await showAlert("Delete failed: " + (err.message || "Unknown error"), { title: "Error" });
                          }
                          setProcessingId(null);
                        }
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #fecaca",
                        backgroundColor: "#fef2f2",
                        color: "#b91c1c",
                        fontSize: "13px",
                        fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={15} />
                      <span>Reject</span>
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
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#f0fdf4", color: "#15803d", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>
                    Incident #{selectedIncident.id}
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
                  <strong>High Reliability:</strong> +{(Number(selectedIncident.reporters_count) || 1) - 1} more resident has reported this incident, which indicates this is a verified and highly reliable emergency report.
                </span>
              </div>
            )}

            {/* Reporter Full Data */}
            <div className="pending-reporter-box" style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "18px" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "800", color: "#0f172a", textTransform: "uppercase" }}>
                Reporter Profile
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", fontSize: "13px" }}>
                <div><span style={{ color: "#64748b" }}>Name:</span> <strong style={{ color: "#0f172a" }}>{selectedIncident.expand?.users?.first_name} {selectedIncident.expand?.users?.last_name}</strong></div>
                <div><span style={{ color: "#64748b" }}>Phone:</span> <strong style={{ color: "#0f172a" }}>{selectedIncident.expand?.users?.contact_number || "N/A"}</strong></div>
                <div><span style={{ color: "#64748b" }}>Reporters Count:</span> <strong style={{ color: "#b45309" }}>{Number(selectedIncident.reporters_count) || 1} resident(s)</strong></div>
                <div><span style={{ color: "#64748b" }}>Barangay:</span> <strong style={{ color: "#0f172a" }}>{selectedIncident.expand?.users?.baranggay || "Lagonglong"}</strong></div>
              </div>
            </div>

            {/* Incident Description / Notes */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "800", color: "#0f172a", textTransform: "uppercase" }}>
                Incident Details & Notes
              </h4>
              <div className="pending-notes-box" style={{ padding: "14px", borderRadius: "12px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", color: "#14532d", fontSize: "13.5px", lineHeight: "1.5" }}>
                {selectedIncident.description || selectedIncident.remarks || "No additional text description provided by citizen."}
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

      {/* FULLSCREEN EVIDENCE LIGHTBOX */}
      {selectedImage && (
        <AdvancedImageModal
          src={selectedImage}
          title="Incident Evidence Inspector"
          alt="Incident Evidence"
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}
