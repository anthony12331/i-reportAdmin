import { memo, useState } from "react";
import {
  Ban,
  ShieldCheck,
  ShieldAlert,
  User,
  UserX,
  X,
  Search,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
} from "lucide-react";
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(12px)",
        zIndex: 99999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px",
        animation: "messageBoxOverlayIn 0.2s ease forwards",
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "680px",
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 30px 80px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.15)",
          display: "flex",
          flexDirection: "column",
          animation: "messageBoxDialogIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 12px",
                borderRadius: "14px",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#15803d",
                fontSize: "12.5px",
                fontWeight: "700",
              }}
            >
              Citizen Profile Photo
            </span>
          </div>

          <button
            type="button"
            className="animatedCloseButton"
            onClick={onClose}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              color: "#475569",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.18s ease",
            }}
            aria-label="Close photo preview"
          >
            <X size={18} />
          </button>
        </div>

        {/* Large Image Canvas */}
        <div
          style={{
            width: "100%",
            height: "540px",
            maxHeight: "78vh",
            backgroundColor: "#090d16",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            padding: "16px",
          }}
        >
          <img
            src={src}
            alt="Citizen Profile"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              borderRadius: "10px",
              aspectRatio: "auto",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.5)",
            }}
          />
        </div>
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
          <button type="button" className="verifiedUsersButton animatedCloseButton" onClick={onClose} style={styles.closeButton}>
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
      <div style={styles.detailsModal}>
        <button type="button" className="verifiedUsersButton animatedCloseButton" onClick={onClose} style={styles.modalCloseButton}>
          <X size={18} />
        </button>

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
                className="verifiedUsersButton"
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
                className="verifiedUsersButton"
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
                className="verifiedUsersButton"
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
                  className="verifiedUsersButton"
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
  users = [],
  onClose,
  onViewUser,
  onUnsuspend,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const name = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
    const email = (u.email || "").toLowerCase();
    const citizenId = String(u.user_id || "").toLowerCase();
    const barangay = (u.baranggay || u.barangay || "").toLowerCase();
    return (
      name.includes(term) ||
      email.includes(term) ||
      citizenId.includes(term) ||
      barangay.includes(term)
    );
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(10px)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "22px",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 30px 90px -15px rgba(0, 0, 0, 0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 26px",
            borderBottom: "1px solid #f1f5f9",
            backgroundColor: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "14px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#b91c1c",
              }}
            >
              <UserX size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "900", color: "#0f172a" }}>
                  Suspended Citizens Archive
                </h2>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "800",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    backgroundColor: "#fef2f2",
                    color: "#b91c1c",
                    border: "1px solid #fecaca",
                  }}
                >
                  {users.length} Suspended
                </span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#64748b" }}>
                Audit, inspect, or restore verification privileges for suspended citizen accounts.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="animatedCloseButton"
            onClick={onClose}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={17} />
          </button>
        </div>

        {/* Search Toolbar */}
        <div style={{ padding: "14px 26px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
          <div className="search-box-premium" style={{ width: "100%", boxSizing: "border-box" }}>
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search by citizen name, email, ID number, or barangay..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ fontSize: "13px" }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "#94a3b8" }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Body List */}
        <div style={{ padding: "20px 26px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredUsers.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", color: "#64748b" }}>
              <ShieldCheck size={40} color="#15803d" style={{ marginBottom: "10px" }} />
              <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                {searchTerm ? "No Matching Suspended Citizens" : "No Suspended Citizens"}
              </h3>
              <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                {searchTerm ? "Try searching with a different name or ID." : "All registered resident accounts are currently active in good standing."}
              </p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Citizen Account";
              return (
                <div
                  key={user.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    padding: "16px 18px",
                    borderRadius: "14px",
                    border: "1px solid #fecaca",
                    backgroundColor: "#ffffff",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "12px",
                          backgroundColor: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#b91c1c",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "800",
                          fontSize: "15px",
                        }}
                      >
                        {fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <strong style={{ fontSize: "14.5px", color: "#0f172a" }}>{fullName}</strong>
                          <span style={{ fontSize: "11px", fontWeight: "800", color: "#b91c1c", backgroundColor: "#fef2f2", padding: "1px 6px", borderRadius: "6px" }}>
                            SUSPENDED
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b", fontSize: "12px", marginTop: "2px" }}>
                          <span>Citizen ID: #{user.user_id || "N/A"}</span>
                          <span>•</span>
                          <span>{user.email || user.contact_number || "No direct contact"}</span>
                          <span>•</span>
                          <span>Brgy. {user.baranggay || user.barangay || "Lagonglong"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {onUnsuspend && (
                        <button
                          type="button"
                          onClick={() => onUnsuspend(user)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "1px solid #bbf7d0",
                            backgroundColor: "#f0fdf4",
                            color: "#15803d",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                          }}
                        >
                          <RotateCcw size={13} /> Restore
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onViewUser(user)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "6px 14px",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          backgroundColor: "#f8fafc",
                          color: "#334155",
                          fontSize: "12px",
                          fontWeight: "700",
                          cursor: "pointer",
                        }}
                      >
                        <ExternalLink size={13} /> Review Details
                      </button>
                    </div>
                  </div>

                  {/* Suspension Reason Banner */}
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      backgroundColor: "#fef2f2",
                      border: "1px solid #fee2e2",
                      fontSize: "12px",
                      color: "#991b1b",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "6px",
                    }}
                  >
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "2px" }} />
                    <span>
                      <strong>Reason for Suspension:</strong> {user.suspension_reason || user.description || "Administrative suspension by system operator."}
                    </span>
                  </div>
                </div>
              );
            })
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

  const quickReasons = [
    "False / Prank Emergency Report",
    "Repeated False Alarms",
    "Misuse of Emergency SOS System",
    "Identity & Photo Mismatch",
    "Fake / Tampered ID Document",
    "Invalid / Expired ID Document",
    "Duplicate Citizen Registration",
    "Harassment / Abusive Submissions",
    "Non-Resident / Out of Jurisdiction",
    "Citizen Self-Requested Suspension",
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(10px)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "22px",
          width: "100%",
          maxWidth: "540px",
          padding: "26px",
          boxShadow: "0 30px 90px -15px rgba(0, 0, 0, 0.6)",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={22} />
          </div>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: "17px", fontWeight: "900", color: "#0f172a" }}>
              Suspend Citizen Verification
            </h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
              Suspending <strong>{user.first_name} {user.last_name}</strong> (Citizen ID #{user.user_id || "N/A"}).
            </p>
          </div>
        </div>

        <div
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fee2e2",
            color: "#991b1b",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>This citizen will lose verified privileges and cannot submit verified reports until restored.</span>
        </div>

        {/* Quick Reason Chips */}
        <div>
          <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "8px", letterSpacing: "0.04em" }}>
            Quick Reason Tags (Click to Apply):
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {quickReasons.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => onMessageChange(reason)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "8px",
                  border: message === reason ? "1px solid #dc2626" : "1px solid #e2e8f0",
                  backgroundColor: message === reason ? "#fef2f2" : "#f8fafc",
                  color: message === reason ? "#b91c1c" : "#475569",
                  fontSize: "11.5px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                {reason}
              </button>
            ))}
          </div>
        </div>

        {/* Reason Textarea */}
        <div>
          <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155", display: "block", marginBottom: "6px" }}>
            Official Justification Notes:
          </label>
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Explain the specific reason for suspension..."
            style={{
              width: "100%",
              minHeight: "85px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              fontSize: "13px",
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              color: "#475569",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(user, message)}
            disabled={isProcessing || !message.trim()}
            style={{
              padding: "8px 18px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: message.trim() ? "#dc2626" : "#cbd5e1",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: "800",
              cursor: message.trim() ? "pointer" : "not-allowed",
              boxShadow: message.trim() ? "0 4px 12px rgba(220, 38, 38, 0.25)" : "none",
            }}
          >
            {isProcessing ? "Processing..." : "Confirm Suspension"}
          </button>
        </div>
      </div>
    </div>
  );
});

