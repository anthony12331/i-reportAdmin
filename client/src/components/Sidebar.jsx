import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { pb } from "../config/pocketbase";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Activity,
  CheckCircle2,
  LogOut,
  ShieldCheck,
  Radio,
  Settings,
  BarChart3,
  History,
} from "lucide-react";
import { useMessageBox } from "./MessageBox";

const ONGOING_STATUSES = ["ongoing", "accepted", "en_route", "at_scene", "dispatched"];

export default function Sidebar({
  pendingIncidentsCount,
  ongoingIncidentsCount,
  pendingUsersCount,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const admin = pb.authStore.model;
  const { confirm } = useMessageBox();

  const [liveCounts, setLiveCounts] = useState({
    pendingIncidents: 0,
    ongoingIncidents: 0,
    pendingUsers: 0,
    pendingSos: 0,
  });

  const isSuperAdmin = admin?.collectionName === "super_admins" || admin?.collectionName === "_superusers";
  const hasAccess = (moduleName) => {
    return isSuperAdmin || (admin?.permissions || []).includes(moduleName);
  };

  useEffect(() => {
    let isMounted = true;
    let unsubIncidentsFn = null;
    let unsubUsersFn = null;
    let unsubSosFn = null;

    const fetchCounts = async () => {
      try {
        const [reports, users, sos] = await Promise.all([
          pb.collection("incident_reports").getFullList({ fields: "id,status", requestKey: null }),
          pb.collection("users").getFullList({ fields: "id,status", requestKey: null }),
          pb.collection("sos_tracking").getFullList({ fields: "id,status", requestKey: null }),
        ]);

        if (!isMounted) return;

        setLiveCounts({
          pendingIncidents: reports.filter((r) => r.status === "new" || r.status === "pending").length,
          ongoingIncidents: reports.filter((r) => ONGOING_STATUSES.includes(r.status?.toLowerCase())).length,
          pendingUsers: users.filter((u) => u.status === "pending").length,
          pendingSos: sos.filter((s) => s.status !== "resolved").length,
        });
      } catch (error) {
        if (!error.isAbort) console.error("Sidebar count error:", error);
      }
    };

    let fetchTimeout;
    const debouncedFetchCounts = () => {
      clearTimeout(fetchTimeout);
      fetchTimeout = setTimeout(fetchCounts, 400);
    };

    const startSubscriptions = async () => {
      await fetchCounts();
      if (!isMounted) return;

      unsubIncidentsFn = await pb.collection("incident_reports").subscribe("*", debouncedFetchCounts);
      unsubUsersFn = await pb.collection("users").subscribe("*", debouncedFetchCounts);
      unsubSosFn = await pb.collection("sos_tracking").subscribe("*", debouncedFetchCounts);
    };

    startSubscriptions();

    return () => {
      isMounted = false;
      clearTimeout(fetchTimeout);
      if (typeof unsubIncidentsFn === "function") unsubIncidentsFn();
      if (typeof unsubUsersFn === "function") unsubUsersFn();
      if (typeof unsubSosFn === "function") unsubSosFn();
    };
  }, []);

  const counts = {
    pendingIncidents: typeof pendingIncidentsCount === "number" ? pendingIncidentsCount : liveCounts.pendingIncidents,
    ongoingIncidents: typeof ongoingIncidentsCount === "number" ? ongoingIncidentsCount : liveCounts.ongoingIncidents,
    pendingUsers: typeof pendingUsersCount === "number" ? pendingUsersCount : liveCounts.pendingUsers,
    pendingSos: liveCounts.pendingSos,
  };

  const handleLogout = async () => {
    const shouldLogout = await confirm("Are you sure you want to logout from the command center?", {
      title: "Confirm Logout",
      primaryLabel: "Logout",
      secondaryLabel: "Stay Signed In",
    });

    if (!shouldLogout) return;
    pb.authStore.clear();
    navigate("/");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <aside style={styles.sidebar}>
      <div style={styles.brandBox}>
        <h2 style={{ margin: 0, fontSize: "20px", lineHeight: "1.2" }}>
          Lagonglong
          <br />
          Emergency
        </h2>
        <div style={styles.onlineBadge}>● System Online</div>
      </div>

      <nav className="sidebarNavNoScroll" style={styles.nav}>
        <p style={styles.sectionTitle}>MAIN</p>
        <div
          style={isActive("/dashboard") ? styles.navItemActive : styles.navItem}
          onClick={() => navigate("/dashboard")}
        >
          <div style={styles.navLinkGroup}>
            <LayoutDashboard size={18} />
            <span>Dashboard Overview</span>
          </div>
        </div>

        {hasAccess("incidents") && (
          <>
            <p style={styles.sectionTitle}>INCIDENT MANAGEMENT</p>

            <div
              style={isActive("/pending-incidents") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/pending-incidents")}
            >
              <div style={styles.navLinkGroup}>
                <AlertTriangle size={18} />
                <span>Pending Reports</span>
              </div>
              {counts.pendingIncidents > 0 && (
                <span style={styles.badgeRed}>{counts.pendingIncidents}</span>
              )}
            </div>

            <div
              style={isActive("/ongoing-incidents") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/ongoing-incidents")}
            >
              <div style={styles.navLinkGroup}>
                <Activity size={18} />
                <span>Ongoing Incidents</span>
              </div>
              {counts.ongoingIncidents > 0 && (
                <span style={styles.badgeOrange}>{counts.ongoingIncidents}</span>
              )}
            </div>

            <div
              style={isActive("/resolved-incidents") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/resolved-incidents")}
            >
              <div style={styles.navLinkGroup}>
                <CheckCircle2 size={18} />
                <span>Resolved Incidents</span>
              </div>
            </div>
          </>
        )}

        {hasAccess("sos") && (
          <>
            <p style={styles.sectionTitle}>SOS MANAGEMENT</p>
            <div
              style={isActive("/pending-sos") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/pending-sos")}
            >
              <div style={styles.navLinkGroup}>
                <Radio
                  size={18}
                  className={counts.pendingSos > 0 ? "animate-pulse" : ""}
                />
                <span style={counts.pendingSos > 0 ? { color: "#f87171", fontWeight: "bold" } : {}}>
                  Live SOS Alerts
                </span>
              </div>
              {counts.pendingSos > 0 && (
                <span style={styles.badgeRed}>{counts.pendingSos}</span>
              )}
            </div>
          </>
        )}

        {hasAccess("users") && (
          <>
            <p style={styles.sectionTitle}>USER MANAGEMENT</p>
            <div
              style={isActive("/pending-users") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/pending-users")}
            >
              <div style={styles.navLinkGroup}>
                <Users size={18} />
                <span>Pending Verification</span>
              </div>
              {counts.pendingUsers > 0 && (
                <span style={styles.badgeBlue}>{counts.pendingUsers}</span>
              )}
            </div>

            <div
              style={isActive("/verified-users") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/verified-users")}
            >
              <div style={styles.navLinkGroup}>
                <ShieldCheck size={18} />
                <span>Verified Users</span>
              </div>
            </div>
          </>
        )}

        {hasAccess("reports") && (
          <>
            <p style={styles.sectionTitle}>DATA & ANALYTICS</p>
            <div
              style={isActive("/reports") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/reports")}
            >
              <div style={styles.navLinkGroup}>
                <BarChart3 size={18} />
                <span>Generate Reports</span>
              </div>
            </div>
          </>
        )}

        {isSuperAdmin && (
          <>
            <p style={styles.sectionTitle}>SUPER ADMIN</p>
            <div
              style={isActive("/manage-admins") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/manage-admins")}
            >
              <div style={styles.navLinkGroup}>
                <ShieldCheck size={18} />
                <span>Manage Admins</span>
              </div>
            </div>

            <div
              style={isActive("/rbac-settings") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/rbac-settings")}
            >
              <div style={styles.navLinkGroup}>
                <Settings size={18} />
                <span>Access Control</span>
              </div>
            </div>

            <div
              style={isActive("/audit-logs") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/audit-logs")}
            >
              <div style={styles.navLinkGroup}>
                <History size={18} />
                <span>Audit Logs</span>
              </div>
            </div>
          </>
        )}

        <p style={styles.sectionTitle}>SYSTEM</p>
        <div style={styles.logoutSection}>
          <p
            style={{
              fontSize: "12px",
              color: "#888",
              marginBottom: "10px",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Logged in as: <b>{(`${admin?.first_name || ''} ${admin?.last_name || ''}`.trim()) || "Admin"}</b>
          </p>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </nav>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "260px",
    backgroundColor: "#1a1c23",
    color: "white",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    height: "100%",
    left: 0,
    top: 0,
    zIndex: 1000,
  },
  brandBox: { padding: "25px 20px", borderBottom: "1px solid #2e303e" },
  onlineBadge: {
    fontSize: "11px",
    color: "#4caf50",
    marginTop: "5px",
    fontWeight: "bold",
    letterSpacing: "0.5px",
  },
  nav: {
    flex: 1,
    padding: "10px 0",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  },
  sectionTitle: {
    padding: "0 20px",
    fontSize: "10px",
    color: "#6b7280",
    fontWeight: "bold",
    marginTop: "25px",
    marginBottom: "10px",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  navItem: {
    padding: "12px 20px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    transition: "0.2s",
    color: "#9ca3af",
    fontSize: "14px",
  },
  navItemActive: {
    padding: "12px 20px",
    backgroundColor: "#2e303e",
    color: "white",
    borderLeft: "4px solid #3b82f6",
    fontWeight: "bold",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "14px",
  },
  navLinkGroup: { display: "flex", alignItems: "center", gap: "12px" },
  badgeRed: {
    backgroundColor: "#d32f2f",
    color: "white",
    fontSize: "11px",
    padding: "2px 8px",
    borderRadius: "10px",
    fontWeight: "bold",
  },
  badgeOrange: {
    backgroundColor: "#ff9800",
    color: "white",
    fontSize: "11px",
    padding: "2px 8px",
    borderRadius: "10px",
    fontWeight: "bold",
  },
  badgeBlue: {
    backgroundColor: "#3b82f6",
    color: "white",
    fontSize: "11px",
    padding: "2px 8px",
    borderRadius: "10px",
    fontWeight: "bold",
  },
  logoutSection: {
    padding: "20px",
    borderTop: "1px solid #2e303e",
    backgroundColor: "#131419",
    marginTop: "auto",
  },
  logoutBtn: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#d32f2f",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "0.2s",
  },
};

