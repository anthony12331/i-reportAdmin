// src/dashboardStyles.js
const injectGlobalStyles = () => {
  if (typeof document !== 'undefined' && !document.getElementById('aurora-dashboard')) {
    const style = document.createElement('style');
    style.id = 'aurora-dashboard';
    style.innerHTML = `
      @keyframes gradientBG {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes floatSync {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-6px); }
        100% { transform: translateY(0px); }
      }
      @keyframes pulseGlowRed {
        0% { box-shadow: 0 0 10px rgba(239,68,68,0.3); }
        50% { box-shadow: 0 0 25px rgba(239,68,68,0.7); }
        100% { box-shadow: 0 0 10px rgba(239,68,68,0.3); }
      }
      * {
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.2) transparent;
      }
    `;
    document.head.appendChild(style);
  }
};
injectGlobalStyles();

const glassPanel = {
  backgroundColor: "rgba(16, 23, 42, 0.6)",
  backdropFilter: "blur(24px) saturate(150%)",
  WebkitBackdropFilter: "blur(24px) saturate(150%)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  boxShadow: "0 15px 35px 0 rgba(0, 0, 0, 0.5)",
  borderRadius: "24px",
};

export const dashboardStyles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "linear-gradient(-45deg, #090a0f, #10172a, #0b1120, #020617)",
    backgroundSize: "400% 400%",
    animation: "gradientBG 15s ease infinite",
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
    marginBottom: "32px",
    paddingBottom: "24px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
  },
  title: {
    fontSize: "32px",
    fontWeight: "900",
    letterSpacing: "-0.5px",
    background: "linear-gradient(90deg, #06b6d4, #3b82f6)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    margin: 0,
    textShadow: "0 4px 20px rgba(6, 182, 212, 0.3)",
  },
  liveTag: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    color: "#f87171",
    fontSize: "11px",
    fontWeight: "800",
    padding: "4px 12px",
    borderRadius: "8px",
    letterSpacing: "1px",
    textTransform: "uppercase",
    border: "1px solid rgba(239,68,68,0.4)",
    animation: "pulseGlowRed 2s infinite",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "15px",
    margin: "8px 0 0 0",
    fontWeight: "500",
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    padding: "10px 20px",
    borderRadius: "24px",
    fontSize: "13px",
    fontWeight: "800",
    color: "#34d399",
    boxShadow: "0 0 15px rgba(16,185,129,0.15)",
    transition: "all 0.3s ease",
  },
  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: "#34d399",
    boxShadow: "0 0 12px #34d399",
  },
  soundBtnActive: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    color: "#f87171",
    padding: "10px 20px",
    borderRadius: "24px",
    fontSize: "13px",
    fontWeight: "800",
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(239,68,68,0.2)",
    transition: "all 0.3s cubic-bezier(0.25,0.8,0.25,1)",
  },
  soundBtnMuted: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "#94a3b8",
    padding: "10px 20px",
    borderRadius: "24px",
    fontSize: "13px",
    fontWeight: "800",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "24px",
    marginBottom: "32px",
  },
  sosPanel: {
    ...glassPanel,
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    padding: "24px",
    marginBottom: "32px",
    boxShadow: "0 0 30px rgba(239,68,68,0.1)",
  },
  sosHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  sosHeading: {
    fontSize: "16px",
    fontWeight: "900",
    color: "#fca5a5",
    letterSpacing: "0.5px",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textShadow: "0 0 10px rgba(252, 165, 165, 0.3)",
  },
  sosViewBtn: {
    background: "rgba(239, 68, 68, 0.2)",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    color: "#f87171",
    fontWeight: "800",
    fontSize: "12px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 16px",
    borderRadius: "16px",
    transition: "all 0.3s ease",
  },
  splitGrid: {
    display: "grid",
    gridTemplateColumns: "2.2fr 1fr",
    gap: "32px",
  },
  panel: {
    ...glassPanel,
    padding: "28px",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "900",
    color: "#ffffff",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  ghostBtn: {
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "#cbd5e1",
    fontSize: "12px",
    fontWeight: "800",
    cursor: "pointer",
    padding: "8px 16px",
    borderRadius: "12px",
    transition: "all 0.3s ease",
  },
  emptyState: {
    color: "#64748b",
    fontSize: "14px",
    textAlign: "center",
    margin: "32px 0",
    fontWeight: "600",
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0 8px",
  },
  thRow: {},
  th: {
    textAlign: "left",
    padding: "0 16px 12px 16px",
    fontSize: "12px",
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  thRight: {
    textAlign: "right",
    padding: "0 16px 12px 16px",
    fontSize: "12px",
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  tr: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    transition: "all 0.2s ease",
  },
  td: {
    padding: "16px",
    fontSize: "14px",
    color: "#cbd5e1",
  },
  tdBold: {
    padding: "16px",
    fontSize: "14px",
    fontWeight: "800",
    color: "#ffffff",
  },
  tdMuted: {
    padding: "16px",
    fontSize: "13px",
    color: "#64748b",
  },
  tdHighlight: {
    padding: "16px",
    fontSize: "14px",
    fontWeight: "900",
    color: "#fbbf24",
  },
  tdRight: {
    padding: "16px",
    textAlign: "right",
  },
  sosBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    color: "#fca5a5",
    fontSize: "11px",
    fontWeight: "900",
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(239,68,68,0.4)",
    boxShadow: "0 4px 10px rgba(239, 68, 68, 0.2)",
  },
  sosActionBtn: {
    background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
    color: "white",
    border: "none",
    padding: "8px 20px",
    borderRadius: "12px",
    fontSize: "13px",
    fontWeight: "900",
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(239, 68, 68, 0.4)",
    transition: "all 0.3s",
  },
  dispatchBtn: {
    background: "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
    color: "white",
    border: "none",
    padding: "8px 20px",
    borderRadius: "12px",
    fontSize: "13px",
    fontWeight: "900",
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(245, 158, 11, 0.3)",
    transition: "all 0.3s",
  },
  typeTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  inlineIcon: {
    verticalAlign: "middle",
  },
  rightColumnStack: {
    display: "flex",
    flexDirection: "column",
    gap: "32px",
  },
  subBadge: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    color: "#d8b4fe",
    border: "1px solid rgba(168, 85, 247, 0.3)",
    fontSize: "12px",
    fontWeight: "800",
    padding: "6px 12px",
    borderRadius: "12px",
  },
  subBadgeBlue: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    color: "#7dd3fc",
    border: "1px solid rgba(6, 182, 212, 0.3)",
    fontSize: "12px",
    fontWeight: "800",
    padding: "6px 12px",
    borderRadius: "12px",
  },
  categoryList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  categoryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: "16px 20px",
    borderRadius: "16px",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    transition: "all 0.3s ease",
  },
  categoryCountBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: "900",
    padding: "6px 12px",
    borderRadius: "10px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  fleetSubtext: {
    color: "#94a3b8",
    fontSize: "14px",
    margin: 0,
    lineHeight: "1.6",
  },
  auditList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  auditItem: {
    display: "flex",
    gap: "14px",
    fontSize: "13px",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid rgba(16, 23, 42, 0.6)",
  },
  auditContent: {
    flex: 1,
  },
  auditText: {
    margin: 0,
    color: "#cbd5e1",
    fontWeight: "700",
    lineHeight: "1.5",
  },
  auditTime: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: "800",
    marginTop: "6px",
    display: "block",
  },
};

export const darkStyles = dashboardStyles;
