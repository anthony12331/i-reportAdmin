import React, { useState, useEffect, useCallback, useRef } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { getReadableAddress } from "../utils/utils";
import { useMessageBox } from "../components/MessageBox";
import {
  getPriorityLabel,
  getResponderDepartmentForIncident,
  sortIncidentReportsByPriority,
} from "../utils/incidentPriority";
import { addAuditLog } from "../utils/auditLog";
import { formatWaitTime } from "../utils/timeUtils";
import { isIncidentReviewed, markIncidentReviewed } from "../utils/incidentReview";
import {
  getResponderOptionLabel,
  getRespondersForDepartment,
} from "../utils/responderOptions";
import { pendingIncidentsStyles as tStyle } from "../themes/pendingIncidentsStyles";
import {
  MapPin,
  User,
  ImageIcon,
  Activity,
  X,
  Phone,
  Map as MapIcon,
  PlayCircle,
  Clock,
  CheckCircle2,
  Send,
  Trash2,
  SlidersHorizontal,
  Flame,
  Ambulance,
  Car,
  AlertOctagon,
  Volume2,
  VolumeX,
  Loader,
} from "lucide-react";

function RadialActionButton({ children, disabled, onClick, style }) {
  const [hover, setHover] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");

  const updateOrigin = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    setOrigin(`${x}% ${y}%`);
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="pending-report-action"
      style={{ ...style, position: "relative", overflow: "hidden" }}
      onPointerEnter={(event) => {
        updateOrigin(event);
        setHover(true);
      }}
      onPointerLeave={(event) => {
        updateOrigin(event);
        setHover(false);
      }}
    >
      <span style={tStyle.actionButtonContent}>{children}</span>
      <span
        aria-hidden="true"
        style={{
          ...tStyle.actionButtonReveal,
          clipPath: `circle(${hover ? "150%" : "0%"} at ${origin})`,
          WebkitClipPath: `circle(${hover ? "150%" : "0%"} at ${origin})`,
        }}
      >
        {children}
      </span>
    </button>
  );
}

