import { DEFAULT_RESPONDER_DEPARTMENTS, INCIDENT_TYPE_PRIORITY } from './incidentPriority';

export const DEFAULT_SETTINGS = {
  soundEnabled: true,
  visualAlertsEnabled: true,
  browserNotificationsEnabled: false,
  incidentPriority: { ...INCIDENT_TYPE_PRIORITY },
  responderDepartments: { ...DEFAULT_RESPONDER_DEPARTMENTS },
};

const SETTINGS_KEY = 'lagonglong-system-settings';
export const SETTINGS_EVENT = 'lagonglong-settings-updated';

export function getSystemSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      incidentPriority: {
        ...DEFAULT_SETTINGS.incidentPriority,
        ...(saved?.incidentPriority || {}),
      },
      responderDepartments: {
        ...DEFAULT_SETTINGS.responderDepartments,
        ...(saved?.responderDepartments || {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSystemSettings(settings) {
  const nextSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    incidentPriority: {
      ...DEFAULT_SETTINGS.incidentPriority,
      ...(settings.incidentPriority || {}),
    },
    responderDepartments: {
      ...DEFAULT_SETTINGS.responderDepartments,
      ...(settings.responderDepartments || {}),
    },
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: nextSettings }));
  return nextSettings;
}

export function subscribeToSettings(callback) {
  const handleUpdate = (event) => callback(event.detail || getSystemSettings());
  window.addEventListener(SETTINGS_EVENT, handleUpdate);
  window.addEventListener('storage', handleUpdate);

  return () => {
    window.removeEventListener(SETTINGS_EVENT, handleUpdate);
    window.removeEventListener('storage', handleUpdate);
  };
}
