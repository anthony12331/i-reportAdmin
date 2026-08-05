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
  Send,
  Trash2,
  SlidersHorizontal,
  Flame,
  Ambulance,
  Car,
  AlertOctagon,
  Volume2,
  VolumeX,
} from "lucide-react";

export default function PendingIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});

  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [availableResponders, setAvailableResponders] = useState([]);
  const [, setRespondersLoading] = useState(false);
  const [selectedResponderIds, setSelectedResponderIds] = useState({});
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
      audio.play().catch((e) => console.warn("Autoplay interaction block or missing file:", e));
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
      unsubscribe?.();
    };
  }, [fetchIncidents, isOpenIncident, resolveAddresses, triggerEmergencyAlert]);

  useEffect(() => {
    fetchAvailableResponders();
    let unsubscribe;
    const startResponderSubscription = async () => {
      unsubscribe = await pb.collection("responder_accounts").subscribe("*", () => {
        fetchAvailableResponders();
      });
    };
    startResponderSubscription();
    return () => unsubscribe?.();
  }, [fetchAvailableResponders]);

  const filteredIncidents = incidents.filter((incident) => {
    const reporter = incident.expand?.users;
    const barangay = reporter?.baranggay || "";
    const ageMinutes = Math.floor((Date.now() - new Date(incident.created).getTime()) / 60000);

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

  const updateStatus = async (incident, newStatus, responderId = selectedResponderIds[incident.id]) => {
    setProcessingId(incident.id);
    let reservedResponder = null;
    try {
      const updateData = { status: newStatus };

      if (newStatus === "ongoing") {
        const targetDept = getResponderDepartmentForIncident(incident);
        const responderOptions = getRespondersForDepartment(availableResponders, targetDept);
        const chosenResponderId = String(responderId || "").trim();
        const selectedResponder =
          responderOptions.find((r) => r.id === chosenResponderId) ||
          availableResponders.find((r) => r.id === chosenResponderId);

        if (!selectedResponder) {
          alert(`Assign an available responder unit for ${targetDept} before dispatching.`);
          setProcessingId(null);
          return;
        }

        await pb.collection("responder_accounts").update(selectedResponder.id, { is_available: false });
        reservedResponder = selectedResponder;
        updateData.responders = selectedResponder.id;
      }

      await pb.collection("incident_reports").update(incident.id, updateData);
      reviewIncident(incident.id);
      window.dispatchEvent(new Event("incident-handled"));
      addAuditLog({
        action: "Incident Dispatched",
        target: incident.id,
        details: `${incident.type} assigned to responder`,
        actor: pb.authStore.model?.username || "Admin",
      });
      setIncidents((prev) => prev.filter((i) => i.id !== incident.id));
      await fetchAvailableResponders();
    } catch (error) {
      console.error("Failed to update status:", error);
      if (reservedResponder) {
        await pb.collection("responder_accounts").update(reservedResponder.id, { is_available: true }).catch(() => {});
      }
      alert("Failed to update status.");
    }
    setProcessingId(null);
  };

  const getCategoryIcon = (type = "") => {
    const t = type.toLowerCase();
    if (t.includes("fire")) return <Flame size={18} color="#ef4444" />;
    if (t.includes("medical")) return <Ambulance size={18} color="#f97316" />;
    if (t.includes("traffic")) return <Car size={18} color="#38bdf8" />;
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

          {/* AUDIO SIREN TOGGLE */}
          <button
            onClick={() => setSoundMuted(!soundMuted)}
            style={soundMuted ? tStyle.soundBtnMuted : tStyle.soundBtnActive}
            title={soundMuted ? "Unmute Audio Sirens" : "Mute Audio Sirens"}
          >
            {soundMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span>{soundMuted ? "AUDIO MUTED" : "SIRENS ACTIVE"}</span>
          </button>
        </header>

        {/* TACTICAL FILTER BAR */}
        <div style={tStyle.filterBar}>
          <div style={tStyle.filterLabel}>
            <SlidersHorizontal size={14} color="#38bdf8" />
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
          {filteredIncidents.map((incident) => {
            const reporter = incident.expand?.users;
            const imgUrl = incident.incident_image ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_image}` : null;
            const videoUrl = incident.incident_video ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_video}` : null;
            const duplicateInfo = duplicateMap[incident.id];
            const isNew = !isIncidentReviewed(incident.id);
            const targetDept = getResponderDepartmentForIncident(incident);
            const responderOptions = getRespondersForDepartment(availableResponders, targetDept);
            const selectedResponderId = selectedResponderIds[incident.id] || responderOptions[0]?.id || "";
            const isFire = incident.type?.toLowerCase().includes("fire");

            return (
              <div
                key={incident.id}
                onClick={() => reviewIncident(incident.id)}
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
                    <User size={16} color="#38bdf8" />
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
                              video.play().catch(() => {});
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
                      <MapPin size={14} color="#38bdf8" /> {addresses[incident.id] || "GPS Telemetry Locating..."}
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
                          src={`https://maps.google.com/maps?q=${incident.latitude},${incident.longitude}&z=15&output=embed`}
                          style={{ pointerEvents: "none" }}
                        />
                        <span style={tStyle.mapHoverTag}>ENLARGE MAP</span>
                      </div>
                    )}
                  </div>

                  {/* RESPONDER DISPATCH SELECTOR */}
                  <div style={tStyle.dispatchBox}>
                    <div style={tStyle.dispatchLabel}>
                      <span>ASSIGN RESPONDER ({targetDept})</span>
                    </div>
                    <select
                      value={selectedResponderId}
                      onChange={(e) => setSelectedResponderIds((prev) => ({ ...prev, [incident.id]: e.target.value }))}
                      style={tStyle.dispatchSelect}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">{responderOptions.length === 0 ? "No Standby Responders" : "Select Dispatch Unit..."}</option>
                      {responderOptions.map((r) => (
                        <option key={r.id} value={r.id}>{getResponderOptionLabel(r)}</option>
                      ))}
                    </select>
                  </div>

                  {/* DISPATCH / REJECT ACTION BUTTONS */}
                  <div style={tStyle.actionRow}>
                    <button
                      onClick={(e) => { e.stopPropagation(); updateStatus(incident, "ongoing", selectedResponderId); }}
                      disabled={processingId === incident.id || responderOptions.length === 0}
                      style={tStyle.deployBtn}
                    >
                      <Send size={14} /> {processingId === incident.id ? "DEPLOYING..." : "DISPATCH UNIT"}
                    </button>
                    <button
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

      {/* MODAL: MAP FULLSCREEN */}
      {selectedMap && (
        <div style={tStyle.modalBackdrop} onClick={() => setSelectedMap(null)}>
          <div style={tStyle.modalWindow} onClick={(e) => e.stopPropagation()}>
            <div style={tStyle.modalHead}>
              <h3><MapIcon size={18} color="#38bdf8" /> {selectedMap.address}</h3>
              <button onClick={() => setSelectedMap(null)} style={tStyle.closeBtn}><X size={18} /></button>
            </div>
            <iframe
              title="Full Map"
              width="100%"
              height="500px"
              frameBorder="0"
              src={`https://maps.google.com/maps?q=${selectedMap.lat},${selectedMap.lng}&z=17&output=embed&t=h`}
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
            <button onClick={() => setSelectedImage(null)} style={tStyle.closeFloatBtn}><X size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );
}


