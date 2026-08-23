// src/ongoingStyles.js
import React from "react";
import { Flame, Ambulance, Car, AlertOctagon, ShieldAlert } from "lucide-react";

export function getIncidentTheme(type = "") {
  const category = type.toLowerCase();

  if (category.includes("fire")) {
    return {
      border: "rgba(249, 115, 22, 0.5)",
      headerBg: "rgba(249, 115, 22, 0.1)",
      accentText: "#fdba74",
      label: "FIRE EMERGENCY",
      icon: Flame,
    };
  }

  if (category.includes("medical") || category.includes("health")) {
    return {
      border: "rgba(239, 68, 68, 0.5)",
      headerBg: "rgba(239, 68, 68, 0.1)",
      accentText: "#fca5a5",
      label: "MEDICAL RESPONSE",
      icon: Ambulance,
    };
  }

  if (category.includes("traffic") || category.includes("accident")) {
    return {
      border: "rgba(59, 130, 246, 0.5)",
      headerBg: "rgba(59, 130, 246, 0.1)",
      accentText: "#93c5fd",
      label: "TRAFFIC / ACCIDENT",
      icon: Car,
    };
  }

  if (
    category.includes("crime") ||
    category.includes("police") ||
    category.includes("security")
  ) {
    return {
      border: "rgba(168, 85, 247, 0.5)",
      headerBg: "rgba(168, 85, 247, 0.1)",
      accentText: "#d8b4fe",
      label: "POLICE / SECURITY",
      icon: ShieldAlert,
    };
  }

  return {
    border: "rgba(245, 158, 11, 0.5)",
    headerBg: "rgba(245, 158, 11, 0.1)",
    accentText: "#fcd34d",
    label: "DISPATCH UNIT",
    icon: AlertOctagon,
  };
}

const glassPanel = {
  backgroundColor: "#ffffff",
  border: "1px solid #d7e5da",
  boxShadow: "0 8px 24px rgba(24, 95, 53, 0.06)",
  borderRadius: "12px",
};

export const ongoingStyles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "radial-gradient(circle at 50% -20%, #ffffff 0%, #f6faf7 80%)",
    color: "#111111",
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
    alignItems: "center",
    marginBottom: "24px",
    paddingBottom: "14px",
    borderBottom: "1px solid #dfeae3",
  },
  headerTitleWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  pulseDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    backgroundColor: "#18864b",
    boxShadow: "0 0 10px rgba(24, 134, 75, 0.35)",
    animation: "pulseGlowRed 2s infinite",
  },
  pageTitle: {
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: "clamp(24px, 3vw, 32px)",
    fontWeight: "800",
    color: "#111111",
    letterSpacing: "0",
    margin: 0,
    textTransform: "capitalize",
  },
  subtitle: {
    fontSize: "10px",
    margin: "8px 0 0 0",
    fontWeight: "600",
    color: "#477257",
    textTransform: "none",
    letterSpacing: "0.3px",
  },
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "20px",
    alignItems: "center",
    ...glassPanel,
    padding: "12px 14px",
    borderRadius: "12px",
  },
  filterLabel: {
    fontSize: "13px",
    fontWeight: "900",
    color: "#111111",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginRight: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  filterButton: (isActive) => ({
    background: isActive ? "#18864b" : "#ffffff",
    color: isActive ? "#ffffff" : "#477257",
    border: isActive ? "1px solid #18864b" : "1px solid #c8ddce",
    padding: "9px 14px",
    borderRadius: "7px",
    fontWeight: "800",
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: isActive ? "0 6px 14px rgba(24, 95, 53, 0.16)" : "none",
    transition: "all 0.3s cubic-bezier(0.25,0.8,0.25,1)",
  }),
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "80px 20px",
    ...glassPanel,
    border: "1px dashed #b8d7c1",
    color: "#477257",
    fontWeight: "700",
    fontSize: "15px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
    gap: "16px",
  },
  card: (borderColor) => ({
    ...glassPanel,
    borderRadius: "14px",
    border: `1px solid ${borderColor}`,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
  }),
  cardHeader: (headerBg) => ({
    backgroundColor: headerBg,
    padding: "14px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #d7e5da",
  }),
  typeLabel: (color) => ({
    fontWeight: "900",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color,
    letterSpacing: "0.5px",
    textShadow: "none",
  }),
  timeBadge: {
    fontSize: "12px",
    fontWeight: "900",
    backgroundColor: "#e7f5eb",
    color: "#18864b",
    padding: "5px 10px",
    borderRadius: "7px",
    border: "1px solid #b8d7c1",
  },
  cardBody: {
    padding: "20px",
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  reporterBox: {
    backgroundColor: "#f6faf7",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #d7e5da",
    marginBottom: "20px",
  },
  reporterHeader: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "12px",
  },
  avatarIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    backgroundColor: "#e7f5eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#18864b",
    border: "1px solid #b8d7c1",
  },
  reporterName: {
    display: "block",
    fontWeight: "900",
    fontSize: "17px",
    color: "#111111",
  },
  verifiedBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#18864b",
    fontSize: "12px",
    fontWeight: "900",
  },
  phoneText: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "#477257",
    fontWeight: "700",
  },
  responderBanner: (borderColor) => ({
    backgroundColor: "#f6faf7",
    padding: "12px 14px",
    borderRadius: "8px",
    marginBottom: "20px",
    border: `1px solid ${borderColor}`,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  }),
  responderText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: "14px",
    letterSpacing: "0.5px",
  },
  locationText: {
    margin: "0 0 16px 0",
    fontSize: "15px",
    fontWeight: "800",
    color: "#18864b",
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    lineHeight: "1.5",
  },
  mapPreviewWrapper: {
    width: "100%",
    height: "180px",
    borderRadius: "8px",
    overflow: "hidden",
    border: "1px solid #d7e5da",
    position: "relative",
    cursor: "zoom-in",
    boxShadow: "0 8px 18px rgba(24, 95, 53, 0.08)",
  },
  mapBadge: {
    position: "absolute",
    bottom: "12px",
    right: "12px",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    color: "#177a4a",
    padding: "8px 16px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "900",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid #dfeae3",
  },
  mediaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },
  mediaTile: (hasUrl) => ({
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "32px",
    overflow: "hidden",
    height: "140px",
    position: "relative",
    cursor: hasUrl ? "zoom-in" : "default",
    backgroundColor: "#f6faf7",
  }),
  noMediaBox: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: "13px",
  },
  overlayModal: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(2, 6, 23, 0.85)",
    zIndex: 9999,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "40px",
    
    cursor: "zoom-out",
  },
  modalMapCard: {
    width: "90vw",
    maxWidth: "1200px",
    ...glassPanel,
    cursor: "default",
  },
  modalMapHeader: {
    padding: "24px 32px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalCloseBtn: {
    background: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255,255,255,0.2)",
    width: "48px",
    height: "48px",
    borderRadius: "32px",
    color: "#ffffff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.3s",
  },
  closeCircleBtn: {
    position: "absolute",
    top: "-20px",
    right: "-20px",
    background: "radial-gradient(circle at 50% -20%, #1e293b 0%, #020617 80%)",
    color: "white",
    border: "none",
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 15px 35px 0 rgba(0, 0, 0, 0.5)",
  },
};
