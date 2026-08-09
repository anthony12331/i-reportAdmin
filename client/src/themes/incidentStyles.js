// src/incidentTheme.js
import { Flame, Ambulance, ShieldAlert, AlertTriangle } from "lucide-react";

export const getIncidentTheme = (type) => {
  const normalizedType = (type || "").toLowerCase();

  if (normalizedType.includes("fire")) {
    return {
      label: "FIRE DISPATCH",
      border: "rgba(249, 115, 22, 0.5)",
      headerBg: "rgba(249, 115, 22, 0.1)",
      accentText: "#fdba74",
      icon: Flame,
    };
  }

  if (normalizedType.includes("medical") || normalizedType.includes("health")) {
    return {
      label: "MEDICAL RESPONSE",
      border: "rgba(239, 68, 68, 0.5)",
      headerBg: "rgba(239, 68, 68, 0.1)",
      accentText: "#fca5a5",
      icon: Ambulance,
    };
  }

  if (normalizedType.includes("crime") || normalizedType.includes("police") || normalizedType.includes("security")) {
    return {
      label: "LAW ENFORCEMENT",
      border: "rgba(59, 130, 246, 0.5)",
      headerBg: "rgba(59, 130, 246, 0.1)",
      accentText: "#93c5fd",
      icon: ShieldAlert,
    };
  }

  // Fallback Theme (Accidents, Weather, General)
  return {
    label: "EMERGENCY UNIT",
    border: "rgba(168, 85, 247, 0.5)",
    headerBg: "rgba(168, 85, 247, 0.1)",
    accentText: "#d8b4fe",
    icon: AlertTriangle,
  };
};
