// src/resolvedStyles.js

// Dynamic styling generator for assigned emergency responder units
export function getUnitStyles(department = "") {
  const dept = department ? department.toLowerCase() : "";

  if (dept.includes("pnp") || dept.includes("police")) {
    return {
      color: "#3b82f6",
      bg: "rgba(59, 130, 246, 0.12)",
    };
  }

  if (dept.includes("bfp") || dept.includes("fire")) {
    return {
      color: "#f97316",
      bg: "rgba(249, 115, 22, 0.12)",
    };
  }

  if (dept.includes("rhu") || dept.includes("medical") || dept.includes("health")) {
    return {
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.12)",
    };
  }

  // Default: MDRRMO HQ or General Responders
  return {
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.12)",
  };
}

export const resolvedStyles = {
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
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  pageTitle: {
    fontSize: "28px",
    fontWeight: "900",
    letterSpacing: "-0.5px",
    color: "#ffffff",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    margin: "6px 0 0 0",
    fontWeight: "500",
  },
  searchWrapper: {
    position: "relative",
    width: "360px",
  },
  searchInput: {
    width: "100%",
    padding: "12px 40px 12px 42px",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "14px",
    color: "#f8fafc",
    fontSize: "13px",
    fontWeight: "600",
    outline: "none",
  },
  filterGroup: {
    display: "flex",
    gap: "10px",
    marginTop: "16px",
  },
  pillButton: (isActive) => ({
    backgroundColor: isActive ? "#10b981" : "#1e293b",
    color: isActive ? "#0f172a" : "#94a3b8",
    border: "1px solid #334155",
    padding: "8px 16px",
    borderRadius: "20px",
    fontWeight: "800",
    fontSize: "11px",
    letterSpacing: "0.5px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  }),
  panel: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "16px 20px",
    fontSize: "11px",
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  td: {
    padding: "16px 20px",
    verticalAlign: "middle",
  },
  mutedText: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#94a3b8",
    marginTop: "2px",
  },
};

// Compatibility export
export const ui = resolvedStyles;