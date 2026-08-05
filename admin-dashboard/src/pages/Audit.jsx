import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Clock,
  User,
  Target,
  Activity,
  Loader,
} from "lucide-react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { auditStyles, getActionStyle } from "../themes/auditStyles";

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // 1. Fetch historical logs securely from PocketBase
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const recordList = await pb.collection("audit_logs").getList(1, 100, {
        sort: "-created",
        requestKey: null,
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

  return (
    <div style={auditStyles.shell}>
      <Sidebar />

      <main style={auditStyles.main}>
        {/* Header Section */}
        <header style={auditStyles.header}>
          <div>
            <div style={auditStyles.titleWrapper}>
              <div style={auditStyles.titleDot} />
              <h1 style={auditStyles.titleText}>CENTRAL AUDIT TRAIL</h1>
            </div>
            <p style={auditStyles.subtitle}>
              Live administrative action stream & security event telemetry
            </p>
          </div>
        </header>

        {/* Search Bar */}
        <div style={auditStyles.searchBar}>
          <Search size={18} color="#38bdf8" style={{ marginLeft: "8px" }} />
          <input
            type="text"
            placeholder="Search audit trail by admin name, target ID, action type, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={auditStyles.searchInput}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              style={auditStyles.clearBtn}
            >
              CLEAR
            </button>
          )}
        </div>

        {/* Audit Table Card */}
        <div style={auditStyles.tableCard}>
          {loading && logs.length === 0 ? (
            <div style={auditStyles.centerBox}>
              <Loader className="animate-spin" size={28} color="#38bdf8" />
              <span style={auditStyles.centerText}>
                Accessing secure audit logs from central database...
              </span>
            </div>
          ) : logs.length === 0 ? (
            <div style={auditStyles.emptyStateText}>
              No security audit logs captured in the database yet.
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={auditStyles.emptyStateText}>
              No database log entries match your search criteria.
            </div>
          ) : (
            <table style={auditStyles.table}>
              <thead>
                <tr style={auditStyles.theadRow}>
                  <th style={auditStyles.th}>
                    <div style={auditStyles.thFlex}>
                      <Clock size={14} color="#38bdf8" /> TIMESTAMP
                    </div>
                  </th>
                  <th style={auditStyles.th}>
                    <div style={auditStyles.thFlex}>
                      <User size={14} color="#38bdf8" /> ADMIN ACTOR
                    </div>
                  </th>
                  <th style={auditStyles.th}>
                    <div style={auditStyles.thFlex}>
                      <Activity size={14} color="#38bdf8" /> ACTION
                    </div>
                  </th>
                  <th style={auditStyles.th}>
                    <div style={auditStyles.thFlex}>
                      <Target size={14} color="#38bdf8" /> TARGET REF ID
                    </div>
                  </th>
                  <th style={auditStyles.th}>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const actionStyle = getActionStyle(log.action);

                  return (
                    <tr key={log.id} style={auditStyles.tr}>
                      {/* Timestamp */}
                      <td style={auditStyles.tdTimestamp}>
                        <span style={auditStyles.dateText}>
                          {new Date(log.created).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <div style={auditStyles.timeText}>
                          {new Date(log.created).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                      </td>

                      {/* Admin Actor */}
                      <td style={auditStyles.tdAdmin}>
                        {log.admin_name || log.actor || "System Administrator"}
                      </td>

                      {/* Action Badge */}
                      <td style={auditStyles.tdAction}>
                        <span style={auditStyles.actionBadge(actionStyle)}>
                          {log.action || "LOG_EVENT"}
                        </span>
                      </td>

                      {/* Target Ref ID */}
                      <td style={auditStyles.tdTarget}>
                        <span style={auditStyles.targetBadge}>
                          {log.target || "N/A"}
                        </span>
                      </td>

                      {/* Details */}
                      <td style={auditStyles.tdDetails}>
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


