// src/reportStyles.js

const glassPanel = {
  backgroundColor: "#ffffff",
  border: "1px solid #dfeae3",
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
  borderRadius: "14px",
};

export const reportStyles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "radial-gradient(circle at 50% -20%, #ffffff 0%, #f6faf7 80%)",
    color: "#111827",
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
    alignItems: "flex-end",
    marginBottom: "24px",
    paddingBottom: "14px",
    borderBottom: "1px solid #dfeae3",
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
    backgroundColor: "#1d7a4d",
    boxShadow: "0 0 15px rgba(29, 122, 77, 0.28)",
  },
  title: {
    fontSize: "clamp(24px, 3vw, 32px)",
    fontWeight: "800",
    letterSpacing: "-0.03em",
    color: "#111111",
    margin: 0,

  },
  subtitle: {
    fontSize: "9px",
    margin: "8px 0 0 0",
    fontWeight: "600",
    color: "#477257",
    textTransform: "none",
    letterSpacing: "0.3px",
  },
  filterBar: {
    ...glassPanel,
    padding: "24px",
    display: "flex",
    alignItems: "center",
    gap: "18px",
    marginBottom: "28px",
  },
  dateInputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flex: 1,
  },
  dateLabel: {
    fontSize: "11px",
    fontWeight: "800",
    color: "#5f7b69",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  dateInput: {
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid #dfeae3",
    backgroundColor: "#fbfdfb",
    color: "#111827",
    fontSize: "14px",
    fontWeight: "700",
    outline: "none",
  },
  actionColumn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  generateBtn: {
    width: "100%",
    padding: "14px 22px",
    background: "linear-gradient(135deg, #1a874f 0%, #0f6c3d 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    fontWeight: "800",
    fontSize: "14px",
    minHeight: "48px",
    boxShadow: "0 8px 18px rgba(24, 95, 53, 0.16)",
    transition: "all 0.2s ease",
  },
  progressBarTrack: {
    width: "100%",
    height: "10px",
    backgroundColor: "#e7f5eb",
    borderRadius: "5px",
    overflow: "hidden",
  },
  progressBarFill: (progress) => ({
    height: "100%",
    background: "#1a874f",
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
    color: "#111827",
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
    color: "#111827",
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
    borderBottom: "1px solid #dfeae3",
    textAlign: "left",
    color: "#5f7b69",
    fontSize: "13px",
    fontWeight: "900",
    textTransform: "uppercase",
    padding: "16px",
  },
  auditTr: {
    borderBottom: "1px solid #edf3ee",
  },
  auditTdType: {
    padding: "20px 16px",
    fontWeight: "900",
    color: "#111827",
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
