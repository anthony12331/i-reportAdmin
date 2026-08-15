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
  backgroundColor: "rgba(15, 23, 42, 0.7)",
    backdropFilter: "blur(40px)",
    WebkitBackdropFilter: "blur(40px)",
  
  
  border: "1px solid rgba(255, 255, 255, 0.08)",
  boxShadow: "0 15px 35px 0 rgba(0, 0, 0, 0.5)",
  borderRadius: "32px",
};

export const resolvedStyles = {
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
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
  },
  pageTitle: {
    fontFamily: '"Didot", "Bodoni MT", "Times New Roman", serif',
    fontSize: "48px",
    fontWeight: "400",
    color: "#ffffff",
    letterSpacing: "1px",
    margin: 0,
    textTransform: "capitalize",
  },
  subtitle: {
    fontSize: "10px",
    margin: "8px 0 0 0",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "3px",
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
    borderRadius: "32px",
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
    background: isActive ? "linear-gradient(135deg, #d4af37 0%, #b48e2d 100%)" : "transparent",
    color: isActive ? "#020617" : "#cbd5e1",
    border: isActive ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
    padding: "12px 24px",
    borderRadius: "99px",
    fontWeight: "700",
    fontSize: "10px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    boxShadow: isActive ? "0 10px 20px rgba(212, 175, 55, 0.3)" : "none",
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
    fontSize: "9px",
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: "2px",
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
    backgroundColor: "transparent",
  },
  td: {
    padding: "24px 32px",
    verticalAlign: "middle",
    borderBottom: "1px solid rgba(255, 255, 255, 0.02)",
    color: "#ffffff",
    fontWeight: "500",
    fontSize: "13px",
  },
  mutedText: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#94a3b8",
    marginTop: "6px",
  },
};

export const ui = resolvedStyles;
