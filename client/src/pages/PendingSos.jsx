import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
// Agora SDK is lazy-loaded — only downloads when user opens the live camera feed
const LiveVideoPlayer = lazy(() => import("../components/LiveVideoPlayer"));
import { getReadableAddress } from "../utils/utils";
import SosRoutingTracker from "../components/SosRoutingTracker";
import CustomDropdown from "../components/CustomDropdown";
import { useTheme } from "../themes/ThemeContext";
import { addAuditLog } from "../utils/auditLog";
import {
  MapPin,
  User,
  X,
  Phone,
  Radio,
  CheckCircle,
  ShieldCheck,
  Maximize2,
  Loader,
  Search,
  RotateCcw,
  Shield,
  Clock,
  ExternalLink,
  ShieldAlert,
  Send,
  Users,
  Video,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Check,
  Flame,
  Ambulance,
  Activity,
} from "lucide-react";
import { getResponderOptionLabel } from "../utils/responderOptions";
import { useMessageBox } from "../components/MessageBox";

import DepartmentBadge from "../components/DepartmentBadge";

export default function PendingSos() {
  const { isDark } = useTheme();
  const [sosSignals, setSosSignals] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [addresses, setAddresses] = useState({});
  const [selectedMap, setSelectedMap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const [availableResponders, setAvailableResponders] = useState([]);
  const [respondersLoading, setRespondersLoading] = useState(false);
  const [selectedResponderIds, setSelectedResponderIds] = useState({});
  const [departmentFilters, setDepartmentFilters] = useState({});
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [selectedSos, setSelectedSos] = useState(null);

  const fetchedAddressIds = useRef(new Set());
  const { confirm, alert: showAlert } = useMessageBox();

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
        requestKey: null,
      });
      setDispatches(allDispatches);

      const activeDispatches = allDispatches.filter((d) => d.status?.toLowerCase() !== "resolved");
      const activeSosIds = [...new Set(activeDispatches.map((d) => d.sos_id).filter((id) => !!id))];
      let filterString = 'status = "active"';
      if (activeSosIds.length > 0) {
        const idFilters = activeSosIds.map((id) => `id = "${id}"`).join(" || ");
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
    } finally {
      setLoading(false);
    }
  }, [resolveAddresses]);

  // Handle Video Toggle
  const handleToggleVideo = (sosId) => {
    if (activeVideoId === sosId) {
      setActiveVideoId(null);
      window.__isMutedByLiveVideo = false;
    } else {
      setActiveVideoId(sosId);
      window.__isMutedByLiveVideo = true;
      window.dispatchEvent(new CustomEvent("force-pause-alarm"));
      const audio = document.getElementById("emergency-alert-sound");
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  };

  const fetchAvailableResponders = useCallback(async () => {
    setRespondersLoading(true);
    try {
      const responders = await pb.collection("responder_accounts").getFullList({
        sort: "department, first_name, last_name",
        requestKey: null,
      });
      setAvailableResponders(responders.filter((r) => r.is_available === true && !r.is_suspended));
    } catch (error) {
      console.error("Responder fetch error:", error);
    } finally {
      setRespondersLoading(false);
    }
  }, []);

  // Assign Responder to SOS
  const assignResponderToSos = async (
    sosSignal,
    responderIds = selectedResponderIds[sosSignal.id] || []
  ) => {
    if (!responderIds || responderIds.length === 0) {
      showAlert("Please select at least one standby responder before deploying.", { title: "Responder Required" });
      return;
    }

    const selectedResponders = responderIds
      .map((id) => availableResponders.find((r) => r.id === id))
      .filter(Boolean);

    if (selectedResponders.length === 0) {
      showAlert("Selected responders are currently offline.", { title: "Error" });
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
          status: "pending",
        });
        dispatchesCreated.push(dispatch);
      }

      await pb.collection("sos_tracking").update(sosSignal.id, {
        dispatch_status: "assigned",
      });

      const user = sosSignal.expand?.user;
      const citizenName = user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : "Citizen";
      const unitDescriptions = selectedResponders
        .map((r) => r.unit_name || `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.department || "Unit")
        .join(", ");
      const locDisplay = addresses[sosSignal.id] || sosSignal.barangay || "Barangay Lagonglong";

      const currentAdmin = pb.authStore.model;
      const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

      addAuditLog({
        action: "SOS_RESPONDER_DISPATCHED",
        target: `SOS #${sosSignal.id} [${citizenName}]`,
        details: `Administrator ${adminName} dispatched ${selectedResponders.length} responder unit(s) [${unitDescriptions}] to emergency SOS distress signal #${sosSignal.id} for ${citizenName} at ${locDisplay}.`,
        actor: adminName,
      });

      setSelectedResponderIds((prev) => ({ ...prev, [sosSignal.id]: [] }));
      await fetchSosSignals();
      await showAlert(`Successfully dispatched ${selectedResponders.length} unit(s) to emergency SOS signal.`, { title: "Units Dispatched" });
    } catch (err) {
      console.error("Dispatch assignment error:", err);
      for (const r of reservedResponders) {
        await pb.collection("responder_accounts").update(r.id, { is_available: true }).catch(() => {});
      }
      for (const d of dispatchesCreated) {
        await pb.collection("dispatches").delete(d.id).catch(() => {});
      }
      await showAlert("Failed to assign responder: " + (err.message || "Unknown error"), { title: "Error" });
    } finally {
      setAssigningId(null);
    }
  };

  // Resolve SOS
  const resolveSos = async (sosSignal) => {
    const shouldResolve = await confirm(
      "Mark this emergency SOS signal as fully resolved? All field dispatches will be concluded.",
      {
        title: "Confirm SOS Resolution",
        primaryLabel: "Resolve SOS",
        secondaryLabel: "Cancel",
      }
    );
    if (!shouldResolve) return;

    try {
      const sosDispatches = dispatches.filter(
        (d) => d.sos_id === sosSignal.id && d.status?.toLowerCase() !== "resolved"
      );

      for (const d of sosDispatches) {
        await pb.collection("dispatches").update(d.id, { status: "resolved" });
        if (d.responder_id) {
          await pb.collection("responder_accounts").update(d.responder_id, { is_available: true }).catch(() => {});
        }
      }

      await pb.collection("sos_tracking").update(sosSignal.id, {
        status: "resolved",
        dispatch_status: "resolved",
      });

      const user = sosSignal.expand?.user;
      const citizenName = user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : "Citizen";
      const currentAdmin = pb.authStore.model;
      const adminName = (`${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim()) || currentAdmin?.email || "Administrator";

      addAuditLog({
        action: "SOS_RESOLVED",
        target: `SOS #${sosSignal.id} [${citizenName}]`,
        details: `Administrator ${adminName} concluded and resolved emergency SOS distress signal #${sosSignal.id} for ${citizenName}. Released ${sosDispatches.length} active responder unit(s).`,
        actor: adminName,
      });

      setSosSignals((prev) => prev.filter((s) => s.id !== sosSignal.id));
      await showAlert("Emergency SOS signal resolved successfully.", { title: "SOS Resolved" });
    } catch (err) {
      console.error("Error resolving SOS:", err);
      await showAlert("Failed to resolve SOS: " + (err.message || "Unknown error"), { title: "Error" });
    }
  };

  // Realtime Subscriptions
  useEffect(() => {
    let isMounted = true;
    let unsubSos, unsubResponders, unsubDispatches;

    const loadAndSubscribe = async () => {
      await fetchSosSignals();
      await fetchAvailableResponders();

      let timeout1, timeout2, timeout3;
      unsubSos = await pb.collection("sos_tracking").subscribe("*", () => {
        clearTimeout(timeout1);
        timeout1 = setTimeout(() => { if (isMounted) fetchSosSignals(); }, 800);
      });
      unsubDispatches = await pb.collection("dispatches").subscribe("*", () => {
        clearTimeout(timeout2);
        timeout2 = setTimeout(() => { if (isMounted) fetchSosSignals(); }, 800);
      });
      unsubResponders = await pb.collection("responder_accounts").subscribe("*", () => {
        clearTimeout(timeout3);
        timeout3 = setTimeout(() => { if (isMounted) fetchAvailableResponders(); }, 800);
      });
    };

    loadAndSubscribe();

    return () => {
      isMounted = false;
      if (typeof unsubSos === "function") unsubSos().catch(() => {});
      if (typeof unsubDispatches === "function") unsubDispatches().catch(() => {});
      if (typeof unsubResponders === "function") unsubResponders().catch(() => {});
    };
  }, [fetchSosSignals, fetchAvailableResponders]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: isDark ? "#090d16" : "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 36px", minWidth: 0, overflowY: "auto" }}>
        {/* Header */}
        <header style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span className="urgent-status-pulse" style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block" }} />
              <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: "800", color: isDark ? "#f8fafc" : "#14532d", margin: 0, letterSpacing: "-0.02em" }}>
                Live SOS Emergency Calls
              </h1>
            </div>
            <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: "14px" }}>
              View emergency SOS distress signals from citizens, monitor live video streams, and dispatch responders.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "10px",
                backgroundColor: sosSignals.length > 0
                  ? (isDark ? "rgba(239, 68, 68, 0.18)" : "#fef2f2")
                  : (isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4"),
                border: sosSignals.length > 0
                  ? (isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fecaca")
                  : (isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0"),
                color: sosSignals.length > 0
                  ? (isDark ? "#f87171" : "#b91c1c")
                  : (isDark ? "#4ade80" : "#15803d"),
                fontSize: "13px",
                fontWeight: "800",
              }}
            >
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: sosSignals.length > 0 ? "#ef4444" : "#22c55e" }} />
              <span>{sosSignals.length} Active SOS Signals</span>
            </span>

            <button
              type="button"
              onClick={fetchSosSignals}
              disabled={loading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "10px",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                backgroundColor: isDark ? "#172338" : "#ffffff",
                color: isDark ? "#cbd5e1" : "#475569",
                fontSize: "12.5px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Empty State */}
        {sosSignals.length === 0 && !loading && (
          <div
            className="premium-table-card"
            style={{
              padding: "70px 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: isDark ? "#131c2e" : "linear-gradient(180deg, #ffffff 0%, #f6faf7 100%)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "24px",
                backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
                border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isDark ? "#4ade80" : "#15803d",
                marginBottom: "18px",
                boxShadow: isDark ? "0 10px 25px -5px rgba(0, 0, 0, 0.4)" : "0 10px 25px -5px rgba(21, 128, 61, 0.15)",
              }}
            >
              <CheckCircle size={36} />
            </div>
            <h3 style={{ color: isDark ? "#f8fafc" : "#0f172a", fontSize: "20px", fontWeight: "800", margin: "0 0 8px 0" }}>
              No Active SOS Distress Signals
            </h3>
            <p style={{ margin: 0, fontSize: "14.5px", color: isDark ? "#94a3b8" : "#64748b", maxWidth: "440px", lineHeight: "1.5" }}>
              All resident emergency distress beacons have been handled and dispatched. New emergency alarms will trigger instantly.
            </p>
          </div>
        )}

        {loading && sosSignals.length === 0 && (
          <div style={{ padding: "80px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", color: isDark ? "#4ade80" : "#15803d" }}>
            <Loader className="animate-spin" size={32} />
            <span style={{ fontWeight: "700", fontSize: "15px" }}>Loading live SOS alerts...</span>
          </div>
        )}

        {/* SOS Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(440px, 1fr))", gap: "24px" }}>
          {sosSignals.map((sos) => {
            const sosDispatches = dispatches.filter((d) => d.sos_id === sos.id);
            const activeSosDispatches = sosDispatches.filter((d) => d.status?.toLowerCase() !== "resolved");
            const previouslyDispatchedIds = new Set(sosDispatches.map((d) => d.responder_id));
            const selectedIds = selectedResponderIds[sos.id] || [];
            const sosUser = sos.expand?.user || sos.expand?.users;
            const sosUserAvatar = sosUser ? (
              (sosUser.selfie ? pb.files.getURL(sosUser, sosUser.selfie) : null) ||
              (sosUser.avatar ? pb.files.getURL(sosUser, sosUser.avatar) : null) ||
              (sosUser.profile_picture ? pb.files.getURL(sosUser, sosUser.profile_picture) : null)
            ) : null;

            return (
              <div
                key={sos.id}
                className="premium-table-card"
                style={{
                  padding: "22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  position: "relative",
                  backgroundColor: isDark ? "#131c2e" : "#ffffff",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                  borderTop: "4px solid #ef4444",
                  boxShadow: isDark ? "0 8px 30px rgba(0,0,0,0.35)" : "0 4px 20px -2px rgba(0, 0, 0, 0.06)",
                }}
              >
                {/* Header Banner */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        backgroundColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fef2f2",
                        border: isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fecaca",
                        color: isDark ? "#f87171" : "#b91c1c",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                      className="urgent-status-pulse"
                    >
                      <Radio size={18} color={isDark ? "#f87171" : "#dc2626"} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f87171" : "#b91c1c", textTransform: "uppercase" }}>
                        CRITICAL SOS DISTRESS
                      </h3>
                      <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                        <Clock size={12} /> Broadcasted at {new Date(sos.created).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "800",
                      padding: "3px 8px",
                      borderRadius: "10px",
                      backgroundColor: activeSosDispatches.length > 0
                        ? (isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4")
                        : (isDark ? "rgba(239, 68, 68, 0.18)" : "#fef2f2"),
                      color: activeSosDispatches.length > 0
                        ? (isDark ? "#4ade80" : "#15803d")
                        : (isDark ? "#f87171" : "#b91c1c"),
                      border: activeSosDispatches.length > 0
                        ? (isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0")
                        : (isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fecaca"),
                      textTransform: "uppercase",
                    }}
                  >
                    {activeSosDispatches.length > 0 ? "UNITS DISPATCHED" : "UNASSIGNED"}
                  </span>
                </div>

                {/* Citizen Caller Profile */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    backgroundColor: isDark ? "#172338" : "#ffffff",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
                      border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0",
                      color: isDark ? "#4ade80" : "#15803d",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "800",
                      fontSize: "14px",
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    {sosUserAvatar ? (
                      <img
                        src={sosUserAvatar}
                        alt="Resident"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <span>{(sos.expand?.user?.first_name || "R")[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <strong style={{ display: "block", fontSize: "13px", color: isDark ? "#f8fafc" : "#0f172a", textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {sos.expand?.user?.first_name || "Resident"} {sos.expand?.user?.last_name || ""}
                      </strong>
                      <span style={{ fontSize: "10.5px", fontWeight: "700", color: isDark ? "#4ade80" : "#15803d", backgroundColor: isDark ? "rgba(34, 197, 94, 0.15)" : "#f0fdf4", border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #bbf7d0", padding: "1px 6px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
                        <ShieldCheck size={11} /> Verified
                      </span>
                    </div>
                    <span style={{ fontSize: "11.5px", color: isDark ? "#94a3b8" : "#64748b", display: "flex", alignItems: "center", gap: "5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: "1.2" }}>
                      <Phone size={11} style={{ flexShrink: 0 }} /> {sos.expand?.user?.contact_number || "No contact"} • Brgy. {sos.expand?.user?.baranggay || "Lagonglong"}
                    </span>
                  </div>
                </div>

                {/* Location Banner */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    backgroundColor: isDark ? "#172338" : "#f8fafc",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                    fontSize: "12.5px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <MapPin size={15} color={isDark ? "#4ade80" : "#15803d"} style={{ flexShrink: 0 }} />
                    <span style={{ color: isDark ? "#f8fafc" : "#334155", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {addresses[sos.id] || "Acquiring GPS Telemetry..."}
                    </span>
                  </div>

                  {sos.latitude && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMap({
                          lat: sos.latitude,
                          lng: sos.longitude,
                          address: addresses[sos.id] || `Emergency Coordinates (${sos.latitude.toFixed(5)}, ${sos.longitude.toFixed(5)})`,
                        });
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: isDark ? "#4ade80" : "#15803d",
                        fontWeight: "700",
                        fontSize: "11.5px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        flexShrink: 0,
                      }}
                    >
                      <ExternalLink size={12} /> Map
                    </button>
                  )}
                </div>

                {/* Embedded Interactive Mini Map Preview */}
                {sos.latitude != null && sos.longitude != null && (
                  <div
                    onClick={() =>
                      setSelectedMap({
                        lat: sos.latitude,
                        lng: sos.longitude,
                        address: addresses[sos.id] || `SOS Location (${sos.latitude.toFixed(5)}, ${sos.longitude.toFixed(5)})`,
                      })
                    }
                    style={{
                      height: "145px",
                      borderRadius: "12px",
                      overflow: "hidden",
                      position: "relative",
                      border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                      cursor: "pointer",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                      backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
                    }}
                  >
                    <iframe
                      title={`Map Preview for SOS ${sos.id}`}
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://maps.google.com/maps?q=${sos.latitude},${sos.longitude}&z=16&t=k&output=embed`}
                      style={{ border: 0, pointerEvents: "none", width: "100%", height: "100%" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: "8px",
                        right: "8px",
                        backgroundColor: "rgba(15, 23, 42, 0.85)",
                        color: "#ffffff",
                        fontSize: "11px",
                        fontWeight: "700",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      <Maximize2 size={12} /> Enlarge Map
                    </div>
                  </div>
                )}

                {/* Live Camera Feed Button */}
                <div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVideo(sos.id);
                    }}
                    style={{
                      background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                      color: "#ffffff",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "none",
                      fontWeight: "800",
                      fontSize: "12.5px",
                      cursor: "pointer",
                      width: "100%",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "8px",
                      boxShadow: "0 4px 14px rgba(220, 38, 38, 0.3)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Video size={16} />
                    <span>View Live Citizen Camera</span>
                  </button>
                </div>

                {/* Deployed Units List */}
                {activeSosDispatches.length > 0 && (
                  <div style={{ backgroundColor: isDark ? "#172338" : "#f8fafc", padding: "12px", borderRadius: "12px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11.5px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                      Deployed Response Units ({activeSosDispatches.length}):
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {activeSosDispatches.map((d) => {
                        const r = d.expand?.responder_id;
                        return (
                          <div
                            key={d.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "12px",
                              backgroundColor: isDark ? "#131c2e" : "#ffffff",
                              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                              padding: "6px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            <span style={{ color: isDark ? "#f8fafc" : "#0f172a", fontWeight: "700" }}>
                              {r ? `${r.first_name} ${r.last_name} (${r.department})` : d.department}
                            </span>
                            <span style={{ color: isDark ? "#4ade80" : "#15803d", textTransform: "uppercase", fontSize: "10.5px", fontWeight: "800" }}>
                              {d.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Standby Responders Multi-Selector */}
                <div style={{ borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", paddingTop: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", textTransform: "uppercase" }}>
                      Dispatch Standby Responders
                    </label>
                    <CustomDropdown
                      size="sm"
                      minWidth="135px"
                      value={departmentFilters[sos.id] || ""}
                      onChange={(val) => setDepartmentFilters((prev) => ({ ...prev, [sos.id]: val }))}
                      options={[
                        { value: "", label: "All Departments" },
                        { value: "police", label: "Police" },
                        { value: "ambulance", label: "Ambulance" },
                        { value: "MDRRMO", label: "MDRRMO" },
                        { value: "Fire", label: "BFP (Fire)" },
                      ]}
                    />
                  </div>

                  <div style={{ maxHeight: "135px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", backgroundColor: isDark ? "#0c1322" : "#f8fafc", padding: "8px", borderRadius: "10px", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", marginBottom: "12px" }}>
                    {respondersLoading ? (
                      <span style={{ fontSize: "11.5px", color: isDark ? "#4ade80" : "#15803d", padding: "6px", textAlign: "center" }}>Loading standby units...</span>
                    ) : availableResponders.length === 0 ? (
                      <span style={{ fontSize: "11.5px", color: "#94a3b8", padding: "6px", textAlign: "center" }}>No Standby Responders Online</span>
                    ) : (() => {
                      const filtered = availableResponders.filter(
                        (r) =>
                          !previouslyDispatchedIds.has(r.id) &&
                          (!departmentFilters[sos.id] || r.department === departmentFilters[sos.id])
                      );
                      if (filtered.length === 0) {
                        return <span style={{ fontSize: "11.5px", color: "#94a3b8", padding: "6px", textAlign: "center" }}>No units in this department</span>;
                      }
                      return filtered.map((r) => {
                        const isSelected = selectedIds.includes(r.id);
                        return (
                          <div
                            key={r.id}
                            onClick={() => {
                              setSelectedResponderIds((prev) => {
                                const current = prev[sos.id] || [];
                                return {
                                  ...prev,
                                  [sos.id]: current.includes(r.id) ? current.filter((id) => id !== r.id) : [...current, r.id],
                                };
                              });
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "8px",
                              padding: "7px 10px",
                              borderRadius: "8px",
                              backgroundColor: isSelected
                                ? (isDark ? "rgba(34, 197, 94, 0.2)" : "#f0fdf4")
                                : (isDark ? "#172338" : "#ffffff"),
                              border: isSelected
                                ? (isDark ? "1.5px solid #4ade80" : "1.5px solid #15803d")
                                : (isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0"),
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              boxShadow: isSelected ? "0 2px 6px rgba(21, 128, 61, 0.15)" : "0 1px 2px rgba(0,0,0,0.02)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0, flex: 1 }}>
                              {/* Custom Checkbox */}
                              <div
                                style={{
                                  width: "18px",
                                  height: "18px",
                                  borderRadius: "5px",
                                  backgroundColor: isSelected ? (isDark ? "#22c55e" : "#15803d") : (isDark ? "#0c1322" : "#ffffff"),
                                  border: isSelected ? "none" : (isDark ? "1.5px solid rgba(255, 255, 255, 0.25)" : "1.5px solid #cbd5e1"),
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {isSelected && <Check size={12} strokeWidth={3.5} color="#ffffff" />}
                              </div>

                              {/* Online status dot */}
                              <span
                                style={{
                                  width: "7px",
                                  height: "7px",
                                  borderRadius: "50%",
                                  backgroundColor: "#22c55e",
                                  boxShadow: "0 0 6px rgba(34, 197, 94, 0.6)",
                                  flexShrink: 0,
                                }}
                              />

                              {/* Responder Name */}
                              <span
                                style={{
                                  fontSize: "12.5px",
                                  fontWeight: isSelected ? "800" : "600",
                                  color: isSelected
                                    ? (isDark ? "#4ade80" : "#14532d")
                                    : (isDark ? "#f8fafc" : "#0f172a"),
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {`${r.unit_name ? `${r.unit_name} - ` : ""}${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email || "Responder"}
                              </span>
                            </div>

                            {/* Department Badge */}
                            <DepartmentBadge department={r.department} isDark={isDark} size="sm" />
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => assignResponderToSos(sos, selectedIds)}
                      disabled={assigningId === sos.id || selectedIds.length === 0}
                      style={{
                        flex: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: selectedIds.length > 0 ? "none" : (isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid #e2e8f0"),
                        background: selectedIds.length > 0
                          ? "linear-gradient(135deg, #15803d 0%, #166534 100%)"
                          : (isDark ? "#1e293b" : "#cbd5e1"),
                        color: selectedIds.length > 0 ? "#ffffff" : (isDark ? "#64748b" : "#ffffff"),
                        fontSize: "13px",
                        fontWeight: "800",
                        cursor: selectedIds.length > 0 ? "pointer" : "not-allowed",
                        boxShadow: selectedIds.length > 0 ? "0 4px 14px rgba(34, 197, 94, 0.35)" : "none",
                      }}
                    >
                      {assigningId === sos.id ? <Loader className="animate-spin" size={15} /> : <Send size={15} />}
                      <span>{assigningId === sos.id ? "Deploying..." : `Dispatch (${selectedIds.length})`}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedSos(sos)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                        backgroundColor: isDark ? "#172338" : "#ffffff",
                        color: isDark ? "#cbd5e1" : "#475569",
                        fontSize: "12.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      <Maximize2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* LIVE CITIZEN CAMERA MODAL */}
      {activeVideoId && (() => {
        const activeSos = sosSignals.find((s) => s.id === activeVideoId);
        const activeSosDispatches = dispatches.filter((d) => d.sos_id === activeVideoId && d.status?.toLowerCase() !== "resolved");
        const activeSosUser = activeSos?.expand?.user || activeSos?.expand?.users;
        const callerName = activeSosUser ? `${activeSosUser.first_name || ""} ${activeSosUser.last_name || ""}`.trim() : "Resident";

        return (
          <div
            className="lightboxModalBackdrop"
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(3, 7, 18, 0.88)",
              backdropFilter: "blur(12px)",
              zIndex: 99999,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "20px",
            }}
            onClick={() => handleToggleVideo(activeVideoId)}
          >
            <div
              className="lightboxModalCard"
              style={{
                backgroundColor: isDark ? "#131c2e" : "#0f172a",
                borderRadius: "20px",
                width: "100%",
                maxWidth: "960px",
                overflow: "hidden",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #334155",
                boxShadow: isDark ? "0 25px 60px -15px rgba(0, 0, 0, 0.9)" : "0 25px 60px -15px rgba(0, 0, 0, 0.6)",
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 22px",
                  borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(255, 255, 255, 0.1)",
                  backgroundColor: isDark ? "#172338" : "#1e293b",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(239, 68, 68, 0.2)",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      color: "#f87171",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                    className="urgent-status-pulse"
                  >
                    <Video size={18} color="#f87171" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#f8fafc", letterSpacing: "-0.01em" }}>
                        Live Citizen Camera Stream
                      </h3>
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: "800",
                          backgroundColor: "rgba(239, 68, 68, 0.25)",
                          color: "#f87171",
                          border: "1px solid rgba(239, 68, 68, 0.5)",
                          padding: "2px 7px",
                          borderRadius: "6px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          textTransform: "uppercase",
                        }}
                      >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#ef4444" }} className="animate-ping" />
                        Live Feed
                      </span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <User size={12} /> {callerName} • <Phone size={12} /> {activeSosUser?.contact_number || "No contact"} • Brgy. {activeSosUser?.baranggay || "Lagonglong"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="animatedCloseButton"
                  onClick={() => handleToggleVideo(activeVideoId)}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #475569",
                    backgroundColor: isDark ? "#1e293b" : "#334155",
                    color: "#f8fafc",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <X size={17} />
                </button>
              </div>

              {/* Video Player Box */}
              <div style={{ width: "100%", height: "520px", maxHeight: "65vh", backgroundColor: "#070b14", position: "relative" }}>
                <Suspense
                  fallback={
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#94a3b8", gap: "10px" }}>
                      <Loader className="animate-spin" size={28} color="#ef4444" />
                      <span style={{ fontSize: "13.5px", fontWeight: "700" }}>Connecting to high-definition stream...</span>
                    </div>
                  }
                >
                  <LiveVideoPlayer
                    channelName={activeVideoId}
                    responderId={activeSosDispatches[0]?.responder_id || null}
                  />
                </Suspense>
              </div>

              {/* Modal Footer / Telemetry Bar */}
              <div
                style={{
                  padding: "14px 22px",
                  borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(255, 255, 255, 0.1)",
                  backgroundColor: isDark ? "#172338" : "#1e293b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "14px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", fontSize: "12.5px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f8fafc" }}>
                    <MapPin size={14} color="#4ade80" />
                    <span style={{ color: "#cbd5e1" }}>
                      {addresses[activeVideoId] || (activeSos?.latitude ? `Lat: ${activeSos.latitude.toFixed(5)}, Lng: ${activeSos.longitude.toFixed(5)}` : "GPS Telemetry")}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <ShieldAlert size={14} color={activeSosDispatches.length > 0 ? "#4ade80" : "#f87171"} />
                    <span style={{ color: "#94a3b8" }}>Responders:</span>
                    {activeSosDispatches.length > 0 ? (
                      <span style={{ color: "#4ade80", fontWeight: "700" }}>
                        {activeSosDispatches.length} Unit(s) Active
                      </span>
                    ) : (
                      <span style={{ color: "#f87171", fontWeight: "700" }}>
                        No Units Dispatched Yet
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleVideo(activeVideoId)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #475569",
                    backgroundColor: isDark ? "#1e293b" : "#334155",
                    color: "#f8fafc",
                    fontSize: "12.5px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  Close Live Feed
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* FULLSCREEN MAP LIGHTBOX */}
      {selectedMap && (
        <div
          className="lightboxModalBackdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(3, 7, 18, 0.82)",
            backdropFilter: "blur(10px)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "24px",
          }}
          onClick={() => setSelectedMap(null)}
        >
          <div
            className="lightboxModalCard"
            style={{
              backgroundColor: isDark ? "#131c2e" : "#ffffff",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "760px",
              overflow: "hidden",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
              boxShadow: isDark ? "0 25px 60px -15px rgba(0, 0, 0, 0.8)" : "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 22px",
              borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
              backgroundColor: isDark ? "#131c2e" : "#f8fafc"
            }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin size={17} color={isDark ? "#4ade80" : "#15803d"} /> {selectedMap.address}
              </h3>
              <button
                type="button"
                className="animatedCloseButton"
                onClick={() => setSelectedMap(null)}
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                  backgroundColor: isDark ? "#1e293b" : "#fff",
                  color: isDark ? "#cbd5e1" : "#64748b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <X size={16} />
              </button>
            </div>
            <iframe
              title="Full Map"
              width="100%"
              height="480px"
              frameBorder="0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${selectedMap.lat},${selectedMap.lng}&z=17&t=k&output=embed`}
              style={{ border: 0 }}
            />
          </div>
        </div>
      )}

      {/* SOS INSPECTION MODAL */}
      {selectedSos && (
        <div
          className="lightboxModalBackdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(3, 7, 18, 0.82)",
            backdropFilter: "blur(10px)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "24px",
          }}
          onClick={() => setSelectedSos(null)}
        >
          <div
            className="lightboxModalCard"
            style={{
              backgroundColor: isDark ? "#131c2e" : "#ffffff",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "26px",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
              boxShadow: isDark ? "0 25px 60px -15px rgba(0, 0, 0, 0.8)" : "0 25px 60px -15px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: "16px",
              borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
              marginBottom: "20px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  backgroundColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fef2f2",
                  color: isDark ? "#f87171" : "#b91c1c",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <Radio size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a" }}>
                    SOS Beacon #{selectedSos.id}
                  </h2>
                  <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>
                    Signal active since {new Date(selectedSos.created).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="animatedCloseButton"
                onClick={() => setSelectedSos(null)}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                  backgroundColor: isDark ? "#1e293b" : "#fff",
                  color: isDark ? "#cbd5e1" : "#64748b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Resident Full Data */}
            <div style={{
              backgroundColor: isDark ? "#172338" : "#f8fafc",
              padding: "16px",
              borderRadius: "14px",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
              marginBottom: "18px"
            }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", textTransform: "uppercase" }}>
                Citizen Profile
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", fontSize: "13px" }}>
                <div><span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Name:</span> <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{selectedSos.expand?.user?.first_name} {selectedSos.expand?.user?.last_name}</strong></div>
                <div><span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Phone:</span> <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{selectedSos.expand?.user?.contact_number || "N/A"}</strong></div>
                <div><span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Email:</span> <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{selectedSos.expand?.user?.email || "N/A"}</strong></div>
                <div><span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Barangay:</span> <strong style={{ color: isDark ? "#f8fafc" : "#0f172a" }}>{selectedSos.expand?.user?.baranggay || "Lagonglong"}</strong></div>
              </div>
            </div>

            {/* Location & Routing Tracker */}
            {selectedSos.latitude && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", textTransform: "uppercase" }}>
                  Live Field Telemetry
                </h4>
                <div style={{
                  padding: "12px",
                  borderRadius: "12px",
                  backgroundColor: isDark ? "rgba(34, 197, 94, 0.12)" : "#f0fdf4",
                  border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #bbf7d0",
                  color: isDark ? "#4ade80" : "#14532d",
                  fontSize: "13px"
                }}>
                  <strong>Coordinates:</strong> {selectedSos.latitude}, {selectedSos.longitude} <br />
                  <strong>Address:</strong> {addresses[selectedSos.id] || "Acquiring telemetry..."}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setSelectedSos(null)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                  background: isDark ? "#172338" : "#fff",
                  color: isDark ? "#cbd5e1" : "#475569",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
