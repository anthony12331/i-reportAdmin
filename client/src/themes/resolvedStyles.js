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
  backgroundColor: "rgba(16, 23, 42, 0.6)",
    backdropFilter: "blur(24px) saturate(150%)",
    WebkitBackdropFilter: "blur(24px) saturate(150%)",
  
  
  border: "1px solid rgba(255, 255, 255, 0.08)",
  boxShadow: "0 15px 35px 0 rgba(0, 0, 0, 0.5)",
  borderRadius: "24px",
};

export const resolvedStyles = {
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
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
  },
  pageTitle: {
    fontSize: "32px",
    fontWeight: "900",
    letterSpacing: "-0.5px",
    background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
    
    
    margin: 0,

  },
  subtitle: {
    fontSize: "15px",
    margin: "8px 0 0 0",
    fontWeight: "500",
    color: "#94a3b8",
  },
  searchWrapper: {
    position: "relative",
    width: "440px",
  },
  searchInput: {
    width: "100%",
    padding: "16px 40px 16px 52px",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "20px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "800",
    outline: "none",
    boxShadow: "0 15px 35px 0 rgba(0, 0, 0, 0.5)",
    transition: "all 0.3s",
  },
  filterGroup: {
    display: "flex",
    gap: "14px",
    marginTop: "24px",
  },
  pillButton: (isActive) => ({
    background: isActive ? "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)" : "rgba(255, 255, 255, 0.05)",
    color: isActive ? "#ffffff" : "#cbd5e1",
    border: isActive ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
    padding: "12px 24px",
    borderRadius: "20px",
    fontWeight: "900",
    fontSize: "13px",
    letterSpacing: "0.5px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: isActive ? "0 8px 20px rgba(6, 182, 212, 0.3)" : "none",
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
    fontSize: "13px",
    fontWeight: "900",
    color: "#94a3b8",
    letterSpacing: "1px",
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
  },
  td: {
    padding: "24px 32px",
    verticalAlign: "middle",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
    color: "#ffffff",
    fontWeight: "800",
    fontSize: "15px",
  },
  mutedText: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#94a3b8",
    marginTop: "6px",
  },
};

export const ui = resolvedStyles;
