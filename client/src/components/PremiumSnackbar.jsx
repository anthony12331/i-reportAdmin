import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  Flame,
  Radio,
  Car,
  Ambulance,
  Shield,
  CloudRain,
  X,
} from "lucide-react";
import { useTheme } from "../themes/ThemeContext";

const SnackbarContext = createContext(null);

const THEMES = {
  // Fire / Flame Emergency (Red)
  fire: {
    bg: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    glow: "rgba(220, 38, 38, 0.4)",
    icon: Flame,
    btnBg: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    btnShadow: "0 4px 14px rgba(239, 68, 68, 0.35)",
  },
  emergency: {
    bg: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    glow: "rgba(220, 38, 38, 0.4)",
    icon: Flame,
    btnBg: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    btnShadow: "0 4px 14px rgba(239, 68, 68, 0.35)",
  },

  // Vehicular / Traffic / Road Accident (Emerald / Green)
  accident: {
    bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    glow: "rgba(16, 185, 129, 0.4)",
    icon: Car,
    btnBg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    btnShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
  },
  traffic: {
    bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    glow: "rgba(16, 185, 129, 0.4)",
    icon: Car,
    btnBg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    btnShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
  },

  // Medical / Health / Ambulance (Vibrant Orange)
  medical: {
    bg: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    glow: "rgba(249, 115, 22, 0.4)",
    icon: Ambulance,
    btnBg: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    btnShadow: "0 4px 14px rgba(249, 115, 22, 0.35)",
  },
  health: {
    bg: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    glow: "rgba(249, 115, 22, 0.4)",
    icon: Ambulance,
    btnBg: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    btnShadow: "0 4px 14px rgba(249, 115, 22, 0.35)",
  },

  // Flood / Weather / Calamity / Landslide (Ocean Blue / Cyan)
  calamity: {
    bg: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
    glow: "rgba(2, 132, 199, 0.4)",
    icon: ShieldAlert,
    btnBg: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
    btnShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
  },
  flood: {
    bg: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
    glow: "rgba(2, 132, 199, 0.4)",
    icon: CloudRain,
    btnBg: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
    btnShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
  },

  // Police / Crime / Security / Disturbance (Indigo / Purple)
  police: {
    bg: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
    glow: "rgba(99, 102, 241, 0.4)",
    icon: Shield,
    btnBg: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
    btnShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
  },
  crime: {
    bg: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
    glow: "rgba(99, 102, 241, 0.4)",
    icon: Shield,
    btnBg: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
    btnShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
  },

  // Emergency SOS (Rose / Crimson)
  sos: {
    bg: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
    glow: "rgba(225, 29, 72, 0.45)",
    icon: Radio,
    btnBg: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
    btnShadow: "0 4px 14px rgba(244, 63, 94, 0.35)",
  },

  // Warning / Backup Request (Amber)
  warning: {
    bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    glow: "rgba(245, 158, 11, 0.4)",
    icon: AlertTriangle,
    btnBg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    btnShadow: "0 4px 14px rgba(245, 158, 11, 0.35)",
  },

  // Success (Green)
  success: {
    bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    glow: "rgba(16, 185, 129, 0.35)",
    icon: CheckCircle2,
    btnBg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    btnShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
  },

  // Info / Notice (Sky Blue)
  info: {
    bg: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
    glow: "rgba(14, 165, 233, 0.35)",
    icon: Info,
    btnBg: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
    btnShadow: "0 4px 14px rgba(14, 165, 233, 0.35)",
  },

  purple: {
    bg: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
    glow: "rgba(139, 92, 246, 0.35)",
    icon: Bell,
    btnBg: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
    btnShadow: "0 4px 14px rgba(139, 92, 246, 0.35)",
  },
};

