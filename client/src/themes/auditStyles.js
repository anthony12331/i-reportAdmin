// src/themes/auditStyles.js

const glassPanel = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
  borderRadius: "8px",
};

export const getActionStyle = (action = "") => {
  const act = action.toLowerCase();
  if (
    act.includes("delete") ||
    act.includes("remove") ||
    act.includes("revoke")
  ) {
    return {
      bg: "#fef2f2",
      color: "#b91c1c",
      border: "1px solid #fee2e2",
    };
  }
  if (act.includes("create") || act.includes("add") || act.includes("grant")) {
    return {
      bg: "#f0fdf4",
      color: "#15803d",
      border: "1px solid #dcfce7",
    };
  }
  if (
    act.includes("update") ||
    act.includes("edit") ||
    act.includes("modify")
  ) {
    return {
      bg: "#fffbeb",
      color: "#b45309",
      border: "1px solid #fef3c7",
    };
  }
  return {
    bg: "#f0f9ff",
    color: "#0369a1",
    border: "1px solid #e0f2fe",
  };
};

export const auditStyles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
    fontFamily: "Inter, Arial, sans-serif",
  },
  main: {
    flex: 1,
    padding: "24px 24px 40px",
    marginLeft: "216px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: "20px",
    paddingBottom: "14px",
    borderBottom: "1px solid #e2e8f0",
  },
  titleWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  titleDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#15803d",
  },
  titleText: {
    fontSize: "20px",
    fontWeight: "600",
    letterSpacing: "-0.02em",
    color: "#0f172a",
    margin: 0,
  },
  subtitle: {
    fontSize: "13px",
    margin: "4px 0 0 0",
    fontWeight: "400",
    color: "#64748b",
    textTransform: "none",
    letterSpacing: "0",
  },
  searchBar: {
    ...glassPanel,
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "16px",
  },
  searchInput: {
    border: "none",
    outline: "none",
    width: "100%",
    fontSize: "13px",
    backgroundColor: "transparent",
    color: "#0f172a",
  },
  tableCard: {
    ...glassPanel,
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "10px 14px",
    fontSize: "11px",
    fontWeight: "600",
    color: "#64748b",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    borderBottom: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
  },
  td: {
    padding: "12px 14px",
    verticalAlign: "middle",
    borderBottom: "1px solid #f1f5f9",
    color: "#334155",
    fontWeight: "400",
    fontSize: "13px",
  },
  actionBadge: (action) => {
    const style = getActionStyle(action);
    return {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "4px",
      backgroundColor: style.bg,
      color: style.color,
      border: style.border,
      fontSize: "11px",
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: "0.02em",
    };
  },
  emptyState: {
    padding: "60px 20px",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: "13px",
  },
  loadingState: {
    minHeight: "200px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#15803d",
    fontSize: "13px",
    fontWeight: "500",
  },
};
