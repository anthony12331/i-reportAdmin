import React, { useState, useEffect, useCallback } from "react";
import { pb } from "./pocketbase";
import Sidebar from "./Sidebar";
import { getReadableAddress } from "./utils";
import { ui } from "./uiStyles";
import {
  CheckCircle,
  MapPin,
  Search,
  Calendar,
  ShieldCheck,
  User,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Phone,
  Map,
  Filter,
  ClipboardList,
  IdCard,
  X,
} from "lucide-react";

export default function ResolvedIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const perPage = 10;

  // 1. Define this FIRST so it exists when fetchIncidents tries to call it
  const resolveAddressesParallel = async (records) => {
    const pendingRequests = records
      .filter((r) => r.latitude && r.longitude && !addresses[r.id])
      .map(async (record) => {
        const addr = await getReadableAddress(
          record.latitude,
          record.longitude,
        );
        return { id: record.id, addr };
      });

    const results = await Promise.all(pendingRequests);
    if (results.length > 0) {
      const newAddrs = {};
      results.forEach((res) => {
        newAddrs[res.id] = res.addr;
      });
      setAddresses((prev) => ({ ...prev, ...newAddrs }));
    }
  };

  // 2. Now define fetchIncidents using useCallback
  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      let filterParts = ['status = "resolved"'];
      if (typeFilter) filterParts.push(`type = "${typeFilter}"`);

      // Search Logic: Citizen numeric ID, Name, or Barangay
      if (searchTerm.trim() !== "") {
        const s = searchTerm.trim();
        filterParts.push(
          `(` +
            `users.user_id ~ "${s}" || ` +
            `users.first_name ~ "${s}" || ` +
            `users.last_name ~ "${s}" || ` +
            `users.baranggay ~ "${s}"` +
            `)`,
        );
      }

      const filterString = filterParts.join(" && ");

      const result = await pb
        .collection("incident_reports")
        .getList(currentPage, perPage, {
          filter: filterString,
          sort: "-updated",
          expand: "users,responders",
        });

      setIncidents(result.items);
      setTotalPages(result.totalPages);
      setTotalItems(result.totalItems);

      resolveAddressesParallel(result.items);
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm, typeFilter]);

  // 3. Your useEffect stays exactly the same
  useEffect(() => {
    fetchIncidents();

    let unsubscribe;
    let timeout;
    const setupSubscription = async () => {
      unsubscribe = await pb
        .collection("incident_reports")
        .subscribe("*", () => {
          clearTimeout(timeout);
          timeout = setTimeout(() => fetchIncidents(true), 500);
        });
    };

    setupSubscription();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchIncidents]);

  // --- 🎨 DYNAMIC UNIT COLORS LOGIC ---
  const getUnitStyles = (dept) => {
    const normalized = dept?.toLowerCase() || "mdrrmo";
    switch (normalized) {
      case "police":
        return { color: "#2563eb", bg: "#eff6ff" }; // Blue
      case "ambulance":
        return { color: "#e11d48", bg: "#fff1f2" }; // Rose/Red
      case "fire":
        return { color: "#ea580c", bg: "#fff7ed" }; // Orange
      case "mdrrmo":
        return { color: "#059669", bg: "#ecfdf5" }; // Emerald/Green
      default:
        return { color: "#4b5563", bg: "#f3f4f6" }; // Gray
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div style={ui.shell}>
      <Sidebar />
      <main style={ui.main}>
        <header style={ui.headerStack}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <div>
              <h1 style={ui.pageTitle}>Resolved History</h1>
              <p
                style={{
                  ...ui.subtitle,
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <ClipboardList size={18} /> Official Audit Record for Lagonglong
              </p>
            </div>

            <div style={{ position: "relative", width: "400px" }}>
              <Search
                size={18}
                color="#94a3b8"
                style={{
                  position: "absolute",
                  left: "15px",
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
              <input
                type="text"
                placeholder="Search Citizen ID, Name, or Barangay..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  width: "100%",
                  padding: "12px 40px 12px 45px",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  outline: "none",
                  backgroundColor: "white",
                  fontWeight: "600",
                  fontSize: "14px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                }}
              />
              {searchTerm && (
                <X
                  size={16}
                  onClick={() => setSearchTerm("")}
                  style={{
                    position: "absolute",
                    right: "15px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    cursor: "pointer",
                    color: "#94a3b8",
                  }}
                />
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {["", "fire", "accident", "landslide"].map((val) => (
              <button
                key={val}
                onClick={() => {
                  setTypeFilter(val);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  fontSize: "12px",
                  fontWeight: "800",
                  cursor: "pointer",
                  backgroundColor: typeFilter === val ? "#0f172a" : "white",
                  color: typeFilter === val ? "white" : "#64748b",
                  transition: "0.2s",
                }}
              >
                {val === "" ? "ALL CASES" : val.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        <div style={{ ...ui.panel, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  backgroundColor: "#f8fafc",
                  textAlign: "left",
                  color: "#64748b",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <th style={{ padding: "20px" }}>Citizen ID</th>
                <th style={{ padding: "20px" }}>Full Name</th>
                <th style={{ padding: "20px" }}>Location / Barangay</th>
                <th style={{ padding: "20px" }}>Unit Assigned</th>
                <th style={{ padding: "20px" }}>Resolved Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && incidents.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    style={{
                      padding: "80px",
                      textAlign: "center",
                      color: "#4f46e5",
                      fontWeight: "800",
                    }}
                  >
                    ⚡ LOADING HISTORY...
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    style={{
                      padding: "60px",
                      textAlign: "center",
                      color: "#94a3b8",
                    }}
                  >
                    No records found.
                  </td>
                </tr>
              ) : (
                incidents.map((incident) => {
                  const reporter = incident.expand?.users;
                  const responder = incident.expand?.responders;
                  const unitStyle = getUnitStyles(responder?.department);

                  return (
                    <tr
                      key={incident.id}
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                    >
                      {/* Column 1: Citizen Numeric ID */}
                      <td style={{ padding: "20px" }}>
                        <div
                          style={{
                            fontWeight: "900",
                            color: "#0f172a",
                            fontSize: "15px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <IdCard size={16} color="#4f46e5" />{" "}
                          {reporter?.user_id || "N/A"}
                        </div>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#94a3b8",
                            marginTop: "4px",
                          }}
                        >
                          VERIFIED ACCOUNT
                        </div>
                      </td>

                      <td style={{ padding: "20px" }}>
                        <div
                          style={{
                            fontWeight: "700",
                            fontSize: "14px",
                            color: "#1e293b",
                          }}
                        >
                          {reporter?.first_name} {reporter?.last_name}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#94a3b8",
                            marginTop: "2px",
                          }}
                        >
                          Profile Verified
                        </div>
                      </td>

                      <td style={{ padding: "20px", maxWidth: "280px" }}>
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            fontSize: "12px",
                            color: "#475569",
                            lineHeight: "1.4",
                            fontWeight: "600",
                          }}
                        >
                          <MapPin
                            size={14}
                            color="#ef4444"
                            style={{ flexShrink: 0 }}
                          />
                          {addresses[incident.id] || "Resolving..."}
                        </div>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#94a3b8",
                            marginLeft: "20px",
                            marginTop: "2px",
                          }}
                        >
                          Brgy: {reporter?.baranggay}
                        </div>
                      </td>

                      {/* Column 4: DYNAMIC UNIT COLORS */}
                      <td style={{ padding: "20px" }}>
                        <div
                          style={{
                            fontSize: "10px",
                            fontWeight: "900",
                            color: "#334155",
                            textTransform: "uppercase",
                            marginBottom: "4px",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {incident.type}
                        </div>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "11px",
                            fontWeight: "800",
                            color: unitStyle.color,
                            backgroundColor: unitStyle.bg,
                            padding: "5px 10px",
                            borderRadius: "8px",
                            textTransform: "uppercase",
                          }}
                        >
                          <ShieldCheck size={14} />{" "}
                          {responder ? responder.department : "MDRRMO HQ"}
                        </div>
                      </td>

                      <td style={{ padding: "20px" }}>
                        <div
                          style={{
                            color: "#0f172a",
                            fontWeight: "800",
                            fontSize: "13px",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <CheckCircle size={14} color="#10b981" />{" "}
                          {formatDate(incident.updated)}
                        </div>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#94a3b8",
                            marginTop: "4px",
                          }}
                        >
                          Case: {incident.id}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "20px",
              backgroundColor: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <span
              style={{ fontSize: "13px", color: "#64748b", fontWeight: "700" }}
            >
              Showing {incidents.length} of {totalItems} total logs (Page{" "}
              {currentPage} of {totalPages})
            </span>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                disabled={currentPage === 1}
                onClick={() => {
                  setCurrentPage((p) => p - 1);
                  window.scrollTo(0, 0);
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "white",
                  cursor: "pointer",
                  fontWeight: "800",
                  fontSize: "12px",
                }}
              >
                <ChevronLeft size={18} /> PREV
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => {
                  setCurrentPage((p) => p + 1);
                  window.scrollTo(0, 0);
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "white",
                  cursor: "pointer",
                  fontWeight: "800",
                  fontSize: "12px",
                }}
              >
                NEXT <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
