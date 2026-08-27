// src/SummaryCard.jsx

const styles = {
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    padding: "14px 16px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
    cursor: "pointer",
    transition: "border-color 0.15s ease, background-color 0.15s ease",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  cardTitle: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#64748b",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  bigNumber: {
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "24px",
    fontWeight: "600",
    color: "#0f172a",
    margin: 0,
    lineHeight: 1.1,
  },
};

export default function SummaryCard({ title, val, icon, accent, urgent, onClick }) {
  return (
    <div
      style={{
        ...styles.card,
        border: `1px solid ${urgent ? "#fecaca" : "#e2e8f0"}`,
      }}
      onClick={onClick}
    >
      <div style={styles.cardHeader}>
        <span style={styles.cardTitle}>{title}</span>
        {icon}
      </div>
      <p style={{ ...styles.bigNumber, color: urgent ? "#ef4444" : "#0f172a" }}>
        {val}
      </p>
    </div>
  );
}

