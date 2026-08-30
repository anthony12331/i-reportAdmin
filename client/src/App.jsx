import React, { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

// Config
import { pb } from "./config/pocketbase";

// Login is loaded eagerly so first paint is instant
import Login from "./pages/Login";

// All other pages are lazy-loaded — each becomes its own JS chunk.
// The browser only downloads + parses a page when the user navigates to it.
const ManageAdmins           = lazy(() => import("./pages/ManageAdmins"));
const Dashboard              = lazy(() => import("./pages/Dashboard"));
const OngoingIncidents       = lazy(() => import("./pages/OngoingIncidents"));
const ResolvedIncidents      = lazy(() => import("./pages/ResolvedIncidents"));
const ResolvedIncidentDetails= lazy(() => import("./pages/ResolvedIncidentDetails"));
const PendingUserRegistration= lazy(() => import("./pages/PendingUsers"));
const PendingSos             = lazy(() => import("./pages/PendingSos"));
const PendingIncidents       = lazy(() => import("./pages/PendingIncidents"));
const VerifiedUsers          = lazy(() => import("./pages/VerifiedUsers"));
const VerifiedUserDetails    = lazy(() => import("./pages/VerifiedUserDetails"));
const RBACManager            = lazy(() => import("./pages/RBACManager"));
const Report                 = lazy(() => import("./pages/Report"));
const AuditLogs              = lazy(() => import("./pages/Audit"));
const GenerateResponderPin   = lazy(() => import("./pages/GenerateResponderPin"));
const RequestBackup          = lazy(() => import("./pages/RequestBackup"));
const OngoingBackup          = lazy(() => import("./pages/OngoingBackup"));
const Calamities             = lazy(() => import("./pages/Calamities"));
const IncidentMap            = lazy(() => import("./pages/IncidentMap"));

// Components
import { MessageBoxProvider } from "./components/MessageBox";
import { SnackbarProvider } from "./components/PremiumSnackbar";
import ProtectedRoute from "./components/ProtectedRoute";
import NetworkStatusDetector from "./components/NetworkStatusDetector";

// Utils
import { addAuditLog } from "./utils/auditLog";
import { getPriorityLabel } from "./utils/incidentPriority";
import { getSystemSettings, subscribeToSettings } from "./utils/systemSettings";

// Minimal fallback shown while a lazy page chunk is downloading
function PageLoader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: "#f8fafc" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "32px", height: "32px", border: "3px solid #e2e8f0", borderTopColor: "#15803d", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", letterSpacing: "0.04em" }}>LOADING</span>
      </div>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

const alertedIncidentIds = new Set();
const alertedSosIds = new Set();
const alertedBackupIds = new Set();
const AUDIO_ARMED_KEY = "lagonglong-alarm-armed";

// Deduplication: prevent the same event from showing a snackbar twice within 2 seconds
// (guards against React Strict Mode double-subscription race conditions)
const snackbarCooldown = new Map();

function App() {
  const [audioEnabled, setAudioEnabled] = useState(() => {
    try {
      return window.localStorage.getItem(AUDIO_ARMED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [settings, setSettings] = useState(getSystemSettings());
  const settingsRef = useRef(settings); // ref so subscriptions don't need to re-mount on settings change
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const [alarmActive, setAlarmActive] = useState(false);
  const [alarmPulse, setAlarmPulse] = useState(0);
  const [authState, setAuthState] = useState(pb.authStore.isValid);
  const alarmAudioRef = useRef(null);
  const openIncidentIdsRef = useRef(new Set());
  const openSosIdsRef = useRef(new Set());
  const openBackupIdsRef = useRef(new Set());
  const alarmSyncVersionRef = useRef(0);
  const isMountedRef = useRef(true);

  // Per-render tracking sets (intentionally re-created each render cycle)

  useEffect(() => subscribeToSettings(setSettings), []);

  useEffect(() => {
    // Listen to auth changes so App re-renders and starts global subscriptions!
    const unsubscribeAuth = pb.authStore.onChange(() => {
      pb.realtime.disconnect(); // Force connection reset to use the new token
      setAuthState(pb.authStore.isValid);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const audio = document.getElementById("emergency-alert-sound");
    if (audio) {
      audio.loop = true;
      audio.preload = "auto";
      alarmAudioRef.current = audio;
    }

    return () => {
      alarmAudioRef.current = null;
    };
  }, []);

  const createUniqueId = () => {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
    return `alarm-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  // Helper Functions
  const isOpenIncident = useCallback(
    (record) => ["new", "pending"].includes(record?.status),
    []
  );
  const isOpenSos = useCallback(
    (record) =>
      record?.status !== "resolved" && record?.dispatch_status !== "assigned",
    []
  );
  const isOpenBackup = useCallback(
    (record) => record?.dispatch_status === "pending",
    []
  );
  const getAlertKey = useCallback(
    (collectionName, recordId) => `${collectionName}:${recordId}`,
    []
  );

  const isAuthorizedAdmin = useCallback(() => {
    if (!pb.authStore.isValid || !pb.authStore.model) return false;
    const role = pb.authStore.model.collectionName;
    return role === "admins" || role === "super_admins" || role === "_superusers";
  }, [authState]);

  const playAlarmSound = useCallback(() => {
    if (!settings.soundEnabled || window.__isMutedByLiveVideo) return;
    try {
      const alertSound = alarmAudioRef.current || document.getElementById("emergency-alert-sound");
      if (alertSound) {
        alertSound.play().catch((err) => console.warn("Autoplay blocked globally:", err));
      }
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  }, [settings.soundEnabled]);

  const pauseAlarmSound = useCallback(() => {
    try {
      const alertSound = alarmAudioRef.current || document.getElementById("emergency-alert-sound");
      if (alertSound) {
        alertSound.pause();
        alertSound.currentTime = 0;
      }
    } catch (err) {
      console.warn("Audio pause failed:", err);
    }
  }, []);

  useEffect(() => {
    if (!alarmActive) {
      pauseAlarmSound();
      return;
    }
    if (audioEnabled && settings.soundEnabled) {
      playAlarmSound();
    }
  }, [
    alarmActive,
    alarmPulse,
    audioEnabled,
    settings.soundEnabled,
    playAlarmSound,
    pauseAlarmSound,
  ]);

  useEffect(() => {
    if (!alarmActive || !audioEnabled || !settings.soundEnabled) return;

    window.addEventListener('force-pause-alarm', () => {
      const alertSound = alarmAudioRef.current || document.getElementById('emergency-alert-sound');
      if (alertSound) { alertSound.pause(); alertSound.currentTime = 0; }
    });

    const ensureAlarmPlaying = () => {
      const alertSound =
        alarmAudioRef.current ||
        document.getElementById("emergency-alert-sound");
      if (!alertSound) return;
      if (window.__isMutedByLiveVideo) { if (!alertSound.paused) alertSound.pause(); return; }
      if (alertSound.paused || alertSound.ended) {
        playAlarmSound();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        ensureAlarmPlaying();
      }
    };

    const timer = window.setInterval(ensureAlarmPlaying, 4000);
    window.addEventListener("focus", ensureAlarmPlaying);
    window.addEventListener("pageshow", ensureAlarmPlaying);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", ensureAlarmPlaying);
      window.removeEventListener("pageshow", ensureAlarmPlaying);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    alarmActive,
    audioEnabled,
    settings.soundEnabled,
    alarmPulse,
    playAlarmSound,
  ]);

  // Alarm Handlers
  const syncSignalStateFromRecord = useCallback(
    (collectionName, record, action) => {
      if (!record?.id || !isAuthorizedAdmin()) return false;

      alarmSyncVersionRef.current += 1;

      const nextIncidentIds = new Set(openIncidentIdsRef.current);
      const nextSosIds = new Set(openSosIdsRef.current);
      const nextBackupIds = new Set(openBackupIdsRef.current);
      
      const alertSet =
        collectionName === "sos_tracking" ? alertedSosIds 
        : collectionName === "backup_requests" ? alertedBackupIds
        : alertedIncidentIds;

      let wasOpen = false;
      let isOpen = false;

      if (collectionName === "incident_reports") {
        wasOpen = nextIncidentIds.has(record.id);
        isOpen = action !== "delete" && (action === "create" || isOpenIncident(record));
        if (isOpen) nextIncidentIds.add(record.id);
        else { nextIncidentIds.delete(record.id); alertSet.delete(record.id); }
      }

      if (collectionName === "sos_tracking") {
        wasOpen = nextSosIds.has(record.id);
        isOpen = action !== "delete" && (action === "create" || isOpenSos(record));
        if (isOpen) nextSosIds.add(record.id);
        else { nextSosIds.delete(record.id); alertSet.delete(record.id); }
      }
      
      if (collectionName === "backup_requests") {
        wasOpen = nextBackupIds.has(record.id);
        isOpen = action !== "delete" && (action === "create" || isOpenBackup(record));
        if (isOpen) nextBackupIds.add(record.id);
        else { nextBackupIds.delete(record.id); alertSet.delete(record.id); }
      }

      openIncidentIdsRef.current = nextIncidentIds;
      openSosIdsRef.current = nextSosIds;
      openBackupIdsRef.current = nextBackupIds;
      setAlarmActive(nextIncidentIds.size + nextSosIds.size + nextBackupIds.size > 0);

      const shouldPulse =
        isOpen && !alertSet.has(record.id) && (!wasOpen || action === "create");
      if (shouldPulse) {
        alertSet.add(record.id);
        setAlarmPulse((pulse) => pulse + 1);
        playAlarmSound(); // Instantly trigger the alarm sound!

        // Guard: skip if same record already showed a snackbar within 2 seconds
        const cooldownKey = `${collectionName}:${record.id}`;
        const now = Date.now();
        if (snackbarCooldown.has(cooldownKey) && now - snackbarCooldown.get(cooldownKey) < 2000) {
          // duplicate — skip silently
        } else {
          snackbarCooldown.set(cooldownKey, now);
          // Dispatch Premium Snackbar with matching category theme
          if (collectionName === "incident_reports") {
            const rawType = String(record.type || "").toLowerCase();
            let categoryType = "emergency";
            if (rawType.includes("fire")) categoryType = "fire";
            else if (rawType.includes("accident") || rawType.includes("traffic") || rawType.includes("vehicular") || rawType.includes("car")) categoryType = "accident";
            else if (rawType.includes("medical") || rawType.includes("health") || rawType.includes("ambulance")) categoryType = "medical";
            else if (rawType.includes("flood") || rawType.includes("landslide") || rawType.includes("calamity") || rawType.includes("weather") || rawType.includes("storm") || rawType.includes("typhoon")) categoryType = "calamity";
            else if (rawType.includes("crime") || rawType.includes("police") || rawType.includes("theft") || rawType.includes("violence") || rawType.includes("disturbance")) categoryType = "police";

            window.dispatchEvent(new CustomEvent("show-premium-snackbar", {
              detail: {
                title: "New Incident Reported",
                message: `${(record.type || "Incident").toUpperCase()} • Barangay ${record.baranggay || "Lagonglong"}`,
                type: categoryType,
                actionLabel: "View Details",
                onAction: () => { window.location.href = "/pending-incidents"; },
              }
            }));
          } else if (collectionName === "sos_tracking") {
            window.dispatchEvent(new CustomEvent("show-premium-snackbar", {
              detail: {
                title: "SOS Alert",
                message: `Citizen in distress • ${record.baranggay || "Lagonglong"}`,
                type: "sos",
                actionLabel: "View Details",
                onAction: () => { window.location.href = "/pending-sos"; },
              }
            }));
          } else if (collectionName === "backup_requests") {
            window.dispatchEvent(new CustomEvent("show-premium-snackbar", {
              detail: {
                title: "Backup Requested",
                message: `Responder needs backup assistance.`,
                type: "warning",
                actionLabel: "View Details",
                onAction: () => { window.location.href = "/request-backup"; },
              }
            }));
          }
        }
      }

      return shouldPulse;
    },
    [isAuthorizedAdmin, isOpenIncident, isOpenSos, isOpenBackup, playAlarmSound]
  );

  const reconcileAlarmState = useCallback(async () => {
    if (!isAuthorizedAdmin()) {
      setAlarmActive(false);
      return;
    }

    const syncVersion = ++alarmSyncVersionRef.current;

    try {
      const [openIncidentRecords, openSosRecords, openBackupRecords] = await Promise.all([
        pb.collection("incident_reports").getFullList({
          filter: 'status = "new" || status = "pending"',
          fields: "id",
          requestKey: null,
        }),
        pb.collection("sos_tracking").getFullList({
          filter: 'status = "active" && dispatch_status != "assigned"',
          fields: "id",
          requestKey: null,
        }),
        pb.collection("backup_requests").getFullList({
          filter: 'dispatch_status = "pending"',
          fields: "id",
          requestKey: null,
        }),
      ]);

      if (!isMountedRef.current || syncVersion !== alarmSyncVersionRef.current)
        return;

      const previousIncidentIds = openIncidentIdsRef.current;
      const previousSosIds = openSosIdsRef.current;
      const previousBackupIds = openBackupIdsRef.current;
      
      const nextIncidentIds = new Set(
        openIncidentRecords.map((record) => record.id)
      );
      const nextSosIds = new Set(openSosRecords.map((record) => record.id));
      const nextBackupIds = new Set(openBackupRecords.map((record) => record.id));

      const hasNewIncident = [...nextIncidentIds].some(
        (id) => !previousIncidentIds.has(id)
      );
      const hasNewSos = [...nextSosIds].some((id) => !previousSosIds.has(id));
      const hasNewBackup = [...nextBackupIds].some((id) => !previousBackupIds.has(id));

      for (const alertedId of alertedIncidentIds) {
        if (!nextIncidentIds.has(alertedId)) {
          alertedIncidentIds.delete(alertedId);
        }
      }
      for (const alertedId of alertedSosIds) {
        if (!nextSosIds.has(alertedId)) {
          alertedSosIds.delete(alertedId);
        }
      }
      for (const alertedId of alertedBackupIds) {
        if (!nextBackupIds.has(alertedId)) {
          alertedBackupIds.delete(alertedId);
        }
      }

      openIncidentIdsRef.current = nextIncidentIds;
      openSosIdsRef.current = nextSosIds;
      openBackupIdsRef.current = nextBackupIds;
      setAlarmActive(nextIncidentIds.size + nextSosIds.size + nextBackupIds.size > 0);

      if (hasNewIncident || hasNewSos || hasNewBackup) {
        setAlarmPulse((pulse) => pulse + 1);
        playAlarmSound(); // Instantly trigger alarm on new incidents!
      }
    } catch (error) {
      const isAbort =
        error instanceof Error && "isAbort" in error && error.isAbort;
      if (!isAbort) console.error("Failed to reconcile alarm state:", error);
    }
  }, [isAuthorizedAdmin, playAlarmSound]);

  // Subscriptions & Listeners
  useEffect(() => {
    let incidentUnsubscribe;
    let backupUnsubscribe;
    let sosUnsubscribe;

    isMountedRef.current = true;
    Promise.resolve().then(() => { reconcileAlarmState(); });

    const handleIncidentEvent = (record, action) => {
      const shouldAlert = syncSignalStateFromRecord(
        "incident_reports",
        record,
        action
      );
      if (!shouldAlert) return;

      try {
        if (settingsRef.current.browserNotificationsEnabled && "Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification("New emergency report", {
              body: `${record.type || "Incident"} needs review.`,
            });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
          }
        }
      } catch (error) {
        console.error("Incident alarm handler failed:", error);
      }
    };

    const handleSosEvent = (record, action) => {
      const shouldAlert = syncSignalStateFromRecord(
        "sos_tracking",
        record,
        action
      );
      if (!shouldAlert) return;

      try {
        

        if (settingsRef.current.browserNotificationsEnabled && "Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification("New SOS alert", {
              body: "A new SOS distress call needs response.",
            });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
          }
        }
      } catch (error) {
        console.error("SOS alarm handler failed:", error);
      }
    };

    const startSubscriptions = async () => {
      if (!isAuthorizedAdmin()) return;

      try {
        incidentUnsubscribe = await pb
          .collection("incident_reports")
          .subscribe("*", (e) => {
            if (!isMountedRef.current || !e?.record) return;
            handleIncidentEvent(e.record, e.action);
          });

        sosUnsubscribe = await pb
          .collection("sos_tracking")
          .subscribe("*", (e) => {
            if (!isMountedRef.current || !e?.record) return;
            handleSosEvent(e.record, e.action);
          });
          
        backupUnsubscribe = await pb
          .collection("backup_requests")
          .subscribe("*", (e) => {
            if (!isMountedRef.current || !e?.record) return;
            const shouldAlert = syncSignalStateFromRecord(
              "backup_requests",
              e.record,
              e.action
            );
            // Optionally could emit a global event for the backup map like handled for SOS
          });
      } catch (subError) {
        console.error(
          "Real-time telemetry streaming failed to mount:",
          subError
        );
      }
    };

    startSubscriptions();

    return () => {
      isMountedRef.current = false;
      if (incidentUnsubscribe) incidentUnsubscribe().catch(() => {});
      if (sosUnsubscribe) sosUnsubscribe().catch(() => {});
      if (backupUnsubscribe) backupUnsubscribe().catch(() => {});
      try {
        pb.collection("incident_reports").unsubscribe("*").catch(() => {});
        pb.collection("sos_tracking").unsubscribe("*").catch(() => {});
        pb.collection("backup_requests").unsubscribe("*").catch(() => {});
      } catch {
        // ignore unsubscribe errors
      }
    };
  }, [
    isAuthorizedAdmin,
    reconcileAlarmState,
    syncSignalStateFromRecord,
    authState,
  ]);

  useEffect(() => {
    const handleIncidentHandled = () => Promise.resolve().then(() => { reconcileAlarmState(); });
    const handleSosHandled = () => Promise.resolve().then(() => { reconcileAlarmState(); });

    window.addEventListener("incident-handled", handleIncidentHandled);
    window.addEventListener("sos-handled", handleSosHandled);

    return () => {
      window.removeEventListener("incident-handled", handleIncidentHandled);
      window.removeEventListener("sos-handled", handleSosHandled);
    };
  }, [reconcileAlarmState]);

  useEffect(() => {
    const refreshSessionData = async () => {
      if (pb.authStore.isValid && pb.authStore.model) {
        try {
          console.log("Silently refreshing administrative security token...");
          await pb
            .collection(pb.authStore.model.collectionName)
            .authRefresh({ requestKey: null });
          console.log(
            "Security token successfully updated. New permissions loaded."
          );
        } catch (err) {
          console.error("Failed to silently refresh auth token:", err);
          if (err.status === 401 || err.status === 403) {
            pb.authStore.clear();
          }
        }
      }
    };

    refreshSessionData();
  }, []);

  useEffect(() => {
    const pollingTimer = window.setInterval(() => {
      Promise.resolve().then(() => { reconcileAlarmState(); });
    }, 60000);

    return () => window.clearInterval(pollingTimer);
  }, [reconcileAlarmState]);

  const enableAudio = useCallback(() => {
    if (!audioEnabled) {
      setAudioEnabled(true);
      try {
        window.localStorage.setItem(AUDIO_ARMED_KEY, "true");
      } catch {
        // Safe catch-all
      }
      const alertSound =
        alarmAudioRef.current ||
        document.getElementById("emergency-alert-sound");
      if (alertSound) {
        alertSound
          .play().catch(() => {})
          .then(() => {
            alertSound.pause();
           
            alertSound.currentTime = 0;
          })
          .catch((e) => console.log("Audio unlock failed:", e));
      }
      if (alarmActive) {
        playAlarmSound();
      }
    }
  }, [audioEnabled, alarmActive, playAlarmSound]);

  useEffect(() => {
    const unlockAudioGlobally = () => enableAudio();
    window.addEventListener("pointerdown", unlockAudioGlobally, {
      capture: true,
    });
    window.addEventListener("keydown", unlockAudioGlobally, { capture: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudioGlobally, {
        capture: true,
      });
      window.removeEventListener("keydown", unlockAudioGlobally, {
        capture: true,
      });
    };
  }, [enableAudio]);

  useEffect(() => {
    const handleAlarmAudioUnlock = () => enableAudio();
    window.addEventListener("alarm-audio-unlock", handleAlarmAudioUnlock);
    return () =>
      window.removeEventListener("alarm-audio-unlock", handleAlarmAudioUnlock);
  }, [enableAudio]);

  useEffect(() => {
    const handleSecurityViolation = () => {
      console.log("Security Violation Detected! Logging to database...");
      addAuditLog({
        action: "SECURITY_VIOLATION",
        target: "System",
        details: "Blocked key combination detected (Ctrl+Alt+Delete or Windows Key).",
        actor: "System",
      });
    };
    window.addEventListener("security-violation-detected", handleSecurityViolation);
    return () => window.removeEventListener("security-violation-detected", handleSecurityViolation);
  }, []);

  return (
    <div onClick={enableAudio} style={{ minHeight: "100vh", width: "100%" }}>
      <audio
        id="emergency-alert-sound"
        src="/notification_sound.mp3"
        preload="auto"
        loop
        ref={alarmAudioRef}
      />


      <NetworkStatusDetector />

      <SnackbarProvider>
        <MessageBoxProvider>
          <Router>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rbac-settings"
                element={
                  <ProtectedRoute requiredModule="super_admin_only">
                    <RBACManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage-admins"
                element={
                  <ProtectedRoute requiredModule="super_admin_only">
                    <ManageAdmins />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pending-users"
                element={
                  <ProtectedRoute requiredModule="users">
                    <PendingUserRegistration />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/verified-users"
                element={
                  <ProtectedRoute requiredModule="users">
                    <VerifiedUsers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/verified-users/:userId"
                element={
                  <ProtectedRoute requiredModule="users">
                    <VerifiedUserDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calamities"
                element={
                  <ProtectedRoute requiredModule="dashboard">
                    <Calamities />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pending-incidents"
                element={
                  <ProtectedRoute requiredModule="incidents">
                    <PendingIncidents />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ongoing-incidents"
                element={
                  <ProtectedRoute requiredModule="incidents">
                    <OngoingIncidents />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/resolved-incidents"
                element={
                  <ProtectedRoute requiredModule="incidents">
                    <ResolvedIncidents />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/incident-map"
                element={
                  <ProtectedRoute requiredModule="incidents">
                    <IncidentMap />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/resolved-incidents/sos/:incidentId"
                element={
                  <ProtectedRoute requiredModule="incidents">
                    <ResolvedIncidentDetails recordType="sos" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/resolved-incidents/:incidentId"
                element={
                  <ProtectedRoute requiredModule="incidents">
                    <ResolvedIncidentDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pending-sos"
                element={
                  <ProtectedRoute requiredModule="sos">
                    <PendingSos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute requiredModule="reports">
                    <Report />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit-logs"
                element={
                  <ProtectedRoute requiredModule="audit">
                    <AuditLogs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/responder-pins"
                element={
                  <ProtectedRoute requiredModule="pins">
                    <GenerateResponderPin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/responders"
                element={
                  <ProtectedRoute requiredModule="pins">
                    <GenerateResponderPin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/request-backup"
                element={
                  <ProtectedRoute requiredModule="incidents">
                    <RequestBackup />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ongoing-backup"
                element={
                  <ProtectedRoute requiredModule="incidents">
                    <OngoingBackup />
                  </ProtectedRoute>
                }
              />
            </Routes>
            </Suspense>
          </Router>
        </MessageBoxProvider>
      </SnackbarProvider>
    </div>
  );
}

const styles = {
  alertStack: {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: 15000,
    display: "grid",
    gap: "10px",
    width: "min(360px, calc(100vw - 32px))",
  },
  incidentAlert: {
    display: "grid",
    gap: "4px",
    padding: "14px 16px",
    borderRadius: "8px",
    borderLeft: "5px solid #ef4444",
    backgroundColor: "white",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.22)",
    color: "#111827",
    fontSize: "13px",
  },
};

export default App;
