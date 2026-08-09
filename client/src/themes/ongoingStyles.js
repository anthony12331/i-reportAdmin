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
  backgroundColor: "rgba(16, 23, 42, 0.6)",
    backdropFilter: "blur(24px) saturate(150%)",
    WebkitBackdropFilter: "blur(24px) saturate(150%)",
  
  
  border: "1px solid rgba(255, 255, 255, 0.08)",
  boxShadow: "0 15px 35px 0 rgba(0, 0, 0, 0.5)",
  borderRadius: "24px",
};

export const ongoingStyles = {
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
    paddingBottom: "24px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
  },
  headerTitleWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  pulseDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    backgroundColor: "#06b6d4",
    boxShadow: "0 0 15px rgba(56, 189, 248, 0.8)",
    animation: "pulseGlowRed 2s infinite",
  },
  pageTitle: {
    fontSize: "32px",
    fontWeight: "900",
    letterSpacing: "-0.5px",
    background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
    
    
    margin: 0,

  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "15px",
    margin: "8px 0 0 26px",
    fontWeight: "500",
  },
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "32px",
    alignItems: "center",
    ...glassPanel,
    padding: "16px 24px",
    borderRadius: "20px",
  },
  filterLabel: {
    fontSize: "13px",
    fontWeight: "900",
    color: "#f8fafc",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginRight: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  filterButton: (isActive) => ({
    background: isActive ? "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)" : "rgba(255, 255, 255, 0.05)",
    color: isActive ? "#ffffff" : "#94a3b8",
    border: isActive ? "1px solid transparent" : "1px solid rgba(255, 255, 255, 0.1)",
    padding: "10px 20px",
    borderRadius: "16px",
    fontWeight: "800",
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: isActive ? "0 8px 20px rgba(6, 182, 212, 0.3)" : "none",
    transition: "all 0.3s cubic-bezier(0.25,0.8,0.25,1)",
  }),
  emptyState: {
    textAlign: "center",
    padding: "100px 20px",
    ...glassPanel,
    border: "2px dashed rgba(255, 255, 255, 0.1)",
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: "15px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
    gap: "32px",
  },
  card: (borderColor) => ({
    ...glassPanel,
    border: `1px solid ${borderColor}`,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
  }),
  cardHeader: (headerBg) => ({
    backgroundColor: headerBg,
    padding: "20px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
  }),
  typeLabel: (color) => ({
    fontWeight: "900",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color,
    letterSpacing: "0.5px",
    textShadow: `0 0 10px ${color}`,
  }),
  timeBadge: {
    fontSize: "12px",
    fontWeight: "900",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "#ffffff",
    padding: "6px 14px",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  cardBody: {
    padding: "24px",
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  reporterBox: {
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: "20px",
    borderRadius: "16px",
    border: "1px solid rgba(255, 255, 255, 0.08)",
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
    borderRadius: "16px",
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#818cf8",
    border: "1px solid rgba(99,102,241,0.3)",
  },
  reporterName: {
    display: "block",
    fontWeight: "900",
    fontSize: "17px",
    color: "#ffffff",
  },
  verifiedBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#34d399",
    fontSize: "12px",
    fontWeight: "900",
  },
  phoneText: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "#cbd5e1",
    fontWeight: "700",
  },
  responderBanner: (borderColor) => ({
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: "16px 20px",
    borderRadius: "16px",
    marginBottom: "20px",
    border: `1px solid ${borderColor}`,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  }),
  responderText: {
    color: "#f8fafc",
    fontWeight: "900",
    fontSize: "14px",
    letterSpacing: "0.5px",
  },
  locationText: {
    margin: "0 0 16px 0",
    fontSize: "15px",
    fontWeight: "800",
    color: "#06b6d4",
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    lineHeight: "1.5",
  },
  mapPreviewWrapper: {
    width: "100%",
    height: "180px",
    borderRadius: "16px",
    overflow: "hidden",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    position: "relative",
    cursor: "zoom-in",
    boxShadow: "0 15px 35px 0 rgba(0, 0, 0, 0.5)",
  },
  mapBadge: {
    position: "absolute",
    bottom: "12px",
    right: "12px",
    backgroundColor: "rgba(16, 23, 42, 0.6)",
    backdropFilter: "blur(24px) saturate(150%)",
    WebkitBackdropFilter: "blur(24px) saturate(150%)",
    
    color: "#06b6d4",
    padding: "8px 16px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: "900",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid rgba(6, 182, 212, 0.3)",
  },
  mediaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },
  mediaTile: (hasUrl) => ({
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "16px",
    overflow: "hidden",
    height: "140px",
    position: "relative",
    cursor: hasUrl ? "zoom-in" : "default",
    backgroundColor: "rgba(0,0,0,0.2)",
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
    borderRadius: "16px",
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
    background: "linear-gradient(-45deg, #090a0f, #10172a, #0b1120, #020617)",
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
