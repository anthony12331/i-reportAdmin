import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { getReadableAddress } from "../utils/utils";
import { getUnitStyles } from "../themes/resolvedStyles"; 
import { pendingIncidentsStyles as detailStyles } from "../themes/pendingIncidentsStyles";
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
  ImageIcon,
  Activity,
  Loader,
  AlertTriangle,
  Flame,
  Radio,
  Car,
  Mountain,
} from "lucide-react";

const getInitials = (user) => {
  if (!user) return "CT";
  const first = user.first_name ? user.first_name.trim().charAt(0).toUpperCase() : "";
  const last = user.last_name ? user.last_name.trim().charAt(0).toUpperCase() : "";
  return (first + last) || "CT";
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

const getTypeBadge = (type, isSos) => {
  if (isSos) {
    return {
      label: "SOS DISTRESS",
      icon: <Radio size={13} />,
      bg: "#fef2f2",
      color: "#b91c1c",
      border: "#fecaca",
    };
  }
  switch ((type || "").toLowerCase()) {
    case "fire":
      return {
        label: "FIRE EMERGENCY",
        icon: <Flame size={13} />,
        bg: "#fff7ed",
        color: "#c2410c",
        border: "#ffedd5",
      };
    case "accident":
      return {
        label: "ROAD ACCIDENT",
        icon: <Car size={13} />,
        bg: "#fefce8",
        color: "#a16207",
        border: "#fef9c3",
      };
    case "landslide":
      return {
        label: "LANDSLIDE",
        icon: <Mountain size={13} />,
        bg: "#fef3c7",
        color: "#92400e",
        border: "#fde68a",
      };
    default:
      return {
        label: (type || "INCIDENT").toUpperCase(),
        icon: <AlertTriangle size={13} />,
        bg: "#eff6ff",
        color: "#1d4ed8",
        border: "#dbeafe",
      };
  }
};

export default function ResolvedIncidents() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);

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
      const incidentFilterParts = ['status = "resolved"'];
      if (typeFilter && typeFilter !== "sos") incidentFilterParts.push(`type = "${typeFilter}"`);

      if (searchTerm.trim() !== "") {
        const s = searchTerm.trim();
        incidentFilterParts.push(`(users.user_id ~ "${s}" || users.first_name ~ "${s}" || users.last_name ~ "${s}" || users.baranggay ~ "${s}")`);
      }

      const [incidentRecords, sosRecords] = await Promise.all([
        typeFilter === "sos"
          ? Promise.resolve([])
          : pb.collection("incident_reports").getFullList({
          filter: incidentFilterParts.join(" && "),
          sort: "-updated",
          expand: "users",
          requestKey: null,
        }),
        typeFilter && typeFilter !== "sos"
          ? Promise.resolve([])
          : pb.collection("sos_tracking").getFullList({
              filter: 'status = "resolved"',
              sort: "-updated",
              expand: "user,assigned_responder",
              requestKey: null,
            }),
      ]);

      const combinedRecords = [
        ...incidentRecords.map((record) => ({ ...record, recordType: "incident" })),
        ...sosRecords.map((record) => ({ ...record, recordType: "sos" })),
      ]
        .filter((record) => {
          if (!searchTerm.trim()) return true;
          const search = searchTerm.trim().toLowerCase();
          const reporter = record.expand?.users || record.expand?.user;
          return [reporter?.user_id, reporter?.first_name, reporter?.last_name, reporter?.baranggay]
            .some((value) => String(value || "").toLowerCase().includes(search));
        })
        .sort((a, b) => new Date(b.updated || b.created) - new Date(a.updated || a.created));

      const totalItemsForPage = combinedRecords.length;
      const pageStart = (currentPage - 1) * perPage;
      const pageItems = combinedRecords.slice(pageStart, pageStart + perPage);

      const dispatchFilters = pageItems.map((record) =>
        `${record.recordType === "sos" ? "sos_id" : "incident_id"}="${record.id}"`
      );
      if (dispatchFilters.length > 0) {
        const dispatches = await pb.collection("dispatches").getFullList({
          filter: dispatchFilters.join(" || "),
          expand: "responder_id",
          requestKey: null
        });
        
        pageItems.forEach(incident => {
          incident.dispatches = dispatches.filter((dispatch) =>
            incident.recordType === "sos"
              ? dispatch.sos_id === incident.id
              : dispatch.incident_id === incident.id
          );
        });
      }

      setIncidents(pageItems);
      setTotalPages(Math.max(1, Math.ceil(totalItemsForPage / perPage)));
      setTotalItems(totalItemsForPage);
      resolveAddressesParallel(pageItems);
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
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* Header */}
        <header style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#15803d" }} />
            <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: "800", color: "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
              Resolved History
            </h1>
          </div>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
            Official incident resolution history and emergency dispatch records for Barangay Lagonglong.
          </p>
        </header>

        {/* Premium Table Card */}
        <div className="premium-table-card">
          {/* Top Toolbar */}
          <div className="table-toolbar" style={{ flexWrap: "wrap", gap: "14px" }}>
            <div className="search-box-premium" style={{ minWidth: "280px" }}>
              <Search size={18} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search Citizen ID, Name, or Barangay..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "#94a3b8" }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Type Filter Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              {[
                { val: "", label: "All Cases" },
                { val: "fire", label: "Fire" },
                { val: "accident", label: "Accident" },
                { val: "landslide", label: "Landslide" },
                { val: "sos", label: "SOS Distress" },
              ].map(({ val, label }) => {
                const isActive = typeFilter === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setTypeFilter(val);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "20px",
                      border: isActive ? "1px solid #15803d" : "1px solid #e2e8f0",
                      backgroundColor: isActive ? "#15803d" : "#ffffff",
                      color: isActive ? "#ffffff" : "#475569",
                      fontSize: "12.5px",
                      fontWeight: "700",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: isActive ? "0 2px 6px rgba(21, 128, 61, 0.25)" : "none",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Content */}
          {loading && incidents.length === 0 ? (
            <div style={{ padding: "60px", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", color: "#15803d" }}>
              <Loader className="animate-spin" size={26} />
              <span>Loading resolved incident records...</span>
            </div>
          ) : incidents.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b" }}>
              <CheckCircle size={44} color="#94a3b8" style={{ marginBottom: "12px" }} />
              <h3 style={{ margin: "0 0 6px 0", color: "#1e293b", fontSize: "16px" }}>No Resolved Cases Found</h3>
              <p style={{ margin: 0, fontSize: "13.5px" }}>No archived incident history matches your search or filter criteria.</p>
            </div>
          ) : (
            <>
              <div className="premium-table-wrapper" style={{ overflowX: "auto" }}>
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Citizen Reporter</th>
                      <th>Incident Type</th>
                      <th>Location / Barangay</th>
                      <th>Assigned Units</th>
                      <th>Resolved Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((incident) => {
                      const reporter = incident.expand?.users || incident.expand?.user;
                      const isSos = incident.recordType === "sos";
                      const fullName = `${reporter?.first_name || ""} ${reporter?.last_name || ""}`.trim() || (isSos ? "SOS Citizen" : "Verified Citizen");
                      const initials = getInitials(reporter);
                      const avatarStyle = getAvatarStyle(fullName);
                      const typeBadge = getTypeBadge(incident.type, isSos);

                      return (
                        <tr key={incident.id}>
                          {/* Citizen Reporter */}
                          <td>
                            <div className="premium-user-cell">
                              <div className="premium-avatar" style={{ background: avatarStyle.bg, color: avatarStyle.color }}>
                                {initials}
                              </div>
                              <div className="premium-user-info">
                                <span className="premium-user-name">{fullName}</span>
                                <span className="premium-user-sub">
                                  {reporter?.user_id ? `Citizen ID: #${reporter.user_id}` : (reporter?.email || (isSos ? "SOS Distress Alert" : "Citizen"))}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Incident Type */}
                          <td>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "4px 10px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: "700",
                                backgroundColor: typeBadge.bg,
                                color: typeBadge.color,
                                border: `1px solid ${typeBadge.border}`,
                              }}
                            >
                              {typeBadge.icon}
                              {typeBadge.label}
                            </span>
                          </td>

                          {/* Location */}
                          <td>
                            <div style={{ maxWidth: "260px" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", fontSize: "13px", color: "#1e293b", fontWeight: "600" }}>
                                <MapPin size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: "2px" }} />
                                <span>{addresses[incident.id] || "Resolving GPS telemetry..."}</span>
                              </div>
                              <div style={{ fontSize: "12px", color: "#64748b", marginLeft: "21px", marginTop: "2px" }}>
                                Brgy. {reporter?.baranggay || "Lagonglong"}
                              </div>
                            </div>
                          </td>

                          {/* Unit Assigned */}
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              {incident.dispatches && incident.dispatches.length > 0 ? (
                                incident.dispatches.map((d) => {
                                  const r = d.expand?.responder_id;
                                  const unitStyle = getUnitStyles(r?.department || d.department);
                                  return (
                                    <span
                                      key={d.id}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        fontSize: "11.5px",
                                        fontWeight: "700",
                                        color: unitStyle.color,
                                        backgroundColor: unitStyle.bg,
                                        padding: "3px 8px",
                                        borderRadius: "6px",
                                        width: "fit-content",
                                      }}
                                    >
                                      <ShieldCheck size={13} /> {r ? `${r.department.toUpperCase()} - ${r.first_name}` : (d.department || "").toUpperCase()}
                                    </span>
                                  );
                                })
                              ) : isSos && incident.expand?.assigned_responder ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    fontSize: "11.5px",
                                    fontWeight: "700",
                                    color: getUnitStyles(incident.expand.assigned_responder.department).color,
                                    backgroundColor: getUnitStyles(incident.expand.assigned_responder.department).bg,
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    width: "fit-content",
                                  }}
                                >
                                  <ShieldCheck size={13} /> {incident.expand.assigned_responder.department.toUpperCase()}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    fontSize: "11.5px",
                                    fontWeight: "700",
                                    color: "#15803d",
                                    backgroundColor: "#f0fdf4",
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    width: "fit-content",
                                  }}
                                >
                                  <ShieldCheck size={13} /> MDRRMO HQ
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Resolved Date */}
                          <td>
                            <div>
                              <span style={{ fontWeight: "700", color: "#1e293b", fontSize: "13px", display: "block" }}>
                                {formatDate(incident.updated || incident.created)}
                              </span>
                              <span style={{ fontSize: "12px", color: "#64748b" }}>Case #{incident.id}</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td>
                            <span className="premium-status-pill status-pill-active">
                              Resolved
                            </span>
                          </td>

                          {/* Action */}
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className="premium-action-btn"
                              onClick={() => navigate(isSos ? `/resolved-incidents/sos/${incident.id}` : `/resolved-incidents/${incident.id}`)}
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

              {/* Table Footer / Pagination */}
              <div className="premium-table-footer">
                <div className="premium-pagination-info">
                  Showing <strong>{(currentPage - 1) * perPage + 1}</strong>–
                  <strong>{Math.min(currentPage * perPage, totalItems)}</strong> of <strong>{totalItems}</strong> Resolved Cases
                </div>

                <div className="premium-pagination-controls">
                  <button
                    type="button"
                    className="premium-page-nav-btn"
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      window.scrollTo(0, 0);
                    }}
                    disabled={currentPage === 1 || loading}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => index + 1)
                    .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))
                    .map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        className={`premium-page-num-btn ${currentPage === pageNum ? "active" : ""}`}
                        onClick={() => {
                          setCurrentPage(pageNum);
                          window.scrollTo(0, 0);
                        }}
                      >
                        {pageNum}
                      </button>
                    ))}

                  <button
                    type="button"
                    className="premium-page-nav-btn"
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      window.scrollTo(0, 0);
                    }}
                    disabled={currentPage === totalPages || loading}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedIncident && (
        <div style={detailStyles.detailBackdrop} onClick={() => setSelectedIncident(null)}>
          <div style={detailStyles.detailWindow} onClick={(event) => event.stopPropagation()}>
            <header style={detailStyles.detailHeader}>
              <button type="button" className="animatedCloseButton" style={detailStyles.backButton} onClick={() => setSelectedIncident(null)}>
                <X size={16} /> Back to History
              </button>
              <div style={detailStyles.detailHeaderTitle}>
                <span>Resolved Incident</span>
                <strong>#{selectedIncident.id}</strong>
              </div>
              <span style={detailStyles.detailStatus}>Resolved</span>
            </header>

            <div style={{ ...detailStyles.detailBody, gridTemplateColumns: "1fr" }}>
              <div style={detailStyles.detailMainColumn}>
                <section style={detailStyles.detailPanel}>
                  <h3 style={detailStyles.detailSectionTitle}>Reporter Information</h3>
                  <div style={detailStyles.reporterDetail}>
                    <div style={detailStyles.reporterAvatar}>
                      {selectedIncident.expand?.users?.selfie ? (
                        <img
                          src={pb.files.getURL(
                            selectedIncident.expand.users,
                            selectedIncident.expand.users.selfie
                          )}
                          alt="Reporter"
                          style={detailStyles.reporterAvatarImage}
                        />
                      ) : (
                        <ShieldCheck size={20} />
                      )}
                    </div>
                    <div style={detailStyles.reporterSummary}>
                      <strong style={detailStyles.reporterName}>
                        {selectedIncident.expand?.users?.first_name || "Unknown"} {selectedIncident.expand?.users?.last_name || "Resident"}
                      </strong>
                      <span style={detailStyles.reporterSub}>Verified Resident</span>
                      <span style={detailStyles.reporterSub}>ID: {selectedIncident.expand?.users?.user_id || "Not available"}</span>
                    </div>
                  </div>
                  <div style={detailStyles.detailContactRow}>
                    <div style={detailStyles.contactItem}>
                      <span style={detailStyles.detailContactLabel}>Phone</span>
                      <strong style={detailStyles.contactValue}>{selectedIncident.expand?.users?.contact_number || "N/A"}</strong>
                    </div>
                    <div style={detailStyles.contactItem}>
                      <span style={detailStyles.detailContactLabel}>Email</span>
                      <strong style={detailStyles.contactValue}>{selectedIncident.expand?.users?.email || "N/A"}</strong>
                    </div>
                  </div>
                </section>

                <section style={detailStyles.detailPanel}>
                  <h3 style={detailStyles.detailSectionTitle}>Incident Data</h3>
                  <div style={detailStyles.metadataGrid}>
                    <span style={detailStyles.metadataLabel}>Type</span><strong style={detailStyles.metadataValue}>{selectedIncident.type || "Unknown"}</strong>
                    <span style={detailStyles.metadataLabel}>Reported</span><strong style={detailStyles.metadataValue}>{new Date(selectedIncident.created).toLocaleString()}</strong>
                    <span style={detailStyles.metadataLabel}>Resolved</span><strong style={detailStyles.metadataValue}>{new Date(selectedIncident.updated).toLocaleString()}</strong>
                    <span style={detailStyles.metadataLabel}>Location</span><strong style={detailStyles.metadataValue}>{addresses[selectedIncident.id] || "GPS Telemetry Locating..."}</strong>
                  </div>
                </section>

                <section style={detailStyles.detailPanel}>
                  <h3 style={detailStyles.detailSectionTitle}>Assigned Responders</h3>
                  {selectedIncident.dispatches?.length > 0 ? (
                    <div style={{ display: "grid", gap: "8px" }}>
                      {selectedIncident.dispatches.map((dispatch) => {
                        const responder = dispatch.expand?.responder_id;
                        const department = responder?.department || dispatch.department || "Response Unit";
                        return (
                          <div
                            key={dispatch.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "12px",
                              padding: "10px 12px",
                              border: "1px solid #dfeae3",
                              borderRadius: "8px",
                              backgroundColor: "#f6faf7",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <strong style={{ display: "block", color: "#177a4a", fontSize: "13px" }}>
                                {responder
                                  ? `${responder.first_name || ""} ${responder.last_name || ""}`.trim()
                                  : `${department} Unit`}
                              </strong>
                              <span style={{ color: "#5f7b69", fontSize: "11px" }}>
                                {department}
                              </span>
                            </div>
                            <span style={{ color: "#5f7b69", fontSize: "10px", fontWeight: "800", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                              {dispatch.status || "Resolved"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: "#5f7b69", fontSize: "13px" }}>
                      No responder assignment recorded.
                    </p>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map Modal */}
      {selectedMap && (
        <div style={detailStyles.modalBackdrop} onClick={() => setSelectedMap(null)}>
          <div style={detailStyles.modalWindow} onClick={(event) => event.stopPropagation()}>
            <div style={detailStyles.modalHead}>
              <h3 style={{ margin: 0, color: "#111827", fontSize: "16px" }}>
                {selectedMap.address || "Resolved Incident Location"}
              </h3>
              <button type="button" className="animatedCloseButton" onClick={() => setSelectedMap(null)} style={detailStyles.closeBtn}>
                <X size={18} />
              </button>
            </div>
            <iframe
              title="Full resolved incident map"
              width="100%"
              height="500px"
              frameBorder="0"
              src={`https://maps.google.com/maps?q=${selectedMap.lat},${selectedMap.lng}&z=17&output=embed&t=h`}
            />
          </div>
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div style={detailStyles.modalBackdrop} onClick={() => setSelectedImage(null)}>
          <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }} onClick={(event) => event.stopPropagation()}>
            {selectedImage.match(/\.(mp4|mov|avi|webm|ogg)(\?.*)?$/i) ? (
              <video src={selectedImage} controls autoPlay style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: "10px" }} />
            ) : (
              <img src={selectedImage} alt="Incident media preview" style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: "10px" }} />
            )}
            <button type="button" className="animatedCloseButton" onClick={() => setSelectedImage(null)} style={detailStyles.closeFloatBtn}>
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
