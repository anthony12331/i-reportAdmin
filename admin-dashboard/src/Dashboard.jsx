import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { pb } from "./pocketbase";
import Sidebar from "./Sidebar";
import { getReadableAddress } from "./utils";
import { sortIncidentReportsByPriority } from "./incidentPriority";
import { formatWaitTime } from "./timeUtils";
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

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    users: [],
    reports: [],
    sos: [],
    responders: [],
    auditLogs: [],
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
      audio.play().catch(() => {});
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

      const [users, reports, sos, responders, auditLogs] = await Promise.all([
        pb.collection("users").getFullList({ requestKey: null }),
        pb.collection("incident_reports").getFullList({
          sort: "-created",
          expand: "users",
          requestKey: null,
        }),
        pb.collection("sos_tracking").getFullList({
          filter: 'status != "resolved"',
          sort: "-created",
          expand: "user,incident_id,assigned_responder",
          requestKey: null,
        }),
        pb.collection("responder_accounts").getFullList({ requestKey: null }).catch(() => []),
        pb.collection("audit_logs").getList(1, 5, { sort: "-created", requestKey: null }).catch(() => ({ items: [] })),
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
        auditLogs: auditLogs.items || [],
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

  const initDashboard = async () => {
    await loadData();
    if (!pb.authStore.isValid || !isSubscribed) return;

    // Real-time subscriptions
    pb.collection("users").subscribe("*", loadData);
    pb.collection("incident_reports").subscribe("*", loadData);
    pb.collection("sos_tracking").subscribe("*", loadData);
    
    // ✅ ADD THIS: Subscribe to responder availability updates
    pb.collection("responder_accounts").subscribe("*", loadData);
  };

  initDashboard();

  return () => {
    isSubscribed = false;
    pb.collection("users").unsubscribe("*");
    pb.collection("incident_reports").unsubscribe("*");
    pb.collection("sos_tracking").unsubscribe("*");
    pb.collection("responder_accounts").unsubscribe("*");
  };
  }, [loadData]);

   

  const stats = {
  pending: sortIncidentReportsByPriority(
    data.reports.filter((r) => ["new", "pending"].includes(r.status))
  ),
  ongoing: data.reports.filter((r) =>
    ["ongoing", "dispatched"].includes(r.status)
  ).length,
  resolved: data.reports.filter((r) => r.status === "resolved").length,
  uPending: data.users.filter((u) => u.status === "pending").length,
  
  //  the exact boolean field name from PocketBase
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
        pendingSosCount={data.sos.length}
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
            {/* Audio Toggle */}
            <button
              onClick={() => setSoundMuted(!soundMuted)}
              style={soundMuted ? darkStyles.soundBtnMuted : darkStyles.soundBtnActive}
              title={soundMuted ? "Unmute Audio Sirens" : "Mute Audio Sirens"}
            >
              {soundMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              <span>{soundMuted ? "AUDIO MUTED" : "SIRENS ACTIVE"}</span>
            </button>

            {/* Live Socket Status */}
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
            val={data.sos.length}
            icon={<Radio size={20} color="#ef4444" />}
            accent="#ef4444"
            urgent={data.sos.length > 0}
            onClick={() => navigate("/pending-sos")}
          />
          <SummaryCard
            title="Pending Incidents"
            val={stats.pending.length}
            icon={<AlertTriangle size={20} color="#f97316" />}
            accent="#f97316"
            onClick={() => navigate("/pending-incidents")}
          />
          <SummaryCard
            title="Ongoing Dispatches"
            val={stats.ongoing}
            icon={<Clock size={20} color="#38bdf8" />}
            accent="#38bdf8"
            onClick={() => navigate("/ongoing-incidents")}
          />
          <SummaryCard
            title="Resolved Total"
            val={stats.resolved}
            icon={<CheckCircle2 size={20} color="#22c55e" />}
            accent="#22c55e"
            onClick={() => navigate("/resolved-incidents")}
          />
          <SummaryCard
            title="Verification Queue"
            val={stats.uPending}
            icon={<UserCheck size={20} color="#818cf8" />}
            accent="#818cf8"
            onClick={() => navigate("/pending-users")}
          />
        </div>

        {/* ACTIVE SOS EMERGENCY ALERT FEED */}
        {data.sos.length > 0 && (
          <div style={darkStyles.sosPanel}>
            <div style={darkStyles.sosHeader}>
              <h2 style={darkStyles.sosHeading}>
                <Radio className="animate-pulse" size={18} /> CRITICAL DISTRESS ALERTS ({data.sos.length})
              </h2>
              <button onClick={() => navigate("/pending-sos")} style={darkStyles.sosViewBtn}>
                SOS Control Hub <ArrowUpRight size={14} />
              </button>
            </div>
            <table style={darkStyles.table}>
              <thead>
                <tr style={darkStyles.thRow}>
                  <th style={darkStyles.th}>CITIZEN</th>
                  <th style={darkStyles.th}>SYNC CHANNEL</th>
                  <th style={darkStyles.th}>ELAPSED WAIT</th>
                  <th style={darkStyles.thRight}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {data.sos.slice(0, 3).map((s) => {
                  const citizenName =
                    s.expand?.user?.first_name ||
                    s.expand?.users?.first_name ||
                    "Resident";
                  return (
                    <tr key={s.id} style={darkStyles.tr}>
                      <td style={darkStyles.tdBold}>{citizenName}</td>
                      <td style={darkStyles.td}>
                        <span style={darkStyles.sosBadge}>{s.sync_channel?.toUpperCase() || "APP"}</span>
                      </td>
                      <td style={darkStyles.tdHighlight}>{formatWaitTime(s.created)}</td>
                      <td style={darkStyles.tdRight}>
                        <button
                          onClick={() => navigate("/pending-sos")}
                          style={darkStyles.sosActionBtn}
                        >
                          Dispatch Units
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* MAIN DASHBOARD CONTENT GRID */}
        <div style={darkStyles.splitGrid}>
          {/* LEFT COLUMN: PRIORITY QUEUE */}
          <div style={darkStyles.panel}>
            <div style={darkStyles.panelHeader}>
              <h2 style={darkStyles.sectionTitle}>
                <ShieldAlert size={18} color="#f97316" /> Incident Queue
              </h2>
              <button
                onClick={() => navigate("/pending-incidents")}
                style={darkStyles.ghostBtn}
              >
                View Full Queue ({stats.pending.length})
              </button>
            </div>
            {stats.pending.length === 0 ? (
              <p style={darkStyles.emptyState}>All emergency queues clear. No pending incidents.</p>
            ) : (
              <table style={darkStyles.table}>
                <thead>
                  <tr style={darkStyles.thRow}>
                    <th style={darkStyles.th}>CATEGORY</th>
                    <th style={darkStyles.th}>REPORTER</th>
                    <th style={darkStyles.th}>LOCATION</th>
                    <th style={darkStyles.thRight}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.pending.slice(0, 5).map((r) => (
                    <tr key={r.id} style={darkStyles.tr}>
                      <td style={darkStyles.tdBold}>
                        <span style={darkStyles.typeTag}>
                          {getCategoryIcon(r.type)} {r.type?.toUpperCase()}
                        </span>
                      </td>
                      <td style={darkStyles.td}>
                        {r.expand?.users?.first_name || "Citizen"}
                      </td>
                      <td style={darkStyles.tdMuted}>
                        <MapPin size={12} style={darkStyles.inlineIcon} />
                        {addresses[r.id] || "Locating..."}
                      </td>
                      <td style={darkStyles.tdRight}>
                        <button
                          onClick={() => navigate("/pending-incidents")}
                          style={darkStyles.dispatchBtn}
                        >
                          Dispatch
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* RIGHT COLUMN: ANALYTICS & FLEET WIDGETS */}
          <div style={darkStyles.rightColumnStack}>
            {/* CATEGORY INCIDENT DISTRIBUTION */}
            <div style={darkStyles.panel}>
              <div style={darkStyles.panelHeader}>
                <h2 style={darkStyles.sectionTitle}>
                  <PieIcon size={18} color="#a855f7" /> Incident Breakdown
                </h2>
                <span style={darkStyles.subBadge}>{data.reports.length} Total</span>
              </div>
              <div style={darkStyles.categoryList}>
                {Object.keys(categoryCounts).length === 0 ? (
                  <p style={darkStyles.emptyState}>No categorization data available.</p>
                ) : (
                  Object.entries(categoryCounts).map(([type, count]) => (
                    <div key={type} style={darkStyles.categoryRow}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {getCategoryIcon(type)}
                        <span style={{ textTransform: "uppercase", fontSize: "12px", color: "#cbd5e1", fontWeight: 600 }}>
                          {type}
                        </span>
                      </div>
                      <span style={darkStyles.categoryCountBadge}>{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* FLEET READINESS MONITOR */}
            <div style={darkStyles.panel}>
              <div style={darkStyles.panelHeader}>
                <h2 style={darkStyles.sectionTitle}>
                  <Truck size={18} color="#38bdf8" /> Fleet Readiness
                </h2>
                <span style={darkStyles.subBadgeBlue}>
                  {stats.respondersAvailable} / {data.responders.length || 0} Standby
                </span>
              </div>
              <p style={darkStyles.fleetSubtext}>
                {data.responders.length === 0
                  ? "No responder units registered in system."
                  : `${stats.respondersAvailable} emergency units ready for immediate deployment.`}
              </p>
            </div>

            {/* SYSTEM AUDIT STREAM */}
            <div style={darkStyles.panel}>
              <div style={darkStyles.panelHeader}>
                <h2 style={darkStyles.sectionTitle}>
                  <History size={18} color="#818cf8" /> Live Audit Stream
                </h2>
                <button onClick={() => navigate("/audit")} style={darkStyles.ghostBtn}>
                  Audit Log
                </button>
              </div>
              {data.auditLogs.length === 0 ? (
                <p style={darkStyles.emptyState}>No recent audit records.</p>
              ) : (
                <ul style={darkStyles.auditList}>
                  {data.auditLogs.slice(0, 3).map((log) => (
                    <li key={log.id} style={darkStyles.auditItem}>
                      <Activity size={14} color="#64748b" style={{ flexShrink: 0, marginTop: "2px" }} />
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

const SummaryCard = ({ title, val, icon, accent, urgent, onClick }) => (
  <div
    style={{
      ...darkStyles.card,
      borderTop: `3px solid ${accent}`,
      boxShadow: urgent ? `0 0 15px rgba(239, 68, 68, 0.25)` : "none",
    }}
    onClick={onClick}
  >
    <div style={darkStyles.cardHeader}>
      <span style={darkStyles.cardTitle}>{title}</span>
      {icon}
    </div>
    <p style={{ ...darkStyles.bigNumber, color: urgent ? "#ef4444" : "#f8fafc" }}>{val}</p>
  </div>
);

const darkStyles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#090d16",
    color: "#f8fafc",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  main: {
    marginLeft: "260px",
    flex: 1,
    padding: "32px",
    backgroundColor: "#090d16",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "28px",
  },
  title: { fontSize: "28px", fontWeight: 800, color: "#f8fafc", margin: 0, letterSpacing: "-0.5px" },
  liveTag: {
    backgroundColor: "#1e293b",
    color: "#38bdf8",
    fontSize: "10px",
    fontWeight: 800,
    padding: "3px 8px",
    borderRadius: "4px",
    border: "1px solid #0284c7",
  },
  subtitle: { color: "#64748b", fontSize: "13px", fontWeight: 500, margin: "4px 0 0" },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#052e16",
    border: "1px solid #15803d",
    color: "#4ade80",
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.5px",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#22c55e",
    boxShadow: "0 0 8px #22c55e",
  },
  soundBtnActive: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#1e1b4b",
    border: "1px solid #4338ca",
    color: "#a5b4fc",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
  },
  soundBtnMuted: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#1f2937",
    border: "1px solid #374151",
    color: "#9ca3af",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: 700,
    cursor: "pointer",
  },

  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "28px",
  },
  card: {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "10px",
    padding: "18px",
    cursor: "pointer",
    transition: "transform 0.15s ease",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" },
  bigNumber: { fontSize: "32px", fontWeight: 800, margin: "12px 0 0 0" },

  sosPanel: {
    backgroundColor: "#1f1315",
    border: "1px solid #991b1b",
    borderRadius: "10px",
    padding: "20px",
    marginBottom: "28px",
    boxShadow: "0 4px 20px rgba(153, 27, 27, 0.2)",
  },
  sosHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  sosHeading: { color: "#ef4444", fontSize: "15px", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "8px", letterSpacing: "0.5px" },
  sosViewBtn: {
    background: "none",
    border: "none",
    color: "#ef4444",
    fontWeight: 700,
    fontSize: "12px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },

  splitGrid: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "28px" },
  rightColumnStack: { display: "flex", flexDirection: "column", gap: "28px" },

  panel: {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "10px",
    padding: "20px",
  },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" },
  sectionTitle: { fontSize: "15px", fontWeight: 700, color: "#f8fafc", margin: 0, display: "flex", alignItems: "center", gap: "8px" },
  emptyState: { color: "#64748b", fontSize: "13px", fontStyle: "italic", margin: "10px 0" },

  table: { width: "100%", borderCollapse: "collapse" },
  thRow: { borderBottom: "1px solid #1e293b" },
  th: { textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#64748b", paddingBottom: "10px" },
  thRight: { textAlign: "right", fontSize: "11px", fontWeight: 700, color: "#64748b", paddingBottom: "10px" },
  tr: { borderBottom: "1px solid #020617", height: "50px" },
  td: { fontSize: "13px", color: "#cbd5e1" },
  tdBold: { fontSize: "13px", fontWeight: 700, color: "#f8fafc" },
  tdMuted: { fontSize: "12px", color: "#64748b" },
  tdHighlight: { fontSize: "13px", fontWeight: 700, color: "#ef4444" },
  tdRight: { textAlign: "right" },
  inlineIcon: { display: "inline", verticalAlign: "middle", marginRight: "4px" },

  sosBadge: { backgroundColor: "#450a0a", color: "#fca5a5", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 700 },
  typeTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 700,
  },

  dispatchBtn: {
    padding: "6px 14px",
    backgroundColor: "#38bdf8",
    color: "#090d16",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  sosActionBtn: {
    padding: "6px 14px",
    backgroundColor: "#ef4444",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  ghostBtn: {
    padding: "4px 10px",
    backgroundColor: "transparent",
    border: "1px solid #334155",
    color: "#cbd5e1",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },
  subBadge: { backgroundColor: "#2e1065", color: "#d8b4fe", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 },
  subBadgeBlue: { backgroundColor: "#0c4a6e", color: "#7dd3fc", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 },
  fleetSubtext: { fontSize: "12px", color: "#94a3b8", margin: 0 },

  categoryList: { display: "flex", flexDirection: "column", gap: "10px" },
  categoryRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #1e293b" },
  categoryCountBadge: { backgroundColor: "#1e293b", color: "#f8fafc", padding: "2px 8px", borderRadius: "10px", fontSize: "12px", fontWeight: 700 },

  auditList: { listStyle: "none", padding: 0, margin: 0 },
  auditItem: { display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 0", borderBottom: "1px solid #020617" },
  auditContent: { display: "flex", flexDirection: "column" },
  auditText: { fontSize: "12px", color: "#cbd5e1", margin: 0, fontWeight: 500 },
  auditTime: { fontSize: "10px", color: "#64748b" },
};