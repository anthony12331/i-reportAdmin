import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Search,
  Clock,
  User,
  Target,
  Activity,
  Loader,
  Database,
  Filter,
  RefreshCw,
} from "lucide-react";
import { pb } from "./pocketbase";
import Sidebar from "./Sidebar";

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // 1. Fetch historical logs securely from your PocketBase server
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const recordList = await pb.collection("audit_logs").getList(1, 100, {
        sort: "-created", // Newest logs first
        requestKey: null, // Prevents auto-cancelling duplicate queries
      });
      setLogs(recordList.items);
    } catch (error) {
      if (!error.isAbort) {
        console.error("Failed to fetch secure audit logs:", error);
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
      log.target?.toLowerCase().includes(searchLower) ||
      log.action?.toLowerCase().includes(searchLower) ||
      log.details?.toLowerCase().includes(searchLower)
    );
  });

  // Helper function to format action badges with context colors
  const getActionStyle = (action = "") => {
    const act = action.toLowerCase();
    if (act.includes("delete") || act.includes("remove") || act.includes("revoke")) {
      return {
        bg: "rgba(239, 68, 68, 0.15)",
        color: "#f87171",
        border: "1px solid #ef4444",
      };
    }
    if (act.includes("create") || act.includes("add") || act.includes("grant")) {
      return {
        bg: "rgba(16, 185, 129, 0.15)",
        color: "#34d399",
        border: "1px solid #10b981",
      };
    }
    if (act.includes("update") || act.includes("edit") || act.includes("modify")) {
      return {
        bg: "rgba(245, 158, 11, 0.15)",
        color: "#fbbf24",
        border: "1px solid #f59e0b",
      };
    }
    return {
      bg: "rgba(56, 189, 248, 0.15)",
      color: "#38bdf8",
      border: "1px solid #38bdf8",
    };
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
        {/* Header Section */}
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
                  backgroundColor: "#ef4444",
                  boxShadow: "0 0 12px #ef4444",
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
                CENTRAL AUDIT TRAIL
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
              Live administrative action stream & security event telemetry
            </p>
          </div>

         
        </header>

        {/* Search & Filter Bar */}
        <div
          style={{
            backgroundColor: "#1e293b",
            padding: "16px",
            borderRadius: "16px",
            border: "1px solid #334155",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <Search size={18} color="#38bdf8" style={{ marginLeft: "8px" }} />
          <input
            type="text"
            placeholder="Search audit trail by admin name, target ID, action type, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "10px",
              padding: "10px 14px",
              color: "#f8fafc",
              fontSize: "13px",
              fontWeight: "600",
              outline: "none",
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              style={{
                backgroundColor: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "700",
                padding: "0 8px",
              }}
            >
              CLEAR
            </button>
          )}
        </div>

        {/* Audit Table Card */}
        <div
          style={{
            backgroundColor: "#1e293b",
            borderRadius: "16px",
            border: "1px solid #334155",
            overflow: "hidden",
          }}
        >
          {loading && logs.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "60px 20px",
                color: "#94a3b8",
                gap: "12px",
              }}
            >
              <Loader className="animate-spin" size={28} color="#38bdf8" />
              <span style={{ fontSize: "14px", fontWeight: "700" }}>
                Accessing secure audit logs from central database...
              </span>
            </div>
          ) : logs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "#64748b",
                fontSize: "14px",
                fontWeight: "700",
              }}
            >
              No security audit logs captured in the database yet.
            </div>
          ) : filteredLogs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "#64748b",
                fontSize: "14px",
                fontWeight: "700",
              }}
            >
              No database log entries match your search criteria.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: "#0f172a",
                    borderBottom: "2px solid #334155",
                    color: "#94a3b8",
                    fontSize: "11px",
                    fontWeight: "800",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  <th style={{ padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Clock size={14} color="#38bdf8" /> TIMESTAMP
                    </div>
                  </th>
                  <th style={{ padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <User size={14} color="#38bdf8" /> ADMIN ACTOR
                    </div>
                  </th>
                  <th style={{ padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Activity size={14} color="#38bdf8" /> ACTION
                    </div>
                  </th>
                  <th style={{ padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Target size={14} color="#38bdf8" /> TARGET REF ID
                    </div>
                  </th>
                  <th style={{ padding: "16px" }}>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const actionStyle = getActionStyle(log.action);

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: "1px solid #334155",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      {/* Timestamp */}
                      <td style={{ padding: "16px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#cbd5e1" }}>
                          {new Date(log.created).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                          {new Date(log.created).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                      </td>

                      {/* Admin Actor */}
                      <td style={{ padding: "16px", fontWeight: "800", color: "#f8fafc", fontSize: "13px" }}>
                        {log.admin_name || log.actor || "System Administrator"}
                      </td>

                      {/* Action Badge */}
                      <td style={{ padding: "16px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: "800",
                            backgroundColor: actionStyle.bg,
                            color: actionStyle.color,
                            border: actionStyle.border,
                            display: "inline-block",
                            textTransform: "uppercase",
                          }}
                        >
                          {log.action || "LOG_EVENT"}
                        </span>
                      </td>

                      {/* Target Ref ID */}
                      <td style={{ padding: "16px" }}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            color: "#38bdf8",
                            backgroundColor: "rgba(56, 189, 248, 0.1)",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            border: "1px solid rgba(56, 189, 248, 0.2)",
                          }}
                        >
                          {log.target || "N/A"}
                        </span>
                      </td>

                      {/* Details */}
                      <td style={{ padding: "16px", color: "#94a3b8", fontSize: "13px", maxWidth: "300px" }}>
                        {log.details || "No additional context recorded."}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}