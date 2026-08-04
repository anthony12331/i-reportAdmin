import React, { useState, useEffect, useCallback, useRef } from "react";
import { pb } from "./pocketbase";
import Sidebar from "./Sidebar";
import { getReadableAddress } from "./utils";
import SosRoutingTracker from "./SosRoutingTracker";
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
import { getResponderOptionLabel } from "./responderOptions";

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

  // Realtime Subscriptions
  useEffect(() => {
    let isMounted = true;
    let unsubPromise;
    let responderUnsub;

    const loadAndSubscribe = async () => {
      await fetchSosSignals();
      await fetchAvailableResponders();

      const handleRealtimeUpdate = async (e) => {
        if (!isMounted) return;
        const { action, record } = e;

        if (
          action === "delete" ||
          (action === "update" && record.status !== "active")
        ) {
          setSosSignals((prev) =>
            prev.filter((item) => item.id !== record.id)
          );
          setSelectedMap((current) =>
            current?.id === record.id ? null : current
          );
        } else if (action === "update" && record.status === "active") {
          setSosSignals((prev) =>
            prev.map((item) => {
              if (item.id === record.id) {
                return {
                  ...item,
                  ...record,
                  expand: { ...(item.expand || {}), ...(record.expand || {}) },
                };
              }
              return item;
            })
          );

          setSelectedMap((current) => {
            if (current?.id === record.id) {
              return {
                ...current,
                ...record,
                expand: {
                  ...(current.expand || {}),
                  ...(record.expand || {}),
                },
              };
            }
            return current;
          });

          if (
            record.latitude != null &&
            record.longitude != null &&
            !fetchedAddressIds.current.has(record.id)
          ) {
            resolveAddresses([record]);
          }
        } else if (action === "create" && record.status === "active") {
          try {
            const freshRecord = await pb
              .collection("sos_tracking")
              .getOne(record.id, {
                expand: "user,incident_id,assigned_responder",
              });
            if (isMounted) {
              setSosSignals((prev) => [freshRecord, ...prev]);
              resolveAddresses([freshRecord]);
            }
          } catch (err) {
            console.error("Error fetching newly created record:", err);
          }
        }
      };

      unsubPromise = pb
        .collection("sos_tracking")
        .subscribe("*", handleRealtimeUpdate);
      responderUnsub = await pb
        .collection("responder_accounts")
        .subscribe("*", () => {
          if (isMounted) fetchAvailableResponders();
        });
    };

    loadAndSubscribe();

    return () => {
      isMounted = false;
      if (unsubPromise) unsubPromise.then((u) => u?.());
      responderUnsub?.();
    };
  }, [fetchSosSignals, resolveAddresses, fetchAvailableResponders]);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#0b0f19",
        color: "#f8fafc",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <Sidebar />

      <main style={{ flex: 1, padding: "32px", marginLeft: "260px" }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "28px",
            paddingBottom: "20px",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "#ef4444",
                  boxShadow: "0 0 12px #ef4444",
                }}
                className="animate-pulse"
              />
              <h1
                style={{
                  fontSize: "28px",
                  fontWeight: "900",
                  letterSpacing: "-0.5px",
                  color: "#ffffff",
                  margin: 0,
                }}
              >
                LIVE SOS DISTRESS FEED
              </h1>
            </div>
            <p
              style={{
                color: "#94a3b8",
                fontSize: "14px",
                margin: "6px 0 0 24px",
                fontWeight: "500",
              }}
            >
              Real-time emergency distress signals and responder dispatch routing
            </p>
          </div>

          <button
            onClick={fetchSosSignals}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              backgroundColor: "#1e293b",
              color: "#f8fafc",
              padding: "10px 18px",
              borderRadius: "10px",
              border: "1px solid #334155",
              cursor: "pointer",
              fontWeight: "700",
              fontSize: "13px",
              transition: "all 0.2s",
            }}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            REFRESH SIGNALS
          </button>
        </header>

        {/* Empty State */}
        {sosSignals.length === 0 && !loading && (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
              backgroundColor: "#1e293b",
              borderRadius: "20px",
              border: "1px dashed #334155",
              color: "#94a3b8",
            }}
          >
            <CheckCircle
              size={56}
              color="#10b981"
              style={{ marginBottom: "16px", opacity: 0.8 }}
            />
            <h3 style={{ color: "#f8fafc", margin: "0 0 8px 0" }}>
              No Active Distress Signals
            </h3>
            <p style={{ margin: 0, fontSize: "14px" }}>
              All resident emergency signals have been handled and dispatched.
            </p>
          </div>
        )}

        {/* SOS Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
            gap: "24px",
          }}
        >
          {sosSignals.map((sos) => {
            const assignedResponder = sos.expand?.assigned_responder;
            const responderOptions = availableResponders;
            const selectedResponderId = selectedResponderIds[sos.id] || "";

            return (
              <div
                key={sos.id}
                style={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #ef4444",
                  borderRadius: "20px",
                  overflow: "hidden",
                  boxShadow: "0 10px 25px -5px rgba(239, 68, 68, 0.2)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Header Banner */}
                <div
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    padding: "14px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <span
                    style={{
                      fontWeight: "900",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#f87171",
                      letterSpacing: "0.5px",
                    }}
                  >
                    <Radio size={18} className="animate-pulse" />
                    CRITICAL SOS DISTRESS
                  </span>

                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "800",
                      backgroundColor: "rgba(0,0,0,0.4)",
                      color: "#fecaca",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                    }}
                  >
                    {new Date(sos.created).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div
                  style={{
                    padding: "20px",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Caller Profile Box */}
                  <div
                    style={{
                      backgroundColor: "#0f172a",
                      padding: "14px",
                      borderRadius: "14px",
                      border: "1px solid #334155",
                      marginBottom: "16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "10px",
                      }}
                    >
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "12px",
                          backgroundColor: "rgba(239, 68, 68, 0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#f87171",
                        }}
                      >
                        <User size={22} />
                      </div>
                      <div>
                        <span
                          style={{
                            display: "block",
                            fontWeight: "800",
                            fontSize: "16px",
                            color: "#f8fafc",
                          }}
                        >
                          {sos.expand?.user?.first_name || "Resident"}{" "}
                          {sos.expand?.user?.last_name || ""}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            color: "#34d399",
                            fontSize: "11px",
                            fontWeight: "700",
                          }}
                        >
                          <ShieldCheck size={12} /> Verified Resident Signal
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        color: "#cbd5e1",
                        fontWeight: "600",
                      }}
                    >
                      <Phone size={14} color="#f87171" />
                      {sos.expand?.user?.contact_number || "No contact info"}
                    </div>
                  </div>

                  {/* Location Banner */}
                  <p
                    style={{
                      margin: "0 0 12px 0",
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "#60a5fa",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      lineHeight: "1.4",
                    }}
                  >
                    <MapPin
                      size={16}
                      color="#60a5fa"
                      style={{ flexShrink: 0, marginTop: "2px" }}
                    />
                    {addresses[sos.id] || "Locating coordinates..."}
                  </p>

                  {/* Responder Assignment Section */}
                  <div
                    style={{
                      backgroundColor: "#0f172a",
                      padding: "14px",
                      borderRadius: "14px",
                      border: "1px solid #334155",
                      marginBottom: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "12px",
                      }}
                    >
                      <span style={{ color: "#94a3b8", fontWeight: "700" }}>
                        CURRENT STATUS:
                      </span>
                      <span
                        style={{
                          fontWeight: "900",
                          color: assignedResponder ? "#34d399" : "#fbbf24",
                          backgroundColor: assignedResponder
                            ? "rgba(52, 211, 153, 0.1)"
                            : "rgba(251, 191, 36, 0.1)",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          border: `1px solid ${
                            assignedResponder ? "#34d399" : "#fbbf24"
                          }`,
                        }}
                      >
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
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid #334155",
                        backgroundColor: "#1e293b",
                        color: "#f8fafc",
                        fontWeight: "700",
                        fontSize: "13px",
                        outline: "none",
                      }}
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
                      style={{
                        width: "100%",
                        padding: "10px",
                        backgroundColor: "#ef4444",
                        color: "white",
                        border: "none",
                        borderRadius: "10px",
                        fontWeight: "800",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        opacity:
                          !selectedResponderId || assigningId === sos.id
                            ? 0.5
                            : 1,
                      }}
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
                    style={{
                      height: "160px",
                      borderRadius: "14px",
                      overflow: "hidden",
                      position: "relative",
                      cursor: "zoom-in",
                      border: "1px solid #334155",
                      marginBottom: "16px",
                    }}
                  >
                    <SosRoutingTracker
                      key={`card-map-${sos.id}`}
                      targetLat={sos.latitude}
                      targetLng={sos.longitude}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: "8px",
                        right: "8px",
                        backgroundColor: "#0f172a",
                        color: "#38bdf8",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "10px",
                        fontWeight: "800",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        border: "1px solid #334155",
                        zIndex: 10,
                      }}
                    >
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
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(11, 15, 25, 0.95)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "30px",
            backdropFilter: "blur(10px)",
            cursor: "zoom-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "90vw",
              maxWidth: "1000px",
              backgroundColor: "#1e293b",
              borderRadius: "24px",
              overflow: "hidden",
              border: "1px solid #334155",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
              cursor: "default",
            }}
          >
            <div
              style={{
                padding: "20px 28px",
                borderBottom: "1px solid #334155",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: "900",
                    color: "#f87171",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <AlertOctagon size={20} /> EMERGENCY ROUTING NAVIGATION
                </h3>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  {addresses[selectedMap.id] || "Locating coordinates..."}
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              

                <button
                  onClick={() => setSelectedMap(null)}
                  style={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    color: "#94a3b8",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div
              style={{
                width: "100%",
                height: "60vh",
                backgroundColor: "#0f172a",
              }}
            >
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