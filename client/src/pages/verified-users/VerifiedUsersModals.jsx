import { memo } from "react";
import { Ban, ShieldCheck, User, X } from "lucide-react";
import { getVerifiedUserDetails } from "./verifiedUsersUtils";

function DetailsGrid({ user }) {
  const details = getVerifiedUserDetails(user);

  return (
    <div style={styles.detailsGrid}>
      {details.map((item) => (
        <div key={item.label} style={styles.detailItem}>
          <span style={styles.detailLabel}>{item.label}</span>
          <span style={styles.detailValue}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function MediaPanel({ label, src, alt }) {
  return (
    <section style={styles.reviewPanel}>
      <span style={styles.panelLabel}>{label}</span>
      {src ? (
        <img src={src} alt={alt} style={styles.reviewImage} />
      ) : (
        <div style={styles.emptyMedia}>
          <User size={34} color="#94a3b8" />
          <span style={styles.emptyMediaText}>
            No {label.toLowerCase()} available
          </span>
        </div>
      )}
    </section>
  );
}

export const UserImagePreviewModal = memo(function UserImagePreviewModal({
  src,
  onClose,
}) {
  if (!src) return null;

  return (
    <div style={styles.darkOverlay} onClick={onClose}>
      <div
        style={styles.previewShell}
        onClick={(event) => event.stopPropagation()}
      >
        <img src={src} style={styles.previewImage} alt="Preview" />
        <button
          type="button"
          onClick={onClose}
          style={styles.previewCloseButton}
        >
          <X size={32} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
});

export const VerifiedUserReviewModal = memo(function VerifiedUserReviewModal({
  user,
  selfieUrl,
  idPhotoUrl,
  onClose,
}) {
  if (!user) return null;

  return (
    <div style={styles.darkOverlay} onClick={onClose}>
      <div
        style={styles.reviewModal}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.reviewHeader}>
          <div>
            <h2 style={styles.reviewTitle}>User Review</h2>
            <p style={styles.reviewSubtitle}>
              Inspect the selfie, ID photo, and profile details in one place.
            </p>
          </div>
          <button type="button" onClick={onClose} style={styles.closeButton}>
            <X size={18} />
          </button>
        </div>

        <div style={styles.reviewGrid}>
          <MediaPanel label="Selfie" src={selfieUrl} alt="Selfie preview" />
          <MediaPanel label="ID Photo" src={idPhotoUrl} alt="ID preview" />
        </div>

        <div style={styles.reviewDetails}>
          <div style={styles.reviewName}>
            {user.first_name} {user.middle_name} {user.last_name}
          </div>
          <DetailsGrid user={user} />
        </div>
      </div>
    </div>
  );
});

export const VerifiedUserDetailsModal = memo(function VerifiedUserDetailsModal({
  user,
  profileImageUrl,
  idPhotoUrl,
  isProcessing,
  onClose,
  onOpenPreview,
  onRequestSuspend,
  onRequestUnsuspend,
}) {
  if (!user) return null;

  return (
    <div style={styles.staticOverlay}>
      <button type="button" onClick={onClose} style={styles.modalCloseButton}>
        <X size={18} />
      </button>

      <div style={styles.detailsModal}>
        <div style={styles.detailsHeader}>
          <div>
            <h2 style={styles.detailsTitle}>
              {user.first_name} {user.last_name}
            </h2>
            <p style={styles.detailsSubtitle}>
              Verified citizen profile and management
            </p>
          </div>
          <div style={styles.actionRow}>
            {user.status === "suspended" ? (
              <button
                type="button"
                onClick={() => onRequestUnsuspend(user)}
                disabled={isProcessing}
                style={styles.unsuspendBtn}
              >
                <ShieldCheck size={16} />
                {isProcessing ? "Processing..." : "Unsuspend User"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onRequestSuspend(user)}
                disabled={isProcessing}
                style={styles.suspendBtn}
              >
                <Ban size={16} />
                {isProcessing ? "Processing..." : "Suspend Verification"}
              </button>
            )}
          </div>
        </div>

        <div style={styles.detailsBody}>
          <div style={styles.detailsGridLayout}>
            <aside style={styles.profileCard}>
              <div style={styles.profileCardHeader}>
                <div>
                  <h3 style={styles.profileName}>
                    {user.first_name} {user.last_name}
                  </h3>
                  <p style={styles.profileSubtitle}>
                    {user.position || "Verified Citizen"}
                  </p>
                </div>
                <span style={styles.profileBadge}>
                  <ShieldCheck size={14} /> ID: {user.user_id}
                </span>
              </div>

              <button
                type="button"
                style={{
                  ...styles.profilePhotoBtn,
                  cursor: profileImageUrl ? "zoom-in" : "default",
                }}
                onClick={() =>
                  profileImageUrl && onOpenPreview(profileImageUrl)
                }
                aria-label="View large selfie"
              >
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt="Selfie"
                    style={styles.profilePhoto}
                  />
                ) : (
                  <User size={64} color="#0f172a" />
                )}
              </button>

              {idPhotoUrl && (
                <button
                  type="button"
                  style={styles.idPhotoBtn}
                  onClick={() => onOpenPreview(idPhotoUrl)}
                  aria-label="View large ID photo"
                >
                  <p style={styles.imageLabel}>ID Document</p>
                  <img
                    src={idPhotoUrl}
                    alt="ID Photo"
                    style={styles.profilePhoto}
                  />
                </button>
              )}
            </aside>

            <section style={styles.detailsPanel}>
              <div style={styles.detailsPanelHeader}>
                <div>
                  <h3 style={styles.panelTitle}>Profile Details</h3>
                  <p style={styles.panelSubtitle}>System record information.</p>
                </div>
              </div>

              <DetailsGrid user={user} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
});

export const SuspendedUsersModal = memo(function SuspendedUsersModal({
  isOpen,
  users,
  onClose,
  onViewUser,
}) {
  if (!isOpen) return null;

  return (
    <div style={styles.staticOverlay}>
      <div style={styles.suspendedPopupBox}>
        <div style={styles.popupHeader}>
          <div>
            <h2 style={styles.popupTitle}>Suspended Users</h2>
            <p style={styles.popupSubtitle}>
              Manage users who have lost verification access.
            </p>
          </div>
          <button type="button" onClick={onClose} style={styles.closeButton}>
            <X size={18} />
          </button>
        </div>

        <div style={styles.popupBody}>
          {users.length === 0 ? (
            <div style={styles.emptyState}>No suspended users found.</div>
          ) : (
            <div style={styles.suspendedList}>
              {users.map((user) => (
                <div key={user.id} style={styles.suspendedItem}>
                  <div>
                    <strong>
                      {user.first_name} {user.last_name}
                    </strong>
                    <p style={styles.suspendedMeta}>
                      ID #{user.user_id || "N/A"} · {user.email || "No email"}
                    </p>
                  </div>
                  <button
                    type="button"
                    style={styles.viewBtn}
                    onClick={() => onViewUser(user)}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export const SuspendPromptModal = memo(function SuspendPromptModal({
  isOpen,
  user,
  message,
  onMessageChange,
  onCancel,
  onConfirm,
  isProcessing,
}) {
  if (!isOpen || !user) return null;

  return (
    <div style={styles.promptOverlay}>
      <div style={styles.promptBox}>
        <div style={styles.promptHeader}>
          <h3>Suspend Verification</h3>
          <p>
            Enter a reason to log and confirm the suspension for{" "}
            {user.first_name} {user.last_name}.
          </p>
        </div>
        <textarea
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          placeholder="Suspension reason"
          style={styles.promptTextarea}
        />
        <div style={styles.promptActions}>
          <button type="button" style={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            style={styles.confirmBtn}
            onClick={() => onConfirm(user, message)}
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : "Confirm Suspend"}
          </button>
        </div>
        <p style={styles.dangerText}>
          Suspended users cannot access the system until their verification is
          restored.
        </p>
      </div>
    </div>
  );
});

const styles = {
  darkOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    zIndex: 1100,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
  },
  staticOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    backdropFilter: "blur(8px)",
    zIndex: 1000,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
  },
  previewShell: {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    maxWidth: "95%",
    maxHeight: "95vh",
    borderRadius: "12px",
    objectFit: "contain",
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
  },
  previewCloseButton: {
    position: "absolute",
    top: "20px",
    right: "20px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewModal: {
    width: "min(1120px, 100%)",
    maxHeight: "92vh",
    overflow: "auto",
    backgroundColor: "#0f172a",
    borderRadius: "18px",
    boxShadow: "0 30px 80px rgba(15, 23, 42, 0.45)",
    padding: "22px",
  },
  reviewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "18px",
  },
  reviewTitle: {
    margin: 0,
    fontSize: "22px",
    color: "#f8fafc",
  },
  reviewSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },
  closeButton: {
    border: "none",
    backgroundColor: "#f1f5f9",
    color: "#f8fafc",
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
    marginBottom: "18px",
  },
  reviewPanel: {
    backgroundColor: "#0f172a",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "14px",
  },
  panelLabel: {
    display: "block",
    fontSize: "12px",
    fontWeight: 800,
    color: "#cbd5e1",
    marginBottom: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  reviewImage: {
    width: "100%",
    height: "320px",
    objectFit: "cover",
    borderRadius: "12px",
    backgroundColor: "#0f172a",
  },
  emptyMedia: {
    width: "100%",
    height: "320px",
    borderRadius: "12px",
    backgroundColor: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: "8px",
    color: "#cbd5e1",
  },
  emptyMediaText: {
    fontSize: "13px",
    fontWeight: 700,
  },
  reviewDetails: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: "18px",
  },
  reviewName: {
    fontSize: "18px",
    fontWeight: 900,
    color: "#f8fafc",
    marginBottom: "12px",
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "10px",
  },
  detailItem: {
    backgroundColor: "#0f172a",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "12px 14px",
    display: "grid",
    gap: "4px",
  },
  detailLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    color: "#64748b",
    fontWeight: 800,
  },
  detailValue: {
    fontSize: "14px",
    color: "#f8fafc",
    fontWeight: 700,
    lineHeight: "1.35",
  },
  detailsModal: {
    width: "100%",
    maxWidth: "960px",
    backgroundColor: "#0f172a",
    borderRadius: "24px",
    padding: "32px",
    boxShadow: "0 30px 80px rgba(15, 23, 42, 0.22)",
    overflowY: "auto",
    maxHeight: "90vh",
    border: "1px solid rgba(15, 23, 42, 0.08)",
  },
  modalCloseButton: {
    position: "absolute",
    top: "24px",
    right: "24px",
    width: "46px",
    height: "46px",
    borderRadius: "16px",
    border: "1px solid rgba(226,232,240,0.8)",
    backgroundColor: "#0f172a",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.14)",
    zIndex: 1010,
  },
  detailsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "22px",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "18px",
    flexWrap: "wrap",
  },
  detailsTitle: {
    margin: 0,
    fontSize: "24px",
    color: "#f8fafc",
    letterSpacing: "-0.02em",
    lineHeight: "1.15",
  },
  detailsSubtitle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: "14px",
    lineHeight: "1.5",
  },
  actionRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  suspendBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    backgroundColor: "#fef2f2",
    color: "#dc2626",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  unsuspendBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    backgroundColor: "#ecfdf5",
    color: "#059669",
    border: "1px solid #a7f3d0",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  detailsBody: {
    display: "grid",
    gap: "24px",
  },
  detailsGridLayout: {
    display: "grid",
    gridTemplateColumns: "minmax(300px, 340px) minmax(0, 1fr)",
    gap: "22px",
    alignItems: "start",
  },
  profileCard: {
    backgroundColor: "#0f172a",
    borderRadius: "20px",
    padding: "20px",
    display: "grid",
    gap: "18px",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
  },
  profileCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "14px",
    flexWrap: "wrap",
  },
  profileName: {
    margin: 0,
    fontSize: "20px",
    lineHeight: 1.15,
    color: "#f8fafc",
  },
  profileSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },
  profileBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "7px 10px",
    borderRadius: "999px",
    backgroundColor: "#ecfdf5",
    color: "#065f46",
    fontWeight: 700,
    fontSize: "11px",
    border: "1px solid #d1fae5",
    whiteSpace: "nowrap",
  },
  profilePhotoBtn: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: "22px",
    overflow: "hidden",
    backgroundColor: "#eef2ff",
    display: "grid",
    placeItems: "center",
    boxShadow: "0 15px 40px rgba(15, 23, 42, 0.08)",
    padding: 0,
    border: "none",
  },
  profilePhoto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  idPhotoBtn: {
    borderRadius: "18px",
    backgroundColor: "white",
    padding: "14px",
    border: "1px solid #e5e8f0",
    display: "grid",
    gap: "8px",
    textAlign: "center",
    cursor: "zoom-in",
    width: "100%",
  },
  imageLabel: {
    margin: 0,
    fontSize: "12px",
    color: "#cbd5e1",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  detailsPanel: {
    backgroundColor: "white",
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
  },
  detailsPanelHeader: {
    marginBottom: "18px",
  },
  panelTitle: {
    margin: 0,
    fontSize: "17px",
    color: "#f8fafc",
  },
  panelSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  suspendedPopupBox: {
    width: "600px",
    maxWidth: "95%",
    backgroundColor: "white",
    borderRadius: "28px",
    padding: "28px",
    boxShadow: "0 35px 90px rgba(15, 23, 42, 0.18)",
    position: "relative",
  },
  popupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    marginBottom: "22px",
  },
  popupTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "900",
    color: "#111827",
  },
  popupSubtitle: {
    margin: "8px 0 0",
    color: "#6b7280",
    fontSize: "14px",
  },
  popupBody: {
    maxHeight: "420px",
    overflowY: "auto",
  },
  suspendedList: {
    display: "grid",
    gap: "14px",
  },
  suspendedItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px 20px",
    borderRadius: "18px",
    border: "1px solid #e5e7eb",
    backgroundColor: "#0f172a",
  },
  suspendedMeta: {
    margin: "6px 0 0",
    fontSize: "13px",
    color: "#6b7280",
  },
  emptyState: {
    textAlign: "center",
    padding: "80px 20px",
    color: "#9ca3af",
    fontSize: "16px",
  },
  viewBtn: {
    padding: "10px 18px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    backgroundColor: "white",
    color: "#111827",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
  },
  promptOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1100,
    padding: "20px",
  },
  promptBox: {
    width: "100%",
    maxWidth: "520px",
    backgroundColor: "white",
    borderRadius: "24px",
    padding: "28px",
    boxShadow: "0 35px 90px rgba(15, 23, 42, 0.18)",
  },
  promptHeader: {
    marginBottom: "18px",
  },
  promptTextarea: {
    width: "100%",
    minHeight: "140px",
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    resize: "vertical",
    color: "#111827",
  },
  promptActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "18px",
  },
  cancelBtn: {
    padding: "12px 18px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    backgroundColor: "white",
    cursor: "pointer",
    fontWeight: "700",
  },
  confirmBtn: {
    padding: "12px 18px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#dc2626",
    color: "white",
    cursor: "pointer",
    fontWeight: "700",
  },
  dangerText: {
    marginTop: "16px",
    color: "#991b1b",
    fontSize: "13px",
    fontWeight: "600",
  },
};


