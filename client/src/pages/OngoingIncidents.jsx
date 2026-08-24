import React, { useState, useEffect, useCallback, useRef } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { getReadableAddress } from "../utils/utils";
import { ongoingStyles, getIncidentTheme } from "../themes/ongoingStyles"; 
import { pendingIncidentsStyles as detailStyles } from "../themes/pendingIncidentsStyles";
import {
  MapPin,
  User,
  ImageIcon,
  Activity,
  X,
  Phone,
  ShieldCheck,
  Maximize2,
  Map as MapIcon,
  CheckCircle,
  Filter,
  Loader,
} from "lucide-react";

export default function OngoingIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("ALL");
  const [departmentFilters, setDepartmentFilters] = useState({});
  const [selectedResponderIds, setSelectedResponderIds] = useState({});
  const [availableResponders, setAvailableResponders] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  const fetchedAddressIds = useRef(new Set());

  // 1. COMBINED & OPTIMIZED FETCH FUNCTION
  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const allDispatches = await pb.collection("dispatches").getFullList({
        expand: "responder_id",
        requestKey: null
      });
      setDispatches(allDispatches);

      const activeDispatches = allDispatches.filter(d => d.status?.toLowerCase() !== 'resolved');

      // If there are active dispatches on an incident, it should stay visible even if one responder marked it resolved.
      const activeIncidentIds = [...new Set(activeDispatches.map(d => d.incident_id).filter(id => !!id))];
      let filterString = 'status = "ongoing" || status = "accepted" || status = "en_route" || status = "at_scene" || status = "dispatched"';
      if (activeIncidentIds.length > 0) {
        const idFilters = activeIncidentIds.map(id => `id = "${id}"`).join(" || ");
        filterString = `(${filterString}) || (${idFilters})`;
      }

      const records = await pb.collection("incident_reports").getFullList({
        filter: filterString,
        sort: "-created",
        expand: "users",
        requestKey: null,
      });
      setIncidents(records);

      const responders = await pb.collection("responder_accounts").getFullList({
        filter: "is_available = true",
        sort: "department, first_name, last_name",
        requestKey: null,
      });
      setAvailableResponders(responders);

      const pendingAddresses = records.filter(
        (record) =>
          record.latitude != null &&
          record.longitude != null &&
          !fetchedAddressIds.current.has(record.id)
      );

      if (pendingAddresses.length > 0) {
        const resolved = await Promise.all(
          pendingAddresses.map(async (record) => {
            fetchedAddressIds.current.add(record.id);
            return [
              record.id,
              await getReadableAddress(record.latitude, record.longitude),
            ];
          })
        );
        setAddresses((prev) => ({ ...prev, ...Object.fromEntries(resolved) }));
      }
    } catch (error) {
      if (!error.isAbort) console.error("Fetch error:", error);
    }
    setLoading(false);
  }, []);

  // 2. OPTIMIZED REAL-TIME LISTENER
  useEffect(() => {
    let isMounted = true;
    let unsubscribe;

    const loadAndSubscribe = async () => {
      await fetchIncidents();

      const unsubIncidents = await pb.collection("incident_reports").subscribe("*", () => {
        if (isMounted) fetchIncidents();
      });
      const unsubDispatches = await pb.collection("dispatches").subscribe("*", () => {
        if (isMounted) fetchIncidents();
      });
      const unsubResponders = await pb.collection("responder_accounts").subscribe("*", () => {
        if (isMounted) fetchIncidents();
      });
      unsubscribe = () => { unsubIncidents(); unsubDispatches(); unsubResponders(); };
    };

    loadAndSubscribe();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [fetchIncidents]);

  const updateStatus = async (incident, newStatus, responderIds = selectedResponderIds[incident.id] || []) => {
    setProcessingId(incident.id);
    let reservedResponders = [];
    let dispatchesCreated = [];
    try {
      if (!responderIds || responderIds.length === 0) {
        alert(`Assign at least one responder unit before dispatching.`);
        setProcessingId(null);
        return;
      }

      const selectedResponders = responderIds.map(id => availableResponders.find(r => r.id === id)).filter(Boolean);

      for (const r of selectedResponders) {
        await pb.collection("responder_accounts").update(r.id, { is_available: false });
        reservedResponders.push(r);
        
        const dispatch = await pb.collection("dispatches").create({
          incident_id: incident.id,
          responder_id: r.id,
          department: r.department,
          status: 'pending' // Responder will accept this
        });
        dispatchesCreated.push(dispatch);
      }

      // No need to update incident status if it's already ongoing.
      if (incident.status === "pending" || incident.status === "new" || incident.status === "resolved") {
         await pb.collection("incident_reports").update(incident.id, { status: "ongoing" });
      }

      setSelectedResponderIds(prev => ({ ...prev, [incident.id]: [] }));
      await fetchIncidents();
    } catch (error) {
      console.error("Failed to update status:", error);
      for (const r of reservedResponders) {
        await pb.collection("responder_accounts").update(r.id, { is_available: true }).catch(() => {});
      }
      for (const d of dispatchesCreated) {
        await pb.collection("dispatches").delete(d.id).catch(() => {});
      }
      alert("Failed to update status.");
    }
    setProcessingId(null);
  };

  // Filtering Logic
  const filteredIncidents = incidents.filter((incident) => {
    if (selectedTypeFilter === "ALL") return true;
    return incident.type?.toUpperCase() === selectedTypeFilter;
  });

  // Calculate Category Counts
  const typeCounts = incidents.reduce((acc, inc) => {
    const key = (inc.type || "OTHER").toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={ongoingStyles.shell}>
      <Sidebar />

      <main style={ongoingStyles.main}>
        {/* Header */}
        <header style={ongoingStyles.header}>
          <div>
            <div style={ongoingStyles.headerTitleWrapper}>
              <div style={ongoingStyles.pulseDot} className="animate-pulse" />
              <h1 style={ongoingStyles.pageTitle}>ONGOING DISPATCHES</h1>
            </div>
            <p style={ongoingStyles.subtitle}>
              Real-time monitoring of deployed emergency units across Lagonglong
            </p>
          </div>
        </header>

        {/* Category Metrics & Filter Bar */}
        <div style={ongoingStyles.filterBar}>
          <span style={ongoingStyles.filterLabel}>
            <Filter size={14} /> FILTER TYPE:
          </span>

          <button
            onClick={() => setSelectedTypeFilter("ALL")}
            style={ongoingStyles.filterButton(selectedTypeFilter === "ALL")}
          >
            ALL ACTIVE ({incidents.length})
          </button>

          {Object.entries(typeCounts).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setSelectedTypeFilter(type)}
              style={ongoingStyles.filterButton(selectedTypeFilter === type)}
            >
              {type} ({count})
            </button>
          ))}
        </div>

        {/* Empty State */}
        {loading && incidents.length === 0 ? (
          <div style={{ minHeight: "260px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", color: "#1d7a4d", fontSize: "16px", fontWeight: "800" }}>
            <Loader className="animate-spin" size={42} />
            <span>Loading ongoing incidents...</span>
          </div>
        ) : filteredIncidents.length === 0 && !loading && (
          <div style={ongoingStyles.emptyState}>
            <CheckCircle
              size={56}
              color="#10b981"
              style={{ marginBottom: "16px", opacity: 0.8 }}
            />
            <h3 style={{ color: "#111111", margin: "0 0 8px 0" }}>
              No Ongoing Emergency Dispatches
            </h3>
            <p style={{ margin: 0, fontSize: "14px" }}>
              All dispatched response units have resolved their assignments.
            </p>
          </div>
        )}

        {/* Incident Grid */}
        <div style={ongoingStyles.grid}>
          {filteredIncidents.map((incident) => {
            const reporter = incident.expand?.users;
            const incidentDispatches = dispatches.filter(d => d.incident_id === incident.id);
            const activeIncidentDispatches = incidentDispatches.filter(d => d.status?.toLowerCase() !== 'resolved');
            const previouslyDispatchedIds = new Set(incidentDispatches.map(d => d.responder_id));

            const imgUrl = incident.incident_image
              ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_image}`
              : null;
            const videoUrl = incident.incident_video
              ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_video}`
              : null;

            const theme = getIncidentTheme(incident.type);
            const HeaderIcon = theme.icon;

            return (
              <div
                key={incident.id}
                style={ongoingStyles.card(theme.border)}
                onClick={() => setSelectedIncident(incident)}
              >
                {/* Header Banner */}
                <div style={ongoingStyles.cardHeader(theme.headerBg)}>
                  <span style={ongoingStyles.typeLabel(theme.accentText)}>
                    <HeaderIcon size={18} className="animate-pulse" />
                    {theme.label}: {incident.type?.toUpperCase()}
                  </span>

                  <span style={ongoingStyles.timeBadge}>
                    {new Date(incident.created).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div style={ongoingStyles.cardBody}>
                  {/* Reporter Info */}
                  <div style={ongoingStyles.reporterBox}>
                    <div style={ongoingStyles.reporterHeader}>
                      <div style={ongoingStyles.avatarIcon}>
                        <User size={22} />
                      </div>
                      <div>
                        <span style={ongoingStyles.reporterName}>
                          {reporter?.first_name} {reporter?.last_name || "Citizen"}
                        </span>
                        <div style={ongoingStyles.verifiedBadge}>
                          <ShieldCheck size={12} /> Verified Caller
                        </div>
                      </div>
                    </div>

                    <div style={ongoingStyles.phoneText}>
                      <Phone size={14} color="#818cf8" />
                      {reporter?.contact_number || "No Contact Number"}
                    </div>
                  </div>

                  {/* Deployed Responder Banner */}
                  <div style={{ ...ongoingStyles.responderBanner(theme.border), flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Activity color={theme.accentText} size={16} />
                      <span style={ongoingStyles.responderText}>
                        DEPLOYED UNITS:
                      </span>
                    </div>
                    {activeIncidentDispatches.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "#cbd5e1", paddingLeft: "24px" }}>No active units found.</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "24px", width: "100%", boxSizing: "border-box" }}>
                        {activeIncidentDispatches.map(d => {
                          const r = d.expand?.responder_id;
                          return (
                            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", background: "#ffffff", border: "1px solid #dfeae3", padding: "7px 8px", borderRadius: "6px" }}>
                              <span style={{ color: "#177a4a", fontWeight: "700" }}>
                                {r ? `${r.first_name} ${r.last_name} (${r.department})` : d.department} 
                                {d.is_primary_responder && <span style={{ color: "#f59e0b", marginLeft: "6px", fontSize: "10px" }}>(PRIMARY)</span>}
                              </span>
                              <span style={{ color: "#5f7b69", textTransform: "uppercase", fontWeight: "700" }}>{d.status}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Location & Map Preview */}
                  <div style={{ marginBottom: "20px" }}>
                    <p style={ongoingStyles.locationText}>
                      <MapPin
                        size={16}
                        color="#60a5fa"
                        style={{ flexShrink: 0, marginTop: "2px" }}
                      />
                      {addresses[incident.id] || "Locating coordinates..."}
                    </p>

                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMap({
                          lat: incident.latitude,
                          lng: incident.longitude,
                          address: addresses[incident.id],
                        });
                      }}
                      style={ongoingStyles.mapPreviewWrapper}
                    >
                      <iframe
                        title="Incident Location Preview"
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        scrolling="no"
                        loading="lazy" referrerpolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${incident.latitude},${incident.longitude}&z=16&output=embed&iwloc=near`}
                        style={{ border: 0, pointerEvents: "none" }}
                      ></iframe>
                      <div style={ongoingStyles.mapBadge}>
                        <Maximize2 size={12} /> ENLARGE MAP
                      </div>
                    </div>
                  </div>

                  {/* RESPONDER DISPATCH MULTI-SELECTOR */}
                  <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "8px", background: "#f6faf7", padding: "12px", borderRadius: "10px", border: "1px solid #dfeae3", marginBottom: "20px" }}>
                    <div style={{ fontSize: "11px", fontWeight: "800", color: "#5f7b69", letterSpacing: "1px" }}>
                      <span>DISPATCH ADDITIONAL UNITS</span>
                    </div>

                    {/* DEPARTMENT FILTER DROPDOWN */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <select 
                        value={departmentFilters[incident.id] || ""} 
                        onChange={(e) => setDepartmentFilters(prev => ({ ...prev, [incident.id]: e.target.value }))}
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", backgroundColor: "#ffffff", color: "#111827", border: "1px solid #dfeae3", fontSize: "12px", outline: "none", cursor: "pointer" }}
                      >
                        <option value="">All Departments</option>
                        <option value="police">Police</option>
                        <option value="ambulance">Ambulance</option>
                        <option value="MDRRMO">MDRRMO</option>
                        <option value="Fire">BFP (Fire)</option>
                      </select>
                    </div>

                    <div style={{ maxHeight: "120px", overflowY: "auto", border: "1px solid #dfeae3", borderRadius: "8px", padding: "4px", backgroundColor: "#ffffff" }} onClick={(e) => e.stopPropagation()}>
                      {availableResponders.length === 0 ? (
                        <div style={{ padding: "8px", fontSize: "12px", color: "#5f7b69" }}>No Standby Responders</div>
                      ) : (() => {
                        const filtered = availableResponders.filter(r => !previouslyDispatchedIds.has(r.id) && (!departmentFilters[incident.id] || r.department === departmentFilters[incident.id]));
                        if (filtered.length === 0) {
                          return <div style={{ padding: "8px", fontSize: "12px", color: "#5f7b69" }}>No Standby Responders for this department</div>;
                        }
                        return filtered.map((r) => {
                          const isSelected = (selectedResponderIds[incident.id] || []).includes(r.id);
                          return (
                            <label key={r.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", cursor: "pointer", backgroundColor: isSelected ? "#e7f5eb" : "transparent", borderRadius: "6px", marginBottom: "2px" }}>
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedResponderIds((prev) => {
                                    const current = prev[incident.id] || [];
                                    if (current.includes(r.id)) {
                                      return { ...prev, [incident.id]: current.filter(id => id !== r.id) };
                                    } else {
                                      return { ...prev, [incident.id]: [...current, r.id] };
                                    }
                                  });
                                }}
                                style={{ cursor: "pointer" }}
                              />
                              <span style={{ fontSize: "12px", color: isSelected ? "#177a4a" : "#374151", fontWeight: isSelected ? "700" : "600" }}>
                                {r.first_name} {r.last_name} ({r.department})
                              </span>
                            </label>
                          );
                        });
                      })()}
                    </div>
                    
                    <button
                      className={processingId === incident.id ? "ongoingDispatchButton ongoingDispatching" : "ongoingDispatchButton"}
                      onClick={(e) => { e.stopPropagation(); updateStatus(incident, "ongoing", selectedResponderIds[incident.id] || []); }}
                      disabled={processingId === incident.id || (selectedResponderIds[incident.id] || []).length === 0}
                      style={{
                        padding: "8px 12px",
                        backgroundColor: (selectedResponderIds[incident.id] || []).length === 0 ? "#dfe9e2" : "#1a874f",
                        color: (selectedResponderIds[incident.id] || []).length === 0 ? "#6d7d73" : "#ffffff",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        cursor: (selectedResponderIds[incident.id] || []).length === 0 ? "not-allowed" : "pointer",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.2s"
                      }}
                    >
                      {processingId === incident.id ? "DEPLOYING..." : "DISPATCH UNITS"}
                    </button>
                  </div>

                  {/* Media Grid */}
                  <div style={ongoingStyles.mediaGrid}>
                    {/* Image Tile */}
                    <div
                      style={ongoingStyles.mediaTile(Boolean(imgUrl))}
                      onClick={(e) => { e.stopPropagation(); if (imgUrl) setSelectedImage(imgUrl); }}
                    >
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          alt="Incident Evidence"
                        />
                      ) : (
                        <div style={ongoingStyles.noMediaBox}>
                          <ImageIcon size={24} />
                          <span style={{ fontSize: "10px", fontWeight: "700", marginTop: "4px" }}>
                            NO PHOTO
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Video Tile */}
                    <div
                      style={ongoingStyles.mediaTile(Boolean(videoUrl))}
                      onClick={(e) => { e.stopPropagation(); if (videoUrl) setSelectedImage(videoUrl); }}
                    >
                      {videoUrl ? (
                        <video
                          src={videoUrl}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          muted
                          onMouseOver={(e) => e.target.play().catch(() => {})}
                          onMouseOut={(e) => e.target.pause()}
                        />
                      ) : (
                        <div style={ongoingStyles.noMediaBox}>
                          <Activity size={24} />
                          <span style={{ fontSize: "10px", fontWeight: "700", marginTop: "4px" }}>
                            NO VIDEO
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {selectedIncident && (
        <div style={detailStyles.detailBackdrop} onClick={() => setSelectedIncident(null)}>
          <div style={detailStyles.detailWindow} onClick={(e) => e.stopPropagation()}>
            <header style={detailStyles.detailHeader}>
              <button type="button" className="animatedCloseButton" style={detailStyles.backButton} onClick={() => setSelectedIncident(null)}>
                <X size={16} /> Back to List
              </button>
              <div style={detailStyles.detailHeaderTitle}>
                <span>Incident Details</span>
                <strong>#{selectedIncident.id}</strong>
              </div>
              <span style={detailStyles.detailStatus}>Ongoing Dispatch</span>
            </header>

            <div style={{ ...detailStyles.detailBody, gridTemplateColumns: "1fr" }}>
              <div style={detailStyles.detailMainColumn}>
                <section style={detailStyles.detailPanel}>
                  <h3 style={detailStyles.detailSectionTitle}>Reporter Information</h3>
                  <div style={detailStyles.reporterDetail}>
                    <div style={detailStyles.reporterAvatar}>
                      {selectedIncident.expand?.users?.selfie ? (
                        <img
                          src={pb.files.getURL(selectedIncident.expand.users, selectedIncident.expand.users.selfie)}
                          alt="Reporter"
                          style={detailStyles.reporterAvatarImage}
                        />
                      ) : (
                        <User size={20} />
                      )}
                    </div>
                    <div style={detailStyles.reporterSummary}>
                      <strong style={detailStyles.reporterName}>
                        {selectedIncident.expand?.users?.first_name || "Unknown"} {selectedIncident.expand?.users?.last_name || "Resident"}
                      </strong>
                      <span style={detailStyles.reporterSub}>Registered Resident</span>
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
                      ["Barangay", selectedIncident.expand?.users?.baranggay || selectedIncident.expand?.users?.barangay],
                      ["Municipality", selectedIncident.expand?.users?.municipality],
                      ["Province", selectedIncident.expand?.users?.province],
                      ["Street Address", selectedIncident.expand?.users?.street_address],
                      ["Birthdate", selectedIncident.expand?.users?.birthdate],
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
                    <span style={detailStyles.metadataLabel}>Location</span><strong style={detailStyles.metadataValue}>{addresses[selectedIncident.id] || "GPS Telemetry Locating..."}</strong>
                  </div>
                </section>

                <section style={detailStyles.detailPanel}>
                  <h3 style={detailStyles.detailSectionTitle}>Proof of Incident</h3>
                  <div style={detailStyles.detailMediaGrid}>
                    {selectedIncident.incident_image ? (
                      <button type="button" style={detailStyles.detailMediaButton} onClick={() => setSelectedImage(`${pb.baseUrl}/api/files/${selectedIncident.collectionId}/${selectedIncident.id}/${selectedIncident.incident_image}`)}>
                        <span style={detailStyles.mediaZoomLabel}>Click to enlarge</span>
                        <img src={`${pb.baseUrl}/api/files/${selectedIncident.collectionId}/${selectedIncident.id}/${selectedIncident.incident_image}`} alt="Incident evidence" style={detailStyles.detailMedia} />
                      </button>
                    ) : <div style={detailStyles.detailMediaEmpty}><ImageIcon size={24} /> No photo available</div>}
                    {selectedIncident.incident_video ? (
                      <button type="button" style={detailStyles.detailMediaButton} onClick={() => setSelectedImage(`${pb.baseUrl}/api/files/${selectedIncident.collectionId}/${selectedIncident.id}/${selectedIncident.incident_video}`)}>
                        <span style={detailStyles.mediaZoomLabel}>Click to enlarge</span>
                        <video src={`${pb.baseUrl}/api/files/${selectedIncident.collectionId}/${selectedIncident.id}/${selectedIncident.incident_video}`} controls style={detailStyles.detailMedia} />
                      </button>
                    ) : <div style={detailStyles.detailMediaEmpty}><Activity size={24} /> No video available</div>}
                  </div>
                </section>

                {selectedIncident.latitude && (
                  <section style={detailStyles.detailPanel}>
                    <div style={detailStyles.detailSectionHeader}>
                      <h3 style={detailStyles.detailSectionTitle}>Geographic Location</h3>
                      <button type="button" style={detailStyles.detailMapButton} onClick={() => window.open(`https://www.google.com/maps?q=${selectedIncident.latitude},${selectedIncident.longitude}`, "_blank", "noopener,noreferrer")}>Open in Maps</button>
                    </div>
                    <div style={{ ...detailStyles.detailMapPreview, cursor: "pointer" }} onClick={() => setSelectedMap({ lat: selectedIncident.latitude, lng: selectedIncident.longitude, address: addresses[selectedIncident.id] })}>
                      <span style={detailStyles.mediaZoomLabel}>Click to enlarge</span>
                      <iframe title="Incident location" src={`https://maps.google.com/maps?q=${selectedIncident.latitude},${selectedIncident.longitude}&z=15&output=embed`} style={{ ...detailStyles.detailMapFrame, pointerEvents: "none" }} />
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FULLSCREEN MAP */}
      {selectedMap && (
        <div onClick={() => setSelectedMap(null)} style={ongoingStyles.overlayModal}>
          <div onClick={(e) => e.stopPropagation()} style={ongoingStyles.modalMapCard}>
            <div style={ongoingStyles.modalMapHeader}>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: "900",
                    color: "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <MapIcon size={20} color="#60a5fa" /> LIVE MAP DISPATCH LOCATION
                </h3>
                <p style={{ margin: "4px 0 0 0", color: "#cbd5e1", fontSize: "13px" }}>
                  {selectedMap.address}
                </p>
              </div>
              <button
                className="animatedCloseButton"
                onClick={() => setSelectedMap(null)}
                style={ongoingStyles.modalCloseBtn}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ width: "100%", height: "60vh", backgroundColor: "#0f172a" }}>
              <iframe
                title="Full Interactive Map"
                width="100%"
                height="100%"
                frameBorder="0"
                loading="lazy" referrerpolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${selectedMap.lat},${selectedMap.lng}&z=17&output=embed&t=h`}
                style={{ border: 0 }}
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MEDIA VIEWER */}
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={ongoingStyles.overlayModal}>
          <div
            style={{
              position: "relative",
              maxWidth: "90%",
              maxHeight: "90%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {selectedImage.split("?")[0].toLowerCase().match(/\.(mp4|webm|ogg)$/) ? (
              <video
                src={selectedImage}
                controls
                autoPlay
                style={{
                  maxWidth: "100%",
                  maxHeight: "85vh",
                  borderRadius: "16px",
                  border: "1px solid #334155",
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={selectedImage}
                style={{
                  maxWidth: "100%",
                  maxHeight: "85vh",
                  borderRadius: "16px",
                  objectFit: "contain",
                  border: "1px solid #334155",
                }}
                alt="Enlarged Evidence"
              />
            )}
            <button
              className="animatedCloseButton"
              onClick={() => setSelectedImage(null)}
              style={ongoingStyles.closeCircleBtn}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


