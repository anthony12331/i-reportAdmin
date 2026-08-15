// src/themes/dashboardStyles.js
const injectGlobalStyles = () => {
  if (typeof document !== 'undefined' && !document.getElementById('lux-editorial')) {
    const style = document.createElement('style');
    style.id = 'lux-editorial';
    style.innerHTML = `
      @keyframes gradientPulse {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes floatGlow {
        0% { box-shadow: 0 20px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.02); transform: translateY(0); }
        50% { box-shadow: 0 30px 60px rgba(212,175,55,0.05), inset 0 0 0 1px rgba(212,175,55,0.1); transform: translateY(-4px); }
        100% { box-shadow: 0 20px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.02); transform: translateY(0); }
      }
      * {
        scrollbar-width: none;
      }
      *::-webkit-scrollbar {
        display: none;
      }
      body {
        background-color: #050505;
        margin: 0;
      }
      .lux-hover:hover {
        transform: translateY(-6px);
        box-shadow: 0 30px 60px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(212,175,55,0.3) !important;
        background-color: rgba(255,255,255,0.02) !important;
      }
    `;
    document.head.appendChild(style);
  }
};
injectGlobalStyles();

const champagne = "#d4af37";
const champagneDim = "rgba(212, 175, 55, 0.1)";
const midnightSlate = "#09090b";
const editorialFont = '"Didot", "Bodoni MT", "Times New Roman", serif';
const sansFont = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const glassPanel = {
  backgroundColor: "rgba(255, 255, 255, 0.015)",
  backdropFilter: "blur(40px)",
  WebkitBackdropFilter: "blur(40px)",
  border: "1px solid rgba(255, 255, 255, 0.04)",
  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
  borderRadius: "32px",
};

