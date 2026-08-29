import React, { useRef } from "react";
import { Search, X } from "lucide-react";
import { useTheme } from "../themes/ThemeContext";

export default function PremiumSearchBar({
  value = "",
  onChange,
  onClear,
  placeholder = "Search...",
  minWidth = "260px",
  maxWidth = "420px",
  style = {},
  className = "",
  autoFocus = false,
  ...rest
}) {
  const { isDark } = useTheme();
  const inputRef = useRef(null);

  const handleClear = (e) => {
    if (e) e.stopPropagation();
    if (onChange) {
      onChange({ target: { value: "" } });
    }
    if (onClear) {
      onClear();
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      handleClear(e);
      inputRef.current?.blur();
    }
  };

  return (
    <div
      className={`search-box-premium ${className}`}
      onClick={() => inputRef.current?.focus()}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        height: "40px",
        minWidth,
        maxWidth,
        flex: "1 1 260px",
        backgroundColor: isDark ? "#131c2e" : "#ffffff",
        border: isDark
          ? "2px solid rgba(45, 212, 191, 0.55)"
          : "2px solid #00bfa5",
        borderRadius: "9999px",
        padding: "0 14px",
        boxSizing: "border-box",
        boxShadow: isDark
          ? "0 2px 8px rgba(0, 0, 0, 0.3)"
          : "0 2px 8px rgba(0, 191, 165, 0.08)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        cursor: "text",
        ...style,
      }}
    >
      {/* Magnifying Glass Icon */}
      <Search
        size={17}
        strokeWidth={2.2}
        color={isDark ? "#5eead4" : "#00bfa5"}
        style={{ flexShrink: 0 }}
      />

      {/* Input Field */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          backgroundColor: "transparent",
          fontSize: "13.5px",
          fontWeight: "500",
          color: isDark ? "#f8fafc" : "#0f172a",
          padding: 0,
          boxShadow: "none",
        }}
        {...rest}
      />

      {/* Clear Button (✕) */}
      {value && (
        <button
          type="button"
          onClick={handleClear}
          title="Clear search (Esc)"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            color: isDark ? "#2dd4bf" : "#00bfa5",
            flexShrink: 0,
            transition: "opacity 0.15s ease",
          }}
        >
          <X size={15} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}
