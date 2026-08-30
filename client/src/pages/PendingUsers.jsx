import { useState, useEffect, useCallback, useMemo } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import AdvancedImageModal from "../components/AdvancedImageModal";
import PremiumPagination from "../components/PremiumPagination";
import { useMessageBox } from "../components/MessageBox";
import { useTheme } from "../themes/ThemeContext";
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
  CheckCheck,
  CheckSquare,
  Square,
  MinusSquare,
  Users,
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

const getUserImageUrl = (user) => {
  if (!user) return null;
  const file = user.selfie || user.avatar || user.profile_picture || user.image;
  if (!file) return null;
  try {
    return pb.files.getURL(user, file);
  } catch (e) {
    return null;
  }
};

function UserAvatar({ user, size = 42, fontSize = 14, style = {}, onClick, title }) {
  const [imgError, setImgError] = useState(false);
  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Applicant";
  const initials = getInitials(user);
  const avatarStyle = getAvatarStyle(fullName);
  const imgUrl = getUserImageUrl(user);

  return (
    <div
      className="premium-avatar"
      onClick={onClick}
      title={title || fullName}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${fontSize}px`,
        background: avatarStyle.bg,
        color: avatarStyle.color,
        flexShrink: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "800",
        borderRadius: size > 50 ? "18px" : "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        border: "1px solid rgba(0,0,0,0.06)",
        position: "relative",
        ...style,
      }}
    >
      {imgUrl && !imgError ? (
        <img
          src={imgUrl}
          alt={fullName}
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

const QUICK_FEEDBACK_CHIPS = [
  "ID photo is blurry or unreadable",
  "Selfie does not match the submitted ID",
  "Expired government ID document",
  "Missing street address or house number",
  "Name spelling mismatch with ID record",
];

export default function PendingUserRegistration() {
  const { isDark } = useTheme();
  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
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

      records.sort((a, b) => {
        const timeA = new Date(a.date_time || a.created || 0).getTime();
        const timeB = new Date(b.date_time || b.created || 0).getTime();
        return timeB - timeA;
      });

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

  // Pagination for Applicant Queue (Left Choices Holder)
  const [queuePage, setQueuePage] = useState(1);
  const [queuePageSize, setQueuePageSize] = useState(6);

  const filteredUsers = users.filter((u) => {
    const name = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
    const email = (u.email || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    return name.includes(term) || email.includes(term);
  });

  const totalQueuePages = Math.ceil(filteredUsers.length / queuePageSize) || 1;

  const paginatedQueueUsers = useMemo(() => {
    const start = (queuePage - 1) * queuePageSize;
    return filteredUsers.slice(start, start + queuePageSize);
  }, [filteredUsers, queuePage, queuePageSize]);

  useEffect(() => {
    if (queuePage > totalQueuePages) {
      setQueuePage(Math.max(1, totalQueuePages));
    }
  }, [totalQueuePages, queuePage]);

  const isAllSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((u) => selectedUserIds.includes(u.id));

  const isSomeSelected =
    filteredUsers.some((u) => selectedUserIds.includes(u.id)) && !isAllSelected;

  const toggleSelectUser = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds((prev) =>
        prev.filter((id) => !filteredUsers.some((u) => u.id === id))
      );
    } else {
      const currentSet = new Set(selectedUserIds);
      filteredUsers.forEach((u) => currentSet.add(u.id));
      setSelectedUserIds(Array.from(currentSet));
    }
  };

  const handleClearSelection = () => {
    setSelectedUserIds([]);
  };

  const handleApproveBatch = async (customIds = null) => {
    const idsToApprove = customIds || (selectedUserIds.length > 0 ? selectedUserIds : filteredUsers.map((u) => u.id));
    if (!idsToApprove || idsToApprove.length === 0) {
      return showAlert("No pending applicants selected for approval.", { title: "No Selection" });
    }

    const targetUsersList = users.filter((u) => idsToApprove.includes(u.id));
    if (targetUsersList.length === 0) return;

    const count = targetUsersList.length;
    const shouldApprove = await confirm(
      count === 1
        ? `Approve ${(targetUsersList[0].first_name || "").trim() || "this resident"} and issue official Citizen ID in the emergency network?`
        : `Approve and verify all ${count} citizen application(s) at once?\n\nThis will issue consecutive official Citizen IDs, update accounts to verified, and dispatch verification notices.`,
      {
        title: count === 1 ? "Confirm Citizen Approval" : `Confirm Bulk Approval (${count} Citizens)`,
        primaryLabel: count === 1 ? "Approve & Issue ID" : `Approve All (${count})`,
        secondaryLabel: "Cancel",
      }
    );
    if (!shouldApprove) return;

    setIsProcessing(true);
    showOperation(
      "Approving Citizens",
      `Preparing verification for ${count} citizen application(s)...`
    );

    try {
      let currentMax = await getLatestUserId();
      const currentAdmin = pb.authStore.model;
      const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

      let successCount = 0;
      const processedIds = new Set();

      for (let i = 0; i < targetUsersList.length; i++) {
        const user = targetUsersList[i];
        const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Applicant";
        currentMax += 1;
        const nextId = currentMax;

        showOperation(
          "Approving Citizens",
          `[${i + 1}/${count}] Verifying ${fullName} — Assigning Citizen ID #${nextId}...`
        );

        await pb.collection("users").update(user.id, {
          status: "verified",
          user_id: nextId,
        });

        addAuditLog({
          action: "CITIZEN_VERIFIED",
          target: `${fullName} (${user.email || `App ID: ${user.id}`})`,
          details: `Administrator ${adminName} approved citizen registration application for ${fullName} (${user.email}). Assigned official Citizen ID #${nextId}.`,
          actor: adminName,
        });

        if (user.email) {
          fetch("https://api.ireportsystem.com/express-api/send-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email, name: user.first_name }),
          }).catch((err) => console.warn("Email service not reachable:", err));
        }

        processedIds.add(user.id);
        successCount++;
      }

      setUsers((prev) => prev.filter((u) => !processedIds.has(u.id)));
      setSelectedUserIds((prev) => prev.filter((id) => !processedIds.has(id)));

      setPreviewUser((currentUser) => {
        if (currentUser && processedIds.has(currentUser.id)) {
          const remaining = users.filter((u) => !processedIds.has(u.id));
          return remaining[0] || null;
        }
        return currentUser;
      });

      if (users.length - successCount <= 1) {
        fetchBatch();
      }

      await showAlert(
        count === 1
          ? `Successfully approved ${(targetUsersList[0].first_name || "").trim() || "citizen"} with assigned Citizen ID #${currentMax}.`
          : `Successfully approved all ${successCount} selected citizen(s) with assigned official Citizen IDs!`,
        { title: "Citizens Verified" }
      );
    } catch (error) {
      console.error("Verification Error:", error);
      await showAlert("Failed to complete verification: " + (error.message || "Unknown error"), { title: "Error" });
    } finally {
      hideOperation();
      setIsProcessing(false);
    }
  };

  const handleApprove = async (user) => {
    if (!user) return showAlert("Error: User data is missing.", { title: "Error" });
    await handleApproveBatch([user.id]);
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

      const targetUser = users.find((u) => u.id === rejectionModal.userId) || previewUser;
      const applicantName = targetUser ? `${targetUser.first_name || ""} ${targetUser.last_name || ""}`.trim() : "";
      const applicantDisplay = applicantName ? `${applicantName} (${rejectionModal.userEmail})` : (rejectionModal.userEmail || `User #${rejectionModal.userId}`);

      const currentAdmin = pb.authStore.model;
      const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

      addAuditLog({
        action: "CITIZEN_REJECTED",
        target: applicantDisplay,
        details: `Administrator ${adminName} rejected citizen application for ${applicantDisplay}. Reason: "${rejectionModal.reason.trim()}". Rejection notice dispatched via email.`,
        actor: adminName,
      });

      setUsers((prev) => prev.filter((user) => user.id !== rejectionModal.userId));
      setSelectedUserIds((prev) => prev.filter((id) => id !== rejectionModal.userId));
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

      const citizenName = `${previewUser.first_name || ""} ${previewUser.last_name || ""}`.trim() || previewUser.email;
      const currentAdmin = pb.authStore.model;
      const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

      addAuditLog({
        action: "CITIZEN_CLARIFICATION_REQUESTED",
        target: `${citizenName} (${previewUser.email || `App ID: ${previewUser.id}`})`,
        details: `Administrator ${adminName} requested clarification from applicant ${citizenName} (${previewUser.email}). Note sent: "${reviewMessage.trim()}".`,
        actor: adminName,
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

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: isDark ? "#090d16" : "#f8fafc", color: isDark ? "#f1f5f9" : "#0f172a", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* Header */}
        <header style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span className="live-status-pulse" style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: isDark ? "#4ade80" : "#15803d", display: "inline-block" }} />
              <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: "800", color: isDark ? "#f8fafc" : "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
                Pending Citizen Verifications
              </h1>
            </div>
            <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: "14px" }}>
              Review submitted government IDs and approve citizen registrations for Lagonglong.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {users.length > 0 && (
              <button
                type="button"
                onClick={() => handleApproveBatch()}
                disabled={isProcessing}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "7px 16px",
                  borderRadius: "9px",
                  border: "none",
                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "800",
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  boxShadow: isDark ? "0 4px 14px rgba(22, 163, 74, 0.4)" : "0 3px 10px rgba(21, 128, 61, 0.25)",
                  transition: "all 0.15s ease",
                }}
                title={
                  selectedUserIds.length > 0
                    ? `Approve ${selectedUserIds.length} selected applicant(s)`
                    : `Approve all ${filteredUsers.length} applicant(s) at once`
                }
              >
                <CheckCheck size={16} />
                <span>
                  {selectedUserIds.length > 0
                    ? `Approve Selected (${selectedUserIds.length})`
                    : `Approve All (${filteredUsers.length})`}
                </span>
              </button>
            )}

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "20px",
                backgroundColor: isDark ? "rgba(34, 197, 94, 0.15)" : "#f0fdf4",
                border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #bbf7d0",
                color: isDark ? "#4ade80" : "#15803d",
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
                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                backgroundColor: isDark ? "#172338" : "#ffffff",
                color: isDark ? "#f8fafc" : "#475569",
                fontSize: "12.5px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <RotateCcw size={13} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Empty State */}
        {loading && users.length === 0 ? (
          <div style={{ padding: "80px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", color: isDark ? "#4ade80" : "#15803d" }}>
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
              background: isDark
                ? "linear-gradient(180deg, #131c2e 0%, #0d1525 100%)"
                : "linear-gradient(180deg, #ffffff 0%, #f6faf7 100%)",
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
                boxShadow: isDark ? "0 10px 25px -5px rgba(34, 197, 94, 0.25)" : "0 10px 25px -5px rgba(21, 128, 61, 0.15)",
              }}
            >
              <CheckCircle size={36} />
            </div>
            <h3 style={{ color: isDark ? "#f8fafc" : "#0f172a", fontSize: "20px", fontWeight: "800", margin: "0 0 8px 0" }}>
              All Caught Up!
            </h3>
            <p style={{ margin: 0, fontSize: "14.5px", color: isDark ? "#94a3b8" : "#64748b", maxWidth: "420px", lineHeight: "1.5" }}>
              There are no pending resident verification requests in the queue. New submissions will stream here in real time.
            </p>
          </div>
        ) : (
          /* Main Modern 2-Column Workbench (With Maximize Toggle) */
          <div className="pending-users-workbench responsive-workbench-grid" style={{ display: "grid", gridTemplateColumns: isMaximized ? "1fr" : "360px 1fr", gap: "24px", alignItems: "stretch" }}>
            {/* Left Column: Applicants Queue (Hidden when maximized) */}
            {!isMaximized && (
              <div className="premium-table-card" style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <UserCheck size={18} color={isDark ? "#4ade80" : "#15803d"} />
                    <h2 style={{ fontSize: "15px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", margin: 0 }}>
                      Applicant Queue
                    </h2>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: isDark ? "#4ade80" : "#15803d", backgroundColor: isDark ? "rgba(34, 197, 94, 0.15)" : "#f0fdf4", padding: "2px 8px", borderRadius: "10px" }}>
                    {filteredUsers.length} total
                  </span>
                </div>

                {/* Search Box */}
                <div className="search-box-premium" style={{ width: "100%", marginBottom: "12px", minWidth: "100%", boxSizing: "border-box" }}>
                  <Search size={16} color="#94a3b8" />
                  <input
                    type="text"
                    placeholder="Search applicant name or email..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setQueuePage(1);
                    }}
                    style={{ fontSize: "13px" }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        setQueuePage(1);
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "#94a3b8" }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Select All / Batch Control Bar */}
                {filteredUsers.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      marginBottom: "12px",
                      borderRadius: "10px",
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#f1f5f9",
                      border: isDark ? "1px solid rgba(255, 255, 255, 0.07)" : "1px solid #e2e8f0",
                      fontSize: "12.5px",
                    }}
                  >
                    <label
                      onClick={handleToggleSelectAll}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                        fontWeight: "700",
                        color: isDark ? "#f8fafc" : "#1e293b",
                        userSelect: "none",
                      }}
                    >
                      <div
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "5px",
                          border: isAllSelected || isSomeSelected
                            ? "2px solid #22c55e"
                            : (isDark ? "2px solid rgba(255, 255, 255, 0.35)" : "2px solid #94a3b8"),
                          backgroundColor: isAllSelected
                            ? "#22c55e"
                            : isSomeSelected
                            ? (isDark ? "rgba(34, 197, 94, 0.3)" : "#bbf7d0")
                            : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {isAllSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                        {isSomeSelected && <div style={{ width: "8px", height: "2px", backgroundColor: isDark ? "#4ade80" : "#15803d", borderRadius: "1px" }} />}
                      </div>
                      <span>Select All ({filteredUsers.length})</span>
                    </label>

                    {selectedUserIds.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "800",
                            color: isDark ? "#4ade80" : "#15803d",
                            backgroundColor: isDark ? "rgba(34, 197, 94, 0.15)" : "#f0fdf4",
                            padding: "2px 6px",
                            borderRadius: "6px",
                          }}
                        >
                          {selectedUserIds.length} selected
                        </span>
                        <button
                          type="button"
                          onClick={handleClearSelection}
                          style={{
                            background: "none",
                            border: "none",
                            padding: "0",
                            color: isDark ? "#94a3b8" : "#64748b",
                            fontSize: "11.5px",
                            fontWeight: "600",
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Queue List (Fills height and scrolls internally) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "2px", marginBottom: "10px" }}>
                  {paginatedQueueUsers.map((user) => {
                    const isPreviewed = previewUser?.id === user.id;
                    const isChecked = selectedUserIds.includes(user.id);
                    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Applicant";
                    const initials = getInitials(user);
                    const avatarStyle = getAvatarStyle(fullName);

                    return (
                      <div
                        key={user.id}
                        className={`pending-citizen-card ${isPreviewed ? "selected" : ""}`}
                        onClick={() => {
                          setPreviewUser(user);
                          setReviewMessage(user.description || "");
                        }}
                        style={{
                          padding: "14px",
                          borderRadius: "14px",
                          border: isPreviewed
                            ? (isDark ? "2px solid #22c55e" : "2px solid #15803d")
                            : isChecked
                            ? (isDark ? "1.5px solid rgba(34, 197, 94, 0.6)" : "1.5px solid #86efac")
                            : (isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0"),
                          backgroundColor: isPreviewed
                            ? (isDark ? "rgba(34, 197, 94, 0.15)" : "#f0fdf4")
                            : isChecked
                            ? (isDark ? "rgba(34, 197, 94, 0.08)" : "#f0fdf4")
                            : (isDark ? "#172338" : "#ffffff"),
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          boxShadow: isPreviewed
                            ? (isDark ? "0 4px 20px -2px rgba(34, 197, 94, 0.25)" : "0 4px 20px -2px rgba(21, 128, 61, 0.14)")
                            : (isDark ? "0 2px 6px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.02)"),
                          position: "relative",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          {/* Dedicated Checkbox */}
                          <div
                            onClick={(e) => toggleSelectUser(user.id, e)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              padding: "2px",
                              flexShrink: 0,
                            }}
                            title={isChecked ? "Deselect applicant" : "Select applicant"}
                          >
                            <div
                              style={{
                                width: "19px",
                                height: "19px",
                                borderRadius: "6px",
                                border: isChecked
                                  ? "2px solid #22c55e"
                                  : (isDark ? "2px solid rgba(255, 255, 255, 0.3)" : "2px solid #cbd5e1"),
                                backgroundColor: isChecked ? "#22c55e" : (isDark ? "#0f172a" : "#ffffff"),
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {isChecked && <Check size={13} color="#ffffff" strokeWidth={3} />}
                            </div>
                          </div>

                          <UserAvatar user={user} size={42} fontSize={14} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ display: "block", fontWeight: "800", color: isPreviewed ? (isDark ? "#4ade80" : "#14532d") : (isDark ? "#f8fafc" : "#0f172a"), fontSize: "14.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {fullName}
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
                              <Mail size={11} /> {user.email || "No email"}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", fontSize: "12px" }}>
                          <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                            <MapPin size={12} color={isDark ? "#4ade80" : "#15803d"} /> Brgy. {user.baranggay || user.barangay || "Lagonglong"}
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

                {/* Custom Pagination Page Selector */}
                {filteredUsers.length > 0 && (
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: "12px",
                      borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div style={{ fontSize: "11.5px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600" }}>
                      Showing <strong>{filteredUsers.length === 0 ? 0 : (queuePage - 1) * queuePageSize + 1}</strong>–<strong>{Math.min(queuePage * queuePageSize, filteredUsers.length)}</strong> of <strong>{filteredUsers.length}</strong> Applicants
                    </div>
                    <PremiumPagination
                      currentPage={queuePage}
                      totalPages={totalQueuePages}
                      onPageChange={(p) => setQueuePage(p)}
                      pageSize={queuePageSize}
                      pageSizeOptions={[4, 6, 10]}
                      onPageSizeChange={(newSize) => {
                        setQueuePageSize(newSize);
                        setQueuePage(1);
                      }}
                      totalItems={filteredUsers.length}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Right Column: Citizen Verification Workbench */}
            {previewUser ? (
              <div className="premium-table-card verify-workbench-card" style={{ padding: isMaximized ? "36px 40px" : "28px" }}>
                {/* Workbench Top Bar */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", paddingBottom: "20px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <UserAvatar
                      user={previewUser}
                      size={isMaximized ? 64 : 54}
                      fontSize={isMaximized ? 20 : 17}
                      onClick={() => {
                        const imgUrl = getUserImageUrl(previewUser);
                        if (imgUrl) setPreviewImage({ src: imgUrl, alt: "Citizen Profile Photo" });
                      }}
                      style={{ cursor: getUserImageUrl(previewUser) ? "zoom-in" : "default" }}
                    />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "11px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d", backgroundColor: isDark ? "rgba(34, 197, 94, 0.15)" : "#f0fdf4", border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #bbf7d0", padding: "2px 8px", borderRadius: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Citizen Applicant
                        </span>
                        <span style={{ fontSize: "11px", backgroundColor: isDark ? "#1e293b" : "#f1f5f9", color: isDark ? "#94a3b8" : "#64748b", padding: "2px 8px", borderRadius: "6px", fontFamily: "monospace", fontWeight: "600" }}>
                          ID: #{previewUser.user_id || previewUser.id}
                        </span>
                      </div>
                      <h2 style={{ fontSize: isMaximized ? "26px" : "21px", fontWeight: "900", color: isDark ? "#f8fafc" : "#0f172a", margin: "6px 0 0 0", letterSpacing: "-0.02em" }}>
                        {previewUser.first_name} {previewUser.middle_name ? `${previewUser.middle_name} ` : ""}{previewUser.last_name} {previewUser.extension || ""}
                      </h2>
                      <p style={{ margin: "4px 0 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: "12.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Calendar size={13} color={isDark ? "#4ade80" : "#15803d"} /> Submitted on {formatDateTime(previewUser.date_time || previewUser.created)}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    {users.length > 1 && (
                      <div className="verify-nav-controls" style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "4px" }}>
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
                            border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                            backgroundColor: isDark ? "#172338" : "#fff",
                            color: isDark ? "#f8fafc" : "#475569",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          title="Previous applicant"
                        >
                          ← Prev
                        </button>
                        <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "700", padding: "0 4px" }}>
                          {users.findIndex(u => u.id === previewUser.id) + 1} / {users.length}
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
                            border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                            backgroundColor: isDark ? "#172338" : "#fff",
                            color: isDark ? "#f8fafc" : "#475569",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          title="Next applicant"
                        >
                          Next →
                        </button>
                      </div>
                    )}

                    <span
                      className="premium-status-pill status-pill-pending"
                      style={{ fontSize: "11.5px", padding: "6px 12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.04em" }}
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
                        border: isDark
                          ? (isMaximized ? "1px solid #22c55e" : "1px solid rgba(255, 255, 255, 0.12)")
                          : (isMaximized ? "1px solid #15803d" : "1px solid #cbd5e1"),
                        backgroundColor: isMaximized
                          ? (isDark ? "rgba(34, 197, 94, 0.2)" : "#f0fdf4")
                          : (isDark ? "#172338" : "#ffffff"),
                        color: isMaximized
                          ? (isDark ? "#4ade80" : "#15803d")
                          : (isDark ? "#f8fafc" : "#334155"),
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                      <ShieldCheck size={18} color={isDark ? "#4ade80" : "#15803d"} /> Identity Document Verification
                    </h3>
                    <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "500" }}>
                      Click any photo to open high-resolution inspector
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                    {/* Selfie Box */}
                    <div
                      className="verify-photo-card"
                      style={{
                        border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0",
                        borderRadius: "16px",
                        overflow: "hidden",
                        backgroundColor: "#070b14",
                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.1)", backgroundColor: "#0f172a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
                          <User size={14} color="#4ade80" /> 1. Civilian Live Selfie
                        </span>
                        <span style={{ fontSize: "11px", color: "#4ade80", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px", backgroundColor: "rgba(74, 222, 128, 0.12)", padding: "2px 7px", borderRadius: "6px" }}>
                          <Maximize2 size={11} /> Click to zoom
                        </span>
                      </div>
                      <div
                        style={{
                          height: isMaximized ? "340px" : "260px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "zoom-in",
                          padding: "12px",
                          position: "relative",
                          backgroundImage: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 80%)",
                          transition: "height 0.25s ease",
                        }}
                        onClick={() => {
                          const selfieFile = previewUser.selfie || previewUser.avatar || previewUser.profile_picture;
                          if (selfieFile) setPreviewImage({ src: pb.files.getURL(previewUser, selfieFile), alt: "Civilian Live Selfie" });
                        }}
                      >
                        {(previewUser.selfie || previewUser.avatar || previewUser.profile_picture) ? (
                          <img
                            src={pb.files.getURL(previewUser, previewUser.selfie || previewUser.avatar || previewUser.profile_picture)}
                            alt="Applicant Selfie"
                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "10px", boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}
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
                      className="verify-photo-card"
                      style={{
                        border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0",
                        borderRadius: "16px",
                        overflow: "hidden",
                        backgroundColor: "#070b14",
                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.1)", backgroundColor: "#0f172a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
                          <IdCard size={14} color="#4ade80" /> 2. Government Photo ID
                        </span>
                        <span style={{ fontSize: "11px", color: "#4ade80", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px", backgroundColor: "rgba(74, 222, 128, 0.12)", padding: "2px 7px", borderRadius: "6px" }}>
                          <Maximize2 size={11} /> Click to zoom
                        </span>
                      </div>
                      <div
                        style={{
                          height: isMaximized ? "340px" : "260px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "zoom-in",
                          padding: "12px",
                          position: "relative",
                          backgroundImage: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 80%)",
                          transition: "height 0.25s ease",
                        }}
                        onClick={() => {
                          const idFile = previewUser.id_photo || previewUser.government_id || previewUser.idPhoto;
                          if (idFile) setPreviewImage({ src: pb.files.getURL(previewUser, idFile), alt: "Government Photo ID" });
                        }}
                      >
                        {(previewUser.id_photo || previewUser.government_id || previewUser.idPhoto) ? (
                          <img
                            src={pb.files.getURL(previewUser, previewUser.id_photo || previewUser.government_id || previewUser.idPhoto)}
                            alt="Government ID"
                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "10px", boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}
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
                    <h3 style={{ fontSize: "15px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                      <ClipboardList size={17} color={isDark ? "#4ade80" : "#15803d"} />
                      <span>Submitted Personal Details</span>
                    </h3>
                    <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600" }}>
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
                    <div className="verify-info-tile" style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", backgroundColor: isDark ? "#172338" : "#ffffff", borderRadius: "14px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 2px 6px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.02)", transition: "all 0.18s ease" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: isDark ? "rgba(34, 197, 94, 0.14)" : "#f0fdf4", border: isDark ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid #bbf7d0", color: isDark ? "#4ade80" : "#15803d", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <User size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Full Legal Name
                        </span>
                        <strong style={{ display: "block", fontSize: "14.5px", color: isDark ? "#f8fafc" : "#0f172a", fontWeight: "800", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
                          {previewUser.first_name} {previewUser.middle_name || ""} {previewUser.last_name} {previewUser.extension || ""}
                        </strong>
                      </div>
                    </div>

                    {/* 2. Date of Birth & Age */}
                    <div className="verify-info-tile" style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", backgroundColor: isDark ? "#172338" : "#ffffff", borderRadius: "14px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 2px 6px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.02)", transition: "all 0.18s ease" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: isDark ? "rgba(34, 197, 94, 0.14)" : "#f0fdf4", border: isDark ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid #bbf7d0", color: isDark ? "#4ade80" : "#15803d", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Calendar size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Birthdate & Age
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                          <strong style={{ fontSize: "14px", color: isDark ? "#f8fafc" : "#0f172a", fontWeight: "800" }}>
                            {formatBirthdate(previewUser.birthdate)}
                          </strong>
                          {previewUser.age && (
                            <span style={{ fontSize: "11px", fontWeight: "700", backgroundColor: isDark ? "rgba(34, 197, 94, 0.15)" : "#f0fdf4", color: isDark ? "#86efac" : "#15803d", border: isDark ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid #bbf7d0", padding: "2px 8px", borderRadius: "12px" }}>
                              {previewUser.age} yrs
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 3. Phone Number */}
                    <div className="verify-info-tile" style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", backgroundColor: isDark ? "#172338" : "#ffffff", borderRadius: "14px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 2px 6px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.02)", transition: "all 0.18s ease", position: "relative" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: isDark ? "rgba(34, 197, 94, 0.14)" : "#f0fdf4", border: isDark ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid #bbf7d0", color: isDark ? "#4ade80" : "#15803d", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Phone size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Phone Number
                        </span>
                        <strong style={{ display: "block", fontSize: "14.5px", color: isDark ? "#f8fafc" : "#0f172a", fontWeight: "800", marginTop: "2px" }}>
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
                            color: copiedField === "phone" ? (isDark ? "#4ade80" : "#15803d") : (isDark ? "#64748b" : "#94a3b8"),
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
                    <div className="verify-info-tile" style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", backgroundColor: isDark ? "#172338" : "#ffffff", borderRadius: "14px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 2px 6px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.02)", transition: "all 0.18s ease", position: "relative" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: isDark ? "rgba(34, 197, 94, 0.14)" : "#f0fdf4", border: isDark ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid #bbf7d0", color: isDark ? "#4ade80" : "#15803d", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Mail size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Email Address
                        </span>
                        <strong style={{ display: "block", fontSize: "14px", color: isDark ? "#f8fafc" : "#0f172a", fontWeight: "800", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
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
                            color: copiedField === "email" ? (isDark ? "#4ade80" : "#15803d") : (isDark ? "#64748b" : "#94a3b8"),
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
                    <div className="verify-info-tile" style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", backgroundColor: isDark ? "#172338" : "#ffffff", borderRadius: "14px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 2px 6px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.02)", transition: "all 0.18s ease" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: isDark ? "rgba(34, 197, 94, 0.14)" : "#f0fdf4", border: isDark ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid #bbf7d0", color: isDark ? "#4ade80" : "#15803d", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <MapPin size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Barangay
                        </span>
                        <strong style={{ display: "block", fontSize: "14.5px", color: isDark ? "#f8fafc" : "#0f172a", fontWeight: "800", marginTop: "2px" }}>
                          Brgy. {previewUser.baranggay || previewUser.barangay || "Lagonglong"}
                        </strong>
                      </div>
                    </div>

                    {/* 6. Municipality & Province */}
                    <div className="verify-info-tile" style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", backgroundColor: isDark ? "#172338" : "#ffffff", borderRadius: "14px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 2px 6px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.02)", transition: "all 0.18s ease" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: isDark ? "rgba(34, 197, 94, 0.14)" : "#f0fdf4", border: isDark ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid #bbf7d0", color: isDark ? "#4ade80" : "#15803d", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Building2 size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Municipality & Province
                        </span>
                        <strong style={{ display: "block", fontSize: "14px", color: isDark ? "#f8fafc" : "#0f172a", fontWeight: "800", marginTop: "2px" }}>
                          {previewUser.municipality || "Lagonglong"}, {previewUser.province || "Misamis Oriental"}
                        </strong>
                      </div>
                    </div>

                    {/* 7. Complete Street Address */}
                    <div className="verify-info-tile" style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "14px", padding: "16px", backgroundColor: isDark ? "#172338" : "#ffffff", borderRadius: "14px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 2px 6px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.02)", transition: "all 0.18s ease" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: isDark ? "rgba(34, 197, 94, 0.14)" : "#f0fdf4", border: isDark ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid #bbf7d0", color: isDark ? "#4ade80" : "#15803d", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Home size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Complete Street Address & Landmark
                        </span>
                        <strong style={{ display: "block", fontSize: "14.5px", color: isDark ? "#f8fafc" : "#0f172a", fontWeight: "800", marginTop: "2px" }}>
                          {previewUser.street_address || previewUser.address || "No street address specified"}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reviewer Action Dock */}
                <div style={{ borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", paddingTop: "24px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                    <label style={{ fontSize: "13.5px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", margin: 0 }}>
                      Reviewer Feedback & Remarks (Optional)
                    </label>
                    <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>
                      Sent to citizen upon clarification/rejection
                    </span>
                  </div>

                  {/* Quick Preset Chips */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                    {QUICK_FEEDBACK_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        className={`verify-preset-chip ${reviewMessage === chip ? "active" : ""}`}
                        onClick={() => setReviewMessage(chip)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: reviewMessage === chip
                            ? (isDark ? "1px solid #22c55e" : "1px solid #15803d")
                            : (isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0"),
                          backgroundColor: reviewMessage === chip
                            ? (isDark ? "rgba(34, 197, 94, 0.2)" : "#f0fdf4")
                            : (isDark ? "#172338" : "#ffffff"),
                          color: reviewMessage === chip
                            ? (isDark ? "#4ade80" : "#15803d")
                            : (isDark ? "#94a3b8" : "#475569"),
                          fontSize: "12px",
                          fontWeight: "700",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>

                  <textarea
                    className="verify-textarea"
                    value={reviewMessage}
                    onChange={(e) => setReviewMessage(e.target.value)}
                    placeholder="Enter instructions for citizen clarification or specific reason for rejection..."
                    disabled={isProcessing}
                    style={{
                      width: "100%",
                      minHeight: "84px",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                      backgroundColor: isDark ? "#172338" : "#ffffff",
                      color: isDark ? "#f8fafc" : "#0f172a",
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
                      className="verify-btn-clarify"
                      onClick={submitClarification}
                      disabled={isProcessing}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 20px",
                        borderRadius: "12px",
                        border: isDark ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid #fde68a",
                        backgroundColor: isDark ? "rgba(245, 158, 11, 0.18)" : "#fffbeb",
                        color: isDark ? "#fbbf24" : "#b45309",
                        fontSize: "13.5px",
                        fontWeight: "800",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <MessageSquare size={16} />
                      <span>Request Clarification</span>
                    </button>

                    <button
                      type="button"
                      className="verify-btn-reject"
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
                        padding: "12px 20px",
                        borderRadius: "12px",
                        border: isDark ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid #fecaca",
                        backgroundColor: isDark ? "rgba(239, 68, 68, 0.18)" : "#fef2f2",
                        color: isDark ? "#f87171" : "#b91c1c",
                        fontSize: "13.5px",
                        fontWeight: "800",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <UserX size={16} />
                      <span>Reject Application</span>
                    </button>

                    <button
                      type="button"
                      className="verify-btn-approve"
                      onClick={() => handleApprove(previewUser)}
                      disabled={isProcessing}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 26px",
                        borderRadius: "12px",
                        border: "none",
                        background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                        color: "#ffffff",
                        fontSize: "14px",
                        fontWeight: "800",
                        cursor: "pointer",
                        boxShadow: isDark ? "0 4px 16px rgba(22, 163, 74, 0.45)" : "0 4px 14px rgba(21, 128, 61, 0.35)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {isProcessing ? <Loader className="animate-spin" size={16} /> : <UserCheck size={18} />}
                      <span>Approve & Verify Citizen</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="premium-table-card" style={{ padding: "70px 20px", textAlign: "center", color: isDark ? "#94a3b8" : "#64748b" }}>
                <IdCard size={44} color="#94a3b8" style={{ marginBottom: "14px" }} />
                <h3 style={{ color: isDark ? "#f8fafc" : "#0f172a", fontSize: "17px", fontWeight: "700", margin: "0 0 6px 0" }}>
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
            backgroundColor: "rgba(15, 23, 42, 0.85)",
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
              backgroundColor: isDark ? "#131c2e" : "#ffffff",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "480px",
              padding: "26px",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: isDark ? "rgba(239, 68, 68, 0.18)" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", color: isDark ? "#f87171" : "#b91c1c" }}>
                <UserX size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a" }}>Confirm Application Rejection</h3>
                <span style={{ fontSize: "12.5px", color: isDark ? "#94a3b8" : "#64748b" }}>This reason will be recorded and sent to the applicant</span>
              </div>
            </div>

            <textarea
              style={{
                width: "100%",
                minHeight: "100px",
                padding: "12px",
                borderRadius: "10px",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                backgroundColor: isDark ? "#172338" : "#ffffff",
                color: isDark ? "#f8fafc" : "#0f172a",
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
                style={{ padding: "10px 18px", borderRadius: "10px", border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1", background: isDark ? "#1e293b" : "#fff", color: isDark ? "#cbd5e1" : "#475569", fontSize: "13.5px", fontWeight: "700", cursor: "pointer" }}
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

      {/* OPERATION PROGRESS MODAL */}
      {operationState.open && (
        <div
          className="lightboxModalBackdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(10px)",
            zIndex: 10000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: isDark ? "#131c2e" : "#ffffff",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid #e2e8f0",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "420px",
              padding: "32px 24px",
              textAlign: "center",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.7)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "16px",
                backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
                color: isDark ? "#4ade80" : "#15803d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Loader className="animate-spin" size={28} />
            </div>
            <div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a" }}>
                {operationState.title || "Processing Request"}
              </h3>
              <p style={{ margin: 0, fontSize: "14px", color: isDark ? "#94a3b8" : "#64748b", lineHeight: "1.5" }}>
                {operationState.message || "Please wait while we update citizen records..."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE LIGHTBOX WITH ADVANCED ZOOM, PAN, ROTATE */}
      {previewImage && (
        <AdvancedImageModal
          src={previewImage.src}
          title={previewImage.alt}
          alt={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
