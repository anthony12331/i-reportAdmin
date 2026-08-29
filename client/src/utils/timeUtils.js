export function formatWaitTime(created) {
  const createdAt = new Date(created).getTime();
  if (!createdAt) return "Unknown wait";

  const totalMinutes = Math.max(
    0,
    Math.floor((Date.now() - createdAt) / 60000),
  );
  if (totalMinutes < 1) return "Just reported";
  if (totalMinutes < 60) return `${totalMinutes}m waiting`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m waiting` : `${hours}h waiting`;
}

/**
 * Calculates and formats the duration between two timestamps.
 * @param {string|Date} startTime - Start time (e.g. incident.created)
 * @param {string|Date} endTime - End time (e.g. incident.updated or dispatch.created)
 * @returns {string} Formatted duration (e.g. "4m 12s", "24m", "1h 15m")
 */
export function calculateResponseDuration(startTime, endTime) {
  if (!startTime || !endTime) return "N/A";
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return "< 1 min";

  const diffMs = end - start;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) {
    return `${Math.max(1, diffSec)}s`;
  }
  if (diffMin < 60) {
    const sec = diffSec % 60;
    return sec > 0 ? `${diffMin}m ${sec}s` : `${diffMin}m`;
  }
  if (diffHours < 24) {
    const mins = diffMin % 60;
    return mins > 0 ? `${diffHours}h ${mins}m` : `${diffHours}h`;
  }
  const remHours = diffHours % 24;
  return remHours > 0 ? `${diffDays}d ${remHours}h` : `${diffDays}d`;
}

/**
 * Retrieves the responder's uploaded response_time field directly from the incident or dispatches.
 * @param {Object} incident - Incident or SOS record with optional dispatches
 * @returns {string} The recorded response time
 */
export function getIncidentResponseTime(incident) {
  if (!incident) return "N/A";

  // 1. Direct responder-submitted response_time on the incident/SOS record
  if (incident.response_time && String(incident.response_time).trim() !== "") {
    const val = String(incident.response_time).trim();
    return /^\d+$/.test(val) ? `${val} mins` : val;
  }

  // 2. Check responder dispatches response_time field
  if (incident.dispatches && Array.isArray(incident.dispatches) && incident.dispatches.length > 0) {
    const dispatchWithTime = incident.dispatches.find(
      (d) => d.response_time && String(d.response_time).trim() !== ""
    );
    if (dispatchWithTime) {
      const val = String(dispatchWithTime.response_time).trim();
      return /^\d+$/.test(val) ? `${val} mins` : val;
    }
  }

  // 3. Fallback to computed duration if responder has not explicitly uploaded a custom string
  const timing = getIncidentTimingMetrics(incident);
  return timing.resolutionDuration || timing.dispatchDuration || "N/A";
}

/**
 * Returns breakdown of dispatch response time and total resolution time.
 */
export function getIncidentTimingMetrics(incident) {
  if (!incident) return { dispatchDuration: null, resolutionDuration: "N/A" };
  const created = incident.created;
  const resolved = incident.updated || incident.resolved_at;

  let firstDispatchCreated = null;
  if (incident.dispatches && incident.dispatches.length > 0) {
    const sorted = [...incident.dispatches].sort((a, b) => new Date(a.created) - new Date(b.created));
    firstDispatchCreated = sorted[0].created;
  } else if (incident.dispatched_at) {
    firstDispatchCreated = incident.dispatched_at;
  }

  return {
    dispatchDuration: firstDispatchCreated ? calculateResponseDuration(created, firstDispatchCreated) : null,
    resolutionDuration: calculateResponseDuration(created, resolved),
  };
}



