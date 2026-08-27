import { memo } from "react";
import { MapPin, Phone, ShieldCheck, User, ZoomIn } from "lucide-react";

function VerifiedUserCard({ user, profileImageUrl, onPreview, onManage }) {
  const handlePreview = () => {
    if (!profileImageUrl) return;
    onPreview(user);
  };

  return (
    <article style={styles.card}>
      <div style={styles.idBadge}>ID #{user.user_id}</div>

      <div style={styles.profileSection}>
        <button
          type="button"
          className="verifiedUsersButton"
          style={styles.avatarBtnWrapper}
          onClick={handlePreview}
          aria-label={`View profile photo of ${user.first_name}`}
        >
          {profileImageUrl ? (
            <img src={profileImageUrl} alt="Profile" style={styles.avatarImg} />
          ) : (
            <div style={styles.fallbackAvatar}>
              <User size={24} color="#10b981" />
            </div>
          )}
          {profileImageUrl && (
            <div style={styles.zoomOverlay}>
              <ZoomIn size={14} color="white" />
            </div>
          )}
        </button>

        <div>
          <h3 style={styles.userName}>
            {user.first_name} {user.last_name}
          </h3>
          <span style={styles.statusLabel}>
            <ShieldCheck size={12} /> Verified
          </span>
        </div>
      </div>

      <div style={styles.infoGrid}>
        <div style={styles.infoItem}>
          <Phone size={14} color="#94a3b8" />
          <span>
            {user.contact_number || user.contactNumber || "No Contact"}
          </span>
        </div>
        <div style={styles.infoItem}>
          <MapPin size={14} color="#94a3b8" />
          <span>{user.baranggay || user.barangay || "No Location"}</span>
        </div>
      </div>

      <button
        type="button"
        className="verifiedUsersButton"
        style={styles.viewBtn}
        onClick={() => onManage(user)}
      >
        Manage User
      </button>
    </article>
  );
}

const styles = {
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #dfeae3",
    borderRadius: "14px",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
    overflow: "hidden",
    padding: "22px",
    position: "relative",
  },
  idBadge: {
    position: "absolute",
    top: "20px",
    right: "20px",
    backgroundColor: "#dcfce7",
    color: "#1d7a4d",
    border: "1px solid #bbf7d0",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "bold",
  },
  profileSection: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    marginBottom: "20px",
  },
  avatarBtnWrapper: {
    padding: 0,
    margin: 0,
    width: "55px",
    height: "55px",
    borderRadius: "14px",
    border: "2px solid #dfeae3",
    backgroundColor: "#f6faf7",
    display: "block",
    overflow: "hidden",
    cursor: "pointer",
    position: "relative",
    boxShadow: "0 2px 5px rgba(15, 23, 42, 0.06)",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  fallbackAvatar: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    margin: 0,
    fontSize: "18px",
    color: "#111827",
    fontWeight: "800",
  },
  statusLabel: {
    fontSize: "11px",
    color: "#1d7a4d",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    fontWeight: "700",
    marginTop: "4px",
  },
  infoGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "15px 0",
    borderTop: "1px solid #dfeae3",
    marginBottom: "15px",
  },
  infoItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "13px",
    color: "#374151",
    fontWeight: "600",
  },
  viewBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid #b8d7c1",
    backgroundColor: "#f6faf7",
    color: "#1d7a4d",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "all 0.2s ease",
  },
};

export default memo(VerifiedUserCard);