export const dashboardStyles = {
  shell: {
    display: "flex",
    height: "100vh",
    background: "radial-gradient(circle at 50% -20%, #1e293b 0%, #020617 80%)",
    color: "#f4f4f5",
    fontFamily: sansFont,
    overflow: "hidden",
  },
  main: {
    flex: 1,
    padding: "16px 24px",
    marginLeft: "300px",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: "12px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
    flexShrink: 0,
  },
  title: {
    fontFamily: editorialFont,
    fontSize: "clamp(24px, 3vw, 32px)",
    fontWeight: "400",
    color: champagne,
    margin: 0,
    letterSpacing: "-0.5px",
    lineHeight: 1,
  },
  liveTag: {
    backgroundColor: champagneDim,
    color: champagne,
    fontSize: "9px",
    fontWeight: "600",
    padding: "4px 8px",
    borderRadius: "99px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    border: "1px solid rgba(212, 175, 55, 0.2)",
    marginLeft: "12px",
    verticalAlign: "middle",
  },
  subtitle: {
    fontSize: "9px",
    margin: "6px 0 0 0",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "3px",
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "transparent",
    border: "1px solid rgba(212, 175, 55, 0.3)",
    padding: "8px 16px",
    borderRadius: "99px",
    fontSize: "9px",
    fontWeight: "600",
    color: champagne,
    letterSpacing: "2px",
    textTransform: "uppercase",
  },
  statusDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: champagne,
    boxShadow: `0 0 10px ${champagne}`,
  },
  soundBtnActive: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: champagne,
    border: "none",
    color: "#000000",
    padding: "8px 16px",
    borderRadius: "99px",
    fontSize: "9px",
    fontWeight: "700",
    cursor: "pointer",
    letterSpacing: "2px",
    textTransform: "uppercase",
    transition: "all 0.4s ease",
  },
  soundBtnMuted: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "transparent",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "#71717a",
    padding: "8px 16px",
    borderRadius: "99px",
    fontSize: "9px",
    fontWeight: "600",
    cursor: "pointer",
    letterSpacing: "2px",
    textTransform: "uppercase",
    transition: "all 0.4s ease",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "16px",
    flexShrink: 0,
  },
  masterGrid: {
    display: "grid",
    gridTemplateColumns: "300px 1fr 300px",
    gap: "16px",
    flex: 1,
    minHeight: 0,
  },
  gridCol: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minHeight: 0,
  },
  panelFlex: {
    backgroundColor: "rgba(255, 255, 255, 0.015)",
    backdropFilter: "blur(40px)",
    WebkitBackdropFilter: "blur(40px)",
    border: "1px solid rgba(255, 255, 255, 0.04)",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
    borderRadius: "24px",
    display: "flex",
    flexDirection: "column",
    padding: "16px",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  panelFixed: {
    backgroundColor: "rgba(255, 255, 255, 0.015)",
    backdropFilter: "blur(40px)",
    WebkitBackdropFilter: "blur(40px)",
    border: "1px solid rgba(255, 255, 255, 0.04)",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
    borderRadius: "24px",
    padding: "16px",
    flexShrink: 0,
  },
  sosPanel: {
    backgroundColor: "rgba(220, 38, 38, 0.03)",
    backdropFilter: "blur(40px)",
    WebkitBackdropFilter: "blur(40px)",
    border: "1px solid rgba(220, 38, 38, 0.1)",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
    borderRadius: "24px",
    padding: "16px",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    maxHeight: "180px",
  },
  sosHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    flexShrink: 0,
  },
  sosHeading: {
    fontFamily: editorialFont,
    fontSize: "14px",
    fontWeight: "400",
    color: "#ef4444",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  sosViewBtn: {
    background: "transparent",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#ef4444",
    fontWeight: "600",
    fontSize: "8px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 8px",
    borderRadius: "99px",
    letterSpacing: "2px",
    textTransform: "uppercase",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    flexShrink: 0,
  },
  sectionTitle: {
    fontFamily: editorialFont,
    fontSize: "14px",
    fontWeight: "400",
    color: "#ffffff",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  ghostBtn: {
    background: "transparent",
    border: "none",
    color: "#71717a",
    fontSize: "8px",
    fontWeight: "600",
    cursor: "pointer",
    padding: "4px 8px",
    letterSpacing: "2px",
    textTransform: "uppercase",
  },
  emptyState: {
    color: "#52525b",
    fontSize: "10px",
    textAlign: "center",
    margin: "32px 0",
    fontWeight: "500",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  thRow: {},
  th: {
    textAlign: "left",
    padding: "6px",
    fontSize: "8px",
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: "1px",
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
  },
  thRight: {
    textAlign: "right",
    padding: "6px",
    fontSize: "8px",
    fontWeight: "600",
    color: "#52525b",
    letterSpacing: "1px",
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
  },
  tr: {
    backgroundColor: "transparent",
    borderBottom: "1px solid rgba(255, 255, 255, 0.015)",
  },
  td: {
    padding: "6px",
    verticalAlign: "middle",
    color: "#ffffff",
    fontWeight: "500",
    fontSize: "10px",
  },
  tdBold: {
    padding: "6px",
    fontSize: "10px",
    fontWeight: "600",
    color: "#ffffff",
    letterSpacing: "0.5px",
  },
  tdMuted: {
    padding: "6px",
    fontSize: "10px",
    color: "#71717a",
    fontWeight: "400",
  },
  tdHighlight: {
    padding: "6px",
    fontSize: "10px",
    fontWeight: "500",
    color: champagne,
  },
  tdRight: {
    padding: "6px",
    textAlign: "right",
  },
  sosBadge: {
    backgroundColor: "transparent",
    color: "#ef4444",
    fontSize: "8px",
    fontWeight: "600",
    padding: "2px 6px",
    borderRadius: "4px",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  sosActionBtn: {
    background: "#ef4444",
    color: "#ffffff",
    border: "none",
    padding: "6px 12px",
    borderRadius: "99px",
    fontSize: "8px",
    fontWeight: "700",
    cursor: "pointer",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  dispatchBtn: {
    background: "transparent",
    color: champagne,
    border: `1px solid ${champagne}`,
    padding: "6px 12px",
    borderRadius: "99px",
    fontSize: "8px",
    fontWeight: "600",
    cursor: "pointer",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  typeTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  },
  inlineIcon: {
    verticalAlign: "middle",
    color: champagne,
  },
  subBadge: {
    backgroundColor: "transparent",
    color: "#a1a1aa",
    fontSize: "8px",
    fontWeight: "500",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  subBadgeBlue: {
    backgroundColor: "transparent",
    color: champagne,
    fontSize: "8px",
    fontWeight: "600",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  categoryList: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderRadius: "16px",
    overflow: "hidden",
  },
  categoryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(10, 10, 12, 0.95)",
    padding: "10px",
  },
  categoryCountBadge: {
    color: champagne,
    fontSize: "12px",
    fontFamily: editorialFont,
    fontWeight: "400",
  },
  fleetSubtext: {
    color: "#71717a",
    fontSize: "10px",
    margin: 0,
    lineHeight: "1.5",
    fontWeight: "400",
    letterSpacing: "0.5px",
  },
  auditList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderRadius: "16px",
    overflow: "auto",
    flex: 1,
  },
  auditItem: {
    display: "flex",
    gap: "10px",
    backgroundColor: "rgba(10, 10, 12, 0.95)",
    padding: "10px",
  },
  auditContent: {
    flex: 1,
  },
  auditText: {
    margin: 0,
    color: "#a1a1aa",
    fontWeight: "400",
    lineHeight: "1.4",
    fontSize: "10px",
  },
  auditTime: {
    color: champagne,
    fontSize: "8px",
    fontWeight: "600",
    marginTop: "4px",
    display: "block",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
};
export const darkStyles = dashboardStyles;