export function SnackbarProvider({ children }) {
  const [snackbars, setSnackbars] = useState([]);

  const removeSnackbar = useCallback((id) => {
    setSnackbars((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showSnackbar = useCallback((options) => {
    if (!options) return null;
    const title = options.title || "Notification Alert";
    const message = options.message || "";

    const id = `snackbar-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newSnackbar = {
      id,
      title,
      message,
      type: options.type || "purple",
      actionLabel: options.actionLabel || "View Details",
      onAction: options.onAction || null,
      duration: typeof options.duration === "number" ? options.duration : 6000,
      createdAt: Date.now(),
    };

    setSnackbars((prev) => {
      // Prevent duplicate snackbar if one with the identical title and message is already showing
      const alreadyExists = prev.some(
        (item) => item.title === title && item.message === message
      );
      if (alreadyExists) {
        return prev;
      }
      return [newSnackbar, ...prev.slice(0, 4)];
    });

    return id;
  }, []);

  // Listen to global window event for convenience
  useEffect(() => {
    const handleGlobalSnackbar = (e) => {
      if (e.detail) {
        showSnackbar(e.detail);
      }
    };
    window.addEventListener("show-premium-snackbar", handleGlobalSnackbar);
    return () => window.removeEventListener("show-premium-snackbar", handleGlobalSnackbar);
  }, [showSnackbar]);

  return (
    <SnackbarContext.Provider value={{ showSnackbar, removeSnackbar }}>
      {children}
      <div className="premium-snackbar-stack">
        {snackbars.map((item) => (
          <SnackbarItem key={item.id} item={item} onDismiss={() => removeSnackbar(item.id)} />
        ))}
      </div>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error("useSnackbar must be used within a SnackbarProvider");
  }
  return context;
}

function SnackbarItem({ item, onDismiss }) {
  const { isDark } = useTheme();
  const theme = THEMES[item.type] || THEMES.purple;
  const IconComponent = theme.icon;
  const [progress, setProgress] = useState(100);
  const [isHovered, setIsHovered] = useState(false);
  const startTimeRef = useRef(Date.now());
  const remainingTimeRef = useRef(item.duration);

  useEffect(() => {
    if (item.duration <= 0) return;

    let intervalId;
    let animFrameId;

    const updateProgress = () => {
      if (isHovered) return;
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, remainingTimeRef.current - elapsed);
      const percent = (remaining / item.duration) * 100;
      setProgress(percent);

      if (remaining <= 0) {
        onDismiss();
      }
    };

    intervalId = setInterval(updateProgress, 50);
    return () => {
      clearInterval(intervalId);
      cancelAnimationFrame(animFrameId);
    };
  }, [item.duration, isHovered, onDismiss]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    startTimeRef.current = Date.now();
  };

  const handleActionClick = () => {
    if (typeof item.onAction === "function") {
      item.onAction();
    }
    onDismiss();
  };

  return (
    <div
      className="premium-snackbar"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        display: "flex",
        alignItems: "stretch",
        borderRadius: "18px",
        overflow: "hidden",
        background: theme.bg,
        boxShadow: isDark
          ? `0 20px 45px -8px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.1), 0 8px 24px -4px ${theme.glow}`
          : `0 20px 40px -10px ${theme.glow}, 0 0 0 1px rgba(0, 0, 0, 0.05)`,
        width: "min(430px, calc(100vw - 32px))",
        position: "relative",
        userSelect: "none",
        animation: "premiumSnackbarSlideIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
    >
      {/* Left Icon Section */}
      <div
        className="premium-snackbar-left"
        style={{
          width: "68px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "50%",
            backgroundColor: "rgba(255, 255, 255, 0.22)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
          }}
        >
          <IconComponent size={20} />
        </div>
      </div>

      {/* Right Content Box */}
      <div
        className="premium-snackbar-right"
        style={{
          flex: 1,
          backgroundColor: isDark ? "#131c2e" : "#ffffff",
          borderRadius: "16px",
          margin: "3px 3px 3px 0",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Text Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            style={{
              margin: 0,
              fontSize: "13.5px",
              fontWeight: "800",
              color: isDark ? "#f8fafc" : "#0f172a",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.title}
          </h4>
          {item.message && (
            <p
              style={{
                margin: "3px 0 0 0",
                fontSize: "12px",
                fontWeight: "500",
                color: isDark ? "#94a3b8" : "#64748b",
                lineHeight: "1.35",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {item.message}
            </p>
          )}
        </div>

        {/* Action Button & Close Icon */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <button
            type="button"
            className="premium-snackbar-btn"
            onClick={handleActionClick}
            style={{
              background: theme.btnBg,
              color: "#ffffff",
              border: "none",
              borderRadius: "20px",
              padding: "7px 15px",
              fontSize: "11.5px",
              fontWeight: "800",
              cursor: "pointer",
              boxShadow: theme.btnShadow,
              transition: "all 0.18s ease",
              whiteSpace: "nowrap",
            }}
          >
            {item.actionLabel || "View Details"}
          </button>

          <button
            type="button"
            onClick={onDismiss}
            title="Dismiss"
            style={{
              background: "none",
              border: "none",
              padding: "4px",
              cursor: "pointer",
              color: isDark ? "#64748b" : "#94a3b8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Countdown Progress Bar */}
        {item.duration > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "3px",
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: theme.btnBg,
                transition: "width 50ms linear",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
