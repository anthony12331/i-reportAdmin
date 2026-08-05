const SETTINGS_KEY = "lagonglong-system-settings";

// Higher numbers appear first. Edit these values to change ranking order.
export const INCIDENT_TYPE_PRIORITY = {
  fire: 100,
  accident: 80,
  landslide: 70,
  police: 75,
  violence: 75,
  flood: 65,
  medical: 60,
  crime: 55,
  other: 10,
};

export const DEFAULT_RESPONDER_DEPARTMENTS = {
  fire: "Fire",
  accident: "MDRRMO",
  landslide: "MDRRMO",
  police: "police",
  violence: "police",
  other: "Fire",
};

const DEFAULT_PRIORITY = 1;
const CRITICAL_URGENCY_OFFSET = 100000;
const PRIORITY_WEIGHT = 10;

function readSavedSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

export function getIncidentPriority(incident) {
  const type = incident?.type?.toLowerCase?.().trim();
  const savedPriority = readSavedSettings().incidentPriority || {};
  const priorityMap = { ...INCIDENT_TYPE_PRIORITY, ...savedPriority };

  return priorityMap[type] ?? DEFAULT_PRIORITY;
}

export function getIncidentWaitMinutes(incident, now = Date.now()) {
  const createdAt = new Date(incident?.created || 0).getTime();
  if (!createdAt) return 0;

  return Math.max(0, Math.floor((now - createdAt) / 60000));
}

export function getPriorityLabel(incident) {
  const priority = getIncidentPriority(incident);
  if (priority >= 90) return "Critical";
  if (priority >= 70) return "High";
  if (priority >= 40) return "Elevated";
  return "Normal";
}

export function getPriorityStyles(incident) {
  const label = getPriorityLabel(incident);
  const styles = {
    Critical: { color: "#991b1b", bg: "#fee2e2", border: "#fecaca" },
    High: { color: "#9a3412", bg: "#ffedd5", border: "#fed7aa" },
    Elevated: { color: "#1d4ed8", bg: "#dbeafe", border: "#bfdbfe" },
    Normal: { color: "#065f46", bg: "#d1fae5", border: "#a7f3d0" },
  };

  return styles[label] || styles.Normal;
}

export function getResponderDepartmentForIncident(incident) {
  const type = incident?.type?.toLowerCase?.().trim();
  const savedRouting = readSavedSettings().responderDepartments || {};
  const routingMap = { ...DEFAULT_RESPONDER_DEPARTMENTS, ...savedRouting };
  const routedDepartment = routingMap[type] || routingMap.other || "Fire";
  return String(routedDepartment).trim() || "Fire";
}

export function getIncidentUrgencyScore(incident) {
  const priority = getIncidentPriority(incident);
  const waitMinutes = getIncidentWaitMinutes(incident);
  const criticalBoost =
    getPriorityLabel(incident) === "Critical" ? CRITICAL_URGENCY_OFFSET : 0;

  return criticalBoost + priority * PRIORITY_WEIGHT + waitMinutes;
}

export function sortIncidentReportsByPriority(reports) {
  return [...reports].sort((a, b) => {
    const urgencyDifference =
      getIncidentUrgencyScore(b) - getIncidentUrgencyScore(a);
    if (urgencyDifference !== 0) return urgencyDifference;

    const priorityDifference = getIncidentPriority(b) - getIncidentPriority(a);
    if (priorityDifference !== 0) return priorityDifference;

    return new Date(a.created || 0) - new Date(b.created || 0);
  });
}


