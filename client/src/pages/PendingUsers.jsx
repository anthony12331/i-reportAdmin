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
  Loader,
} from "lucide-react";

export default function PendingUserRegistration() {
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [previewUser, setPreviewUser] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
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
  const { confirm } = useMessageBox();

  const fetchBatch = useCallback(async () => {
    setLoading(true);
    try {
      const records = await pb.collection("users").getList(1, 10, {
        filter: 'status = "pending"',
        requestKey: null,
      });
      setUsers(records.items);
      setPreviewUser((currentUser) => currentUser && records.items.some((user) => user.id === currentUser.id)
        ? currentUser
        : records.items[0] || null);
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

  const formatBirthdate = (value) => {
    if (!value) return "Not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
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

    const shouldApprove = await confirm(
      `Approve ${user.first_name || "this resident"} ${user.last_name || ""}`.trim() +
        " and mark the account as verified?",
      {
        title: "Confirm Resident Approval",
        primaryLabel: "Approve Resident",
        secondaryLabel: "Cancel",
      },
    );
    if (!shouldApprove) return;

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
      "Reject this user registration and save the reason to the user record?",
      {
        title: "Confirm User Rejection",
        primaryLabel: "Reject Registration",
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

      await pb.collection("users").update(rejectionModal.userId, {
        status: "rejected",
        description: rejectionModal.reason.trim(),
      });

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
      alert("User registration rejected and the reason was saved.");
    } catch (error) {
      console.error("Delete error:", error.data || error);
      alert("Delete Error: " + (error.data?.message || error.message));
    }
    hideOperation();
    setIsProcessing(false);
  };

  const submitClarification = async () => {
    if (!previewUser || !reviewMessage.trim()) {
      return alert("Please provide a clarification message.");
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
      setPreviewUser(null);
      setReviewMessage("");
      await fetchBatch();
      alert("Clarification message saved.");
    } catch (error) {
      console.error("Clarification error:", error.data || error);
      alert("Clarification Error: " + (error.data?.message || error.message));
    } finally {
      setIsProcessing(false);
    }
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

      <main style={{ ...styles.main, ...styles.mainReview }}>
        {/* Header */}
        <header style={{ ...styles.header, ...styles.reviewHeaderLayout }}>
          <div>
            <div style={styles.headerTitleGroup}>
              <h1 style={styles.title}>PENDING CITIZEN VERIFICATIONS</h1>
            </div>
            <p style={styles.subtitle}>
              Review pending resident identity documents for Lagonglong Emergency Dispatch
            </p>
          </div>

        </header>

        {/* Empty State */}
        {loading && users.length === 0 ? (
          <div style={styles.loadingState}>
            <Loader className="animate-spin" size={42} color="#1d7a4d" />
            <span>Loading pending verifications...</span>
          </div>
        ) : users.length === 0 && !loading && (
          <div style={styles.emptyState}>
            <CheckCircle
              size={56}
              color="#10b981"
              style={{ marginBottom: "16px", opacity: 0.8 }}
            />
            <h3 style={{ color: "#111827", margin: "0 0 8px 0" }}>
              No Pending Verifications
            </h3>
            <p style={{ margin: 0, fontSize: "14px" }}>
              All resident account applications have been processed.
            </p>
          </div>
        )}

        {/* Cards Grid */}
        {users.length > 0 && <section style={styles.choiceHolder}>
          <div style={styles.choiceHolderHeader}>
            <h2 style={styles.choiceHolderTitle}>PENDING RESIDENT VERIFICATIONS ({users.length})</h2>
          </div>
          <div style={styles.cardsGrid}>
            {users.map((user) => {
            const isSelected = selectedIds.includes(user.id);
            const isViewing = previewUser?.id === user.id;

            return (
              <div
                key={user.id}
                className="pendingUserChoiceRow"
                style={styles.choiceRow(isViewing)}
                onClick={(e) => {
                  if (shouldIgnoreCardToggle(e.target)) return;
                  setPreviewUser(user);
                  setReviewMessage(user.description || "");
                }}
              >
                <span style={styles.choiceEmail}>{user.email || "No email available"}</span>
                {isViewing && <span style={styles.viewingBadge}>PENDING</span>}
              </div>
            );
            })}
          </div>
        </section>}

      {/* REJECTION MODAL */}
      {rejectionModal.isOpen && (
        <div style={styles.modalBackdrop}>
          <div style={styles.rejectionModalCard}>
            <div style={styles.rejectionHeader}>
              <MessageSquare color="#ef4444" size={24} />
              <h3 style={{ margin: 0, fontSize: "18px", color: "#111827" }}>
                Rejection Reason
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
                SAVE REJECTION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPLICANT REVIEW */}
      {previewUser && (
        <div
          onClick={() => setPreviewUser(null)}
          style={styles.reviewPageShell}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={styles.reviewPageCard}
          >
            <div style={styles.previewHeader}>
              <div>
                <span style={styles.reviewEyebrow}>RESIDENT DETAILS</span>
                <h2 style={{ margin: 0, fontSize: "20px", color: "#111827" }}>
                  Resident Verification Review
                </h2>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    color: "#5f7b69",
                    fontSize: "13px",
                  }}
                >
                  Submitted on {formatDateTime(previewUser.date_time || previewUser.created) || "Date unavailable"} • Citizen ID #{previewUser.user_id || "N/A"}
                </p>
              </div>
              <button
                className="animatedCloseButton"
                style={styles.btnCloseIcon}
                onClick={() => setPreviewUser(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.reviewContent}>
              <aside style={styles.reviewProfile}>
                <span style={styles.reviewImageLabel}>SELFIE PHOTO</span>
                <img
                  src={pb.files.getURL(previewUser, previewUser.selfie)}
                  alt="Resident selfie"
                  style={styles.reviewProfileImage}
                  onClick={() => setPreviewImage({ src: pb.files.getURL(previewUser, previewUser.selfie), alt: "Resident selfie" })}
                />
                <span style={styles.reviewImageLabel}>IDENTIFICATION PHOTO</span>
                <img
                  src={pb.files.getURL(previewUser, previewUser.id_photo)}
                  alt="Government identification"
                  style={styles.reviewIdUnderSelfie}
                  onClick={() => setPreviewImage({ src: pb.files.getURL(previewUser, previewUser.id_photo), alt: "Government identification" })}
                />
                <span style={styles.reviewProfileLabel}>Full Name:</span>
                <strong style={styles.reviewProfileName}>
                  {previewUser.first_name} {previewUser.last_name}
                </strong>
                <span style={styles.reviewProfileMeta}>Pending citizen</span>
                <span style={styles.reviewProfileMeta}>ID #{previewUser.user_id || "N/A"}</span>

                <div style={styles.verificationStatus}>
                  <span style={styles.fieldLabel}>IDENTITY VERIFICATION STATUS</span>
                  <strong style={styles.verificationStatusBadge}>PENDING REVIEW</strong>
                  <span style={styles.verificationStatusText}>Documents submitted for identity confirmation.</span>
                </div>
              </aside>

              <div style={styles.reviewMain}>
                <section style={styles.informationPanel}>
                  <div style={styles.informationHeader}>
                    <h3 style={styles.reviewSectionTitle}>Resident Information</h3>
                    <span style={styles.reviewSectionHint}>Compare details with proof of identity</span>
                  </div>
                  <div style={styles.comparisonLayout}>
                    <div style={styles.profileFieldsGrid}>
                      <span style={styles.personalInfoHeading}>ENTERED PERSONAL INFO</span>
                      {[
                        ["First Name", previewUser.first_name],
                        ["Middle Name", previewUser.middle_name],
                        ["Last Name", previewUser.last_name],
                        ["Date of Birth", formatBirthdate(previewUser.birthdate)],
                        ["Street", previewUser.street_address],
                        ["Barangay", previewUser.baranggay || previewUser.barangay],
                        ["Municipality", previewUser.municipality],
                        ["Email", previewUser.email],
                        ["Province", previewUser.province],
                      ].map(([label, value]) => (
                        <div key={label} style={styles.personalInfoRow}>
                          <span style={styles.personalInfoLabel}>{label}</span>
                          <span style={styles.personalInfoValue}>{value || "Not available"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <div style={styles.reviewDecision}>
              <div>
                <h3 style={styles.reviewDecisionTitle}>REVIEWER DECISION</h3>
                <p style={styles.reviewDecisionSubtitle}>Save a clarification request or complete this verification.</p>
              </div>
              <textarea
                value={reviewMessage}
                onChange={(e) => setReviewMessage(e.target.value)}
                placeholder="Add a rejection or clarification message..."
                style={styles.reviewTextarea}
                disabled={isProcessing}
              />
              <div style={styles.reviewActionGrid}>
                <button
                  className="pendingUsersAnimatedButton"
                  type="button"
                  style={styles.btnReviewClarify}
                  onClick={submitClarification}
                  disabled={isProcessing}
                >
                  <MessageSquare size={16} /> CLARIFICATION
                </button>
                <button
                  className="pendingUsersAnimatedButton"
                  type="button"
                  style={styles.btnReviewReject}
                  onClick={() => {
                    setPreviewUser(null);
                    setRejectionModal({ isOpen: true, userId: previewUser.id, userEmail: previewUser.email, reason: reviewMessage });
                  }}
                  disabled={isProcessing}
                >
                  <UserX size={16} /> REJECT
                </button>
                <button
                  className="pendingUsersAnimatedButton"
                  type="button"
                  style={styles.btnReviewApprove}
                  onClick={() => handleApprove(previewUser)}
                  disabled={isProcessing}
                >
                  <UserCheck size={16} /> APPROVE
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
      )}

      {!previewUser && users.length > 0 && (
        <div style={styles.selectUserPrompt}>
          <span style={styles.selectUserPromptTitle}>PLEASE SELECT A USER</span>
          <span style={styles.selectUserPromptText}>Choose a pending user from the list to view their verification details.</span>
        </div>
      )}

      {previewImage && (
        <div style={styles.imagePreviewOverlay} onClick={() => setPreviewImage(null)}>
          <div style={styles.imagePreviewPanel} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="animatedCloseButton"
              style={styles.imagePreviewClose}
              onClick={() => setPreviewImage(null)}
              aria-label="Close image preview"
            >
              <X size={20} />
            </button>
            <img src={previewImage.src} alt={previewImage.alt} style={styles.imagePreview} />
          </div>
        </div>
      )}

      </main>

      {/* OPERATION LOADING OVERLAY */}
      {operationState.open && (
        <div style={styles.overlayBackdrop}>
          <div style={styles.overlayCard}>
            <div style={styles.spinner} />
            <h3 style={{ margin: 0, fontSize: "18px", color: "#111827" }}>
              {operationState.title}
            </h3>
            <p style={{ margin: 0, color: "#5f7b69", fontSize: "13px" }}>
              {operationState.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


