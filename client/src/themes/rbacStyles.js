export const AVAILABLE_MODULES = [
  {
    id: "incidents",
    label: "Incidents Management",
    description: "Manage incoming emergency reports, assign units, and update case statuses.",
  },
  {
    id: "sos",
    label: "SOS Tracking",
    description: "Live spatial tracking of active emergency SOS signals and dispatch telemetry.",
  },
  {
    id: "users",
    label: "User Registration Management",
    description: "Audit and verify civilian account registrations and submitted credentials.",
  },
  {
    id: "reports",
    label: "Data & Reports Analytics",
    description: "Access system analytics, generate telemetry graphs, and export official PDF logs.",
  },
  {
    id: "pins",
    label: "Responder PIN Generation",
    description: "Generate and manage responder registration access PINs for the emergency system.",
  },
];

export function getRbacStyles(isDark = false) {
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
      alignItems: "center",
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
    },
    layoutGrid: {
      display: "grid",
      gridTemplateColumns: "360px 1fr",
      gap: "24px",
      alignItems: "start",
    },
    leftPanel: {
      ...glassPanel,
      padding: "18px",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
    },
    leftPanelHeader: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
      paddingBottom: "10px",
    },
    leftPanelTitle: {
      fontSize: "15px",
      fontWeight: "700",
      color: isDark ? "#f8fafc" : "#0f172a",
      margin: 0,
    },
    adminList: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      maxHeight: "620px",
      overflowY: "auto",
    },
    adminItem: (isSelected) => ({
      padding: "12px 14px",
      borderRadius: "12px",
      border: isSelected
        ? (isDark ? "2px solid #4ade80" : "2px solid #15803d")
        : (isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0"),
      backgroundColor: isSelected
        ? (isDark ? "rgba(34, 197, 94, 0.15)" : "#f0fdf4")
        : (isDark ? "#172338" : "#ffffff"),
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      transition: "all 0.18s ease",
    }),
    adminAvatar: {
      width: "36px",
      height: "36px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: "700",
      fontSize: "12px",
      flexShrink: 0,
    },
    adminInfo: {
      flex: 1,
      minWidth: 0,
    },
    adminName: (isSelected) => ({
      fontSize: "13.5px",
      fontWeight: "700",
      color: isSelected
        ? (isDark ? "#4ade80" : "#14532d")
        : (isDark ? "#f8fafc" : "#0f172a"),
      margin: 0,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    }),
    adminEmail: {
      fontSize: "12px",
      color: isDark ? "#94a3b8" : "#64748b",
      margin: 0,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    rightPanel: {
      ...glassPanel,
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
    },
    rightPanelHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
      paddingBottom: "20px",
      marginBottom: "22px",
      flexWrap: "wrap",
      gap: "16px",
    },
    moduleGrid: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      marginBottom: "26px",
    },
    moduleCard: (isEnabled) => ({
      padding: "16px 18px",
      borderRadius: "12px",
      border: isEnabled
        ? (isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0")
        : (isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0"),
      backgroundColor: isEnabled
        ? (isDark ? "rgba(34, 197, 94, 0.12)" : "#f0fdf4")
        : (isDark ? "#172338" : "#ffffff"),
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      transition: "all 0.15s ease",
    }),
    moduleTitle: (isEnabled) => ({
      fontSize: "14px",
      fontWeight: "700",
      color: isDark ? "#f8fafc" : "#0f172a",
      margin: 0,
    }),
    moduleDesc: {
      fontSize: "12.5px",
      color: isDark ? "#cbd5e1" : "#64748b",
      margin: 0,
      lineHeight: "1.4",
    },
    saveBtn: {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      padding: "11px 24px",
      borderRadius: "10px",
      border: "none",
      background: "linear-gradient(135deg, #15803d 0%, #166534 100%)",
      color: "#ffffff",
      fontSize: "14px",
      fontWeight: "700",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(21, 128, 61, 0.3)",
      transition: "transform 0.15s ease",
    },
    emptySelection: {
      padding: "60px 20px",
      textAlign: "center",
      color: isDark ? "#94a3b8" : "#64748b",
      fontSize: "13.5px",
    },
  };
}

export const rbacStyles = getRbacStyles(false);

