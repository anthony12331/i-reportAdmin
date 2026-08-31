import React from "react";
import CustomIcon from "./CustomIcon";
import { getDepartmentBadgeMeta } from "../utils/categoryIcons";

/**
 * Reusable DepartmentBadge supporting Lucide icons, SVGs, and Dark Mode
 * Usage:
 * <DepartmentBadge department="BFP Fire" isDark={isDark} />
 * <DepartmentBadge department="police" size="sm" isDark={isDark} />
 */
export default function DepartmentBadge({
  department = "",
  isDark = false,
  size = "md",
  showFullLabel = false,
  style = {},
  className = "",
}) {
  const meta = getDepartmentBadgeMeta(department, isDark);
  const iconSize = size === "sm" ? 11 : size === "lg" ? 16 : 12;
  const fontSize = size === "sm" ? "10.5px" : size === "lg" ? "13px" : "11.5px";
  const padding = size === "sm" ? "2px 7px" : size === "lg" ? "5px 12px" : "3px 9px";

  return (
    <span
      className={`department-badge ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: padding,
        borderRadius: "6px",
        fontSize: fontSize,
        fontWeight: "800",
        backgroundColor: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.border}`,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
        flexShrink: 0,
        ...style,
      }}
    >
      <span>{showFullLabel ? meta.label : meta.shortLabel}</span>
    </span>
  );
}
