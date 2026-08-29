import React from "react";
import { useTheme } from "../themes/ThemeContext";

const THEME_VARIANTS = {
  red: {
    accent: "#ef4444",
    border: "#fecaca",
    bgLight: "linear-gradient(180deg, #ffffff 0%, #fef2f2 100%)",
    iconBgLight: "#fee2e2",
    glow: "rgba(239, 68, 68, 0.18)",
    textDark: "#f87171",
    subText: "#b91c1c",
  },
  amber: {
    accent: "#f59e0b",
    border: "#fde68a",
    bgLight: "linear-gradient(180deg, #ffffff 0%, #fffbeb 100%)",
    iconBgLight: "#fef3c7",
    glow: "rgba(245, 158, 11, 0.18)",
    textDark: "#fbbf24",
    subText: "#b45309",
  },
  sky: {
    accent: "#0ea5e9",
    border: "#bae6fd",
    bgLight: "linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%)",
    iconBgLight: "#e0f2fe",
    glow: "rgba(14, 165, 233, 0.18)",
    textDark: "#38bdf8",
    subText: "#0369a1",
  },
  emerald: {
    accent: "#10b981",
    border: "#a7f3d0",
    bgLight: "linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)",
    iconBgLight: "#d1fae5",
    glow: "rgba(16, 185, 129, 0.18)",
    textDark: "#34d399",
    subText: "#15803d",
  },
  purple: {
    accent: "#8b5cf6",
    border: "#ddd6fe",
    bgLight: "linear-gradient(180deg, #ffffff 0%, #f5f3ff 100%)",
    iconBgLight: "#ede9fe",
    glow: "rgba(139, 92, 246, 0.18)",
    textDark: "#a78bfa",
    subText: "#6d28d9",
  },
  slate: {
    accent: "#64748b",
    border: "#e2e8f0",
    bgLight: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    iconBgLight: "#f1f5f9",
    glow: "rgba(100, 116, 139, 0.12)",
    textDark: "#94a3b8",
    subText: "#475569",
  },
};

export default function MetricCardHolder({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "emerald",
  urgent = false,
  onClick,
  trend,
  className = "",
  style = {},
}) {
  const { isDark } = useTheme();
  const activeVariant = urgent ? THEME_VARIANTS.red : THEME_VARIANTS[variant] || THEME_VARIANTS.emerald;

  return (
    <div
      onClick={onClick}
      className={`metric-card-holder ${urgent ? "urgent" : ""} ${className}`}
      style={{
        position: "relative",
        padding: "12px 14px",
        borderRadius: "12px",
        backgroundColor: isDark ? "#131c2e" : "#ffffff",
        background: isDark
          ? `linear-gradient(180deg, #162238 0%, #111a2c 100%)`
          : activeVariant.bgLight,
        border: isDark
          ? `1px solid rgba(255, 255, 255, 0.08)`
          : `1px solid ${activeVariant.border}`,
        borderLeft: `4px solid ${activeVariant.accent}`,
        boxShadow: isDark
          ? `0 6px 18px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04)`
          : `0 6px 18px -4px ${activeVariant.glow}, 0 1px 3px rgba(0, 0, 0, 0.02)`,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        userSelect: "none",
        minWidth: 0,
        ...style,
      }}
    >
      {/* Subtle background glow circle */}
      <div
        style={{
          position: "absolute",
          top: "-15px",
          right: "-15px",
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          background: activeVariant.glow,
          filter: "blur(20px)",
          pointerEvents: "none",
          opacity: isDark ? 0.35 : 0.5,
        }}
      />

      {/* Top Header: Title & Icon Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          marginBottom: "6px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span
          title={title}
          style={{
            fontSize: "10px",
            fontWeight: "800",
            color: isDark ? activeVariant.textDark : activeVariant.subText,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
            minWidth: 0,
          }}
        >
          {title}
        </span>

        {/* Circular Glass Icon Badge */}
        <div
          style={{
            width: "26px",
            height: "26px",
            borderRadius: "7px",
            backgroundColor: isDark ? `${activeVariant.accent}20` : activeVariant.iconBgLight,
            border: isDark ? `1px solid ${activeVariant.accent}40` : `1px solid ${activeVariant.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isDark ? activeVariant.textDark : activeVariant.accent,
            flexShrink: 0,
          }}
        >
          {Icon}
        </div>
      </div>

      {/* Value & Subtitle / Trend Badge */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "6px", position: "relative", zIndex: 1 }}>
        <h2
          style={{
            fontSize: "26px",
            fontWeight: "900",
            color: isDark ? "#f8fafc" : (urgent ? "#dc2626" : "#0f172a"),
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
          }}
        >
          {value}
        </h2>

        {subtitle && (
          <span
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: isDark ? "#94a3b8" : activeVariant.subText,
              textTransform: "lowercase",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </span>
        )}

        {trend && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: "9.5px",
              fontWeight: "800",
              padding: "1px 5px",
              borderRadius: "4px",
              backgroundColor: isDark ? "rgba(34, 197, 94, 0.2)" : "#f0fdf4",
              color: isDark ? "#4ade80" : "#15803d",
              border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #bbf7d0",
            }}
          >
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
