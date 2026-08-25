export function getUnitStyles(department = "") {
  const dept = department ? department.toLowerCase() : "";

  if (dept.includes("pnp") || dept.includes("police")) {
    return {
      color: "#06b6d4",
      bg: "rgba(56, 189, 248, 0.15)",
    };
  }

  if (dept.includes("bfp") || dept.includes("fire")) {
    return {
      color: "#fb923c",
      bg: "rgba(251, 146, 60, 0.15)",
    };
  }

  if (dept.includes("rhu") || dept.includes("medical") || dept.includes("health")) {
    return {
      color: "#f87171",
      bg: "rgba(248, 113, 113, 0.15)",
    };
  }

  return {
    color: "#34d399",
    bg: "rgba(52, 211, 153, 0.15)",
  };
}

const glassPanel = {
  backgroundColor: "#ffffff",
  border: "1px solid #d7e5da",
  boxShadow: "0 8px 24px rgba(24, 95, 53, 0.06)",
  borderRadius: "12px",
};

export const resolvedStyles = {
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
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  pageTitle: {
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "20px",
    fontWeight: "800",
    color: "#111111",
    letterSpacing: "0",
    margin: 0,
    textTransform: "capitalize",
  },
  subtitle: {
    fontSize: "15px",
    margin: "8px 0 0 0",
    fontWeight: "600",
    color: "#477257",
    textTransform: "none",
    letterSpacing: "0.3px",
  },
  searchWrapper: {
    position: "relative",
    width: "100%",
  },
  searchInput: {
    width: "100%",
    padding: "16px 40px 16px 52px",
    backgroundColor: "#ffffff",
    border: "1px solid #c8ddce",
    borderRadius: "9px",
    color: "#111111",
    fontSize: "15px",
    fontWeight: "800",
    outline: "none",
    boxShadow: "0 8px 20px rgba(24, 95, 53, 0.08)",
    transition: "all 0.3s",
  },
  filterGroup: {
    display: "flex",
    gap: "14px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  filterBar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    padding: "14px 16px",
    marginBottom: "14px",
    backgroundColor: "#ffffff",
    border: "1px solid #d7e5da",
    borderRadius: "8px",
    boxShadow: "0 4px 14px rgba(24, 95, 53, 0.04)",
  },
  filterBarSearch: {
    flex: "1 0 100%",
  },
  pillButton: (isActive) => ({
    background: isActive ? "#18864b" : "#ffffff",
    color: isActive ? "#ffffff" : "#477257",
    border: isActive ? "1px solid #18864b" : "1px solid #c8ddce",
    padding: "9px 14px",
    borderRadius: "7px",
    fontWeight: "700",
    fontSize: "10px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    boxShadow: isActive ? "0 6px 14px rgba(24, 95, 53, 0.16)" : "none",
  }),
  panel: {
    ...glassPanel,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "24px 32px",
    fontSize: "12px",
    fontWeight: "700",
    color: "#477257",
    letterSpacing: "2px",
    textTransform: "uppercase",
    borderBottom: "1px solid #d7e5da",
    backgroundColor: "#e7f5eb",
  },
  td: {
    padding: "24px 32px",
    verticalAlign: "middle",
    borderBottom: "1px solid #edf3ee",
    color: "#111111",
    fontWeight: "500",
    fontSize: "14px",
  },
  mutedText: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#94a3b8",
    marginTop: "6px",
  },
  detailsButton: {
    padding: "9px 12px",
    border: "1px solid #b8d7c1",
    borderRadius: "8px",
    backgroundColor: "#f6faf7",
    color: "#177a4a",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "800",
    whiteSpace: "nowrap",
    transition: "all 0.2s ease",
  },
};

export const ui = resolvedStyles;
