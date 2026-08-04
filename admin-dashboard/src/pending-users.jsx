import { useState, useEffect, useCallback } from "react";
import { pb } from "./pocketbase";
import Sidebar from "./Sidebar";
import { useMessageBox } from "./MessageBox";
import {
  X,
  ShieldAlert,
  User,
  CheckSquare,
  Square,
  MessageSquare,
  CheckCircle,
  UserCheck,
  UserX,
  FileText,
  Clock,
  Send,
  Eye,
  ShieldCheck,
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
        filter: 'user_id != ""',
        sort: "-user_id",
      });
      if (records.items.length === 0) return 0;
      return parseInt(records.items[0].user_id) || 0;
    } catch {
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

      if (user.email) {
        await fetch("http://localhost:5000/send-verification", {
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
      alert("System Error: " + error.message);
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
        await fetch("http://localhost:5000/send-rejection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: rejectionModal.userEmail,
            reason: rejectionModal.reason,
          }),
        }).catch((err) => console.warn("Email service not reachable:", err));
      }

      await pb.collection("users").delete(rejectionModal.userId);
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
      alert("Delete Error: " + error.message);
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
              fetch("http://localhost:5000/send-verification", {
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

      alert(
        `Batch verification complete! Processed ${selectedIds.length} citizens.`
      );
      setSelectedIds([]);
      fetchBatch();
    } catch (error) {
      alert("Batch error: " + error.message);
    }
    hideOperation();
    setIsProcessing(false);
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#0b0f19",
        color: "#f8fafc",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <Sidebar />

      <main style={{ flex: 1, padding: "32px", marginLeft: "260px" }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "28px",
            paddingBottom: "20px",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "#38bdf8",
                  boxShadow: "0 0 12px #38bdf8",
                }}
              />
              <h1
                style={{
                  fontSize: "28px",
                  fontWeight: "900",
                  letterSpacing: "-0.5px",
                  color: "#ffffff",
                  margin: 0,
                }}
              >
                PENDING CITIZEN VERIFICATIONS
              </h1>
            </div>
            <p
              style={{
                color: "#94a3b8",
                fontSize: "14px",
                margin: "6px 0 0 24px",
                fontWeight: "500",
              }}
            >
              Verify resident identity documents for Lagonglong Emergency Dispatch
            </p>
          </div>

          {users.length > 0 && (
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={toggleSelectAll}
                style={{
                  backgroundColor: "#1e293b",
                  color: "#f8fafc",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "1px solid #334155",
                  cursor: "pointer",
                  fontWeight: "700",
                  fontSize: "13px",
                }}
              >
                {selectedIds.length === users.length
                  ? "UNSELECT ALL"
                  : "SELECT ALL"}
              </button>
              <button
                onClick={handleBatchApprove}
                disabled={isProcessing || selectedIds.length === 0}
                style={{
                  backgroundColor: "#10b981",
                  color: "#0f172a",
                  padding: "10px 18px",
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "900",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  opacity: selectedIds.length === 0 ? 0.5 : 1,
                }}
              >
                <UserCheck size={16} />
                VERIFY SELECTED ({selectedIds.length})
              </button>
            </div>
          )}
        </header>

        {/* Empty State */}
        {users.length === 0 && !loading && (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
              backgroundColor: "#1e293b",
              borderRadius: "20px",
              border: "1px dashed #334155",
              color: "#94a3b8",
            }}
          >
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: "24px",
          }}
        >
          {users.map((user) => {
            const isSelected = selectedIds.includes(user.id);
            const details = getUserDetails(user);

            return (
              <div
                key={user.id}
                style={{
                  backgroundColor: "#1e293b",
                  border: isSelected
                    ? "2px solid #10b981"
                    : "1px solid #334155",
                  borderRadius: "20px",
                  overflow: "hidden",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                }}
                onClick={(e) => {
                  if (shouldIgnoreCardToggle(e.target)) return;
                  toggleSelect(user.id);
                }}
              >
                {/* Header Strip */}
                <div
                  style={{
                    backgroundColor: "rgba(56, 189, 248, 0.1)",
                    padding: "14px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
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
                    <span
                      style={{
                        fontWeight: "800",
                        fontSize: "15px",
                        color: "#f8fafc",
                      }}
                    >
                      {user.first_name} {user.last_name}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "800",
                      backgroundColor: "#0f172a",
                      color: "#38bdf8",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      border: "1px solid #334155",
                    }}
                  >
                    PENDING
                  </span>
                </div>

                <div
                  style={{
                    padding: "20px",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Details Container */}
                  <div
                    style={{
                      backgroundColor: "#0f172a",
                      padding: "14px",
                      borderRadius: "14px",
                      border: "1px solid #334155",
                      marginBottom: "16px",
                      display: "grid",
                      gap: "8px",
                    }}
                  >
                    {details.map((item) => (
                      <div
                        key={item.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "12px",
                        }}
                      >
                        <span style={{ color: "#94a3b8", fontWeight: "700" }}>
                          {item.label}:
                        </span>
                        <span
                          style={{
                            color: "#f8fafc",
                            fontWeight: "600",
                            textAlign: "right",
                          }}
                        >
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* ID & Selfie Image Preview Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginBottom: "20px",
                    }}
                  >
                    <div
                      style={{
                        height: "110px",
                        borderRadius: "12px",
                        overflow: "hidden",
                        border: "1px solid #334155",
                        position: "relative",
                        cursor: "zoom-in",
                        backgroundColor: "#0f172a",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewUser(user);
                      }}
                    >
                      <img
                        src={pb.files.getURL(user, user.selfie)}
                        alt="Selfie"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          bottom: "6px",
                          left: "6px",
                          backgroundColor: "rgba(15, 23, 42, 0.8)",
                          color: "#f8fafc",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "9px",
                          fontWeight: "800",
                        }}
                      >
                        SELFIE
                      </span>
                    </div>

                    <div
                      style={{
                        height: "110px",
                        borderRadius: "12px",
                        overflow: "hidden",
                        border: "1px solid #334155",
                        position: "relative",
                        cursor: "zoom-in",
                        backgroundColor: "#0f172a",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewUser(user);
                      }}
                    >
                      <img
                        src={pb.files.getURL(user, user.id_photo)}
                        alt="ID Card"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          bottom: "6px",
                          left: "6px",
                          backgroundColor: "rgba(15, 23, 42, 0.8)",
                          color: "#f8fafc",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "9px",
                          fontWeight: "800",
                        }}
                      >
                        ID PHOTO
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginTop: "auto",
                    }}
                  >
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
                      style={{
                        backgroundColor: "#ef4444",
                        color: "white",
                        border: "none",
                        padding: "10px",
                        borderRadius: "10px",
                        fontWeight: "800",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <UserX size={16} /> REJECT
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(user);
                      }}
                      style={{
                        backgroundColor: "#10b981",
                        color: "#0f172a",
                        border: "none",
                        padding: "10px",
                        borderRadius: "10px",
                        fontWeight: "900",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(11, 15, 25, 0.95)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "24px",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#1e293b",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "460px",
              padding: "28px",
              border: "1px solid #334155",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              <MessageSquare color="#ef4444" size={24} />
              <h3 style={{ margin: 0, fontSize: "18px", color: "#f8fafc" }}>
                Rejection Notice Reason
              </h3>
            </div>

            <textarea
              style={{
                width: "100%",
                height: "100px",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #334155",
                backgroundColor: "#0f172a",
                color: "#f8fafc",
                fontSize: "13px",
                marginBottom: "20px",
                outline: "none",
                boxSizing: "border-box",
              }}
              placeholder="e.g., ID document is unreadable or photo mismatch..."
              value={rejectionModal.reason}
              onChange={(e) =>
                setRejectionModal({
                  ...rejectionModal,
                  reason: e.target.value,
                })
              }
            />

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  border: "1px solid #334155",
                  backgroundColor: "#0f172a",
                  color: "#94a3b8",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
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
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: "#ef4444",
                  color: "white",
                  fontWeight: "800",
                  cursor: "pointer",
                }}
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
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(11, 15, 25, 0.95)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "24px",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(1000px, 95vw)",
              maxHeight: "90vh",
              overflow: "auto",
              backgroundColor: "#1e293b",
              borderRadius: "24px",
              border: "1px solid #334155",
              padding: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "20px",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", color: "#f8fafc" }}>
                  Applicant ID Document Verification
                </h2>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  Verify photo comparison and citizen details
                </p>
              </div>
              <button
                style={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  color: "#94a3b8",
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={() => setPreviewUser(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Side-by-Side Photos */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#0f172a",
                  padding: "12px",
                  borderRadius: "16px",
                  border: "1px solid #334155",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "800",
                    color: "#38bdf8",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  LIVE SELFIE PHOTO
                </span>
                <img
                  src={pb.files.getURL(previewUser, previewUser.selfie)}
                  alt="Selfie"
                  style={{
                    width: "100%",
                    height: "300px",
                    objectFit: "cover",
                    borderRadius: "10px",
                  }}
                />
              </div>

              <div
                style={{
                  backgroundColor: "#0f172a",
                  padding: "12px",
                  borderRadius: "16px",
                  border: "1px solid #334155",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "800",
                    color: "#38bdf8",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  GOVERNMENT ID CARD
                </span>
                <img
                  src={pb.files.getURL(previewUser, previewUser.id_photo)}
                  alt="ID"
                  style={{
                    width: "100%",
                    height: "300px",
                    objectFit: "cover",
                    borderRadius: "10px",
                  }}
                />
              </div>
            </div>

            {/* Profile Fields */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "12px",
                backgroundColor: "#0f172a",
                padding: "16px",
                borderRadius: "16px",
                border: "1px solid #334155",
              }}
            >
              {getUserDetails(previewUser).map((item) => (
                <div key={item.label}>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#94a3b8",
                      fontWeight: "800",
                      display: "block",
                    }}
                  >
                    {item.label?.toUpperCase()}
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#f8fafc",
                      fontWeight: "700",
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* OPERATION LOADING OVERLAY */}
      {operationState.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            backgroundColor: "rgba(11, 15, 25, 0.8)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "min(400px, 100%)",
              backgroundColor: "#1e293b",
              borderRadius: "20px",
              padding: "28px",
              border: "1px solid #334155",
              display: "grid",
              justifyItems: "center",
              textAlign: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                border: "4px solid #334155",
                borderTopColor: "#10b981",
                animation: "spin 0.9s linear infinite",
              }}
            />
            <h3 style={{ margin: 0, fontSize: "18px", color: "#f8fafc" }}>
              {operationState.title}
            </h3>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px" }}>
              {operationState.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}