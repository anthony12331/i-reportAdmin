import React, { useState, useEffect, useCallback, useRef } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
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
  const [addresses, setAddresses] = useState({});
  const [selectedMap, setSelectedMap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const [availableResponders, setAvailableResponders] = useState([]);
  const [respondersLoading, setRespondersLoading] = useState(false);
  const [selectedResponderIds, setSelectedResponderIds] = useState({});

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
      const records = await pb.collection("sos_tracking").getFullList({
        filter: 'status = "active"',
        sort: "-created",
        expand: "user,incident_id,assigned_responder",
        requestKey: null,
      });
      setSosSignals(records);
      await resolveAddresses(records);
    } catch (e) {
      console.error("Fetch SOS error:", e);
    }
    setLoading(false);
  }, [resolveAddresses]);

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
    responderId = selectedResponderIds[sosSignal.id]
  ) => {
    const chosenResponderId = String(responderId || "").trim();
    const selectedResponder = availableResponders.find(
      (responder) => responder.id === chosenResponderId
    );

    if (!selectedResponder) {
      alert("Select a responder before assigning this SOS.");
      return;
    }

    setAssigningId(sosSignal.id);

    try {
      await pb
        .collection("responder_accounts")
        .update(selectedResponder.id, { is_available: false });

      await pb.collection("sos_tracking").update(sosSignal.id, {
        assigned_department: selectedResponder.department || null,
        assigned_responder: selectedResponder.id,
        dispatch_status: "assigned",
      });

      const updatedSnapshot = {
        ...sosSignal,
        assigned_department: selectedResponder.department || null,
        assigned_responder: selectedResponder.id,
        dispatch_status: "assigned",
        expand: {
          ...(sosSignal.expand || {}),
          assigned_responder: selectedResponder,
        },
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
      alert("Failed to assign responder.");
    } finally {
      setAssigningId(null);
    }
  };

  // Realtime Subscriptions with Full Relation Resolution
  useEffect(() => {
    let isMounted = true;

    const loadAndSubscribe = async () => {
      await fetchSosSignals();
      await fetchAvailableResponders();

      // Subscribe to real-time events on sos_tracking
      pb.collection("sos_tracking").subscribe("*", async (e) => {
        if (!isMounted) return;
        const { action, record } = e;

        if (action === "delete" || (action === "update" && record.status !== "active")) {
          setSosSignals((prev) => prev.filter((item) => item.id !== record.id));
          setSelectedMap((current) => (current?.id === record.id ? null : current));
        } else if (action === "create" || action === "update") {
          if (record.status === "active") {
            try {
              // Fetch record with full relations (expand user & responder)
              const freshRecord = await pb.collection("sos_tracking").getOne(record.id, {
                expand: "user,incident_id,assigned_responder",
                requestKey: null,
              });

              if (!isMounted) return;

              setSosSignals((prev) => {
                const exists = prev.some((item) => item.id === freshRecord.id);
                if (exists) {
                  return prev.map((item) => (item.id === freshRecord.id ? freshRecord : item));
                }
                return [freshRecord, ...prev];
              });

              setSelectedMap((current) =>
                current?.id === freshRecord.id ? freshRecord : current
              );

              resolveAddresses([freshRecord]);
            } catch (err) {
              console.error("Error resolving realtime SOS record:", err);
            }
          }
        }
      });

      // Subscribe to real-time events on responder_accounts
      pb.collection("responder_accounts").subscribe("*", () => {
        if (isMounted) fetchAvailableResponders();
      });
    };

    loadAndSubscribe();

    return () => {
      isMounted = false;
      pb.collection("sos_tracking").unsubscribe("*");
      pb.collection("responder_accounts").unsubscribe("*");
    };
  }, [fetchSosSignals, resolveAddresses, fetchAvailableResponders]);

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
            const assignedResponder = sos.expand?.assigned_responder;
            const responderOptions = availableResponders;
            const selectedResponderId = selectedResponderIds[sos.id] || "";

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

                  {/* Responder Assignment Section */}
                  <div style={sosStyles.assignmentBox}>
                    <div style={sosStyles.statusHeader}>
                      <span style={sosStyles.statusLabel}>CURRENT STATUS:</span>
                      <span style={sosStyles.statusBadge(!!assignedResponder)}>
                        {assignedResponder
                          ? `ASSIGNED: ${
                              `${assignedResponder.first_name || ""} ${
                                assignedResponder.last_name || ""
                              }`.trim() || assignedResponder.email
                            }`
                          : "UNASSIGNED"}
                      </span>
                    </div>

                    <select
                      value={selectedResponderId}
                      onChange={(e) =>
                        setSelectedResponderIds((prev) => ({
                          ...prev,
                          [sos.id]: e.target.value,
                        }))
                      }
                      style={sosStyles.selectInput}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">
                        {respondersLoading
                          ? "Loading responders..."
                          : responderOptions.length === 0
                          ? "No responders available"
                          : "Select Response Unit..."}
                      </option>
                      {responderOptions.map((responder) => (
                        <option key={responder.id} value={responder.id}>
                          {getResponderOptionLabel(responder)}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        assignResponderToSos(sos, selectedResponderId);
                      }}
                      disabled={
                        assigningId === sos.id ||
                        responderOptions.length === 0 ||
                        !selectedResponderId
                      }
                      style={sosStyles.dispatchBtn(
                        !selectedResponderId || assigningId === sos.id
                      )}
                    >
                      <Siren size={16} />
                      {assigningId === sos.id
                        ? "DISPATCHING..."
                        : assignedResponder
                        ? "REASSIGN RESPONDER"
                        : "DISPATCH RESPONDER"}
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


