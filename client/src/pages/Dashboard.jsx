import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import SummaryCard from "../components/SummaryCard";
import DashboardMap from "../components/DashboardMap";
import { dashboardStyles as darkStyles } from "../themes/dashboardStyles";   
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
} from "lucide-react";

// Standardized list of ongoing statuses used across the system
const ONGOING_STATUSES = ["ongoing", "accepted", "en_route", "at_scene", "dispatched"];

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
  const prevSosCount = useRef(0);

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
      audio.play().catch(() => {}).catch(() => {});
    } catch (e) {
      console.warn("Audio alert failed to play:", e);
    }
  }, [soundMuted]);

  // Parallel reverse-geocoding helper
  const resolveAddresses = async (items) => {
    const geoItems = items.filter((item) => item.latitude && item.longitude);
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

    setAddresses((prev) => ({
      ...prev,
      ...Object.fromEntries(resolvedEntries.filter(Boolean)),
    }));
  };

  const loadData = useCallback(async () => {
    try {
      if (!pb.authStore.isValid) return;

      const [users, reports, sos, responders, dispatches, auditLogs, backupRequests] = await Promise.all([
        pb.collection("users").getFullList({ requestKey: null }).catch(() => []),
        pb.collection("incident_reports").getFullList({
          sort: "-created",
          expand: "users",
          requestKey: null,
        }).catch(() => []),
        pb.collection("sos_tracking").getFullList({
          sort: "-created",
          expand: "user,incident_id",
          requestKey: null,
        }).catch(() => []),
        pb.collection("responder_accounts").getFullList({ requestKey: null }).catch(() => []),
        pb.collection("dispatches").getFullList({
          expand: "responder_id,incident_id,sos_id",
          requestKey: null,
        }).catch(() => []),
        pb.collection("audit_logs").getList(1, 5, { sort: "-created", requestKey: null }).catch(() => ({ items: [] })),
        pb.collection("backup_requests").getFullList({
          expand: "requester_id,assigned_responder,incident_id,sos_id",
          requestKey: null,
        }).catch(() => []),
      ]);

      // Sound trigger on incoming SOS
      if (sos.length > prevSosCount.current && prevSosCount.current !== 0) {
        triggerEmergencyAlert();
      }
      prevSosCount.current = sos.length;

      setData({
        users,
        reports,
        sos,
        responders,
        dispatches,
        auditLogs: auditLogs.items || [],
        backupRequests,
      });

      const itemsToResolve = [
        ...reports.filter((r) => ["new", "pending"].includes(r.status)).slice(0, 5),
        ...sos.slice(0, 3),
      ];
      resolveAddresses(itemsToResolve);
    } catch (e) {
      console.error("Telemetry fetch failed:", e);
    }
  }, [triggerEmergencyAlert]);

  useEffect(() => {
    let isSubscribed = true;
    let unsubUsers, unsubReports, unsubSos, unsubResponders, unsubDispatches;

    const initDashboard = async () => {
      await loadData();
      if (!pb.authStore.isValid || !isSubscribed) return;

      // Real-time subscriptions
      unsubUsers = await pb.collection("users").subscribe("*", loadData);
      unsubReports = await pb.collection("incident_reports").subscribe("*", loadData);
      unsubSos = await pb.collection("sos_tracking").subscribe("*", loadData);
      unsubResponders = await pb.collection("responder_accounts").subscribe("*", loadData);
      unsubDispatches = await pb.collection("dispatches").subscribe("*", loadData);
    };

    initDashboard();

    return () => {
      isSubscribed = false;
      if (unsubUsers) unsubUsers().catch(() => {});
      if (unsubReports) unsubReports().catch(() => {});
      if (unsubSos) unsubSos().catch(() => {});
      if (unsubResponders) unsubResponders().catch(() => {});
      if (unsubDispatches) unsubDispatches().catch(() => {});
    };
  }, [loadData]);

  // Derived Dashboard Metrics
  const activeDispatches = data.dispatches.filter(d => d.status?.toLowerCase() !== "resolved");
  const activeIncidentIds = new Set(activeDispatches.map(d => d.incident_id).filter(id => !!id));
  const activeSosIds = new Set(activeDispatches.map(d => d.sos_id).filter(id => !!id));

  const activeSosList = data.sos.filter(s => s.status?.toLowerCase() !== "resolved" || activeSosIds.has(s.id));

  const stats = {
    pending: sortIncidentReportsByPriority(
      data.reports.filter((r) => ["new", "pending"].includes(r.status))
    ),
    ongoing: data.reports.filter((r) =>
      ONGOING_STATUSES.includes(r.status?.toLowerCase()) || activeIncidentIds.has(r.id)
    ).length,
    resolved: data.reports.filter((r) => r.status === "resolved").length,
    uPending: data.users.filter((u) => u.status === "pending").length,
    respondersAvailable: data.responders.filter((r) => r.is_available === true).length,
  };

  // Category Breakdown Aggregator
  const categoryCounts = data.reports.reduce((acc, r) => {
    const type = (r.type || "OTHER").toLowerCase();
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const getCategoryIcon = (type) => {
    const t = type.toLowerCase();
    if (t.includes("fire")) return <Flame size={14} color="#f97316" />;
    if (t.includes("medical") || t.includes("health")) return <Ambulance size={14} color="#ef4444" />;
    if (t.includes("traffic") || t.includes("accident")) return <Car size={14} color="#3b82f6" />;
    return <AlertOctagon size={14} color="#a855f7" />;
  };

  return (
    <div style={darkStyles.shell}>
      <Sidebar
        pendingIncidentsCount={stats.pending.length}
        ongoingIncidentsCount={stats.ongoing}
        pendingUsersCount={stats.uPending}
        pendingSosCount={activeSosList.length}
      />

      
      <main style={darkStyles.main}>
        {/* HEADER BAR WITH CONTROLS */}
        <header style={darkStyles.header}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <h1 style={darkStyles.title}>Command Center</h1>
              <span style={darkStyles.liveTag}>I-report</span>
            </div>
            <p style={darkStyles.subtitle}>Real-time emergency telemetry & operational dispatch</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>


            <div style={darkStyles.statusBadge}>
              <span style={darkStyles.statusDot} />
              ACTIVE
            </div>
          </div>
        </header>

        {/* METRIC RIBBON CARDS */}
        <div style={darkStyles.cardGrid}>
          <SummaryCard
            title="Active SOS"
            val={activeSosList.length}
            icon={<Radio size={16} color="#ef4444" />}
            accent="#ef4444"
            urgent={activeSosList.length > 0}
            onClick={() => navigate("/pending-sos")}
          />
          <SummaryCard
            title="Pending Incidents"
            val={stats.pending.length}
            icon={<AlertTriangle size={16} color="#f97316" />}
            accent="#f97316"
            onClick={() => navigate("/pending-incidents")}
          />
          <SummaryCard
            title="Ongoing Dispatches"
            val={stats.ongoing}
            icon={<Clock size={16} color="#38bdf8" />}
            accent="#38bdf8"
            onClick={() => navigate("/ongoing-incidents")}
          />
          <SummaryCard
            title="Resolved Total"
            val={stats.resolved}
            icon={<CheckCircle2 size={16} color="#22c55e" />}
            accent="#22c55e"
            onClick={() => navigate("/resolved-incidents")}
          />
          <SummaryCard
            title="Verification Queue"
            val={stats.uPending}
            icon={<UserCheck size={16} color="#818cf8" />}
            accent="#818cf8"
            onClick={() => navigate("/pending-users")}
          />
        </div>

        {/* MASTER GRID */}
        <div style={darkStyles.masterGrid}>
          {/* LEFT COLUMN: SOS & QUEUE */}
          <div style={darkStyles.gridCol}>
            {activeSosList.length > 0 && (
              <div style={darkStyles.sosPanel}>
                <div style={darkStyles.sosHeader}>
                  <h2 style={darkStyles.sosHeading}>
                    <Radio className="animate-pulse" size={12} /> CRITICAL ALERTS ({activeSosList.length})
                  </h2>
                  <button onClick={() => navigate("/pending-sos")} style={darkStyles.sosViewBtn}>
                    HUB <ArrowUpRight size={10} />
                  </button>
                </div>
                <div style={{ overflow: "auto", flex: 1 }}>
                  <table style={darkStyles.table}>
                    <thead>
                      <tr style={darkStyles.thRow}>
                        <th style={darkStyles.th}>CITIZEN</th>
                        <th style={darkStyles.th}>WAIT</th>
                        <th style={darkStyles.thRight}>ACT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSosList.slice(0, 3).map((s) => {
                        const citizenName = s.expand?.user?.first_name || s.expand?.users?.first_name || "Resident";
                        return (
                          <tr key={s.id} style={darkStyles.tr}>
                            <td style={darkStyles.tdBold}>{citizenName}</td>
                            <td style={darkStyles.tdHighlight}>{formatWaitTime(s.created)}</td>
                            <td style={darkStyles.tdRight}>
                              <button onClick={() => navigate("/pending-sos")} style={darkStyles.sosActionBtn}>Go</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            <div style={darkStyles.panelFlex}>
              <div style={darkStyles.panelHeader}>
                <h2 style={darkStyles.sectionTitle}>
                  <ShieldAlert size={14} color="#f97316" /> Incident Queue
                </h2>
                <button onClick={() => navigate("/pending-incidents")} style={darkStyles.ghostBtn}>
                  All ({stats.pending.length})
                </button>
              </div>
              <div style={{ overflow: "auto", flex: 1 }}>
                {stats.pending.length === 0 ? (
                  <p style={darkStyles.emptyState}>No pending incidents.</p>
                ) : (
                  <table style={darkStyles.table}>
                    <tbody>
                      {stats.pending.map((r) => (
                        <tr key={r.id} style={darkStyles.tr}>
                          <td style={darkStyles.tdBold}>
                            <span style={darkStyles.typeTag}>
                              {getCategoryIcon(r.type)} {r.type?.toUpperCase()}
                            </span>
                          </td>
                          <td style={darkStyles.tdMuted}>
                            {addresses[r.id]?.substring(0, 15) || "Locating..."}
                          </td>
                          <td style={darkStyles.tdRight}>
                            <button onClick={() => navigate("/pending-incidents")} style={darkStyles.dispatchBtn}>GO</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div style={darkStyles.panelFixed}>
              <div style={darkStyles.panelHeader}>
                <h2 style={darkStyles.sectionTitle}>
                  <PieIcon size={14} color="#a855f7" /> Breakdown
                </h2>
                <span style={darkStyles.subBadge}>{data.reports.length} Total</span>
              </div>
              <div style={darkStyles.categoryList}>
                {Object.keys(categoryCounts).length === 0 ? (
                  <p style={darkStyles.emptyState}>No data.</p>
                ) : (
                  Object.entries(categoryCounts).slice(0, 3).map(([type, count]) => (
                    <div key={type} style={darkStyles.categoryRow}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {getCategoryIcon(type)}
                        <span style={{ textTransform: "uppercase", fontSize: "9px", color: "#cbd5e1", fontWeight: 600 }}>
                          {type}
                        </span>
                      </div>
                      <span style={darkStyles.categoryCountBadge}>{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* MIDDLE COLUMN: MAP */}
          <div style={darkStyles.panelFlex}>
            <div style={darkStyles.panelHeader}>
              <h2 style={darkStyles.sectionTitle}>
                <MapPin size={14} color="#34d399" /> Live Tactical Map
              </h2>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <DashboardMap reports={data.reports} sos={activeSosList} responders={data.responders} dispatches={data.dispatches} backupRequests={data.backupRequests} />
            </div>
          </div>

          {/* RIGHT COLUMN: Fleet & Audit */}
          <div style={darkStyles.gridCol}>
            <div style={darkStyles.panelFixed}>
              <div style={darkStyles.panelHeader}>
                <h2 style={darkStyles.sectionTitle}>
                  <Truck size={14} color="#38bdf8" /> Fleet Readiness
                </h2>
                <span style={darkStyles.subBadgeBlue}>
                  {stats.respondersAvailable}/{data.responders.length || 0} Ready
                </span>
              </div>
              <p style={darkStyles.fleetSubtext}>
                {data.responders.length === 0
                  ? "No responder units registered in system."
                  : `${stats.respondersAvailable} emergency units ready for immediate deployment.`}
              </p>
            </div>

            <div style={darkStyles.panelFlex}>
              <div style={darkStyles.panelHeader}>
                <h2 style={darkStyles.sectionTitle}>
                  <History size={14} color="#818cf8" /> Live Audit Stream
                </h2>
                <button onClick={() => navigate("/audit")} style={darkStyles.ghostBtn}>View All</button>
              </div>
              {data.auditLogs.length === 0 ? (
                <p style={darkStyles.emptyState}>No recent records.</p>
              ) : (
                <ul style={darkStyles.auditList}>
                  {data.auditLogs.slice(0, 5).map((log) => (
                    <li key={log.id} style={darkStyles.auditItem}>
                      <Activity size={10} color="#64748b" style={{ flexShrink: 0, marginTop: "2px" }} />
                      <div style={darkStyles.auditContent}>
                        <p style={darkStyles.auditText}>{log.action || log.details || "System Event"}</p>
                        <span style={darkStyles.auditTime}>{formatWaitTime(log.created)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}


