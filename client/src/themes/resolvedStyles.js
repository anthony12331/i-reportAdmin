// src/themes/resolvedStyles.js
export function getUnitStyles(department = "") {
  const dept = department ? department.toLowerCase() : "";

  if (dept.includes("pnp") || dept.includes("police")) {
    return {
      color: "#1d4ed8",
      bg: "#eff6ff",
    };
  }

  if (dept.includes("bfp") || dept.includes("fire")) {
    return {
      color: "#b91c1c",
      bg: "#fef2f2",
    };
  }

  if (dept.includes("rhu") || dept.includes("medical") || dept.includes("health")) {
    return {
      color: "#b91c1c",
      bg: "#fef2f2",
    };
  }

  return {
    color: "#15803d",
    bg: "#f0fdf4",
  };
}

const glassPanel = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
  borderRadius: "8px",
};

export const resolvedStyles = {
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
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  pageTitle: {
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "20px",
    fontWeight: "600",
    color: "#0f172a",
    letterSpacing: "-0.02em",
    margin: 0,
    textTransform: "capitalize",
  },
  subtitle: {
    fontSize: "13px",
    margin: "4px 0 0 0",
    fontWeight: "400",
    color: "#64748b",
    textTransform: "none",
    letterSpacing: "0",
  },
  searchWrapper: {
    position: "relative",
    width: "100%",
  },
  searchInput: {
    width: "100%",
    padding: "10px 14px 10px 42px",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    color: "#0f172a",
    fontSize: "13px",
    fontWeight: "400",
    outline: "none",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
    transition: "border-color 0.15s ease",
  },
  filterGroup: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  filterBar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    padding: "12px 14px",
    marginBottom: "14px",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
  },
  filterBarSearch: {
    flex: "1 0 100%",
  },
  pillButton: (isActive) => ({
    background: isActive ? "#15803d" : "#ffffff",
    color: isActive ? "#ffffff" : "#475569",
    border: isActive ? "1px solid #15803d" : "1px solid #e2e8f0",
    padding: "6px 12px",
    borderRadius: "6px",
    fontWeight: "500",
    fontSize: "11px",
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "all 0.15s ease",
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
    padding: "12px 18px",
    fontSize: "11px",
    fontWeight: "600",
    color: "#64748b",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    borderBottom: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
  },
  td: {
    padding: "14px 18px",
    verticalAlign: "middle",
    borderBottom: "1px solid #f1f5f9",
    color: "#334155",
    fontWeight: "400",
    fontSize: "13px",
  },
  mutedText: {
    fontSize: "11px",
    fontWeight: "400",
    color: "#94a3b8",
    marginTop: "2px",
  },
  detailsButton: {
    padding: "5px 10px",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    backgroundColor: "#ffffff",
    color: "#15803d",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
  },
};

export const ui = resolvedStyles;
