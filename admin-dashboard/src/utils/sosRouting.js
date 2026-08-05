const SOS_ROUTING_KEY = "lagonglong-sos-routing";

export const DEFAULT_SOS_RESPONDER_DEPARTMENTS = {
  fire: "Fire",
  accident: "MDRRMO",
  landslide: "MDRRMO",
  medical: "ambulance",
  rescue: "MDRRMO",
  other: "Fire",
  default: "Fire",
};

function readSavedRouting() {
  try {
    return JSON.parse(localStorage.getItem(SOS_ROUTING_KEY)) || {};
  } catch {
    return {};
  }
}

export function getSosResponderDepartment(sosSignal) {
  const savedRouting = readSavedRouting().responderDepartments || {};
  const routingMap = { ...DEFAULT_SOS_RESPONDER_DEPARTMENTS, ...savedRouting };
  const incidentType =
    sosSignal?.expand?.incident_id?.type ||
    sosSignal?.incident_id?.type ||
    sosSignal?.incident_type ||
    sosSignal?.type ||
    "";
  const normalizedType = String(incidentType).toLowerCase().trim();

  return (
    String(routingMap[normalizedType] || routingMap.default || "Fire").trim() ||
    "Fire"
  );
}


