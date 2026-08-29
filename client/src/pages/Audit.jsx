import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Clock,
  User,
  Target,
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader,
  X,
  ShieldAlert,
  Calendar,
} from "lucide-react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import CustomDropdown from "../components/CustomDropdown";
import PremiumPagination from "../components/PremiumPagination";
import PremiumDateRangePicker from "../components/PremiumDateRangePicker";
import PremiumSearchBar from "../components/PremiumSearchBar";
import { useTheme } from "../themes/ThemeContext";
import { getActionStyle } from "../themes/auditStyles";

const LOGS_PER_PAGE = 12;

const getInitials = (name) => {
  if (!name) return "SY";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
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

export default function Audit() {
  const { isDark } = useTheme();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [page, setPage] = useState(1);

  // 1. Fetch historical logs securely from PocketBase
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const recordList = await pb.collection("audit_logs").getList(1, 200, {
        sort: "-created",
        requestKey: null,
      });
      setLogs(recordList.items);
    } catch (error) {
      if (!error.isAbort) {
        console.warn("Failed to fetch secure audit logs from database:", error);
        setLogs([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Real-time subscription for PocketBase
  useEffect(() => {
    let isMounted = true;
    let unsubscribe;

    const setupSubscription = async () => {
      await fetchLogs();

      unsubscribe = await pb.collection("audit_logs").subscribe("*", (e) => {
        if (!isMounted) return;
        if (e.action === "create") {
          setLogs((prev) => [e.record, ...prev]);
        }
      }).catch((err) => {
        console.warn("Could not subscribe to audit_logs collection:", err);
      });
    };

    setupSubscription();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [fetchLogs]);

  // 3. Client-side Search and Filter with useMemo
  const filteredLogs = useMemo(() => {
    let result = logs;

    // Action filter
    if (actionFilter && actionFilter !== "all") {
      result = result.filter((log) => {
        const actionLower = (log.action || "").toLowerCase();
        const detailsLower = (log.details || "").toLowerCase();
        if (actionFilter === "auth") return actionLower.includes("login") || actionLower.includes("logout") || actionLower.includes("auth");
        if (actionFilter === "user") return actionLower.includes("user") || actionLower.includes("citizen") || actionLower.includes("verify") || actionLower.includes("reject") || detailsLower.includes("citizen");
        if (actionFilter === "dispatch") return actionLower.includes("dispatch") || actionLower.includes("responder") || actionLower.includes("backup");
        if (actionFilter === "incident") return actionLower.includes("incident") || actionLower.includes("sos") || actionLower.includes("resolve");
        if (actionFilter === "admin") return actionLower.includes("admin") || actionLower.includes("rbac") || actionLower.includes("pin") || actionLower.includes("permission");
        return true;
      });
    }

    // Date filter
    if (dateFilter && dateFilter !== "all") {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      result = result.filter((log) => {
        if (!log.created) return true;
        const logDate = new Date(log.created);

        if (dateFilter === "today") {
          return logDate >= startOfToday;
        }
        if (dateFilter === "yesterday") {
          const startOfYesterday = new Date(startOfToday);
          startOfYesterday.setDate(startOfYesterday.getDate() - 1);
          return logDate >= startOfYesterday && logDate < startOfToday;
        }
        if (dateFilter === "last7days") {
          const past7 = new Date(startOfToday);
          past7.setDate(past7.getDate() - 7);
          return logDate >= past7;
        }
        if (dateFilter === "last30days") {
          const past30 = new Date(startOfToday);
          past30.setDate(past30.getDate() - 30);
          return logDate >= past30;
        }
        if (dateFilter === "thisMonth") {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return logDate >= startOfMonth;
        }
        if (dateFilter === "custom") {
          if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (logDate < start) return false;
          }
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (logDate > end) return false;
          }
          return true;
        }
        return true;
      });
    }

    // Search query
    if (!searchTerm.trim()) return result;
    const searchLower = searchTerm.toLowerCase();
    return result.filter((log) => {
      return (
        (log.admin_name || log.actor || "").toLowerCase().includes(searchLower) ||
        (log.target || "").toLowerCase().includes(searchLower) ||
        (log.action || "").toLowerCase().includes(searchLower) ||
        (log.details || "").toLowerCase().includes(searchLower)
      );
    });
  }, [logs, actionFilter, dateFilter, startDate, endDate, searchTerm]);

  const totalPages = useMemo(() => Math.ceil(filteredLogs.length / LOGS_PER_PAGE) || 1, [filteredLogs.length]);
  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice((page - 1) * LOGS_PER_PAGE, page * LOGS_PER_PAGE);
  }, [filteredLogs, page]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: isDark ? "#090d16" : "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* Header Section */}
        <header style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: isDark ? "#4ade80" : "#15803d" }} />
            <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: "800", color: isDark ? "#f8fafc" : "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
              Audit Logs
            </h1>
          </div>
          <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: "14px" }}>
            Record of all administrator activities, dispatches, account updates, and logins.
          </p>
        </header>

        {/* Premium Table Card */}
        <div className="premium-table-card">
          {/* Top Toolbar */}
          <div className="table-toolbar" style={{ flexWrap: "wrap", gap: "12px" }}>
            <PremiumSearchBar
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              onClear={() => {
                setSearchTerm("");
                setPage(1);
              }}
              placeholder="Search by admin name, target ID, or action..."
              minWidth="300px"
              maxWidth="420px"
            />

            <div className="table-toolbar-actions" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {/* Action Filter Dropdown */}
              <CustomDropdown
                value={actionFilter}
                onChange={(val) => {
                  setActionFilter(val);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: "All Actions" },
                  { value: "auth", label: "Logins / Logouts" },
                  { value: "user", label: "Citizen Verification" },
                  { value: "dispatch", label: "Dispatches & Responders" },
                  { value: "incident", label: "Incidents & Resolution" },
                  { value: "admin", label: "Admins & Permissions" },
                ]}
                minWidth="170px"
                size="sm"
              />

              {/* Premium Date Range Picker */}
              <PremiumDateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={({ startDate: s, endDate: e }) => {
                  setStartDate(s);
                  setEndDate(e);
                  setDateFilter(s ? "custom" : "all");
                  setPage(1);
                }}
                onClear={() => {
                  setStartDate("");
                  setEndDate("");
                  setDateFilter("all");
                  setPage(1);
                }}
                placeholder="Filter by Date"
              />

              <span style={{ fontSize: "13px", fontWeight: "600", color: isDark ? "#94a3b8" : "#64748b" }}>
                Total Records: <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{filteredLogs.length}</strong>
              </span>
            </div>
          </div>

          {/* Table Content */}
          {loading && logs.length === 0 ? (
            <div style={{ padding: "50px", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", color: isDark ? "#4ade80" : "#15803d" }}>
              <Loader className="animate-spin" size={26} />
              <span>Loading audit logs from database...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: isDark ? "#94a3b8" : "#64748b" }}>
              <ShieldAlert size={42} color={isDark ? "#64748b" : "#94a3b8"} style={{ marginBottom: "12px" }} />
              <h3 style={{ margin: "0 0 6px 0", color: isDark ? "#f8fafc" : "#1e293b", fontSize: "16px" }}>No Audit Logs Found</h3>
              <p style={{ margin: 0, fontSize: "13.5px" }}>
                {searchTerm ? "No log entries match your search query." : "No administrative audit events recorded yet."}
              </p>
            </div>
          ) : (
            <>
              <div className="premium-table-wrapper" style={{ overflowX: "auto" }}>
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Admin Actor</th>
                      <th>Action</th>
                      <th>Target Ref</th>
                      <th>Event Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLogs.map((log) => {
                      const actorName = log.admin_name || log.actor || "System Administrator";
                      const initials = getInitials(actorName);
                      const avatarStyle = getAvatarStyle(actorName);
                      const isExpanded = expandedLogId === log.id;
                      const actStyle = getActionStyle(log.action, isDark);

                      return (
                        <React.Fragment key={log.id}>
                          <tr>
                            <td>
                              <div>
                                <span style={{ fontWeight: "700", color: isDark ? "#f8fafc" : "#1e293b", fontSize: "13px", display: "block" }}>
                                  {new Date(log.created).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "2-digit",
                                    year: "numeric",
                                  })}
                                </span>
                                <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>
                                  {new Date(log.created).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })}
                                </span>
                              </div>
                            </td>

                            <td>
                              <div className="premium-user-cell">
                                <div className="premium-avatar" style={{ background: avatarStyle.bg, color: avatarStyle.color }}>
                                  {initials}
                                </div>
                                <div className="premium-user-info">
                                  <span className="premium-user-name">{actorName}</span>
                                  <span className="premium-user-sub">Authorized Actor</span>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "4px 10px",
                                  borderRadius: "12px",
                                  fontSize: "12px",
                                  fontWeight: "700",
                                  backgroundColor: actStyle.bg,
                                  color: actStyle.color,
                                  border: actStyle.border,
                                }}
                              >
                                {log.action || "LOG_EVENT"}
                              </span>
                            </td>

                            <td>
                              <span
                                style={{
                                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  color: isDark ? "#4ade80" : "#475569",
                                  backgroundColor: isDark ? "#172338" : "#f1f5f9",
                                  border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  display: "inline-block",
                                }}
                              >
                                {log.target || "N/A"}
                              </span>
                            </td>

                            <td>
                              <div style={{ maxWidth: "340px", fontSize: "13px", color: isDark ? "#cbd5e1" : "#334155" }}>
                                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isExpanded ? "normal" : "nowrap" }}>
                                  {log.details || "No additional context recorded."}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    padding: "4px 0 0 0",
                                    color: isDark ? "#4ade80" : "#15803d",
                                    fontSize: "12px",
                                    fontWeight: "700",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                >
                                  <ChevronDown size={13} style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.18s" }} />
                                  {isExpanded ? "Hide Details" : "View Details"}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr style={{ backgroundColor: isDark ? "#0c1322" : "#f8fafc" }}>
                              <td colSpan="5" style={{ padding: "16px 20px" }}>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                    gap: "12px",
                                    backgroundColor: isDark ? "#131c2e" : "#ffffff",
                                    border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                                    borderRadius: "10px",
                                    padding: "14px",
                                  }}
                                >
                                  <div>
                                    <span style={{ fontSize: "11px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase" }}>Log ID</span>
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: isDark ? "#f8fafc" : "#0f172a" }}>{log.id}</div>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: "11px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase" }}>Admin</span>
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: isDark ? "#f8fafc" : "#0f172a" }}>{log.admin_name || log.actor || "System"}</div>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: "11px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase" }}>Timestamp</span>
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: isDark ? "#f8fafc" : "#0f172a" }}>{new Date(log.created).toLocaleString()}</div>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: "11px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase" }}>Target Reference</span>
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: isDark ? "#4ade80" : "#0f172a" }}>{log.target || "N/A"}</div>
                                  </div>
                                  <div style={{ gridColumn: "1 / -1" }}>
                                    <span style={{ fontSize: "11px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase" }}>Full Event Description</span>
                                    <div style={{ fontSize: "13px", color: isDark ? "#cbd5e1" : "#1e293b", marginTop: "4px", whiteSpace: "pre-wrap" }}>{log.details || "No additional context."}</div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer / Premium Pagination */}
              <div className="premium-table-footer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", padding: "16px 20px" }}>
                <div className="premium-pagination-info" style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600" }}>
                  Showing <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{Math.min((page - 1) * LOGS_PER_PAGE + 1, filteredLogs.length)}</strong>–
                  <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{Math.min(page * LOGS_PER_PAGE, filteredLogs.length)}</strong> of <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{filteredLogs.length}</strong> Logs
                </div>

                <PremiumPagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={(newPage) => setPage(newPage)}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
