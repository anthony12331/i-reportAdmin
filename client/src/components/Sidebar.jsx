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
} from "lucide-react";
import { useMessageBox } from "./MessageBox";
import { ThemeSwitch } from "../themes/ThemeContext";

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

  const prevWidthRef = useRef(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const settingsRef = useRef(null);
  const mobileSettingsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettingsMenu(false);
      }
      if (mobileSettingsRef.current && !mobileSettingsRef.current.contains(e.target)) {
        setShowMobileSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      const prevWidth = prevWidthRef.current;
      // Only auto-hide if crossing from desktop (> 1024) down to mobile/tablet (<= 1024)
      if (prevWidth > 1024 && currentWidth <= 1024) {
        setIsHidden(true);
      }
      prevWidthRef.current = currentWidth;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isHidden) {
      document.documentElement.classList.add("sidebar-hidden");
      try {
        if (window.innerWidth > 1024) {
          localStorage.setItem("sidebar_hidden", "true");
        }
      } catch {}
    } else {
      document.documentElement.classList.remove("sidebar-hidden");
      try {
        if (window.innerWidth > 1024) {
          localStorage.setItem("sidebar_hidden", "false");
        }
      } catch {}
    }

    // Trigger map canvas resize without triggering recursive isHidden reset
    const mapResizeTimer1 = setTimeout(() => {
      window.dispatchEvent(new CustomEvent("leaflet-map-resize"));
    }, 100);
    const mapResizeTimer2 = setTimeout(() => {
      window.dispatchEvent(new CustomEvent("leaflet-map-resize"));
    }, 250);

    return () => {
      clearTimeout(mapResizeTimer1);
      clearTimeout(mapResizeTimer2);
    };
  }, [isHidden]);

  const handleNav = (path) => {
    navigate(path);
    if (typeof window !== "undefined" && window.innerWidth <= 1024) {
      setIsHidden(true);
    }
  };

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
          pb.collection("incident_reports").getFullList({ requestKey: null }),
          pb.collection("users").getFullList({ requestKey: null }),
          pb.collection("sos_tracking").getFullList({ requestKey: null }),
          pb.collection("dispatches").getFullList({ requestKey: null }),
          pb.collection("backup_requests").getFullList({ requestKey: null }),
        ]);

        if (!isMounted) return;

        const pendingInc = reports.filter((r) => r.status?.toLowerCase() === "pending").length;
        const ongoingInc = reports.filter((r) => ONGOING_STATUSES.includes(r.status?.toLowerCase())).length;
        const pendingUsr = users.filter((u) => u.verified === false && u.rejected !== true).length;
        const pendingSos = sos.filter((s) => s.status?.toLowerCase() === "active").length;
        const pendingBackups = backups.filter((b) => b.status?.toLowerCase() === "pending").length;
        const ongoingBackups = backups.filter((b) => ["accepted", "ongoing", "in_progress"].includes(b.status?.toLowerCase())).length;

        setLiveCounts({
          pendingIncidents: pendingInc,
          ongoingIncidents: ongoingInc,
          pendingUsers: pendingUsr,
          pendingSos,
          pendingBackups,
          ongoingBackups,
        });
      } catch (err) {
        console.log("Live counts fetch error:", err);
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
    <>
      {/* Sticky Mobile Top Header Bar (<= 1024px) */}
      <header className="mobile-top-bar">
        <button
          type="button"
          className="mobile-hamburger-btn"
          onClick={() => setIsHidden(false)}
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu size={20} strokeWidth={2.4} />
        </button>
        <div
          onClick={() => handleNav("/dashboard")}
          style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
        >
          <img
            src="/icon.ico"
            alt="Lagonglong Emergency logo"
            style={{ width: "26px", height: "26px", borderRadius: "6px" }}
          />
          <span style={{ fontSize: "14px", fontWeight: "700", color: "#15803d", letterSpacing: "-0.01em" }}>
            Lagonglong Command
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <ThemeSwitch size="sm" />
          <div style={{ position: "relative" }} ref={mobileSettingsRef}>
            <button
              type="button"
              className="mobile-hamburger-btn"
              style={{ width: "32px", height: "32px", borderRadius: "8px" }}
              onClick={() => setShowMobileSettings((prev) => !prev)}
              title="Settings & Logout"
              aria-label="Settings and Logout"
            >
              <Settings size={16} />
            </button>
            {showMobileSettings && (
              <div
                className="sidebar-settings-popover mobile-settings-popover"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: "190px",
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.18)",
                  border: "1px solid #e2e8f0",
                  padding: "8px",
                  zIndex: 99999,
                }}
              >
                <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {adminName}
                  </div>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: "#15803d" }}>
                    {isSuperAdmin ? "Super Admin" : "Officer"}
                  </div>
                </div>
                <div style={{ paddingTop: "6px" }}>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileSettings(false);
                        handleNav("/manage-admins");
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "none",
                        background: "transparent",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12.5px",
                        fontWeight: "600",
                        color: "#334155",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      className="sidebar-settings-menu-item"
                    >
                      <Shield size={14} color="#15803d" />
                      <span>Manage Admins</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileSettings(false);
                      handleLogout();
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background: "transparent",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "12.5px",
                      fontWeight: "700",
                      color: "#ef4444",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    className="sidebar-settings-logout-item"
                  >
                    <LogOut size={14} color="#ef4444" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Floating 3 Landscape Lines button (visible only on desktop when hidden) */}
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

      {/* Backdrop overlay for mobile drawer */}
      <div
        className="sidebar-mobile-backdrop"
        onClick={() => setIsHidden(true)}
        aria-hidden="true"
      />

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
      <nav ref={navRef} className="sidebarNavNoScroll" style={styles.nav}>
        <p style={styles.sectionTitle}>Main</p>
        <div
          role="button"
          tabIndex={0}
          style={isActive("/dashboard") ? styles.navItemActive : styles.navItem}
          onClick={() => handleNav("/dashboard")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/dashboard"); }}
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
              role="button"
              tabIndex={0}
              style={isActive("/pending-incidents") ? styles.navItemActive : styles.navItem}
              onClick={() => handleNav("/pending-incidents")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/pending-incidents"); }}
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
              role="button"
              tabIndex={0}
              style={isActive("/ongoing-incidents") ? styles.navItemActive : styles.navItem}
              onClick={() => handleNav("/ongoing-incidents")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/ongoing-incidents"); }}
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
              role="button"
              tabIndex={0}
              style={location.pathname === "/resolved-incidents" ? styles.navItemActive : styles.navItem}
              onClick={() => handleNav("/resolved-incidents")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/resolved-incidents"); }}
            >
              <div style={styles.navLinkGroup}>
                <CheckCircle2 size={17} color={location.pathname === "/resolved-incidents" ? "#15803d" : "#64748b"} />
                <span>Resolved Incidents</span>
              </div>
            </div>
            {location.pathname.startsWith("/resolved-incidents/") && (
              <div
                role="button"
                tabIndex={0}
                style={styles.subNavItemActive}
                onClick={() => handleNav("/resolved-incidents")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/resolved-incidents"); }}
              >
                <div style={styles.navLinkGroup}>
                  <ClipboardList size={15} />
                  <span>Incident Details</span>
                </div>
              </div>
            )}

            <div
              role="button"
              tabIndex={0}
              style={isActive("/request-backup") ? styles.navItemActive : styles.navItem}
              onClick={() => handleNav("/request-backup")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/request-backup"); }}
            >
              <div style={styles.navLinkGroup}>
                <ShieldCheck size={17} color={isActive("/request-backup") ? "#15803d" : "#64748b"} />
                <span>Request Backup</span>
              </div>
              {counts.pendingBackups > 0 && <span style={styles.badgeRed}>{counts.pendingBackups}</span>}
            </div>

            <div
              role="button"
              tabIndex={0}
              style={isActive("/ongoing-backup") ? styles.navItemActive : styles.navItem}
              onClick={() => handleNav("/ongoing-backup")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/ongoing-backup"); }}
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
              role="button"
              tabIndex={0}
              style={isActive("/pending-sos") ? styles.navItemActive : styles.navItem}
              onClick={() => handleNav("/pending-sos")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/pending-sos"); }}
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
              role="button"
              tabIndex={0}
              style={isActive("/pending-users") ? styles.navItemActive : styles.navItem}
              onClick={() => handleNav("/pending-users")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/pending-users"); }}
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
              role="button"
              tabIndex={0}
              style={location.pathname === "/verified-users" ? styles.navItemActive : styles.navItem}
              onClick={() => handleNav("/verified-users")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/verified-users"); }}
            >
              <div style={styles.navLinkGroup}>
                <ShieldCheck size={17} color={location.pathname === "/verified-users" ? "#15803d" : "#64748b"} />
                <span>Verified Users</span>
              </div>
            </div>
            {location.pathname.startsWith("/verified-users/") && (
              <div
                role="button"
                tabIndex={0}
                style={styles.subNavItemActive}
                onClick={() => handleNav("/verified-users")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/verified-users"); }}
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
              role="button"
              tabIndex={0}
              style={isActive("/reports") ? styles.navItemActive : styles.navItem}
              onClick={() => handleNav("/reports")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/reports"); }}
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
              role="button"
              tabIndex={0}
              style={isActive("/responder-pins") ? styles.navItemActive : styles.navItem}
              onClick={() => handleNav("/responder-pins")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/responder-pins"); }}
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
              role="button"
              tabIndex={0}
              style={isActive("/manage-admins") ? styles.navItemActive : styles.navItem}
              onClick={() => handleNav("/manage-admins")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/manage-admins"); }}
            >
              <div style={styles.navLinkGroup}>
                <Shield size={17} color={isActive("/manage-admins") ? "#15803d" : "#64748b"} />
                <span>Manage Admins</span>
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              style={isActive("/rbac-settings") ? styles.navItemActive : styles.navItem}
              onClick={() => handleNav("/rbac-settings")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/rbac-settings"); }}
            >
              <div style={styles.navLinkGroup}>
                <Settings size={17} color={isActive("/rbac-settings") ? "#15803d" : "#64748b"} />
                <span>Access Control</span>
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              style={isActive("/audit-logs") ? styles.navItemActive : styles.navItem}
              onClick={() => handleNav("/audit-logs")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNav("/audit-logs"); }}
            >
              <div style={styles.navLinkGroup}>
                <History size={17} color={isActive("/audit-logs") ? "#15803d" : "#64748b"} />
                <span>Audit Logs</span>
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Sidebar Controls Footer */}
      <div className="sidebarLogoutSection" style={styles.logoutSection}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>
            Preferences
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ThemeSwitch />
            <div style={{ position: "relative" }} ref={settingsRef}>
              <button
                type="button"
                className="sidebar-settings-icon-btn"
                onClick={() => setShowSettingsMenu((prev) => !prev)}
                title="Settings & Logout"
                aria-label="Settings and Logout"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: showSettingsMenu ? "#f0fdf4" : "#ffffff",
                  color: showSettingsMenu ? "#15803d" : "#475569",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.16s ease",
                }}
              >
                <Settings size={16} />
              </button>

              {/* Settings Dropdown Popover */}
              {showSettingsMenu && (
                <div
                  className="sidebar-settings-popover"
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 10px)",
                    right: 0,
                    width: "200px",
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.16), 0 0 1px rgba(0, 0, 0, 0.2)",
                    border: "1px solid #e2e8f0",
                    padding: "8px",
                    zIndex: 99999,
                  }}
                >
                  <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {adminName}
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: "600", color: "#15803d" }}>
                      {isSuperAdmin ? "Super Administrator" : "Command Officer"}
                    </div>
                  </div>

                  <div style={{ paddingTop: "6px" }}>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowSettingsMenu(false);
                          handleNav("/manage-admins");
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "none",
                          background: "transparent",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "12.5px",
                          fontWeight: "600",
                          color: "#334155",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        className="sidebar-settings-menu-item"
                      >
                        <Shield size={14} color="#15803d" />
                        <span>Manage Admins</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowSettingsMenu(false);
                        handleLogout();
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "none",
                        background: "transparent",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12.5px",
                        fontWeight: "700",
                        color: "#ef4444",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      className="sidebar-settings-logout-item"
                    >
                      <LogOut size={14} color="#ef4444" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
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
