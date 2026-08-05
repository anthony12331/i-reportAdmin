import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import SummaryCard from "../components/SummaryCard";
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

  // Derived Dashboard Metrics
  const stats = {
    pending: sortIncidentReportsByPriority(
      data.reports.filter((r) => ["new", "pending"].includes(r.status))
    ),
    ongoing: data.reports.filter((r) =>
      ONGOING_STATUSES.includes(r.status?.toLowerCase())
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


