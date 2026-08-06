import React, { useEffect, useRef, useState, useCallback } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

// Config
import { pb } from "./config/pocketbase";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import OngoingIncidents from "./pages/OngoingIncidents";
import ResolvedIncidents from "./pages/ResolvedIncidents";
import PendingUserRegistration from "./pages/PendingUsers";
import PendingSos from "./pages/PendingSos";
import PendingIncidents from "./pages/PendingIncidents";
import VerifiedUsers from "./pages/VerifiedUsers";
import RBACManager from "./pages/RBACManager";
import Report from "./pages/Report";
import AuditLogs from "./pages/Audit";

// Components
import { MessageBoxProvider } from "./components/MessageBox";
import ProtectedRoute from "./components/ProtectedRoute";

// Utils
import { addAuditLog } from "./utils/auditLog";
import { getPriorityLabel } from "./utils/incidentPriority";
import { getSystemSettings, subscribeToSettings } from "./utils/systemSettings";

const alertedIncidentIds = new Set();
const alertedSosIds = new Set();
const AUDIO_ARMED_KEY = "lagonglong-alarm-armed";

function App() {
  const [audioEnabled, setAudioEnabled] = useState(() => {
    try {
      return window.localStorage.getItem(AUDIO_ARMED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [settings, setSettings] = useState(getSystemSettings());
  const [incidentAlerts, setIncidentAlerts] = useState([]);
  const [alarmActive, setAlarmActive] = useState(false);
  const [alarmPulse, setAlarmPulse] = useState(0);
  const alarmAudioRef = useRef(null);
  const openIncidentIdsRef = useRef(new Set());
  const openSosIdsRef = useRef(new Set());
  const alarmSyncVersionRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => subscribeToSettings(setSettings), []);

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
  const getAlertKey = useCallback(
    (collectionName, recordId) => `${collectionName}:${recordId}`,
    []
  );

  const isAuthorizedAdmin = useCallback(() => {
    if (!pb.authStore.isValid || !pb.authStore.model) return false;
    const role = pb.authStore.model.collectionName;
    return role === "admins" || role === "super_admins";
  }, []);

  const playAlarmSound = useCallback(() => {
    const alertSound =
      alarmAudioRef.current || document.getElementById("emergency-alert-sound");
    if (!alertSound || !settings.soundEnabled) return;

    // eslint-disable-next-line react-hooks/immutability
    alertSound.currentTime = 0;
    alertSound.play().catch((error) => {
      console.warn("Autoplay blocked. Admin must click screen first.", error);
    });
  }, [settings.soundEnabled]);

  const pauseAlarmSound = useCallback(() => {
    const alertSound =
      alarmAudioRef.current || document.getElementById("emergency-alert-sound");
    if (alertSound) {
      alertSound.pause();
      // eslint-disable-next-line react-hooks/immutability
      alertSound.currentTime = 0;
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

    const ensureAlarmPlaying = () => {
      const alertSound =
        alarmAudioRef.current ||
        document.getElementById("emergency-alert-sound");
      if (!alertSound) return;
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
      const alertSet =
        collectionName === "sos_tracking" ? alertedSosIds : alertedIncidentIds;

      let wasOpen = false;
      let isOpen = false;

      if (collectionName === "incident_reports") {
        wasOpen = nextIncidentIds.has(record.id);
        isOpen =
          action !== "delete" &&
          (action === "create" || isOpenIncident(record));

        if (isOpen) {
          nextIncidentIds.add(record.id);
        } else {
          nextIncidentIds.delete(record.id);
          alertSet.delete(record.id);
        }
      }

      if (collectionName === "sos_tracking") {
        wasOpen = nextSosIds.has(record.id);
        isOpen =
          action !== "delete" && (action === "create" || isOpenSos(record));

        if (isOpen) {
          nextSosIds.add(record.id);
        } else {
          nextSosIds.delete(record.id);
          alertSet.delete(record.id);
        }
      }

      openIncidentIdsRef.current = nextIncidentIds;
      openSosIdsRef.current = nextSosIds;
      setAlarmActive(nextIncidentIds.size + nextSosIds.size > 0);

      const shouldPulse =
        isOpen && !alertSet.has(record.id) && (!wasOpen || action === "create");
      if (shouldPulse) {
        alertSet.add(record.id);
        setAlarmPulse((pulse) => pulse + 1);
      }

      return shouldPulse;
    },
    [isAuthorizedAdmin, isOpenIncident, isOpenSos]
  );

  const reconcileAlarmState = useCallback(async () => {
    if (!isAuthorizedAdmin()) {
      setAlarmActive(false);
      return;
    }

    const syncVersion = ++alarmSyncVersionRef.current;

    try {
      const [openIncidentRecords, openSosRecords] = await Promise.all([
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
      ]);

      if (!isMountedRef.current || syncVersion !== alarmSyncVersionRef.current)
        return;

      const previousIncidentIds = openIncidentIdsRef.current;
      const previousSosIds = openSosIdsRef.current;
      const nextIncidentIds = new Set(
        openIncidentRecords.map((record) => record.id)
      );
      const nextSosIds = new Set(openSosRecords.map((record) => record.id));
      const hasNewIncident = [...nextIncidentIds].some(
        (id) => !previousIncidentIds.has(id)
      );
      const hasNewSos = [...nextSosIds].some((id) => !previousSosIds.has(id));

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

      openIncidentIdsRef.current = nextIncidentIds;
      openSosIdsRef.current = nextSosIds;
      setAlarmActive(nextIncidentIds.size + nextSosIds.size > 0);

      if (hasNewIncident || hasNewSos) {
        setAlarmPulse((pulse) => pulse + 1);
      }
    } catch (error) {
      const isAbort =
        error instanceof Error && "isAbort" in error && error.isAbort;
      if (!isAbort) console.error("Failed to reconcile alarm state:", error);
    }
  }, [isAuthorizedAdmin]);

  // Subscriptions & Listeners
  useEffect(() => {
    let incidentUnsubscribe;
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
        addAuditLog({
          action: "New Incident Reported",
          target: record.id,
          details: `${record.type || "Incident"} reported`,
          actor: "System",
        });

        if (settings.visualAlertsEnabled) {
          const alertKey = getAlertKey("incident_reports", record.id);
          setIncidentAlerts((prev) =>
            [
              {
                id: createUniqueId(),
                alertKey,
                label: `${getPriorityLabel(record)} ${String(record.type || "Incident").toUpperCase()}`,
                message: "New incident report requires review.",
              },
              ...prev.filter((alert) => alert.alertKey !== alertKey),
            ].slice(0, 3)
          );
          setTimeout(() => {
            setIncidentAlerts((prev) =>
              prev.filter((alert) => alert.alertKey !== alertKey)
            );
          }, 9000);
        }

        if (settings.browserNotificationsEnabled && "Notification" in window) {
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
        addAuditLog({
          action: "New SOS Received",
          target: record.id,
          details: "SOS distress call reported",
          actor: "System",
        });

        if (settings.visualAlertsEnabled) {
          const alertKey = getAlertKey("sos_tracking", record.id);
          setIncidentAlerts((prev) =>
            [
              {
                id: createUniqueId(),
                alertKey,
                label: "SOS ALERT",
                message: "New SOS distress call requires response.",
              },
              ...prev.filter((alert) => alert.alertKey !== alertKey),
            ].slice(0, 3)
          );
          setTimeout(() => {
            setIncidentAlerts((prev) =>
              prev.filter((alert) => alert.alertKey !== alertKey)
            );
          }, 9000);
        }

        if (settings.browserNotificationsEnabled && "Notification" in window) {
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
      incidentUnsubscribe?.();
      sosUnsubscribe?.();
    };
  }, [
    settings,
    isAuthorizedAdmin,
    reconcileAlarmState,
    syncSignalStateFromRecord,
    getAlertKey,
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
    }, 5000);

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
          .play()
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

  return (
    <div onClick={enableAudio} style={{ minHeight: "100vh", width: "100%" }}>
      <audio
        id="emergency-alert-sound"
        src="/notification_sound.mp3"
        preload="auto"
        loop
        ref={alarmAudioRef}
      />

      <div style={styles.alertStack}>
        {incidentAlerts.map((alert) => (
          <div key={alert.alertKey || alert.id} style={styles.incidentAlert}>
            <strong>{alert.label}</strong>
            <span>{alert.message}</span>
          </div>
        ))}
      </div>

      <MessageBoxProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/register" element={<Register />} />
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
          </Routes>
        </Router>
      </MessageBoxProvider>
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
