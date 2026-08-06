export function normalizeResponderDepartment(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function getResponderFullName(responder) {
  const fullName = [responder?.first_name, responder?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || responder?.unit_name || responder?.email || "Responder";
}

export function getResponderOptionLabel(responder) {
  const name = getResponderFullName(responder);
  const department = responder?.department ? ` - ${responder.department}` : "";
  const unit = responder?.unit_name ? ` - ${responder.unit_name}` : "";
  const status = responder?.is_available === false ? " (busy)" : "";

  return `${name}${department}${unit}${status}`;
}

export function getRespondersForDepartment(responders, department) {
  const normalizedDepartment = normalizeResponderDepartment(department);
  const matchingResponders = responders.filter(
    (responder) =>
      normalizeResponderDepartment(responder?.department) ===
      normalizedDepartment,
  );

  return matchingResponders.length > 0 ? matchingResponders : responders;
}


