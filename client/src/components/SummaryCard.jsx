// src/SummaryCard.jsx

const styles = {
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "9px",
    padding: "12px 14px",
    border: "1px solid #d7e5da",
    boxShadow: "0 8px 24px rgba(24, 95, 53, 0.06)",
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
    marginBottom: "5px",
  },
  cardTitle: {
    fontSize: "9px",
    fontWeight: "600",
    color: "#477257",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  bigNumber: {
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "25px",
    fontWeight: "800",
    color: "#111111",
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
        border: `1px solid ${urgent ? "rgba(239, 68, 68, 0.3)" : "#d7e5da"}`,
      }}
      onClick={onClick}
    >
      <div style={styles.cardHeader}>
        <span style={styles.cardTitle}>{title}</span>
        {icon}
      </div>
      <p style={{ ...styles.bigNumber, color: urgent ? "#ef4444" : "#111111" }}>
        {val}
      </p>
    </div>
  );
}

