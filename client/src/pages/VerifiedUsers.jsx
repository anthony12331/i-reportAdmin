import { useState, useEffect, useCallback } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { useMessageBox } from "../components/MessageBox";
import { addAuditLog } from "../utils/auditLog";
import { buildVerifiedUsersFilter } from "./verified-users/verifiedUsersUtils";
import VerifiedUserCard from "./verified-users/VerifiedUserCard";
import { verifiedUserStyle as styles } from "../themes/verifiedUserStyle";
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
  UserX,
  ShieldCheck,
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
    const load = async () => { await fetchVerifiedUsers(); };
    load();

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
    <div style={styles.container}>
      <Sidebar />

      <main style={styles.main}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <div style={styles.headerTitleGroup}>
              <div style={styles.statusDot} />
              <h1 style={styles.title}>VERIFIED CITIZENS DATABASE</h1>
            </div>
            <p style={styles.subtitle}>
              Official verified resident members of Lagonglong Emergency System. Total:{" "}
              <strong style={{ color: "#1d7a4d" }}>{totalItems}</strong>
            </p>
          </div>

          <div style={styles.headerActions}>
            {/* Search Input */}
            <div style={styles.searchBox}>
              <Search size={18} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search Name or Citizen ID..."
                style={styles.searchInput}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            {/* Suspended Users Button */}
            <button
              type="button"
              style={styles.btnSuspended}
              onClick={openSuspendedUsersPopup}
            >
              <UserX size={16} />
              SUSPENDED USERS
            </button>
          </div>
        </header>

        {/* State Error Handling */}
        {error ? (
          <div style={styles.errorContainer}>
            <AlertCircle size={48} color="#ef4444" />
            <p style={{ margin: 0, fontWeight: "700" }}>{error}</p>
            <button
              onClick={() => fetchVerifiedUsers()}
              style={styles.btnRetry}
            >
              RETRY FETCH
            </button>
          </div>
        ) : loading && users.length === 0 ? (
          <div style={styles.loadingContainer}>
            Loading database records...
          </div>
        ) : users.length === 0 ? (
          <div style={styles.emptyContainer}>
            <ShieldCheck
              size={56}
              color="#64748b"
              style={{ marginBottom: "16px", opacity: 0.8 }}
            />
            <h3 style={{ color: "#111827", margin: "0 0 8px 0" }}>
              No Verified Citizens Found
            </h3>
            <p style={{ margin: 0, fontSize: "14px" }}>
              No active citizen records match your search filter criteria.
            </p>
          </div>
        ) : (
          <>
            {/* Citizen Cards Grid */}
            <div style={styles.cardsGrid}>
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
              <div style={styles.paginationContainer}>
                <button
                  onClick={() =>
                    setPage((pageNumber) => Math.max(1, pageNumber - 1))
                  }
                  disabled={page === 1 || loading}
                  style={styles.paginationBtn(page === 1 || loading)}
                >
                  <ChevronLeft size={16} /> PREV
                </button>

                <span style={styles.paginationText}>
                  PAGE {page} OF {totalPages}
                </span>

                <button
                  onClick={() =>
                    setPage((pageNumber) =>
                      Math.min(totalPages, pageNumber + 1)
                    )
                  }
                  disabled={page === totalPages || loading}
                  style={styles.paginationBtn(page === totalPages || loading)}
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


