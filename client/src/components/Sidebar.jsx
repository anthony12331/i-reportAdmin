import { useEffect, useState, useRef } from "react";
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
  KeyRound,
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
    pendingBackups: 0,
    ongoingBackups: 0,
  });

  const isSuperAdmin = admin?.collectionName === "super_admins" || admin?.collectionName === "_superusers";
  const hasAccess = (moduleName) => {
    return isSuperAdmin || (admin?.permissions || []).includes(moduleName);
  };

  const navRef = useRef(null);

  useEffect(() => {
    const savedScroll = sessionStorage.getItem("sidebarScrollPos");
    if (navRef.current && savedScroll) {
      navRef.current.scrollTop = parseInt(savedScroll, 10);
    }

    const handleScroll = () => {
      if (navRef.current) {
        sessionStorage.setItem("sidebarScrollPos", navRef.current.scrollTop);
      }
    };

    const navEl = navRef.current;
    if (navEl) {
      navEl.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (navEl) {
        navEl.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let unsubIncidentsFn = null;
    let unsubUsersFn = null;
    let unsubSosFn = null;
    let unsubDispatchesFn = null;
    let unsubBackupsFn = null;

    const fetchCounts = async () => {
      try {
        const [reports, users, sos, allDispatches, backups] = await Promise.all([
          pb.collection("incident_reports").getFullList({ filter: 'status != "resolved" && status != "false_alarm"', fields: "id,status", requestKey: null }),
          pb.collection("users").getFullList({ filter: 'status = "pending"', fields: "id,status", requestKey: null }),
          pb.collection("sos_tracking").getFullList({ filter: 'status != "resolved"', fields: "id,status,dispatch_status", requestKey: null }),
          pb.collection("dispatches").getFullList({ filter: 'status != "resolved"', fields: "incident_id,sos_id,status", requestKey: null }),
          pb.collection("backup_requests").getFullList({ filter: 'dispatch_status != "completed" && dispatch_status != "declined"', fields: "id,dispatch_status", requestKey: null })
        ]);

        if (!isMounted) return;

        const activeDispatches = allDispatches.filter(d => d.status?.toLowerCase() !== "resolved");
        const activeIncidentIds = new Set(activeDispatches.map(d => d.incident_id).filter(id => id));
        const activeSosIds = new Set(activeDispatches.map(d => d.sos_id).filter(id => id));

        setLiveCounts({
          pendingIncidents: reports.filter((r) => r.status === "new" || r.status === "pending").length,
          ongoingIncidents: reports.filter((r) => ONGOING_STATUSES.includes(r.status?.toLowerCase()) || activeIncidentIds.has(r.id)).length,
          pendingUsers: users.filter((u) => u.status === "pending").length,
          pendingSos: sos.filter((s) => s.status?.toLowerCase() !== "resolved" || activeSosIds.has(s.id)).length,
          pendingBackups: backups.filter((b) => b.dispatch_status === "pending").length,
          ongoingBackups: backups.filter((b) => b.dispatch_status !== "pending" && b.dispatch_status !== "completed" && b.dispatch_status !== "declined").length,
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
      unsubDispatchesFn = await pb.collection("dispatches").subscribe("*", debouncedFetchCounts);
      unsubBackupsFn = await pb.collection("backup_requests").subscribe("*", debouncedFetchCounts);
    };

    startSubscriptions();

    return () => {
      isMounted = false;
      clearTimeout(fetchTimeout);
      if (typeof unsubIncidentsFn === "function") unsubIncidentsFn();
      if (typeof unsubUsersFn === "function") unsubUsersFn();
      if (typeof unsubSosFn === "function") unsubSosFn();
      if (typeof unsubDispatchesFn === "function") unsubDispatchesFn();
      if (typeof unsubBackupsFn === "function") unsubBackupsFn();
    };
  }, []);

  const counts = {
    pendingIncidents: typeof pendingIncidentsCount === "number" ? pendingIncidentsCount : liveCounts.pendingIncidents,
    ongoingIncidents: typeof ongoingIncidentsCount === "number" ? ongoingIncidentsCount : liveCounts.ongoingIncidents,
    pendingUsers: typeof pendingUsersCount === "number" ? pendingUsersCount : liveCounts.pendingUsers,
    pendingSos: liveCounts.pendingSos,
    pendingBackups: liveCounts.pendingBackups,
    ongoingBackups: liveCounts.ongoingBackups,
  };

  const handleLogout = async () => {
    const shouldLogout = await confirm("Are you sure you want to logout?", {
      title: "Confirm Logout",
      primaryLabel: "Yes",
      secondaryLabel: "No",
    });

    if (!shouldLogout) return;
    
    // Unsubscribe from realtime events before logging out to prevent 403 errors
    try {
      pb.realtime.unsubscribe();
    } catch (err) {
      console.log("Realtime unsubscribe error:", err);
    }
    
    pb.authStore.clear();
    navigate("/");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <aside style={styles.sidebar}>
      <div style={styles.brandBox}>
        <img
          src="/icon.ico"
          alt="Lagonglong Emergency logo"
          style={styles.brandLogo}
        />
        <h2 style={{ margin: 0, fontSize: "20px", lineHeight: "1.2" }}>
          Lagonglong
          <br />
          Emergency
        </h2>
        <div style={styles.onlineBadge}>● System Online</div>
      </div>

      <nav ref={navRef} className="sidebarNavNoScroll" style={styles.nav}>
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

            <div
              style={isActive("/request-backup") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/request-backup")}
            >
              <div style={styles.navLinkGroup}>
                <ShieldCheck size={18} />
                <span>Request Backup</span>
              </div>
              {counts.pendingBackups > 0 && <span style={styles.badgeRed}>{counts.pendingBackups}</span>}
            </div>

            <div
              style={isActive("/ongoing-backup") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/ongoing-backup")}
            >
              <div style={styles.navLinkGroup}>
                <Activity size={18} />
                <span>Ongoing Backup</span>
              </div>
              {counts.ongoingBackups > 0 && <span style={styles.badgeOrange}>{counts.ongoingBackups}</span>}
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

        {hasAccess("pins") && (
          <>
            <p style={styles.sectionTitle}>ACCESS CONTROL</p>
            <div
              style={isActive("/responder-pins") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/responder-pins")}
            >
              <div style={styles.navLinkGroup}>
                <KeyRound size={18} />
                <span>Responder PINs</span>
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
      </nav>

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
          <button className="sidebarLogoutBtn" onClick={handleLogout} style={styles.logoutBtn}>
            <LogOut size={16} /> Logout
          </button>
        </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "216px",
    backgroundColor: "#ffffff",
    borderRight: "1px solid #d7e5da",
    color: "#111111",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    height: "100vh",
    left: 0,
    top: 0,
    zIndex: 1000,
    overflow: "hidden",
    boxShadow: "2px 0 12px rgba(24, 95, 53, 0.04)",
  },
  brandBox: { padding: "22px 18px 20px", borderBottom: "1px solid #edf3ee" },
  brandLogo: {
    width: "44px",
    height: "44px",
    display: "block",
    marginBottom: "12px",
  },
  onlineBadge: {
    fontSize: "9px",
    color: "#18864b",
    marginTop: "12px",
    fontWeight: "600",
    letterSpacing: "2px",
    textTransform: "uppercase",
  },
  nav: {
    flex: 1,
    padding: "16px 0",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  },
  sectionTitle: {
    padding: "0 18px",
    fontSize: "9px",
    color: "#7a9a83",
    fontWeight: "700",
    marginTop: "32px",
    marginBottom: "16px",
    textTransform: "uppercase",
    letterSpacing: "3px",
  },
  navItem: {
    padding: "11px 18px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    transition: "all 0.4s ease",
    color: "#53645a",
    fontSize: "12px",
    fontWeight: "500",
    letterSpacing: "0.5px",
    borderLeft: "2px solid transparent",
  },
  navItemActive: {
    padding: "11px 18px",
    backgroundColor: "#e7f5eb",
    color: "#18864b",
    fontWeight: "500",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "12px",
    transition: "all 0.4s ease",
    borderLeft: "3px solid #18864b",
    letterSpacing: "0.5px",
  },
  navLinkGroup: { display: "flex", alignItems: "center", gap: "12px" },
  badgeRed: {
    backgroundColor: "transparent",
    color: "#ef4444",
    fontSize: "10px",
    padding: "0",
    fontWeight: "700",
  },
  badgeOrange: {
    backgroundColor: "transparent",
    color: "#18864b",
    fontSize: "10px",
    padding: "0",
    fontWeight: "700",
  },
  badgeBlue: {
    backgroundColor: "transparent",
    color: "#18864b",
    fontSize: "10px",
    padding: "0",
    fontWeight: "700",
  },
  logoutSection: {
    padding: "18px",
    borderTop: "1px solid #edf3ee",
    backgroundColor: "transparent",
    marginTop: "auto",
  },
  logoutBtn: {
    width: "100%",
    padding: "11px 16px",
    backgroundColor: "#ffffff",
    color: "#18864b",
    border: "1px solid #b8d7c1",
    borderRadius: "7px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "2px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    transition: "all 0.4s ease",
  },
};


