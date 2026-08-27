import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  Loader,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
  Calendar,
  Mail,
  Building,
  Check,
  AlertTriangle,
  History,
  Maximize2,
  ExternalLink,
  Flame,
  Ambulance,
  Car,
  AlertOctagon,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { useMessageBox } from "../components/MessageBox";
import { useTheme } from "../themes/ThemeContext";
import { getReadableAddress } from "../utils/utils";

const getFileUrl = (record, field) =>
  record?.[field] ? pb.files.getURL(record, record[field]) : null;

const formatDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
};

const DetailRow = ({ label, value, fullWidth = false, isDark = false }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      padding: "10px 14px",
      borderRadius: "10px",
      backgroundColor: isDark ? "#172338" : "#f8fafc",
      border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
      minWidth: 0,
      gridColumn: fullWidth ? "1 / -1" : "auto",
    }}
  >
    <span
      style={{
        fontSize: "11px",
        color: isDark ? "#94a3b8" : "#64748b",
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      }}
    >
      {label}
    </span>
    <strong
      style={{
        fontSize: "13.5px",
        color: isDark ? "#f8fafc" : "#0f172a",
        fontWeight: "700",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        lineHeight: "1.4",
      }}
    >
      {value || "Not provided"}
    </strong>
  </div>
);

