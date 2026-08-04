import { useState, useEffect, useCallback } from "react";
import { pb } from "./pocketbase";
import Sidebar from "./Sidebar";
import { useMessageBox } from "./MessageBox";
import { addAuditLog } from "./auditLog";
import { buildVerifiedUsersFilter } from "./verified-users/verifiedUsersUtils";
import VerifiedUserCard from "./verified-users/VerifiedUserCard";
import {
  SuspendPromptModal,
  SuspendedUsersModal,
  UserImagePreviewModal,
  VerifiedUserDetailsModal,
  VerifiedUserReviewModal,
} from "./verified-users/VerifiedUsersModals";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  UserCheck,
  UserX,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

const USERS_PER_PAGE = 12;

const getFileUrl = (record, field) =>
  record && record[field] ? pb.files.getURL(record, record[field]) : null;

export default function VerifiedUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewUser, setPreviewUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showSuspendedPopup, setShowSuspendedPopup] = useState(false);
  const [suspendedUsers, setSuspendedUsers] = useState([]);
  const [pendingSuspendUser, setPendingSuspendUser] = useState(null);
  const [suspendMessage, setSuspendMessage] = useState("");
  const [showSuspendPrompt, setShowSuspendPrompt] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { confirm } = useMessageBox();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchVerifiedUsers = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      setError(null);

      try {
        const filterString = buildVerifiedUsersFilter(debouncedSearch);
        const records = await pb
          .collection("users")
          .getList(page, USERS_PER_PAGE, {
            filter: filterString,
            sort: "-user_id",
            requestKey: null,
          });

        setUsers(records.items);
        setTotalPages(records.totalPages || 1);
        setTotalItems(records.totalItems || 0);
      } catch (fetchError) {
        console.error("Error fetching verified users:", fetchError);
        if (!fetchError.isAbort) {
          setError(
            fetchError.message || "Failed to load database. Please try again."
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, page]
  );

  useEffect(() => {
    fetchVerifiedUsers();

    let unsubscribe;
    const setupSubscription = async () => {
      unsubscribe = await pb.collection("users").subscribe("*", () => {
        fetchVerifiedUsers(true);
      });
    };

    setupSubscription();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchVerifiedUsers]);

  const fetchSuspendedUsers = useCallback(async () => {
    try {
      const records = await pb.collection("users").getFullList({
        filter: 'status = "suspended"',
        sort: "-user_id",
        requestKey: null,
      });

      setSuspendedUsers(records);
    } catch (fetchError) {
      console.error("Error fetching suspended users:", fetchError);
      setSuspendedUsers([]);
    }
  }, []);

  const openSuspendedUsersPopup = useCallback(async () => {
    await fetchSuspendedUsers();
    setShowSuspendedPopup(true);
  }, [fetchSuspendedUsers]);

  const closeSuspendedUsersPopup = useCallback(() => {
    setShowSuspendedPopup(false);
  }, []);

  const openUserReview = useCallback((user) => {
    setPreviewUser(user);
  }, []);

  const closeUserReview = useCallback(() => {
    setPreviewUser(null);
  }, []);

  const openUserDetails = useCallback((user) => {
    setPreviewImage(null);
    setSelectedUser(user);
  }, []);

  const closeUserDetails = useCallback(() => {
    setSelectedUser(null);
    setPreviewImage(null);
  }, []);

  const openImagePreview = useCallback((src) => {
    setPreviewImage(src);
  }, []);

  const closeImagePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  const openSuspendPrompt = useCallback((user) => {
    setPendingSuspendUser(user);
    setSuspendMessage("");
    setShowSuspendPrompt(true);
  }, []);

  const closeSuspendPrompt = useCallback(() => {
    setShowSuspendPrompt(false);
    setPendingSuspendUser(null);
    setSuspendMessage("");
  }, []);

  const viewSuspendedUser = useCallback((user) => {
    setShowSuspendedPopup(false);
    setPreviewImage(null);
    setSelectedUser(user);
  }, []);

  const handleSuspendVerification = useCallback(
    async (user, message) => {
      if (!message || !message.trim()) {
        alert("Please enter a suspension reason before continuing.");
        return;
      }

      setIsProcessing(true);
      closeSuspendPrompt();

      try {
        await pb.collection("users").update(user.id, {
          status: "suspended",
          suspension_reason: message,
        });

        addAuditLog({
          action: "Verification Suspended",
          target: user.email,
          details: `Admin suspended verification for citizen ID #${user.user_id}. Reason: ${message}`,
          actor: pb.authStore.model?.username || "Admin",
        });

        closeUserDetails();
        await Promise.all([fetchVerifiedUsers(true), fetchSuspendedUsers()]);
        alert(`User ${user.first_name} ${user.last_name} has been suspended.`);
      } catch (updateError) {
        console.error("Failed to suspend", updateError);
        alert(
          "Error updating user status: " +
            (updateError.message || "Unknown error")
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [
      closeSuspendPrompt,
      closeUserDetails,
      fetchSuspendedUsers,
      fetchVerifiedUsers,
    ]
  );

  const handleUnsuspendUser = useCallback(
    async (user) => {
      const shouldUnsuspend = await confirm(
        `Are you sure you want to restore verification for ${user.first_name}?`,
        {
          title: "Confirm Unsuspend",
          primaryLabel: "Restore Verification",
          secondaryLabel: "Cancel",
        }
      );

      if (!shouldUnsuspend) return;

      setIsProcessing(true);

      try {
        await pb.collection("users").update(user.id, {
          status: "verified",
          suspension_reason: "",
        });

        addAuditLog({
          action: "Verification Restored",
          target: user.email,
          details: `Admin restored verification for citizen ID #${user.user_id}.`,
          actor: pb.authStore.model?.username || "Admin",
        });

        closeUserDetails();
        await Promise.all([fetchVerifiedUsers(true), fetchSuspendedUsers()]);
        alert(`User ${user.first_name} ${user.last_name} has been restored.`);
      } catch (updateError) {
        console.error("Failed to unsuspend", updateError);
        alert(
          "Error updating user status: " +
            (updateError.message || "Unknown error")
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [closeUserDetails, confirm, fetchSuspendedUsers, fetchVerifiedUsers]
  );

  const previewUserSelfieUrl = getFileUrl(previewUser, "selfie");
  const previewUserIdPhotoUrl = getFileUrl(previewUser, "id_photo");
  const selectedUserProfileImageUrl = getFileUrl(selectedUser, "selfie");
  const selectedUserIdPhotoUrl = getFileUrl(selectedUser, "id_photo");

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
                  backgroundColor: "#10b981",
                  boxShadow: "0 0 12px #10b981",
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
                VERIFIED CITIZENS DATABASE
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
              Official verified resident members of Lagonglong Emergency System. Total:{" "}
              <strong style={{ color: "#10b981" }}>{totalItems}</strong>
            </p>
          </div>

          <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
            {/* Search Input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "#1e293b",
                padding: "10px 16px",
                borderRadius: "12px",
                border: "1px solid #334155",
                width: "280px",
                gap: "10px",
              }}
            >
              <Search size={18} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search Name or Citizen ID..."
                style={{
                  border: "none",
                  outline: "none",
                  width: "100%",
                  fontSize: "13px",
                  backgroundColor: "transparent",
                  color: "#f8fafc",
                  fontWeight: "600",
                }}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            {/* Suspended Users Modal Button */}
            <button
              type="button"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                borderRadius: "12px",
                border: "1px solid #ef4444",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                color: "#f87171",
                fontWeight: "800",
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onClick={openSuspendedUsersPopup}
            >
              <UserX size={16} />
              SUSPENDED USERS
            </button>
          </div>
        </header>

        {/* State Error Handling */}
        {error ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
              backgroundColor: "#1e293b",
              borderRadius: "20px",
              border: "1px solid #ef4444",
              color: "#f87171",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <AlertCircle size={48} color="#ef4444" />
            <p style={{ margin: 0, fontWeight: "700" }}>{error}</p>
            <button
              onClick={() => fetchVerifiedUsers()}
              style={{
                padding: "10px 24px",
                backgroundColor: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontWeight: "800",
                cursor: "pointer",
              }}
            >
              RETRY FETCH
            </button>
          </div>
        ) : loading && users.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "100px",
              color: "#94a3b8",
              fontSize: "15px",
              fontWeight: "600",
            }}
          >
            Loading database records...
          </div>
        ) : users.length === 0 ? (
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
            <ShieldCheck
              size={56}
              color="#64748b"
              style={{ marginBottom: "16px", opacity: 0.8 }}
            />
            <h3 style={{ color: "#f8fafc", margin: "0 0 8px 0" }}>
              No Verified Citizens Found
            </h3>
            <p style={{ margin: 0, fontSize: "14px" }}>
              No active citizen records match your search filter criteria.
            </p>
          </div>
        ) : (
          <>
            {/* Citizen Cards Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: "24px",
              }}
            >
              {users.map((user) => (
                <VerifiedUserCard
                  key={user.id}
                  user={user}
                  profileImageUrl={getFileUrl(user, "selfie")}
                  onPreview={openUserReview}
                  onManage={openUserDetails}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "20px",
                  marginTop: "36px",
                }}
              >
                <button
                  onClick={() =>
                    setPage((pageNumber) => Math.max(1, pageNumber - 1))
                  }
                  disabled={page === 1 || loading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "10px 18px",
                    borderRadius: "10px",
                    border: "1px solid #334155",
                    backgroundColor: "#1e293b",
                    color: "#f8fafc",
                    cursor: page === 1 ? "not-allowed" : "pointer",
                    fontWeight: "800",
                    fontSize: "13px",
                    opacity: page === 1 ? 0.5 : 1,
                  }}
                >
                  <ChevronLeft size={16} /> PREV
                </button>

                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: "800",
                    color: "#94a3b8",
                  }}
                >
                  PAGE {page} OF {totalPages}
                </span>

                <button
                  onClick={() =>
                    setPage((pageNumber) =>
                      Math.min(totalPages, pageNumber + 1)
                    )
                  }
                  disabled={page === totalPages || loading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "10px 18px",
                    borderRadius: "10px",
                    border: "1px solid #334155",
                    backgroundColor: "#1e293b",
                    color: "#f8fafc",
                    cursor: page === totalPages ? "not-allowed" : "pointer",
                    fontWeight: "800",
                    fontSize: "13px",
                    opacity: page === totalPages ? 0.5 : 1,
                  }}
                >
                  NEXT <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal Components */}
      <UserImagePreviewModal src={previewImage} onClose={closeImagePreview} />

      <VerifiedUserReviewModal
        user={previewUser}
        selfieUrl={previewUserSelfieUrl}
        idPhotoUrl={previewUserIdPhotoUrl}
        onClose={closeUserReview}
      />

      <VerifiedUserDetailsModal
        user={selectedUser}
        profileImageUrl={selectedUserProfileImageUrl}
        idPhotoUrl={selectedUserIdPhotoUrl}
        isProcessing={isProcessing}
        onClose={closeUserDetails}
        onOpenPreview={openImagePreview}
        onRequestSuspend={openSuspendPrompt}
        onRequestUnsuspend={handleUnsuspendUser}
      />

      <SuspendedUsersModal
        isOpen={showSuspendedPopup}
        users={suspendedUsers}
        onClose={closeSuspendedUsersPopup}
        onViewUser={viewSuspendedUser}
      />

      <SuspendPromptModal
        isOpen={showSuspendPrompt}
        user={pendingSuspendUser}
        message={suspendMessage}
        onMessageChange={setSuspendMessage}
        onCancel={closeSuspendPrompt}
        onConfirm={handleSuspendVerification}
        isProcessing={isProcessing}
      />
    </div>
  );
}