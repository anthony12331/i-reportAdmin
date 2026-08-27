// src/themes/ongoingBackupStyles.js

export function getOngoingBackupStyles(isDark = false) {
  const glassPanel = {
    backgroundColor: isDark ? "#131c2e" : "#ffffff",
    border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
    boxShadow: isDark
      ? "0 4px 20px -2px rgba(0, 0, 0, 0.5)"
      : "0 1px 2px rgba(0, 0, 0, 0.03)",
    borderRadius: "16px",
  };

  return {
    container: {
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
      marginBottom: "28px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      flexWrap: "wrap",
      gap: "16px",
      borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
      paddingBottom: "14px",
    },
    title: {
      fontSize: "clamp(22px, 3vw, 28px)",
      fontWeight: "800",
      color: isDark ? "#f8fafc" : "#14532d",
      margin: "0 0 4px 0",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      letterSpacing: "-0.02em",
    },
    subtitle: {
      fontSize: "14px",
      color: isDark ? "#94a3b8" : "#64748b",
      margin: 0,
      fontWeight: "400",
    },
    refreshBtn: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "7px 14px",
      borderRadius: "10px",
      border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
      backgroundColor: isDark ? "#172338" : "#ffffff",
      color: isDark ? "#cbd5e1" : "#475569",
      fontSize: "12.5px",
      fontWeight: "700",
      cursor: "pointer",
    },
    cardGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
      gap: "22px",
    },
    card: {
      ...glassPanel,
      padding: "22px",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
      borderTop: "4px solid #15803d",
    },
    requesterName: {
      fontSize: "15.5px",
      fontWeight: "800",
      color: isDark ? "#f8fafc" : "#0f172a",
      margin: "0 0 2px 0",
    },
    statusBadge: (status) => {
      let bg = isDark ? "rgba(100, 116, 139, 0.18)" : "#f1f5f9";
      let color = isDark ? "#94a3b8" : "#475569";
      let border = isDark ? "1px solid rgba(100, 116, 139, 0.35)" : "1px solid #e2e8f0";

      switch (status) {
        case "assigned":
          bg = isDark ? "rgba(59, 130, 246, 0.18)" : "#eff6ff";
          color = isDark ? "#60a5fa" : "#1d4ed8";
          border = isDark ? "1px solid rgba(59, 130, 246, 0.35)" : "1px solid #bfdbfe";
          break;
        case "accepted":
          bg = isDark ? "rgba(168, 85, 247, 0.18)" : "#faf5ff";
          color = isDark ? "#c084fc" : "#6d28d9";
          border = isDark ? "1px solid rgba(168, 85, 247, 0.35)" : "1px solid #e9d5ff";
          break;
        case "en_route":
          bg = isDark ? "rgba(245, 158, 11, 0.18)" : "#fffbeb";
          color = isDark ? "#fbbf24" : "#b45309";
          border = isDark ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid #fef3c7";
          break;
        case "at_scene":
        case "completed":
          bg = isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4";
          color = isDark ? "#4ade80" : "#15803d";
          border = isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #dcfce7";
          break;
        default:
          break;
      }

      return {
        padding: "3px 8px",
        borderRadius: "8px",
        backgroundColor: bg,
        color: color,
        fontSize: "11px",
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        border: border,
      };
    },
    metaText: {
      fontSize: "12px",
      color: isDark ? "#94a3b8" : "#64748b",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      marginBottom: "6px",
      lineHeight: 1.4,
    },
    responderBox: {
      backgroundColor: isDark ? "#172338" : "#f8fafc",
      border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
      padding: "12px",
      borderRadius: "10px",
      marginTop: "12px",
      borderLeft: "3px solid #15803d",
    },
    emptyState: {
      padding: "70px 24px",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: isDark ? "#131c2e" : "linear-gradient(180deg, #ffffff 0%, #f6faf7 100%)",
      borderRadius: "16px",
      border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
    },
  };
}

export const ongoingBackupStyles = getOngoingBackupStyles(false);

