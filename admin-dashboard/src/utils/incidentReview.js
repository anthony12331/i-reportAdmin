const REVIEWED_INCIDENTS_KEY = "lagonglong-reviewed-incidents";

export function getReviewedIncidentIds() {
  try {
    return new Set(
      JSON.parse(localStorage.getItem(REVIEWED_INCIDENTS_KEY)) || [],
    );
  } catch {
    return new Set();
  }
}

export function isIncidentReviewed(id) {
  return getReviewedIncidentIds().has(id);
}

export function markIncidentReviewed(id) {
  if (!id) return;

  const reviewed = getReviewedIncidentIds();
  reviewed.add(id);
  localStorage.setItem(REVIEWED_INCIDENTS_KEY, JSON.stringify([...reviewed]));
  window.dispatchEvent(
    new CustomEvent("lagonglong-incident-reviewed", { detail: id }),
  );
}