export default function VerifiedUserDetails() {
  const { isDark } = useTheme();
  const { userId } = useParams();
  const navigate = useNavigate();
  const { alert: showAlert, confirm } = useMessageBox();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reason, setReason] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [incidentReports, setIncidentReports] = useState([]);
  const [addresses, setAddresses] = useState({});
  const [selectedMap, setSelectedMap] = useState(null);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const record = await pb.collection("users").getOne(userId, { requestKey: null });
        setUser(record);
      } catch (error) {
        console.error("Failed to load resident details:", error);
        await showAlert("Unable to load resident details.", { title: "Loading Error" });
        navigate("/verified-users");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [showAlert, navigate, userId]);

  useEffect(() => {
    const fetchIncidentReports = async () => {
      if (!user) return;
      setIncidentsLoading(true);
      try {
        const records = await pb.collection("incident_reports").getFullList({
          filter: `users = "${user.id}"`,
          sort: "-created",
          requestKey: null,
        });
        setIncidentReports(records);

        // Resolve real location addresses in parallel
        const geoItems = records.filter((r) => r.latitude != null && r.longitude != null);
        if (geoItems.length > 0) {
          const resolved = await Promise.all(
            geoItems.map(async (r) => {
              try {
                const addr = await getReadableAddress(r.latitude, r.longitude);
                return [r.id, addr];
              } catch {
                return [r.id, `Coordinates (${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)})`];
              }
            })
          );
          setAddresses(Object.fromEntries(resolved));
        }
      } catch (error) {
        console.error("Failed to load incident reports:", error);
        setIncidentReports([]);
      } finally {
        setIncidentsLoading(false);
      }
    };

    fetchIncidentReports();
  }, [user]);

  const copyPhoneNumber = (phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleStatusChange = async () => {
    if (!user) return;
    const isSuspending = user.status !== "suspended";
    if (isSuspending && !reason.trim()) {
      await showAlert("Please enter a justification reason before suspending this citizen verification.", {
        title: "Suspension Reason Required",
      });
      return;
    }

    const confirmed = await confirm(
      isSuspending
        ? `Are you sure you want to suspend verification for ${user.first_name} ${user.last_name}? They will lose verified resident status until restored.`
        : `Restore verified status for ${user.first_name} ${user.last_name}?`,
      {
        title: isSuspending ? "Confirm Suspension" : "Restore Verification",
        primaryLabel: isSuspending ? "Suspend Resident" : "Restore Verification",
        secondaryLabel: "Cancel",
      }
    );
    if (!confirmed) return;

    setProcessing(true);
    try {
      const updatedUser = await pb.collection("users").update(user.id, {
        status: isSuspending ? "suspended" : "verified",
        description: isSuspending ? reason.trim() : "",
      });
      setUser(updatedUser);
      setReason("");
      await showAlert(
        isSuspending
          ? "Resident verification has been suspended."
          : "Resident verification has been restored successfully.",
        { title: "Status Updated" }
      );
    } catch (error) {
      await showAlert(error.message || "Failed to update verification status.", { title: "Update Error" });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: isDark ? "#090e17" : "#f8fafc" }}>
        <Sidebar />
        <main style={{ flex: 1, marginLeft: "216px", padding: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", color: isDark ? "#4ade80" : "#15803d" }}>
            <Loader className="animate-spin" size={36} />
            <span style={{ fontSize: "15px", fontWeight: "700" }}>Loading Resident Profile #{userId}...</span>
          </div>
        </main>
      </div>
    );
  }

  if (!user) return null;

  const fullName = `${user.first_name || ""} ${user.middle_name || ""} ${user.last_name || ""}`.trim();
  const selfieUrl = getFileUrl(user, "selfie") || getFileUrl(user, "avatar") || getFileUrl(user, "profile_picture");
  const idPhotoUrl = getFileUrl(user, "id_photo") || getFileUrl(user, "government_id");
  const isSuspended = user.status === "suspended";

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: isDark ? "#090e17" : "#f8fafc", color: isDark ? "#f8fafc" : "#0f172a", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* TOP BREADCRUMB */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px", flexWrap: "wrap", gap: "12px" }}>
          <button
            type="button"
            onClick={() => navigate("/verified-users")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "10px",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
              backgroundColor: isDark ? "#172338" : "#ffffff",
              color: isDark ? "#f1f5f9" : "#334155",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <ArrowLeft size={16} /> Return to Verified Users
          </button>
        </div>

        {/* PROFILE BANNER CARD */}
        <div
          className="premium-table-card"
          style={{
            padding: "24px 28px",
            marginBottom: "24px",
            backgroundColor: isDark ? "#131c2e" : "#ffffff",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
            borderLeft: isSuspended ? "5px solid #ef4444" : (isDark ? "5px solid #22c55e" : "5px solid #15803d"),
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px",
            boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              onClick={() => selfieUrl && setPreviewImage({ src: selfieUrl, label: "Citizen Profile Photo" })}
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "20px",
                backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
                border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0",
                color: isDark ? "#4ade80" : "#15803d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "900",
                fontSize: "22px",
                overflow: "hidden",
                cursor: selfieUrl ? "zoom-in" : "default",
                flexShrink: 0,
              }}
            >
              {selfieUrl ? (
                <img src={selfieUrl} alt="Resident Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                fullName ? fullName.slice(0, 2).toUpperCase() : "CR"
              )}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "900", color: isDark ? "#f8fafc" : "#0f172a" }}>
                  {fullName || "Verified Citizen"}
                </h1>
                <span style={{ fontSize: "12px", color: isDark ? "#4ade80" : "#15803d", fontWeight: "800", backgroundColor: isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4", padding: "2px 8px", borderRadius: "6px", border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #bbf7d0" }}>
                  Citizen ID #{user.user_id || "N/A"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", color: isDark ? "#94a3b8" : "#64748b", fontSize: "13px", flexWrap: "wrap" }}>
                <span>Brgy. {user.baranggay || "Lagonglong"}</span>
                <span>•</span>
                <span>Submitted: {formatDate(user.date_time || user.created)}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "8px 16px",
                borderRadius: "10px",
                backgroundColor: isSuspended ? (isDark ? "rgba(239, 68, 68, 0.16)" : "#fef2f2") : (isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4"),
                color: isSuspended ? (isDark ? "#f87171" : "#b91c1c") : (isDark ? "#4ade80" : "#15803d"),
                border: isSuspended ? (isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fecaca") : (isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0"),
                fontSize: "13px",
                fontWeight: "800",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              {isSuspended ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
              <span>{isSuspended ? "SUSPENDED CITIZEN" : "VERIFIED CITIZEN"}</span>
            </span>
          </div>
        </div>

        {/* MAIN 2-COLUMN DOSSIER GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(360px, 0.9fr)", gap: "24px", alignItems: "start" }}>
          {/* LEFT COLUMN: Identity Verification & Incident History */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Side-by-Side Information Comparison Card */}
            <div className="premium-table-card" style={{ padding: "24px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "18px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={18} color={isDark ? "#4ade80" : "#15803d"} /> Identity Verification Comparison
                </h3>
                <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600" }}>
                  Submitted Form Data vs ID Proof
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(260px, 0.95fr)", gap: "20px" }}>
                {/* Form Data Column with 2-column Grid */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "11.5px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d", textTransform: "uppercase", display: "block", letterSpacing: "0.04em" }}>
                    Registered Form Data
                  </span>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
                    <DetailRow label="First Name" value={user.first_name} isDark={isDark} />
                    <DetailRow label="Middle Name" value={user.middle_name || "None"} isDark={isDark} />
                    <DetailRow label="Last Name" value={user.last_name} isDark={isDark} />
                    {user.extension && <DetailRow label="Extension" value={user.extension} isDark={isDark} />}
                    <DetailRow label="Birthdate" value={formatDate(user.birthdate)} isDark={isDark} />
                    <DetailRow label="Contact Phone" value={user.contact_number} isDark={isDark} />
                    <DetailRow label="Email" value={user.email} fullWidth isDark={isDark} />
                    <DetailRow label="Street Address" value={user.street_address} isDark={isDark} />
                    <DetailRow label="Barangay" value={user.baranggay} isDark={isDark} />
                    <DetailRow label="Municipality" value={user.municipality} isDark={isDark} />
                    <DetailRow label="Province" value={user.province} isDark={isDark} />
                  </div>
                </div>

                {/* Uploaded ID Card Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "11.5px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d", textTransform: "uppercase", display: "block", letterSpacing: "0.04em" }}>
                    Uploaded Proof of ID
                  </span>

                  {idPhotoUrl ? (
                    <div
                      onClick={() => setPreviewImage({ src: idPhotoUrl, label: "Uploaded ID Proof" })}
                      style={{
                        height: "380px",
                        borderRadius: "14px",
                        overflow: "hidden",
                        backgroundColor: "#070b14",
                        border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0",
                        position: "relative",
                        cursor: "zoom-in",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img src={idPhotoUrl} alt="Government ID" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      <div style={{ position: "absolute", bottom: "10px", right: "10px", backgroundColor: "rgba(15, 23, 42, 0.75)", color: "#fff", padding: "5px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", gap: "5px", backdropFilter: "blur(4px)" }}>
                        <Maximize2 size={12} /> Click to Enlarge ID
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: "380px", borderRadius: "14px", border: isDark ? "1px dashed rgba(255, 255, 255, 0.15)" : "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", color: isDark ? "#64748b" : "#94a3b8", fontSize: "13px" }}>
                      No ID proof uploaded.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Resident Incident Report History Card */}
            <div className="premium-table-card" style={{ padding: "24px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <History size={18} color={isDark ? "#4ade80" : "#15803d"} /> Incident Submissions by this Resident
                </h3>
                <span style={{ fontSize: "12px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b" }}>
                  {incidentReports.length} report(s) found
                </span>
              </div>

              {incidentsLoading ? (
                <div style={{ padding: "30px", textAlign: "center", color: isDark ? "#4ade80" : "#15803d", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <Loader className="animate-spin" size={18} />
                  <span>Loading incident reports...</span>
                </div>
              ) : incidentReports.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: isDark ? "#94a3b8" : "#94a3b8", fontSize: "13.5px" }}>
                  No past incident submissions logged for this resident.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="premium-table" style={{ fontSize: "12.5px" }}>
                    <thead>
                      <tr>
                        <th>Incident Type</th>
                        <th>Date Reported</th>
                        <th>Status</th>
                        <th>Real Location / Address</th>
                        <th style={{ textAlign: "center" }}>Satellite Map</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidentReports.map((report) => (
                        <tr key={report.id}>
                          <td>
                            <strong style={{ color: isDark ? "#f8fafc" : "#0f172a", textTransform: "uppercase" }}>{report.type || "Incident"}</strong>
                          </td>
                          <td style={{ color: isDark ? "#cbd5e1" : "#475569" }}>{formatDate(report.created)}</td>
                          <td>
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: "800",
                                padding: "2px 8px",
                                borderRadius: "6px",
                                backgroundColor: report.status === "resolved" ? (isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4") : (isDark ? "rgba(245, 158, 11, 0.16)" : "#fff7ed"),
                                color: report.status === "resolved" ? (isDark ? "#4ade80" : "#15803d") : (isDark ? "#fbbf24" : "#c2410c"),
                                border: report.status === "resolved" ? (isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0") : (isDark ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid #fed7aa"),
                                textTransform: "uppercase",
                              }}
                            >
                              {report.status || "Pending"}
                            </span>
                          </td>
                          <td>
                            <div style={{ maxWidth: "260px" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", fontSize: "12.5px", color: isDark ? "#f8fafc" : "#0f172a", fontWeight: "700" }}>
                                <MapPin size={14} color={isDark ? "#4ade80" : "#15803d"} style={{ flexShrink: 0, marginTop: "2px" }} />
                                <span>{addresses[report.id] || "Resolving real address..."}</span>
                              </div>
                              <div style={{ fontSize: "11px", color: isDark ? "#64748b" : "#64748b", fontFamily: "monospace", marginLeft: "20px", marginTop: "2px" }}>
                                {report.latitude && report.longitude
                                  ? `GPS: ${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`
                                  : "GPS Unavailable"}
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {report.latitude && report.longitude ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedMap({
                                    lat: report.latitude,
                                    lng: report.longitude,
                                    address: addresses[report.id] || `Coordinates (${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)})`,
                                  })
                                }
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "5px 10px",
                                  borderRadius: "8px",
                                  border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                                  backgroundColor: isDark ? "#172338" : "#ffffff",
                                  color: isDark ? "#4ade80" : "#15803d",
                                  fontSize: "11.5px",
                                  fontWeight: "700",
                                  cursor: "pointer",
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                                }}
                              >
                                <ExternalLink size={12} /> View Map
                              </button>
                            ) : (
                              <span style={{ color: isDark ? "#64748b" : "#94a3b8", fontSize: "11px" }}>N/A</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Review Notes & Quick Contact */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Quick Contact Dossier Card */}
            <div className="premium-table-card" style={{ padding: "24px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Phone size={18} color={isDark ? "#4ade80" : "#15803d"} /> Contact & Connectivity
                </h3>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", backgroundColor: isDark ? "#172338" : "#f8fafc", borderRadius: "8px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
                  <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "12.5px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Phone size={14} /> Phone Number:
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <strong style={{ color: isDark ? "#f8fafc" : "#0f172a", fontSize: "13px" }}>{user.contact_number || "No contact"}</strong>
                    {user.contact_number && (
                      <button
                        type="button"
                        onClick={() => copyPhoneNumber(user.contact_number)}
                        style={{ background: "none", border: "none", color: isDark ? "#4ade80" : "#15803d", cursor: "pointer", fontSize: "11.5px", fontWeight: "800", padding: "2px 6px" }}
                      >
                        {copiedPhone ? <Check size={13} /> : "Copy"}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", backgroundColor: isDark ? "#172338" : "#f8fafc", borderRadius: "8px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
                  <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "12.5px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Mail size={14} /> Email Address:
                  </span>
                  <strong style={{ color: isDark ? "#f8fafc" : "#0f172a", fontSize: "13px" }}>{user.email || "No email"}</strong>
                </div>
              </div>
            </div>

            {/* Suspension / Review Notes Card */}
            {isSuspended ? (
              <div className="premium-table-card" style={{ padding: "24px", border: isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fecaca", backgroundColor: isDark ? "#131c2e" : "#fff", boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid #fee2e2", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f87171" : "#b91c1c", display: "flex", alignItems: "center", gap: "8px" }}>
                    <ShieldAlert size={18} color={isDark ? "#f87171" : "#b91c1c"} /> Account Suspended
                  </h3>
                  <span style={{ fontSize: "11px", fontWeight: "800", padding: "2px 8px", borderRadius: "6px", backgroundColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fef2f2", color: isDark ? "#f87171" : "#b91c1c", border: isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fecaca" }}>
                    SUSPENDED
                  </span>
                </div>

                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    backgroundColor: isDark ? "rgba(239, 68, 68, 0.16)" : "#fef2f2",
                    border: isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fee2e2",
                    color: isDark ? "#fca5a5" : "#991b1b",
                    fontSize: "13px",
                    lineHeight: "1.5",
                    marginBottom: "16px",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: "4px" }}>Official Suspension Reason:</strong>
                  <span>{user.suspension_reason || user.description || "Administrative suspension by system operator."}</span>
                </div>

                <p style={{ margin: "0 0 14px 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: "12.5px" }}>
                  Restoring this resident will reactivate their verified citizen privileges across the municipality portal.
                </p>

                <button
                  type="button"
                  onClick={handleStatusChange}
                  disabled={processing}
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
                    boxShadow: "0 4px 12px rgba(21, 128, 61, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <Check size={16} /> Restore Resident Verification
                </button>
              </div>
            ) : (
              <div className="premium-table-card" style={{ padding: "24px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f87171" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <ShieldAlert size={18} color="#ef4444" /> Suspend Resident Verification
                  </h3>
                </div>

                <p style={{ margin: "0 0 10px 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: "13px" }}>
                  If you need to suspend this resident's verification, select or write the justification reason below:
                </p>

                {/* Quick Reason Tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                  {[
                    "False / Prank Emergency Report",
                    "Repeated False Alarms",
                    "Misuse of Emergency SOS System",
                    "Identity & Photo Mismatch",
                    "Fake / Tampered ID Document",
                    "Invalid / Expired ID Document",
                    "Duplicate Resident Account",
                    "Harassment / Abusive Submissions",
                    "Non-Resident / Out of Jurisdiction",
                    "Citizen Self-Requested Suspension",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setReason(chip)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "8px",
                        border: reason === chip
                          ? (isDark ? "1px solid #ef4444" : "1px solid #dc2626")
                          : (isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0"),
                        backgroundColor: reason === chip
                          ? (isDark ? "rgba(239, 68, 68, 0.22)" : "#fef2f2")
                          : (isDark ? "#172338" : "#ffffff"),
                        color: reason === chip
                          ? (isDark ? "#f87171" : "#b91c1c")
                          : (isDark ? "#cbd5e1" : "#475569"),
                        fontSize: "11.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain the reason for suspension..."
                  style={{
                    width: "100%",
                    minHeight: "85px",
                    padding: "12px",
                    borderRadius: "10px",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                    backgroundColor: isDark ? "#172338" : "#ffffff",
                    color: isDark ? "#f8fafc" : "#0f172a",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                    marginBottom: "14px",
                  }}
                />

                <button
                  type="button"
                  onClick={handleStatusChange}
                  disabled={processing || !reason.trim()}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: reason.trim() ? "#dc2626" : (isDark ? "#1e293b" : "#cbd5e1"),
                    color: reason.trim() ? "#ffffff" : (isDark ? "#64748b" : "#ffffff"),
                    fontSize: "13px",
                    fontWeight: "800",
                    cursor: reason.trim() ? "pointer" : "not-allowed",
                    boxShadow: reason.trim() ? "0 4px 12px rgba(220, 38, 38, 0.25)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  Suspend Resident with Notes
                </button>
              </div>
            )}
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
            backgroundColor: isDark ? "rgba(3, 7, 18, 0.85)" : "rgba(15, 23, 42, 0.75)",
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
              border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "none",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "780px",
              overflow: "hidden",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", backgroundColor: isDark ? "#0f172a" : "#f8fafc" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#4ade80" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin size={17} color={isDark ? "#4ade80" : "#15803d"} /> {selectedMap.address}
              </h3>
              <button
                type="button"
                className="animatedCloseButton"
                onClick={() => setSelectedMap(null)}
                style={{ width: "34px", height: "34px", borderRadius: "50%", border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0", backgroundColor: isDark ? "#172338" : "#fff", color: isDark ? "#f8fafc" : "#334155", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
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

      {/* FULLSCREEN IMAGE LIGHTBOX WITH ZOOM & ADAPTIVE SIZING */}
      {previewImage && (
        <div
          className="lightboxModalBackdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: isDark ? "rgba(3, 7, 18, 0.9)" : "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(14px)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "24px",
          }}
          onClick={() => {
            setPreviewImage(null);
            setZoomLevel(1);
          }}
        >
          <div
            className="lightboxModalCard"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "840px",
              backgroundColor: isDark ? "#131c2e" : "#ffffff",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "none",
              borderRadius: "22px",
              overflow: "hidden",
              boxShadow: "0 30px 90px -15px rgba(0, 0, 0, 0.7)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 22px",
                borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d", display: "flex", alignItems: "center", gap: "8px" }}>
                <ImageIcon size={17} /> {previewImage.label}
              </span>

              {/* Zoom & Action Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", backgroundColor: isDark ? "#172338" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0", borderRadius: "8px", padding: "2px" }}>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                    title="Zoom out"
                    style={{ border: "none", background: "none", padding: "6px 8px", cursor: "pointer", display: "flex", color: isDark ? "#cbd5e1" : "#475569" }}
                  >
                    <ZoomOut size={15} />
                  </button>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: isDark ? "#f8fafc" : "#0f172a", minWidth: "42px", textAlign: "center" }}>
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                    title="Zoom in"
                    style={{ border: "none", background: "none", padding: "6px 8px", cursor: "pointer", display: "flex", color: isDark ? "#cbd5e1" : "#475569" }}
                  >
                    <ZoomIn size={15} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                    backgroundColor: isDark ? "#172338" : "#ffffff",
                    color: isDark ? "#cbd5e1" : "#475569",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  Reset
                </button>

                <a
                  href={previewImage.src}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#15803d",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: "700",
                    textDecoration: "none",
                  }}
                >
                  <ExternalLink size={13} /> Open Original
                </a>

                <button
                  type="button"
                  className="animatedCloseButton"
                  onClick={() => {
                    setPreviewImage(null);
                    setZoomLevel(1);
                  }}
                  style={{ width: "34px", height: "34px", borderRadius: "50%", border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0", backgroundColor: isDark ? "#172338" : "#fff", color: isDark ? "#f8fafc" : "#334155", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div
              style={{
                height: "560px",
                maxHeight: "75vh",
                backgroundColor: "#070b14",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
                overflow: "auto",
                position: "relative",
              }}
            >
              <img
                src={previewImage.src}
                alt={previewImage.label}
                style={{
                  width: "100%",
                  height: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  borderRadius: "10px",
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: "center center",
                  transition: "transform 0.2s ease-out",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

