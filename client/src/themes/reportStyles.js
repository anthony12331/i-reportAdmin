// src/themes/reportStyles.js

export const reportStyles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#0b0f19",
    color: "#f8fafc",
    fontFamily: "'Inter', sans-serif",
  },
  main: {
    flex: 1,
    padding: "32px",
    marginLeft: "260px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "28px",
    paddingBottom: "20px",
    borderBottom: "1px solid #1e293b",
  },
  headerTitleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  statusDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    backgroundColor: "#a855f7",
    boxShadow: "0 0 12px #a855f7",
  },
  title: {
    fontSize: "28px",
    fontWeight: "900",
    letterSpacing: "-0.5px",
    color: "#ffffff",
    margin: 0,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "14px",
    margin: "6px 0 0 24px",
    fontWeight: "500",
  },
  filterBar: {
    backgroundColor: "#1e293b",
    padding: "20px",
    borderRadius: "16px",
    border: "1px solid #334155",
    display: "flex",
    alignItems: "center",
    gap: "20px",
    marginBottom: "28px",
  },
  dateInputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    flex: 1,
  },
  dateLabel: {
    fontSize: "12px",
    fontWeight: "800",
    color: "#94a3b8",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  dateInput: {
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    fontSize: "13px",
    fontWeight: "600",
    outline: "none",
  },
  actionColumn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  generateBtn: {
    width: "100%",
    padding: "11px 20px",
    backgroundColor: "#38bdf8",
    color: "#0f172a",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontWeight: "900",
    fontSize: "13px",
    minHeight: "42px",
  },
  progressBarTrack: {
    width: "100%",
    height: "6px",
    backgroundColor: "#0f172a",
    borderRadius: "4px",
    overflow: "hidden",
  },
  progressBarFill: (progress) => ({
    height: "100%",
    backgroundColor: "#38bdf8",
    width: `${progress}%`,
    transition: "width 0.2s ease-in-out",
  }),
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginBottom: "24px",
  },
  metricCardDefault: {
    backgroundColor: "#1e293b",
    padding: "16px 20px",
    borderRadius: "14px",
    border: "1px solid #334155",
  },
  metricCardOngoing: {
    backgroundColor: "#1e293b",
    padding: "16px 20px",
    borderRadius: "14px",
    border: "1px solid #f59e0b",
  },
  metricCardResolved: {
    backgroundColor: "#1e293b",
    padding: "16px 20px",
    borderRadius: "14px",
    border: "1px solid #10b981",
  },
  metricCardPending: {
    backgroundColor: "#1e293b",
    padding: "16px 20px",
    borderRadius: "14px",
    border: "1px solid #ef4444",
  },
  metricLabel: (color) => ({
    fontSize: "11px",
    fontWeight: "800",
    color: color,
  }),
  metricValue: (color) => ({
    margin: "4px 0 0 0",
    fontSize: "24px",
    color: color,
  }),
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "900",
    color: "#f8fafc",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  exportPdfBtn: {
    padding: "10px 18px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: "900",
    fontSize: "13px",
  },
  chartRowGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "20px",
    marginBottom: "24px",
  },
  chartPanel: {
    backgroundColor: "#1e293b",
    padding: "20px",
    borderRadius: "16px",
    border: "1px solid #334155",
  },
  chartTitle: {
    margin: "0 0 16px 0",
    fontSize: "14px",
    fontWeight: "800",
    color: "#f8fafc",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  middleChartsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    marginBottom: "24px",
  },
  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr",
    gap: "20px",
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
    padding: "10px 0",
    borderBottom: "1px solid #334155",
  },
  reporterBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    color: "#38bdf8",
    padding: "4px 10px",
    borderRadius: "10px",
    fontSize: "11px",
    fontWeight: "800",
    border: "1px solid #38bdf8",
  },
  auditTable: {
    width: "100%",
    borderCollapse: "collapse",
  },
  auditTh: {
    borderBottom: "2px solid #334155",
    textAlign: "left",
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    padding: "8px",
  },
  auditTr: {
    borderBottom: "1px solid #334155",
  },
  auditTdType: {
    padding: "12px 8px",
    fontWeight: "800",
    color: "#f8fafc",
    fontSize: "13px",
  },
  auditTdLoc: {
    fontSize: "12px",
    color: "#cbd5e1",
  },
  statusBadge: (statusType) => {
    const st = (statusType || "").toLowerCase();
    let bg = "rgba(245, 158, 11, 0.15)";
    let fg = "#fbbf24";
    let border = "#f59e0b";

    if (st === "resolved") {
      bg = "rgba(16, 185, 129, 0.15)";
      fg = "#34d399";
      border = "#10b981";
    } else if (st === "pending") {
      bg = "rgba(239, 68, 68, 0.15)";
      fg = "#f87171";
      border = "#ef4444";
    }

    return {
      padding: "4px 10px",
      borderRadius: "8px",
      fontSize: "11px",
      fontWeight: "800",
      backgroundColor: bg,
      color: fg,
      border: `1px solid ${border}`,
    };
  },
};
