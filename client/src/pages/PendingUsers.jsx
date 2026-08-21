import { useState, useEffect, useCallback } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { useMessageBox } from "../components/MessageBox";
import { pendingUsersStyle as styles } from "../themes/pendingUsersStyle";
import { addAuditLog } from "../utils/auditLog";
import {
  X,
  UserCheck,
  UserX,
  CheckCircle,
  CheckSquare,
  Square,
  MessageSquare,
} from "lucide-react";

export default function PendingUserRegistration() {
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [previewUser, setPreviewUser] = useState(null);
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
  const { confirm } = useMessageBox();

  const fetchBatch = useCallback(async () => {
    setLoading(true);
    try {
      const records = await pb.collection("users").getList(1, 10, {
        filter: 'status = "pending"',
        requestKey: null,
      });
      setUsers(records.items);
      setSelectedIds([]);
    } catch (error) {
      console.error("Error fetching batch:", error);
    }
    setLoading(false);
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

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map((u) => u.id));
    }
  };

  const shouldIgnoreCardToggle = (target) => {
    if (!target || typeof target.closest !== "function") return false;
    return Boolean(target.closest("button, input, textarea, img, a"));
  };

  const formatFieldLabel = (field) =>
    field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const formatDateTime = (value) => {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;

    return `${year}-${month}-${day} ${hours}:${minutes}${period}`;
  };

  const getUserDetails = (user) => {
    const normalizeKey = (key) => {
      switch (key) {
        case "baranggay":
        case "barangay":
          return "barangay";
        case "contactNumber":
        case "contact":
        case "contact_number":
          return "contact_number";
        case "dateTime":
        case "date_time":
          return "date_time";
        default:
          return key;
      }
    };

    const baseFields = [
      { label: "Email", value: user.email },
      { label: "Age", value: user.age },
      {
        label: "Contact Number",
        value: user.contact_number || user.contactNumber || user.contact,
      },
      { label: "Barangay", value: user.barangay || user.baranggay },
      { label: "Municipality", value: user.municipality },
      { label: "Province", value: user.province },
      {
        label: "Date / Time",
        value: formatDateTime(user.date_time || user.dateTime),
      },
      { label: "Registered", value: formatDateTime(user.created) },
    ];

    const ignoredKeys = new Set([
      "id",
      "collectionId",
      "collectionName",
      "created",
      "updated",
      "selfie",
      "id_photo",
      "email",
      "first_name",
      "middle_name",
      "last_name",
      "contact_number",
      "contactNumber",
      "contact",
      "barangay",
      "baranggay",
      "municipality",
      "province",
      "date_time",
      "dateTime",
      "status",
      "position",
      "extension",
      "age",
      "user_id",
      "emailVisibility",
      "verified",
    ]);

    const extraFields = Object.entries(user)
      .map(([key, value]) => [normalizeKey(key), value])
      .filter(
        ([key, value]) =>
          !ignoredKeys.has(key) &&
          value != null &&
          value !== "" &&
          typeof value !== "object"
      )
      .map(([key, value]) => ({
        label: formatFieldLabel(key),
        value: String(value).trim(),
      }));

    const combined = [
      {
        label: "Full Name",
        value:
          `${user.first_name || ""} ${user.middle_name || ""} ${user.last_name || ""}`.trim(),
      },
      ...baseFields,
      ...extraFields,
    ].filter(
      (item) =>
        item.value !== undefined && item.value !== null && item.value !== ""
    );

    const seen = new Set();
    return combined.filter((item) => {
      const entry = `${item.label.trim().toLowerCase()}|${String(item.value).trim()}`;
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
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
    if (!user) return alert("Error: User data is missing.");

    setIsProcessing(true);
    showOperation(
      "Verifying Citizen",
      `Approving ${user.first_name || "the selected user"} and assigning a Citizen ID.`
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
        details: `Approved application for ${user.first_name || ""} ${user.last_name || ""} and assigned Citizen ID #${nextId}.`
      });

      if (user.email) {
        await fetch("https://api.ireportsystem.com/express-api/send-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, name: user.first_name }),
        }).catch((err) => console.warn("Email service not reachable:", err));
      }

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setSelectedIds((prev) => prev.filter((item) => item !== user.id));
      if (users.length <= 1) fetchBatch();
      alert(`Success: User verified with Citizen ID #${nextId}`);
    } catch (error) {
      console.error("PocketBase Detailed Error:", error.data || error);
      const detailMsg = error.data?.message || error.message;
      alert("System Error: " + detailMsg);
    }
    hideOperation();
    setIsProcessing(false);
  };

  const submitRejection = async () => {
    if (!rejectionModal.reason.trim())
      return alert("Please provide a rejection reason.");
    const shouldReject = await confirm(
      "Reject and permanently delete this user registration?",
      {
        title: "Confirm User Rejection",
        primaryLabel: "Reject & Delete",
        secondaryLabel: "Cancel",
      }
    );

    if (!shouldReject) return;

    setIsProcessing(true);
    showOperation(
      "Rejecting User",
      "Deleting the registration and dispatching the rejection notice."
    );
    try {
      if (rejectionModal.userEmail) {
        await fetch("https://api.ireportsystem.com/express-api/send-rejection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: rejectionModal.userEmail,
            reason: rejectionModal.reason,
          }),
        }).catch((err) => console.warn("Email service not reachable:", err));
      }

      await pb.collection("users").delete(rejectionModal.userId);

      addAuditLog({
        action: "REJECT_CITIZEN",
        target: rejectionModal.userId,
        details: `Rejected and deleted application for ${rejectionModal.userEmail || "user"}. Reason: ${rejectionModal.reason}`
      });

      setUsers((prev) =>
        prev.filter((user) => user.id !== rejectionModal.userId)
      );
      setRejectionModal({
        isOpen: false,
        userId: null,
        userEmail: null,
        reason: "",
      });
      if (users.length <= 1) fetchBatch();
      alert("User registration rejected and deleted.");
    } catch (error) {
      console.error("Delete error:", error.data || error);
      alert("Delete Error: " + (error.data?.message || error.message));
    }
    hideOperation();
    setIsProcessing(false);
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    showOperation(
      "Processing Batch Verification",
      `Verifying ${selectedIds.length} selected citizens.`
    );

    try {
      let currentMax = await getLatestUserId();
      const emailPromises = [];

      for (const id of selectedIds) {
        currentMax++;
        const targetUser = users.find((u) => u.id === id);

        if (targetUser) {
          await pb.collection("users").update(id, {
            status: "verified",
            user_id: currentMax,
          });

          if (targetUser.email) {
            emailPromises.push(
              fetch("https://api.ireportsystem.com/express-api/send-verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: targetUser.email,
                  name: targetUser.first_name,
                }),
              }).catch((err) =>
                console.warn(
                  `Email service unreached for ${targetUser.email}:`,
                  err
                )
              )
            );
          }
        }
      }

      await Promise.all(emailPromises);

      addAuditLog({
        action: "BATCH_VERIFY_CITIZENS",
        target: selectedIds.join(", "),
        details: `Batch approved ${selectedIds.length} pending citizen applications.`
      });

      alert(
        `Batch verification complete! Processed ${selectedIds.length} citizens.`
      );
      setSelectedIds([]);
      fetchBatch();
    } catch (error) {
      console.error("Batch Error:", error.data || error);
      const detailMsg = error.data?.message || error.message;
      alert("Batch error: " + detailMsg);
    }
    hideOperation();
    setIsProcessing(false);
  };

  return (
    <div style={styles.container}>
      <Sidebar />

      <main style={styles.main}>
        {/* Header */}
        <header style={styles.header}>
          <div>
            <div style={styles.headerTitleGroup}>
              <div style={styles.statusDot} />
              <h1 style={styles.title}>PENDING CITIZEN VERIFICATIONS</h1>
            </div>
            <p style={styles.subtitle}>
              Verify resident identity documents for Lagonglong Emergency Dispatch
            </p>
          </div>

          {users.length > 0 && (
            <div style={styles.headerActions}>
              <button onClick={toggleSelectAll} style={styles.btnSecondary}>
                {selectedIds.length === users.length
                  ? "UNSELECT ALL"
                  : "SELECT ALL"}
              </button>
              <button
                onClick={handleBatchApprove}
                disabled={isProcessing || selectedIds.length === 0}
                style={styles.btnBatchApprove(
                  isProcessing || selectedIds.length === 0
                )}
              >
                <UserCheck size={16} />
                VERIFY SELECTED ({selectedIds.length})
              </button>
            </div>
          )}
        </header>

        {/* Empty State */}
        {users.length === 0 && !loading && (
          <div style={styles.emptyState}>
            <CheckCircle
              size={56}
              color="#10b981"
              style={{ marginBottom: "16px", opacity: 0.8 }}
            />
            <h3 style={{ color: "#f8fafc", margin: "0 0 8px 0" }}>
              No Pending Verifications
            </h3>
            <p style={{ margin: 0, fontSize: "14px" }}>
              All resident account applications have been processed.
            </p>
          </div>
        )}

        {/* Cards Grid */}
        <div style={styles.cardsGrid}>
          {users.map((user) => {
            const isSelected = selectedIds.includes(user.id);
            const details = getUserDetails(user);

            return (
              <div
                key={user.id}
                style={styles.card(isSelected)}
                onClick={(e) => {
                  if (shouldIgnoreCardToggle(e.target)) return;
                  toggleSelect(user.id);
                }}
              >
                {/* Header Strip */}
                <div style={styles.cardHeaderStrip}>
                  <div style={styles.cardHeaderUser}>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(user.id);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      {isSelected ? (
                        <CheckSquare size={20} color="#10b981" />
                      ) : (
                        <Square size={20} color="#64748b" />
                      )}
                    </div>
                    <span style={styles.userName}>
                      {user.first_name} {user.last_name}
                    </span>
                  </div>

                  <span style={styles.pendingBadge}>PENDING</span>
                </div>

                <div style={styles.cardBody}>
                  {/* Details Container */}
                  <div style={styles.detailsBox}>
                    {details.map((item) => (
                      <div key={item.label} style={styles.detailRow}>
                        <span style={styles.detailLabel}>{item.label}:</span>
                        <span style={styles.detailValue}>{item.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* ID & Selfie Image Preview Grid */}
                  <div style={styles.imageGrid}>
                    <div
                      style={styles.imageThumb}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewUser(user);
                      }}
                    >
                      <img
                        src={pb.files.getURL(user, user.selfie)}
                        alt="Selfie"
                        style={styles.imgCover}
                      />
                      <span style={styles.imageLabel}>SELFIE</span>
                    </div>

                    <div
                      style={styles.imageThumb}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewUser(user);
                      }}
                    >
                      <img
                        src={pb.files.getURL(user, user.id_photo)}
                        alt="ID Card"
                        style={styles.imgCover}
                      />
                      <span style={styles.imageLabel}>ID PHOTO</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={styles.cardActionGrid}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRejectionModal({
                          isOpen: true,
                          userId: user.id,
                          userEmail: user.email,
                          reason: "",
                        });
                      }}
                      style={styles.btnReject}
                    >
                      <UserX size={16} /> REJECT
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(user);
                      }}
                      style={styles.btnApprove}
                    >
                      <UserCheck size={16} /> APPROVE
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* REJECTION MODAL */}
      {rejectionModal.isOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.rejectionModalCard}>
            <div style={styles.rejectionHeader}>
              <MessageSquare color="#ef4444" size={24} />
              <h3 style={{ margin: 0, fontSize: "18px", color: "#f8fafc" }}>
                Rejection Notice Reason
              </h3>
            </div>

            <textarea
              style={styles.textarea}
              placeholder="e.g., ID document is unreadable or photo mismatch..."
              value={rejectionModal.reason}
              onChange={(e) =>
                setRejectionModal({
                  ...rejectionModal,
                  reason: e.target.value,
                })
              }
            />

            <div style={styles.modalActionRow}>
              <button
                style={styles.btnModalCancel}
                onClick={() =>
                  setRejectionModal({
                    isOpen: false,
                    userId: null,
                    userEmail: null,
                    reason: "",
                  })
                }
              >
                CANCEL
              </button>
              <button
                style={styles.btnModalConfirmReject}
                onClick={submitRejection}
                disabled={isProcessing}
              >
                CONFIRM REJECT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPLICANT REVIEW MODAL */}
      {previewUser && (
        <div
          onClick={() => setPreviewUser(null)}
          style={styles.modalBackdrop}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={styles.previewModalCard}
          >
            <div style={styles.previewHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", color: "#f8fafc" }}>
                  Applicant ID Document Verification
                </h2>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    color: "#cbd5e1",
                    fontSize: "13px",
                  }}
                >
                  Verify photo comparison and citizen details
                </p>
              </div>
              <button
                style={styles.btnCloseIcon}
                onClick={() => setPreviewUser(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Side-by-Side Photos */}
            <div style={styles.previewPhotoGrid}>
              <div style={styles.photoBox}>
                <span style={styles.photoBoxLabel}>LIVE SELFIE PHOTO</span>
                <img
                  src={pb.files.getURL(previewUser, previewUser.selfie)}
                  alt="Selfie"
                  style={styles.previewImg}
                />
              </div>

              <div style={styles.photoBox}>
                <span style={styles.photoBoxLabel}>GOVERNMENT ID CARD</span>
                <img
                  src={pb.files.getURL(previewUser, previewUser.id_photo)}
                  alt="ID"
                  style={styles.previewImg}
                />
              </div>
            </div>

            {/* Profile Fields */}
            <div style={styles.profileFieldsGrid}>
              {getUserDetails(previewUser).map((item) => (
                <div key={item.label}>
                  <span style={styles.fieldLabel}>
                    {item.label?.toUpperCase()}
                  </span>
                  <span style={styles.fieldValue}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* OPERATION LOADING OVERLAY */}
      {operationState.open && (
        <div style={styles.overlayBackdrop}>
          <div style={styles.overlayCard}>
            <div style={styles.spinner} />
            <h3 style={{ margin: 0, fontSize: "18px", color: "#f8fafc" }}>
              {operationState.title}
            </h3>
            <p style={{ margin: 0, color: "#cbd5e1", fontSize: "13px" }}>
              {operationState.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