export default function PendingIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});

  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [availableResponders, setAvailableResponders] = useState([]);
  const [, setRespondersLoading] = useState(false);
  const [selectedResponderIds, setSelectedResponderIds] = useState({});
  const [departmentFilters, setDepartmentFilters] = useState({});
  const [soundMuted, setSoundMuted] = useState(false);

  const [filters, setFilters] = useState({
    type: "",
    barangay: "",
    priority: "",
    time: "",
  });
  const [, setClockTick] = useState(0);
  const { confirm } = useMessageBox();

  const fetchedAddressIds = useRef(new Set());

  // Audio Siren Trigger Helper
  const triggerEmergencyAlert = useCallback(() => {
    if (soundMuted) return;
    try {
      const audio = new Audio("/notification_sound.mp3");
      audio.play().catch(() => {}).catch((e) => console.warn("Autoplay interaction block or missing file:", e));
    } catch (e) {
      console.warn("Audio alert failed to initialize:", e);
    }
  }, [soundMuted]);

  const isOpenIncident = useCallback((record) => ["new", "pending"].includes(record?.status), []);

  const generateDuplicateMap = useCallback((records) => {
    const result = {};
    records.forEach((record) => {
      const count = record.reporters_count || 0;
      if (count >= 1) result[record.id] = { count, isVerified: true };
    });
    return result;
  }, []);

  const resolveAddresses = useCallback(async (records) => {
    const pendingAddresses = records.filter(
      (record) => record.latitude != null && record.longitude != null && !fetchedAddressIds.current.has(record.id)
    );
    if (pendingAddresses.length === 0) return;

    pendingAddresses.forEach((r) => fetchedAddressIds.current.add(r.id));

    const resolved = await Promise.all(
      pendingAddresses.map(async (record) => {
        try {
          const addr = await getReadableAddress(record.latitude, record.longitude);
          return [record.id, addr];
        } catch {
          return [record.id, "GPS Telemetry Acquired"];
        }
      })
    );

    setAddresses((prev) => ({ ...prev, ...Object.fromEntries(resolved) }));
  }, []);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const pendingRecords = await pb.collection("incident_reports").getFullList({
        filter: 'status = "pending" || status = "new"',
        sort: "-created",
        expand: "users",
        requestKey: null,
      });

      const prioritizedRecords = sortIncidentReportsByPriority(pendingRecords);
      setIncidents(prioritizedRecords);

      await resolveAddresses(prioritizedRecords);
    } catch (error) {
      if (!error.isAbort) console.error("Fetch error:", error);
    }
    setLoading(false);
  }, [resolveAddresses]);

  const fetchAvailableResponders = useCallback(async () => {
    setRespondersLoading(true);
    try {
      const responders = await pb.collection("responder_accounts").getFullList({
        filter: "is_available = true",
        sort: "department, first_name, last_name",
        requestKey: null,
      });
      setAvailableResponders(responders);
    } catch (error) {
      if (!error.isAbort) console.error("Responder fetch error:", error);
    }
    setRespondersLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe;

    const loadAndSubscribe = async () => {
      await fetchIncidents();

      unsubscribe = await pb.collection("incident_reports").subscribe(
        "*",
        (e) => {
          if (!isMounted) return;

          // Play sound on real-time creation of an incident
          if (e.action === "create" && isOpenIncident(e.record)) {
            triggerEmergencyAlert();
          }

          if (e.action === "delete" || (e.action === "update" && !isOpenIncident(e.record))) {
            setIncidents((prev) => prev.filter((i) => i.id !== e.record.id));
          } else if (isOpenIncident(e.record)) {
            setIncidents((prev) => {
              const exists = prev.find((i) => i.id === e.record.id);
              const updated = exists ? prev.map((i) => (i.id === e.record.id ? e.record : i)) : [e.record, ...prev];
              return sortIncidentReportsByPriority(updated);
            });
            resolveAddresses([e.record]);
          }
        },
        { expand: "users" }
      );
    };

    loadAndSubscribe();
    const timer = setInterval(() => setClockTick((t) => t + 1), 60000);

    return () => {
      isMounted = false;
      clearInterval(timer);
      if (typeof unsubscribe === 'function') unsubscribe().catch(() => {});
    };
  }, [fetchIncidents, isOpenIncident, resolveAddresses, triggerEmergencyAlert]);

  useEffect(() => {
    const load = async () => { await fetchAvailableResponders(); };
    load();
    let unsubscribe;
    const startResponderSubscription = async () => {
      unsubscribe = await pb.collection("responder_accounts").subscribe("*", () => {
        fetchAvailableResponders();
      });
    };
    startResponderSubscription();
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe().catch(() => {});
    };
  }, [fetchAvailableResponders]);

  const filteredIncidents = incidents.filter((incident) => {
    const reporter = incident.expand?.users;
    const barangay = reporter?.baranggay || "";
    
    const ageMinutes = Math.floor((new Date().getTime() - new Date(incident.created).getTime()) / 60000);

    if (filters.type && incident.type?.toLowerCase() !== filters.type) return false;
    if (filters.barangay && !barangay.toLowerCase().includes(filters.barangay.toLowerCase())) return false;
    if (filters.priority && getPriorityLabel(incident) !== filters.priority) return false;
    if (filters.time === "under15" && ageMinutes >= 15) return false;
    if (filters.time === "15to60" && (ageMinutes < 15 || ageMinutes > 60)) return false;
    if (filters.time === "over60" && ageMinutes <= 60) return false;

    return true;
  });

  const reviewIncident = useCallback((id) => {
    markIncidentReviewed(id);
    setIncidents((prev) => [...prev]);
  }, []);

  const openIncidentDetails = useCallback((incident) => {
    reviewIncident(incident.id);
    setSelectedIncident(incident);
  }, [reviewIncident]);

  const updateStatus = async (incident, newStatus, responderIds = selectedResponderIds[incident.id] || []) => {
    setProcessingId(incident.id);
    let reservedResponders = [];
    let dispatchesCreated = [];
    try {
      const updateData = { status: newStatus };

      if (newStatus === "ongoing") {
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
      }

      await pb.collection("incident_reports").update(incident.id, updateData);
      reviewIncident(incident.id);
      window.dispatchEvent(new Event("incident-handled"));
      addAuditLog({
        action: "Incident Dispatched",
        target: incident.id,
        details: `${incident.type} assigned to ${responderIds.length} responder(s)`,
        actor: pb.authStore.model?.username || "Admin",
      });
      setIncidents((prev) => prev.filter((i) => i.id !== incident.id));
      setSelectedIncident((current) => current?.id === incident.id ? null : current);
      await fetchAvailableResponders();
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

  const getCategoryIcon = (type = "") => {
    const t = type.toLowerCase();
    if (t.includes("fire")) return <Flame size={18} color="#ef4444" />;
    if (t.includes("medical")) return <Ambulance size={18} color="#f97316" />;
    if (t.includes("traffic")) return <Car size={18} color="#18864b" />;
    return <AlertOctagon size={18} color="#a855f7" />;
  };

  const duplicateMap = generateDuplicateMap(incidents);

  return (
    <div style={tStyle.shell}>
      <Sidebar />
      <main style={tStyle.main}>
        {/* HEADER */}
        <header style={tStyle.header}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1 style={tStyle.pageTitle}>Pending Emergency Feed</h1>
              <span style={tStyle.badgeTag}>ACTIVE FEED: {filteredIncidents.length}</span>
            </div>
            <p style={tStyle.subtitle}>Tactical incident queue & real-time dispatch control</p>
          </div>


        </header>

        {/* TACTICAL FILTER BAR */}
        <div style={tStyle.filterBar}>
          <div style={tStyle.filterLabel}>
            <SlidersHorizontal size={14} color="#18864b" />
            <span>FILTER QUEUE</span>
          </div>
          <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} style={tStyle.filterSelect}>
            <option value="">All Types</option>
            {[...new Set(incidents.map((i) => i.type?.toLowerCase()).filter(Boolean))].map((type) => (
              <option key={type} value={type}>{type.toUpperCase()}</option>
            ))}
          </select>
          <input
            value={filters.barangay}
            onChange={(e) => setFilters({ ...filters, barangay: e.target.value })}
            placeholder="Search Barangay..."
            style={tStyle.filterInput}
          />
          <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })} style={tStyle.filterSelect}>
            <option value="">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Elevated">Elevated</option>
            <option value="Normal">Normal</option>
          </select>
        </div>

        {/* INCIDENT CARDS GRID */}
        <div style={tStyle.cardGrid}>
          {loading && incidents.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", width: "100%", minHeight: "calc(100vh - 260px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", color: "#1d7a4d", fontSize: "16px", fontWeight: "800" }}>
              <Loader className="animate-spin" size={42} />
              <span>Loading pending incidents...</span>
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div style={tStyle.emptyReportsState}>
              <CheckCircle2 size={28} />
              <strong>No pending reports</strong>
              <span>New emergency reports will appear here.</span>
            </div>
          ) : filteredIncidents.map((incident) => {
            const reporter = incident.expand?.users;
            const imgUrl = incident.incident_image ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_image}` : null;
            const videoUrl = incident.incident_video ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_video}` : null;
            const duplicateInfo = duplicateMap[incident.id];
            const isNew = !isIncidentReviewed(incident.id);
            const isFire = incident.type?.toLowerCase().includes("fire");

            return (
              <div
                key={incident.id}
                onClick={() => openIncidentDetails(incident)}
                style={{
                  ...tStyle.card,
                  borderColor: isFire ? "#ef4444" : "#f97316",
                  boxShadow: isFire ? "0 0 15px rgba(239, 68, 68, 0.2)" : "0 0 15px rgba(249, 115, 22, 0.15)",
                }}
              >
                {/* CARD TOP BANNER */}
                <div style={tStyle.cardTopBar}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {getCategoryIcon(incident.type)}
                    <span style={tStyle.incidentTitle}>{incident.type?.toUpperCase()}</span>
                  </div>
                  <div style={tStyle.timeText}>
                    <Clock size={12} /> {formatWaitTime(incident.created)}
                  </div>
                </div>

                <div style={tStyle.cardContent}>
                  {/* META TAGS */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {isNew && <span style={tStyle.newBadge}>NEW</span>}
                    <span style={tStyle.priorityTag}>{getPriorityLabel(incident)} Priority</span>
                    {duplicateInfo && <span style={tStyle.verifiedTag}>{duplicateInfo.count}+ REPORTERS</span>}
                  </div>

                  {/* REPORTER MINI CARD */}
                  <div style={tStyle.reporterStrip}>
                    <User size={16} color="#18864b" />
                    <div>
                      <span style={tStyle.reporterName}>{reporter?.first_name} {reporter?.last_name || "Citizen"}</span>
                      <span style={tStyle.reporterSub}><Phone size={10} /> {reporter?.contact_number || "N/A"}</span>
                    </div>
                  </div>

                  {/* MEDIA PREVIEWS */}
                  <div style={tStyle.mediaRow}>
                    <div style={tStyle.mediaTile} onClick={(e) => { e.stopPropagation(); if (imgUrl) setSelectedImage(imgUrl); }}>
                      {imgUrl ? <img src={imgUrl} alt="Evidence" style={tStyle.tileImg} /> : <div style={tStyle.noMediaText}><ImageIcon size={16} /> NO PHOTO</div>}
                    </div>
                    <div style={tStyle.mediaTile} onClick={(e) => { e.stopPropagation(); if (videoUrl) setSelectedImage(videoUrl); }}>
                      {videoUrl ? (
                        <div style={{ position: "relative", width: "100%", height: "100%" }}>
                          <video 
                            src={videoUrl} 
                            style={tStyle.tileImg} 
                            muted 
                            loop 
                            onMouseEnter={(e) => {
                              const video = e.currentTarget;
                              video.play().catch(() => {}).catch(() => {});
                            }} 
                            onMouseLeave={(e) => {
                              const video = e.currentTarget;
                              video.pause();
                              video.currentTime = 0;
                            }} 
                          />
                          <PlayCircle size={24} color="white" style={tStyle.playOverlay} />
                        </div>
                      ) : (
                        <div style={tStyle.noMediaText}><Activity size={16} /> NO VIDEO</div>
                      )}
                    </div>
                  </div>

                  {/* LOCATION & MINI MAP */}
                  <div style={tStyle.locationBox}>
                    <p style={tStyle.addressText}>
                      <MapPin size={14} color="#18864b" /> {addresses[incident.id] || "GPS Telemetry Locating..."}
                    </p>
                    {incident.latitude && (
                      <div
                        style={tStyle.miniMapContainer}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMap({ lat: incident.latitude, lng: incident.longitude, address: addresses[incident.id] });
                        }}
                      >
                        <iframe
                          title="Map Preview"
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          loading="lazy" referrerpolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${incident.latitude},${incident.longitude}&z=15&output=embed`}
                          style={{ pointerEvents: "none" }}
                        />
                        <span style={tStyle.mapHoverTag}>ENLARGE MAP</span>
                      </div>
                    )}
                  </div>

                  {/* RESPONDER DISPATCH MULTI-SELECTOR */}
                  <div style={{ ...tStyle.dispatchBox, flexDirection: "column", alignItems: "stretch", gap: "8px" }}>
                    <div style={tStyle.dispatchLabel}>
                      <span>ASSIGN RESPONDER(S)</span>
                    </div>

                    {/* DEPARTMENT FILTER DROPDOWN */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <select 
                        value={departmentFilters[incident.id] || ""} 
                        onChange={(e) => setDepartmentFilters(prev => ({ ...prev, [incident.id]: e.target.value }))}
                        style={tStyle.dispatchSelect}
                      >
                        <option value="">All Departments</option>
                        <option value="police">Police</option>
                        <option value="ambulance">Ambulance</option>
                        <option value="MDRRMO">MDRRMO</option>
                        <option value="Fire">BFP (Fire)</option>
                      </select>
                    </div>

                    <div style={tStyle.responderList} onClick={(e) => e.stopPropagation()}>
                      {availableResponders.length === 0 ? (
                        <div style={tStyle.responderEmpty}>No Standby Responders</div>
                      ) : (() => {
                        const filtered = availableResponders.filter(r => !departmentFilters[incident.id] || r.department === departmentFilters[incident.id]);
                        if (filtered.length === 0) {
                          return <div style={tStyle.responderEmpty}>No Standby Responders for this department</div>;
                        }
                        return filtered.map((r) => {
                          const isSelected = (selectedResponderIds[incident.id] || []).includes(r.id);
                          return (
                            <label key={r.id} style={{ ...tStyle.responderOption, ...(isSelected ? tStyle.responderOptionSelected : {}) }}>
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
                              <span style={{ ...tStyle.responderName, ...(isSelected ? tStyle.responderNameSelected : {}) }}>
                                {getResponderOptionLabel(r)} ({r.department})
                              </span>
                            </label>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* DISPATCH / REJECT ACTION BUTTONS */}
                  <div style={tStyle.actionRow}>
                    <RadialActionButton
                      onClick={(e) => { e.stopPropagation(); updateStatus(incident, "ongoing", selectedResponderIds[incident.id] || []); }}
                      disabled={processingId === incident.id || (selectedResponderIds[incident.id] || []).length === 0}
                      style={tStyle.deployBtn}
                    >
                      <Send size={14} /> {processingId === incident.id ? "DEPLOYING..." : "DISPATCH UNITS"}
                    </RadialActionButton>
                    <button
                      className="pending-report-action"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (await confirm("Permanently reject this emergency report?", { title: "Reject Report" })) {
                          setProcessingId(incident.id);
                          try {
                            await pb.collection("incident_reports").delete(incident.id);
                            setIncidents((prev) => prev.filter((i) => i.id !== incident.id));
                          } catch { alert("Delete failed."); }
                          setProcessingId(null);
                        }
                      }}
                      style={tStyle.rejectBtn}
                    >
                      <Trash2 size={14} /> REJECT
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {selectedIncident && (
        <div style={tStyle.detailBackdrop} onClick={() => setSelectedIncident(null)}>
          <div style={tStyle.detailWindow} onClick={(e) => e.stopPropagation()}>
            <header style={tStyle.detailHeader}>
              <button
                type="button"
                style={tStyle.backButton}
                onClick={() => setSelectedIncident(null)}
              >
                <X size={16} /> Back to List
              </button>
              <div style={tStyle.detailHeaderTitle}>
                <span>Review Incident</span>
                <strong>#{selectedIncident.id}</strong>
              </div>
              <span style={tStyle.detailStatus}>Pending Review</span>
            </header>

            <div style={tStyle.detailBody}>
              <div style={tStyle.detailMainColumn}>
                <section style={tStyle.detailPanel}>
                  <h3 style={tStyle.detailSectionTitle}>Reporter Information</h3>
                  <div style={tStyle.reporterDetail}>
                    <div style={tStyle.reporterAvatar}>
                      {selectedIncident.expand?.users?.selfie ? (
                        <img
                          src={pb.files.getURL(selectedIncident.expand.users, selectedIncident.expand.users.selfie)}
                          alt="Reporter"
                          style={tStyle.reporterAvatarImage}
                        />
                      ) : (
                        <User size={20} />
                      )}
                    </div>
                    <div style={tStyle.reporterSummary}>
                      <strong style={tStyle.reporterName}>{selectedIncident.expand?.users?.first_name || "Unknown"} {selectedIncident.expand?.users?.last_name || "Resident"}</strong>
                      <span style={tStyle.reporterSub}>Registered Resident</span>
                      <span style={tStyle.reporterSub}>ID: {selectedIncident.expand?.users?.user_id || "Not available"}</span>
                    </div>
                  </div>
                  <div style={tStyle.detailContactRow}>
                    <div style={tStyle.contactItem}>
                      <span style={tStyle.detailContactLabel}>Phone</span>
                      <strong style={tStyle.contactValue}>{selectedIncident.expand?.users?.contact_number || "N/A"}</strong>
                    </div>
                    <div style={tStyle.contactItem}>
                      <span style={tStyle.detailContactLabel}>Email</span>
                      <strong style={tStyle.contactValue}>{selectedIncident.expand?.users?.email || "N/A"}</strong>
                    </div>
                  </div>
                  <div style={{ ...tStyle.metadataGrid, marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #edf3ee" }}>
                    {[
                      ["Age", selectedIncident.expand?.users?.age],
                      ["Barangay", selectedIncident.expand?.users?.baranggay || selectedIncident.expand?.users?.barangay],
                      ["Municipality", selectedIncident.expand?.users?.municipality],
                      ["Province", selectedIncident.expand?.users?.province],
                      ["Street Address", selectedIncident.expand?.users?.street_address],
                      ["Birthdate", selectedIncident.expand?.users?.birthdate],
                    ].filter(([, value]) => value !== undefined && value !== null && value !== "").map(([label, value]) => (
                      <React.Fragment key={label}>
                        <span style={tStyle.metadataLabel}>{label}</span>
                        <strong style={tStyle.metadataValue}>{String(value)}</strong>
                      </React.Fragment>
                    ))}
                  </div>
                </section>

                <section style={tStyle.detailPanel}>
                  <h3 style={tStyle.detailSectionTitle}>Incident Data</h3>
                  <div style={tStyle.metadataGrid}>
                    <span style={tStyle.metadataLabel}>Type</span><strong style={tStyle.metadataValue}>{selectedIncident.type || "Unknown"}</strong>
                    <span style={tStyle.metadataLabel}>Reported</span><strong style={tStyle.metadataValue}>{new Date(selectedIncident.created).toLocaleString()}</strong>
                    <span style={tStyle.metadataLabel}>Location</span><strong style={tStyle.metadataValue}>{addresses[selectedIncident.id] || "GPS Telemetry Locating..."}</strong>
                  </div>
                </section>

                <section style={tStyle.detailPanel}>
                  <h3 style={tStyle.detailSectionTitle}>Proof of Incident</h3>
                  <div style={tStyle.detailMediaGrid}>
                    {selectedIncident.incident_image ? (
                      <button
                        type="button"
                        onClick={() => setSelectedImage(`${pb.baseUrl}/api/files/${selectedIncident.collectionId}/${selectedIncident.id}/${selectedIncident.incident_image}`)}
                        style={tStyle.detailMediaButton}
                        aria-label="Open incident image"
                      >
                        <span style={tStyle.mediaZoomLabel}>Click to enlarge</span>
                        <img src={`${pb.baseUrl}/api/files/${selectedIncident.collectionId}/${selectedIncident.id}/${selectedIncident.incident_image}`} alt="Incident evidence" style={tStyle.detailMedia} />
                      </button>
                    ) : <div style={tStyle.detailMediaEmpty}><ImageIcon size={24} /> No photo available</div>}
                    {selectedIncident.incident_video ? (
                      <button
                        type="button"
                        onClick={() => setSelectedImage(`${pb.baseUrl}/api/files/${selectedIncident.collectionId}/${selectedIncident.id}/${selectedIncident.incident_video}`)}
                        style={tStyle.detailMediaButton}
                        aria-label="Open incident video"
                      >
                        <span style={tStyle.mediaZoomLabel}>Click to enlarge</span>
                        <video src={`${pb.baseUrl}/api/files/${selectedIncident.collectionId}/${selectedIncident.id}/${selectedIncident.incident_video}`} controls style={tStyle.detailMedia} />
                      </button>
                    ) : <div style={tStyle.detailMediaEmpty}><Activity size={24} /> No video available</div>}
                  </div>
                </section>

                {selectedIncident.latitude && (
                  <section style={tStyle.detailPanel}>
                    <div style={tStyle.detailSectionHeader}>
                      <h3 style={tStyle.detailSectionTitle}>Geographic Location</h3>
                      <button
                        type="button"
                        style={tStyle.detailMapButton}
                        onClick={() => {
                          const mapUrl = `https://www.google.com/maps?q=${selectedIncident.latitude},${selectedIncident.longitude}`;
                          window.open(mapUrl, "_blank", "noopener,noreferrer");
                        }}
                      >
                        Open in Maps
                      </button>
                    </div>
                    <div
                      style={{ ...tStyle.detailMapPreview, cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMap({ lat: selectedIncident.latitude, lng: selectedIncident.longitude, address: addresses[selectedIncident.id] });
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedMap({ lat: selectedIncident.latitude, lng: selectedIncident.longitude, address: addresses[selectedIncident.id] });
                        }
                      }}
                    >
                      <span style={tStyle.mediaZoomLabel}>Click to enlarge</span>
                      <iframe
                        title="Incident location"
                        src={`https://maps.google.com/maps?q=${selectedIncident.latitude},${selectedIncident.longitude}&z=15&output=embed`}
                        style={{ ...tStyle.detailMapFrame, pointerEvents: "none" }}
                      />
                    </div>
                  </section>
                )}
              </div>

              <aside style={tStyle.detailSideColumn}>
                <section style={tStyle.detailActionPanel}>
                  <h3 style={tStyle.detailActionTitle}>Process Incident</h3>
                  <p style={tStyle.detailActionSubtitle}>Assign a responder to this report</p>
                  <h4 style={tStyle.detailFieldLabel}>Available Responders</h4>
                  <div style={tStyle.detailResponderList}>
                    {availableResponders.length === 0 ? (
                      <p style={tStyle.responderEmpty}>No standby responders</p>
                    ) : availableResponders.map((responder) => {
                      const isSelected = (selectedResponderIds[selectedIncident.id] || []).includes(responder.id);
                      return (
                        <label key={responder.id} style={{ ...tStyle.detailResponderOption, ...(isSelected ? tStyle.responderOptionSelected : {}) }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => setSelectedResponderIds((prev) => {
                              const current = prev[selectedIncident.id] || [];
                              return { ...prev, [selectedIncident.id]: isSelected ? current.filter((id) => id !== responder.id) : [...current, responder.id] };
                            })}
                          />
                          <span>{getResponderOptionLabel(responder)}<small>{responder.department}</small></span>
                        </label>
                      );
                    })}
                  </div>
                  <RadialActionButton
                    disabled={processingId === selectedIncident.id || (selectedResponderIds[selectedIncident.id] || []).length === 0}
                    onClick={() => updateStatus(selectedIncident, "ongoing", selectedResponderIds[selectedIncident.id] || [])}
                    style={
                      (selectedResponderIds[selectedIncident.id] || []).length === 0
                        ? { ...tStyle.deployBtn, ...tStyle.deployBtnDisabled }
                        : tStyle.deployBtn
                    }
                  >
                    <Send size={14} /> {processingId === selectedIncident.id ? "DISPATCHING..." : "DISPATCH UNITS"}
                  </RadialActionButton>
                  <button
                    type="button"
                    className="pending-report-action"
                    style={tStyle.rejectBtn}
                    onClick={async () => {
                      if (await confirm("Permanently reject this emergency report?", { title: "Reject Report" })) {
                        await pb.collection("incident_reports").delete(selectedIncident.id);
                        setIncidents((prev) => prev.filter((item) => item.id !== selectedIncident.id));
                        setSelectedIncident(null);
                      }
                    }}
                  >
                    <Trash2 size={14} /> REJECT
                  </button>
                </section>
              </aside>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MAP FULLSCREEN */}
      {selectedMap && (
        <div style={tStyle.modalBackdrop} onClick={() => setSelectedMap(null)}>
          <div style={tStyle.modalWindow} onClick={(e) => e.stopPropagation()}>
            <div style={tStyle.modalHead}>
              <h3><MapIcon size={18} color="#18864b" /> {selectedMap.address}</h3>
              <button className="pending-report-action animatedCloseButton" onClick={() => setSelectedMap(null)} style={tStyle.closeBtn}><X size={18} /></button>
            </div>
            <iframe
              title="Full Map"
              width="100%"
              height="500px"
              frameBorder="0"
              loading="lazy" referrerpolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${selectedMap.lat},${selectedMap.lng}&z=17&output=embed&t=h`}
            />
          </div>
        </div>
      )}

      {/* MODAL: MEDIA ENLARGE */}
      {selectedImage && (
        <div style={tStyle.modalBackdrop} onClick={() => setSelectedImage(null)}>
          <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}>
            {selectedImage.match(/\.(mp4|mov|avi)/i) ? (
              <video src={selectedImage} controls autoPlay style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: "8px" }} />
            ) : (
              <img src={selectedImage} alt="Media Preview" style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: "8px" }} />
            )}
            <button className="pending-report-action animatedCloseButton" onClick={() => setSelectedImage(null)} style={tStyle.closeFloatBtn}><X size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );
}


