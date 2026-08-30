import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import CustomDropdown from "../components/CustomDropdown";
import PremiumPagination from "../components/PremiumPagination";
import PremiumDateRangePicker from "../components/PremiumDateRangePicker";
import PremiumSearchBar from "../components/PremiumSearchBar";
import { useMessageBox } from "../components/MessageBox";
import { useTheme } from "../themes/ThemeContext";
import { addAuditLog } from "../utils/auditLog";
import { buildVerifiedUsersFilter } from "./verified-users/verifiedUsersUtils";
import { getVerifiedUserStyles } from "../themes/verifiedUserStyle";
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
  SlidersHorizontal,
} from "lucide-react";

const USERS_PER_PAGE = 10;

const getFileUrl = (record, field) =>
  record && record[field] ? pb.files.getURL(record, record[field]) : null;

const getInitials = (user) => {
  const first = user.first_name ? user.first_name.trim().charAt(0).toUpperCase() : "";
  const last = user.last_name ? user.last_name.trim().charAt(0).toUpperCase() : "";
  return (first + last) || "U";
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
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palettes.length;
  return palettes[index];
};

function RegistrationDatePicker({ value, onChange, styles }) {
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

export default function VerifiedUsers() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const styles = useMemo(() => getVerifiedUserStyles(isDark), [isDark]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    barangay: "",
    municipality: "",
    startDate: "",
    endDate: "",
    registrationDate: "",
    status: "verified",
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.barangay) count++;
    if (filters.municipality) count++;
    if (filters.startDate || filters.endDate || filters.registrationDate) count++;
    if (filters.status && filters.status !== "verified") count++;
    return count;
  }, [filters]);

  const barangayOptions = useMemo(() => {
    const unique = [...new Set(users.map((user) => user.baranggay).filter(Boolean))];
    return [
      { value: "", label: "All Barangays" },
      ...unique.map((barangay) => ({ value: barangay, label: barangay })),
    ];
  }, [users]);

  const municipalityOptions = useMemo(() => {
    const unique = [...new Set(users.map((user) => user.municipality).filter(Boolean))];
    return [
      { value: "", label: "All Municipalities" },
      ...unique.map((municipality) => ({ value: municipality, label: municipality })),
    ];
  }, [users]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchVerifiedUsers = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      setError(null);

      try {
        const filterString = buildVerifiedUsersFilter(debouncedSearch, filters);

        // If date range filter is active, fetch all matching base filter and filter dates robustly
        if (filters.startDate || filters.endDate) {
          let records = await pb.collection("users").getFullList({
            filter: filterString,
            sort: "-user_id",
            requestKey: null,
          });

          if (filters.startDate) {
            const start = new Date(filters.startDate);
            start.setHours(0, 0, 0, 0);
            records = records.filter((u) => {
              const d = new Date(u.date_time || u.created);
              return !isNaN(d.getTime()) && d >= start;
            });
          }

          if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            records = records.filter((u) => {
              const d = new Date(u.date_time || u.created);
              return !isNaN(d.getTime()) && d <= end;
            });
          }

          const totalItemsCount = records.length;
          const totalPagesCount = Math.max(1, Math.ceil(totalItemsCount / usersPerPage));
          const pageStart = (page - 1) * usersPerPage;
          const pageItems = records.slice(pageStart, pageStart + usersPerPage);

          setUsers(pageItems);
          setTotalPages(totalPagesCount);
          setTotalItems(totalItemsCount);
        } else {
          const records = await pb
            .collection("users")
            .getList(page, usersPerPage, {
              filter: filterString,
              sort: "-user_id",
              requestKey: null,
            });

          setUsers(records.items);
          setTotalPages(records.totalPages || 1);
          setTotalItems(records.totalItems || 0);
        }
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
    [debouncedSearch, page, usersPerPage, filters]
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
          description: message,
        });

        const citizenFullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;
        const currentAdmin = pb.authStore.model;
        const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

        addAuditLog({
          action: "USER_SUSPENDED",
          target: `${citizenFullName} (${user.email || `ID #${user.user_id}`})`,
          details: `Administrator ${adminName} suspended citizen account for ${citizenFullName} (Citizen ID #${user.user_id || user.id}). Reason: "${message.trim()}". Verification revoked.`,
          actor: adminName,
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
          description: "",
        });

        const citizenFullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;
        const currentAdmin = pb.authStore.model;
        const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

        addAuditLog({
          action: "USER_RESTORED",
          target: `${citizenFullName} (${user.email || `ID #${user.user_id}`})`,
          details: `Administrator ${adminName} restored verification for ${citizenFullName} (Citizen ID #${user.user_id || user.id}). Account status set back to verified.`,
          actor: adminName,
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
    if (!value) return "—";
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
        <header style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: isDark ? "#4ade80" : "#15803d" }} />
            <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: "800", color: isDark ? "#f8fafc" : "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
              Registered Citizens
            </h1>
          </div>
          <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: "14px" }}>
            View and manage verified citizen accounts, resident details, and contact numbers.
          </p>
        </header>

        {/* Premium Table Card Upgrade */}
        <div className="premium-table-card">
          {/* Top Toolbar */}
          <div className="table-toolbar">
            <PremiumSearchBar
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm("")}
              placeholder="Search by citizen name, ID, or phone number..."
              minWidth="300px"
              maxWidth="420px"
            />

            <div className="table-toolbar-actions">
              <button
                type="button"
                className={`premium-btn-filter ${showFilters || activeFilterCount > 0 ? "active" : ""}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal size={15} />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span
                    style={{
                      backgroundColor: "#15803d",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: "700",
                      borderRadius: "10px",
                      padding: "1px 6px",
                    }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                className="premium-btn-action"
                onClick={openSuspendedUsersPopup}
              >
                <UserX size={16} />
                <span>Suspended Users</span>
                {suspendedUsers.length > 0 && (
                  <span
                    style={{
                      backgroundColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fef2f2",
                      color: isDark ? "#f87171" : "#b91c1c",
                      border: isDark ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid #fecaca",
                      fontSize: "11px",
                      fontWeight: "800",
                      borderRadius: "10px",
                      padding: "1px 6px",
                      marginLeft: "2px",
                    }}
                  >
                    {suspendedUsers.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Expandable Filter Row */}
          {showFilters && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                padding: "14px 16px",
                marginBottom: "18px",
                backgroundColor: isDark ? "#172338" : "#f8fafc",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                borderRadius: "12px",
              }}
            >
              <CustomDropdown
                label="All Barangays"
                value={filters.barangay}
                options={barangayOptions}
                onChange={(barangay) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, barangay }));
                }}
                minWidth="150px"
              />
              <CustomDropdown
                label="All Municipalities"
                value={filters.municipality}
                options={municipalityOptions}
                onChange={(municipality) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, municipality }));
                }}
                minWidth="160px"
              />
              <PremiumDateRangePicker
                startDate={filters.startDate}
                endDate={filters.endDate}
                onChange={({ startDate: s, endDate: e }) => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    startDate: s,
                    endDate: e,
                    registrationDate: "",
                  }));
                }}
                onClear={() => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    startDate: "",
                    endDate: "",
                    registrationDate: "",
                  }));
                }}
                placeholder="Registration Date"
              />
              <CustomDropdown
                label="Verified"
                value={filters.status}
                options={[
                  { value: "verified", label: "Verified" },
                  { value: "suspended", label: "Suspended" },
                  { value: "all", label: "All Statuses" },
                ]}
                onChange={(status) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, status }));
                }}
                minWidth="130px"
              />
              <button
                type="button"
                className="verifiedUsersButton"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 14px",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                  borderRadius: "8px",
                  backgroundColor: isDark ? "#1e293b" : "#ffffff",
                  color: isDark ? "#cbd5e1" : "#64748b",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "700",
                  transition: "all 0.15s ease",
                }}
                onClick={() => {
                  setSearchTerm("");
                  setFilters({ barangay: "", municipality: "", startDate: "", endDate: "", registrationDate: "", status: "verified" });
                  setPage(1);
                }}
              >
                <X size={14} />
                Clear
              </button>
            </div>
          )}

          {/* Table Error / Loading / Content */}
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
              <Loader className="animate-spin" size={42} color={isDark ? "#4ade80" : "#15803d"} />
              <span>Loading verified citizen records...</span>
            </div>
          ) : users.length === 0 ? (
            <div style={styles.emptyContainer}>
              <ShieldCheck
                size={56}
                color={isDark ? "#4ade80" : "#64748b"}
                style={{ marginBottom: "16px", opacity: 0.9 }}
              />
              <h3 style={{ color: isDark ? "#f8fafc" : "#111827", margin: "0 0 8px 0" }}>
                No Verified Citizens Found
              </h3>
              <p style={{ margin: 0, fontSize: "14px", color: isDark ? "#94a3b8" : "#64748b" }}>
                No verified citizen records match your search or filter criteria. Try clearing your filters or using different keywords.
              </p>
            </div>
          ) : (
            <>
              {/* Table Wrapper */}
              <div className="premium-table-wrapper" style={{ overflowX: "auto" }}>
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Contact</th>
                      <th>Registered</th>
                      <th>Status</th>
                      <th style={{ textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Unknown User";
                      const initials = getInitials(user);
                      const avatarPalette = getAvatarStyle(fullName);
                      const selfieUrl = getFileUrl(user, "selfie");

                      return (
                        <tr
                          key={user.id}
                          onClick={() => openUserDetails(user)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <div className="premium-user-cell">
                              {selfieUrl ? (
                                <img
                                  src={selfieUrl}
                                  alt={fullName}
                                  className="premium-avatar"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openImagePreview(selfieUrl);
                                  }}
                                  style={{ cursor: "pointer" }}
                                />
                              ) : (
                                <div
                                  className="premium-avatar"
                                  style={{
                                    background: avatarPalette.bg,
                                    color: avatarPalette.color,
                                  }}
                                >
                                  {initials}
                                </div>
                              )}
                              <div className="premium-user-info">
                                <span
                                  className="premium-user-name"
                                  onClick={() => openUserDetails(user)}
                                  style={{ cursor: "pointer" }}
                                >
                                  {fullName}
                                </span>
                                <span className="premium-user-sub">
                                  {user.email || `Citizen ID: #${user.user_id || "N/A"}`}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div>
                              <span style={{ fontWeight: 600, color: isDark ? "#f8fafc" : "#1e293b", display: "block" }}>
                                Resident
                              </span>
                              <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>
                                {user.baranggay || "Lagonglong"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ color: isDark ? "#cbd5e1" : "#334155", fontWeight: 500 }}>
                              {user.contact_number || user.contactNumber || "—"}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: "13px" }}>
                              {formatRegisteredDate(user.date_time)}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`premium-status-pill ${
                                user.status === "verified"
                                  ? "status-pill-active"
                                  : user.status === "suspended"
                                  ? "status-pill-suspended"
                                  : "status-pill-pending"
                              }`}
                            >
                              {user.status === "verified"
                                ? "Active"
                                : user.status === "suspended"
                                ? "Suspended"
                                : user.status || "Active"}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className="premium-action-btn"
                              onClick={() => openUserDetails(user)}
                              title="View details"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer with Premium Pagination */}
              <div className="premium-table-footer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", padding: "16px 20px" }}>
                <div className="premium-pagination-info" style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600" }}>
                  Showing <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{totalItems === 0 ? 0 : (page - 1) * usersPerPage + 1}</strong>–
                  <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{Math.min(page * usersPerPage, totalItems)}</strong> of <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{totalItems}</strong> Users
                </div>

                <PremiumPagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={(newPage) => setPage(newPage)}
                  pageSize={usersPerPage}
                  pageSizeOptions={[5, 10, 20, 50]}
                  onPageSizeChange={(newSize) => {
                    setUsersPerPage(newSize);
                    setPage(1);
                  }}
                  totalItems={totalItems}
                />
              </div>
            </>
          )}
        </div>
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
        onViewUser={(user) => {
          closeSuspendedUsersPopup();
          navigate(`/verified-users/${user.id}`);
        }}
        onUnsuspend={handleUnsuspendUser}
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
