// src/SummaryCard.jsx

const styles = {
  card: {
    backgroundColor: "#1e293b",
    borderRadius: "16px",
    padding: "20px",
    border: "1px solid #334155",
    cursor: "pointer",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  cardTitle: {
    fontSize: "12px",
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  bigNumber: {
    fontSize: "32px",
    fontWeight: "900",
    margin: 0,
    lineHeight: 1,
  },
};

export default function SummaryCard({ title, val, icon, accent, urgent, onClick }) {
  return (
    <div
      style={{
        ...styles.card,
        borderTop: `3px solid ${accent}`,
        boxShadow: urgent ? `0 0 15px rgba(239, 68, 68, 0.25)` : "none",
      }}
      onClick={onClick}
    >
      <div style={styles.cardHeader}>
        <span style={styles.cardTitle}>{title}</span>
        {icon}
      </div>
      <p style={{ ...styles.bigNumber, color: urgent ? "#ef4444" : "#f8fafc" }}>
        {val}
      </p>
    </div>
  );
}

