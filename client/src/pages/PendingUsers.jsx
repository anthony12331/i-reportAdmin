import { useState, useEffect, useCallback } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { useMessageBox } from "../components/MessageBox";
import { addAuditLog } from "../utils/auditLog";
import {
  X,
  UserCheck,
  UserX,
  CheckCircle,
  MessageSquare,
  Loader,
  Search,
  Shield,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Calendar,
  Phone,
  Mail,
  MapPin,
  IdCard,
  User,
  ClipboardList,
  AlertTriangle,
  Clock,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  Copy,
  Check,
  Home,
  Building2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const getInitials = (user) => {
  if (!user) return "CT";
  const first = user.first_name ? String(user.first_name).trim().charAt(0).toUpperCase() : "";
  const last = user.last_name ? String(user.last_name).trim().charAt(0).toUpperCase() : "";
  return (first + last) || "CT";
};

const getAvatarStyle = (name) => {
  const palettes = [
    { bg: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)", color: "#ffffff" },
    { bg: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", color: "#ffffff" },
    { bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#ffffff" },
    { bg: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)", color: "#ffffff" },
    { bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#ffffff" },
    { bg: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)", color: "#ffffff" },
    { bg: "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)", color: "#ffffff" },
  ];
  const safeName = String(name || "");
  let hash = 0;
  for (let i = 0; i < safeName.length; i++) {
    hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palettes.length;
  return palettes[index];
};

const QUICK_FEEDBACK_CHIPS = [
  "ID photo is blurry or unreadable",
  "Selfie does not match the submitted ID",
  "Expired government ID document",
  "Missing street address or house number",
  "Name spelling mismatch with ID record",
];

export default function PendingUserRegistration() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const [previewUser, setPreviewUser] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [reviewMessage, setReviewMessage] = useState("");
  const [rejectionModal, setRejectionModal] = useState({
    isOpen: false,
    userId: null,
    userEmail: null,
    reason: "",
  });
  const [operationState, setOperationState] = useState({
    open: false,
    title: "",
    message: "",
  });
  const { confirm, alert: showAlert } = useMessageBox();

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isMaximized) {
        setIsMaximized(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaximized]);

  const fetchBatch = useCallback(async () => {
    setLoading(true);
    try {
      const records = await pb.collection("users").getFullList({
        requestKey: null,
      });

      // Sort in-memory by date_time or created date descending
      records.sort((a, b) => {
        const timeA = new Date(a.date_time || a.created || 0).getTime();
        const timeB = new Date(b.date_time || b.created || 0).getTime();
        return timeB - timeA;
      });

      // In-memory filter handles 'pending', 'Pending', null, and empty string statuses
      const pendingItems = records.filter((u) => {
        const s = (u.status || "").toLowerCase().trim();
        return s === "pending" || s === "" || (s !== "verified" && s !== "suspended" && s !== "rejected");
      });

      setUsers(pendingItems);
      setPreviewUser((currentUser) =>
        currentUser && pendingItems.some((user) => user.id === currentUser.id)
          ? currentUser
          : pendingItems[0] || null
      );
    } catch (error) {
      console.error("Error fetching pending users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe;
    let timeout;

    const loadAndSubscribe = async () => {
      await fetchBatch();

      unsubscribe = await pb.collection("users").subscribe("*", () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fetchBatch(), 500);
      });
    };

    loadAndSubscribe();

    return () => {
      clearTimeout(timeout);
      if (unsubscribe) unsubscribe();
    };
  }, [fetchBatch]);

  const formatDateTime = (value) => {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatBirthdate = (value) => {
    if (!value) return "Not provided";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  const getLatestUserId = async () => {
    try {
      const records = await pb.collection("users").getList(1, 1, {
        filter: "user_id > 0",
        sort: "-user_id",
      });
      if (records.items.length === 0) return 0;
      return parseInt(records.items[0].user_id) || 0;
    } catch (err) {
      console.warn("Could not fetch max user_id, defaulting to 0:", err);
      return 0;
    }
  };

  const showOperation = (title, message) => {
    setOperationState({ open: true, title, message });
  };

  const hideOperation = () => {
    setOperationState({ open: false, title: "", message: "" });
  };

  const handleApprove = async (user) => {
    if (!user) return showAlert("Error: User data is missing.", { title: "Error" });

    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "this resident";
    const shouldApprove = await confirm(
      `Approve ${fullName} and issue official Citizen ID in the emergency network?`,
      {
        title: "Confirm Citizen Approval",
        primaryLabel: "Approve & Issue ID",
        secondaryLabel: "Cancel",
      }
    );
    if (!shouldApprove) return;

    setIsProcessing(true);
    showOperation(
      "Approving Citizen",
      `Generating Citizen ID and issuing verification credential for ${fullName}...`
    );
    try {
      const currentMax = await getLatestUserId();
      const nextId = currentMax + 1;

      await pb.collection("users").update(user.id, {
        status: "verified",
        user_id: nextId,
      });

      addAuditLog({
        action: "VERIFY_CITIZEN",
        target: user.id,
        details: `Approved application for ${user.first_name || ""} ${user.last_name || ""} and assigned Citizen ID #${nextId}.`,
      });

      if (user.email) {
        fetch("https://api.ireportsystem.com/express-api/send-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, name: user.first_name }),
        }).catch((err) => console.warn("Email service not reachable:", err));
      }

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (users.length <= 1) fetchBatch();
      await showAlert(`Successfully approved ${fullName} with assigned Citizen ID #${nextId}.`, { title: "Citizen Verified" });
    } catch (error) {
      console.error("Verification Error:", error);
      await showAlert("Failed to verify citizen: " + (error.message || "Unknown error"), { title: "Error" });
    } finally {
      hideOperation();
      setIsProcessing(false);
    }
  };

  const submitRejection = async () => {
    if (!rejectionModal.reason.trim()) {
      return alert("Please enter a rejection reason.");
    }
    const shouldReject = await confirm(
      "Reject this citizen application? The applicant will be notified with the provided reason.",
      {
        title: "Confirm Application Rejection",
        primaryLabel: "Reject Application",
        secondaryLabel: "Cancel",
      }
    );

    if (!shouldReject) return;

    setIsProcessing(true);
    showOperation(
      "Rejecting Application",
      "Updating account record and sending rejection notice..."
    );
    try {
      if (rejectionModal.userEmail) {
        fetch("https://api.ireportsystem.com/express-api/send-rejection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: rejectionModal.userEmail,
            reason: rejectionModal.reason,
          }),
        }).catch((err) => console.warn("Email service not reachable:", err));
      }

      await pb.collection("users").update(rejectionModal.userId, {
        status: "rejected",
        description: rejectionModal.reason.trim(),
      });

      addAuditLog({
        action: "REJECT_CITIZEN",
        target: rejectionModal.userId,
        details: `Rejected citizen application for ${rejectionModal.userEmail || "user"}. Reason: ${rejectionModal.reason}`,
      });

      setUsers((prev) => prev.filter((user) => user.id !== rejectionModal.userId));
      setRejectionModal({
        isOpen: false,
        userId: null,
        userEmail: null,
        reason: "",
      });
      if (users.length <= 1) fetchBatch();
      await showAlert("Citizen registration has been rejected and the reason recorded.", { title: "Application Rejected" });
    } catch (error) {
      console.error("Rejection error:", error);
      await showAlert("Error recording rejection: " + (error.message || "Unknown error"), { title: "Error" });
    } finally {
      hideOperation();
      setIsProcessing(false);
    }
  };

  const submitClarification = async () => {
    if (!previewUser || !reviewMessage.trim()) {
      return alert("Please enter a clarification message before sending.");
    }

    setIsProcessing(true);
    try {
      await pb.collection("users").update(previewUser.id, {
        description: reviewMessage.trim(),
      });
      addAuditLog({
        action: "REQUEST_CITIZEN_CLARIFICATION",
        target: previewUser.id,
        details: `Requested clarification from ${previewUser.email || "user"}. Message: ${reviewMessage.trim()}`,
      });
      setReviewMessage("");
      await fetchBatch();
      await showAlert("Clarification request saved and updated on the citizen record.", { title: "Clarification Saved" });
    } catch (error) {
      console.error("Clarification error:", error);
      await showAlert("Error saving clarification: " + (error.message || "Unknown error"), { title: "Error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const name = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
    const email = (u.email || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    return name.includes(term) || email.includes(term);
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* Header */}
        <header style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span className="live-status-pulse" style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#15803d", display: "inline-block" }} />
              <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: "800", color: "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
                Pending Citizen Verifications
              </h1>
            </div>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
              Audit submitted government credentials and civilian identity documents for emergency system registration.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "20px",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#15803d",
                fontSize: "13px",
                fontWeight: "700",
              }}
            >
              <Clock size={14} />
              <span>{users.length} Pending Review</span>
            </span>

            <button
              type="button"
              onClick={fetchBatch}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                color: "#475569",
                fontSize: "12.5px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Empty State */}
        {loading && users.length === 0 ? (
          <div style={{ padding: "80px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", color: "#15803d" }}>
            <Loader className="animate-spin" size={32} />
            <span style={{ fontWeight: "700", fontSize: "15px" }}>Loading pending citizen verification queue...</span>
          </div>
        ) : users.length === 0 && !loading ? (
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
              All Caught Up!
            </h3>
            <p style={{ margin: 0, fontSize: "14.5px", color: "#64748b", maxWidth: "420px", lineHeight: "1.5" }}>
              There are no pending resident verification requests in the queue. New submissions will stream here in real time.
            </p>
          </div>
        ) : (
          /* Main Modern 2-Column Workbench (With Maximize Toggle) */
          <div style={{ display: "grid", gridTemplateColumns: isMaximized ? "1fr" : "360px 1fr", gap: "24px", alignItems: "start" }}>
            {/* Left Column: Applicants Queue (Hidden when maximized) */}
            {!isMaximized && (
              <div className="premium-table-card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <UserCheck size={18} color="#15803d" />
                    <h2 style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                      Applicant Queue
                    </h2>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#15803d", backgroundColor: "#f0fdf4", padding: "2px 8px", borderRadius: "10px" }}>
                    {filteredUsers.length} total
                  </span>
                </div>

                {/* Search Box */}
                <div className="search-box-premium" style={{ width: "100%", marginBottom: "14px", minWidth: "100%", boxSizing: "border-box" }}>
                  <Search size={16} color="#94a3b8" />
                  <input
                    type="text"
                    placeholder="Search applicant name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ fontSize: "13px" }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "#94a3b8" }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Queue List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "680px", overflowY: "auto" }}>
                  {filteredUsers.map((user) => {
                    const isSelected = previewUser?.id === user.id;
                    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Applicant";
                    const initials = getInitials(user);
                    const avatarStyle = getAvatarStyle(fullName);

                    return (
                      <div
                        key={user.id}
                        onClick={() => {
                          setPreviewUser(user);
                          setReviewMessage(user.description || "");
                        }}
                        style={{
                          padding: "14px",
                          borderRadius: "14px",
                          border: isSelected ? "2px solid #15803d" : "1px solid #e2e8f0",
                          backgroundColor: isSelected ? "#f0fdf4" : "#ffffff",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          boxShadow: isSelected ? "0 4px 20px -2px rgba(21, 128, 61, 0.14)" : "0 1px 3px rgba(0,0,0,0.02)",
                          position: "relative",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            className="premium-avatar"
                            style={{
                              width: "42px",
                              height: "42px",
                              fontSize: "14px",
                              background: avatarStyle.bg,
                              color: avatarStyle.color,
                              flexShrink: 0,
                              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                            }}
                          >
                            {initials}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ display: "block", fontWeight: "800", color: isSelected ? "#14532d" : "#0f172a", fontSize: "14.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {fullName}
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
                              <Mail size={11} /> {user.email || "No email"}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid #f1f5f9", fontSize: "12px" }}>
                          <span style={{ color: "#64748b", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                            <MapPin size={12} color="#15803d" /> Brgy. {user.baranggay || user.barangay || "Lagonglong"}
                          </span>
                          <span
                            className="premium-status-pill status-pill-pending"
                            style={{ fontSize: "11px", padding: "2px 8px", fontWeight: "700" }}
                          >
                            Reviewing
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Right Column: Citizen Verification Workbench */}
            {previewUser ? (
              <div className="premium-table-card" style={{ padding: isMaximized ? "36px 40px" : "28px" }}>
                {/* Workbench Top Bar */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", paddingBottom: "20px", borderBottom: "1px solid #f1f5f9", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div
                      className="premium-avatar"
                      style={{
                        width: isMaximized ? "64px" : "56px",
                        height: isMaximized ? "64px" : "56px",
                        fontSize: isMaximized ? "20px" : "18px",
                        background: getAvatarStyle(`${previewUser.first_name} ${previewUser.last_name}`).bg,
                        color: "#fff",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                      }}
                    >
                      {getInitials(previewUser)}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "800", color: "#15803d", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Citizen Applicant
                        </span>
                        <span style={{ fontSize: "11px", backgroundColor: "#f1f5f9", color: "#475569", padding: "2px 6px", borderRadius: "6px", fontFamily: "monospace" }}>
                          ID: {previewUser.id}
                        </span>
                      </div>
                      <h2 style={{ fontSize: isMaximized ? "26px" : "22px", fontWeight: "800", color: "#0f172a", margin: "4px 0 0 0", letterSpacing: "-0.01em" }}>
                        {previewUser.first_name} {previewUser.middle_name ? `${previewUser.middle_name} ` : ""}{previewUser.last_name}
                      </h2>
                      <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Calendar size={13} /> Submitted on {formatDateTime(previewUser.date_time || previewUser.created)}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    {isMaximized && users.length > 1 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "6px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            const currentIndex = users.findIndex(u => u.id === previewUser.id);
                            const prevIndex = (currentIndex - 1 + users.length) % users.length;
                            setPreviewUser(users[prevIndex]);
                            setReviewMessage(users[prevIndex].description || "");
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            backgroundColor: "#fff",
                            color: "#475569",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                          }}
                        >
                          ← Prev
                        </button>
                        <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                          {users.findIndex(u => u.id === previewUser.id) + 1} of {users.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const currentIndex = users.findIndex(u => u.id === previewUser.id);
                            const nextIndex = (currentIndex + 1) % users.length;
                            setPreviewUser(users[nextIndex]);
                            setReviewMessage(users[nextIndex].description || "");
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            backgroundColor: "#fff",
                            color: "#475569",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                          }}
                        >
                          Next →
                        </button>
                      </div>
                    )}

                    <span
                      className="premium-status-pill status-pill-pending"
                      style={{ fontSize: "12px", padding: "6px 12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.04em" }}
                    >
                      Pending Verification
                    </span>

                    <button
                      type="button"
                      onClick={() => setIsMaximized((prev) => !prev)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        backgroundColor: isMaximized ? "#f0fdf4" : "#ffffff",
                        color: isMaximized ? "#15803d" : "#334155",
                        fontSize: "12.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        transition: "all 0.15s ease",
                      }}
                      title={isMaximized ? "Restore split view (Esc)" : "Maximize form to full width"}
                    >
                      {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                      <span>{isMaximized ? "Exit Maximize" : "Maximize Form"}</span>
                    </button>
                  </div>
                </div>

                {/* Proof of Identity Documents Comparison Panel */}
                <div style={{ marginBottom: "28px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                      <Shield size={16} color="#15803d" /> Identity Document Verification
                    </h3>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Click any photo to open high-resolution inspector
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    {/* Selfie Box */}
                    <div
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "16px",
                        overflow: "hidden",
                        backgroundColor: "#0b0f19",
                        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
                        transition: "transform 0.15s ease, border-color 0.15s ease",
                      }}
                    >
                      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1e293b", backgroundColor: "#0f172a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
                          <User size={14} color="#38bdf8" /> 1. Civilian Live Selfie
                        </span>
                        <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Maximize2 size={12} /> Click to zoom
                        </span>
                      </div>
                      <div
                        style={{
                          height: isMaximized ? "340px" : "250px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "zoom-in",
                          padding: "12px",
                          position: "relative",
                          backgroundImage: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 80%)",
                          transition: "height 0.25s ease",
                        }}
                        onClick={() => previewUser.selfie && setPreviewImage({ src: pb.files.getURL(previewUser, previewUser.selfie), alt: "Civilian Live Selfie" })}
                      >
                        {previewUser.selfie ? (
                          <img
                            src={pb.files.getURL(previewUser, previewUser.selfie)}
                            alt="Applicant Selfie"
                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "10px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
                          />
                        ) : (
                          <div style={{ color: "#94a3b8", fontSize: "13px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                            <AlertTriangle size={24} color="#f59e0b" />
                            <span>No selfie photo submitted</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Government ID Box */}
                    <div
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "16px",
                        overflow: "hidden",
                        backgroundColor: "#0b0f19",
                        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
                        transition: "transform 0.15s ease, border-color 0.15s ease",
                      }}
                    >
                      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1e293b", backgroundColor: "#0f172a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
                          <IdCard size={14} color="#10b981" /> 2. Government Photo ID
                        </span>
                        <span style={{ fontSize: "11px", color: "#10b981", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Maximize2 size={12} /> Click to zoom
                        </span>
                      </div>
                      <div
                        style={{
                          height: isMaximized ? "340px" : "250px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "zoom-in",
                          padding: "12px",
                          position: "relative",
                          backgroundImage: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 80%)",
                          transition: "height 0.25s ease",
                        }}
                        onClick={() => previewUser.id_photo && setPreviewImage({ src: pb.files.getURL(previewUser, previewUser.id_photo), alt: "Government Photo ID" })}
                      >
                        {previewUser.id_photo ? (
                          <img
                            src={pb.files.getURL(previewUser, previewUser.id_photo)}
                            alt="Government ID"
                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "10px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
                          />
                        ) : (
                          <div style={{ color: "#94a3b8", fontSize: "13px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                            <AlertTriangle size={24} color="#f59e0b" />
                            <span>No ID photo submitted</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submitted Personal Details - Enhanced Executive Tiles */}
                <div style={{ marginBottom: "30px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                      <ClipboardList size={17} color="#15803d" />
                      <span>Submitted Personal Details</span>
                    </h3>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                      Civilian Master Registry Data
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "14px",
                    }}
                  >
                    {/* 1. Full Legal Name */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "16px",
                        backgroundColor: "#ffffff",
                        borderRadius: "14px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                        transition: "all 0.18s ease",
                      }}
                    >
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "12px",
                          backgroundColor: "#e0f2fe",
                          color: "#0284c7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <User size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Full Legal Name
                        </span>
                        <strong style={{ display: "block", fontSize: "14.5px", color: "#0f172a", fontWeight: "800", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
                          {previewUser.first_name} {previewUser.middle_name || ""} {previewUser.last_name} {previewUser.extension || ""}
                        </strong>
                      </div>
                    </div>

                    {/* 2. Date of Birth & Age */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "16px",
                        backgroundColor: "#ffffff",
                        borderRadius: "14px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                        transition: "all 0.18s ease",
                      }}
                    >
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "12px",
                          backgroundColor: "#eef2ff",
                          color: "#4f46e5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Calendar size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Birthdate & Age
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                          <strong style={{ fontSize: "14px", color: "#0f172a", fontWeight: "800" }}>
                            {formatBirthdate(previewUser.birthdate)}
                          </strong>
                          {previewUser.age && (
                            <span style={{ fontSize: "11px", fontWeight: "700", backgroundColor: "#f1f5f9", color: "#334155", padding: "2px 8px", borderRadius: "12px" }}>
                              {previewUser.age} yrs
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 3. Phone Number */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "16px",
                        backgroundColor: "#ffffff",
                        borderRadius: "14px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                        transition: "all 0.18s ease",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "12px",
                          backgroundColor: "#f0fdf4",
                          color: "#15803d",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Phone size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Phone Number
                        </span>
                        <strong style={{ display: "block", fontSize: "14.5px", color: "#0f172a", fontWeight: "800", marginTop: "2px" }}>
                          {previewUser.contact_number || previewUser.contactNumber || "Not provided"}
                        </strong>
                      </div>
                      {(previewUser.contact_number || previewUser.contactNumber) && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(previewUser.contact_number || previewUser.contactNumber, "phone")}
                          title="Copy phone number"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: copiedField === "phone" ? "#15803d" : "#94a3b8",
                            padding: "6px",
                            display: "flex",
                            alignItems: "center",
                            borderRadius: "6px",
                          }}
                        >
                          {copiedField === "phone" ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      )}
                    </div>

                    {/* 4. Email Address */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "16px",
                        backgroundColor: "#ffffff",
                        borderRadius: "14px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                        transition: "all 0.18s ease",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "12px",
                          backgroundColor: "#ccfbf1",
                          color: "#0f766e",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Mail size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Email Address
                        </span>
                        <strong style={{ display: "block", fontSize: "14px", color: "#0f172a", fontWeight: "800", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
                          {previewUser.email || "Not provided"}
                        </strong>
                      </div>
                      {previewUser.email && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(previewUser.email, "email")}
                          title="Copy email address"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: copiedField === "email" ? "#15803d" : "#94a3b8",
                            padding: "6px",
                            display: "flex",
                            alignItems: "center",
                            borderRadius: "6px",
                          }}
                        >
                          {copiedField === "email" ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      )}
                    </div>

                    {/* 5. Barangay Jurisdiction */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "16px",
                        backgroundColor: "#ffffff",
                        borderRadius: "14px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                        transition: "all 0.18s ease",
                      }}
                    >
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "12px",
                          backgroundColor: "#fef3c7",
                          color: "#d97706",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <MapPin size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Barangay
                        </span>
                        <strong style={{ display: "block", fontSize: "14.5px", color: "#0f172a", fontWeight: "800", marginTop: "2px" }}>
                          Brgy. {previewUser.baranggay || previewUser.barangay || "Lagonglong"}
                        </strong>
                      </div>
                    </div>

                    {/* 6. Municipality & Province */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "16px",
                        backgroundColor: "#ffffff",
                        borderRadius: "14px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                        transition: "all 0.18s ease",
                      }}
                    >
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "12px",
                          backgroundColor: "#fae8ff",
                          color: "#a21caf",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Building2 size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Municipality & Province
                        </span>
                        <strong style={{ display: "block", fontSize: "14px", color: "#0f172a", fontWeight: "800", marginTop: "2px" }}>
                          {previewUser.municipality || "Lagonglong"}, {previewUser.province || "Misamis Oriental"}
                        </strong>
                      </div>
                    </div>

                    {/* 7. Complete Street Address */}
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "16px",
                        backgroundColor: "#ffffff",
                        borderRadius: "14px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                        transition: "all 0.18s ease",
                      }}
                    >
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "12px",
                          backgroundColor: "#f1f5f9",
                          color: "#475569",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Home size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Complete Street Address & Landmark
                        </span>
                        <strong style={{ display: "block", fontSize: "14.5px", color: "#0f172a", fontWeight: "800", marginTop: "2px" }}>
                          {previewUser.street_address || previewUser.address || "No street address specified"}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reviewer Action Dock */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "24px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <label style={{ fontSize: "13.5px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                      Reviewer Feedback & Remarks (Optional)
                    </label>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Sent to citizen upon clarification/rejection
                    </span>
                  </div>

                  {/* Quick Preset Chips */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                    {QUICK_FEEDBACK_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setReviewMessage(chip)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          backgroundColor: reviewMessage === chip ? "#f0fdf4" : "#ffffff",
                          color: reviewMessage === chip ? "#15803d" : "#475569",
                          fontSize: "11.5px",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={reviewMessage}
                    onChange={(e) => setReviewMessage(e.target.value)}
                    placeholder="Enter instructions for citizen clarification or specific reason for rejection..."
                    disabled={isProcessing}
                    style={{
                      width: "100%",
                      minHeight: "78px",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                      marginBottom: "18px",
                      fontFamily: "inherit",
                    }}
                  />

                  {/* 3-Tier Decision Buttons */}
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={submitClarification}
                      disabled={isProcessing}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "11px 20px",
                        borderRadius: "12px",
                        border: "1px solid #fde68a",
                        backgroundColor: "#fffbeb",
                        color: "#b45309",
                        fontSize: "13.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <MessageSquare size={16} />
                      <span>Request Clarification</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRejectionModal({
                          isOpen: true,
                          userId: previewUser.id,
                          userEmail: previewUser.email,
                          reason: reviewMessage,
                        });
                      }}
                      disabled={isProcessing}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "11px 20px",
                        borderRadius: "12px",
                        border: "1px solid #fecaca",
                        backgroundColor: "#fef2f2",
                        color: "#b91c1c",
                        fontSize: "13.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <UserX size={16} />
                      <span>Reject Application</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApprove(previewUser)}
                      disabled={isProcessing}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "11px 26px",
                        borderRadius: "12px",
                        border: "none",
                        background: "linear-gradient(135deg, #15803d 0%, #166534 100%)",
                        color: "#ffffff",
                        fontSize: "14px",
                        fontWeight: "800",
                        cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(21, 128, 61, 0.35)",
                        transition: "transform 0.15s ease",
                      }}
                    >
                      {isProcessing ? <Loader className="animate-spin" size={16} /> : <UserCheck size={18} />}
                      <span>Approve & Verify Citizen</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="premium-table-card" style={{ padding: "70px 20px", textAlign: "center", color: "#64748b" }}>
                <IdCard size={44} color="#94a3b8" style={{ marginBottom: "14px" }} />
                <h3 style={{ color: "#0f172a", fontSize: "17px", fontWeight: "700", margin: "0 0 6px 0" }}>
                  Select an Applicant
                </h3>
                <p style={{ margin: 0, fontSize: "14px" }}>
                  Choose a citizen from the pending queue to inspect their submitted identity documents.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* REJECTION REASON MODAL */}
      {rejectionModal.isOpen && (
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
            padding: "20px",
          }}
          onClick={() => setRejectionModal({ isOpen: false, userId: null, userEmail: null, reason: "" })}
        >
          <div
            className="lightboxModalCard"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "480px",
              padding: "26px",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", color: "#b91c1c" }}>
                <UserX size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>Confirm Application Rejection</h3>
                <span style={{ fontSize: "12.5px", color: "#64748b" }}>This reason will be recorded and sent to the applicant</span>
              </div>
            </div>

            <textarea
              style={{
                width: "100%",
                minHeight: "100px",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                fontSize: "13.5px",
                boxSizing: "border-box",
                marginBottom: "20px",
                fontFamily: "inherit",
              }}
              placeholder="e.g., ID photo is blurred, expired document, or mismatched selfie..."
              value={rejectionModal.reason}
              onChange={(e) => setRejectionModal({ ...rejectionModal, reason: e.target.value })}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setRejectionModal({ isOpen: false, userId: null, userEmail: null, reason: "" })}
                style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: "13.5px", fontWeight: "700", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRejection}
                disabled={isProcessing}
                style={{ padding: "10px 22px", borderRadius: "10px", border: "none", backgroundColor: "#ef4444", color: "#fff", fontSize: "13.5px", fontWeight: "700", cursor: "pointer" }}
              >
                {isProcessing ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* High-Resolution Document Lightbox Modal with Zoom Toolbar */}
      {previewImage && (
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
              backgroundColor: "#ffffff",
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
                borderBottom: "1px solid #e2e8f0",
                backgroundColor: "#f8fafc",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "800", color: "#15803d", display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck size={16} /> {previewImage.alt}
              </span>

              {/* Zoom Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "2px" }}>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                    title="Zoom out"
                    style={{ border: "none", background: "none", padding: "6px 8px", cursor: "pointer", display: "flex", color: "#475569" }}
                  >
                    <ZoomOut size={15} />
                  </button>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a", minWidth: "42px", textAlign: "center" }}>
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                    title="Zoom in"
                    style={{ border: "none", background: "none", padding: "6px 8px", cursor: "pointer", display: "flex", color: "#475569" }}
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
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                    color: "#475569",
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
                  style={{ width: "34px", height: "34px", borderRadius: "50%", border: "1px solid #e2e8f0", backgroundColor: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
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
                alt={previewImage.alt}
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
