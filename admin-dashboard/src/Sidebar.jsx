import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { pb } from "./pocketbase";
// 
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

  // --- RBAC Access Control Check ---
  const isSuperAdmin = admin?.collectionName === "super_admins";
  const hasAccess = (moduleName) => {
    return isSuperAdmin || (admin?.permissions || []).includes(moduleName);
  };

  useEffect(() => {
    let isMounted = true;
    let unsubscribeIncidents;
    let unsubscribeUsers;
    let unsubscribeSos;

    const fetchCounts = async () => {
      try {
        const [reports, users, sos] = await Promise.all([
          pb
            .collection("incident_reports")
            .getFullList({ fields: "id,status", requestKey: null }),
          pb
            .collection("users")
            .getFullList({ fields: "id,status", requestKey: null }),
          pb
            .collection("sos_tracking")
            .getFullList({ fields: "id,status", requestKey: null }),
        ]);

        if (!isMounted) return;

        setLiveCounts({
          pendingIncidents: reports.filter(
            (report) => report.status === "new" || report.status === "pending",
          ).length,
         ongoingIncidents: reports.filter(
            (report) =>
              report.status === "ongoing" ||
              report.status === "dispatched" ||
              report.status === "accepted",
          ).length,
          pendingUsers: users.filter((user) => user.status === "pending")
            .length,
          pendingSos: sos.filter((s) => s.status !== "resolved").length,
        });
      } catch (error) {
        if (!error.isAbort) console.error("Sidebar count error:", error);
      }
    };

    let fetchTimeout;
    const debouncedFetchCounts = () => {
      clearTimeout(fetchTimeout);
      fetchTimeout = setTimeout(fetchCounts, 1000);
    };

    const startSubscriptions = async () => {
      fetchCounts();
      unsubscribeIncidents = await pb
        .collection("incident_reports")
        .subscribe("*", debouncedFetchCounts);
      unsubscribeUsers = await pb
        .collection("users")
        .subscribe("*", debouncedFetchCounts);
      unsubscribeSos = await pb
        .collection("sos_tracking")
        .subscribe("*", debouncedFetchCounts);
    };

    startSubscriptions();

    return () => {
      isMounted = false;
      unsubscribeIncidents?.();
      unsubscribeUsers?.();
      unsubscribeSos?.();
    };
  }, []);

  const counts = {
    pendingIncidents: pendingIncidentsCount ?? liveCounts.pendingIncidents,
    ongoingIncidents: ongoingIncidentsCount ?? liveCounts.ongoingIncidents,
    pendingUsers: pendingUsersCount ?? liveCounts.pendingUsers,
    pendingSos: liveCounts.pendingSos,
  };

  const handleLogout = async () => {
    const shouldLogout = await confirm(
      "Are you sure you want to logout from the command center?",
      {
        title: "Confirm Logout",
        primaryLabel: "Logout",
        secondaryLabel: "Stay Signed In",
      },
    );

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
        {/* DASHBOARD - Always visible to logged in users */}
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

        {/* INCIDENTS MODULE - RBAC Protected */}
        {hasAccess("incidents") && (
          <>
            <p style={styles.sectionTitle}>INCIDENT MANAGEMENT</p>

            <div
              style={
                isActive("/pending-incidents")
                  ? styles.navItemActive
                  : styles.navItem
              }
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
              style={
                isActive("/ongoing-incidents")
                  ? styles.navItemActive
                  : styles.navItem
              }
              onClick={() => navigate("/ongoing-incidents")}
            >
              <div style={styles.navLinkGroup}>
                <Activity size={18} />
                <span>Ongoing Incidents</span>
              </div>
              {counts.ongoingIncidents > 0 && (
                <span style={styles.badgeOrange}>
                  {counts.ongoingIncidents}
                </span>
              )}
            </div>

            <div
              style={
                isActive("/resolved-incidents")
                  ? styles.navItemActive
                  : styles.navItem
              }
              onClick={() => navigate("/resolved-incidents")}
            >
              <div style={styles.navLinkGroup}>
                <CheckCircle2 size={18} />
                <span>Resolved Incidents</span>
              </div>
            </div>
          </>
        )}

        {/* SOS MODULE - RBAC Protected */}
        {hasAccess("sos") && (
          <>
            <p style={styles.sectionTitle}>SOS MANAGEMENT</p>
            <div
              style={
                isActive("/pending-sos") ? styles.navItemActive : styles.navItem
              }
              onClick={() => navigate("/pending-sos")}
            >
              <div style={styles.navLinkGroup}>
                <Radio
                  size={18}
                  className={counts.pendingSos > 0 ? "animate-pulse" : ""}
                />
                <span
                  style={
                    counts.pendingSos > 0
                      ? { color: "#f87171", fontWeight: "bold" }
                      : {}
                  }
                >
                  Live SOS Alerts
                </span>
              </div>
              {counts.pendingSos > 0 && (
                <span style={styles.badgeRed}>{counts.pendingSos}</span>
              )}
            </div>
          </>
        )}

        {/* USERS MODULE - RBAC Protected */}
        {hasAccess("users") && (
          <>
            <p style={styles.sectionTitle}>USER MANAGEMENT</p>

            <div
              style={
                isActive("/pending-users")
                  ? styles.navItemActive
                  : styles.navItem
              }
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
              style={
                isActive("/verified-users")
                  ? styles.navItemActive
                  : styles.navItem
              }
              onClick={() => navigate("/verified-users")}
            >
              <div style={styles.navLinkGroup}>
                <ShieldCheck size={18} />
                <span>Verified Users</span>
              </div>
            </div>
          </>
        )}

        {/* REPORTS MODULE - RBAC Protected */}
        {hasAccess("reports") && (
          <>
            <p style={styles.sectionTitle}>DATA & ANALYTICS</p>
            <div
              style={
                isActive("/reports") ? styles.navItemActive : styles.navItem
              }
              onClick={() => navigate("/reports")}
            >
              <div style={styles.navLinkGroup}>
                <BarChart3 size={18} />
                <span>Generate Reports</span>
              </div>
            </div>
          </>
        )}

        {/* SUPER ADMIN ONLY - RBAC Settings */}
        {isSuperAdmin && (
          <>
            <p style={styles.sectionTitle}>SUPER ADMIN</p>
            <div
              style={
                isActive("/rbac-settings")
                  ? styles.navItemActive
                  : styles.navItem
              }
              onClick={() => navigate("/rbac-settings")}
            >
              <div style={styles.navLinkGroup}>
                <Settings size={18} />
                <span>Access Control</span>
              </div>
            </div>

            {/* ---> START: ADD AUDIT LOGS HERE <--- */}
            <div
              style={
                isActive("/audit-logs")
                  ? styles.navItemActive
                  : styles.navItem
              }
              onClick={() => navigate("/audit-logs")}
            >
              <div style={styles.navLinkGroup}>
                <History size={18} />
                <span>Audit Logs</span>
              </div>
            </div>
            {/* ---> END: ADD AUDIT LOGS HERE <--- */}
          </>
        )}

        {/* SYSTEM / LOGOUT - Always visible */}
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
            Logged in as: <b>{admin?.username || "Admin"}</b>
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
