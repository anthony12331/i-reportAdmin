// admin-dashboard/src/themes/auditStyles.js

const glassPanel = {
  backgroundColor: "#ffffff",
  border: "1px solid #dfeae3",
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
  borderRadius: "14px",
};

export const getActionStyle = (action = "") => {
  const act = action.toLowerCase();
  if (
    act.includes("delete") ||
    act.includes("remove") ||
    act.includes("revoke")
  ) {
    return {
      bg: "#fee2e2",
      color: "#b91c1c",
      border: "1px solid #f5d6d6",
    };
  }
  if (act.includes("create") || act.includes("add") || act.includes("grant")) {
    return {
      bg: "#dcfce7",
      color: "#15803d",
      border: "1px solid #bbf7d0",
    };
  }
  if (
    act.includes("update") ||
    act.includes("edit") ||
    act.includes("modify")
  ) {
    return {
      bg: "#fef3c7",
      color: "#b45309",
      border: "1px solid #f9d49c",
    };
  }
  return {
    bg: "#e0f2fe",
    color: "#0369a1",
    border: "1px solid #bae6fd",
  };
};

export const auditStyles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "radial-gradient(circle at 50% -20%, #ffffff 0%, #f6faf7 80%)",
    color: "#111827",
    fontFamily: "Inter, Arial, sans-serif",
  },
  main: {
    flex: 1,
    padding: "16px 24px 40px",
    marginLeft: "216px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: "24px",
    paddingBottom: "12px",
    borderBottom: "1px solid #dfeae3",
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
    backgroundColor: "#1d7a4d",
    boxShadow: "0 0 15px rgba(29, 122, 77, 0.28)",
  },
  titleText: {
    fontSize: "clamp(24px, 3vw, 32px)",
    fontWeight: "800",
    letterSpacing: "-0.03em",
    color: "#111111",
    margin: 0,

  },
  subtitle: {
    fontSize: "10px",
    margin: "8px 0 0 0",
    fontWeight: "600",
    color: "#477257",
    textTransform: "none",
    letterSpacing: "0.3px",
  },
  searchBar: {
    ...glassPanel,
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "24px",
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#fbfdfb",
    border: "1px solid #dfeae3",
    borderRadius: "10px",
    padding: "12px 14px",
    color: "#111827",
    fontSize: "14px",
    fontWeight: "600",
    outline: "none",
  },
  clearBtn: {
    backgroundColor: "#ffffff",
    border: "1px solid #dfeae3",
    color: "#1f3a2f",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "900",
    padding: "12px 24px",
    borderRadius: "10px",
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
    color: "#5f7b69",
    gap: "20px",
  },
  centerText: {
    fontSize: "16px",
    fontWeight: "800",
  },
  emptyStateText: {
    textAlign: "center",
    padding: "100px 20px",
    color: "#5f7b69",
    fontSize: "16px",
    fontWeight: "800",
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0",
    textAlign: "left",
  },
  theadRow: {
    backgroundColor: "#f6faf7",
    color: "#5f7b69",
    fontSize: "12px",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  th: {
    textAlign: "left",
    padding: "14px 20px",
    fontSize: "9px",
    fontWeight: "700",
    color: "#5f7b69",
    letterSpacing: "2px",
    textTransform: "uppercase",
    borderBottom: "1px solid #dfeae3",
    backgroundColor: "transparent",
  },
  thFlex: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  tr: {
    backgroundColor: "#ffffff",
    transition: "background-color 0.2s ease",
  },
  tdTimestamp: {
    padding: "18px 20px",
    whiteSpace: "nowrap",
    borderBottom: "1px solid #edf3ee",
  },
  dateText: {
    fontSize: "14px",
    fontWeight: "900",
    color: "#111827",
  },
  timeText: {
    fontSize: "13px",
    color: "#5f7b69",
    marginTop: "6px",
    fontWeight: "700",
  },
  tdAdmin: {
    padding: "18px 20px",
    fontWeight: "900",
    color: "#177a4a",
    fontSize: "15px",
    borderBottom: "1px solid #edf3ee",
  },
  tdAction: {
    padding: "18px 20px",
    borderBottom: "1px solid #edf3ee",
  },
  actionBadge: (actionStyle) => ({
    padding: "6px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "900",
    backgroundColor: actionStyle.bg,
    color: actionStyle.color,
    border: actionStyle.border,
    display: "inline-block",
    textTransform: "uppercase",
  }),
  tdTarget: {
    padding: "18px 20px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.02)",
  },
  targetBadge: {
    fontFamily: "monospace",
    color: "#6d28d9",
    backgroundColor: "#f3e8ff",
    padding: "6px 12px",
    borderRadius: "10px",
    fontSize: "13px",
    border: "1px solid #e9d5ff",
    fontWeight: "800",
  },
  tdDetails: {
    padding: "18px 20px",
    color: "#374151",
    fontSize: "14px",
    maxWidth: "350px",
    borderBottom: "1px solid #edf3ee",
    lineHeight: "1.6",
  },
  detailsToggle: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    marginTop: "8px",
    padding: "6px 10px",
    border: "1px solid #b8d7c1",
    borderRadius: "6px",
    background: "#f1f9f3",
    color: "#177a4a",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: "800",
    transition: "transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease",
  },
  expandedRow: {
    backgroundColor: "#f6faf7",
  },
  expandedCell: {
    padding: "18px 20px",
    borderBottom: "1px solid #dfeae3",
  },
  expandedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px 22px",
  },
  expandedLabel: {
    display: "block",
    marginBottom: "4px",
    color: "#7a9a83",
    fontSize: "10px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  expandedValue: {
    display: "block",
    color: "#18251d",
    fontSize: "13px",
    lineHeight: "1.45",
    wordBreak: "break-word",
  },
};
