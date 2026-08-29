import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCcw,
  X,
} from "lucide-react";
import { useTheme } from "../themes/ThemeContext";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Helper to format Date to YYYY-MM-DD
const toISODate = (d) => {
  if (!d) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper to format for human display (e.g., Aug 10, 2026)
const formatHumanDate = (dateStr) => {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function PremiumDateRangePicker({
  startDate = "",
  endDate = "",
  onChange,
  onClear,
  placeholder = "Filter by Date",
  align = "auto",
}) {
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [calculatedAlign, setCalculatedAlign] = useState(align === "auto" ? "right" : align);
  const containerRef = useRef(null);

  // Temporary selected dates while popover is open
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);
  const [hoverDate, setHoverDate] = useState(null);

  // Auto-detect left vs right alignment relative to viewport
  useEffect(() => {
    if (isOpen && containerRef.current) {
      if (align === "auto") {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.left < 580) {
          setCalculatedAlign("left");
        } else {
          setCalculatedAlign("right");
        }
      } else {
        setCalculatedAlign(align);
      }
    }
  }, [isOpen, align]);

  // Calendar navigation month/year
  const [currentYear, setCurrentYear] = useState(() => {
    if (startDate) return parseInt(startDate.split("-")[0], 10);
    return new Date().getFullYear();
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (startDate) return parseInt(startDate.split("-")[1], 10) - 1;
    return new Date().getMonth();
  });

  // Sync temp dates when props change
  useEffect(() => {
    setTempStart(startDate);
    setTempEnd(endDate);
  }, [startDate, endDate]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Calculate days in current month view
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    const days = [];
    const startingDayOfWeek = firstDayOfMonth.getDay();

    // Previous month padding days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1, prevMonthLastDay - i);
      days.push({
        dateStr: toISODate(d),
        dayNum: d.getDate(),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(currentYear, currentMonth, i);
      days.push({
        dateStr: toISODate(d),
        dayNum: i,
        isCurrentMonth: true,
      });
    }

    // Next month padding days to fill 42 cells (6 rows)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(currentYear, currentMonth + 1, i);
      days.push({
        dateStr: toISODate(d),
        dayNum: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Calculate day difference for summary
  const dayCount = useMemo(() => {
    if (!tempStart) return 0;
    if (!tempEnd) return 1;
    const s = new Date(tempStart);
    const e = new Date(tempEnd);
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  }, [tempStart, tempEnd]);

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Day selection logic
  const handleDayClick = (dateStr) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dateStr);
      setTempEnd("");
    } else if (tempStart && !tempEnd) {
      if (dateStr < tempStart) {
        setTempEnd(tempStart);
        setTempStart(dateStr);
      } else {
        setTempEnd(dateStr);
      }
    }
  };

  // Quick Preset Handlers
  const handlePreset = (type) => {
    const today = new Date();
    const todayStr = toISODate(today);

    if (type === "today") {
      setTempStart(todayStr);
      setTempEnd(todayStr);
      setCurrentYear(today.getFullYear());
      setCurrentMonth(today.getMonth());
    } else if (type === "last7") {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 6);
      setTempStart(toISODate(past7));
      setTempEnd(todayStr);
      setCurrentYear(today.getFullYear());
      setCurrentMonth(today.getMonth());
    } else if (type === "thisMonth") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      setTempStart(toISODate(first));
      setTempEnd(todayStr);
      setCurrentYear(today.getFullYear());
      setCurrentMonth(today.getMonth());
    } else if (type === "clear") {
      setTempStart("");
      setTempEnd("");
      if (onClear) onClear();
      if (onChange) onChange({ startDate: "", endDate: "", label: "all" });
      setIsOpen(false);
    }
  };

  const handleApply = () => {
    if (onChange) {
      onChange({
        startDate: tempStart,
        endDate: tempEnd || tempStart,
        label: "custom",
      });
    }
    setIsOpen(false);
  };

  const hasActiveRange = Boolean(startDate);
  const activeLabel = useMemo(() => {
    if (!startDate) return placeholder;
    if (startDate === endDate || !endDate) {
      return formatHumanDate(startDate);
    }
    return `${formatHumanDate(startDate)} – ${formatHumanDate(endDate)}`;
  }, [startDate, endDate, placeholder]);

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block", zIndex: isOpen ? 99999 : 10 }}>
      {/* TRIGGER BUTTON */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 14px",
          borderRadius: "8px",
          fontSize: "12.5px",
          fontWeight: "600",
          backgroundColor: hasActiveRange
            ? (isDark ? "rgba(34, 197, 94, 0.15)" : "#f0fdf4")
            : (isDark ? "#172338" : "#ffffff"),
          border: hasActiveRange
            ? (isDark ? "1.5px solid rgba(74, 222, 128, 0.4)" : "1.5px solid #86efac")
            : (isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1"),
          color: hasActiveRange
            ? (isDark ? "#4ade80" : "#15803d")
            : (isDark ? "#f8fafc" : "#334155"),
          cursor: "pointer",
          boxShadow: isOpen
            ? "0 0 0 3px rgba(21, 128, 61, 0.2)"
            : "0 1px 3px rgba(0,0,0,0.04)",
          transition: "all 0.18s ease",
          whiteSpace: "nowrap",
        }}
      >
        <CalendarIcon size={14} color={hasActiveRange ? (isDark ? "#4ade80" : "#15803d") : (isDark ? "#94a3b8" : "#64748b")} />
        <span>{activeLabel}</span>

        {hasActiveRange ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              handlePreset("clear");
            }}
            title="Clear date filter"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "#dcfce7",
              color: isDark ? "#f8fafc" : "#15803d",
              marginLeft: "4px",
            }}
          >
            <X size={10} />
          </span>
        ) : (
          <span style={{ fontSize: "9px", opacity: 0.6, marginLeft: "4px" }}>▼</span>
        )}
      </button>

      {/* POPOVER MODAL */}
      {isOpen && (
        <div
          className="premium-date-popover"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: calculatedAlign === "left" ? 0 : "auto",
            right: calculatedAlign === "right" ? 0 : "auto",
            transformOrigin: calculatedAlign === "left" ? "top left" : "top right",
            width: "570px",
            maxWidth: "92vw",
            backgroundColor: isDark ? "#131c2e" : "#ffffff",
            borderRadius: "18px",
            boxShadow: isDark
              ? "0 24px 50px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.1)"
              : "0 24px 50px -10px rgba(0, 0, 0, 0.15), 0 0 0 1px #e2e8f0",
            padding: "20px 22px",
            zIndex: 99999,
            userSelect: "none",
          }}
        >
          {/* HEADER PRESETS & APPLY ACTION */}
          <div
            className="premium-date-header"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              paddingBottom: "16px",
              borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handlePreset("today")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0",
                  backgroundColor: isDark ? "#172338" : "#ffffff",
                  color: isDark ? "#cbd5e1" : "#334155",
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handlePreset("last7")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0",
                  backgroundColor: isDark ? "#172338" : "#ffffff",
                  color: isDark ? "#cbd5e1" : "#334155",
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => handlePreset("thisMonth")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0",
                  backgroundColor: isDark ? "#172338" : "#ffffff",
                  color: isDark ? "#cbd5e1" : "#334155",
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handlePreset("clear")}
                style={{
                  padding: "6px 10px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  border: "none",
                  backgroundColor: "transparent",
                  color: isDark ? "#94a3b8" : "#64748b",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <RotateCcw size={12} /> Clear
              </button>
            </div>

            <button
              type="button"
              onClick={handleApply}
              disabled={!tempStart}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 16px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: "800",
                border: "none",
                background: tempStart
                  ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
                  : (isDark ? "#1e2d48" : "#e2e8f0"),
                color: tempStart ? "#ffffff" : (isDark ? "#64748b" : "#94a3b8"),
                cursor: tempStart ? "pointer" : "not-allowed",
                boxShadow: tempStart ? "0 4px 14px rgba(21, 128, 61, 0.35)" : "none",
                transition: "all 0.18s ease",
              }}
            >
              <Check size={14} /> Apply Range
            </button>
          </div>

          {/* DATE RANGE BODY: 2-COLUMN (SUMMARY ASIDE + CALENDAR GRID) */}
          <div
            className="premium-date-body"
            style={{
              display: "grid",
              gridTemplateColumns: "175px 1fr",
              gap: "20px",
              marginTop: "18px",
              alignItems: "stretch",
            }}
          >
            {/* LEFT ASIDE: SUMMARY CARD */}
            <aside
              className="premium-range-summary"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "20px 14px",
                borderRadius: "14px",
                backgroundColor: isDark ? "#172338" : "#f8fafc",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#dcfce7",
                  color: isDark ? "#4ade80" : "#15803d",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "12px",
                  boxShadow: "0 2px 8px rgba(21, 128, 61, 0.12)",
                }}
              >
                <CalendarIcon size={22} />
              </div>

              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: "800",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: isDark ? "#94a3b8" : "#64748b",
                  marginBottom: "6px",
                }}
              >
                Selected Range
              </span>

              <strong
                style={{
                  fontSize: "13.5px",
                  color: tempStart ? (isDark ? "#f8fafc" : "#0f172a") : (isDark ? "#64748b" : "#94a3b8"),
                  fontWeight: "800",
                }}
              >
                {tempStart ? formatHumanDate(tempStart) : "Select start"}
              </strong>

              <span style={{ fontSize: "12px", color: isDark ? "#64748b" : "#94a3b8", margin: "4px 0" }}>
                ↓
              </span>

              <strong
                style={{
                  fontSize: "13.5px",
                  color: tempEnd ? (isDark ? "#f8fafc" : "#0f172a") : (isDark ? "#64748b" : "#94a3b8"),
                  fontWeight: "800",
                }}
              >
                {tempEnd ? formatHumanDate(tempEnd) : (tempStart ? "Select end" : "—")}
              </strong>

              {tempStart && (
                <span
                  style={{
                    marginTop: "14px",
                    display: "inline-block",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    fontSize: "11.5px",
                    fontWeight: "800",
                    backgroundColor: isDark ? "rgba(34, 197, 94, 0.2)" : "#dcfce7",
                    color: isDark ? "#4ade80" : "#15803d",
                    border: isDark ? "1px solid rgba(74, 222, 128, 0.3)" : "1px solid #bbf7d0",
                  }}
                >
                  {dayCount} {dayCount === 1 ? "Day" : "Days"}
                </span>
              )}
            </aside>

            {/* RIGHT CALENDAR GRID */}
            <div className="premium-date-calendar">
              {/* MONTH / YEAR BAR WITH ARROWS */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "14px",
                  padding: "0 4px",
                }}
              >
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "30px",
                    height: "30px",
                    borderRadius: "8px",
                    border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0",
                    backgroundColor: isDark ? "#172338" : "#ffffff",
                    color: isDark ? "#f8fafc" : "#334155",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  <ChevronLeft size={16} />
                </button>

                <div style={{ fontSize: "15px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", letterSpacing: "-0.01em" }}>
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "30px",
                    height: "30px",
                    borderRadius: "8px",
                    border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0",
                    backgroundColor: isDark ? "#172338" : "#ffffff",
                    color: isDark ? "#f8fafc" : "#334155",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* WEEKDAY LABELS */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: "2px",
                  textAlign: "center",
                  fontSize: "11.5px",
                  fontWeight: "700",
                  color: isDark ? "#94a3b8" : "#64748b",
                  marginBottom: "8px",
                }}
              >
                {WEEKDAY_NAMES.map((w) => (
                  <div key={w} style={{ padding: "4px 0" }}>
                    {w}
                  </div>
                ))}
              </div>

              {/* 42-DAY CELLS GRID */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: "2px",
                }}
              >
                {calendarDays.map((cell) => {
                  const isStart = cell.dateStr === tempStart;
                  const isEnd = cell.dateStr === tempEnd;
                  const isInRange =
                    tempStart &&
                    tempEnd &&
                    cell.dateStr > tempStart &&
                    cell.dateStr < tempEnd;
                  const isHovered =
                    tempStart &&
                    !tempEnd &&
                    hoverDate &&
                    cell.dateStr > tempStart &&
                    cell.dateStr <= hoverDate;

                  const isToday = cell.dateStr === toISODate(new Date());

                  let background = "transparent";
                  let color = cell.isCurrentMonth
                    ? (isDark ? "#f8fafc" : "#1e293b")
                    : (isDark ? "#475569" : "#cbd5e1");
                  let borderRadius = "8px";
                  let boxShadow = "none";
                  let border = "none";

                  if (isStart || isEnd) {
                    background = "linear-gradient(135deg, #16a34a 0%, #15803d 100%)";
                    color = "#ffffff";
                    borderRadius = "50%";
                    boxShadow = "0 4px 12px rgba(21, 128, 61, 0.4)";
                  } else if (isInRange || isHovered) {
                    background = isDark ? "rgba(34, 197, 94, 0.2)" : "#dcfce7";
                    color = isDark ? "#4ade80" : "#15803d";
                    borderRadius = "0px";
                  } else if (isToday) {
                    border = isDark ? "1.5px solid #4ade80" : "1.5px solid #16a34a";
                    borderRadius = "50%";
                    color = isDark ? "#4ade80" : "#15803d";
                  }

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => handleDayClick(cell.dateStr)}
                      onMouseEnter={() => setHoverDate(cell.dateStr)}
                      style={{
                        position: "relative",
                        height: "34px",
                        border,
                        background,
                        color,
                        borderRadius,
                        boxShadow,
                        fontSize: "12.5px",
                        fontWeight: isStart || isEnd ? "800" : (isInRange || isToday ? "700" : "500"),
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.12s ease",
                      }}
                    >
                      {cell.dayNum}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
