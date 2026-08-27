// src/themes/incidentStyles.js
import { Flame, Ambulance, ShieldAlert, AlertTriangle } from "lucide-react";

export const getIncidentTheme = (type) => {
  const normalizedType = (type || "").toLowerCase();

  if (normalizedType.includes("fire")) {
    return {
      label: "FIRE DISPATCH",
      border: "#fed7aa",
      headerBg: "#fff7ed",
      accentText: "#ea580c",
      icon: Flame,
    };
  }

  if (normalizedType.includes("medical") || normalizedType.includes("health")) {
    return {
      label: "MEDICAL RESPONSE",
      border: "#fecaca",
      headerBg: "#fef2f2",
      accentText: "#dc2626",
      icon: Ambulance,
    };
  }

  if (normalizedType.includes("crime") || normalizedType.includes("police") || normalizedType.includes("security")) {
    return {
      label: "LAW ENFORCEMENT",
      border: "#bfdbfe",
      headerBg: "#eff6ff",
      accentText: "#2563eb",
      icon: ShieldAlert,
    };
  }

  // Fallback Theme (Accidents, Weather, General)
  return {
    label: "EMERGENCY UNIT",
    border: "#fde68a",
    headerBg: "#fffbeb",
    accentText: "#d97706",
    icon: AlertTriangle,
  };
};
