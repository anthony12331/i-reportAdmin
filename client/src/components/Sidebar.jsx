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
  Menu,
  Map,
} from "lucide-react";
import { useMessageBox } from "./MessageBox";
import { ThemeSwitch, useTheme } from "../themes/ThemeContext";
import { addAuditLog } from "../utils/auditLog";

const ONGOING_STATUSES = ["ongoing", "accepted", "en_route", "at_scene", "dispatched"];

export default function Sidebar({
  pendingIncidentsCount,
  ongoingIncidentsCount,
  pendingUsersCount,
}) {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const admin = pb.authStore.model;
  const { confirm, alert } = useMessageBox();

  const [isHidden, setIsHidden] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.innerWidth <= 1024) {
        return true;
      }
      return localStorage.getItem("sidebar_hidden") === "true";
    } catch {
      return false;
    }
  });

  // Auto-close sidebar on mobile/tablet when navigating to any route
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth <= 1024) {
      setIsHidden(true);
    }
  }, [location.pathname]);

  // Handle Escape key to close sidebar on mobile
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isHidden && typeof window !== "undefined" && window.innerWidth <= 1024) {
        setIsHidden(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHidden]);

  const lastAlertTime = useRef(0);

  // Background Hazard Polling (Runs every 10 minutes)
  useEffect(() => {
    let interval;

    const checkHazards = async () => {
      // Prevent spamming alerts (only alert once every 6 hours max)
      if (Date.now() - lastAlertTime.current < 6 * 60 * 60 * 1000) return;

      try {
        // 1. Check Weather
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=8.8066&longitude=124.7880&current=precipitation,wind_speed_10m`);
        const weatherData = await weatherRes.json();

        if (weatherData?.current) {
          if (weatherData.current.precipitation > 15 || weatherData.current.wind_speed_10m > 60) {
            lastAlertTime.current = Date.now();
            alert(`SEVERE WEATHER WARNING FOR LAGONGLONG: High winds/rain detected. Prepare MDRRMO units!`, { title: "Calamity Alert" });
            return;
          }
        }

        // 2. Check Earthquakes (within 100km radius basically)
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const dateStr = d.toISOString().split('T')[0];
        const quakeRes = await fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${dateStr}&minlatitude=6.0&maxlatitude=10.0&minlongitude=123.0&maxlongitude=127.0&minmagnitude=5.0`);
        const quakeData = await quakeRes.json();

        if (quakeData?.features?.length > 0) {
          const latest = quakeData.features[0];
          lastAlertTime.current = Date.now();
          alert(`EARTHQUAKE ALERT: Magnitude ${latest.properties.mag} earthquake detected near Mindanao. Check Lagonglong status.`, { title: "Seismic Alert" });
        }
      } catch (err) {
        // Silent fail for background checker
      }
    };

    // Run once on mount after 5 seconds, then every 10 minutes
    const initialTimer = setTimeout(checkHazards, 5000);
    interval = setInterval(checkHazards, 10 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [alert]);

  useEffect(() => {
    if (isHidden) {
      document.documentElement.classList.add("sidebar-hidden");
      try {
        localStorage.setItem("sidebar_hidden", "true");
      } catch { }
    } else {
      document.documentElement.classList.remove("sidebar-hidden");
      try {
        localStorage.setItem("sidebar_hidden", "false");
      } catch { }
    }

    // Trigger resize events so Leaflet map canvas updates smoothly
    window.dispatchEvent(new Event("resize"));
    const t1 = setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
    const t2 = setTimeout(() => window.dispatchEvent(new Event("resize")), 200);
    const t3 = setTimeout(() => window.dispatchEvent(new Event("resize")), 320);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isHidden]);

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
      fetchTimeout = setTimeout(fetchCounts, 5000);
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
    const shouldLogout = await confirm("Ready to log out?", {
      title: "Log Out",
      primaryLabel: "Log Out",
      secondaryLabel: "Cancel",
      tone: "app",
    });

    if (!shouldLogout) return;

    try {
      const adminFullName = (`${admin?.first_name || ""} ${admin?.last_name || ""}`.trim()) || admin?.email || "Administrator";
      addAuditLog({
        action: "ADMIN_LOGOUT",
        target: "Dashboard",
        details: `${adminFullName} logged out.`,
        actor: pb.authStore.model?.username || adminFullName,
      });
      pb.realtime.unsubscribe();
    } catch (err) {
      console.log("Realtime unsubscribe error:", err);
    }

    pb.authStore.clear();
    navigate("/");
  };

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const getIconColor = (path) => {
    const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
    if (active) return isDark ? "#4ade80" : "#15803d";
    return isDark ? "#94a3b8" : "#64748b";
  };

  const getBadgeStyle = (colorType = "red") => {
    if (colorType === "red") {
      return {
        backgroundColor: isDark ? "rgba(239, 68, 68, 0.22)" : "#fef2f2",
        color: isDark ? "#f87171" : "#b91c1c",
        border: isDark ? "1px solid rgba(239, 68, 68, 0.45)" : "1px solid #fecaca",
        fontSize: "11px",
        fontWeight: "800",
        minWidth: "20px",
        height: "20px",
        padding: "0 6px",
        borderRadius: "999px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: "-0.01em",
        boxShadow: isDark ? "0 0 8px rgba(239, 68, 68, 0.25)" : "none",
      };
    }
    if (colorType === "orange" || colorType === "yellow") {
      return {
        backgroundColor: isDark ? "rgba(234, 179, 8, 0.22)" : "#fefce8",
        color: isDark ? "#facc15" : "#854d0e",
        border: isDark ? "1px solid rgba(234, 179, 8, 0.45)" : "1px solid #fef08a",
        fontSize: "11px",
        fontWeight: "800",
        minWidth: "20px",
        height: "20px",
        padding: "0 6px",
        borderRadius: "999px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: "-0.01em",
        boxShadow: isDark ? "0 0 8px rgba(234, 179, 8, 0.25)" : "none",
      };
    }
    return {
      backgroundColor: isDark ? "rgba(34, 197, 94, 0.22)" : "#f0fdf4",
      color: isDark ? "#4ade80" : "#15803d",
      border: isDark ? "1px solid rgba(34, 197, 94, 0.45)" : "1px solid #bbf7d0",
      fontSize: "11px",
      fontWeight: "800",
      minWidth: "20px",
      height: "20px",
      padding: "0 6px",
      borderRadius: "999px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      letterSpacing: "-0.01em",
      boxShadow: isDark ? "0 0 8px rgba(34, 197, 94, 0.25)" : "none",
    };
  };

  const adminName = (`${admin?.first_name || ""} ${admin?.last_name || ""}`.trim()) || (admin?.email ? admin.email.split("@")[0] : "Administrator");
  const adminInitial = adminName.charAt(0).toUpperCase();

  return (
    <>
      {/* 3 Landscape Lines Floating Button to restore sidebar when hidden */}
      {isHidden && (
        <button
          type="button"
          className="sidebar-floating-toggle-btn"
          onClick={() => setIsHidden(false)}
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu size={20} strokeWidth={2.5} />
        </button>
      )}

      {/* Mobile Backdrop Overlay when sidebar is open on mobile/tablet screens */}
      {!isHidden && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={() => setIsHidden(true)}
          title="Close navigation overlay"
          aria-label="Close navigation overlay"
        />
      )}

      <aside className="sidebar-container" style={styles.sidebar}>
        {/* Brand Header */}
        <div style={styles.brandBox}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              <img
                src="/icon.ico"
                alt="Lagonglong Emergency logo"
                style={styles.brandLogo}
              />
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#0f172a", lineHeight: "1.2" }}>
                  Lagonglong
                </h2>
                <span style={{ fontSize: "11px", color: "#15803d", fontWeight: "600", letterSpacing: "0.01em" }}>
                  Emergency Command
                </span>
              </div>
            </div>

            {/* 3 Landscape Lines Button inside sidebar to collapse */}
            <button
              type="button"
              className="sidebar-hamburger-btn"
              onClick={() => setIsHidden(true)}
              title="Collapse Sidebar"
              aria-label="Collapse Sidebar"
            >
              <Menu size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebarNavNoScroll" style={styles.nav}>
          <p style={styles.sectionTitle}>Main</p>
          <div
            className={`sidebar-nav-item ${isActive("/dashboard") ? "active" : ""}`}
            onClick={() => navigate("/dashboard")}
          >
            <div style={styles.navLinkGroup}>
              <LayoutDashboard size={17} color={getIconColor("/dashboard")} />
              <span>Dashboard</span>
            </div>
          </div>

          {hasAccess("incidents") && (
            <>
              <p style={styles.sectionTitle}>Incidents</p>

              <div
                className={`sidebar-nav-item ${isActive("/pending-incidents") ? "active" : ""}`}
                onClick={() => navigate("/pending-incidents")}
              >
                <div style={styles.navLinkGroup}>
                  <AlertTriangle size={17} color={getIconColor("/pending-incidents")} />
                  <span>Pending Reports</span>
                </div>
                {counts.pendingIncidents > 0 && (
                  <span style={getBadgeStyle("red")}>{counts.pendingIncidents}</span>
                )}
              </div>

              <div
                className={`sidebar-nav-item ${isActive("/ongoing-incidents") ? "active" : ""}`}
                onClick={() => navigate("/ongoing-incidents")}
              >
                <div style={styles.navLinkGroup}>
                  <Activity size={17} color={getIconColor("/ongoing-incidents")} />
                  <span>Ongoing Incidents</span>
                </div>
                {counts.ongoingIncidents > 0 && (
                  <span style={getBadgeStyle("orange")}>{counts.ongoingIncidents}</span>
                )}
              </div>

              <div
                className={`sidebar-nav-item ${location.pathname === "/resolved-incidents" ? "active" : ""}`}
                onClick={() => navigate("/resolved-incidents")}
              >
                <div style={styles.navLinkGroup}>
                  <CheckCircle2 size={17} color={getIconColor("/resolved-incidents")} />
                  <span>Resolved Incidents</span>
                </div>
              </div>

              <div
                className={`sidebar-nav-item ${isActive("/incident-map") ? "active" : ""}`}
                onClick={() => navigate("/incident-map")}
              >
                <div style={styles.navLinkGroup}>
                  <Map size={17} color={getIconColor("/incident-map")} />
                  <span>Incidents Map</span>
                </div>
              </div>
              {location.pathname.startsWith("/resolved-incidents/") && (
                <div
                  className="sidebar-sub-nav-item active"
                  onClick={() => navigate("/resolved-incidents")}
                >
                  <div style={styles.navLinkGroup}>
                    <ClipboardList size={15} color={isDark ? "#4ade80" : "#15803d"} />
                    <span>Incident Details</span>
                  </div>
                </div>
              )}

              <div
                className={`sidebar-nav-item ${isActive("/request-backup") ? "active" : ""}`}
                onClick={() => navigate("/request-backup")}
              >
                <div style={styles.navLinkGroup}>
                  <ShieldCheck size={17} color={getIconColor("/request-backup")} />
                  <span>Request Backup</span>
                </div>
                {counts.pendingBackups > 0 && <span style={getBadgeStyle("red")}>{counts.pendingBackups}</span>}
              </div>

              <div
                className={`sidebar-nav-item ${isActive("/ongoing-backup") ? "active" : ""}`}
                onClick={() => navigate("/ongoing-backup")}
              >
                <div style={styles.navLinkGroup}>
                  <Activity size={17} color={getIconColor("/ongoing-backup")} />
                  <span>Ongoing Backup</span>
                </div>
                {counts.ongoingBackups > 0 && <span style={getBadgeStyle("orange")}>{counts.ongoingBackups}</span>}
              </div>
            </>
          )}

          {hasAccess("sos") && (
            <>
              <p style={styles.sectionTitle}>SOS Alerts</p>
              <div
                className={`sidebar-nav-item ${isActive("/pending-sos") ? "active" : ""}`}
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
                          backgroundColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fef2f2",
                          border: isDark ? "1px solid rgba(239, 68, 68, 0.45)" : "1px solid #fecaca",
                        }
                        : {}),
                    }}
                    className={counts.pendingSos > 0 ? "urgent-status-pulse" : ""}
                  >
                    <Radio
                      size={14}
                      color={counts.pendingSos > 0 ? (isDark ? "#f87171" : "#dc2626") : getIconColor("/pending-sos")}
                    />
                  </div>
                  <span style={counts.pendingSos > 0 ? { color: isDark ? "#f87171" : "#dc2626", fontWeight: "800" } : {}}>
                    Live SOS Alerts
                  </span>
                </div>
                {counts.pendingSos > 0 && (
                  <span style={getBadgeStyle("red")}>{counts.pendingSos}</span>
                )}
              </div>
            </>
          )}

          {hasAccess("users") && (
            <>
              <p style={styles.sectionTitle}>User Registry</p>
              <div
                className={`sidebar-nav-item ${isActive("/pending-users") ? "active" : ""}`}
                onClick={() => navigate("/pending-users")}
              >
                <div style={styles.navLinkGroup}>
                  <Users size={17} color={getIconColor("/pending-users")} />
                  <span>Pending Verification</span>
                </div>
                {counts.pendingUsers > 0 && (
                  <span style={getBadgeStyle("green")}>{counts.pendingUsers}</span>
                )}
              </div>

              <div
                className={`sidebar-nav-item ${location.pathname === "/verified-users" ? "active" : ""}`}
                onClick={() => navigate("/verified-users")}
              >
                <div style={styles.navLinkGroup}>
                  <ShieldCheck size={17} color={getIconColor("/verified-users")} />
                  <span>Verified Users</span>
                </div>
              </div>
              {location.pathname.startsWith("/verified-users/") && (
                <div
                  className="sidebar-sub-nav-item active"
                  onClick={() => navigate("/verified-users")}
                >
                  <div style={styles.navLinkGroup}>
                    <ClipboardList size={15} color={isDark ? "#4ade80" : "#15803d"} />
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
                className={`sidebar-nav-item ${isActive("/reports") ? "active" : ""}`}
                onClick={() => navigate("/reports")}
              >
                <div style={styles.navLinkGroup}>
                  <BarChart3 size={17} color={getIconColor("/reports")} />
                  <span>Generate Reports</span>
                </div>
              </div>
              <div
                className={`sidebar-nav-item ${isActive("/calamities") ? "active" : ""}`}
                onClick={() => navigate("/calamities")}
              >
                <div style={styles.navLinkGroup}>
                  <AlertTriangle size={17} color={getIconColor("/calamities")} />
                  <span>Hazards & Calamities</span>
                </div>
              </div>
            </>
          )}

          {hasAccess("pins") && (
            <>
              <p style={styles.sectionTitle}>Access</p>
              <div
                className={`sidebar-nav-item ${isActive("/responder-pins") || isActive("/responders") ? "active" : ""}`}
                onClick={() => navigate("/responder-pins")}
              >
                <div style={styles.navLinkGroup}>
                  <KeyRound size={17} color={isActive("/responder-pins") || isActive("/responders") ? (isDark ? "#4ade80" : "#15803d") : (isDark ? "#94a3b8" : "#64748b")} />
                  <span>Responder Management</span>
                </div>
              </div>
            </>
          )}

          {isSuperAdmin && (
            <>
              <p style={styles.sectionTitle}>Administration</p>
              <div
                className={`sidebar-nav-item ${isActive("/manage-admins") ? "active" : ""}`}
                onClick={() => navigate("/manage-admins")}
              >
                <div style={styles.navLinkGroup}>
                  <Shield size={17} color={getIconColor("/manage-admins")} />
                  <span>Manage Admins</span>
                </div>
              </div>

              <div
                className={`sidebar-nav-item ${isActive("/rbac-settings") ? "active" : ""}`}
                onClick={() => navigate("/rbac-settings")}
              >
                <div style={styles.navLinkGroup}>
                  <Settings size={17} color={getIconColor("/rbac-settings")} />
                  <span>Access Control</span>
                </div>
              </div>

              <div
                className={`sidebar-nav-item ${isActive("/audit-logs") ? "active" : ""}`}
                onClick={() => navigate("/audit-logs")}
              >
                <div style={styles.navLinkGroup}>
                  <History size={17} color={getIconColor("/audit-logs")} />
                  <span>Audit Logs</span>
                </div>
              </div>
            </>
          )}
        </nav>

        {/* Admin Profile & Logout Footer */}
        <div className="sidebarLogoutSection" style={styles.logoutSection}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
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
              <span className="sidebarAdminName" style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {adminName}
              </span>
              <span className="sidebarAdminRole" style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#64748b" }}>
                {isSuperAdmin ? "Super Admin" : "Officer"}
              </span>
            </div>
            <ThemeSwitch />
          </div>

          <button className="sidebarLogoutBtn" onClick={handleLogout} style={styles.logoutBtn}>
            <LogOut size={14} /> <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}


const styles = {
  sidebar: {
    width: "216px",
    backgroundColor: "#ffffff",
    borderRight: "1px solid #e2e8f0",
    color: "#0f172a",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    height: "100vh",
    left: 0,
    top: 0,
    zIndex: 1000,
    overflow: "hidden",
    boxShadow: "none",
  },
  brandBox: {
    padding: "16px 14px",
    borderBottom: "1px solid #f1f5f9",
    backgroundColor: "#ffffff",
  },
  brandLogo: {
    width: "32px",
    height: "32px",
    display: "block",
    borderRadius: "6px",
  },
  nav: {
    flex: 1,
    padding: "12px 8px",
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    overflowY: "auto",
  },
  sectionTitle: {
    padding: "14px 10px 4px",
    fontSize: "11px",
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: 0,
  },
  navItem: {
    padding: "8px 10px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: "6px",
    transition: "background-color 0.15s ease, color 0.15s ease",
    color: "#475569",
    fontSize: "13px",
    fontWeight: "500",
  },
  navItemActive: {
    padding: "8px 10px",
    backgroundColor: "#f0fdf4",
    color: "#15803d",
    fontWeight: "600",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: "6px",
    fontSize: "13px",
    transition: "background-color 0.15s ease, color 0.15s ease",
    borderLeft: "2.5px solid #15803d",
  },
  subNavItem: {
    padding: "6px 10px 6px 28px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    borderRadius: "6px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "500",
  },
  subNavItemActive: {
    padding: "6px 10px 6px 28px",
    backgroundColor: "#f0fdf4",
    color: "#15803d",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    borderRadius: "6px",
    fontSize: "12px",
  },
  navLinkGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },
  badgeRed: {
    backgroundColor: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fee2e2",
    fontSize: "11px",
    minWidth: "18px",
    height: "18px",
    padding: "0 5px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "600",
    flexShrink: 0,
  },
  badgeOrange: {
    backgroundColor: "#fffbeb",
    color: "#b45309",
    border: "1px solid #fef3c7",
    fontSize: "11px",
    minWidth: "18px",
    height: "18px",
    padding: "0 5px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "600",
    flexShrink: 0,
  },
  badgeGreen: {
    backgroundColor: "#f0fdf4",
    color: "#15803d",
    border: "1px solid #dcfce7",
    fontSize: "11px",
    minWidth: "18px",
    height: "18px",
    padding: "0 5px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "600",
    flexShrink: 0,
  },
  logoutSection: {
    padding: "12px 14px 14px",
    borderTop: "1px solid #f1f5f9",
    backgroundColor: "#ffffff",
    marginTop: "auto",
  },
  logoutBtn: {
    width: "100%",
    padding: "7px 10px",
    backgroundColor: "#ffffff",
    color: "#64748b",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "500",
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    transition: "all 0.15s ease",
  },
};
