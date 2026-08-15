// src/SummaryCard.jsx

const styles = {
  card: {
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    backdropFilter: "blur(40px)",
    WebkitBackdropFilter: "blur(40px)",
    borderRadius: "32px",
    padding: "clamp(32px, 3vw, 40px)",
    border: "1px solid rgba(255, 255, 255, 0.04)",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
    cursor: "pointer",
    transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "8px",
  },
  cardTitle: {
    fontSize: "10px",
    fontWeight: "600",
    color: "#52525b",
    letterSpacing: "2px",
    textTransform: "uppercase",
  },
  bigNumber: {
    fontFamily: '"Didot", "Bodoni MT", "Times New Roman", serif',
    fontSize: "36px",
    fontWeight: "400",
    color: "#ffffff",
    margin: 0,
    lineHeight: 1,
  },
};

export default function SummaryCard({ title, val, icon, accent, urgent, onClick }) {
  return (
    <div
      className="lux-hover"
      style={{
        ...styles.card,
        border: `1px solid ${urgent ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.04)"}`,
      }}
      onClick={onClick}
    >
      <div style={styles.cardHeader}>
        <span style={styles.cardTitle}>{title}</span>
        {icon}
      </div>
      <p style={{ ...styles.bigNumber, color: urgent ? "#ef4444" : "#ffffff" }}>
        {val}
      </p>
    </div>
  );
}

