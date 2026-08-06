// admin-dashboard/src/themes/auditStyles.js

// Helper function to format action badges with context colors
export const getActionStyle = (action = "") => {
  const act = action.toLowerCase();
  if (
    act.includes("delete") ||
    act.includes("remove") ||
    act.includes("revoke")
  ) {
    return {
      bg: "rgba(239, 68, 68, 0.15)",
      color: "#f87171",
      border: "1px solid #ef4444",
    };
  }
  if (act.includes("create") || act.includes("add") || act.includes("grant")) {
    return {
      bg: "rgba(16, 185, 129, 0.15)",
      color: "#34d399",
      border: "1px solid #10b981",
    };
  }
  if (
    act.includes("update") ||
    act.includes("edit") ||
    act.includes("modify")
  ) {
    return {
      bg: "rgba(245, 158, 11, 0.15)",
      color: "#fbbf24",
      border: "1px solid #f59e0b",
    };
  }
  return {
    bg: "rgba(56, 189, 248, 0.15)",
    color: "#38bdf8",
    border: "1px solid #38bdf8",
  };
};

export const auditStyles = {
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
  titleWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  titleDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    backgroundColor: "#ef4444",
    boxShadow: "0 0 12px #ef4444",
  },
  titleText: {
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
  searchBar: {
    backgroundColor: "#1e293b",
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid #334155",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "24px",
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "10px",
    padding: "10px 14px",
    color: "#f8fafc",
    fontSize: "13px",
    fontWeight: "600",
    outline: "none",
  },
  clearBtn: {
    backgroundColor: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "700",
    padding: "0 8px",
  },
  tableCard: {
    backgroundColor: "#1e293b",
    borderRadius: "16px",
    border: "1px solid #334155",
    overflow: "hidden",
  },
  centerBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 20px",
    color: "#94a3b8",
    gap: "12px",
  },
  centerText: {
    fontSize: "14px",
    fontWeight: "700",
  },
  emptyStateText: {
    textAlign: "center",
    padding: "60px 20px",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: "700",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },
  theadRow: {
    backgroundColor: "#0f172a",
    borderBottom: "2px solid #334155",
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  th: {
    padding: "16px",
  },
  thFlex: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  tr: {
    borderBottom: "1px solid #334155",
    transition: "background-color 0.15s ease",
  },
  tdTimestamp: {
    padding: "16px",
    whiteSpace: "nowrap",
  },
  dateText: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#cbd5e1",
  },
  timeText: {
    fontSize: "11px",
    color: "#64748b",
    marginTop: "2px",
  },
  tdAdmin: {
    padding: "16px",
    fontWeight: "800",
    color: "#f8fafc",
    fontSize: "13px",
  },
  tdAction: {
    padding: "16px",
  },
  actionBadge: (actionStyle) => ({
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "800",
    backgroundColor: actionStyle.bg,
    color: actionStyle.color,
    border: actionStyle.border,
    display: "inline-block",
    textTransform: "uppercase",
  }),
  tdTarget: {
    padding: "16px",
  },
  targetBadge: {
    fontFamily: "monospace",
    color: "#38bdf8",
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    border: "1px solid rgba(56, 189, 248, 0.2)",
  },
  tdDetails: {
    padding: "16px",
    color: "#94a3b8",
    fontSize: "13px",
    maxWidth: "300px",
  },
};
