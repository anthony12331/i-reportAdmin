// src/incidentTheme.js
import { Flame, Ambulance, ShieldAlert, AlertTriangle } from "lucide-react";

export const getIncidentTheme = (type) => {
  const normalizedType = (type || "").toLowerCase();

  if (normalizedType.includes("fire")) {
    return {
      label: "FIRE DISPATCH",
      border: "#f97316",
      headerBg: "rgba(249, 115, 22, 0.15)",
      accentText: "#fb923c",
      icon: Flame,
    };
  }

  if (normalizedType.includes("medical") || normalizedType.includes("health")) {
    return {
      label: "MEDICAL RESPONSE",
      border: "#ef4444",
      headerBg: "rgba(239, 68, 68, 0.15)",
      accentText: "#f87171",
      icon: Ambulance,
    };
  }

  if (normalizedType.includes("crime") || normalizedType.includes("police") || normalizedType.includes("security")) {
    return {
      label: "LAW ENFORCEMENT",
      border: "#3b82f6",
      headerBg: "rgba(59, 130, 246, 0.15)",
      accentText: "#60a5fa",
      icon: ShieldAlert,
    };
  }

  // Fallback Theme (Accidents, Weather, General)
  return {
    label: "EMERGENCY UNIT",
    border: "#a855f7",
    headerBg: "rgba(168, 85, 247, 0.15)",
    accentText: "#c084fc",
    icon: AlertTriangle,
  };
};
