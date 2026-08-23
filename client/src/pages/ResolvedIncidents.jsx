import React, { useState, useEffect, useCallback } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { getReadableAddress } from "../utils/utils";
import { resolvedStyles as ui, getUnitStyles } from "../themes/resolvedStyles"; 
import {
  CheckCircle,
  MapPin,
  Search,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
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

 const fetchIncidents = useCallback(async () => {
    setLoading(true);

    const resolveAddressesParallel = async (records) => {
      const pendingRequests = records
        .filter((r) => r.latitude && r.longitude && !addresses[r.id])
        .map(async (record) => ({
          id: record.id,
          addr: await getReadableAddress(record.latitude, record.longitude),
        }));

      const results = await Promise.all(pendingRequests);
      if (results.length > 0) {
        const newAddrs = Object.fromEntries(results.map((r) => [r.id, r.addr]));
        setAddresses((prev) => ({ ...prev, ...newAddrs }));
      }
    };

    try {
      let filterParts = ['status = "resolved"'];
      if (typeFilter) filterParts.push(`type = "${typeFilter}"`);

      if (searchTerm.trim() !== "") {
        const s = searchTerm.trim();
        filterParts.push(`(users.user_id ~ "${s}" || users.first_name ~ "${s}" || users.last_name ~ "${s}" || users.baranggay ~ "${s}")`);
      }

      const result = await pb.collection("incident_reports").getList(currentPage, perPage, {
        filter: filterParts.join(" && "),
        sort: "-updated",
        expand: "users",
        requestKey: null,
      });

      const incidentIdsFilter = result.items.map(r => `incident_id="${r.id}"`).join(" || ");
      if (incidentIdsFilter) {
        const dispatches = await pb.collection("dispatches").getFullList({
          filter: incidentIdsFilter,
          expand: "responder_id",
          requestKey: null
        });
        
        result.items.forEach(incident => {
          incident.dispatches = dispatches.filter(d => d.incident_id === incident.id);
        });
      }

      setIncidents(result.items);
      setTotalPages(result.totalPages);
      setTotalItems(result.totalItems);
      resolveAddressesParallel(result.items);
    } catch (error) {
      if (!error.isAbort) console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, perPage, searchTerm, typeFilter, addresses]);

  useEffect(() => {
    const load = async () => { await fetchIncidents(); };
    load();
  }, [fetchIncidents]);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div style={ui.shell}>
      <Sidebar />
      <main style={ui.main}>
        <header style={{ marginBottom: "28px" }}>
          <div style={ui.headerRow}>
            <div>
              <h1 style={ui.pageTitle}>Resolved History</h1>
              <p style={{ ...ui.subtitle, color: "#18864b", display: "flex", alignItems: "center", gap: "6px" }}>
                <ClipboardList size={18} /> Official Audit Record for Lagonglong
              </p>
            </div>

            <div style={ui.searchWrapper}>
              <Search size={18} color="#477257" style={{ position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search Citizen ID, Name, or Barangay..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                style={ui.searchInput}
              />
              {searchTerm && (
                <X size={16} onClick={() => setSearchTerm("")} style={{ position: "absolute", right: "15px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#cbd5e1" }} />
              )}
            </div>
          </div>

          <div style={ui.filterGroup}>
            {["", "fire", "accident", "landslide"].map((val) => (
              <button
                key={val}
                onClick={() => {
                  setTypeFilter(val);
                  setCurrentPage(1);
                }}
                style={ui.pillButton(typeFilter === val)}
              >
                {val === "" ? "ALL CASES" : val.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        <div style={ui.panel}>
          <table style={ui.table}>
            <thead>
              <tr style={{ backgroundColor: "#e7f5eb", borderBottom: "1px solid #d7e5da" }}>
                <th style={ui.th}>Citizen ID</th>
                <th style={ui.th}>Full Name</th>
                <th style={ui.th}>Location / Barangay</th>
                <th style={ui.th}>Unit Assigned</th>
                <th style={ui.th}>Resolved Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && incidents.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: "80px", textAlign: "center", color: "#18864b", fontWeight: "800" }}>
                    ⚡ LOADING HISTORY...
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: "60px", textAlign: "center", color: "#477257" }}>
                    No records found.
                  </td>
                </tr>
              ) : (
                incidents.map((incident) => {
                  const reporter = incident.expand?.users;

                  return (
                    <tr key={incident.id} style={{ borderBottom: "1px solid #edf3ee" }}>
                      <td style={ui.td}>
                        <div style={{ fontWeight: "900", color: "#111111", fontSize: "15px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <IdCard size={16} color="#818cf8" /> {reporter?.user_id || "N/A"}
                        </div>
                        <div style={ui.mutedText}>VERIFIED ACCOUNT</div>
                      </td>

                      <td style={ui.td}>
                        <div style={{ fontWeight: "700", fontSize: "14px", color: "#111111" }}>
                          {reporter?.first_name} {reporter?.last_name}
                        </div>
                        <div style={ui.mutedText}>Profile Verified</div>
                      </td>

                      <td style={{ ...ui.td, maxWidth: "280px" }}>
                        <div style={{ display: "flex", gap: "6px", fontSize: "12px", color: "#477257", fontWeight: "600" }}>
                          <MapPin size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                          {addresses[incident.id] || "Resolving..."}
                        </div>
                        <div style={{ ...ui.mutedText, marginLeft: "20px" }}>Brgy: {reporter?.baranggay}</div>
                      </td>

                      <td style={ui.td}>
                        <div style={{ fontSize: "10px", fontWeight: "900", color: "#477257", textTransform: "uppercase", marginBottom: "4px" }}>
                          {incident.type}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {incident.dispatches && incident.dispatches.length > 0 ? (
                            incident.dispatches.map(d => {
                              const r = d.expand?.responder_id;
                              const unitStyle = getUnitStyles(r?.department || d.department);
                              return (
                                <div key={d.id} style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "800", color: unitStyle.color, backgroundColor: unitStyle.bg, padding: "5px 10px", borderRadius: "8px", width: "fit-content" }}>
                                  <ShieldCheck size={14} /> {r ? `${r.department.toUpperCase()} - ${r.first_name}` : (d.department || '').toUpperCase()} ({d.status})
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "800", color: getUnitStyles("mdrrmo").color, backgroundColor: getUnitStyles("mdrrmo").bg, padding: "5px 10px", borderRadius: "8px", width: "fit-content" }}>
                              <ShieldCheck size={14} /> MDRRMO HQ
                            </div>
                          )}
                        </div>
                      </td>

                      <td style={ui.td}>
                        <div style={{ color: "#111111", fontWeight: "800", fontSize: "13px", display: "flex", alignItems: "center", gap: "5px" }}>
                          <CheckCircle size={14} color="#10b981" /> {formatDate(incident.updated)}
                        </div>
                        <div style={ui.mutedText}>Case: {incident.id}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", backgroundColor: "#e7f5eb", borderTop: "1px solid #d7e5da" }}>
            <span style={{ fontSize: "13px", color: "#477257", fontWeight: "700" }}>
              Showing {incidents.length} of {totalItems} total logs (Page {currentPage} of {totalPages})
            </span>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                disabled={currentPage === 1}
                onClick={() => {
                  setCurrentPage((p) => p - 1);
                  window.scrollTo(0, 0);
                }}
                style={{ padding: "9px 16px", borderRadius: "7px", border: "1px solid #b8d7c1", backgroundColor: "#ffffff", color: "#18864b", cursor: "pointer", fontWeight: "800", fontSize: "12px", opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                <ChevronLeft size={18} /> PREV
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => {
                  setCurrentPage((p) => p + 1);
                  window.scrollTo(0, 0);
                }}
                style={{ padding: "9px 16px", borderRadius: "7px", border: "1px solid #b8d7c1", backgroundColor: "#ffffff", color: "#18864b", cursor: "pointer", fontWeight: "800", fontSize: "12px", opacity: currentPage === totalPages ? 0.5 : 1 }}
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


