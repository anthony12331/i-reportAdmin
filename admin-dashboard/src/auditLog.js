import { pb } from "./pocketbase";

const AUDIT_LOG_KEY = "lagonglong-audit-log";
const MAX_LOGS = 300;

function createUniqueId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
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

/**
 * Helper to extract the true identity of the logged-in admin from your specific schema.
 */
function getActiveAdminName(passedActor) {
  // 1. If an actor was passed AND it is NOT the generic word "Admin" or "System", trust it.
  if (passedActor && passedActor !== "Admin" && passedActor !== "System") {
    return passedActor;
  }

  // 2. Grab the currently authenticated user from PocketBase
  const admin = pb.authStore.model;
  if (!admin) {
    return passedActor || "System / Automated";
  }

  // 3. Construct the full name using your exact database schema fields
  const firstName = admin.first_name || "";
  const lastName = admin.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();

  // 4. Return Full Name -> fall back to Email -> fall back to "System Admin"
  return fullName || admin.email || "System Admin";
}

export function addAuditLog({ action, target, details, actor }) {
  const logs = getAuditLogs();

  // Resolve the real name using our smart helper
  const resolvedAdminName = getActiveAdminName(actor);

  const entry = {
    id: createUniqueId(),
    action,
    target: target || "N/A",
    details: details || "",
    actor: resolvedAdminName,
    createdAt: new Date().toISOString(),
  };

  // Save to local browser storage
  localStorage.setItem(
    AUDIT_LOG_KEY,
    JSON.stringify([entry, ...logs].slice(0, MAX_LOGS)),
  );
  window.dispatchEvent(new CustomEvent("lagonglong-audit-log-updated"));

  // Send to PocketBase (populating both actor and admin_name columns)
  if (pb.authStore.isValid) {
    pb.collection("audit_logs")
      .create({
        action,
        target: target || "N/A",
        details: details || "",
        actor: resolvedAdminName, // Keeps legacy table layouts working
        admin_name: resolvedAdminName, // Populates your new audit_logs field
      })
      .catch((err) =>
        console.warn("Failed to sync audit log to database:", err),
      );
  }

  return entry;
}

export function clearAuditLogs() {
  localStorage.removeItem(AUDIT_LOG_KEY);
  window.dispatchEvent(new CustomEvent("lagonglong-audit-log-updated"));
}
