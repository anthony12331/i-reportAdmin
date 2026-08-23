import React, { useState, useEffect, useCallback } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { getReadableAddress } from "../utils/utils";
import { resolvedStyles as ui, getUnitStyles } from "../themes/resolvedStyles"; 
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
                <th style={ui.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && incidents.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: "80px", textAlign: "center", color: "#18864b", fontWeight: "800" }}>
                    ⚡ LOADING HISTORY...
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: "60px", textAlign: "center", color: "#477257" }}>
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

                      <td style={ui.td}>
                        <button
                          type="button"
                          style={ui.detailsButton}
                          onClick={() => setSelectedIncident(incident)}
                        >
                          View Details
                        </button>
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

      {selectedIncident && (
        <div style={detailStyles.detailBackdrop} onClick={() => setSelectedIncident(null)}>
          <div style={detailStyles.detailWindow} onClick={(event) => event.stopPropagation()}>
            <header style={detailStyles.detailHeader}>
              <button type="button" style={detailStyles.backButton} onClick={() => setSelectedIncident(null)}>
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
                  <div style={{ ...detailStyles.metadataGrid, marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #edf3ee" }}>
                    {[
                      ["Age", selectedIncident.expand?.users?.age],
                      ["Barangay", selectedIncident.expand?.users?.barangay || selectedIncident.expand?.users?.baranggay],
                      ["Municipality", selectedIncident.expand?.users?.municipality],
                      ["Province", selectedIncident.expand?.users?.province],
                      ["Street Address", selectedIncident.expand?.users?.street_address || selectedIncident.expand?.users?.address],
                      ["Birthdate", selectedIncident.expand?.users?.birthdate || selectedIncident.expand?.users?.date_of_birth],
                      ["Position", selectedIncident.expand?.users?.position],
                    ].filter(([, value]) => value !== undefined && value !== null && value !== "").map(([label, value]) => (
                      <React.Fragment key={label}>
                        <span style={detailStyles.metadataLabel}>{label}</span>
                        <strong style={detailStyles.metadataValue}>{String(value)}</strong>
                      </React.Fragment>
                    ))}
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

                <section style={detailStyles.detailPanel}>
                  <h3 style={detailStyles.detailSectionTitle}>Proof of Incident</h3>
                  <div style={detailStyles.detailMediaGrid}>
                    {selectedIncident.incident_image ? (
                      <button
                        type="button"
                        style={detailStyles.detailMediaButton}
                        onClick={() => setSelectedImage(`${pb.baseUrl}/api/files/${selectedIncident.collectionId}/${selectedIncident.id}/${selectedIncident.incident_image}`)}
                      >
                        <span style={detailStyles.mediaZoomLabel}>Click to enlarge</span>
                        <img
                          src={`${pb.baseUrl}/api/files/${selectedIncident.collectionId}/${selectedIncident.id}/${selectedIncident.incident_image}`}
                          alt="Incident evidence"
                          style={detailStyles.detailMedia}
                        />
                      </button>
                    ) : <div style={detailStyles.detailMediaEmpty}><ImageIcon size={24} /> No photo available</div>}
                    {selectedIncident.incident_video ? (
                      <button
                        type="button"
                        style={detailStyles.detailMediaButton}
                        onClick={() => setSelectedImage(`${pb.baseUrl}/api/files/${selectedIncident.collectionId}/${selectedIncident.id}/${selectedIncident.incident_video}`)}
                      >
                        <span style={detailStyles.mediaZoomLabel}>Click to enlarge</span>
                        <video
                          src={`${pb.baseUrl}/api/files/${selectedIncident.collectionId}/${selectedIncident.id}/${selectedIncident.incident_video}`}
                          controls
                          style={detailStyles.detailMedia}
                        />
                      </button>
                    ) : <div style={detailStyles.detailMediaEmpty}><Activity size={24} /> No video available</div>}
                  </div>
                </section>

                {selectedIncident.latitude && (
                  <section style={detailStyles.detailPanel}>
                    <div style={detailStyles.detailSectionHeader}>
                      <h3 style={detailStyles.detailSectionTitle}>Geographic Location</h3>
                      <button
                        type="button"
                        style={detailStyles.detailMapButton}
                        onClick={() => window.open(`https://www.google.com/maps?q=${selectedIncident.latitude},${selectedIncident.longitude}`, "_blank", "noopener,noreferrer")}
                      >
                        Open in Maps
                      </button>
                    </div>
                    <div
                      style={{ ...detailStyles.detailMapPreview, cursor: "zoom-in" }}
                      onClick={() => setSelectedMap({ lat: selectedIncident.latitude, lng: selectedIncident.longitude, address: addresses[selectedIncident.id] })}
                    >
                        <span style={detailStyles.mediaZoomLabel}>Click to enlarge</span>
                        <iframe
                            title="Resolved incident location"
                            src={`https://maps.google.com/maps?q=${selectedIncident.latitude},${selectedIncident.longitude}&z=15&output=embed`}
                            style={{ ...detailStyles.detailMapFrame, pointerEvents: "none" }}
                          />
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedMap && (
        <div style={detailStyles.modalBackdrop} onClick={() => setSelectedMap(null)}>
          <div style={detailStyles.modalWindow} onClick={(event) => event.stopPropagation()}>
            <div style={detailStyles.modalHead}>
              <h3 style={{ margin: 0, color: "#111827", fontSize: "16px" }}>
                {selectedMap.address || "Resolved Incident Location"}
              </h3>
              <button type="button" onClick={() => setSelectedMap(null)} style={detailStyles.closeBtn}>
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

      {selectedImage && (
        <div style={detailStyles.modalBackdrop} onClick={() => setSelectedImage(null)}>
          <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }} onClick={(event) => event.stopPropagation()}>
            {selectedImage.match(/\.(mp4|mov|avi|webm|ogg)(\?.*)?$/i) ? (
              <video src={selectedImage} controls autoPlay style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: "10px" }} />
            ) : (
              <img src={selectedImage} alt="Incident media preview" style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: "10px" }} />
            )}
            <button type="button" onClick={() => setSelectedImage(null)} style={detailStyles.closeFloatBtn}>
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


