// src/themes/auditStyles.js

export const getActionStyle = (action = "", isDark = false) => {
  const act = action.toLowerCase();
  if (
    act.includes("delete") ||
    act.includes("remove") ||
    act.includes("revoke") ||
    act.includes("suspend")
  ) {
    return {
      bg: isDark ? "rgba(239, 68, 68, 0.18)" : "#fef2f2",
      color: isDark ? "#f87171" : "#b91c1c",
      border: isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fee2e2",
    };
  }
  if (
    act.includes("create") ||
    act.includes("add") ||
    act.includes("grant") ||
    act.includes("restore") ||
    act.includes("verified") ||
    act.includes("reported")
  ) {
    return {
      bg: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
      color: isDark ? "#4ade80" : "#15803d",
      border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0",
    };
  }
  if (
    act.includes("update") ||
    act.includes("edit") ||
    act.includes("modify") ||
    act.includes("dispatch")
  ) {
    return {
      bg: isDark ? "rgba(245, 158, 11, 0.18)" : "#fffbeb",
      color: isDark ? "#fbbf24" : "#b45309",
      border: isDark ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid #fef3c7",
    };
  }
  return {
    bg: isDark ? "rgba(59, 130, 246, 0.18)" : "#f0f9ff",
    color: isDark ? "#60a5fa" : "#0369a1",
    border: isDark ? "1px solid rgba(59, 130, 246, 0.35)" : "1px solid #e0f2fe",
  };
};

export function getAuditStyles(isDark = false) {
  const glassPanel = {
    backgroundColor: isDark ? "#131c2e" : "#ffffff",
    border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
    boxShadow: isDark
      ? "0 4px 20px -2px rgba(0, 0, 0, 0.5)"
      : "0 1px 2px rgba(0, 0, 0, 0.03)",
    borderRadius: "16px",
  };

  return {
    shell: {
      display: "flex",
      minHeight: "100vh",
      background: isDark ? "#090d16" : "#f8fafc",
      color: isDark ? "#f8fafc" : "#0f172a",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    },
    main: {
      flex: 1,
      padding: "32px 36px",
      marginLeft: "216px",
      minWidth: 0,
      overflowY: "auto",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginBottom: "28px",
      paddingBottom: "14px",
      borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
    },
    titleWrapper: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    titleDot: {
      width: "10px",
      height: "10px",
      borderRadius: "50%",
      backgroundColor: isDark ? "#4ade80" : "#15803d",
    },
    titleText: {
      fontSize: "clamp(22px, 3vw, 28px)",
      fontWeight: "800",
      letterSpacing: "-0.02em",
      color: isDark ? "#f8fafc" : "#14532d",
      margin: 0,
    },
    subtitle: {
      fontSize: "14px",
      margin: "6px 0 0 0",
      fontWeight: "400",
      color: isDark ? "#94a3b8" : "#64748b",
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
      color: isDark ? "#f8fafc" : "#0f172a",
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
      padding: "12px 14px",
      fontSize: "11px",
      fontWeight: "800",
      color: isDark ? "#cbd5e1" : "#64748b",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
      backgroundColor: isDark ? "#172338" : "#f8fafc",
    },
    td: {
      padding: "12px 14px",
      verticalAlign: "middle",
      borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid #f1f5f9",
      color: isDark ? "#cbd5e1" : "#334155",
      fontWeight: "400",
      fontSize: "13px",
    },
    actionBadge: (action) => {
      const style = getActionStyle(action, isDark);
      return {
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: "12px",
        backgroundColor: style.bg,
        color: style.color,
        border: style.border,
        fontSize: "11.5px",
        fontWeight: "700",
        textTransform: "none",
        letterSpacing: "0.02em",
      };
    },
    targetRef: {
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: "12px",
      fontWeight: "600",
      color: isDark ? "#4ade80" : "#475569",
      backgroundColor: isDark ? "#172338" : "#f1f5f9",
      border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "none",
      padding: "3px 8px",
      borderRadius: "6px",
    },
    emptyState: {
      padding: "60px 20px",
      textAlign: "center",
      color: isDark ? "#94a3b8" : "#64748b",
      fontSize: "13px",
    },
    loadingState: {
      minHeight: "200px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: isDark ? "#4ade80" : "#15803d",
      fontSize: "13px",
      fontWeight: "500",
    },
  };
}

export const auditStyles = getAuditStyles(false);