const styles = {
  darkOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
    zIndex: 1100,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
  },
  staticOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
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
    backgroundColor: "#ffffff",
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
    color: "#111827",
  },
  reviewSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },
  closeButton: {
    border: "1px solid #b8d7c1",
    backgroundColor: "#ffffff",
    color: "#1f3a2f",
    width: "42px",
    height: "42px",
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
    backgroundColor: "#f6faf7",
    border: "1px solid #dfeae3",
    borderRadius: "16px",
    padding: "14px",
  },
  panelLabel: {
    display: "block",
    fontSize: "12px",
    fontWeight: 800,
    color: "#5f7b69",
    marginBottom: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  reviewImage: {
    width: "100%",
    height: "320px",
    objectFit: "cover",
    borderRadius: "12px",
    backgroundColor: "#f6faf7",
  },
  emptyMedia: {
    width: "100%",
    height: "320px",
    borderRadius: "12px",
    backgroundColor: "#f6faf7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: "8px",
    color: "#5f7b69",
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
    color: "#111827",
    marginBottom: "12px",
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "10px",
  },
  detailItem: {
    backgroundColor: "#ffffff",
    border: "1px solid #dfeae3",
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
    color: "#111827",
    fontWeight: 700,
    lineHeight: "1.35",
  },
  detailsModal: {
    width: "100%",
    maxWidth: "960px",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "28px 32px 32px",
    boxShadow: "0 30px 80px rgba(15, 23, 42, 0.22)",
    overflowY: "auto",
    maxHeight: "90vh",
    border: "1px solid rgba(15, 23, 42, 0.08)",
    position: "relative",
  },
  modalCloseButton: {
    position: "absolute",
    top: "18px",
    right: "18px",
    width: "44px",
    height: "44px",
    borderRadius: "10px",
    border: "1px solid #b8d7c1",
    backgroundColor: "#f6faf7",
    color: "#1f3a2f",
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
    paddingRight: "60px",
    flexWrap: "wrap",
  },
  detailsTitle: {
    margin: 0,
    fontSize: "24px",
    color: "#111827",
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
    backgroundColor: "#f6faf7",
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
    color: "#111827",
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
    color: "#5f7b69",
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
    color: "#111827",
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
    backgroundColor: "#f6faf7",
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


