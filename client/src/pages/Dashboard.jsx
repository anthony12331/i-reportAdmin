import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import DashboardMap from "../components/DashboardMap";
import MetricCardHolder from "../components/MetricCardHolder";
import { getReadableAddress } from "../utils/utils";
import { sortIncidentReportsByPriority } from "../utils/incidentPriority";
import { formatWaitTime } from "../utils/timeUtils";
import {
  MapPin,
  Radio,
  AlertTriangle,
  Truck,
  History,
  CheckCircle2,
  Clock,
  UserCheck,
  Activity,
  ArrowUpRight,
  ShieldAlert,
  Volume2,
  VolumeX,
  PieChart as PieIcon,
  Flame,
  Ambulance,
  Car,
  AlertOctagon,
  Shield,
  Zap,
  HeartPulse,
  ChevronRight,
  Tv,
  Maximize2,
  Minimize2,
  Users,
  FileText,
  Settings,
} from "lucide-react";

// Standardized list of ongoing statuses used across the system
const ONGOING_STATUSES = [
  "ongoing",
  "accepted",
  "en_route",
  "enroute",
  "at_scene",
  "atscene",
  "dispatched",
  "in_progress",
];

// Isolated clock component — its 1-second setInterval re-renders ONLY this
// tiny node, not the entire Dashboard tree (KPIs, map, panels, etc.)
function LiveClock({ color = "inherit", size = 13, style = {} }) {
  const [time, setTime] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ color, ...style }}>
      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}


