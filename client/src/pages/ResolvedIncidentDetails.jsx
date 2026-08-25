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
  Printer,
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
} from "lucide-react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { getReadableAddress } from "../utils/utils";

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
  record?.[field] ? pb.files.getURL(record, record[field]) : null;

const displayName = (user) =>
  `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Verified Resident";

export default function ResolvedIncidentDetails({ recordType = "incident" }) {
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

      const dispatches = await pb.collection("dispatches").getFullList({
        filter: `${recordType === "sos" ? "sos_id" : "incident_id"} = "${record.id}"`,
        expand: "responder_id",
        sort: "created",
        requestKey: null,
      });

      setIncident({ ...record, dispatches, recordType });

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

  const getCategoryMeta = (type = "", isSos = false) => {
    if (isSos) {
      return {
        icon: <Radio size={20} color="#ef4444" />,
        bg: "#fef2f2",
        color: "#b91c1c",
        border: "#fecaca",
        label: "CRITICAL SOS DISTRESS",
      };
    }
    const t = type.toLowerCase();
    if (t.includes("fire"))
      return {
        icon: <Flame size={20} color="#ef4444" />,
        bg: "#fef2f2",
        color: "#b91c1c",
        border: "#fecaca",
        label: "FIRE EMERGENCY",
      };
    if (t.includes("medical") || t.includes("health"))
      return {
        icon: <Ambulance size={20} color="#f97316" />,
        bg: "#fff7ed",
        color: "#c2410c",
        border: "#fed7aa",
        label: "MEDICAL RESPONSE",
      };
    if (t.includes("traffic") || t.includes("accident") || t.includes("car"))
      return {
        icon: <Car size={20} color="#15803d" />,
        bg: "#f0fdf4",
        color: "#15803d",
        border: "#bbf7d0",
        label: "TRAFFIC & ROAD ACCIDENT",
      };
    if (t.includes("flood") || t.includes("landslide") || t.includes("rescue"))
      return {
        icon: <ShieldAlert size={20} color="#0284c7" />,
        bg: "#f0f9ff",
        color: "#0369a1",
        border: "#bae6fd",
        label: "NATURAL DISASTER / RESCUE",
      };
    return {
      icon: <AlertOctagon size={20} color="#8b5cf6" />,
      bg: "#f5f3ff",
      color: "#6d28d9",
      border: "#ddd6fe",
      label: type ? type.toUpperCase() : "GENERAL INCIDENT",
    };
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
        <Sidebar />
        <main style={{ flex: 1, marginLeft: "216px", padding: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", color: "#15803d" }}>
            <Loader className="animate-spin" size={36} />
            <span style={{ fontSize: "15px", fontWeight: "700" }}>Loading Case Dossier #{incidentId}...</span>
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
              Incident Dossier Not Found
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
  const selfieUrl = fileUrl(reporter, "selfie");
  const cat = getCategoryMeta(incident.type, isSos);
  const reportersCount = Number(incident.reporters_count) > 0 ? Number(incident.reporters_count) : 1;
  const isResolved = (incident.status || "").toLowerCase() === "resolved";

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* TOP BREADCRUMB & ACTIONS BAR */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px", flexWrap: "wrap", gap: "12px" }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              color: "#334155",
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
              onClick={fetchIncidentData}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                color: "#475569",
                fontSize: "12.5px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={14} /> Refresh
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #15803d 0%, #166534 100%)",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: "800",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(21, 128, 61, 0.25)",
              }}
            >
              <Printer size={15} /> Print Official Case Dossier
            </button>
          </div>
        </div>

        {/* CASE HEADER BANNER */}
        <div
          className="premium-table-card"
          style={{
            padding: "24px 28px",
            marginBottom: "24px",
            borderLeft: `5px solid ${cat.color}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
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
              }}
            >
              {cat.icon}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "900", color: "#0f172a", letterSpacing: "-0.02em" }}>
                  Case #{incident.id}
                </h1>
                <span
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

              <div style={{ display: "flex", alignItems: "center", gap: "14px", color: "#64748b", fontSize: "13px", flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <CalendarDays size={14} /> Reported: {formatDate(incident.created)}
                </span>
                <span>•</span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={14} /> Resolved: {formatDate(incident.updated)}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {reportersCount > 1 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "12px",
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#15803d",
                  fontSize: "12.5px",
                  fontWeight: "800",
                }}
              >
                <ShieldCheck size={16} />
                +{reportersCount - 1} More Resident • High Reliability
              </span>
            )}

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "12px",
                backgroundColor: isResolved ? "#f0fdf4" : "#fff7ed",
                border: isResolved ? "1px solid #bbf7d0" : "1px solid #fed7aa",
                color: isResolved ? "#15803d" : "#c2410c",
                fontSize: "13px",
                fontWeight: "800",
                textTransform: "uppercase",
              }}
            >
              <CheckCircle2 size={16} />
              {incident.status || "Resolved"}
            </span>
          </div>
        </div>

        {/* 4-COLUMN KPI TELEMETRY STRIP */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <div className="premium-table-card" style={{ padding: "18px 20px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              Citizen Reporters
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a" }}>
                {reportersCount}
              </span>
              <span style={{ fontSize: "12px", color: reportersCount > 1 ? "#15803d" : "#64748b", fontWeight: "700" }}>
                {reportersCount > 1 ? "Verified Multi-Report" : "Single Resident Submission"}
              </span>
            </div>
          </div>

          <div className="premium-table-card" style={{ padding: "18px 20px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              Response Units Deployed
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "22px", fontWeight: "900", color: "#15803d" }}>
                {incident.dispatches?.length || (incident.assigned_department ? 1 : 0)}
              </span>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                Field Unit(s) Assigned
              </span>
            </div>
          </div>

          <div className="premium-table-card" style={{ padding: "18px 20px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              Incident Location
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Brgy. {reporter?.baranggay || reporter?.barangay || "Lagonglong"}
              </span>
            </div>
          </div>

          <div className="premium-table-card" style={{ padding: "18px 20px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              Case Operational Status
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#15803d", display: "inline-block" }} />
              <span style={{ fontSize: "14px", fontWeight: "800", color: "#15803d", textTransform: "uppercase" }}>
                Concluded & Closed
              </span>
            </div>
          </div>
        </div>

        {/* 2-COLUMN MAIN CONTENT GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(360px, 0.95fr)", gap: "24px", alignItems: "start" }}>
          {/* LEFT COLUMN: Operations, Description, Dispatches & Maps */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Incident Narrative & Resolution Card */}
            <div className="premium-table-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: "1px solid #f1f5f9", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
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
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#15803d",
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
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  color: "#334155",
                  fontSize: "14px",
                  lineHeight: "1.6",
                }}
              >
                {incident.description || incident.remarks || (
                  <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                    No specific written narrative provided with submission.
                  </span>
                )}
              </div>
            </div>

            {/* Response Units & Dispatch History Card */}
            <div className="premium-table-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: "1px solid #f1f5f9", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Navigation size={18} color="#15803d" /> Response Units & Dispatch Activity
                </h3>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>
                  {incident.dispatches?.length || 0} unit(s) recorded
                </span>
              </div>

              {incident.dispatches && incident.dispatches.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {incident.dispatches.map((dispatch) => {
                    const responder = dispatch.expand?.responder_id;
                    return (
                      <div
                        key={dispatch.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px 16px",
                          borderRadius: "12px",
                          backgroundColor: "#ffffff",
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "10px",
                              backgroundColor: "#f0fdf4",
                              color: "#15803d",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "800",
                              fontSize: "14px",
                            }}
                          >
                            <Building2 size={20} />
                          </div>
                          <div>
                            <strong style={{ fontSize: "14px", color: "#0f172a", display: "block" }}>
                              {responder ? displayName(responder) : `${dispatch.department || "Response"} Unit`}
                            </strong>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>
                              Unit: {responder?.unit_name || dispatch.department || "Field Team"} • {dispatch.department || "Emergency Services"}
                            </span>
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "800",
                              padding: "3px 8px",
                              borderRadius: "8px",
                              backgroundColor: "#f0fdf4",
                              color: "#15803d",
                              border: "1px solid #bbf7d0",
                              textTransform: "uppercase",
                              display: "inline-block",
                              marginBottom: "4px",
                            }}
                          >
                            {dispatch.status || "Resolved"}
                          </span>
                          {dispatch.response_time && (
                            <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                              Response: {dispatch.response_time}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8", fontSize: "13.5px" }}>
                  No field dispatch records attached to this case.
                </div>
              )}
            </div>

            {/* Satellite Map Telemetry Card */}
            {incident.latitude != null && incident.longitude != null && (
              <div className="premium-table-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: "1px solid #f1f5f9", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <MapPin size={18} color="#15803d" /> Geospatial Satellite Telemetry
                  </h3>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
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
                        border: "1px solid #cbd5e1",
                        backgroundColor: "#ffffff",
                        color: "#334155",
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
                        backgroundColor: "#15803d",
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
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    marginBottom: "14px",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <MapPin size={16} color="#15803d" style={{ flexShrink: 0 }} />
                  <span style={{ color: "#0f172a", fontWeight: "600" }}>
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
                    border: "1px solid #e2e8f0",
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
                      backgroundColor: "rgba(15, 23, 42, 0.75)",
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
            <div className="premium-table-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: "1px solid #f1f5f9", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <User size={18} color="#15803d" /> Resident Information
                </h3>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#15803d", backgroundColor: "#f0fdf4", padding: "2px 8px", borderRadius: "6px", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: "3px" }}>
                  <ShieldCheck size={12} /> Verified Resident
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "16px",
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#15803d",
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
                  <strong style={{ fontSize: "16px", color: "#0f172a", display: "block" }}>
                    {displayName(reporter)}
                  </strong>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Citizen ID: #{reporter?.user_id || reporter?.id || "N/A"}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "9px 12px", backgroundColor: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <span style={{ color: "#64748b", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "5px" }}>
                    <Phone size={12} color="#15803d" /> Contact Phone
                  </span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <strong style={{ color: "#0f172a", fontSize: "13.5px" }}>{reporter?.contact_number || "No contact registered"}</strong>
                    {reporter?.contact_number && (
                      <button
                        type="button"
                        onClick={() => copyPhoneNumber(reporter.contact_number)}
                        style={{ background: "none", border: "none", color: "#15803d", cursor: "pointer", fontSize: "11px", fontWeight: "800", padding: "2px 6px" }}
                      >
                        {copiedPhone ? <Check size={12} /> : "Copy"}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "9px 12px", backgroundColor: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <span style={{ color: "#64748b", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Barangay Jurisdiction</span>
                  <strong style={{ color: "#0f172a", fontSize: "13.5px" }}>{reporter?.baranggay || reporter?.barangay || "Lagonglong"}</strong>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "9px 12px", backgroundColor: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <span style={{ color: "#64748b", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>Full Registered Address</span>
                  <strong style={{ color: "#0f172a", fontSize: "13px", wordBreak: "break-word", overflowWrap: "anywhere", lineHeight: "1.4" }}>
                    {[reporter?.street_address, reporter?.municipality, reporter?.province].filter(Boolean).join(", ") || "Lagonglong, Misamis Oriental"}
                  </strong>
                </div>
              </div>
            </div>

            {/* Media Evidence Previews */}
            <div className="premium-table-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: "1px solid #f1f5f9", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <ImageIcon size={18} color="#15803d" /> Media Evidence
                </h3>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "6px" }}>
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
                    <div style={{ height: "140px", borderRadius: "10px", border: "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "12px" }}>
                      No image uploaded
                    </div>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "6px" }}>
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
                    <div style={{ height: "140px", borderRadius: "10px", border: "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "12px" }}>
                      No video uploaded
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Audit & Timestamps Metadata Card */}
            <div className="premium-table-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: "1px solid #f1f5f9", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <CalendarDays size={18} color="#15803d" /> Audit Timestamps
                </h3>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <span style={{ color: "#64748b" }}>Case Logged:</span>
                  <strong style={{ color: "#0f172a" }}>{formatDate(incident.created)}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <span style={{ color: "#64748b" }}>Resolved / Updated:</span>
                  <strong style={{ color: "#0f172a" }}>{formatDate(incident.updated)}</strong>
                </div>

                {incident.sync_key && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <span style={{ color: "#64748b" }}>Sync Key:</span>
                    <strong style={{ color: "#64748b", fontFamily: "monospace", fontSize: "11.5px" }}>{incident.sync_key}</strong>
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
              maxWidth: "780px",
              overflow: "hidden",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
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
              backgroundColor: "#ffffff",
              borderRadius: "22px",
              overflow: "hidden",
              boxShadow: "0 30px 90px -15px rgba(0, 0, 0, 0.7)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
              <span style={{ fontSize: "14px", fontWeight: "800", color: "#15803d", display: "flex", alignItems: "center", gap: "8px" }}>
                <ImageIcon size={16} /> Evidence Media Inspector
              </span>
              <button
                type="button"
                className="animatedCloseButton"
                onClick={() => setPreview(null)}
                style={{ width: "36px", height: "36px", borderRadius: "50%", border: "1px solid #e2e8f0", backgroundColor: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
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
