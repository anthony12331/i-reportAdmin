import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export default function CustomDropdown({
  label,
  value,
  options = [],
  onChange,
  placeholder = "Select option",
  minWidth = "140px",
  style = {},
  triggerStyle = {},
  menuStyle = {},
  size = "md", // "sm" | "md"
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : (label || placeholder);
  const isActive = Boolean(value && value !== "" && value !== "ALL" && value !== "all");

  const isSmall = size === "sm";

  return (
    <div
      ref={dropdownRef}
      style={{
        position: "relative",
        display: "inline-block",
        minWidth: minWidth,
        ...style,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          padding: isSmall ? "5px 10px" : "8px 12px",
          borderRadius: "8px",
          border: open || isActive ? "1.5px solid #15803d" : "1px solid #dfeae3",
          backgroundColor: isActive ? "#f0fdf4" : "#ffffff",
          color: isActive ? "#15803d" : "#334155",
          cursor: "pointer",
          fontSize: isSmall ? "11px" : "12.5px",
          fontWeight: "800",
          textAlign: "left",
          outline: "none",
          boxShadow: open
            ? "0 0 0 3px rgba(21, 128, 61, 0.14)"
            : "0 2px 5px rgba(24, 95, 53, 0.05)",
          transition: "all 0.15s ease",
          boxSizing: "border-box",
          ...triggerStyle,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayLabel}
        </span>
        <ChevronDown
          size={isSmall ? 12 : 14}
          color={open || isActive ? "#15803d" : "#64748b"}
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 180ms ease",
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 5px)",
            left: 0,
            right: 0,
            minWidth: "100%",
            zIndex: 9999,
            padding: "5px",
            border: "1px solid #cfe3d5",
            borderRadius: "9px",
            backgroundColor: "#ffffff",
            boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12), 0 4px 10px rgba(24, 95, 53, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            maxHeight: "220px",
            overflowY: "auto",
            boxSizing: "border-box",
            ...menuStyle,
          }}
        >
          {options.map((option) => {
            const isOptionSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: isSmall ? "6px 9px" : "8px 10px",
                  border: "none",
                  borderRadius: "6px",
                  backgroundColor: isOptionSelected ? "#e7f5eb" : "transparent",
                  color: isOptionSelected ? "#15803d" : "#334155",
                  cursor: "pointer",
                  fontSize: isSmall ? "11px" : "12px",
                  fontWeight: isOptionSelected ? "800" : "600",
                  textAlign: "left",
                  transition: "background-color 0.12s ease",
                  boxSizing: "border-box",
                }}
                onMouseEnter={(e) => {
                  if (!isOptionSelected) {
                    e.currentTarget.style.backgroundColor = "#f8fafc";
                    e.currentTarget.style.color = "#0f172a";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isOptionSelected) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#334155";
                  }
                }}
              >
                <span>{option.label}</span>
                {isOptionSelected && (
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: "#15803d",
                      display: "inline-block",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
