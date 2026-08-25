import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";

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
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
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

  // 3. Client-side Search and Filter
  const filteredLogs = logs.filter((log) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (log.admin_name || log.actor || "").toLowerCase().includes(searchLower) ||
      (log.target || "").toLowerCase().includes(searchLower) ||
      (log.action || "").toLowerCase().includes(searchLower) ||
      (log.details || "").toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE) || 1;
  const paginatedLogs = filteredLogs.slice((page - 1) * LOGS_PER_PAGE, page * LOGS_PER_PAGE);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* Header Section */}
        <header style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#15803d" }} />
            <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: "800", color: "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
              Central Audit Trail
            </h1>
          </div>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
            Review recorded administrative actions, system events, and security access logs.
          </p>
        </header>

        {/* Premium Table Card */}
        <div className="premium-table-card">
          {/* Top Toolbar */}
          <div className="table-toolbar">
            <div className="search-box-premium">
              <Search size={18} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search by administrator name, target ID, or action..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setPage(1);
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "#94a3b8" }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="table-toolbar-actions">
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748b" }}>
                Total Records: <strong>{filteredLogs.length}</strong>
              </span>
            </div>
          </div>

          {/* Table Content */}
          {loading && logs.length === 0 ? (
            <div style={{ padding: "50px", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", color: "#15803d" }}>
              <Loader className="animate-spin" size={26} />
              <span>Loading audit logs from database...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b" }}>
              <ShieldAlert size={42} color="#94a3b8" style={{ marginBottom: "12px" }} />
              <h3 style={{ margin: "0 0 6px 0", color: "#1e293b", fontSize: "16px" }}>No Audit Logs Found</h3>
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

                      return (
                        <React.Fragment key={log.id}>
                          <tr>
                            <td>
                              <div>
                                <span style={{ fontWeight: "700", color: "#1e293b", fontSize: "13px", display: "block" }}>
                                  {new Date(log.created).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "2-digit",
                                    year: "numeric",
                                  })}
                                </span>
                                <span style={{ fontSize: "12px", color: "#64748b" }}>
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
                                  backgroundColor: "#f0fdf4",
                                  color: "#15803d",
                                  border: "1px solid #bbf7d0",
                                }}
                              >
                                {log.action || "LOG_EVENT"}
                              </span>
                            </td>

                            <td>
                              <span
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "12px",
                                  color: "#475569",
                                  backgroundColor: "#f1f5f9",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                }}
                              >
                                {log.target || "N/A"}
                              </span>
                            </td>

                            <td>
                              <div style={{ maxWidth: "340px", fontSize: "13px", color: "#334155" }}>
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
                                    color: "#15803d",
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
                            <tr style={{ backgroundColor: "#f8fafc" }}>
                              <td colSpan="5" style={{ padding: "16px 20px" }}>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                    gap: "12px",
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "10px",
                                    padding: "14px",
                                  }}
                                >
                                  <div>
                                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Log ID</span>
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>{log.id}</div>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Admin</span>
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>{log.admin_name || log.actor || "System"}</div>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Timestamp</span>
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>{new Date(log.created).toLocaleString()}</div>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Target Reference</span>
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>{log.target || "N/A"}</div>
                                  </div>
                                  <div style={{ gridColumn: "1 / -1" }}>
                                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Full Event Description</span>
                                    <div style={{ fontSize: "13px", color: "#1e293b", marginTop: "4px", whiteSpace: "pre-wrap" }}>{log.details || "No additional context."}</div>
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

              {/* Table Footer / Pagination */}
              <div className="premium-table-footer">
                <div className="premium-pagination-info">
                  Showing <strong>{Math.min((page - 1) * LOGS_PER_PAGE + 1, filteredLogs.length)}</strong>–
                  <strong>{Math.min(page * LOGS_PER_PAGE, filteredLogs.length)}</strong> of <strong>{filteredLogs.length}</strong> Logs
                </div>

                <div className="premium-pagination-controls">
                  <button
                    type="button"
                    className="premium-page-nav-btn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => index + 1).slice(
                    Math.max(0, page - 3),
                    Math.min(totalPages, page + 2)
                  ).map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      className={`premium-page-num-btn ${page === pageNum ? "active" : ""}`}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="premium-page-nav-btn"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
