import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { useMessageBox } from "../components/MessageBox";
import { addAuditLog } from "../utils/auditLog";
import { buildVerifiedUsersFilter } from "./verified-users/verifiedUsersUtils";
import { verifiedUserStyle as styles } from "../themes/verifiedUserStyle";
import {
  SuspendPromptModal,
  SuspendedUsersModal,
  UserImagePreviewModal,
  VerifiedUserDetailsModal,
} from "./verified-users/VerifiedUsersModals";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
  Loader,
  UserX,
  Calendar,
  ChevronDown,
  X,
} from "lucide-react";

const USERS_PER_PAGE = 12;

const getFileUrl = (record, field) =>
  record && record[field] ? pb.files.getURL(record, record[field]) : null;

function RegistrationDatePicker({ value, onChange }) {
  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(selectedDate || new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: firstDay + daysInMonth }, (_, index) =>
    index < firstDay ? null : index - firstDay + 1
  );
  const toValue = (day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const displayValue = selectedDate
    ? selectedDate.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    : "Registration date";

  return (
    <div style={styles.datePicker}>
      <button type="button" className="verifiedUsersButton" style={styles.dateTrigger} onClick={() => setOpen((isOpen) => !isOpen)}>
        <Calendar size={14} />
        {displayValue}
      </button>
      {open && (
        <div style={styles.datePopover}>
          <div style={styles.dateHeader}>
            <strong>{viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
            <div style={styles.dateNavigation}>
              <button type="button" className="verifiedUsersButton" style={styles.dateNavButton} onClick={() => setViewDate(new Date(year, month - 1, 1))}>‹</button>
              <button type="button" className="verifiedUsersButton" style={styles.dateNavButton} onClick={() => setViewDate(new Date(year, month + 1, 1))}>›</button>
            </div>
          </div>
          <div style={styles.weekdays}>{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day}>{day}</span>)}</div>
          <div style={styles.dateGrid}>
            {days.map((day, index) => day ? (
              <button key={day} type="button" className="verifiedUsersButton" style={styles.dayButton(value === toValue(day), new Date().toDateString() === new Date(year, month, day).toDateString())} onClick={() => { onChange(toValue(day)); setOpen(false); }}>
                {day}
              </button>
            ) : <span key={`empty-${index}`} />)}
          </div>
          <div style={styles.dateFooter}>
            <button type="button" className="verifiedUsersButton" style={styles.dateTextButton} onClick={() => { onChange(""); setOpen(false); }}>Clear</button>
            <button type="button" className="verifiedUsersButton" style={styles.dateTextButton} onClick={() => { const today = new Date(); onChange(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`); setViewDate(today); setOpen(false); }}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label || label;

  return (
    <div style={styles.filterDropdown}>
      <button type="button" className="verifiedUsersButton" style={styles.filterDropdownTrigger} onClick={() => setOpen((isOpen) => !isOpen)}>
        <span>{selectedLabel}</span>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 180ms ease" }} />
      </button>
      {open && (
        <div style={styles.filterDropdownMenu}>
          {options.map((option) => (
            <button key={option.value} type="button" className="verifiedUsersButton" style={styles.filterDropdownOption(option.value === value)} onClick={() => { onChange(option.value); setOpen(false); }}>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VerifiedUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    barangay: "",
    municipality: "",
    registrationDate: "",
    status: "verified",
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [previewImage, setPreviewImage] = useState(null);
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
        const filterString = buildVerifiedUsersFilter(debouncedSearch, filters);
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
    [debouncedSearch, page, filters]
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

  const openUserDetails = useCallback((user) => {
    navigate(`/verified-users/${user.id}`);
  }, [navigate]);

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

  const selectedUserProfileImageUrl = getFileUrl(selectedUser, "selfie");
  const selectedUserIdPhotoUrl = getFileUrl(selectedUser, "id_photo");
  const formatRegisteredDate = (value) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div style={styles.container}>
      <Sidebar />

      <main style={styles.main}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <div style={styles.headerTitleGroup}>
              <h1 style={styles.title}>Registered Users Management</h1>
            </div>
            <p style={styles.subtitle}>Manage and monitor all verified residents of Barangay Lagonglong.</p>
          </div>

        </header>

        <div style={styles.filterBar}>
          <div className="verifiedUsersSearchBox" style={{ ...styles.searchBox, ...styles.filterBarSearch }}>
            <Search size={18} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search by name or phone number..."
              style={styles.searchInput}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <FilterDropdown label="All Barangays" value={filters.barangay} options={[{ value: "", label: "All Barangays" }, ...[...new Set(users.map((user) => user.baranggay).filter(Boolean))].map((barangay) => ({ value: barangay, label: barangay }))]} onChange={(barangay) => { setPage(1); setFilters((current) => ({ ...current, barangay })); }} />
          <FilterDropdown label="All Municipalities" value={filters.municipality} options={[{ value: "", label: "All Municipalities" }, ...[...new Set(users.map((user) => user.municipality).filter(Boolean))].map((municipality) => ({ value: municipality, label: municipality }))]} onChange={(municipality) => { setPage(1); setFilters((current) => ({ ...current, municipality })); }} />
          <RegistrationDatePicker value={filters.registrationDate} onChange={(registrationDate) => { setPage(1); setFilters((current) => ({ ...current, registrationDate })); }} />
          <FilterDropdown label="Verified" value={filters.status} options={[{ value: "verified", label: "Verified" }, { value: "suspended", label: "Suspended" }, { value: "all", label: "All Statuses" }]} onChange={(status) => { setPage(1); setFilters((current) => ({ ...current, status })); }} />
          <button
            type="button"
            className="verifiedUsersButton"
            style={styles.filterAction}
            onClick={openSuspendedUsersPopup}
          >
            <UserX size={15} />
            View Suspended Users
          </button>
          <button
            type="button"
            className="verifiedUsersButton"
            style={styles.clearFiltersButton}
            onClick={() => {
              setSearchTerm("");
              setFilters({ barangay: "", municipality: "", registrationDate: "", status: "verified" });
              setPage(1);
            }}
          >
            <X size={14} />
            Clear Filters
          </button>
        </div>

        {/* State Error Handling */}
        {error ? (
          <div style={styles.errorContainer}>
            <AlertCircle size={48} color="#ef4444" />
            <p style={{ margin: 0, fontWeight: "700" }}>{error}</p>
            <button
              className="verifiedUsersButton"
              onClick={() => fetchVerifiedUsers()}
              style={styles.btnRetry}
            >
              RETRY FETCH
            </button>
          </div>
        ) : loading && users.length === 0 ? (
          <div style={styles.loadingContainer}>
            <Loader className="animate-spin" size={42} color="#1d7a4d" />
            <span>Loading verified user records...</span>
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
            <div style={styles.tableCard}>
              <div style={styles.tableScroll}>
                <table style={styles.usersTable}>
                  <thead>
                    <tr>
                      <th style={styles.tableHeader}>USER</th>
                      <th style={styles.tableHeader}>CONTACT</th>
                      <th style={styles.tableHeader}>ADDRESS</th>
                      <th style={styles.tableHeader}>REGISTERED DATE</th>
                      <th style={styles.tableHeader}>STATUS</th>
                      <th style={styles.tableHeader}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Unknown User";
                      const address = user.baranggay || "No address";
                      return (
                        <tr key={user.id} style={styles.tableRow}>
                          <td style={styles.tableCell}>
                            <div style={styles.tableUserButton}>
                              {getFileUrl(user, "selfie") ? (
                                <img src={getFileUrl(user, "selfie")} alt="" style={styles.tableAvatar} />
                              ) : <span style={styles.tableAvatarFallback}><ShieldCheck size={14} /></span>}
                              <div style={styles.tableUserInfo}>
                                <strong>{fullName}</strong>
                                <span style={styles.tableCitizenId}>Citizen ID: #{user.user_id || "N/A"}</span>
                              </div>
                            </div>
                          </td>
                          <td style={styles.tableCell}>{user.contact_number || user.contactNumber || "No contact"}</td>
                          <td style={styles.tableCell}>{address}</td>
                          <td style={styles.tableCell}>{formatRegisteredDate(user.date_time)}</td>
                          <td style={styles.tableCell}><span style={styles.statusPill(user.status)}>{user.status === "verified" ? "Active" : user.status === "suspended" ? "Suspended" : user.status || "Unknown"}</span></td>
                          <td style={styles.tableCell}>
                            <button type="button" className="verifiedUsersActionLink" style={styles.actionLink} onClick={() => openUserDetails(user)}>
                              View/Suspend
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={styles.tableFooter}>
                Showing {Math.min((page - 1) * USERS_PER_PAGE + 1, totalItems)} to {Math.min(page * USERS_PER_PAGE, totalItems)} of {totalItems} results
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={styles.paginationContainer}>
                <button
                  className="verifiedUsersButton"
                  onClick={() =>
                    setPage((pageNumber) => Math.max(1, pageNumber - 1))
                  }
                  disabled={page === 1 || loading}
                  style={styles.paginationBtn(page === 1 || loading)}
                >
                  <ChevronLeft size={16} /> PREV
                </button>

                <span style={styles.paginationText}>
                  Showing {Math.min((page - 1) * USERS_PER_PAGE + 1, totalItems)} to {Math.min(page * USERS_PER_PAGE, totalItems)} of {totalItems} results
                </span>

                <div style={styles.pageNumbers}>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      className="verifiedUsersButton"
                      onClick={() => setPage(pageNumber)}
                      disabled={loading}
                      style={styles.pageNumberBtn(page === pageNumber, loading)}
                    >
                      {pageNumber}
                    </button>
                  ))}
                </div>

                <button
                  className="verifiedUsersButton"
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


