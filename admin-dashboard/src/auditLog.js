const AUDIT_LOG_KEY = 'lagonglong-audit-log';
const MAX_LOGS = 300;

function createUniqueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getAuditLogs() {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_LOG_KEY)) || [];
  } catch {
    return [];
  }
}

export function addAuditLog({ action, target, details, actor }) {
  const logs = getAuditLogs();
  const entry = {
    id: createUniqueId(),
    action,
    target,
    details,
    actor: actor || 'Admin',
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify([entry, ...logs].slice(0, MAX_LOGS)));
  window.dispatchEvent(new CustomEvent('lagonglong-audit-log-updated'));
  return entry;
}

export function clearAuditLogs() {
  localStorage.removeItem(AUDIT_LOG_KEY);
  window.dispatchEvent(new CustomEvent('lagonglong-audit-log-updated'));
}
