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
  ClipboardList,
  Shield,
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
          pb.collection("users").getFullList({ fields: "id,status", requestKey: null }),
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
          pendingUsers: users.filter((u) => {
            const s = (u.status || "").toLowerCase().trim();
            return s === "pending" || s === "" || (s !== "verified" && s !== "suspended" && s !== "rejected");
          }).length,
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
    const shouldLogout = await confirm("Are you sure you want to log out of the admin dashboard?", {
      title: "Log Out",
      primaryLabel: "Logout",
      secondaryLabel: "Cancel",
      tone: "app",
    });

    if (!shouldLogout) return;
    
    try {
      pb.realtime.unsubscribe();
    } catch (err) {
      console.log("Realtime unsubscribe error:", err);
    }
    
    pb.authStore.clear();
    navigate("/");
  };

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const adminName = (`${admin?.first_name || ""} ${admin?.last_name || ""}`.trim()) || (admin?.email ? admin.email.split("@")[0] : "Administrator");
  const adminInitial = adminName.charAt(0).toUpperCase();

  return (
    <aside style={styles.sidebar}>
      {/* Brand Header */}
      <div style={styles.brandBox}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
          <img
            src="/icon.ico"
            alt="Lagonglong Emergency logo"
            style={styles.brandLogo}
          />
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a", lineHeight: "1.2" }}>
              Lagonglong
            </h2>
            <span style={{ fontSize: "12px", color: "#15803d", fontWeight: "700", letterSpacing: "0.02em" }}>
              Emergency Command
            </span>
          </div>
        </div>

        <div style={styles.onlineBadge}>
          <span className="live-status-pulse" style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#15803d", display: "inline-block" }} />
          <span>System Online</span>
        </div>
      </div>

      {/* Navigation */}
      <nav ref={navRef} className="sidebarNavNoScroll" style={styles.nav}>
        <p style={styles.sectionTitle}>Main</p>
        <div
          style={isActive("/dashboard") ? styles.navItemActive : styles.navItem}
          onClick={() => navigate("/dashboard")}
        >
          <div style={styles.navLinkGroup}>
            <LayoutDashboard size={17} color={isActive("/dashboard") ? "#15803d" : "#64748b"} />
            <span>Dashboard</span>
          </div>
        </div>

        {hasAccess("incidents") && (
          <>
            <p style={styles.sectionTitle}>Incidents</p>

            <div
              style={isActive("/pending-incidents") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/pending-incidents")}
            >
              <div style={styles.navLinkGroup}>
                <AlertTriangle size={17} color={isActive("/pending-incidents") ? "#15803d" : "#64748b"} />
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
                <Activity size={17} color={isActive("/ongoing-incidents") ? "#15803d" : "#64748b"} />
                <span>Ongoing Incidents</span>
              </div>
              {counts.ongoingIncidents > 0 && (
                <span style={styles.badgeOrange}>{counts.ongoingIncidents}</span>
              )}
            </div>

            <div
              style={location.pathname === "/resolved-incidents" ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/resolved-incidents")}
            >
              <div style={styles.navLinkGroup}>
                <CheckCircle2 size={17} color={location.pathname === "/resolved-incidents" ? "#15803d" : "#64748b"} />
                <span>Resolved Incidents</span>
              </div>
            </div>
            {location.pathname.startsWith("/resolved-incidents/") && (
              <div
                style={styles.subNavItemActive}
                onClick={() => navigate("/resolved-incidents")}
              >
                <div style={styles.navLinkGroup}>
                  <ClipboardList size={15} />
                  <span>Incident Details</span>
                </div>
              </div>
            )}

            <div
              style={isActive("/request-backup") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/request-backup")}
            >
              <div style={styles.navLinkGroup}>
                <ShieldCheck size={17} color={isActive("/request-backup") ? "#15803d" : "#64748b"} />
                <span>Request Backup</span>
              </div>
              {counts.pendingBackups > 0 && <span style={styles.badgeRed}>{counts.pendingBackups}</span>}
            </div>

            <div
              style={isActive("/ongoing-backup") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/ongoing-backup")}
            >
              <div style={styles.navLinkGroup}>
                <Activity size={17} color={isActive("/ongoing-backup") ? "#15803d" : "#64748b"} />
                <span>Ongoing Backup</span>
              </div>
              {counts.ongoingBackups > 0 && <span style={styles.badgeOrange}>{counts.ongoingBackups}</span>}
            </div>
          </>
        )}

        {hasAccess("sos") && (
          <>
            <p style={styles.sectionTitle}>SOS Alerts</p>
            <div
              style={isActive("/pending-sos") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/pending-sos")}
            >
              <div style={styles.navLinkGroup}>
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    ...(counts.pendingSos > 0
                      ? {
                          backgroundColor: "#fef2f2",
                          border: "1px solid #fecaca",
                        }
                      : {}),
                  }}
                  className={counts.pendingSos > 0 ? "urgent-status-pulse" : ""}
                >
                  <Radio
                    size={14}
                    color={counts.pendingSos > 0 ? "#dc2626" : isActive("/pending-sos") ? "#15803d" : "#64748b"}
                  />
                </div>
                <span style={counts.pendingSos > 0 ? { color: "#dc2626", fontWeight: "800" } : {}}>
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
            <p style={styles.sectionTitle}>User Registry</p>
            <div
              style={isActive("/pending-users") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/pending-users")}
            >
              <div style={styles.navLinkGroup}>
                <Users size={17} color={isActive("/pending-users") ? "#15803d" : "#64748b"} />
                <span>Pending Verification</span>
              </div>
              {counts.pendingUsers > 0 && (
                <span style={styles.badgeGreen}>{counts.pendingUsers}</span>
              )}
            </div>

            <div
              style={location.pathname === "/verified-users" ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/verified-users")}
            >
              <div style={styles.navLinkGroup}>
                <ShieldCheck size={17} color={location.pathname === "/verified-users" ? "#15803d" : "#64748b"} />
                <span>Verified Users</span>
              </div>
            </div>
            {location.pathname.startsWith("/verified-users/") && (
              <div
                style={styles.subNavItemActive}
                onClick={() => navigate("/verified-users")}
              >
                <div style={styles.navLinkGroup}>
                  <ClipboardList size={15} />
                  <span>User Details</span>
                </div>
              </div>
            )}
          </>
        )}

        {hasAccess("reports") && (
          <>
            <p style={styles.sectionTitle}>Analytics</p>
            <div
              style={isActive("/reports") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/reports")}
            >
              <div style={styles.navLinkGroup}>
                <BarChart3 size={17} color={isActive("/reports") ? "#15803d" : "#64748b"} />
                <span>Generate Reports</span>
              </div>
            </div>
          </>
        )}

        {hasAccess("pins") && (
          <>
            <p style={styles.sectionTitle}>Access</p>
            <div
              style={isActive("/responder-pins") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/responder-pins")}
            >
              <div style={styles.navLinkGroup}>
                <KeyRound size={17} color={isActive("/responder-pins") ? "#15803d" : "#64748b"} />
                <span>Responder PINs</span>
              </div>
            </div>
          </>
        )}

        {isSuperAdmin && (
          <>
            <p style={styles.sectionTitle}>Administration</p>
            <div
              style={isActive("/manage-admins") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/manage-admins")}
            >
              <div style={styles.navLinkGroup}>
                <Shield size={17} color={isActive("/manage-admins") ? "#15803d" : "#64748b"} />
                <span>Manage Admins</span>
              </div>
            </div>

            <div
              style={isActive("/rbac-settings") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/rbac-settings")}
            >
              <div style={styles.navLinkGroup}>
                <Settings size={17} color={isActive("/rbac-settings") ? "#15803d" : "#64748b"} />
                <span>Access Control</span>
              </div>
            </div>

            <div
              style={isActive("/audit-logs") ? styles.navItemActive : styles.navItem}
              onClick={() => navigate("/audit-logs")}
            >
              <div style={styles.navLinkGroup}>
                <History size={17} color={isActive("/audit-logs") ? "#15803d" : "#64748b"} />
                <span>Audit Logs</span>
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Admin Profile & Logout Footer */}
      <div style={styles.logoutSection}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #15803d 0%, #166534 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "13px",
              fontWeight: "800",
              flexShrink: 0,
            }}
          >
            {adminInitial}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {adminName}
            </span>
            <span style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#64748b" }}>
              {isSuperAdmin ? "Super Admin" : "Officer"}
            </span>
          </div>
        </div>

        <button className="sidebarLogoutBtn" onClick={handleLogout} style={styles.logoutBtn}>
          <LogOut size={14} /> <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "216px",
    backgroundColor: "#ffffff",
    borderRight: "1px solid #eef2f6",
    color: "#0f172a",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    height: "100vh",
    left: 0,
    top: 0,
    zIndex: 1000,
    overflow: "hidden",
    boxShadow: "2px 0 14px rgba(15, 23, 42, 0.03)",
  },
  brandBox: {
    padding: "20px 16px 16px",
    borderBottom: "1px solid #f1f5f9",
    backgroundColor: "#ffffff",
  },
  brandLogo: {
    width: "36px",
    height: "36px",
    display: "block",
    borderRadius: "8px",
  },
  onlineBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "3px 8px",
    borderRadius: "12px",
    backgroundColor: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#15803d",
    fontSize: "10.5px",
    fontWeight: "700",
    letterSpacing: "0.02em",
  },
  nav: {
    flex: 1,
    padding: "12px 10px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    overflowY: "auto",
  },
  sectionTitle: {
    padding: "14px 10px 6px",
    fontSize: "10.5px",
    color: "#94a3b8",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    margin: 0,
  },
  navItem: {
    padding: "9px 12px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: "10px",
    transition: "all 0.16s ease",
    color: "#475569",
    fontSize: "13px",
    fontWeight: "600",
  },
  navItemActive: {
    padding: "9px 12px",
    backgroundColor: "#f0fdf4",
    color: "#15803d",
    fontWeight: "800",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: "10px",
    fontSize: "13px",
    transition: "all 0.16s ease",
    borderLeft: "3px solid #15803d",
  },
  subNavItem: {
    padding: "7px 12px 7px 32px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    borderRadius: "8px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "500",
  },
  subNavItemActive: {
    padding: "7px 12px 7px 32px",
    backgroundColor: "#f0fdf4",
    color: "#15803d",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    borderRadius: "8px",
    fontSize: "12px",
  },
  navLinkGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },
  badgeRed: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    fontSize: "11px",
    minWidth: "19px",
    height: "19px",
    padding: "0 5px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
  },
  badgeOrange: {
    backgroundColor: "#fef3c7",
    color: "#b45309",
    border: "1px solid #fde68a",
    fontSize: "11px",
    minWidth: "19px",
    height: "19px",
    padding: "0 5px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
  },
  badgeGreen: {
    backgroundColor: "#f0fdf4",
    color: "#15803d",
    border: "1px solid #bbf7d0",
    fontSize: "11px",
    minWidth: "19px",
    height: "19px",
    padding: "0 5px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
  },
  logoutSection: {
    padding: "14px 14px 16px",
    borderTop: "1px solid #f1f5f9",
    backgroundColor: "#fcfdfd",
    marginTop: "auto",
  },
  logoutBtn: {
    width: "100%",
    padding: "8px 12px",
    backgroundColor: "#ffffff",
    color: "#dc2626",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "all 0.18s ease",
  },
};
