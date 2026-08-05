// src/ongoingStyles.js
import React from "react";
import { Flame, Ambulance, Car, AlertOctagon, ShieldAlert } from "lucide-react";

// Theme generator helper function based on incident category
export function getIncidentTheme(type = "") {
  const category = type.toLowerCase();

  if (category.includes("fire")) {
    return {
      border: "#f97316",
      headerBg: "rgba(249, 115, 22, 0.15)",
      accentText: "#fb923c",
      label: "FIRE EMERGENCY",
      icon: Flame,
    };
  }

  if (category.includes("medical") || category.includes("health")) {
    return {
      border: "#ef4444",
      headerBg: "rgba(239, 68, 68, 0.15)",
      accentText: "#f87171",
      label: "MEDICAL RESPONSE",
      icon: Ambulance,
    };
  }

  if (category.includes("traffic") || category.includes("accident")) {
    return {
      border: "#3b82f6",
      headerBg: "rgba(59, 130, 246, 0.15)",
      accentText: "#60a5fa",
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
      border: "#a855f7",
      headerBg: "rgba(168, 85, 247, 0.15)",
      accentText: "#c084fc",
      label: "POLICE / SECURITY",
      icon: ShieldAlert,
    };
  }

  return {
    border: "#f59e0b",
    headerBg: "rgba(245, 158, 11, 0.15)",
    accentText: "#fbbf24",
    label: "DISPATCH UNIT",
    icon: AlertOctagon,
  };
}

export const ongoingStyles = {
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "28px",
    paddingBottom: "20px",
    borderBottom: "1px solid #1e293b",
  },
  headerTitleWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  pulseDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    backgroundColor: "#f59e0b",
    boxShadow: "0 0 12px #f59e0b",
  },
  pageTitle: {
    fontSize: "28px",
    fontWeight: "900",
    letterSpacing: "-0.5px",
    color: "#ffffff",
    margin: 0,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "14px",
    margin: "6px 0 0 24px",
    fontWeight: "500",
  },
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "28px",
    alignItems: "center",
  },
  filterLabel: {
    fontSize: "12px",
    fontWeight: "800",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginRight: "8px",
  },
  filterButton: (isActive) => ({
    backgroundColor: isActive ? "#f59e0b" : "#1e293b",
    color: isActive ? "#0f172a" : "#94a3b8",
    border: "1px solid #334155",
    padding: "6px 14px",
    borderRadius: "20px",
    fontWeight: "800",
    fontSize: "12px",
    cursor: "pointer",
  }),
  emptyState: {
    textAlign: "center",
    padding: "80px 20px",
    backgroundColor: "#1e293b",
    borderRadius: "20px",
    border: "1px dashed #334155",
    color: "#94a3b8",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
    gap: "24px",
  },
  card: (borderColor) => ({
    backgroundColor: "#1e293b",
    border: `1px solid ${borderColor}`,
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
    display: "flex",
    flexDirection: "column",
  }),
  cardHeader: (headerBg) => ({
    backgroundColor: headerBg,
    padding: "14px 20px",
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
    gap: "8px",
    color,
    letterSpacing: "0.5px",
  }),
  timeBadge: {
    fontSize: "11px",
    fontWeight: "800",
    backgroundColor: "rgba(0,0,0,0.4)",
    color: "#cbd5e1",
    padding: "4px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  cardBody: {
    padding: "20px",
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  reporterBox: {
    backgroundColor: "#0f172a",
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid #334155",
    marginBottom: "14px",
  },
  reporterHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "10px",
  },
  avatarIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    backgroundColor: "#1e1b4b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#818cf8",
  },
  reporterName: {
    display: "block",
    fontWeight: "800",
    fontSize: "15px",
    color: "#f8fafc",
  },
  verifiedBadge: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    color: "#34d399",
    fontSize: "11px",
    fontWeight: "700",
  },
  phoneText: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    color: "#94a3b8",
    fontWeight: "600",
  },
  responderBanner: (borderColor) => ({
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    padding: "10px 14px",
    borderRadius: "10px",
    marginBottom: "16px",
    border: `1px solid ${borderColor}`,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  }),
  responderText: {
    color: "#f8fafc",
    fontWeight: "800",
    fontSize: "12px",
    letterSpacing: "0.3px",
  },
  locationText: {
    margin: "0 0 10px 0",
    fontSize: "13px",
    fontWeight: "700",
    color: "#60a5fa",
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    lineHeight: "1.4",
  },
  mapPreviewWrapper: {
    width: "100%",
    height: "140px",
    borderRadius: "14px",
    overflow: "hidden",
    border: "1px solid #334155",
    position: "relative",
    cursor: "zoom-in",
  },
  mapBadge: {
    position: "absolute",
    bottom: "8px",
    right: "8px",
    backgroundColor: "#0f172a",
    color: "#38bdf8",
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "10px",
    fontWeight: "800",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid #334155",
  },
  mediaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  mediaTile: (hasUrl) => ({
    border: "1px solid #334155",
    borderRadius: "12px",
    overflow: "hidden",
    height: "120px",
    position: "relative",
    cursor: hasUrl ? "zoom-in" : "default",
    backgroundColor: "#0f172a",
  }),
  noMediaBox: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#475569",
  },
  overlayModal: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(11, 15, 25, 0.95)",
    zIndex: 9999,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "30px",
    backdropFilter: "blur(10px)",
    cursor: "zoom-out",
  },
  modalMapCard: {
    width: "90vw",
    maxWidth: "1000px",
    backgroundColor: "#1e293b",
    borderRadius: "24px",
    overflow: "hidden",
    border: "1px solid #334155",
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
    cursor: "default",
  },
  modalMapHeader: {
    padding: "20px 28px",
    borderBottom: "1px solid #334155",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalCloseBtn: {
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    color: "#94a3b8",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  closeCircleBtn: {
    position: "absolute",
    top: "-20px",
    right: "-20px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)",
  },
};
