import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import CustomDropdown from "../components/CustomDropdown";
import { useMessageBox } from "../components/MessageBox";
import { useTheme } from "../themes/ThemeContext";
import {
  Copy,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserX,
  UserCheck,
  Users,
  Loader,
  Check,
  Search,
  X,
  AlertTriangle,
  Calendar,
  Clock,
  Info,
  Phone,
  Mail,
  Building2,
  Radio,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";
import { addAuditLog } from "../utils/auditLog";
import { getResponderFullName } from "../utils/responderOptions";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * Professional Suspension End Date-Time Picker (Green System Theme)
 */
function CustomSuspensionDatePicker({ value, onChange, isDark }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse current value or default to 7 days from now
  const parsedDate = useMemo(() => {
    if (!value) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(17, 0, 0, 0); // 5:00 PM default
      return d;
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [value]);

  const [currentYear, setCurrentYear] = useState(() => parsedDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => parsedDate.getMonth());

  // Hours (1-12), Minutes, AM/PM
  const [hours, setHours] = useState(() => {
    const h = parsedDate.getHours() % 12;
    return h === 0 ? 12 : h;
  });
  const [minutes, setMinutes] = useState(() => {
    return String(Math.floor(parsedDate.getMinutes() / 5) * 5).padStart(2, "0");
  });
  const [ampm, setAmpm] = useState(() => (parsedDate.getHours() >= 12 ? "PM" : "AM"));

  // Sync internal state when external value changes
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setCurrentYear(d.getFullYear());
        setCurrentMonth(d.getMonth());
        const h = d.getHours() % 12;
        setHours(h === 0 ? 12 : h);
        setMinutes(String(d.getMinutes()).padStart(2, "0"));
        setAmpm(d.getHours() >= 12 ? "PM" : "AM");
      }
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Standard Duration Terms
  const applyPresetDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    let h24 = hours % 12;
    if (ampm === "PM") h24 += 12;
    d.setHours(h24, parseInt(minutes, 10) || 0, 0, 0);
    onChange(d.toISOString());
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
  };

  // Day Selection
  const handleSelectDay = (day) => {
    const d = new Date(currentYear, currentMonth, day);
    let h24 = hours % 12;
    if (ampm === "PM") h24 += 12;
    d.setHours(h24, parseInt(minutes, 10) || 0, 0, 0);
    onChange(d.toISOString());
  };

  // Time Selection
  const updateTime = (newHours, newMinutes, newAmpm) => {
    setHours(newHours);
    setMinutes(newMinutes);
    setAmpm(newAmpm);

    const d = new Date(parsedDate);
    let h24 = (parseInt(newHours, 10) % 12) || 0;
    if (newAmpm === "PM") h24 += 12;
    d.setHours(h24, parseInt(newMinutes, 10) || 0, 0, 0);
    onChange(d.toISOString());
  };

  // Calendar days generation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ empty: true, key: `empty-${i}` });
    }

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const thisDate = new Date(currentYear, currentMonth, day);
      const isPast = thisDate < today;
      const isSelected =
        parsedDate.getFullYear() === currentYear &&
        parsedDate.getMonth() === currentMonth &&
        parsedDate.getDate() === day;
      const isToday =
        today.getFullYear() === currentYear &&
        today.getMonth() === currentMonth &&
        today.getDate() === day;

      days.push({
        day,
        isPast,
        isSelected,
        isToday,
        key: `day-${day}`,
      });
    }

    return days;
  }, [currentYear, currentMonth, parsedDate]);

  // Prev / Next Month
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const displayHuman = value
    ? new Date(value).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "Select suspension end date & time...";

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Trigger Input Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "10px 14px",
          borderRadius: "12px",
          border: isOpen
            ? (isDark ? "1.5px solid #4ade80" : "1.5px solid #15803d")
            : (isDark ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid #cbd5e1"),
          backgroundColor: isDark ? "#0f172a" : "#ffffff",
          color: isDark ? "#f8fafc" : "#0f172a",
          fontSize: "13.5px",
          fontWeight: "700",
          cursor: "pointer",
          textAlign: "left",
          boxShadow: isOpen ? "0 0 0 3px rgba(34, 197, 94, 0.2)" : "none",
          transition: "all 0.15s ease",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Calendar size={17} color={isDark ? "#4ade80" : "#15803d"} />
          <span>{displayHuman}</span>
        </div>
        <Clock size={15} color="#94a3b8" />
      </button>

      {/* Popover Calendar Window */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            width: "100%",
            maxWidth: "360px",
            padding: "16px",
            borderRadius: "18px",
            backgroundColor: isDark ? "#131c2e" : "#ffffff",
            border: isDark ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid #bbf7d0",
            boxShadow: isDark
              ? "0 20px 60px -10px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(34, 197, 94, 0.15)"
              : "0 20px 60px -10px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(34, 197, 94, 0.15)",
            zIndex: 999999,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {/* Standard Duration Terms */}
          <div>
            <span style={{ fontSize: "11px", fontWeight: "800", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Standard Duration Terms:
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "6px" }}>
              {[
                { label: "3 Days", days: 3 },
                { label: "7 Days (1 Wk)", days: 7 },
                { label: "15 Days", days: 15 },
                { label: "30 Days (1 Mo)", days: 30 },
                { label: "60 Days", days: 60 },
              ].map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => applyPresetDays(p.days)}
                  style={{
                    padding: "4px 9px",
                    borderRadius: "8px",
                    border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #bbf7d0",
                    backgroundColor: isDark ? "rgba(34, 197, 94, 0.14)" : "#f0fdf4",
                    color: isDark ? "#4ade80" : "#15803d",
                    fontSize: "11px",
                    fontWeight: "700",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Month & Year Navigation */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 2px",
              borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
              paddingTop: "10px",
            }}
          >
            <strong style={{ fontSize: "14px", color: isDark ? "#f8fafc" : "#14532d" }}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </strong>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                type="button"
                onClick={prevMonth}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                  backgroundColor: isDark ? "#1e293b" : "#ffffff",
                  color: isDark ? "#f8fafc" : "#475569",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                  backgroundColor: isDark ? "#1e293b" : "#ffffff",
                  color: isDark ? "#f8fafc" : "#475569",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Weekdays Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", textAlign: "center" }}>
            {WEEKDAY_NAMES.map((d) => (
              <span key={d} style={{ fontSize: "11px", fontWeight: "700", color: isDark ? "#64748b" : "#94a3b8" }}>
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
            {calendarDays.map((item) => {
              if (item.empty) {
                return <div key={item.key} style={{ height: "30px" }} />;
              }

              const { day, isPast, isSelected, isToday } = item;

              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={isPast}
                  onClick={() => handleSelectDay(day)}
                  style={{
                    height: "30px",
                    borderRadius: "8px",
                    border: isSelected
                      ? "none"
                      : isToday
                      ? (isDark ? "1px solid #4ade80" : "1px solid #15803d")
                      : "none",
                    backgroundColor: isSelected
                      ? (isDark ? "#22c55e" : "#15803d")
                      : "transparent",
                    color: isSelected
                      ? "#ffffff"
                      : isPast
                      ? (isDark ? "#475569" : "#cbd5e1")
                      : (isDark ? "#f8fafc" : "#0f172a"),
                    fontSize: "12px",
                    fontWeight: isSelected || isToday ? "800" : "600",
                    cursor: isPast ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.1s ease",
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Time Picker Controls */}
          <div
            style={{
              paddingTop: "10px",
              borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "700" }}>
              <Clock size={13} />
              <span>Lift Time:</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              {/* Hours Select */}
              <select
                value={hours}
                onChange={(e) => updateTime(parseInt(e.target.value, 10), minutes, ampm)}
                style={{
                  padding: "4px 6px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "700",
                  backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                  color: isDark ? "#f8fafc" : "#0f172a",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}
                  </option>
                ))}
              </select>

              <span>:</span>

              {/* Minutes Select */}
              <select
                value={minutes}
                onChange={(e) => updateTime(hours, e.target.value, ampm)}
                style={{
                  padding: "4px 6px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "700",
                  backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                  color: isDark ? "#f8fafc" : "#0f172a",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              {/* AM / PM Toggle */}
              <button
                type="button"
                onClick={() => updateTime(hours, minutes, ampm === "AM" ? "PM" : "AM")}
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: isDark ? "#22c55e" : "#15803d",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: "800",
                  cursor: "pointer",
                }}
              >
                {ampm}
              </button>
            </div>
          </div>

          {/* Done Button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              width: "100%",
              padding: "9px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: isDark ? "rgba(34, 197, 94, 0.2)" : "#15803d",
              color: isDark ? "#4ade80" : "#ffffff",
              fontSize: "12.5px",
              fontWeight: "800",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Check size={14} />
            <span>Apply Lift Schedule</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function GenerateResponderPin() {
  const { isDark } = useTheme();
  const { alert: showAlert, confirm, snackbar } = useMessageBox();

  // Active Tab: "responders" (Responder Accounts) | "pins" (Department PINs)
  const [activeTab, setActiveTab] = useState("responders");

  // Data States
  const [responders, setResponders] = useState([]);
  const [accessRecords, setAccessRecords] = useState([]);
  const [loadingResponders, setLoadingResponders] = useState(true);
  const [loadingPins, setLoadingPins] = useState(true);
  const [copiedRecordId, setCopiedRecordId] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "suspended"
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [dutyFilter, setDutyFilter] = useState("all"); // "all" | "available" | "busy"

  // Suspension Modal State
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [targetResponder, setTargetResponder] = useState(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [isIndefinite, setIsIndefinite] = useState(true);
  const [suspendedUntil, setSuspendedUntil] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active Tooltip / Popover for Suspended Badge
  const [activeTooltipId, setActiveTooltipId] = useState(null);

  // Quick Preset Reasons for Suspension
  const quickReasons = [
    "Failure to Respond to Dispatch",
    "Under Administrative Review",
    "Unprofessional Conduct / Protocol Breach",
    "Unreachable During Duty Shift",
    "Equipment & Vehicle Non-Compliance",
    "Temporary Reliever Rotation",
  ];

  // Helper notification dispatcher
  const notify = useCallback(
    (message, tone = "success") => {
      if (typeof snackbar === "function") {
        snackbar({ message, tone });
      } else if (typeof showAlert === "function") {
        showAlert(message);
      }
    },
    [snackbar, showAlert]
  );

  // Fetch Responders
  const fetchResponders = useCallback(async (isMountedRef) => {
    try {
      const records = await pb.collection("responder_accounts").getFullList({
        sort: "-created",
        requestKey: null,
      });
      if (isMountedRef?.current !== false) {
        setResponders(records);
        setLoadingResponders(false);
      }
    } catch (err) {
      if (!err?.isAbort) {
        console.error("Error fetching responder accounts:", err);
      }
      if (isMountedRef?.current !== false) setLoadingResponders(false);
    }
  }, []);

  // Fetch Department PIN Access Records
  const fetchAccessRecords = useCallback(async (isMountedRef) => {
    try {
      const records = await pb.collection("registration_access").getFullList({
        sort: "department",
        requestKey: null,
      });
      if (isMountedRef?.current !== false) {
        setAccessRecords(records);
        setLoadingPins(false);
      }
    } catch (err) {
      if (!err?.isAbort) {
        console.error("Error fetching access records:", err);
      }
      if (isMountedRef?.current !== false) setLoadingPins(false);
    }
  }, []);

  // Real-time PocketBase Subscriptions
  useEffect(() => {
    const isMounted = { current: true };

    fetchResponders(isMounted);
    fetchAccessRecords(isMounted);

    let unsubResponders;
    let unsubPins;

    // Subscribe to responder_accounts
    pb.collection("responder_accounts")
      .subscribe("*", (e) => {
        if (!isMounted.current) return;
        if (e.action === "create") {
          setResponders((prev) => [e.record, ...prev.filter((r) => r.id !== e.record.id)]);
        } else if (e.action === "update") {
          setResponders((prev) =>
            prev.map((r) => (r.id === e.record.id ? e.record : r))
          );
        } else if (e.action === "delete") {
          setResponders((prev) => prev.filter((r) => r.id !== e.record.id));
        }
      })
      .then((unsub) => {
        unsubResponders = unsub;
      })
      .catch((err) => console.error("Responders subscription error:", err));

    // Subscribe to registration_access
    pb.collection("registration_access")
      .subscribe("*", (e) => {
        if (!isMounted.current) return;
        if (e.action === "create") {
          setAccessRecords((prev) => [...prev, e.record]);
        } else if (e.action === "update") {
          setAccessRecords((prev) =>
            prev.map((record) => (record.id === e.record.id ? e.record : record))
          );
        } else if (e.action === "delete") {
          setAccessRecords((prev) => prev.filter((r) => r.id !== e.record.id));
        }
      })
      .then((unsub) => {
        unsubPins = unsub;
      })
      .catch((err) => console.error("Pins subscription error:", err));

    return () => {
      isMounted.current = false;
      if (unsubResponders) unsubResponders();
      if (unsubPins) unsubPins();
    };
  }, [fetchResponders, fetchAccessRecords]);

  // Derived Department List for filter
  const departmentsList = useMemo(() => {
    const set = new Set();
    responders.forEach((r) => {
      if (r.department) set.add(r.department.toUpperCase());
    });
    accessRecords.forEach((a) => {
      if (a.department) set.add(a.department.toUpperCase());
    });
    return Array.from(set).sort();
  }, [responders, accessRecords]);

  // Filtered Responders
  const filteredResponders = useMemo(() => {
    return responders.filter((r) => {
      // Status Filter
      if (statusFilter === "active" && r.is_suspended) return false;
      if (statusFilter === "suspended" && !r.is_suspended) return false;

      // Department Filter
      if (
        departmentFilter !== "all" &&
        (r.department || "").toUpperCase() !== departmentFilter.toUpperCase()
      ) {
        return false;
      }

      // Duty Availability Filter
      if (dutyFilter === "available" && (!r.is_available || r.is_suspended)) return false;
      if (dutyFilter === "busy" && (r.is_available || r.is_suspended)) return false;

      // Search Query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const fullName = getResponderFullName(r).toLowerCase();
        const email = (r.email || "").toLowerCase();
        const dept = (r.department || "").toLowerCase();
        const unit = (r.unit_name || "").toLowerCase();
        const phone = (r.contact_number || r.phone || "").toLowerCase();
        const reason = (r.suspension_reason || "").toLowerCase();

        return (
          fullName.includes(query) ||
          email.includes(query) ||
          dept.includes(query) ||
          unit.includes(query) ||
          phone.includes(query) ||
          reason.includes(query)
        );
      }

      return true;
    });
  }, [responders, statusFilter, departmentFilter, dutyFilter, searchTerm]);

  // Active filters helper
  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    statusFilter !== "all" ||
    departmentFilter !== "all" ||
    dutyFilter !== "all"
  );

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDepartmentFilter("all");
    setDutyFilter("all");
  };

  // Filtered Department PIN Access Records
  const filteredAccessRecords = useMemo(() => {
    return accessRecords.filter((rec) => {
      if (departmentFilter !== "all" && (rec.department || "").toUpperCase() !== departmentFilter.toUpperCase()) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const dept = (rec.department || "").toLowerCase();
        const pin = (rec.pin || "").toLowerCase();
        return dept.includes(query) || pin.includes(query);
      }
      return true;
    });
  }, [accessRecords, departmentFilter, searchTerm]);

  // Statistics Counts
  const stats = useMemo(() => {
    const total = responders.length;
    const suspended = responders.filter((r) => r.is_suspended).length;
    const active = total - suspended;
    const available = responders.filter((r) => !r.is_suspended && r.is_available).length;
    return { total, active, suspended, available };
  }, [responders]);

  // Open Suspend Modal
  const handleOpenSuspendModal = (responder) => {
    setTargetResponder(responder);
    setSuspensionReason(responder.suspension_reason || "");
    setIsIndefinite(!responder.suspended_until);
    if (responder.suspended_until) {
      try {
        const d = new Date(responder.suspended_until);
        setSuspendedUntil(d.toISOString());
      } catch {
        setSuspendedUntil("");
      }
    } else {
      // Default to 7 days from now
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(17, 0, 0, 0);
      setSuspendedUntil(nextWeek.toISOString());
    }
    setSuspendModalOpen(true);
  };

  // Confirm Suspension Action
  const handleConfirmSuspension = async () => {
    if (!targetResponder) return;
    if (!suspensionReason.trim()) {
      await showAlert("Please provide a reason for the suspension.", {
        title: "Reason Required",
      });
      return;
    }

    let endIsoDate = null;
    if (!isIndefinite && suspendedUntil) {
      const selected = new Date(suspendedUntil);
      if (isNaN(selected.getTime())) {
        await showAlert("Please provide a valid suspension lift date and time.", {
          title: "Invalid Date",
        });
        return;
      }
      endIsoDate = selected.toISOString();
    }

    setIsSubmitting(true);
    try {
      const responderName = getResponderFullName(targetResponder);
      const currentAdmin = pb.authStore.model;
      const adminName =
        `${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim() ||
        currentAdmin?.email ||
        "Administrator";

      await pb.collection("responder_accounts").update(targetResponder.id, {
        is_suspended: true,
        suspension_reason: suspensionReason.trim(),
        suspended_until: endIsoDate,
        is_available: false, // Suspended personnel are automatically marked unavailable
      });

      addAuditLog({
        action: "RESPONDER_SUSPENDED",
        target: `${responderName} (${targetResponder.department || "Responder"})`,
        details: `Administrator ${adminName} suspended responder ${responderName}. Reason: "${suspensionReason.trim()}". ${
          endIsoDate
            ? `Suspension until: ${new Date(endIsoDate).toLocaleString()}`
            : "Suspension is indefinite."
        }`,
        actor: adminName,
      });

      notify(`Suspended ${responderName} successfully.`, "danger");
      setSuspendModalOpen(false);
      setTargetResponder(null);
      setSuspensionReason("");
      setSuspendedUntil("");
      setIsIndefinite(true);
    } catch (err) {
      console.error("Failed to suspend responder:", err);
      await showAlert(
        `Failed to suspend responder: ${err?.message || "Please check network connection."}`,
        { title: "Suspension Error" }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Unsuspend / Lift Suspension Action
  const handleLiftSuspension = async (responder) => {
    const responderName = getResponderFullName(responder);
    const isConfirmed = await confirm(
      `Are you sure you want to reinstate ${responderName} and lift their account suspension?`,
      {
        title: "Lift Responder Suspension",
        primaryLabel: "Reinstate Responder",
      }
    );

    if (!isConfirmed) return;

    try {
      const currentAdmin = pb.authStore.model;
      const adminName =
        `${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim() ||
        currentAdmin?.email ||
        "Administrator";

      await pb.collection("responder_accounts").update(responder.id, {
        is_suspended: false,
        suspension_reason: "",
        suspended_until: null,
      });

      addAuditLog({
        action: "RESPONDER_REINSTATED",
        target: `${responderName} (${responder.department || "Responder"})`,
        details: `Administrator ${adminName} reinstated responder ${responderName} and lifted account suspension.`,
        actor: adminName,
      });

      notify(`Reinstated ${responderName} successfully.`, "success");
    } catch (err) {
      console.error("Failed to lift suspension:", err);
      await showAlert(`Failed to lift suspension: ${err?.message || "Please try again."}`, {
        title: "Error",
      });
    }
  };

  // PIN Generation Handlers
  const generateNewPin = async (record) => {
    const isConfirmed = await confirm(
      `Are you sure you want to generate a new PIN for the ${record.department} department? The old PIN will be invalidated immediately.`,
      {
        title: "Confirm PIN Generation",
        primaryLabel: "Generate New PIN",
      }
    );

    if (!isConfirmed) return;

    const newPin = Math.random().toString(36).substring(2, 7).toUpperCase();

    try {
      await pb.collection("registration_access").update(record.id, {
        pin: newPin,
      });

      const currentAdmin = pb.authStore.model;
      const adminName =
        `${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim() ||
        currentAdmin?.email ||
        "Administrator";

      addAuditLog({
        action: "RESPONDER_PIN_GENERATED",
        target: `${record.department} Access PIN`,
        details: `Administrator ${adminName} generated a new registration PIN for the ${record.department} department.`,
        actor: adminName,
      });

      notify(`Generated new PIN for ${record.department}: ${newPin}`, "success");
    } catch (error) {
      console.error("Failed to generate PIN:", error);
      await showAlert("Failed to generate new PIN. Please try again.", {
        title: "Error",
      });
    }
  };

  const togglePinStatus = async (record) => {
    const action = record.is_active ? "Deactivate" : "Activate";
    const isConfirmed = await confirm(
      `Are you sure you want to ${action.toLowerCase()} PIN access for ${record.department}?`,
      {
        title: `Confirm ${action}`,
        primaryLabel: action,
      }
    );

    if (!isConfirmed) return;

    try {
      const newStatus = !record.is_active;
      await pb.collection("registration_access").update(record.id, {
        is_active: newStatus,
      });

      const currentAdmin = pb.authStore.model;
      const adminName =
        `${currentAdmin?.first_name || ""} ${currentAdmin?.last_name || ""}`.trim() ||
        currentAdmin?.email ||
        "Administrator";

      addAuditLog({
        action: newStatus ? "RESPONDER_PIN_ACTIVATED" : "RESPONDER_PIN_DEACTIVATED",
        target: `${record.department} Access PIN`,
        details: `Administrator ${adminName} ${
          newStatus ? "Activated (allowed)" : "Deactivated (blocked)"
        } registration PIN authorization for ${record.department}.`,
        actor: adminName,
      });

      notify(
        `${record.department} PIN ${newStatus ? "activated" : "deactivated"} successfully.`,
        newStatus ? "success" : "info"
      );
    } catch (error) {
      console.error("Failed to toggle status:", error);
      await showAlert("Failed to update status. Please try again.", {
        title: "Error",
      });
    }
  };

  const copyPin = async (record) => {
    try {
      await navigator.clipboard.writeText(record.pin);
      setCopiedRecordId(record.id);
      window.setTimeout(
        () => setCopiedRecordId((current) => (current === record.id ? null : current)),
        1800
      );
    } catch {
      await showAlert("Unable to copy the PIN. Please copy it manually.", { title: "Copy Failed" });
    }
  };

  // Format Helper for Dates
  const formatDateTime = (isoString) => {
    if (!isoString) return "Indefinite";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: isDark ? "#090d16" : "#f8fafc",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <Sidebar />
      <main
        style={{
          flex: 1,
          marginLeft: "216px",
          padding: "32px 36px",
          minWidth: 0,
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <header style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: isDark ? "#4ade80" : "#15803d",
              }}
            />
            <h1
              style={{
                fontSize: "clamp(22px, 3vw, 28px)",
                fontWeight: "800",
                color: isDark ? "#f8fafc" : "#14532d",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Responder Management & Access
            </h1>
          </div>
          <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: "14px" }}>
            Monitor emergency field responder accounts, audit suspension statuses, and generate secure registration PINs.
          </p>
        </header>

        {/* Top KPI Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
            marginBottom: "24px",
          }}
        >
          {/* Total Responders */}
          <div
            style={{
              padding: "16px 18px",
              borderRadius: "14px",
              backgroundColor: isDark ? "#131c2e" : "#ffffff",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
              boxShadow: isDark ? "0 4px 14px rgba(0, 0, 0, 0.3)" : "0 1px 3px rgba(0, 0, 0, 0.03)",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                backgroundColor: isDark ? "rgba(34, 197, 94, 0.14)" : "#f0fdf4",
                border: isDark ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid #bbf7d0",
                color: isDark ? "#4ade80" : "#15803d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: "600", color: isDark ? "#94a3b8" : "#64748b" }}>
                Total Responders
              </div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a" }}>
                {stats.total}
              </div>
            </div>
          </div>

          {/* Active Responders */}
          <div
            style={{
              padding: "16px 18px",
              borderRadius: "14px",
              backgroundColor: isDark ? "#131c2e" : "#ffffff",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
              boxShadow: isDark ? "0 4px 14px rgba(0, 0, 0, 0.3)" : "0 1px 3px rgba(0, 0, 0, 0.03)",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                backgroundColor: isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4",
                border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #bbf7d0",
                color: isDark ? "#4ade80" : "#15803d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserCheck size={20} />
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: "600", color: isDark ? "#94a3b8" : "#64748b" }}>
                Active Responders
              </div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d" }}>
                {stats.active}
              </div>
            </div>
          </div>

          {/* Suspended Responders */}
          <div
            style={{
              padding: "16px 18px",
              borderRadius: "14px",
              backgroundColor: isDark ? "#131c2e" : "#ffffff",
              border: stats.suspended > 0
                ? (isDark ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid #fecaca")
                : (isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0"),
              boxShadow: isDark ? "0 4px 14px rgba(0, 0, 0, 0.3)" : "0 1px 3px rgba(0, 0, 0, 0.03)",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                backgroundColor: isDark ? "rgba(239, 68, 68, 0.16)" : "#fef2f2",
                border: isDark ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid #fecaca",
                color: isDark ? "#f87171" : "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserX size={20} />
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: "600", color: isDark ? "#94a3b8" : "#64748b" }}>
                Suspended Responders
              </div>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: "800",
                  color: stats.suspended > 0 ? (isDark ? "#f87171" : "#dc2626") : (isDark ? "#94a3b8" : "#64748b"),
                }}
              >
                {stats.suspended}
              </div>
            </div>
          </div>

          {/* Available on Duty */}
          <div
            style={{
              padding: "16px 18px",
              borderRadius: "14px",
              backgroundColor: isDark ? "#131c2e" : "#ffffff",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
              boxShadow: isDark ? "0 4px 14px rgba(0, 0, 0, 0.3)" : "0 1px 3px rgba(0, 0, 0, 0.03)",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                backgroundColor: isDark ? "rgba(34, 197, 94, 0.14)" : "#f0fdf4",
                border: isDark ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid #bbf7d0",
                color: isDark ? "#4ade80" : "#15803d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Radio size={20} />
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: "600", color: isDark ? "#94a3b8" : "#64748b" }}>
                Available on Duty
              </div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d" }}>
                {stats.available}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "18px",
            borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
            paddingBottom: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("responders")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontWeight: "700",
              fontSize: "13.5px",
              transition: "all 0.2s ease",
              backgroundColor:
                activeTab === "responders"
                  ? (isDark ? "rgba(34, 197, 94, 0.18)" : "#15803d")
                  : "transparent",
              color:
                activeTab === "responders"
                  ? (isDark ? "#4ade80" : "#ffffff")
                  : (isDark ? "#94a3b8" : "#64748b"),
            }}
          >
            <ShieldCheck size={16} />
            <span>Responder Accounts</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "800",
                padding: "2px 7px",
                borderRadius: "999px",
                backgroundColor:
                  activeTab === "responders"
                    ? (isDark ? "rgba(34, 197, 94, 0.3)" : "rgba(255, 255, 255, 0.25)")
                    : (isDark ? "#1e293b" : "#e2e8f0"),
                color:
                  activeTab === "responders"
                    ? (isDark ? "#86efac" : "#ffffff")
                    : (isDark ? "#94a3b8" : "#475569"),
              }}
            >
              {responders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pins")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontWeight: "700",
              fontSize: "13.5px",
              transition: "all 0.2s ease",
              backgroundColor:
                activeTab === "pins"
                  ? (isDark ? "rgba(34, 197, 94, 0.18)" : "#15803d")
                  : "transparent",
              color:
                activeTab === "pins"
                  ? (isDark ? "#4ade80" : "#ffffff")
                  : (isDark ? "#94a3b8" : "#64748b"),
            }}
          >
            <KeyRound size={16} />
            <span>Department Access PINs</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "800",
                padding: "2px 7px",
                borderRadius: "999px",
                backgroundColor:
                  activeTab === "pins"
                    ? (isDark ? "rgba(34, 197, 94, 0.3)" : "rgba(255, 255, 255, 0.25)")
                    : (isDark ? "#1e293b" : "#e2e8f0"),
                color:
                  activeTab === "pins"
                    ? (isDark ? "#86efac" : "#ffffff")
                    : (isDark ? "#94a3b8" : "#475569"),
              }}
            >
              {accessRecords.length}
            </span>
          </button>
        </div>

        {/* Main Content Card */}
        <div className="premium-table-card">
          {/* Filter Toolbar */}
          <div
            className="table-toolbar"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flex: 1, minWidth: "260px" }}>
              {/* Search Box */}
              <div className="search-box-premium" style={{ minWidth: "240px", flex: 1 }}>
                <Search size={18} color="#94a3b8" />
                <input
                  type="text"
                  placeholder={
                    activeTab === "responders"
                      ? "Search responder name, department, unit, email..."
                      : "Search department or PIN code..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "#94a3b8" }}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Status Filter CustomDropdown */}
              {activeTab === "responders" && (
                <CustomDropdown
                  label="All Responders"
                  value={statusFilter}
                  options={[
                    { value: "all", label: "All Responders" },
                    { value: "active", label: "Active Only" },
                    { value: "suspended", label: "Suspended Only" },
                  ]}
                  onChange={(val) => setStatusFilter(val)}
                  minWidth="155px"
                />
              )}

              {/* Department Filter CustomDropdown */}
              {departmentsList.length > 0 && (
                <CustomDropdown
                  label="All Departments"
                  value={departmentFilter}
                  options={[
                    { value: "all", label: "All Departments" },
                    ...departmentsList.map((dept) => ({
                      value: dept,
                      label: dept,
                    })),
                  ]}
                  onChange={(val) => setDepartmentFilter(val)}
                  minWidth="160px"
                />
              )}

              {/* Duty Filter CustomDropdown (Only for Responders Tab) */}
              {activeTab === "responders" && (
                <CustomDropdown
                  label="All Duty Status"
                  value={dutyFilter}
                  options={[
                    { value: "all", label: "All Duty Status" },
                    { value: "available", label: "Available on Duty" },
                    { value: "busy", label: "Busy / In Field" },
                  ]}
                  onChange={(val) => setDutyFilter(val)}
                  minWidth="155px"
                />
              )}

              {/* Reset Filters Button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                    backgroundColor: isDark ? "#1e293b" : "#ffffff",
                    color: isDark ? "#94a3b8" : "#64748b",
                    fontSize: "12.5px",
                    fontWeight: "700",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title="Reset all filters"
                >
                  <RotateCcw size={13} />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            <div style={{ fontSize: "13px", fontWeight: "600", color: isDark ? "#94a3b8" : "#64748b" }}>
              Showing:{" "}
              <strong style={{ color: isDark ? "#4ade80" : "#0f172a" }}>
                {activeTab === "responders" ? filteredResponders.length : filteredAccessRecords.length}
              </strong>
            </div>
          </div>

          {/* TAB 1: RESPONDER ACCOUNTS TABLE */}
          {activeTab === "responders" && (
            <>
              {loadingResponders ? (
                <div
                  style={{
                    padding: "50px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    color: isDark ? "#4ade80" : "#15803d",
                  }}
                >
                  <Loader className="animate-spin" size={26} />
                  <span>Loading emergency responder accounts...</span>
                </div>
              ) : filteredResponders.length === 0 ? (
                <div style={{ padding: "50px 20px", textAlign: "center", color: isDark ? "#94a3b8" : "#64748b" }}>
                  <Users size={40} color="#94a3b8" style={{ marginBottom: "12px" }} />
                  <h3 style={{ margin: "0 0 6px 0", color: isDark ? "#f8fafc" : "#1e293b", fontSize: "16px" }}>
                    No Responders Found
                  </h3>
                  <p style={{ margin: 0, fontSize: "13.5px" }}>
                    {searchTerm || statusFilter !== "all" || departmentFilter !== "all" || dutyFilter !== "all"
                      ? "No responder accounts match your active search or filter criteria."
                      : "No responder accounts have registered yet."}
                  </p>
                </div>
              ) : (
                <div className="premium-table-wrapper responsive-table-wrapper" style={{ overflowX: "auto" }}>
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Responder</th>
                        <th>Department</th>
                        <th>Contact Information</th>
                        <th>Field Status</th>
                        <th>Suspension Status</th>
                        <th style={{ textAlign: "center" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResponders.map((responder) => {
                        const fullName = getResponderFullName(responder);
                        const avatar = responder.avatar || responder.photo || responder.image;
                        const avatarUrl = avatar ? pb.files.getURL(responder, avatar) : null;
                        const isSuspended = !!responder.is_suspended;
                        const isTooltipOpen = activeTooltipId === responder.id;

                        return (
                          <tr
                            key={responder.id}
                            style={{
                              backgroundColor: isSuspended
                                ? (isDark ? "rgba(239, 68, 68, 0.05)" : "rgba(254, 242, 242, 0.5)")
                                : "transparent",
                            }}
                          >
                            {/* Responder Info */}
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                {avatarUrl ? (
                                  <img
                                    src={avatarUrl}
                                    alt={fullName}
                                    style={{
                                      width: "40px",
                                      height: "40px",
                                      borderRadius: "12px",
                                      objectFit: "cover",
                                      border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                                      flexShrink: 0,
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: "40px",
                                      height: "40px",
                                      borderRadius: "12px",
                                      backgroundColor: isSuspended
                                        ? (isDark ? "rgba(239, 68, 68, 0.2)" : "#fef2f2")
                                        : (isDark ? "rgba(34, 197, 94, 0.2)" : "#f0fdf4"),
                                      border: isSuspended
                                        ? (isDark ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid #fecaca")
                                        : (isDark ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid #bbf7d0"),
                                      color: isSuspended
                                        ? (isDark ? "#f87171" : "#dc2626")
                                        : (isDark ? "#4ade80" : "#15803d"),
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontWeight: "800",
                                      fontSize: "14px",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {fullName.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <span
                                    style={{
                                      fontWeight: "700",
                                      color: isDark ? "#f8fafc" : "#0f172a",
                                      fontSize: "14px",
                                      display: "block",
                                    }}
                                  >
                                    {fullName}
                                  </span>
                                  <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>
                                    {responder.unit_name ? `Unit: ${responder.unit_name}` : "Field Personnel"}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Department */}
                            <td>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                <Building2 size={14} color={isDark ? "#94a3b8" : "#64748b"} />
                                <span
                                  style={{
                                    fontSize: "12.5px",
                                    fontWeight: "700",
                                    padding: "3px 9px",
                                    borderRadius: "8px",
                                    backgroundColor: isDark ? "#172338" : "#f1f5f9",
                                    color: isDark ? "#4ade80" : "#15803d",
                                    border: isDark ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid #bbf7d0",
                                  }}
                                >
                                  {responder.department ? responder.department.toUpperCase() : "GENERAL"}
                                </span>
                              </div>
                            </td>

                            {/* Contact Info */}
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                {responder.email && (
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: isDark ? "#cbd5e1" : "#334155" }}>
                                    <Mail size={12} color="#94a3b8" />
                                    <span>{responder.email}</span>
                                  </div>
                                )}
                                {(responder.contact_number || responder.phone) && (
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>
                                    <Phone size={12} color="#94a3b8" />
                                    <span>{responder.contact_number || responder.phone}</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Field Duty Status */}
                            <td>
                              {isSuspended ? (
                                <span style={{ fontSize: "12px", fontWeight: "600", color: isDark ? "#f87171" : "#dc2626" }}>
                                  — Unavailable (Suspended)
                                </span>
                              ) : responder.is_available ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    fontSize: "12px",
                                    fontWeight: "700",
                                    color: isDark ? "#4ade80" : "#166534",
                                  }}
                                >
                                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#22c55e" }} />
                                  Available for Dispatch
                                </span>
                              ) : (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    color: isDark ? "#fbbf24" : "#d97706",
                                  }}
                                >
                                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#f59e0b" }} />
                                  Busy / In Field
                                </span>
                              )}
                            </td>

                            {/* Status Badge with Tooltip / Popover */}
                            <td>
                              <div style={{ position: "relative", display: "inline-block" }}>
                                {isSuspended ? (
                                  <button
                                    type="button"
                                    onClick={() => setActiveTooltipId(isTooltipOpen ? null : responder.id)}
                                    onMouseEnter={() => setActiveTooltipId(responder.id)}
                                    onMouseLeave={() => setActiveTooltipId(null)}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      padding: "4px 10px",
                                      borderRadius: "999px",
                                      fontSize: "12px",
                                      fontWeight: "800",
                                      backgroundColor: isDark ? "rgba(239, 68, 68, 0.22)" : "#fef2f2",
                                      color: isDark ? "#f87171" : "#b91c1c",
                                      border: isDark ? "1px solid rgba(239, 68, 68, 0.45)" : "1px solid #fecaca",
                                      cursor: "pointer",
                                    }}
                                    title="Click or hover to inspect suspension details"
                                  >
                                    <AlertTriangle size={12} />
                                    <span>Suspended</span>
                                    <Info size={11} style={{ opacity: 0.75 }} />
                                  </button>
                                ) : (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      padding: "4px 10px",
                                      borderRadius: "999px",
                                      fontSize: "12px",
                                      fontWeight: "800",
                                      backgroundColor: isDark ? "rgba(34, 197, 94, 0.2)" : "#f0fdf4",
                                      color: isDark ? "#4ade80" : "#15803d",
                                      border: isDark ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid #bbf7d0",
                                    }}
                                  >
                                    <Check size={12} />
                                    <span>Active</span>
                                  </span>
                                )}

                                {/* Interactive Tooltip / Popover */}
                                {isSuspended && isTooltipOpen && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      bottom: "calc(100% + 8px)",
                                      left: "0",
                                      minWidth: "260px",
                                      maxWidth: "320px",
                                      padding: "12px 14px",
                                      borderRadius: "12px",
                                      backgroundColor: isDark ? "#0f172a" : "#ffffff",
                                      border: isDark ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid #fecaca",
                                      boxShadow: isDark
                                        ? "0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.05)"
                                        : "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05)",
                                      zIndex: 100,
                                      fontSize: "12px",
                                      color: isDark ? "#f8fafc" : "#0f172a",
                                      pointerEvents: "none",
                                      animation: "fadeIn 0.15s ease-out",
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", color: isDark ? "#f87171" : "#dc2626", fontWeight: "800" }}>
                                      <AlertTriangle size={13} />
                                      <span>Account Suspension Notice</span>
                                    </div>
                                    <div style={{ marginBottom: "6px", color: isDark ? "#cbd5e1" : "#334155", lineHeight: "1.4" }}>
                                      <strong>Reason:</strong> {responder.suspension_reason || "Administrative review"}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "5px", color: isDark ? "#94a3b8" : "#64748b", fontSize: "11.5px" }}>
                                      <Calendar size={11} />
                                      <span>Lift Date: <strong>{formatDateTime(responder.suspended_until)}</strong></span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Action Buttons */}
                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "inline-flex", gap: "8px" }}>
                                {isSuspended ? (
                                  <button
                                    type="button"
                                    className="premium-action-btn"
                                    onClick={() => handleLiftSuspension(responder)}
                                    style={{
                                      color: isDark ? "#4ade80" : "#15803d",
                                      borderColor: isDark ? "rgba(34, 197, 94, 0.4)" : "#bbf7d0",
                                      backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
                                      padding: "6px 12px",
                                      borderRadius: "8px",
                                      fontSize: "12px",
                                      fontWeight: "700",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      cursor: "pointer",
                                    }}
                                    title="Reinstate responder and lift account suspension"
                                  >
                                    <UserCheck size={13} />
                                    <span>Lift Suspension</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="premium-action-btn"
                                    onClick={() => handleOpenSuspendModal(responder)}
                                    style={{
                                      color: isDark ? "#f87171" : "#dc2626",
                                      borderColor: isDark ? "rgba(239, 68, 68, 0.4)" : "#fecaca",
                                      backgroundColor: isDark ? "rgba(239, 68, 68, 0.16)" : "#fef2f2",
                                      padding: "6px 12px",
                                      borderRadius: "8px",
                                      fontSize: "12px",
                                      fontWeight: "700",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      cursor: "pointer",
                                    }}
                                    title="Suspend responder account"
                                  >
                                    <UserX size={13} />
                                    <span>Suspend</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* TAB 2: DEPARTMENT ACCESS PINS TABLE */}
          {activeTab === "pins" && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 16px",
                  backgroundColor: isDark ? "rgba(34, 197, 94, 0.12)" : "#f0fdf4",
                  border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #bbf7d0",
                  borderRadius: "10px",
                  margin: "0 0 20px 0",
                  fontSize: "13px",
                  color: isDark ? "#86efac" : "#166534",
                  lineHeight: "1.4",
                }}
              >
                <ShieldAlert size={18} color={isDark ? "#4ade80" : "#166534"} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Security Notice:</strong> Field personnel must enter their authorized department PIN during mobile app registration. Generating a new PIN replaces and invalidates the previous code immediately.
                </span>
              </div>

              {loadingPins ? (
                <div
                  style={{
                    padding: "50px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    color: isDark ? "#4ade80" : "#15803d",
                  }}
                >
                  <Loader className="animate-spin" size={26} />
                  <span>Loading responder PIN access records...</span>
                </div>
              ) : filteredAccessRecords.length === 0 ? (
                <div style={{ padding: "50px 20px", textAlign: "center", color: isDark ? "#94a3b8" : "#64748b" }}>
                  <KeyRound size={40} color="#94a3b8" style={{ marginBottom: "12px" }} />
                  <h3 style={{ margin: "0 0 6px 0", color: isDark ? "#f8fafc" : "#1e293b", fontSize: "16px" }}>
                    No Departments Found
                  </h3>
                  <p style={{ margin: 0, fontSize: "13.5px" }}>No access records match your query.</p>
                </div>
              ) : (
                <div className="premium-table-wrapper responsive-table-wrapper" style={{ overflowX: "auto" }}>
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Current Access PIN</th>
                        <th>PIN Status</th>
                        <th style={{ textAlign: "center" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccessRecords.map((record) => (
                        <tr key={record.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <div
                                style={{
                                  width: "38px",
                                  height: "38px",
                                  borderRadius: "10px",
                                  backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
                                  border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: isDark ? "#4ade80" : "#15803d",
                                  fontWeight: "800",
                                  fontSize: "14px",
                                }}
                              >
                                {record.department ? record.department.slice(0, 2).toUpperCase() : "DP"}
                              </div>
                              <div>
                                <span
                                  style={{
                                    fontWeight: "700",
                                    color: isDark ? "#f8fafc" : "#1e293b",
                                    fontSize: "14px",
                                    display: "block",
                                  }}
                                >
                                  {record.department ? record.department.toUpperCase() : "GENERAL"}
                                </span>
                                <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>
                                  Authorized Responder Unit
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                              <span
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "16px",
                                  fontWeight: "800",
                                  letterSpacing: "0.15em",
                                  backgroundColor: isDark ? "#172338" : "#f8fafc",
                                  border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  color: isDark ? "#4ade80" : "#0f172a",
                                }}
                              >
                                {record.pin}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyPin(record)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  border:
                                    copiedRecordId === record.id
                                      ? (isDark ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid #bbf7d0")
                                      : (isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1"),
                                  backgroundColor:
                                    copiedRecordId === record.id
                                      ? (isDark ? "rgba(34, 197, 94, 0.22)" : "#f0fdf4")
                                      : (isDark ? "#172338" : "#ffffff"),
                                  color:
                                    copiedRecordId === record.id
                                      ? (isDark ? "#4ade80" : "#15803d")
                                      : (isDark ? "#cbd5e1" : "#475569"),
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                                title="Copy PIN"
                              >
                                {copiedRecordId === record.id ? <Check size={13} /> : <Copy size={13} />}
                                {copiedRecordId === record.id ? "Copied" : "Copy"}
                              </button>
                            </div>
                          </td>

                          <td>
                            <span
                              className={`premium-status-pill ${
                                record.is_active ? "status-pill-active" : "status-pill-suspended"
                              }`}
                            >
                              {record.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>

                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "inline-flex", gap: "8px" }}>
                              <button
                                type="button"
                                className="premium-action-btn"
                                onClick={() => generateNewPin(record)}
                                style={{
                                  color: isDark ? "#4ade80" : "#15803d",
                                  borderColor: isDark ? "rgba(34, 197, 94, 0.35)" : "#bbf7d0",
                                  backgroundColor: isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4",
                                }}
                                title="Generate a new secure PIN"
                              >
                                <RefreshCw size={13} />
                                <span>New PIN</span>
                              </button>

                              <button
                                type="button"
                                className="premium-action-btn"
                                style={{
                                  color: record.is_active
                                    ? (isDark ? "#f87171" : "#ef4444")
                                    : (isDark ? "#4ade80" : "#15803d"),
                                  borderColor: record.is_active
                                    ? (isDark ? "rgba(239, 68, 68, 0.35)" : "#fecaca")
                                    : (isDark ? "rgba(34, 197, 94, 0.35)" : "#bbf7d0"),
                                  backgroundColor: record.is_active
                                    ? (isDark ? "rgba(239, 68, 68, 0.16)" : "#fef2f2")
                                    : (isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4"),
                                }}
                                onClick={() => togglePinStatus(record)}
                              >
                                {record.is_active ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* SUSPENSION MODAL DIALOG */}
        {suspendModalOpen && targetResponder && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(15, 23, 42, 0.82)",
              backdropFilter: "blur(10px)",
              zIndex: 9999,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "20px",
            }}
            onClick={() => !isSubmitting && setSuspendModalOpen(false)}
          >
            <div
              style={{
                backgroundColor: isDark ? "#131c2e" : "#ffffff",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "none",
                borderRadius: "22px",
                width: "100%",
                maxWidth: "560px",
                padding: "26px",
                boxShadow: isDark
                  ? "0 30px 90px -15px rgba(0, 0, 0, 0.85)"
                  : "0 30px 90px -15px rgba(0, 0, 0, 0.6)",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "46px",
                      height: "46px",
                      borderRadius: "14px",
                      backgroundColor: isDark ? "rgba(239, 68, 68, 0.18)" : "#fef2f2",
                      border: isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fecaca",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isDark ? "#f87171" : "#dc2626",
                      flexShrink: 0,
                    }}
                  >
                    <UserX size={24} />
                  </div>
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "18px",
                        fontWeight: "800",
                        color: isDark ? "#f8fafc" : "#0f172a",
                      }}
                    >
                      Suspend Responder Account
                    </h2>
                    <p style={{ margin: "2px 0 0", fontSize: "13px", color: isDark ? "#94a3b8" : "#64748b" }}>
                      Block emergency dispatch assignments and record administrative status.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="animatedCloseButton"
                  onClick={() => !isSubmitting && setSuspendModalOpen(false)}
                  disabled={isSubmitting}
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "50%",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                    backgroundColor: isDark ? "#1e293b" : "#ffffff",
                    color: isDark ? "#f8fafc" : "#475569",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Responder Summary Card */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "14px",
                  backgroundColor: isDark ? "#172338" : "#f8fafc",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    backgroundColor: isDark ? "#1e293b" : "#e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "800",
                    fontSize: "15px",
                    color: isDark ? "#4ade80" : "#15803d",
                    flexShrink: 0,
                  }}
                >
                  {getResponderFullName(targetResponder).slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: "800", fontSize: "14.5px", color: isDark ? "#f8fafc" : "#0f172a" }}>
                    {getResponderFullName(targetResponder)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px", fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>
                    <span>Dept: <strong>{(targetResponder.department || "GENERAL").toUpperCase()}</strong></span>
                    {targetResponder.unit_name && <span>• Unit: <strong>{targetResponder.unit_name}</strong></span>}
                  </div>
                </div>
              </div>

              {/* Reason for Suspension */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "700",
                    color: isDark ? "#f8fafc" : "#0f172a",
                    marginBottom: "8px",
                  }}
                >
                  Reason for Suspension <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Administrative review / policy breach documentation..."
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    borderRadius: "12px",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid #cbd5e1",
                    backgroundColor: isDark ? "#0f172a" : "#ffffff",
                    color: isDark ? "#f8fafc" : "#0f172a",
                    padding: "12px 14px",
                    fontSize: "13.5px",
                    lineHeight: "1.45",
                    outline: "none",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />

                {/* Quick Presets */}
                <div style={{ marginTop: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Standard Administrative Grounds:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                    {quickReasons.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          if (!suspensionReason.trim()) {
                            setSuspensionReason(preset);
                          } else if (!suspensionReason.includes(preset)) {
                            setSuspensionReason(`${suspensionReason.trim()}; ${preset}`);
                          }
                        }}
                        style={{
                          fontSize: "11.5px",
                          fontWeight: "600",
                          padding: "4px 9px",
                          borderRadius: "8px",
                          border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0",
                          backgroundColor: isDark ? "#172338" : "#f1f5f9",
                          color: isDark ? "#cbd5e1" : "#475569",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Suspension Duration */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "700",
                    color: isDark ? "#f8fafc" : "#0f172a",
                    marginBottom: "8px",
                  }}
                >
                  Suspension Term & Schedule
                </label>

                <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsIndefinite(true);
                      setSuspendedUntil("");
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: "700",
                      cursor: "pointer",
                      border: isIndefinite
                        ? (isDark ? "1.5px solid rgba(239, 68, 68, 0.6)" : "1.5px solid #f87171")
                        : (isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0"),
                      backgroundColor: isIndefinite
                        ? (isDark ? "rgba(239, 68, 68, 0.18)" : "#fef2f2")
                        : (isDark ? "#172338" : "#ffffff"),
                      color: isIndefinite
                        ? (isDark ? "#f87171" : "#dc2626")
                        : (isDark ? "#94a3b8" : "#64748b"),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <Clock size={15} />
                    <span>Indefinite Suspension</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsIndefinite(false);
                      if (!suspendedUntil) {
                        const nextWeek = new Date();
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        nextWeek.setHours(17, 0, 0, 0);
                        setSuspendedUntil(nextWeek.toISOString());
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: "700",
                      cursor: "pointer",
                      border: !isIndefinite
                        ? (isDark ? "1.5px solid #4ade80" : "1.5px solid #15803d")
                        : (isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0"),
                      backgroundColor: !isIndefinite
                        ? (isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4")
                        : (isDark ? "#172338" : "#ffffff"),
                      color: !isIndefinite
                        ? (isDark ? "#4ade80" : "#15803d")
                        : (isDark ? "#94a3b8" : "#64748b"),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <Calendar size={15} />
                    <span>Temporary (Defined End Date)</span>
                  </button>
                </div>

                {!isIndefinite && (
                  <div style={{ marginTop: "4px" }}>
                    <CustomSuspensionDatePicker
                      value={suspendedUntil}
                      onChange={(iso) => setSuspendedUntil(iso)}
                      isDark={isDark}
                    />

                    {suspendedUntil && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginTop: "8px",
                          padding: "9px 12px",
                          borderRadius: "10px",
                          backgroundColor: isDark ? "rgba(34, 197, 94, 0.12)" : "#f0fdf4",
                          border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #bbf7d0",
                          fontSize: "12px",
                          color: isDark ? "#86efac" : "#15803d",
                        }}
                      >
                        <Shield size={14} style={{ flexShrink: 0 }} />
                        <span>
                          Suspension scheduled to conclude on{" "}
                          <strong>{formatDateTime(suspendedUntil)}</strong>.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "6px",
                  paddingTop: "14px",
                  borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                }}
              >
                <button
                  type="button"
                  onClick={() => setSuspendModalOpen(false)}
                  disabled={isSubmitting}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: "700",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                    backgroundColor: isDark ? "#1e293b" : "#ffffff",
                    color: isDark ? "#cbd5e1" : "#475569",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmSuspension}
                  disabled={isSubmitting || !suspensionReason.trim()}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: "800",
                    border: "none",
                    backgroundColor: !suspensionReason.trim()
                      ? (isDark ? "#334155" : "#cbd5e1")
                      : (isDark ? "#ef4444" : "#dc2626"),
                    color: "#ffffff",
                    cursor: isSubmitting || !suspensionReason.trim() ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader className="animate-spin" size={15} />
                      <span>Suspending...</span>
                    </>
                  ) : (
                    <>
                      <UserX size={15} />
                      <span>Confirm Suspension</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
