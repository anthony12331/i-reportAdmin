import React from "react";
import {
  Flame,
  Shield,
  Ambulance,
  Activity,
  Mountain,
  Car,
  Radio,
  ShieldAlert,
  AlertOctagon,
  ShieldCheck,
} from "lucide-react";

import assistantSvg from "../assets/icons/assistant.svg";

/**
 * ============================================================================
 * ICON CONFIGURATION REGISTRY
 * ============================================================================
 * You can easily customize any icon here!
 *
 * Supported values for any icon:
 * 1. Lucide Component: Flame, Shield, Ambulance, Mountain, etc.
 * 2. Imported SVG file:
 *      import customFireSvg from "../assets/icons/fire.svg";
 *      fire: customFireSvg
 * 3. Public static SVG URL path:
 *      fire: "/icons/fire.svg"
 * 4. Raw SVG string:
 *      fire: '<svg viewBox="0 0 24 24">...</svg>'
 * 5. React Component:
 *      fire: (props) => <svg {...props}>...</svg>
 */
export const CUSTOM_ICONS = {
  // Department Icons
  bfp: Flame, // BFP Fire Department
  pnp: Shield, // PNP Police Department
  ambulance: Ambulance, // EMS / Medical
  mdrrmo: Activity, // MDRRMO Rescue

  // Incident Category Icons
  fire: Flame, // Fire Emergency (Red)
  accident: Car, // Traffic & Vehicular Accident (Yellow)
  police: Shield, // Police & Security (Blue)
  landslide: Mountain, // Landslide Hazard (Brown)
  medical: Ambulance, // Medical Response (Orange)
  flood: ShieldAlert, // Flood & Natural Disaster (Cyan)
  sos: Radio, // Critical SOS Beacon (Crimson)
  assistant: assistantSvg, // Assistant / Backup reinforcement icon
  backup: assistantSvg, // Backup Siren Beacon icon
  general: AlertOctagon, // General / Other
};

/**
 * Color Specifications
 * Fire: Red (#ef4444)
 * Accident: Yellow (#eab308 / #ca8a04)
 * Police: Blue (#2563eb / #1d4ed8)
 * Landslide: Brown (#92400e / #78350f)
 */
