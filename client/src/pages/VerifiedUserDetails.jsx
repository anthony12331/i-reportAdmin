import React, { useEffect, useState, useMemo } from "react";
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
  Copy,
  FileText,
  CheckCheck,
  CreditCard,
} from "lucide-react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import AdvancedImageModal from "../components/AdvancedImageModal";
import PremiumPagination from "../components/PremiumPagination";
import { useMessageBox } from "../components/MessageBox";
import { useTheme } from "../themes/ThemeContext";
import { getReadableAddress } from "../utils/utils";
import { addAuditLog } from "../utils/auditLog";

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

const InfoField = ({ label, value, icon, fullWidth = false, isDark = false, copyable = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (!value || value === "Not provided") return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "10px 14px",
        borderRadius: "10px",
        backgroundColor: isDark ? "#131c2e" : "#ffffff",
        border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
        minWidth: 0,
        gridColumn: fullWidth ? "1 / -1" : "auto",
        transition: "border-color 0.15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          {icon && <span style={{ color: isDark ? "#94a3b8" : "#64748b", display: "inline-flex" }}>{icon}</span>}
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
        </div>

        {copyable && value && value !== "Not provided" && (
          <button
            type="button"
            onClick={handleCopy}
            title={`Copy ${label}`}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px",
              display: "inline-flex",
              alignItems: "center",
              color: copied ? (isDark ? "#4ade80" : "#15803d") : (isDark ? "#64748b" : "#94a3b8"),
              transition: "color 0.15s ease",
            }}
          >
            {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
          </button>
        )}
      </div>

      <strong
        style={{
          fontSize: "13.5px",
          color: value && value !== "None" ? (isDark ? "#f8fafc" : "#0f172a") : (isDark ? "#64748b" : "#94a3b8"),
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
};

export default function VerifiedUserDetails() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
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

  // Pagination for Resident Incident Submissions (default 5 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(5);

  const totalIncidents = incidentReports.length;
  const totalIncidentPages = Math.ceil(totalIncidents / perPage) || 1;

  const paginatedIncidents = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return incidentReports.slice(start, start + perPage);
  }, [incidentReports, currentPage, perPage]);

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

      const citizenFullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;
      const currentAdmin = pb.authStore.model;
      const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

      addAuditLog({
        action: isSuspending ? "USER_SUSPENDED" : "USER_RESTORED",
        target: `${citizenFullName} (${user.email || `ID #${user.user_id}`})`,
        details: isSuspending
          ? `Administrator ${adminName} suspended citizen account for ${citizenFullName} (Citizen ID #${user.user_id || user.id}) from details dossier. Reason: "${reason.trim()}". Verification revoked.`
          : `Administrator ${adminName} restored citizen verification for ${citizenFullName} (Citizen ID #${user.user_id || user.id}). Account status set back to verified.`,
        actor: adminName,
      });

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
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: isDark ? "#090d16" : "#f8fafc" }}>
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
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: isDark ? "#090d16" : "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main className="verified-user-details-main" style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* TOP BREADCRUMB */}
        <div className="verified-user-top-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px", flexWrap: "wrap", gap: "12px" }}>
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
              color: isDark ? "#f8fafc" : "#334155",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <ArrowLeft size={16} /> Return to Verified Users
          </button>
        </div>

        {/* TOP CITIZEN BANNER */}
        <div
          className="premium-table-card verified-user-banner"
          style={{
            padding: "24px 28px",
            marginBottom: "24px",
            backgroundColor: isDark ? "#131c2e" : "#ffffff",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
            borderLeft: `5px solid ${isSuspended ? "#ef4444" : "#15803d"}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <div className="verified-user-banner-profile" style={{ display: "flex", alignItems: "flex-start", gap: "18px", minWidth: 0, flex: 1 }}>
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
                marginTop: "2px",
              }}
            >
              {selfieUrl ? (
                <img src={selfieUrl} alt="Resident Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                fullName ? fullName.slice(0, 2).toUpperCase() : "CR"
              )}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              {/* Overline: Citizen ID badge & Account Status */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "800",
                    padding: "3px 9px",
                    borderRadius: "6px",
                    backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
                    color: isDark ? "#4ade80" : "#15803d",
                    border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span style={{ color: isDark ? "#86efac" : "#166534" }}>Citizen ID:</span>
                  <span style={{ fontFamily: "monospace", fontWeight: "800" }}>#{user.user_id || "N/A"}</span>
                </span>

                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    padding: "3px 9px",
                    borderRadius: "6px",
                    backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                    color: isDark ? "#cbd5e1" : "#475569",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0",
                  }}
                >
                  Account: <strong style={{ color: isSuspended ? (isDark ? "#f87171" : "#b91c1c") : (isDark ? "#4ade80" : "#15803d") }}>{isSuspended ? "Suspended" : "Verified Citizen"}</strong>
                </span>
              </div>

              {/* Citizen Full Name Heading */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <User size={20} color={isDark ? "#4ade80" : "#15803d"} style={{ flexShrink: 0 }} />
                <h1 style={{ margin: 0, fontSize: "clamp(18px, 2.5vw, 22px)", fontWeight: "900", color: isDark ? "#f8fafc" : "#0f172a", letterSpacing: "-0.02em" }}>
                  {fullName || "Verified Citizen"}
                </h1>
              </div>

              {/* Detailed Metadata Row */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", color: isDark ? "#94a3b8" : "#64748b", fontSize: "12.5px", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <MapPin size={13} color={isDark ? "#4ade80" : "#15803d"} />
                  <span><strong>Barangay:</strong> Brgy. {user.baranggay || "Lagonglong"}</span>
                </span>
                <span>•</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Calendar size={13} />
                  <span><strong>Registered:</strong> {formatDate(user.date_time || user.created)}</span>
                </span>
                {user.contact_number && (
                  <>
                    <span>•</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Phone size={13} />
                      <span><strong>Contact:</strong> {user.contact_number}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="verified-user-banner-badge" style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0, marginTop: "2px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "8px 16px",
                borderRadius: "10px",
                backgroundColor: isSuspended ? (isDark ? "rgba(239, 68, 68, 0.2)" : "#fef2f2") : (isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4"),
                color: isSuspended ? (isDark ? "#f87171" : "#b91c1c") : (isDark ? "#4ade80" : "#15803d"),
                border: isSuspended ? (isDark ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid #fecaca") : (isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0"),
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
        <div className="verified-user-details-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(min(100%, 360px), 0.9fr)", gap: "24px", alignItems: "start" }}>
          {/* LEFT COLUMN: Identity Verification & Incident History */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Side-by-Side Information Comparison Card */}
            <div className="premium-table-card" style={{ padding: "24px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4", border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0", color: isDark ? "#4ade80" : "#15803d", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a" }}>
                      Identity Verification Comparison
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>
                      Cross-reference registered citizen record against uploaded government ID proof
                    </p>
                  </div>
                </div>

                <span style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", padding: "4px 10px", borderRadius: "8px", backgroundColor: isDark ? "#0f172a" : "#f1f5f9", color: isDark ? "#94a3b8" : "#475569", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0", letterSpacing: "0.03em" }}>
                  Submitted Form Data vs ID Proof
                </span>
              </div>

              <div className="verified-user-id-comparison-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(min(100%, 280px), 1fr)", gap: "20px", alignItems: "stretch" }}>
                {/* Form Data Column with Grouped Information Sections */}
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  
                  {/* Group 1: Personal Identification */}
                  <div style={{ backgroundColor: isDark ? "#0f172a" : "#f8fafc", borderRadius: "12px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", paddingBottom: "6px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid #e2e8f0" }}>
                      <User size={14} color={isDark ? "#4ade80" : "#15803d"} />
                      <span style={{ fontSize: "11.5px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                        Personal Identification
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px" }}>
                      <InfoField label="First Name" value={user.first_name} isDark={isDark} />
                      <InfoField label="Middle Name" value={user.middle_name || "None"} isDark={isDark} />
                      <InfoField label="Last Name" value={user.last_name} isDark={isDark} />
                      {user.extension && <InfoField label="Extension" value={user.extension} isDark={isDark} />}
                      <InfoField label="Birthdate" value={formatDate(user.birthdate)} icon={<Calendar size={12} />} isDark={isDark} />
                    </div>
                  </div>



                  {/* Group 3: Residential Address */}
                  <div style={{ backgroundColor: isDark ? "#0f172a" : "#f8fafc", borderRadius: "12px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", paddingBottom: "6px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid #e2e8f0" }}>
                      <MapPin size={14} color={isDark ? "#4ade80" : "#15803d"} />
                      <span style={{ fontSize: "11.5px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                        Residential Address & Jurisdiction
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px" }}>
                      <InfoField label="Street Address" value={user.street_address} isDark={isDark} fullWidth />
                      <InfoField label="Barangay" value={user.baranggay ? `Brgy. ${user.baranggay}` : null} isDark={isDark} />
                      <InfoField label="Municipality" value={user.municipality} isDark={isDark} />
                      <InfoField label="Province" value={user.province} isDark={isDark} />
                    </div>
                  </div>

                </div>

                {/* Uploaded ID Inspection Panel & Contact Info Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                      borderRadius: "14px",
                      border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                      overflow: "hidden",
                    }}
                  >
                    {/* ID Header Bar */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", backgroundColor: isDark ? "#172338" : "#ffffff", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <CreditCard size={15} color={isDark ? "#4ade80" : "#15803d"} />
                        <span style={{ fontSize: "12px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          Uploaded Proof of ID
                        </span>
                      </div>
                      {idPhotoUrl && (
                        <span style={{ fontSize: "10.5px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d", backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4", border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0", padding: "2px 8px", borderRadius: "6px" }}>
                          Government ID
                        </span>
                      )}
                    </div>

                    {/* ID Preview Box */}
                    <div style={{ padding: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {idPhotoUrl ? (
                        <div
                          onClick={() => setPreviewImage({ src: idPhotoUrl, label: "Uploaded Government ID Proof" })}
                          style={{
                            width: "100%",
                            height: "210px",
                            borderRadius: "10px",
                            overflow: "hidden",
                            backgroundColor: isDark ? "#060911" : "#0f172a",
                            border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                            position: "relative",
                            cursor: "zoom-in",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                          }}
                        >
                          <img
                            src={idPhotoUrl}
                            alt="Government ID"
                            style={{ width: "100%", height: "100%", objectFit: "contain", padding: "4px", display: "block" }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              bottom: "8px",
                              right: "8px",
                              backgroundColor: "rgba(15, 23, 42, 0.85)",
                              backdropFilter: "blur(6px)",
                              color: "#ffffff",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: "700",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              border: "1px solid rgba(255, 255, 255, 0.15)",
                            }}
                          >
                            <Maximize2 size={12} /> Click to Inspect & Zoom
                          </div>
                        </div>
                      ) : (
                        <div style={{ width: "100%", height: "180px", borderRadius: "10px", border: isDark ? "1px dashed rgba(255, 255, 255, 0.15)" : "1px dashed #cbd5e1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", color: isDark ? "#64748b" : "#94a3b8" }}>
                          <ImageIcon size={28} strokeWidth={1.5} />
                          <span style={{ fontSize: "13px", fontWeight: "600" }}>No ID proof image attached</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contact Information — below ID panel */}
                  <div style={{ backgroundColor: isDark ? "#0f172a" : "#f8fafc", borderRadius: "12px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", paddingBottom: "6px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid #e2e8f0" }}>
                      <Phone size={14} color={isDark ? "#4ade80" : "#15803d"} />
                      <span style={{ fontSize: "11.5px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                        Contact Information
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" }}>
                      <InfoField label="Contact Phone" value={user.contact_number} icon={<Phone size={12} />} isDark={isDark} copyable />
                      <InfoField label="Email Address" value={user.email} icon={<Mail size={12} />} fullWidth isDark={isDark} copyable />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Resident Incident Report History Card */}
            <div className="premium-table-card" style={{ padding: "24px" }}>
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
                <div style={{ padding: "30px", textAlign: "center", color: isDark ? "#64748b" : "#94a3b8", fontSize: "13.5px" }}>
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
                        <th style={{ textAlign: "center" }}>View Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedIncidents.map((report) => (
                        <tr
                          key={report.id}
                          onClick={() => {
                            if (report.status === "resolved") {
                              navigate(`/resolved-incidents/${report.id}`);
                            } else if (report.status === "ongoing" || report.status === "dispatched") {
                              navigate("/ongoing-incidents");
                            } else {
                              navigate("/pending-incidents");
                            }
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <strong style={{ color: isDark ? "#f8fafc" : "#0f172a", textTransform: "uppercase" }}>{report.type || "Incident"}</strong>
                          </td>
                          <td style={{ color: isDark ? "#cbd5e1" : "#334155" }}>{formatDate(report.created)}</td>
                          <td>
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: "800",
                                padding: "2px 8px",
                                borderRadius: "6px",
                                backgroundColor: report.status === "resolved"
                                  ? (isDark ? "rgba(34, 197, 94, 0.2)" : "#f0fdf4")
                                  : (isDark ? "rgba(249, 115, 22, 0.2)" : "#fff7ed"),
                                color: report.status === "resolved"
                                  ? (isDark ? "#4ade80" : "#15803d")
                                  : (isDark ? "#fb923c" : "#c2410c"),
                                border: report.status === "resolved"
                                  ? (isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0")
                                  : (isDark ? "1px solid rgba(249, 115, 22, 0.35)" : "1px solid #fed7aa"),
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
                              <div style={{ fontSize: "11px", color: isDark ? "#94a3b8" : "#64748b", fontFamily: "monospace", marginLeft: "20px", marginTop: "2px" }}>
                                {report.latitude && report.longitude
                                  ? `GPS: ${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`
                                  : "GPS Unavailable"}
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (report.status === "resolved") {
                                  navigate(`/resolved-incidents/${report.id}`);
                                } else if (report.status === "ongoing" || report.status === "dispatched") {
                                  navigate("/ongoing-incidents");
                                } else {
                                  navigate("/pending-incidents");
                                }
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                                backgroundColor: isDark ? "#172338" : "#ffffff",
                                color: isDark ? "#4ade80" : "#15803d",
                                fontSize: "12px",
                                fontWeight: "700",
                                cursor: "pointer",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <ExternalLink size={13} /> View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Table Footer / Premium Pagination from Resolved Incidents */}
                  <div
                    className="premium-table-footer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "14px",
                      padding: "16px 4px 4px 4px",
                      borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
                      marginTop: "12px",
                    }}
                  >
                    <div
                      className="premium-pagination-info"
                      style={{ fontSize: "12.5px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600" }}
                    >
                      Showing{" "}
                      <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>
                        {totalIncidents === 0 ? 0 : (currentPage - 1) * perPage + 1}
                      </strong>
                      –
                      <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>
                        {Math.min(currentPage * perPage, totalIncidents)}
                      </strong>{" "}
                      of{" "}
                      <strong style={{ color: isDark ? "#4ade80" : "#15803d" }}>
                        {totalIncidents}
                      </strong>{" "}
                      Report(s)
                    </div>

                    <PremiumPagination
                      currentPage={currentPage}
                      totalPages={totalIncidentPages}
                      onPageChange={(newPage) => setCurrentPage(newPage)}
                      pageSize={perPage}
                      pageSizeOptions={[5, 10, 20]}
                      onPageSizeChange={(newSize) => {
                        setPerPage(newSize);
                        setCurrentPage(1);
                      }}
                      totalItems={totalIncidents}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Review Notes & Quick Contact */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Quick Contact Dossier Card */}
            <div className="premium-table-card" style={{ padding: "24px" }}>
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
              <div className="premium-table-card" style={{ padding: "24px", border: isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fecaca", backgroundColor: isDark ? "#131c2e" : "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid #fee2e2", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f87171" : "#b91c1c", display: "flex", alignItems: "center", gap: "8px" }}>
                    <ShieldAlert size={18} color={isDark ? "#f87171" : "#b91c1c"} /> Account Suspended
                  </h3>
                  <span style={{ fontSize: "11px", fontWeight: "800", padding: "2px 8px", borderRadius: "6px", backgroundColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fef2f2", color: isDark ? "#f87171" : "#b91c1c", border: isDark ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid #fecaca" }}>
                    SUSPENDED
                  </span>
                </div>

                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
                    border: isDark ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid #fee2e2",
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
                    backgroundColor: "#15803d",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: "800",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(21, 128, 61, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Check size={16} /> Restore Resident Verification
                </button>
              </div>
            ) : (
              <div className="premium-table-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <ShieldAlert size={18} color={isDark ? "#f87171" : "#b91c1c"} /> Suspend Resident Verification
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
                          ? "1px solid #dc2626"
                          : (isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0"),
                        backgroundColor: reason === chip
                          ? (isDark ? "rgba(239, 68, 68, 0.25)" : "#fef2f2")
                          : (isDark ? "#172338" : "#ffffff"),
                        color: reason === chip
                          ? (isDark ? "#f87171" : "#b91c1c")
                          : (isDark ? "#cbd5e1" : "#475569"),
                        fontSize: "11.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                        transition: "all 0.12s ease",
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
                  className="suspend-resident-submit-btn"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: "800",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                    opacity: processing ? 0.7 : 1,
                  }}
                >
                  <ShieldAlert size={16} />
                  {processing ? "Processing..." : "Suspend Resident with Notes"}
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
              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "none",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "780px",
              overflow: "hidden",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", backgroundColor: isDark ? "#0f172a" : "#f8fafc" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin size={17} color={isDark ? "#4ade80" : "#15803d"} /> {selectedMap.address}
              </h3>
              <button
                type="button"
                className="animatedCloseButton"
                onClick={() => setSelectedMap(null)}
                style={{ width: "34px", height: "34px", borderRadius: "50%", border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0", backgroundColor: isDark ? "#1e293b" : "#fff", color: isDark ? "#f8fafc" : "#475569", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
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

      {/* FULLSCREEN IMAGE LIGHTBOX WITH ADVANCED ZOOM, PAN, ROTATE */}
      {previewImage && (
        <AdvancedImageModal
          src={previewImage.src}
          title={previewImage.label}
          alt={previewImage.label}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
