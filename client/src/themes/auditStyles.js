// admin-dashboard/src/themes/auditStyles.js

const glassPanel = {
  backgroundColor: "rgba(15, 23, 42, 0.7)",
    backdropFilter: "blur(40px)",
    WebkitBackdropFilter: "blur(40px)",
  
  
  border: "1px solid rgba(255, 255, 255, 0.08)",
  boxShadow: "0 15px 35px 0 rgba(0, 0, 0, 0.5)",
  borderRadius: "32px",
};

export const getActionStyle = (action = "") => {
  const act = action.toLowerCase();
  if (
    act.includes("delete") ||
    act.includes("remove") ||
    act.includes("revoke")
  ) {
    return {
      bg: "rgba(239, 68, 68, 0.15)",
      color: "#fca5a5",
      border: "1px solid rgba(239,68,68,0.4)",
    };
  }
  if (act.includes("create") || act.includes("add") || act.includes("grant")) {
    return {
      bg: "rgba(16, 185, 129, 0.15)",
      color: "#34d399",
      border: "1px solid rgba(16,185,129,0.4)",
    };
  }
  if (
    act.includes("update") ||
    act.includes("edit") ||
    act.includes("modify")
  ) {
    return {
      bg: "rgba(245, 158, 11, 0.15)",
      color: "#fcd34d",
      border: "1px solid rgba(245,158,11,0.4)",
    };
  }
  return {
    bg: "rgba(56, 189, 248, 0.15)",
    color: "#7dd3fc",
    border: "1px solid rgba(6, 182, 212, 0.4)",
  };
};

export const auditStyles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "radial-gradient(circle at 50% -20%, #1e293b 0%, #020617 80%)",
    backgroundAttachment: "fixed",
    
    color: "#f8fafc",
    fontFamily: "'Inter', sans-serif",
  },
  main: {
    flex: 1,
    padding: "clamp(32px, 5vw, 64px)",
    marginLeft: "324px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
    paddingBottom: "24px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
  },
  titleWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  titleDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    backgroundColor: "#06b6d4",
    boxShadow: "0 0 15px rgba(56, 189, 248, 0.8)",
  },
  titleText: {
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
  searchBar: {
    ...glassPanel,
    padding: "20px 24px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "32px",
  },
  searchInput: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    backdropFilter: "blur(40px)",
    WebkitBackdropFilter: "blur(40px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "32px",
    padding: "16px 20px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "800",
    outline: "none",
  },
  clearBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "900",
    padding: "12px 24px",
    borderRadius: "32px",
    transition: "all 0.3s",
  },
  tableCard: {
    ...glassPanel,
    overflow: "hidden",
  },
  centerBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "100px 20px",
    color: "#94a3b8",
    gap: "20px",
  },
  centerText: {
    fontSize: "16px",
    fontWeight: "800",
  },
  emptyStateText: {
    textAlign: "center",
    padding: "100px 20px",
    color: "#94a3b8",
    fontSize: "16px",
    fontWeight: "800",
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0 4px",
    textAlign: "left",
  },
  theadRow: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  th: {
    textAlign: "left",
    padding: "24px 32px",
    fontSize: "9px",
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: "2px",
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
    backgroundColor: "transparent",
  },
  thFlex: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  tr: {
    backgroundColor: "rgba(255, 255, 255, 0.01)",
    transition: "background-color 0.2s ease",
  },
  tdTimestamp: {
    padding: "clamp(32px, 5vw, 64px)",
    whiteSpace: "nowrap",
    borderBottom: "1px solid rgba(255, 255, 255, 0.02)",
  },
  dateText: {
    fontSize: "14px",
    fontWeight: "900",
    color: "#ffffff",
  },
  timeText: {
    fontSize: "13px",
    color: "#94a3b8",
    marginTop: "6px",
    fontWeight: "700",
  },
  tdAdmin: {
    padding: "clamp(32px, 5vw, 64px)",
    fontWeight: "900",
    color: "#06b6d4",
    fontSize: "15px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.02)",
  },
  tdAction: {
    padding: "clamp(32px, 5vw, 64px)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.02)",
  },
  actionBadge: (actionStyle) => ({
    padding: "8px 16px",
    borderRadius: "32px",
    fontSize: "12px",
    fontWeight: "900",
    backgroundColor: actionStyle.bg,
    color: actionStyle.color,
    border: actionStyle.border,
    display: "inline-block",
    textTransform: "uppercase",
  }),
  tdTarget: {
    padding: "clamp(32px, 5vw, 64px)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.02)",
  },
  targetBadge: {
    fontFamily: "monospace",
    color: "#d8b4fe",
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    padding: "6px 12px",
    borderRadius: "10px",
    fontSize: "13px",
    border: "1px solid rgba(168, 85, 247, 0.3)",
    fontWeight: "800",
  },
  tdDetails: {
    padding: "clamp(32px, 5vw, 64px)",
    color: "#cbd5e1",
    fontSize: "14px",
    maxWidth: "350px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.02)",
    lineHeight: "1.6",
  },
};
