import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  ImageIcon,
  Loader,
  MapPin,
  Phone,
  PlayCircle,
  User,
  X,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Ambulance,
  Car,
  AlertOctagon,
  Radio,
  Clock,
  Maximize2,
  Users,
  Check,
  RotateCcw,
  Video,
  Building2,
  Navigation,
  Timer,
  Mountain,
  Shield,
} from "lucide-react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { useTheme } from "../themes/ThemeContext";
import { getReadableAddress } from "../utils/utils";
import { getIncidentResponseTime, getIncidentTimingMetrics } from "../utils/timeUtils";
import CustomIcon from "../components/CustomIcon";
import { getCategoryBadgeMeta, getDepartmentBadgeMeta } from "../utils/categoryIcons";

const formatDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const fileUrl = (record, field) =>
  record && record[field] ? pb.files.getURL(record, record[field]) : null;

const displayName = (user) => {
  if (!user) return "Citizen";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || user.email || "Citizen";
};

export default function ResolvedIncidentDetails({ recordType = "incident" }) {
  const { isDark } = useTheme();
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const [incident, setIncident] = useState(null);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const fetchIncidentData = useCallback(async () => {
    setLoading(true);
    try {
      const collectionName = recordType === "sos" ? "sos_tracking" : "incident_reports";
      const expand = recordType === "sos" ? "user,assigned_responder" : "users";
      const record = await pb.collection(collectionName).getOne(incidentId, {
        expand,
        requestKey: null,
      });

      const [dispatches, backupRequests] = await Promise.all([
        pb.collection("dispatches").getFullList({
          filter: `${recordType === "sos" ? "sos_id" : "incident_id"} = "${record.id}"`,
          expand: "responder_id",
          sort: "created",
          requestKey: null,
        }).catch(() => []),
        pb.collection("backup_requests").getFullList({
          filter: `${recordType === "sos" ? "sos_id" : "incident_id"} = "${record.id}"`,
          expand: "requester_id,assigned_responder,dispatch_id",
          sort: "created",
          requestKey: null,
        }).catch(() => []),
      ]);

      setIncident({ ...record, dispatches, backupRequests, recordType });

      if (record.latitude != null && record.longitude != null) {
        const addr = await getReadableAddress(record.latitude, record.longitude);
        setAddress(addr);
      }
    } catch (error) {
      if (!error.isAbort) console.error("Failed to load incident details:", error);
    } finally {
      setLoading(false);
    }
  }, [incidentId, recordType]);

  useEffect(() => {
    fetchIncidentData();
  }, [fetchIncidentData]);

  const copyPhoneNumber = (phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const getBackupStatusMeta = (status) => {
    const s = (status || "pending").toLowerCase();
    if (s === "completed" || s === "resolved") {
      return {
        bg: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
        color: isDark ? "#4ade80" : "#15803d",
        border: isDark ? "rgba(34, 197, 94, 0.35)" : "#bbf7d0",
        label: "Completed",
      };
    }
    if (s === "at_scene") {
      return {
        bg: isDark ? "rgba(37, 99, 235, 0.18)" : "#eff6ff",
        color: isDark ? "#60a5fa" : "#1d4ed8",
        border: isDark ? "rgba(37, 99, 235, 0.35)" : "#bfdbfe",
        label: "At Scene",
      };
    }
    if (s === "en_route") {
      return {
        bg: isDark ? "rgba(20, 184, 166, 0.18)" : "#f0fdfa",
        color: isDark ? "#2dd4bf" : "#0f766e",
        border: isDark ? "rgba(20, 184, 166, 0.35)" : "#99f6e4",
        label: "En Route",
      };
    }
    if (s === "accepted") {
      return {
        bg: isDark ? "rgba(245, 158, 11, 0.18)" : "#fffbeb",
        color: isDark ? "#fbbf24" : "#b45309",
        border: isDark ? "rgba(245, 158, 11, 0.35)" : "#fde68a",
        label: "Accepted",
      };
    }
    if (s === "assigned") {
      return {
        bg: isDark ? "rgba(168, 85, 247, 0.18)" : "#faf5ff",
        color: isDark ? "#c084fc" : "#7e22ce",
        border: isDark ? "rgba(168, 85, 247, 0.35)" : "#e9d5ff",
        label: "Assigned",
      };
    }
    if (s === "declined") {
      return {
        bg: isDark ? "rgba(239, 68, 68, 0.18)" : "#fef2f2",
        color: isDark ? "#f87171" : "#b91c1c",
        border: isDark ? "rgba(239, 68, 68, 0.35)" : "#fecaca",
        label: "Declined",
      };
    }
    return {
      bg: isDark ? "#172338" : "#f8fafc",
      color: isDark ? "#94a3b8" : "#475569",
      border: isDark ? "rgba(255, 255, 255, 0.12)" : "#cbd5e1",
      label: "Pending Response",
    };
  };

  const getBackupDeptBadge = (dept) => {
    const meta = getDepartmentBadgeMeta(dept, isDark);
    return {
      label: meta.label,
      shortLabel: meta.shortLabel,
      icon: <CustomIcon icon={meta.icon} size={12} color={meta.accent} />,
      bg: meta.bg,
      color: meta.color,
      border: meta.border,
    };
  };

  const getCategoryMeta = (incidentType = "", isSosDistress = false) => {
    const meta = getCategoryBadgeMeta(incidentType, isSosDistress, isDark);
    return {
      icon: <CustomIcon icon={meta.icon} size={20} color={meta.accent} />,
      bg: meta.bg,
      color: meta.color,
      border: meta.border,
      label: meta.label,
    };
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
        <Sidebar />
        <main style={{ flex: 1, marginLeft: "216px", padding: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", color: "#15803d" }}>
            <Loader className="animate-spin" size={36} />
            <span style={{ fontSize: "15px", fontWeight: "700" }}>Loading incident details...</span>
          </div>
        </main>
      </div>
    );
  }

  if (!incident) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
        <Sidebar />
        <main style={{ flex: 1, marginLeft: "216px", padding: "40px" }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 16px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              color: "#475569",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer",
              marginBottom: "24px",
            }}
          >
            <ArrowLeft size={16} /> Return Back
          </button>
          <div className="premium-table-card" style={{ padding: "40px", textAlign: "center" }}>
            <AlertOctagon size={48} color="#ef4444" style={{ marginBottom: "16px" }} />
            <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px 0" }}>
              Incident Details Not Found
            </h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              The requested incident record (#{incidentId}) could not be retrieved from the database.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const isSos = incident.recordType === "sos";
  const reporter = incident.expand?.users || incident.expand?.user;
  const imageUrl = fileUrl(incident, "incident_image");
  const videoUrl = fileUrl(incident, "incident_video");
  const selfieUrl = fileUrl(reporter, "selfie") || fileUrl(reporter, "avatar") || fileUrl(reporter, "profile_picture");
  const cat = getCategoryMeta(incident.type, isSos);
  const reportersCount = Number(incident.reporters_count) > 0 ? Number(incident.reporters_count) : 1;
  const isResolved = (incident.status || "").toLowerCase() === "resolved";
  const responseTime = getIncidentResponseTime(incident);
  const timing = getIncidentTimingMetrics(incident);

  const incidentLocation =
    address ||
    (incident.barangay || incident.baranggay || reporter?.baranggay || reporter?.barangay
      ? `Brgy. ${incident.barangay || incident.baranggay || reporter?.baranggay || reporter?.barangay}, Lagonglong`
      : null) ||
    incident.location ||
    (incident.latitude != null && incident.longitude != null
      ? `Coordinates (${Number(incident.latitude).toFixed(5)}, ${Number(incident.longitude).toFixed(5)})`
      : `Case #${incident.id}`);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: isDark ? "#0b0f19" : "#f8fafc", color: isDark ? "#f8fafc" : "#0f172a", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main className="resolved-details-main" style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* TOP BREADCRUMB & ACTIONS BAR */}
        <div className="resolved-details-top-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px", flexWrap: "wrap", gap: "12px" }}>
          <button
            type="button"
            className="details-back-btn"
            onClick={() => navigate(-1)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "10px",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
              backgroundColor: isDark ? "#172338" : "#ffffff",
              color: isDark ? "#cbd5e1" : "#334155",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <ArrowLeft size={16} /> Return to History
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              className="details-refresh-btn"
              onClick={fetchIncidentData}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "10px",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                backgroundColor: isDark ? "#172338" : "#ffffff",
                color: isDark ? "#cbd5e1" : "#475569",
                fontSize: "12.5px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* CASE HEADER BANNER */}
        <div
          className="premium-table-card resolved-header-card"
          style={{
            padding: "24px 28px",
            marginBottom: "24px",
            backgroundColor: isDark ? "#131c2e" : "#ffffff",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
            borderLeft: `5px solid ${cat.color}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "20px",
          }}
        >
          <div className="resolved-header-title-group" style={{ display: "flex", alignItems: "flex-start", gap: "16px", minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "16px",
                backgroundColor: cat.bg,
                border: `1px solid ${cat.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: "2px",
              }}
            >
              {cat.icon}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              {/* Overline with Case ID & Category */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "800",
                    padding: "3px 9px",
                    borderRadius: "6px",
                    backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                    color: isDark ? "#cbd5e1" : "#475569",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Case ID:</span>
                  <span style={{ fontFamily: "monospace", fontWeight: "700" }}>#{incident.id}</span>
                </span>

                <span
                  className={`details-type-badge type-${(incident.type || (isSos ? "sos" : "default")).toLowerCase()}`}
                  style={{
                    fontSize: "11px",
                    fontWeight: "800",
                    padding: "3px 10px",
                    borderRadius: "20px",
                    backgroundColor: cat.bg,
                    color: cat.color,
                    border: `1px solid ${cat.border}`,
                    textTransform: "uppercase",
                  }}
                >
                  {cat.label}
                </span>
              </div>

              {/* Main Incident Location */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                <MapPin size={20} color={isDark ? "#4ade80" : "#15803d"} style={{ flexShrink: 0, marginTop: "3px" }} />
                <h1 style={{ margin: 0, fontSize: "clamp(17px, 2.2vw, 21px)", fontWeight: "900", color: isDark ? "#f8fafc" : "#0f172a", letterSpacing: "-0.02em", lineHeight: "1.3" }}>
                  {incidentLocation}
                </h1>
              </div>

              {/* Metadata row */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", color: isDark ? "#94a3b8" : "#64748b", fontSize: "12.5px", flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <CalendarDays size={13} /> Reported: {formatDate(incident.created)}
                </span>
                <span>•</span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={13} /> Resolved: {formatDate(incident.updated)}
                </span>
                <span>•</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: isDark ? "#2dd4bf" : "#0f766e", fontWeight: "800", backgroundColor: isDark ? "rgba(20, 184, 166, 0.16)" : "#f0fdfa", padding: "2px 8px", borderRadius: "6px", border: isDark ? "1px solid rgba(20, 184, 166, 0.35)" : "1px solid #99f6e4" }}>
                  <Timer size={12} color={isDark ? "#2dd4bf" : "#0d9488"} /> Response Time: {responseTime}
                </span>
              </div>
            </div>
          </div>

          <div className="resolved-header-badge-group" style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, marginTop: "2px" }}>
            {reportersCount > 1 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "12px",
                  backgroundColor: isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4",
                  border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0",
                  color: isDark ? "#4ade80" : "#15803d",
                  fontSize: "12px",
                  fontWeight: "800",
                }}
              >
                <ShieldCheck size={15} />
                +{reportersCount - 1} More Resident • High Reliability
              </span>
            )}

            <span
              className="details-status-pill"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "12px",
                backgroundColor: isResolved
                  ? (isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4")
                  : (isDark ? "rgba(249, 115, 22, 0.18)" : "#fff7ed"),
                border: isResolved
                  ? (isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0")
                  : (isDark ? "1px solid rgba(249, 115, 22, 0.35)" : "1px solid #fed7aa"),
                color: isResolved
                  ? (isDark ? "#4ade80" : "#15803d")
                  : (isDark ? "#fb923c" : "#c2410c"),
                fontSize: "12.5px",
                fontWeight: "800",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={16} />
              {incident.status || "Resolved"}
            </span>
          </div>
        </div>

        {/* 5-COLUMN KPI TELEMETRY STRIP */}
        <div className="resolved-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "16px", marginBottom: "24px" }}>
          {/* Card 1: Response & Resolution Time */}
          <div className="premium-table-card" style={{ padding: "18px 20px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              Responder Response Time
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "22px", fontWeight: "900", color: isDark ? "#2dd4bf" : "#0f766e" }}>
                {responseTime}
              </span>
              <span style={{ fontSize: "12px", color: incident.response_time ? (isDark ? "#4ade80" : "#15803d") : (isDark ? "#94a3b8" : "#64748b"), fontWeight: "600" }}>
                {incident.response_time ? "Responder Uploaded" : (timing.dispatchDuration ? `Dispatched: ${timing.dispatchDuration}` : "Turnaround Time")}
              </span>
            </div>
          </div>

          {/* Card 2: Citizen Reporters */}
          <div className="premium-table-card" style={{ padding: "18px 20px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              Citizen Reporters
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "22px", fontWeight: "900", color: isDark ? "#f8fafc" : "#0f172a" }}>
                {reportersCount}
              </span>
              <span style={{ fontSize: "12px", color: reportersCount > 1 ? (isDark ? "#4ade80" : "#15803d") : (isDark ? "#94a3b8" : "#64748b"), fontWeight: "700" }}>
                {reportersCount > 1 ? "Verified Multi-Report" : "Single Resident Submission"}
              </span>
            </div>
          </div>

          {/* Card 3: Response Units Deployed */}
          <div className="premium-table-card" style={{ padding: "18px 20px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              Units Deployed
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "22px", fontWeight: "900", color: isDark ? "#4ade80" : "#15803d" }}>
                {incident.dispatches?.length || (incident.assigned_department ? 1 : 0)}
              </span>
              <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600" }}>
                Field Unit(s) Assigned
              </span>
            </div>
          </div>

          {/* Card 4: Location */}
          <div className="premium-table-card" style={{ padding: "18px 20px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              Incident Location
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span style={{ fontSize: "14px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Brgy. {reporter?.baranggay || reporter?.barangay || "Lagonglong"}
              </span>
            </div>
          </div>

          {/* Card 5: Operational Status */}
          <div className="premium-table-card" style={{ padding: "18px 20px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              Case Operational Status
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#15803d", display: "inline-block" }} />
              <span style={{ fontSize: "14px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d", textTransform: "uppercase" }}>
                Concluded & Closed
              </span>
            </div>
          </div>
        </div>

        {/* 2-COLUMN MAIN CONTENT GRID */}
        <div className="resolved-details-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(min(100%, 360px), 0.95fr)", gap: "24px", alignItems: "start" }}>
          {/* LEFT COLUMN: Operations, Description, Dispatches & Maps */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Incident Narrative & Resolution Card */}
            <div className="premium-table-card" style={{ padding: "24px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FileText size={18} color="#15803d" /> Incident Description & Field Notes
                </h3>
              </div>

              {reportersCount > 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    backgroundColor: isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4",
                    border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0",
                    color: isDark ? "#4ade80" : "#15803d",
                    fontSize: "13px",
                    fontWeight: "700",
                    marginBottom: "16px",
                  }}
                >
                  <ShieldCheck size={20} color="#15803d" style={{ flexShrink: 0 }} />
                  <span>
                    <strong>High Reliability Multi-Resident Report:</strong> +{reportersCount - 1} more resident has independently reported this same emergency site, confirming operational accuracy.
                  </span>
                </div>
              )}

              <div
                className="details-description-box"
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  backgroundColor: isDark ? "#172338" : "#f8fafc",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                  color: isDark ? "#cbd5e1" : "#334155",
                  fontSize: "14px",
                  lineHeight: "1.6",
                }}
              >
                {incident.description || incident.remarks || (
                  <span style={{ color: isDark ? "#94a3b8" : "#94a3b8", fontStyle: "italic" }}>
                    No specific written narrative provided with submission.
                  </span>
                )}
              </div>
            </div>

            {/* Response Units & Dispatch History Card */}
            <div className="premium-table-card" style={{ padding: "24px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Navigation size={18} color="#15803d" /> Response Units & Dispatch Activity
                </h3>
                <span style={{ fontSize: "12px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b" }}>
                  {incident.dispatches?.length || 0} unit(s) recorded
                </span>
              </div>

              {incident.dispatches && incident.dispatches.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {incident.dispatches.map((dispatch) => {
                    const responder = dispatch.expand?.responder_id;
                    const dResponseTime = dispatch.response_time
                      ? (/^\d+$/.test(String(dispatch.response_time).trim()) ? `${dispatch.response_time} mins` : String(dispatch.response_time).trim())
                      : (incident.response_time ? String(incident.response_time).trim() : (timing.resolutionDuration || "N/A"));

                    return (
                      <div
                        key={dispatch.id}
                        className="details-dispatch-item"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          padding: "16px 18px",
                          borderRadius: "12px",
                          backgroundColor: isDark ? "#172338" : "#ffffff",
                          border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                          gap: "12px",
                        }}
                      >
                        {/* Top Dispatch Info & Status Row */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "14px",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "200px" }}>
                            <div
                              style={{
                                width: "42px",
                                height: "42px",
                                borderRadius: "10px",
                                backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
                                color: isDark ? "#4ade80" : "#15803d",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: "800",
                                fontSize: "14px",
                                border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0",
                                flexShrink: 0,
                              }}
                            >
                              <Building2 size={20} />
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <strong style={{ fontSize: "14px", color: isDark ? "#f8fafc" : "#0f172a" }}>
                                  {responder ? displayName(responder) : `${dispatch.department || "Response"} Unit`}
                                </strong>
                                {dispatch.is_primary_responder && (
                                  <span style={{ fontSize: "10px", fontWeight: "800", color: isDark ? "#60a5fa" : "#2563eb", backgroundColor: isDark ? "rgba(37, 99, 235, 0.2)" : "#eff6ff", padding: "1px 6px", borderRadius: "4px", border: isDark ? "1px solid rgba(37, 99, 235, 0.4)" : "1px solid #dbeafe" }}>
                                    Primary Unit
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", display: "block", marginTop: "2px" }}>
                                Unit: {responder?.unit_name || dispatch.department || "Field Team"} • {(dispatch.department || "Emergency Services").toUpperCase()}
                              </span>
                            </div>
                          </div>

                          {/* Individual Response Time & Status Container */}
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                            {/* Individual Response Time */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  fontSize: "12px",
                                  fontWeight: "800",
                                  color: isDark ? "#2dd4bf" : "#0f766e",
                                  backgroundColor: isDark ? "rgba(20, 184, 166, 0.16)" : "#f0fdfa",
                                  border: isDark ? "1px solid rgba(20, 184, 166, 0.35)" : "1px solid #99f6e4",
                                  padding: "4px 10px",
                                  borderRadius: "8px",
                                }}
                              >
                                <Clock size={13} color={isDark ? "#2dd4bf" : "#0d9488"} />
                                Response Time: {dResponseTime}
                              </span>
                              {dispatch.response_time && (
                                <span style={{ fontSize: "10px", color: isDark ? "#4ade80" : "#15803d", fontWeight: "700" }}>
                                  Recorded in Dispatch Database
                                </span>
                              )}
                            </div>

                            {/* Status Badge */}
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: "800",
                                padding: "4px 10px",
                                borderRadius: "8px",
                                backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
                                color: isDark ? "#4ade80" : "#15803d",
                                border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0",
                                textTransform: "uppercase",
                                display: "inline-block",
                              }}
                            >
                              {dispatch.status || "Resolved"}
                            </span>
                          </div>
                        </div>

                        {/* Responder Resolution Report / Field Notes */}
                        {dispatch.description ? (
                          <div
                            style={{
                              width: "100%",
                              marginTop: "2px",
                              padding: "12px 16px",
                              borderRadius: "10px",
                              backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
                              borderLeft: isDark ? "4px solid #4ade80" : "4px solid #15803d",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", fontSize: "11px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                              <FileText size={13} color={isDark ? "#4ade80" : "#15803d"} />
                              Responder Resolution Input & Field Summary:
                            </div>
                            <div style={{ fontSize: "13.5px", color: isDark ? "#e2e8f0" : "#1e293b", lineHeight: "1.55", whiteSpace: "pre-wrap" }}>
                              {dispatch.description}
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: "11.5px", color: isDark ? "#94a3b8" : "#94a3b8", fontStyle: "italic", paddingLeft: "4px" }}>
                            No individual resolution narrative recorded by this responder.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: "30px", textAlign: "center", color: isDark ? "#94a3b8" : "#94a3b8", fontSize: "13.5px" }}>
                  No field dispatch records attached to this case.
                </div>
              )}
            </div>

            {/* Backup & Reinforcement Dispatches Card */}
            <div className="premium-table-card" style={{ padding: "24px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Users size={18} color={isDark ? "#60a5fa" : "#2563eb"} /> Backup Dispatches & Reinforcement Activity
                </h3>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "800",
                    color: incident.backupRequests?.length > 0 ? (isDark ? "#60a5fa" : "#2563eb") : (isDark ? "#94a3b8" : "#64748b"),
                    backgroundColor: incident.backupRequests?.length > 0 ? (isDark ? "rgba(37, 99, 235, 0.2)" : "#eff6ff") : (isDark ? "#172338" : "#f1f5f9"),
                    padding: "3px 9px",
                    borderRadius: "8px",
                    border: incident.backupRequests?.length > 0 ? (isDark ? "1px solid rgba(37, 99, 235, 0.4)" : "1px solid #bfdbfe") : (isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0"),
                  }}
                >
                  {incident.backupRequests?.length || 0} Backup Deployment(s)
                </span>
              </div>

              {incident.backupRequests && incident.backupRequests.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {incident.backupRequests.map((bReq) => {
                    const requester = bReq.expand?.requester_id;
                    const assignedResp = bReq.expand?.assigned_responder;
                    const statusMeta = getBackupStatusMeta(bReq.dispatch_status);
                    const deptMeta = getBackupDeptBadge(bReq.department);

                    return (
                      <div
                        key={bReq.id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          padding: "16px 18px",
                          borderRadius: "12px",
                          backgroundColor: isDark ? "#172338" : "#ffffff",
                          border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                          gap: "14px",
                        }}
                      >
                        {/* Header Row: Department, Status & Timestamp */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            {/* Requested Department Badge */}
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "4px 10px",
                                borderRadius: "8px",
                                fontSize: "12px",
                                fontWeight: "800",
                                backgroundColor: deptMeta.bg,
                                color: deptMeta.color,
                                border: `1px solid ${deptMeta.border}`,
                                textTransform: "uppercase",
                              }}
                            >
                              {deptMeta.icon}
                              Requested: {deptMeta.label}
                            </span>

                            {/* Status Badge */}
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 10px",
                                borderRadius: "8px",
                                fontSize: "11.5px",
                                fontWeight: "800",
                                backgroundColor: statusMeta.bg,
                                color: statusMeta.color,
                                border: `1px solid ${statusMeta.border}`,
                                textTransform: "uppercase",
                              }}
                            >
                              {statusMeta.label}
                            </span>
                          </div>

                          <div style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={13} color={isDark ? "#94a3b8" : "#94a3b8"} /> Requested: {formatDate(bReq.created)}
                          </div>
                        </div>

                        {/* Reason / Urgent Need Callout */}
                        {bReq.reason && (
                          <div
                            style={{
                              padding: "12px 14px",
                              borderRadius: "10px",
                              backgroundColor: isDark ? "rgba(239, 68, 68, 0.16)" : "#fef2f2",
                              border: isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fee2e2",
                              borderLeft: "4px solid #ef4444",
                            }}
                          >
                            <span style={{ fontSize: "11px", fontWeight: "800", color: isDark ? "#f87171" : "#b91c1c", textTransform: "uppercase", display: "block", marginBottom: "3px" }}>
                              Reason for Reinforcement Request:
                            </span>
                            <span style={{ fontSize: "13.5px", color: isDark ? "#fca5a5" : "#991b1b", fontWeight: "600", lineHeight: "1.5" }}>
                              {bReq.reason}
                            </span>
                          </div>
                        )}

                        {/* 2-Column Requester vs Assigned Reinforcement Card */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
                          {/* Originating Requester */}
                          <div
                            style={{
                              padding: "12px 14px",
                              borderRadius: "10px",
                              backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
                            }}
                          >
                            <span style={{ fontSize: "11px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                              Originating Lead Responder
                            </span>
                            <strong style={{ fontSize: "13.5px", color: isDark ? "#f8fafc" : "#0f172a", display: "block" }}>
                              {requester ? displayName(requester) : "Primary Field Responder"}
                            </strong>
                            <div style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", marginTop: "2px" }}>
                              Unit: {requester?.unit_name || (requester?.department ? `${requester.department.toUpperCase()} Team` : "Field Unit")}
                              {requester?.contact_number && ` • 📞 ${requester.contact_number}`}
                            </div>
                          </div>

                          {/* Assigned Backup Responder */}
                          <div
                            style={{
                              padding: "12px 14px",
                              borderRadius: "10px",
                              backgroundColor: assignedResp ? (isDark ? "rgba(34, 197, 94, 0.12)" : "#f0fdf4") : (isDark ? "#0f172a" : "#f8fafc"),
                              border: assignedResp ? (isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #dcfce7") : (isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9"),
                            }}
                          >
                            <span style={{ fontSize: "11px", fontWeight: "700", color: assignedResp ? (isDark ? "#4ade80" : "#15803d") : (isDark ? "#94a3b8" : "#64748b"), textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                              Assigned Backup Unit
                            </span>
                            {assignedResp ? (
                              <>
                                <strong style={{ fontSize: "13.5px", color: isDark ? "#f8fafc" : "#0f172a", display: "block" }}>
                                  {displayName(assignedResp)}
                                </strong>
                                <div style={{ fontSize: "12px", color: isDark ? "#4ade80" : "#15803d", fontWeight: "600", marginTop: "2px" }}>
                                  Unit: {assignedResp.unit_name || `${assignedResp.department?.toUpperCase()} Backup`}
                                  {assignedResp.contact_number && ` • 📞 ${assignedResp.contact_number}`}
                                </div>
                                {bReq.accepted_at && (
                                  <div style={{ fontSize: "11px", color: isDark ? "#94a3b8" : "#64748b", marginTop: "4px" }}>
                                    Accepted at: {bReq.accepted_at}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span style={{ fontSize: "12.5px", color: isDark ? "#94a3b8" : "#94a3b8", fontStyle: "italic" }}>
                                Awaiting responder assignment / acceptance
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Backup Responder After-Action Report */}
                        {bReq.responder_report && (
                          <div
                            style={{
                              padding: "12px 14px",
                              borderRadius: "10px",
                              backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
                              borderLeft: isDark ? "4px solid #60a5fa" : "4px solid #2563eb",
                            }}
                          >
                            <span style={{ fontSize: "11px", fontWeight: "800", color: isDark ? "#60a5fa" : "#2563eb", textTransform: "uppercase", display: "block", marginBottom: "3px" }}>
                              Backup Responder Field Notes & Report:
                            </span>
                            <div style={{ fontSize: "13px", color: isDark ? "#e2e8f0" : "#1e293b", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
                              {bReq.responder_report}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: "24px 16px", textAlign: "center", color: isDark ? "#94a3b8" : "#64748b", fontSize: "13.5px", backgroundColor: isDark ? "#172338" : "#f8fafc", borderRadius: "10px", border: isDark ? "1px dashed rgba(255, 255, 255, 0.15)" : "1px dashed #cbd5e1" }}>
                  No secondary backup reinforcements were requested for this incident. Handled fully by initial dispatch.
                </div>
              )}
            </div>

            {/* Satellite Map Telemetry Card */}
            {incident.latitude != null && incident.longitude != null && (
              <div className="premium-table-card" style={{ padding: "24px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <MapPin size={18} color="#15803d" /> Geospatial Satellite Telemetry
                  </h3>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="details-map-fullscreen-btn"
                      onClick={() =>
                        setSelectedMap({
                          lat: incident.latitude,
                          lng: incident.longitude,
                          address: address || `Coordinates (${incident.latitude}, ${incident.longitude})`,
                        })
                      }
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                        backgroundColor: isDark ? "#172338" : "#ffffff",
                        color: isDark ? "#cbd5e1" : "#334155",
                        fontSize: "12px",
                        fontWeight: "700",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Maximize2 size={13} /> Fullscreen
                    </button>

                    <a
                      href={`https://www.google.com/maps?q=${incident.latitude},${incident.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: isDark ? "#15803d" : "#15803d",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: "700",
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <ExternalLink size={13} /> Open Maps
                    </a>
                  </div>
                </div>

                <div
                  className="details-telemetry-address-strip"
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    backgroundColor: isDark ? "#172338" : "#f8fafc",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                    marginBottom: "14px",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <MapPin size={16} color="#15803d" style={{ flexShrink: 0 }} />
                  <span style={{ color: isDark ? "#f8fafc" : "#0f172a", fontWeight: "600" }}>
                    {address || `GPS Coordinates (${incident.latitude.toFixed(6)}, ${incident.longitude.toFixed(6)})`}
                  </span>
                </div>

                <div
                  onClick={() =>
                    setSelectedMap({
                      lat: incident.latitude,
                      lng: incident.longitude,
                      address: address || `Coordinates (${incident.latitude}, ${incident.longitude})`,
                    })
                  }
                  style={{
                    height: "260px",
                    borderRadius: "14px",
                    overflow: "hidden",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                    position: "relative",
                    cursor: "pointer",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  <iframe
                    title="Incident Location Map"
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
                      bottom: "10px",
                      right: "10px",
                      backgroundColor: "rgba(15, 23, 42, 0.8)",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "5px 12px",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <Maximize2 size={13} /> Click to Enlarge Map
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Reporter Dossier, Media Inspection & Timestamps */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Citizen Reporter Card */}
            <div className="premium-table-card" style={{ padding: "24px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <User size={18} color="#15803d" /> Resident Information
                </h3>
                <span style={{ fontSize: "11px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d", backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4", padding: "2px 8px", borderRadius: "6px", border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: "3px" }}>
                  <ShieldCheck size={12} /> Verified Resident
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "16px",
                    backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
                    border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0",
                    color: isDark ? "#4ade80" : "#15803d",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "900",
                    fontSize: "18px",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {selfieUrl ? (
                    <img src={selfieUrl} alt="Reporter Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    displayName(reporter).slice(0, 2).toUpperCase()
                  )}
                </div>

                <div>
                  <strong style={{ fontSize: "16px", color: isDark ? "#f8fafc" : "#0f172a", display: "block" }}>
                    {displayName(reporter)}
                  </strong>
                  <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>
                    Citizen ID: #{reporter?.user_id || reporter?.id || "N/A"}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                <div className="details-resident-info-field" style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "9px 12px", backgroundColor: isDark ? "#172338" : "#f8fafc", borderRadius: "10px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
                  <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "5px" }}>
                    <Phone size={12} color="#15803d" /> Contact Phone
                  </span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <strong style={{ color: isDark ? "#f8fafc" : "#0f172a", fontSize: "13.5px" }}>{reporter?.contact_number || "No contact registered"}</strong>
                    {reporter?.contact_number && (
                      <button
                        type="button"
                        onClick={() => copyPhoneNumber(reporter.contact_number)}
                        style={{ background: "none", border: "none", color: isDark ? "#4ade80" : "#15803d", cursor: "pointer", fontSize: "11px", fontWeight: "800", padding: "2px 6px" }}
                      >
                        {copiedPhone ? <Check size={12} /> : "Copy"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="details-resident-info-field" style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "9px 12px", backgroundColor: isDark ? "#172338" : "#f8fafc", borderRadius: "10px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
                  <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Barangay Jurisdiction</span>
                  <strong style={{ color: isDark ? "#f8fafc" : "#0f172a", fontSize: "13.5px" }}>{reporter?.baranggay || reporter?.barangay || "Lagonglong"}</strong>
                </div>

                <div className="details-resident-info-field" style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "9px 12px", backgroundColor: isDark ? "#172338" : "#f8fafc", borderRadius: "10px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
                  <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Full Registered Address</span>
                  <strong style={{ color: isDark ? "#f8fafc" : "#0f172a", fontSize: "13px", wordBreak: "break-word", overflowWrap: "anywhere", lineHeight: "1.4" }}>
                    {[reporter?.street_address, reporter?.municipality, reporter?.province].filter(Boolean).join(", ") || "Lagonglong, Misamis Oriental"}
                  </strong>
                </div>
              </div>
            </div>

            {/* Media Evidence Previews */}
            <div className="premium-table-card" style={{ padding: "24px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <ImageIcon size={18} color="#15803d" /> Media Evidence
                </h3>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <span style={{ fontSize: "11.5px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", display: "block", marginBottom: "6px" }}>
                    Incident Photo
                  </span>
                  {imageUrl ? (
                    <div
                      onClick={() => setPreview({ url: imageUrl, video: false })}
                      style={{
                        height: "140px",
                        borderRadius: "10px",
                        overflow: "hidden",
                        backgroundColor: "#070b14",
                        cursor: "zoom-in",
                        position: "relative",
                      }}
                    >
                      <img src={imageUrl} alt="Incident evidence" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", bottom: "6px", right: "6px", backgroundColor: "rgba(0,0,0,0.65)", color: "#fff", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", display: "flex", alignItems: "center", gap: "3px" }}>
                        <Maximize2 size={10} /> Enlarge
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: "140px", borderRadius: "10px", border: isDark ? "1px dashed rgba(255, 255, 255, 0.15)" : "1px dashed #cbd5e1", backgroundColor: isDark ? "#172338" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: isDark ? "#94a3b8" : "#94a3b8", fontSize: "12px" }}>
                      No image uploaded
                    </div>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: "11.5px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", display: "block", marginBottom: "6px" }}>
                    Incident Video
                  </span>
                  {videoUrl ? (
                    <div
                      onClick={() => setPreview({ url: videoUrl, video: true })}
                      style={{
                        height: "140px",
                        borderRadius: "10px",
                        overflow: "hidden",
                        backgroundColor: "#070b14",
                        cursor: "zoom-in",
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <video src={videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <PlayCircle size={32} color="#ffffff" style={{ position: "absolute" }} />
                    </div>
                  ) : (
                    <div style={{ height: "140px", borderRadius: "10px", border: isDark ? "1px dashed rgba(255, 255, 255, 0.15)" : "1px dashed #cbd5e1", backgroundColor: isDark ? "#172338" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: isDark ? "#94a3b8" : "#94a3b8", fontSize: "12px" }}>
                      No video uploaded
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Audit & Timestamps Metadata Card */}
            <div className="premium-table-card" style={{ padding: "24px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <CalendarDays size={18} color="#15803d" /> Audit Timestamps
                </h3>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                <div className="details-timestamp-item" style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", backgroundColor: isDark ? "#172338" : "#f8fafc", borderRadius: "8px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
                  <span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Case Logged:</span>
                  <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{formatDate(incident.created)}</strong>
                </div>

                <div className="details-timestamp-item" style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", backgroundColor: isDark ? "#172338" : "#f8fafc", borderRadius: "8px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
                  <span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Resolved / Updated:</span>
                  <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{formatDate(incident.updated)}</strong>
                </div>

                {incident.sync_key && (
                  <div className="details-timestamp-item" style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", backgroundColor: isDark ? "#172338" : "#f8fafc", borderRadius: "8px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
                    <span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Sync Key:</span>
                    <strong style={{ color: isDark ? "#94a3b8" : "#64748b", fontFamily: "monospace", fontSize: "11.5px" }}>{incident.sync_key}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FULLSCREEN SATELLITE MAP LIGHTBOX */}
      {selectedMap && (
        <div
          className="lightboxModalBackdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.8)",
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
              maxWidth: "780px",
              overflow: "hidden",
              border: isDark ? "1px solid rgba(255,255,255,0.1)" : "none",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", backgroundColor: isDark ? "#172338" : "#f8fafc" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin size={17} color="#15803d" /> {selectedMap.address}
              </h3>
              <button
                type="button"
                className="animatedCloseButton"
                onClick={() => setSelectedMap(null)}
                style={{ width: "34px", height: "34px", borderRadius: "50%", border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0", backgroundColor: isDark ? "#1e293b" : "#fff", color: isDark ? "#f8fafc" : "#0f172a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} />
              </button>
            </div>
            <iframe
              title="Full Satellite Map"
              width="100%"
              height="500px"
              frameBorder="0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${selectedMap.lat},${selectedMap.lng}&z=17&t=k&output=embed`}
              style={{ border: 0 }}
            />
          </div>
        </div>
      )}

      {/* FULLSCREEN EVIDENCE LIGHTBOX */}
      {preview && (
        <div
          className="lightboxModalBackdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(14px)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "24px",
          }}
          onClick={() => setPreview(null)}
        >
          <div
            className="lightboxModalCard"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "800px",
              backgroundColor: isDark ? "#131c2e" : "#ffffff",
              borderRadius: "22px",
              overflow: "hidden",
              border: isDark ? "1px solid rgba(255,255,255,0.1)" : "none",
              boxShadow: "0 30px 90px -15px rgba(0, 0, 0, 0.7)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", backgroundColor: isDark ? "#172338" : "#f8fafc" }}>
              <span style={{ fontSize: "14px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d", display: "flex", alignItems: "center", gap: "8px" }}>
                <ImageIcon size={16} /> Evidence Media Inspector
              </span>
              <button
                type="button"
                className="animatedCloseButton"
                onClick={() => setPreview(null)}
                style={{ width: "36px", height: "36px", borderRadius: "50%", border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0", backgroundColor: isDark ? "#1e293b" : "#fff", color: isDark ? "#f8fafc" : "#0f172a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={17} />
              </button>
            </div>
            <div style={{ height: "540px", maxHeight: "78vh", backgroundColor: "#070b14", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
              {preview.video ? (
                <video src={preview.url} controls autoPlay style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: "10px" }} />
              ) : (
                <img src={preview.url} alt="Incident evidence enlarged" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "10px" }} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
