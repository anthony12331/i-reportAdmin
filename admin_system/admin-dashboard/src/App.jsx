import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { pb } from './pocketbase';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import OngoingIncidents from './ongoing-incidents';
import ResolvedIncidents from './resolved-incidents';
import PendingUserRegistration from './pending-users';
import PendingIncidents from './pending-incidents';
import VerifiedUsers from './verified-users';
import { MessageBoxProvider } from './MessageBox';
import { addAuditLog } from './auditLog';
import { getPriorityLabel } from './incidentPriority';
import { getSystemSettings, subscribeToSettings } from './systemSettings';

const alertedIncidentIds = new Set();

function App() {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [settings, setSettings] = useState(getSystemSettings());
  const [incidentAlerts, setIncidentAlerts] = useState([]);
  const [alarmActive, setAlarmActive] = useState(false);
  const [alarmPulse, setAlarmPulse] = useState(0);
  const alarmAudioRef = useRef(null);
  const openIncidentIdsRef = useRef(new Set());
  const alarmSyncVersionRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => subscribeToSettings(setSettings), []);

  useEffect(() => {
    const audio = document.getElementById('emergency-alert-sound');
    if (audio) {
      audio.loop = true;
      audio.preload = 'auto';
      alarmAudioRef.current = audio;
    }

    return () => {
      alarmAudioRef.current = null;
    };
  }, []);

  const createUniqueId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `alarm-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const isOpenIncident = (record) => ['new', 'pending'].includes(record?.status);

  const playAlarmSound = () => {
    const alertSound = alarmAudioRef.current || document.getElementById('emergency-alert-sound');
    if (!alertSound || !settings.soundEnabled) return;

    alertSound.currentTime = 0;
    alertSound.play().catch(error => {
      console.warn('Autoplay blocked. Admin must click screen first.', error);
    });
  };

  const pauseAlarmSound = () => {
    const alertSound = alarmAudioRef.current || document.getElementById('emergency-alert-sound');
    if (alertSound) {
      alertSound.pause();
      alertSound.currentTime = 0;
    }
  };

  useEffect(() => {
    if (!alarmActive) {
      pauseAlarmSound();
      return;
    }

    if (audioEnabled && settings.soundEnabled) {
      playAlarmSound();
    }
  }, [alarmActive, alarmPulse, audioEnabled, settings.soundEnabled]);

  useEffect(() => {
    if (!alarmActive || !audioEnabled || !settings.soundEnabled) return;

    const ensureAlarmPlaying = () => {
      const alertSound = alarmAudioRef.current || document.getElementById('emergency-alert-sound');
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
    window.addEventListener('focus', ensureAlarmPlaying);
    window.addEventListener('pageshow', ensureAlarmPlaying);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', ensureAlarmPlaying);
      window.removeEventListener('pageshow', ensureAlarmPlaying);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [alarmActive, audioEnabled, settings.soundEnabled, alarmPulse]);

  const syncAlarmStateFromRecord = (record, action) => {
    if (!record?.id) return false;

    alarmSyncVersionRef.current += 1;

    const nextIds = new Set(openIncidentIdsRef.current);
    const wasOpen = nextIds.has(record.id);
    const isOpen = action !== 'delete' && (action === 'create' || isOpenIncident(record));

    if (isOpen) {
      nextIds.add(record.id);
    } else {
      nextIds.delete(record.id);
      alertedIncidentIds.delete(record.id);
    }

    openIncidentIdsRef.current = nextIds;
    setAlarmActive(nextIds.size > 0);

    const shouldPulse = isOpen && !alertedIncidentIds.has(record.id) && (!wasOpen || action === 'create');
    if (shouldPulse) {
      alertedIncidentIds.add(record.id);
      setAlarmPulse(pulse => pulse + 1);
    }

    return shouldPulse;
  };

  const reconcileAlarmState = async () => {
    const syncVersion = ++alarmSyncVersionRef.current;

    try {
      const openRecords = await pb.collection('incident_reports').getFullList({
        filter: 'status = "new" || status = "pending"',
        fields: 'id',
        requestKey: null,
      });

      if (!isMountedRef.current || syncVersion !== alarmSyncVersionRef.current) return;

      const previousIds = openIncidentIdsRef.current;
      const nextIds = new Set(openRecords.map(record => record.id));
      const hasNewIncident = [...nextIds].some(id => !previousIds.has(id));
      for (const alertedId of alertedIncidentIds) {
        if (!nextIds.has(alertedId)) {
          alertedIncidentIds.delete(alertedId);
        }
      }
      openIncidentIdsRef.current = nextIds;
      setAlarmActive(nextIds.size > 0);

      if (hasNewIncident) {
        setAlarmPulse(pulse => pulse + 1);
      }
    } catch (error) {
      if (!error.isAbort) console.error('Failed to reconcile alarm state:', error);
    }
  };

  useEffect(() => {
    let unsubscribe;

    isMountedRef.current = true;
    reconcileAlarmState();

    const startSubscription = async () => {
      unsubscribe = await pb.collection('incident_reports').subscribe('*', (e) => {
        if (!isMountedRef.current || !e?.record) return;

        const shouldAlert = syncAlarmStateFromRecord(e.record, e.action);

        if (!shouldAlert) return;

        try {
          addAuditLog({
            action: 'New Incident Reported',
            target: e.record.id,
            details: `${e.record.type || 'Incident'} reported`,
            actor: 'System',
          });

          if (settings.visualAlertsEnabled) {
            const incidentId = e.record.id;
            setIncidentAlerts(prev => [
              {
                id: createUniqueId(),
                incidentId,
                type: e.record.type || 'incident',
                priority: getPriorityLabel(e.record),
              },
              ...prev.filter(alert => alert.incidentId !== incidentId),
            ].slice(0, 3));
            setTimeout(() => {
              setIncidentAlerts(prev => prev.filter(alert => alert.incidentId !== incidentId));
            }, 9000);
          }

          if (settings.browserNotificationsEnabled && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              new Notification('New emergency report', { body: `${e.record.type || 'Incident'} needs review.` });
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission();
            }
          }
        } catch (error) {
          console.error('Incident alarm handler failed:', error);
        }
      });
    };

    startSubscription();

    return () => {
      isMountedRef.current = false;
      unsubscribe?.();
    };
  }, [settings]);

  useEffect(() => {
    const handleIncidentHandled = () => {
      reconcileAlarmState();
    };

    window.addEventListener('incident-handled', handleIncidentHandled);
    return () => window.removeEventListener('incident-handled', handleIncidentHandled);
  }, []);

  useEffect(() => {
    const pollingTimer = window.setInterval(() => {
      reconcileAlarmState();
    }, 5000);

    return () => window.clearInterval(pollingTimer);
  }, []);

  useEffect(() => {
    const unlockAudioGlobally = () => enableAudio();
    window.addEventListener('pointerdown', unlockAudioGlobally, { capture: true, once: true });
    window.addEventListener('keydown', unlockAudioGlobally, { capture: true, once: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudioGlobally, { capture: true });
      window.removeEventListener('keydown', unlockAudioGlobally, { capture: true });
    };
  }, []);

  useEffect(() => {
    const handleAlarmAudioUnlock = () => {
      enableAudio();
    };

    window.addEventListener('alarm-audio-unlock', handleAlarmAudioUnlock);

    return () => {
      window.removeEventListener('alarm-audio-unlock', handleAlarmAudioUnlock);
    };
  }, []);

  const enableAudio = () => {
    if (!audioEnabled) {
      setAudioEnabled(true);
      const alertSound = alarmAudioRef.current || document.getElementById('emergency-alert-sound');
      if (alertSound) {
        alertSound.play().then(() => {
          alertSound.pause();
          alertSound.currentTime = 0;
        }).catch(e => console.log('Audio unlock failed:', e));
      }
      if (alarmActive) {
        playAlarmSound();
      }
    }
  };

  return (
    <div onClick={enableAudio} style={{ minHeight: '100vh', width: '100%' }}>
      <audio id="emergency-alert-sound" src="/notification_sound.mp3" preload="auto" loop ref={alarmAudioRef} />

      <div style={styles.alertStack}>
        {incidentAlerts.map(alert => (
          <div key={alert.incidentId || alert.id} style={styles.incidentAlert}>
            <strong>{alert.priority} {alert.type.toUpperCase()}</strong>
            <span>New incident report requires review.</span>
          </div>
        ))}
      </div>

      <MessageBoxProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pending-users" element={<PendingUserRegistration />} />
            <Route path="/verified-users" element={<VerifiedUsers />} />
            <Route path="/pending-incidents" element={<PendingIncidents />} />
            <Route path="/ongoing-incidents" element={<OngoingIncidents />} />
            <Route path="/resolved-incidents" element={<ResolvedIncidents />} />
          </Routes>
        </Router>
      </MessageBoxProvider>
    </div>
  );
}

const styles = {
  alertStack: {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: 15000,
    display: 'grid',
    gap: '10px',
    width: 'min(360px, calc(100vw - 32px))',
  },
  incidentAlert: {
    display: 'grid',
    gap: '4px',
    padding: '14px 16px',
    borderRadius: '8px',
    borderLeft: '5px solid #ef4444',
    backgroundColor: 'white',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.22)',
    color: '#111827',
    fontSize: '13px',
  },
};

export default App;
