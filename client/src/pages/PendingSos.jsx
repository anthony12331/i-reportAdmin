import React, { useState, useEffect, useCallback, useRef } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import LiveVideoPlayer from "../components/LiveVideoPlayer";
import { getReadableAddress } from "../utils/utils";
import SosRoutingTracker from "../components/SosRoutingTracker";
import { sosStyles } from "../themes/sosStyles";
import {
  MapPin,
  User,
  X,
  RefreshCw,
  Phone,
  Radio,
  CheckCircle,
  Siren,
  ShieldCheck,
  Maximize2,
  AlertOctagon,
} from "lucide-react";
import { getResponderOptionLabel } from "../utils/responderOptions";

export default function PendingSos() {
  const [sosSignals, setSosSignals] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [addresses, setAddresses] = useState({});
  const [selectedMap, setSelectedMap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const [availableResponders, setAvailableResponders] = useState([]);
  const [respondersLoading, setRespondersLoading] = useState(false);
  const [selectedResponderIds, setSelectedResponderIds] = useState({});
  const [activeVideoId, setActiveVideoId] = useState(null);

  const fetchedAddressIds = useRef(new Set());

  // Address Resolver
  const resolveAddresses = useCallback(async (records) => {
    const pendingAddresses = records.filter(
      (record) =>
        record.latitude != null &&
        record.longitude != null &&
        !fetchedAddressIds.current.has(record.id)
    );

    if (pendingAddresses.length === 0) return;

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
  }, []);

  // Fetch SOS Signals
  const fetchSosSignals = useCallback(async () => {
    setLoading(true);
    try {
      const allDispatches = await pb.collection("dispatches").getFullList({
        filter: 'sos_id != ""',
        expand: "responder_id",
        requestKey: null
      });
      setDispatches(allDispatches);

      const activeDispatches = allDispatches.filter(d => d.status?.toLowerCase() !== 'resolved');
      const activeSosIds = [...new Set(activeDispatches.map(d => d.sos_id).filter(id => !!id))];
      let filterString = 'status = "active"';
      if (activeSosIds.length > 0) {
        const idFilters = activeSosIds.map(id => `id = "${id}"`).join(" || ");
        filterString = `(${filterString}) || (${idFilters})`;
      }

      const records = await pb.collection("sos_tracking").getFullList({
        filter: filterString,
        sort: "-created",
        expand: "user,incident_id",
        requestKey: null,
      });
      setSosSignals(records);
      await resolveAddresses(records);
    } catch (e) {
      if (!e.isAbort) console.error("Fetch SOS error:", e);
    }
    setLoading(false);
  }, [resolveAddresses]);

  // Handle Video Toggle
  const handleToggleVideo = (sosId) => {
    if (activeVideoId === sosId) {
      setActiveVideoId(null);
      window.__isMutedByLiveVideo = false;
    } else {
      setActiveVideoId(sosId);
      window.__isMutedByLiveVideo = true;
      window.dispatchEvent(new CustomEvent('force-pause-alarm'));
      const audio = document.getElementById("emergency-alert-sound");
      if (audio) { audio.pause(); audio.currentTime = 0; }
    }
  };

  // Fetch Responders
  const fetchAvailableResponders = useCallback(async () => {
    setRespondersLoading(true);
    try {
      const responders = await pb
        .collection("responder_accounts")
        .getFullList({
          sort: "department, first_name, last_name",
          fields:
            "id,first_name,last_name,department,unit_name,contact_number,is_available",
          requestKey: null,
        });

      setAvailableResponders(responders);
    } catch (error) {
      console.error("Responder fetch error:", error);
    }
    setRespondersLoading(false);
  }, []);

  // Assign Responder to SOS
  const assignResponderToSos = async (
    sosSignal,
    responderIds = selectedResponderIds[sosSignal.id] || []
  ) => {
    if (!responderIds || responderIds.length === 0) {
      alert("Select at least one responder before assigning this SOS.");
      return;
    }

    const selectedResponders = responderIds.map(id => availableResponders.find(r => r.id === id)).filter(Boolean);

    if (selectedResponders.length === 0) {
      alert("Select at least one valid responder before assigning this SOS.");
      return;
    }

    setAssigningId(sosSignal.id);
    let reservedResponders = [];
    let dispatchesCreated = [];

    try {
      for (const r of selectedResponders) {
        await pb.collection("responder_accounts").update(r.id, { is_available: false });
        reservedResponders.push(r);
        
        const dispatch = await pb.collection("dispatches").create({
          sos_id: sosSignal.id,
          responder_id: r.id,
          department: r.department,
          status: 'pending' // Responder will accept this
        });
        dispatchesCreated.push(dispatch);
      }

      await pb.collection("sos_tracking").update(sosSignal.id, {
        dispatch_status: "assigned",
      });

      const updatedSnapshot = {
        ...sosSignal,
        dispatch_status: "assigned"
      };

      setSosSignals((prev) =>
        prev.map((item) => (item.id === sosSignal.id ? updatedSnapshot : item))
      );
      setSelectedMap((current) =>
        current?.id === sosSignal.id ? updatedSnapshot : current
      );
      setSelectedResponderIds((prev) => {
        const next = { ...prev };
        delete next[sosSignal.id];
        return next;
      });
      window.dispatchEvent(new Event("sos-handled"));
      await fetchAvailableResponders();
    } catch (e) {
      console.error("Error assigning responder to SOS:", e);
      for (const r of reservedResponders) {
        await pb.collection("responder_accounts").update(r.id, { is_available: true }).catch(() => {});
      }
      for (const d of dispatchesCreated) {
        await pb.collection("dispatches").delete(d.id).catch(() => {});
      }
      alert("Failed to assign responder.");
    } finally {
      setAssigningId(null);
    }
  };

  // Realtime Subscriptions with Full Relation Resolution
  useEffect(() => {
    let isMounted = true;
    let unsubSos, unsubResponders, unsubDispatches;

    const loadAndSubscribe = async () => {
      await fetchSosSignals();
      await fetchAvailableResponders();

      // Subscribe to real-time events on sos_tracking
      unsubSos = await pb.collection("sos_tracking").subscribe("*", () => {
        if (isMounted) fetchSosSignals();
      });

      // Subscribe to real-time events on dispatches
      unsubDispatches = await pb.collection("dispatches").subscribe("*", () => {
        if (isMounted) fetchSosSignals();
      });

      // Subscribe to real-time events on responder_accounts
      unsubResponders = await pb.collection("responder_accounts").subscribe("*", () => {
        if (isMounted) fetchAvailableResponders();
      });
    };

    loadAndSubscribe();

    return () => {
      isMounted = false;
      unsubSos?.();
      unsubDispatches?.();
      unsubResponders?.();
    };
  }, [fetchSosSignals, fetchAvailableResponders]);

  return (
    <div style={sosStyles.shell}>
      <Sidebar />

      <main style={sosStyles.main}>
        {/* Header */}
        <header style={sosStyles.header}>
          <div>
            <div style={sosStyles.headerTitleGroup}>
              <div style={sosStyles.titleDot} className="animate-pulse" />
              <h1 style={sosStyles.pageTitle}>LIVE SOS DISTRESS FEED</h1>
            </div>
            <p style={sosStyles.subtitle}>
              Real-time emergency distress signals and responder dispatch routing
            </p>
          </div>

          <button
            onClick={fetchSosSignals}
            disabled={loading}
            style={sosStyles.refreshBtn}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            REFRESH SIGNALS
          </button>
        </header>

        {/* Empty State */}
        {sosSignals.length === 0 && !loading && (
          <div style={sosStyles.emptyState}>
            <CheckCircle
              size={56}
              color="#10b981"
              style={sosStyles.emptyStateIcon}
            />
            <h3 style={sosStyles.emptyStateTitle}>No Active Distress Signals</h3>
            <p style={sosStyles.emptyStateText}>
              All resident emergency signals have been handled and dispatched.
            </p>
          </div>
        )}

        {/* SOS Cards Grid */}
        <div style={sosStyles.grid}>
          {sosSignals.map((sos) => {
            const sosDispatches = dispatches.filter(d => d.sos_id === sos.id);
            const activeSosDispatches = sosDispatches.filter(d => d.status?.toLowerCase() !== 'resolved');
            const previouslyDispatchedIds = new Set(sosDispatches.map(d => d.responder_id));
            const responderOptions = availableResponders.filter(r => !previouslyDispatchedIds.has(r.id));
            const selectedIds = selectedResponderIds[sos.id] || [];

            return (
              <div key={sos.id} style={sosStyles.card}>
                {/* Header Banner */}
                <div style={sosStyles.cardBanner}>
                  <span style={sosStyles.bannerLabel}>
                    <Radio size={18} className="animate-pulse" />
                    CRITICAL SOS DISTRESS
                  </span>

                  <span style={sosStyles.timeBadge}>
                    {new Date(sos.created).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div style={sosStyles.cardBody}>
                  {/* Caller Profile Box */}
                  <div style={sosStyles.callerBox}>
                    <div style={sosStyles.callerHeader}>
                      <div style={sosStyles.avatarIcon}>
                        <User size={22} />
                      </div>
                      <div>
                        <span style={sosStyles.callerName}>
                          {sos.expand?.user?.first_name || "Resident"}{" "}
                          {sos.expand?.user?.last_name || ""}
                        </span>
                        <div style={sosStyles.verifiedBadge}>
                          <ShieldCheck size={12} /> Verified Resident Signal
                        </div>
                      </div>
                    </div>

                    <div style={sosStyles.phoneText}>
                      <Phone size={14} color="#f87171" />
                      {sos.expand?.user?.contact_number || "No contact info"}
                    </div>
                  </div>

                  {/* Location Banner */}
                  <p style={sosStyles.locationText}>
                    <MapPin
                      size={16}
                      color="#60a5fa"
                      style={sosStyles.locationIcon}
                    />
                    {addresses[sos.id] || "Locating coordinates..."}
                  </p>

                  {/* Live Camera Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVideo(sos.id);
                    }}
                    style={{
                      backgroundColor: activeVideoId === sos.id ? "#3f3f46" : "#ef4444",
                      color: "white",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "none",
                      fontWeight: "bold",
                      cursor: "pointer",
                      width: "100%",
                      marginBottom: "10px",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    {activeVideoId === sos.id ? "Close Live Camera" : "🔴 View Live Camera"}
                  </button>

                  {/* The Live Video Player */}
                  {activeVideoId === sos.id && (
                    <div style={{ width: "100%", height: "250px", marginBottom: "15px" }}>
                      <LiveVideoPlayer channelName={sos.id} responderId={activeSosDispatches[0]?.responder_id || null} />
                    </div>
                  )}

                  {/* Responder Assignment Section */}
                  <div style={sosStyles.assignmentBox}>
                    <div style={sosStyles.statusHeader}>
                      <span style={sosStyles.statusLabel}>CURRENT STATUS:</span>
                      <span style={sosStyles.statusBadge(sos.dispatch_status === "assigned" || activeSosDispatches.length > 0)}>
                        {sos.dispatch_status === "assigned" || activeSosDispatches.length > 0
                          ? "DISPATCHED"
                          : "UNASSIGNED"}
                      </span>
                    </div>

                    {activeSosDispatches.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px", background: "rgba(0,0,0,0.3)", borderRadius: "6px", marginBottom: "10px" }}>
                        <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "bold", textTransform: "uppercase" }}>🚀 DEPLOYED UNITS:</span>
                        {activeSosDispatches.map(d => {
                          const r = d.expand?.responder_id;
                          return (
                            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: "4px" }}>
                              <span style={{ color: "#38bdf8", fontWeight: "bold" }}>
                                {r ? `${r.first_name} ${r.last_name} (${r.department})` : d.department} 
                                {d.is_primary_responder && <span style={{ color: "#f59e0b", marginLeft: "6px", fontSize: "10px" }}>(PRIMARY)</span>}
                              </span>
                              <span style={{ color: "#94a3b8", textTransform: "uppercase", fontSize: "10px", fontWeight: "bold" }}>{d.status}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ maxHeight: "120px", overflowY: "auto", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", padding: "4px", marginBottom: "10px" }} onClick={(e) => e.stopPropagation()}>
                      {respondersLoading ? (
                        <div style={{ padding: "8px", fontSize: "12px", color: "#94a3b8" }}>Loading responders...</div>
                      ) : responderOptions.length === 0 ? (
                        <div style={{ padding: "8px", fontSize: "12px", color: "#94a3b8" }}>No Standby Responders</div>
                      ) : (
                        responderOptions.map((r) => {
                          const isSelected = selectedIds.includes(r.id);
                          return (
                            <label key={r.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", cursor: "pointer", backgroundColor: isSelected ? "rgba(56, 189, 248, 0.1)" : "transparent", borderRadius: "4px", marginBottom: "2px" }}>
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedResponderIds((prev) => {
                                    const current = prev[sos.id] || [];
                                    if (current.includes(r.id)) {
                                      return { ...prev, [sos.id]: current.filter(id => id !== r.id) };
                                    } else {
                                      return { ...prev, [sos.id]: [...current, r.id] };
                                    }
                                  });
                                }}
                                style={{ cursor: "pointer" }}
                              />
                              <span style={{ fontSize: "12px", color: isSelected ? "#38bdf8" : "#e2e8f0", fontWeight: isSelected ? "600" : "400" }}>
                                {getResponderOptionLabel(r)} ({r.department})
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        assignResponderToSos(sos, selectedIds);
                      }}
                      disabled={
                        assigningId === sos.id ||
                        responderOptions.length === 0 ||
                        selectedIds.length === 0
                      }
                      style={sosStyles.dispatchBtn(
                        selectedIds.length === 0 || assigningId === sos.id
                      )}
                    >
                      <Siren size={16} />
                      {assigningId === sos.id
                        ? "DISPATCHING..."
                        : sos.dispatch_status === "assigned"
                        ? "DISPATCH ADDITIONAL"
                        : "DISPATCH RESPONDER(S)"}
                    </button>
                  </div>

                  {/* Embedded Interactive Map Preview */}
                  <div
                    onClick={() => setSelectedMap(sos)}
                    style={sosStyles.mapPreviewWrapper}
                  >
                    <SosRoutingTracker
                      key={`card-map-${sos.id}`}
                      targetLat={sos.latitude}
                      targetLng={sos.longitude}
                    />
                    <div style={sosStyles.mapBadge}>
                      <Maximize2 size={12} /> FULL ROUTE MAP
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* FULL SCREEN ROUTING MODAL */}
      {selectedMap && (
        <div
          onClick={() => setSelectedMap(null)}
          style={sosStyles.overlayModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={sosStyles.modalCard}
          >
            <div style={sosStyles.modalHeader}>
              <div>
                <h3 style={sosStyles.modalTitle}>
                  <AlertOctagon size={20} /> EMERGENCY ROUTING NAVIGATION
                </h3>
                <p style={sosStyles.modalSubtitle}>
                  {addresses[selectedMap.id] || "Locating coordinates..."}
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  onClick={() => setSelectedMap(null)}
                  style={sosStyles.modalCloseBtn}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={sosStyles.modalMapCanvas}>
              <SosRoutingTracker
                key={`modal-map-${selectedMap.id}`}
                targetLat={selectedMap.latitude}
                targetLng={selectedMap.longitude}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


