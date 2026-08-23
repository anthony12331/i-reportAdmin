// src/reportStyles.js

const glassPanel = {
  backgroundColor: "#ffffff",
  border: "1px solid #d7e5da",
  boxShadow: "0 8px 24px rgba(24, 95, 53, 0.06)",
  borderRadius: "12px",
};

export const reportStyles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "radial-gradient(circle at 50% -20%, #ffffff 0%, #f6faf7 80%)",
    color: "#111111",
    fontFamily: "Inter, Arial, sans-serif",
  },
  main: {
    flex: 1,
    padding: "28px 24px 40px",
    marginLeft: "216px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
    paddingBottom: "24px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
  },
  headerTitleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  statusDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    backgroundColor: "#06b6d4",
    boxShadow: "0 0 15px rgba(56, 189, 248, 0.8)",
  },
  title: {
    fontSize: "32px",
    fontWeight: "900",
    letterSpacing: "-0.5px",
    background: "radial-gradient(circle at 50% -20%, #1e293b 0%, #020617 80%)",
    
    
    margin: 0,

  },
  subtitle: {
    fontSize: "10px",
    margin: "8px 0 0 0",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "3px",
  },
  filterBar: {
    ...glassPanel,
    padding: "clamp(32px, 5vw, 64px)",
    display: "flex",
    alignItems: "center",
    gap: "32px",
    marginBottom: "40px",
  },
  dateInputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    flex: 1,
  },
  dateLabel: {
    fontSize: "14px",
    fontWeight: "900",
    color: "#cbd5e1",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  dateInput: {
    padding: "16px 20px",
    borderRadius: "32px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    backdropFilter: "blur(40px)",
    WebkitBackdropFilter: "blur(40px)",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "800",
    outline: "none",
  },
  actionColumn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  generateBtn: {
    width: "100%",
    padding: "18px 32px",
    background: "radial-gradient(circle at 50% -20%, #1e293b 0%, #020617 80%)",
    color: "white",
    border: "none",
    borderRadius: "32px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    fontWeight: "900",
    fontSize: "15px",
    minHeight: "56px",
    boxShadow: "0 15px 35px 0 rgba(0, 0, 0, 0.5)",
    transition: "all 0.3s",
  },
  progressBarTrack: {
    width: "100%",
    height: "10px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: "5px",
    overflow: "hidden",
  },
  progressBarFill: (progress) => ({
    height: "100%",
    background: "radial-gradient(circle at 50% -20%, #1e293b 0%, #020617 80%)",
    width: `${progress}%`,
    transition: "width 0.2s ease-in-out",
  }),
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "24px",
    marginBottom: "40px",
  },
  metricCardDefault: {
    ...glassPanel,
    padding: "24px 32px",
  },
  metricCardOngoing: {
    ...glassPanel,
    padding: "24px 32px",
    border: "1px solid rgba(245, 158, 11, 0.4)",
    boxShadow: "0 0 20px rgba(245, 158, 11, 0.15)",
  },
  metricCardResolved: {
    ...glassPanel,
    padding: "24px 32px",
    border: "1px solid rgba(16, 185, 129, 0.4)",
    boxShadow: "0 0 20px rgba(16, 185, 129, 0.15)",
  },
  metricCardPending: {
    ...glassPanel,
    padding: "24px 32px",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    boxShadow: "0 0 20px rgba(239, 68, 68, 0.15)",
  },
  metricLabel: (color) => ({
    fontSize: "13px",
    fontWeight: "900",
    color: color,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  }),
  metricValue: (color) => ({
    margin: "12px 0 0 0",
    fontSize: "40px",
    fontWeight: "900",
    color: color,
    textShadow: `0 0 20px ${color}`,
  }),
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
  },
  sectionTitle: {
    fontSize: "24px",
    fontWeight: "900",
    color: "#ffffff",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  exportPdfBtn: {
    padding: "14px 28px",
    background: "radial-gradient(circle at 50% -20%, #1e293b 0%, #020617 80%)",
    color: "white",
    border: "none",
    borderRadius: "32px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontWeight: "900",
    fontSize: "15px",
    boxShadow: "0 15px 35px 0 rgba(0, 0, 0, 0.5)",
    transition: "all 0.3s",
  },
  chartRowGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "32px",
    marginBottom: "32px",
  },
  chartPanel: {
    ...glassPanel,
    padding: "clamp(32px, 5vw, 64px)",
  },
  chartTitle: {
    margin: "0 0 24px 0",
    fontSize: "18px",
    fontWeight: "900",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  middleChartsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "32px",
    marginBottom: "32px",
  },
  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr",
    gap: "32px",
  },
  reporterList: {
    listStyleType: "none",
    padding: 0,
    margin: 0,
  },
  reporterItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 0",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
  },
  reporterBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    color: "#7dd3fc",
    padding: "8px 16px",
    borderRadius: "14px",
    fontSize: "13px",
    fontWeight: "900",
    border: "1px solid rgba(6, 182, 212, 0.4)",
  },
  auditTable: {
    width: "100%",
    borderCollapse: "collapse",
  },
  auditTh: {
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    textAlign: "left",
    color: "#94a3b8",
    fontSize: "13px",
    fontWeight: "900",
    textTransform: "uppercase",
    padding: "16px",
  },
  auditTr: {
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
  },
  auditTdType: {
    padding: "20px 16px",
    fontWeight: "900",
    color: "#ffffff",
    fontSize: "15px",
  },
  auditTdLoc: {
    fontSize: "14px",
    color: "#cbd5e1",
    fontWeight: "700",
  },
  statusBadge: (statusType) => {
    const st = (statusType || "").toLowerCase();
    let bg = "rgba(245, 158, 11, 0.15)";
    let fg = "#fcd34d";
    let border = "rgba(245, 158, 11, 0.4)";

    if (st === "resolved") {
      bg = "rgba(16, 185, 129, 0.15)";
      fg = "#34d399";
      border = "rgba(16, 185, 129, 0.4)";
    } else if (st === "pending") {
      bg = "rgba(239, 68, 68, 0.15)";
      fg = "#fca5a5";
      border = "rgba(239, 68, 68, 0.4)";
    }

    return {
      padding: "8px 16px",
      borderRadius: "32px",
      fontSize: "13px",
      fontWeight: "900",
      backgroundColor: bg,
      color: fg,
      border: `1px solid ${border}`,
    };
  },
};