export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    users: [],
    reports: [],
    sos: [],
    responders: [],
    dispatches: [],
    auditLogs: [],
    backupRequests: [],
  });
  const [addresses, setAddresses] = useState({});
  const [soundMuted, setSoundMuted] = useState(false);
  const [isTvMode, setIsTvMode] = useState(false);
  const mapCardRef = useRef(null);
  const prevSosCount = useRef(0);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // TV Fullscreen Event Handler
  const toggleTvMode = () => {
    if (!isTvMode) {
      const elem = mapCardRef.current;
      if (elem && elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => { });
      }
      setIsTvMode(true);
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
      setIsTvMode(false);
    }
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 200);
  };

  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsTvMode(isFs);
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 150);
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isTvMode) {
        setIsTvMode(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTvMode]);

  // Auth Guard
  useEffect(() => {
    if (!pb.authStore.isValid || !pb.authStore.model) {
      console.warn("Unauthorized access attempt detected. Routing back to login.");
      navigate("/");
    }
  }, [navigate]);

  // Audio Dispatch Alert Trigger
  const triggerEmergencyAlert = useCallback(() => {
    if (soundMuted) return;
    try {
      const audio = new Audio("/notification_sound.mp3");
      audio.play().catch(() => { });
    } catch (e) {
      console.warn("Audio alert failed to play:", e);
    }
  }, [soundMuted]);

  // Parallel reverse-geocoding with persistent cache.
  // Items already resolved (ID present in `addresses`) are skipped entirely
  // so we don't hit the Nominatim rate limit on every 400ms subscription event.
  const resolveAddresses = useCallback(async (items) => {
    const geoItems = items.filter(
      (item) => item.latitude && item.longitude && !addresses[item.id]
    );
    if (geoItems.length === 0) return;

    const resolvedEntries = await Promise.all(
      geoItems.map(async (item) => {
        try {
          const address = await getReadableAddress(item.latitude, item.longitude);
          return [item.id, address];
        } catch {
          return [item.id, "GPS Coordinates Acquired"];
        }
      })
    );

    if (resolvedEntries.some(Boolean)) {
      setAddresses((prev) => ({
        ...prev,
        ...Object.fromEntries(resolvedEntries.filter(Boolean)),
      }));
    }
  }, [addresses]);

  const loadData = useCallback(async () => {
    try {
      if (!pb.authStore.isValid) return;

      const [usersRes, reportsRes, sosRes, respondersRes, dispatchesRes, auditLogsRes, backupRequestsRes] = await Promise.all([
        pb.collection("users").getFullList({ fields: "id,status", requestKey: "dash-users" }).catch(() => []),
        pb.collection("incident_reports").getFullList({
          sort: "-created",
          expand: "users",
          requestKey: "dash-reports",
        }).catch(() => []),
        pb.collection("sos_tracking").getFullList({
          sort: "-created",
          expand: "user,incident_id",
          requestKey: "dash-sos",
        }).catch(() => []),
        pb.collection("responder_accounts").getFullList({ requestKey: "dash-responders" }).catch(() => []),
        pb.collection("dispatches").getFullList({
          expand: "responder_id,incident_id,sos_id",
          requestKey: "dash-dispatches",
        }).catch(() => []),
        pb.collection("audit_logs").getList(1, 6, { sort: "-created", requestKey: "dash-audit" }).catch(() => ({ items: [] })),
        pb.collection("backup_requests").getFullList({
          expand: "requester_id,assigned_responder,incident_id,sos_id",
          requestKey: "dash-backups",
        }).catch(() => []),
      ]);

      if (!isMounted.current) return;

      const rawUsers = usersRes || [];
      const pendingUsersCount = rawUsers.filter((u) => {
        const s = (u.status || "").toLowerCase().trim();
        return s === "pending" || s === "" || (s !== "verified" && s !== "suspended" && s !== "rejected");
      }).length;
      const reports = reportsRes || [];
      const sos = sosRes || [];
      const responders = respondersRes || [];
      const dispatches = dispatchesRes || [];
      const auditLogs = auditLogsRes?.items || [];
      const backupRequests = backupRequestsRes || [];

      // Sound trigger on incoming SOS
      if (sos.length > prevSosCount.current && prevSosCount.current !== 0) {
        triggerEmergencyAlert();
      }
      prevSosCount.current = sos.length;

      setData({
        users: [],
        pendingUsersCount,
        reports,
        sos,
        responders,
        dispatches,
        auditLogs,
        backupRequests,
      });

      const itemsToResolve = [
        ...reports.filter((r) => ["new", "pending"].includes(r.status)).slice(0, 6),
        ...sos.slice(0, 4),
      ];
      resolveAddresses(itemsToResolve);

    } catch (error) {
      if (!error.isAbort) console.error("Dashboard data load error:", error);
    }
  }, [triggerEmergencyAlert]);

  useEffect(() => {
    let isSubscribed = true;
    let unsubUsers, unsubReports, unsubSos, unsubResponders, unsubDispatches;

    let debounceTimer;
    const debouncedLoadData = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadData, 400);
    };

    const initDashboard = async () => {
      await loadData();
      if (!pb.authStore.isValid || !isSubscribed) return;

      // Real-time subscriptions
      unsubUsers = await pb.collection("users").subscribe("*", debouncedLoadData);
      unsubReports = await pb.collection("incident_reports").subscribe("*", debouncedLoadData);
      unsubSos = await pb.collection("sos_tracking").subscribe("*", debouncedLoadData);
      unsubResponders = await pb.collection("responder_accounts").subscribe("*", debouncedLoadData);
      unsubDispatches = await pb.collection("dispatches").subscribe("*", debouncedLoadData);
    };

    initDashboard();

    return () => {
      isSubscribed = false;
      if (unsubUsers) unsubUsers().catch(() => { });
      if (unsubReports) unsubReports().catch(() => { });
      if (unsubSos) unsubSos().catch(() => { });
      if (unsubResponders) unsubResponders().catch(() => { });
      if (unsubDispatches) unsubDispatches().catch(() => { });
    };
  }, [loadData]);

  // Derived Dashboard Metrics — all memoized so they only recompute when
  // the underlying data changes, not on every parent render / timer tick
  const activeDispatches = useMemo(
    () => data.dispatches.filter((d) => d.status?.toLowerCase() !== "resolved"),
    [data.dispatches]
  );

  const activeIncidentIds = useMemo(
    () => new Set(activeDispatches.map((d) => d.incident_id).filter(Boolean)),
    [activeDispatches]
  );

  const activeSosIds = useMemo(
    () => new Set(activeDispatches.map((d) => d.sos_id).filter(Boolean)),
    [activeDispatches]
  );

  const activeSosList = useMemo(
    () => data.sos.filter((s) => s.status?.toLowerCase() !== "resolved" || activeSosIds.has(s.id)),
    [data.sos, activeSosIds]
  );

  const pendingIncidents = useMemo(() => {
    return sortIncidentReportsByPriority(
      data.reports.filter((r) => ["new", "pending"].includes(r.status?.toLowerCase()))
    );
  }, [data.reports]);

  const ongoingCount = useMemo(() => {
    return data.reports.filter(
      (r) => ONGOING_STATUSES.includes(r.status?.toLowerCase()) || activeIncidentIds.has(r.id)
    ).length;
  }, [data.reports, activeIncidentIds]);

  const resolvedCount = useMemo(() => {
    return data.reports.filter((r) => r.status === "resolved").length;
  }, [data.reports]);

  // Category Breakdown Aggregator
  const categoryCounts = useMemo(() => {
    return data.reports.reduce((acc, r) => {
      const type = (r.type || "OTHER").toLowerCase();
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }, [data.reports]);

  // Fleet breakdown by Agency
  const fleetByAgency = useMemo(() => {
    const agencies = {
      BFP: { label: "Fire Protection", available: 0, total: 0, color: "#dc2626", icon: Flame },
      PNP: { label: "National Police", available: 0, total: 0, color: "#7c3aed", icon: Shield },
      EMS: { label: "Medical Services", available: 0, total: 0, color: "#0284c7", icon: Ambulance },
      MDRRMO: { label: "Disaster Risk", available: 0, total: 0, color: "#15803d", icon: Activity },
    };

    data.responders.forEach((r) => {
      const dept = (r.department || "").toUpperCase();
      let key = "MDRRMO";
      if (dept.includes("FIRE") || dept.includes("BFP")) key = "BFP";
      else if (dept.includes("POLICE") || dept.includes("PNP")) key = "PNP";
      else if (dept.includes("AMBULANCE") || dept.includes("EMS") || dept.includes("MED")) key = "EMS";

      if (agencies[key]) {
        agencies[key].total++;
        if (r.is_available === true) agencies[key].available++;
      }
    });

    return agencies;
  }, [data.responders]);

  const totalRespondersAvailable = useMemo(
    () => data.responders.filter((r) => r.is_available === true).length,
    [data.responders]
  );

  const getCategoryIcon = (type) => {
    const t = (type || "").toLowerCase();
    if (t.includes("fire")) return <Flame size={13} color="#dc2626" />;
    if (t.includes("medical") || t.includes("health")) return <HeartPulse size={13} color="#0284c7" />;
    if (t.includes("traffic") || t.includes("accident")) return <Car size={13} color="#ea580c" />;
    if (t.includes("police")) return <Shield size={13} color="#7c3aed" />;
    return <AlertOctagon size={13} color="#64748b" />;
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar
        pendingIncidentsCount={pendingIncidents.length}
        ongoingIncidentsCount={ongoingCount}
        pendingUsersCount={data.pendingUsersCount}
        pendingSosCount={activeSosList.length}
      />

      <main style={{ flex: 1, marginLeft: "216px", padding: "28px 34px", minWidth: 0, overflowY: "auto" }}>
        {/* 1. EXECUTIVE HEADER */}
        <header
          style={{
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span className="live-status-pulse" style={{ width: "11px", height: "11px", borderRadius: "50%", backgroundColor: "#15803d", display: "inline-block" }} />
              <span style={{ fontSize: "11.5px", fontWeight: "900", color: "#15803d", textTransform: "uppercase", letterSpacing: "0.06em", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "3px 9px", borderRadius: "6px" }}>
                Lagonglong MDRRMO Command Center
              </span>
            </div>
            <h1 style={{ fontSize: "clamp(24px, 3.2vw, 30px)", fontWeight: "900", color: "#0f172a", margin: 0, letterSpacing: "-0.03em" }}>
              Emergency Operations Dashboard
            </h1>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13.5px", fontWeight: "500" }}>
              Live emergency monitoring, citizen reports, and responder status across Lagonglong.
            </p>
          </div>

          {/* Right Header Live Telemetry Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Audio Siren Mute / Unmute Toggle */}
            <button
              type="button"
              className="dashboard-sirens-btn"
              onClick={() => setSoundMuted(!soundMuted)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "10px",
                border: soundMuted ? "1px solid #cbd5e1" : "1px solid #bbf7d0",
                backgroundColor: soundMuted ? "#ffffff" : "#f0fdf4",
                color: soundMuted ? "#64748b" : "#15803d",
                fontSize: "12px",
                fontWeight: "800",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title={soundMuted ? "Audio sirens muted" : "Audio sirens active"}
            >
              {soundMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span>{soundMuted ? "Sirens Muted" : "Sirens Active"}</span>
            </button>

            {/* Live Clock Pill */}
            <div
              className="dashboard-clock-pill"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "10px",
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                color: "#0f172a",
                fontSize: "12px",
                fontWeight: "800",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <Clock size={13} color="#15803d" />
              <LiveClock />
            </div>

            {/* Active Status Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "10px",
                backgroundColor: "#15803d",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: "900",
                letterSpacing: "0.04em",
                boxShadow: "0 4px 12px rgba(21, 128, 61, 0.22)",
              }}
            >
              <Activity size={13} />
              <span>LIVE TELEMETRY</span>
            </div>
          </div>
        </header>

        {/* 2. HIGH-IMPACT SCALE-JUMP KPI RIBBON */}
        <div
          className="dashboard-kpi-ribbon"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          {/* Active SOS Card */}
          <MetricCardHolder
            title="Active SOS Alerts"
            value={activeSosList.length}
            subtitle="critical"
            variant="red"
            urgent={activeSosList.length > 0}
            icon={<Radio size={16} className={activeSosList.length > 0 ? "animate-pulse" : ""} />}
            onClick={() => navigate("/pending-sos")}
          />

          {/* Pending Incidents */}
          <MetricCardHolder
            title="Pending Queue"
            value={pendingIncidents.length}
            subtitle="unassigned"
            variant="amber"
            icon={<AlertTriangle size={16} />}
            onClick={() => navigate("/pending-incidents")}
          />

          {/* Active Dispatches */}
          <MetricCardHolder
            title="Active Dispatches"
            value={ongoingCount}
            subtitle="in field"
            variant="sky"
            icon={<Clock size={16} />}
            onClick={() => navigate("/ongoing-incidents")}
          />

          {/* Resolved Total */}
          <MetricCardHolder
            title="Resolved Total"
            value={resolvedCount}
            subtitle="cases"
            variant="emerald"
            icon={<CheckCircle2 size={16} />}
            onClick={() => navigate("/resolved-incidents")}
          />

          {/* Verification Queue */}
          <MetricCardHolder
            title="Citizen Registrations"
            value={data.pendingUsersCount}
            subtitle="pending"
            variant="purple"
            icon={<Users size={16} />}
            onClick={() => navigate("/pending-users")}
          />
        </div>

        {/* 3. HERO LIVE TACTICAL MAP (FULL WIDTH DIRECTLY IN THE MIDDLE + TV FULLSCREEN SUPPORT) */}
        <div
          ref={mapCardRef}
          className={isTvMode ? "dashboard-map-card" : "premium-table-card dashboard-map-card"}
          style={
            isTvMode
              ? {
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 999999,
                backgroundColor: "#0f172a",
                borderRadius: 0,
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }
              : {
                padding: "0",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                height: "540px",
                marginBottom: "24px",
                boxShadow: "0 8px 30px rgba(15, 23, 42, 0.08)",
              }
          }
        >
          {/* Map Header / TV Fullscreen HUD Bar */}
          <div
            className="dashboard-map-header"
            style={
              isTvMode
                ? {
                  padding: "12px 24px",
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  backdropFilter: "blur(16px)",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: "#ffffff",
                  zIndex: 1000,
                  flexWrap: "wrap",
                  gap: "12px",
                }
                : {
                  padding: "16px 22px",
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "#ffffff",
                  flexWrap: "wrap",
                  gap: "10px",
                }
            }
          >
            {/* Title & Live Status */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                className="dashboard-map-icon-wrap"
                style={{
                  width: isTvMode ? "36px" : "32px",
                  height: isTvMode ? "36px" : "32px",
                  borderRadius: "8px",
                  backgroundColor: isTvMode ? "#166534" : "#f0fdf4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: isTvMode ? "1px solid #22c55e" : "1px solid #bbf7d0",
                }}
              >
                <MapPin size={isTvMode ? 20 : 18} color={isTvMode ? "#86efac" : "#15803d"} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 className="dashboard-map-title" style={{ margin: 0, fontSize: isTvMode ? "17px" : "16px", fontWeight: "900", color: isTvMode ? "#ffffff" : "#0f172a", letterSpacing: "-0.02em" }}>
                    {isTvMode ? "LAGONGLONG MDRRMO • COMMAND CENTER LIVE MAP" : "Live Tactical Emergency Map"}
                  </h3>
                  {isTvMode && (
                    <span style={{ fontSize: "10.5px", fontWeight: "900", color: "#22c55e", backgroundColor: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.3)", padding: "2px 8px", borderRadius: "6px" }}>
                      ● LIVE FEED
                    </span>
                  )}
                </div>
                <span className="dashboard-map-subtitle" style={{ fontSize: "11.5px", color: isTvMode ? "#94a3b8" : "#64748b", fontWeight: "600" }}>
                  Real-time GPS emergency positioning, live responder units, and municipal jurisdiction boundaries
                </span>
              </div>
            </div>

            {/* Live Badges & Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {/* Large Clock in Fullscreen Mode */}
              {isTvMode && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: "900",
                    letterSpacing: "0.05em",
                  }}
                >
                  <Clock size={14} color="#22c55e" />
                  <LiveClock />
                </div>
              )}

              {/* Status Badges */}
              <span
                className="dashboard-map-sos-badge"
                style={{
                  fontSize: "11.5px",
                  fontWeight: "800",
                  color: activeSosList.length > 0 ? "#dc2626" : isTvMode ? "#94a3b8" : "#64748b",
                  backgroundColor: activeSosList.length > 0 ? (isTvMode ? "#450a0a" : "#fef2f2") : isTvMode ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                  border: activeSosList.length > 0 ? "1px solid #fecaca" : isTvMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e2e8f0",
                  padding: "5px 11px",
                  borderRadius: "7px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#dc2626", display: "inline-block" }} />
                <span>{activeSosList.length} SOS Alerts</span>
              </span>
              <span
                className="dashboard-map-ongoing-badge"
                style={{
                  fontSize: "11.5px",
                  fontWeight: "800",
                  color: isTvMode ? "#38bdf8" : "#0284c7",
                  backgroundColor: isTvMode ? "rgba(56, 189, 248, 0.15)" : "#f0f9ff",
                  border: isTvMode ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid #bae6fd",
                  padding: "5px 11px",
                  borderRadius: "7px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Truck size={13} color={isTvMode ? "#38bdf8" : "#0284c7"} />
                <span>{ongoingCount} Ongoing Incidents</span>
              </span>
              <span
                className="dashboard-map-ready-badge"
                style={{
                  fontSize: "11.5px",
                  fontWeight: "800",
                  color: isTvMode ? "#4ade80" : "#15803d",
                  backgroundColor: isTvMode ? "rgba(74, 222, 128, 0.15)" : "#f0fdf4",
                  border: isTvMode ? "1px solid rgba(74, 222, 128, 0.3)" : "1px solid #bbf7d0",
                  padding: "5px 11px",
                  borderRadius: "7px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Shield size={13} color={isTvMode ? "#4ade80" : "#15803d"} />
                <span>{totalRespondersAvailable} Units Ready</span>
              </span>

              {/* Fullscreen Button Toggle */}
              <button
                type="button"
                className="dashboard-map-fullscreen-btn"
                onClick={toggleTvMode}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: isTvMode ? "6px 14px" : "6px 13px",
                  borderRadius: "8px",
                  backgroundColor: isTvMode ? "#dc2626" : "#0f172a",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: "800",
                  cursor: "pointer",
                  border: isTvMode ? "1px solid #ef4444" : "1px solid #334155",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  transition: "all 0.15s ease",
                }}
                title={isTvMode ? "Exit Fullscreen (Esc)" : "Expand map to full screen"}
              >
                {isTvMode ? (
                  <>
                    <Minimize2 size={14} />
                    <span>Exit Full Screen (Esc)</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={14} color="#38bdf8" />
                    <span>Full Screen</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Map Container */}
          <div
            style={{
              flex: 1,
              width: "100%",
              height: isTvMode ? "calc(100vh - 110px)" : "430px",
              minHeight: isTvMode ? "400px" : "430px",
              position: "relative",
            }}
          >
            <DashboardMap
              reports={data.reports}
              sos={data.sos}
              responders={data.responders}
              dispatches={data.dispatches}
              backupRequests={data.backupRequests}
            />
          </div>

          {/* Map Legend Ribbon */}
          <div
            style={
              isTvMode
                ? {
                  padding: "8px 24px",
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  backdropFilter: "blur(16px)",
                  borderTop: "1px solid rgba(255, 255, 255, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-around",
                  flexWrap: "wrap",
                  gap: "14px",
                  fontSize: "12px",
                  fontWeight: "800",
                  color: "#e2e8f0",
                }
                : {
                  padding: "10px 22px",
                  backgroundColor: "#ffffff",
                  borderTop: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-around",
                  flexWrap: "wrap",
                  gap: "12px",
                  fontSize: "11.5px",
                  fontWeight: "800",
                  color: "#475569",
                }
            }
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "#dc2626", display: "inline-block", boxShadow: "0 0 0 2px rgba(220, 38, 38, 0.4)" }} />
              <span>Critical Citizen SOS</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "#ea580c", display: "inline-block" }} />
              <span>Reported Incident</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "#0284c7", display: "inline-block" }} />
              <span>Deployed Responder Unit</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "#15803d", display: "inline-block" }} />
              <span>MDRRMO Municipal Station Base</span>
            </div>
          </div>
        </div>

        {/* 4. UNIFIED & CLEAN 3-PANEL COMMAND WORKBENCH */}
        <div
          className="dashboard-command-workbench"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
            gap: "20px",
            alignItems: "stretch",
          }}
        >
          {/* PANEL 1: EMERGENCY & INCIDENT TRIAGE QUEUE */}
          <div
            className="premium-table-card"
            style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              height: "440px",
              overflow: "hidden",
            }}
          >
            {/* Panel Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", paddingBottom: "12px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "7px", backgroundColor: "#fff7ed", border: "1px solid #ffedd5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldAlert size={15} color="#ea580c" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "900", color: "#0f172a" }}>
                    Emergency Triage Queue
                  </h3>
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>
                    {pendingIncidents.length + activeSosList.length} total pending dispatch
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="dashboard-view-all-btn"
                onClick={() => navigate("/pending-incidents")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                  color: "#0f172a",
                  fontSize: "11.5px",
                  fontWeight: "800",
                  cursor: "pointer",
                }}
              >
                View All
              </button>
            </div>

            {/* Panel Scrollable Body */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
              {/* Active SOS Banner if any */}
              {activeSosList.length > 0 && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Radio className="animate-pulse" size={15} color="#dc2626" />
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: "900", color: "#dc2626" }}>
                        {activeSosList.length} Active SOS Alert{activeSosList.length > 1 ? "s" : ""}
                      </div>
                      <div style={{ fontSize: "10.5px", color: "#991b1b", fontWeight: "600" }}>
                        Immediate dispatch required
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/pending-sos")}
                    style={{
                      padding: "4px 9px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: "#dc2626",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: "800",
                      cursor: "pointer",
                    }}
                  >
                    Console
                  </button>
                </div>
              )}

              {/* Pending Incidents List */}
              {pendingIncidents.length === 0 && activeSosList.length === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>
                  <div style={{ width: "42px", height: "42px", borderRadius: "50%", backgroundColor: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "10px" }}>
                    <CheckCircle2 size={22} color="#15803d" />
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a", marginBottom: "2px" }}>
                    Triage Queue is Clear
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                    All citizen reports and emergency SOS signals are dispatched.
                  </div>
                </div>
              ) : (
                pendingIncidents.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      gap: "10px",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                        {getCategoryIcon(r.type)}
                        <span style={{ fontSize: "12px", fontWeight: "800", color: "#0f172a", textTransform: "uppercase" }}>
                          {r.type || "INCIDENT"}
                        </span>
                        <span style={{ fontSize: "10px", color: "#ea580c", backgroundColor: "#fef3c7", padding: "1px 5px", borderRadius: "4px", fontWeight: "800" }}>
                          PENDING
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {addresses[r.id] || "GPS Coordinates Acquired"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/pending-incidents")}
                      style={{
                        padding: "5px 11px",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: "#15803d",
                        color: "#ffffff",
                        fontSize: "11px",
                        fontWeight: "800",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      Assign
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Panel Footer */}
            <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "#64748b", fontWeight: "700" }}>
              <span>Live Queue Monitor</span>
              <span style={{ color: "#15803d" }}>● Operational</span>
            </div>
          </div>

          {/* PANEL 2: MULTI-AGENCY FLEET & CLASSIFICATION */}
          <div
            className="premium-table-card"
            style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              height: "440px",
              overflow: "hidden",
            }}
          >
            {/* Panel Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", paddingBottom: "12px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "7px", backgroundColor: "#f0f9ff", border: "1px solid #e0f2fe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Truck size={15} color="#0284c7" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "900", color: "#0f172a" }}>
                    Fleet Readiness & Volume
                  </h3>
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>
                    Multi-agency emergency deployment
                  </span>
                </div>
              </div>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#15803d", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "3px 8px", borderRadius: "6px" }}>
                {totalRespondersAvailable}/{data.responders.length} Ready
              </span>
            </div>

            {/* Panel Body */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", overflowY: "auto", paddingRight: "4px" }}>
              {/* Agency Readiness Matrix (2x2 Grid) */}
              <div>
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>
                  Department Readiness
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
                  {Object.entries(fleetByAgency).map(([key, agency]) => {
                    const Icon = agency.icon;
                    return (
                      <div
                        key={key}
                        className="dashboard-agency-card"
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Icon size={13} color={agency.color} />
                          <span style={{ fontSize: "11.5px", fontWeight: "800", color: "#0f172a" }}>{key}</span>
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: "800", color: agency.available > 0 ? "#15803d" : "#64748b" }}>
                          {agency.available}/{agency.total}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Classification Progress Distribution */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Incident Volume
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b" }}>
                    {data.reports.length} Total Cases
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  {Object.entries(categoryCounts).slice(0, 3).map(([type, count]) => {
                    const pct = Math.round((count / (data.reports.length || 1)) * 100);
                    return (
                      <div key={type}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px", fontSize: "11.5px" }}>
                          <span style={{ fontWeight: "700", color: "#0f172a", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "5px" }}>
                            {getCategoryIcon(type)} {type}
                          </span>
                          <span style={{ fontWeight: "800", color: "#0f172a", fontSize: "11px" }}>
                            {count} <span style={{ color: "#64748b", fontWeight: "600" }}>({pct}%)</span>
                          </span>
                        </div>
                        <div style={{ width: "100%", height: "4px", backgroundColor: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "#15803d" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Panel Footer */}
            <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
              <button
                type="button"
                className="dashboard-footer-action-btn"
                onClick={() => navigate("/ongoing-incidents")}
                style={{
                  width: "100%",
                  padding: "7px",
                  borderRadius: "7px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                  color: "#0f172a",
                  fontSize: "11.5px",
                  fontWeight: "800",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                }}
              >
                View Active Dispatches <ChevronRight size={13} />
              </button>
            </div>
          </div>

          {/* PANEL 3: LIVE AUDIT FEED & QUICK OPERATIONS */}
          <div
            className="premium-table-card"
            style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              height: "440px",
              overflow: "hidden",
            }}
          >
            {/* Panel Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", paddingBottom: "12px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "7px", backgroundColor: "#f5f3ff", border: "1px solid #ede9fe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <History size={15} color="#7c3aed" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "900", color: "#0f172a" }}>
                    Audit Feed & Shortcuts
                  </h3>
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>
                    Activity stream & fast actions
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="dashboard-view-all-btn"
                onClick={() => navigate("/audit-logs")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                  color: "#0f172a",
                  fontSize: "11.5px",
                  fontWeight: "800",
                  cursor: "pointer",
                }}
              >
                View All
              </button>
            </div>

            {/* Panel Body */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", overflowY: "auto", paddingRight: "4px" }}>
              {/* Audit Stream Snippets */}
              <div>
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>
                  Recent System Events
                </div>
                {data.auditLogs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "16px 0", color: "#94a3b8", fontSize: "11.5px" }}>
                    No recent audit activity recorded.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {data.auditLogs.slice(0, 3).map((log) => (
                      <div
                        key={log.id}
                        className="dashboard-audit-row"
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                          padding: "6px 8px",
                          borderRadius: "6px",
                          backgroundColor: "#f8fafc",
                          border: "1px solid #f1f5f9",
                        }}
                      >
                        <Activity size={12} color="#15803d" style={{ flexShrink: 0, marginTop: "2px" }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: "11px", fontWeight: "700", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {log.action || log.details || "System Event"}
                          </div>
                          <div style={{ fontSize: "9.5px", color: "#64748b", fontWeight: "600" }}>
                            {formatWaitTime(log.created)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Operations 2x2 Hub */}
              <div>
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Zap size={12} color="#eab308" /> Quick Command Shortcuts
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" }}>
                  <button
                    type="button"
                    className="dashboard-quick-cmd-btn"
                    onClick={() => navigate("/reports")}
                    style={{
                      padding: "8px",
                      borderRadius: "7px",
                      border: "1px solid #e2e8f0",
                      backgroundColor: "#f8fafc",
                      color: "#0f172a",
                      fontSize: "11px",
                      fontWeight: "800",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                    }}
                  >
                    <FileText size={13} color="#2563eb" />
                    <span>Reports Hub</span>
                  </button>
                  <button
                    type="button"
                    className="dashboard-quick-cmd-btn"
                    onClick={() => navigate("/verified-users")}
                    style={{
                      padding: "8px",
                      borderRadius: "7px",
                      border: "1px solid #e2e8f0",
                      backgroundColor: "#f8fafc",
                      color: "#0f172a",
                      fontSize: "11px",
                      fontWeight: "800",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                    }}
                  >
                    <Users size={13} color="#7c3aed" />
                    <span>Residents</span>
                  </button>
                  <button
                    type="button"
                    className="dashboard-quick-cmd-btn"
                    onClick={() => navigate("/ongoing-incidents")}
                    style={{
                      padding: "8px",
                      borderRadius: "7px",
                      border: "1px solid #e2e8f0",
                      backgroundColor: "#f8fafc",
                      color: "#0f172a",
                      fontSize: "11px",
                      fontWeight: "800",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                    }}
                  >
                    <Truck size={13} color="#0284c7" />
                    <span>Dispatches</span>
                  </button>
                  <button
                    type="button"
                    className="dashboard-quick-cmd-btn"
                    onClick={() => navigate("/manage-admins")}
                    style={{
                      padding: "8px",
                      borderRadius: "7px",
                      border: "1px solid #e2e8f0",
                      backgroundColor: "#f8fafc",
                      color: "#0f172a",
                      fontSize: "11px",
                      fontWeight: "800",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                    }}
                  >
                    <Shield size={13} color="#64748b" />
                    <span>Admin Mgmt</span>
                  </button>
                </div>
              </div>
            </div>


            {/* Panel Footer */}
            <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "#64748b", fontWeight: "700" }}>
              <span>PocketBase Engine</span>
              <span style={{ color: "#15803d" }}>● Connected</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
