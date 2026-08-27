// src/themes/ongoingStyles.js
import React from "react";
import { Flame, Ambulance, Car, AlertOctagon, ShieldAlert } from "lucide-react";

export function getIncidentTheme(type = "") {
  const category = type.toLowerCase();

  if (category.includes("fire")) {
    return {
      border: "#fed7aa",
      headerBg: "#fff7ed",
      accentText: "#ea580c",
      label: "FIRE EMERGENCY",
      icon: Flame,
    };
  }

  if (category.includes("medical") || category.includes("health")) {
    return {
      border: "#fecaca",
      headerBg: "#fef2f2",
      accentText: "#dc2626",
      label: "MEDICAL RESPONSE",
      icon: Ambulance,
    };
  }

  if (category.includes("traffic") || category.includes("accident")) {
    return {
      border: "#bfdbfe",
      headerBg: "#eff6ff",
      accentText: "#2563eb",
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
      border: "#e9d5ff",
      headerBg: "#faf5ff",
      accentText: "#9333ea",
      label: "POLICE / SECURITY",
      icon: ShieldAlert,
    };
  }

  return {
    border: "#fde68a",
    headerBg: "#fffbeb",
    accentText: "#d97706",
    label: "DISPATCH UNIT",
    icon: AlertOctagon,
  };
}

const glassPanel = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
  borderRadius: "8px",
};

export const ongoingStyles = {
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    paddingBottom: "14px",
    borderBottom: "1px solid #e2e8f0",
  },
  headerTitleWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  pulseDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#15803d",
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
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "20px",
    alignItems: "center",
    ...glassPanel,
    padding: "10px 14px",
    borderRadius: "8px",
  },
  filterLabel: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginRight: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  filterButton: (isActive) => ({
    background: isActive ? "#15803d" : "#ffffff",
    color: isActive ? "#ffffff" : "#475569",
    border: isActive ? "1px solid #15803d" : "1px solid #e2e8f0",
    padding: "6px 12px",
    borderRadius: "6px",
    fontWeight: "500",
    fontSize: "12px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  }),
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "60px 20px",
    ...glassPanel,
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: "500",
    fontSize: "13px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
    gap: "16px",
  },
  card: (borderColor) => ({
    ...glassPanel,
    borderRadius: "8px",
    border: `1px solid ${borderColor || "#e2e8f0"}`,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    transition: "border-color 0.15s ease",
  }),
  cardHeader: (headerBg) => ({
    backgroundColor: headerBg || "#f8fafc",
    padding: "12px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #e2e8f0",
  }),
  typeLabel: (color) => ({
    fontWeight: "600",
    fontSize: "13px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color,
    letterSpacing: "0.02em",
  }),
  timeBadge: {
    fontSize: "11px",
    fontWeight: "600",
    backgroundColor: "#ffffff",
    color: "#15803d",
    padding: "3px 8px",
    borderRadius: "4px",
    border: "1px solid #dcfce7",
  },
  cardBody: {
    padding: "16px",
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  reporterBox: {
    backgroundColor: "#f8fafc",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #e2e8f0",
    marginBottom: "14px",
  },
  reporterHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "8px",
  },
  avatarIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    backgroundColor: "#f0fdf4",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#15803d",
    border: "1px solid #dcfce7",
  },
  reporterName: {
    display: "block",
    fontWeight: "600",
    fontSize: "14px",
    color: "#0f172a",
  },
  verifiedBadge: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    color: "#15803d",
    fontSize: "11px",
    fontWeight: "600",
  },
  phoneText: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#64748b",
    fontWeight: "500",
  },
  responderBanner: (borderColor) => ({
    backgroundColor: "#f8fafc",
    padding: "10px 12px",
    borderRadius: "6px",
    marginBottom: "14px",
    border: `1px solid ${borderColor || "#e2e8f0"}`,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  }),
  responderText: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: "13px",
  },
  locationText: {
    margin: "0 0 14px 0",
    fontSize: "13px",
    fontWeight: "500",
    color: "#0f172a",
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    lineHeight: "1.4",
  },
  mapPreviewWrapper: {
    width: "100%",
    height: "160px",
    borderRadius: "6px",
    overflow: "hidden",
    border: "1px solid #e2e8f0",
    position: "relative",
    cursor: "zoom-in",
  },
  mapBadge: {
    position: "absolute",
    bottom: "8px",
    right: "8px",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    color: "#15803d",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid #e2e8f0",
  },
  mediaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  mediaTile: (hasUrl) => ({
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    overflow: "hidden",
    height: "120px",
    position: "relative",
    cursor: hasUrl ? "zoom-in" : "default",
    backgroundColor: "#f8fafc",
  }),
  noMediaBox: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontWeight: "500",
    fontSize: "11px",
  },
  overlayModal: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    backdropFilter: "blur(4px)",
    zIndex: 9999,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
    cursor: "zoom-out",
  },
  modalMapCard: {
    width: "90vw",
    maxWidth: "1100px",
    ...glassPanel,
    cursor: "default",
  },
  modalMapHeader: {
    padding: "16px 20px",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalCloseBtn: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    width: "32px",
    height: "32px",
    borderRadius: "6px",
    color: "#475569",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.15s ease",
  },
  closeCircleBtn: {
    position: "absolute",
    top: "-14px",
    right: "-14px",
    background: "#0f172a",
    color: "white",
    border: "none",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
  },
};