export const CATEGORY_COLORS = {
  fire: {
    dark: { bg: "rgba(239, 68, 68, 0.18)", color: "#f87171", border: "rgba(239, 68, 68, 0.35)", accent: "#ef4444" },
    light: { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", accent: "#ef4444" },
  },
  accident: {
    dark: { bg: "rgba(234, 179, 8, 0.18)", color: "#facc15", border: "rgba(234, 179, 8, 0.35)", accent: "#eab308" },
    light: { bg: "#fefce8", color: "#854d0e", border: "#fef08a", accent: "#ca8a04" },
  },
  police: {
    dark: { bg: "rgba(37, 99, 235, 0.18)", color: "#60a5fa", border: "rgba(37, 99, 235, 0.35)", accent: "#2563eb" },
    light: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", accent: "#2563eb" },
  },
  landslide: {
    dark: { bg: "rgba(146, 64, 14, 0.25)", color: "#fbbf24", border: "rgba(146, 64, 14, 0.45)", accent: "#92400e" },
    light: { bg: "#fef3c7", color: "#78350f", border: "#fed7aa", accent: "#92400e" },
  },
  medical: {
    dark: { bg: "rgba(249, 115, 22, 0.18)", color: "#fb923c", border: "rgba(249, 115, 22, 0.35)", accent: "#f97316" },
    light: { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", accent: "#f97316" },
  },
  flood: {
    dark: { bg: "rgba(2, 132, 199, 0.18)", color: "#38bdf8", border: "rgba(2, 132, 199, 0.35)", accent: "#0284c7" },
    light: { bg: "#f0f9ff", color: "#0369a1", border: "#bae6fd", accent: "#0284c7" },
  },
  sos: {
    dark: { bg: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "rgba(239, 68, 68, 0.4)", accent: "#ef4444" },
    light: { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", accent: "#ef4444" },
  },
  mdrrmo: {
    dark: { bg: "rgba(34, 197, 94, 0.18)", color: "#4ade80", border: "rgba(34, 197, 94, 0.35)", accent: "#22c55e" },
    light: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", accent: "#16a34a" },
  },
};

/**
 * Returns complete badge and icon metadata for any incident category
 */
export function getCategoryBadgeMeta(type = "", isSos = false, isDark = false) {
  const theme = isDark ? "dark" : "light";

  if (isSos) {
    return {
      icon: CUSTOM_ICONS.sos,
      label: "CRITICAL SOS DISTRESS",
      key: "sos",
      ...CATEGORY_COLORS.sos[theme],
    };
  }

  const t = (type || "").toLowerCase();

  if (t.includes("fire")) {
    return {
      icon: CUSTOM_ICONS.fire,
      label: "FIRE EMERGENCY",
      key: "fire",
      ...CATEGORY_COLORS.fire[theme],
    };
  }

  if (t.includes("traffic") || t.includes("accident") || t.includes("car") || t.includes("vehicular")) {
    return {
      icon: CUSTOM_ICONS.accident,
      label: "TRAFFIC & ROAD ACCIDENT",
      key: "accident",
      ...CATEGORY_COLORS.accident[theme],
    };
  }

  if (t.includes("police") || t.includes("crime") || t.includes("security") || t.includes("pnp")) {
    return {
      icon: CUSTOM_ICONS.police,
      label: "POLICE & SECURITY INCIDENT",
      key: "police",
      ...CATEGORY_COLORS.police[theme],
    };
  }

  if (t.includes("landslide")) {
    return {
      icon: CUSTOM_ICONS.landslide,
      label: "LANDSLIDE HAZARD",
      key: "landslide",
      ...CATEGORY_COLORS.landslide[theme],
    };
  }

  if (t.includes("medical") || t.includes("health") || t.includes("ambulance")) {
    return {
      icon: CUSTOM_ICONS.medical,
      label: "MEDICAL RESPONSE",
      key: "medical",
      ...CATEGORY_COLORS.medical[theme],
    };
  }

  if (t.includes("flood") || t.includes("rescue")) {
    return {
      icon: CUSTOM_ICONS.flood,
      label: "NATURAL DISASTER / RESCUE",
      key: "flood",
      ...CATEGORY_COLORS.flood[theme],
    };
  }

  return {
    icon: CUSTOM_ICONS.general,
    label: type ? type.toUpperCase() : "GENERAL INCIDENT",
    key: "general",
    ...CATEGORY_COLORS.police[theme],
  };
}

/**
 * Returns complete badge and icon metadata for any department
 */
export function getDepartmentBadgeMeta(dept = "", isDark = false) {
  const theme = isDark ? "dark" : "light";
  const d = (dept || "").toLowerCase();

  if (d.includes("fire")) {
    return {
      label: "BFP Fire",
      shortLabel: "BFP",
      icon: CUSTOM_ICONS.bfp,
      key: "bfp",
      ...CATEGORY_COLORS.fire[theme],
    };
  }

  if (d.includes("police")) {
    return {
      label: "PNP Police",
      shortLabel: "PNP",
      icon: CUSTOM_ICONS.pnp,
      key: "pnp",
      ...CATEGORY_COLORS.police[theme],
    };
  }

  if (d.includes("ambulance") || d.includes("ems") || d.includes("medical")) {
    return {
      label: "Ambulance",
      shortLabel: "EMS",
      icon: CUSTOM_ICONS.ambulance,
      key: "ambulance",
      ...CATEGORY_COLORS.medical[theme],
    };
  }

  return {
    label: "MDRRMO Rescue",
    shortLabel: "MDRRMO",
    icon: CUSTOM_ICONS.mdrrmo,
    key: "mdrrmo",
    ...CATEGORY_COLORS.mdrrmo[theme],
  };
}
