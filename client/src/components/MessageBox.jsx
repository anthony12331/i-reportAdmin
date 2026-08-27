/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  X,
} from "lucide-react";
import { useTheme } from "../themes/ThemeContext";

const MessageBoxContext = createContext(null);

function createUniqueId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `dialog-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const getDialogTone = (message, variant, toneOverride, isDark = false) => {
  const text = String(message || "").toLowerCase();

  if (toneOverride === "app" || variant === "confirm") {
    return {
      icon: ShieldAlert,
      accent: isDark ? "#4ade80" : "#15803d",
      title: "Confirm Action",
      primaryLabel: "Confirm",
      primaryBg: isDark ? "#16a34a" : "#15803d",
    };
  }

  if (
    text.includes("success") ||
    text.includes("successful") ||
    text.includes("complete") ||
    text.includes("verified")
  ) {
    return {
      icon: CheckCircle2,
      accent: isDark ? "#4ade80" : "#10b981",
      title: "System Notice",
      primaryLabel: "OK",
      primaryBg: isDark ? "#16a34a" : "#10b981",
    };
  }

  if (
    text.includes("error") ||
    text.includes("failed") ||
    text.includes("denied") ||
    text.includes("security")
  ) {
    return {
      icon: AlertTriangle,
      accent: "#ef4444",
      title: "System Alert",
      primaryLabel: "OK",
      primaryBg: "#dc2626",
    };
  }

  return {
    icon: Info,
    accent: isDark ? "#38bdf8" : "#0284c7",
    title: "System Message",
    primaryLabel: "OK",
    primaryBg: isDark ? "#0284c7" : "#0284c7",
  };
};

export function MessageBoxProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const activeDialog = queue[0] || null;

  const closeDialog = useCallback((result) => {
    setQueue((currentQueue) => {
      const [currentDialog, ...remainingDialogs] = currentQueue;
      currentDialog?.resolve?.(result);
      return remainingDialogs;
    });
  }, []);

  const openDialog = useCallback((options) => {
    return new Promise((resolve) => {
      setQueue((currentQueue) => [
        ...currentQueue,
        {
          ...options,
          id: createUniqueId(),
          resolve,
        },
      ]);
    });
  }, []);

  const alert = useCallback(
    (message, options = {}) => {
      openDialog({
        message,
        variant: "alert",
        title: options.title,
        primaryLabel: options.primaryLabel,
      });
    },
    [openDialog],
  );

  const confirm = useCallback(
    (message, options = {}) => {
      return openDialog({
        message,
        variant: "confirm",
        title: options.title,
        primaryLabel: options.primaryLabel || "Confirm",
        secondaryLabel: options.secondaryLabel || "Cancel",
        tone: options.tone,
      });
    },
    [openDialog],
  );

  useEffect(() => {
    const nativeAlert = window.alert;

    window.alert = (message) => {
      alert(message);
    };

    return () => {
      window.alert = nativeAlert;
    };
  }, [alert]);

  const contextValue = useMemo(() => ({ alert, confirm }), [alert, confirm]);

  return (
    <MessageBoxContext.Provider value={contextValue}>
      {children}
      {activeDialog && (
        <MessageDialog dialog={activeDialog} onClose={closeDialog} />
      )}
    </MessageBoxContext.Provider>
  );
}

export function useMessageBox() {
  const context = useContext(MessageBoxContext);
  if (!context) {
    throw new Error("useMessageBox must be used inside MessageBoxProvider");
  }

  return context;
}

function MessageDialog({ dialog, onClose }) {
  let isDark = false;
  try {
    const themeCtx = useTheme();
    isDark = themeCtx?.isDark || false;
  } catch {
    isDark = document.documentElement.classList.contains("dark");
  }

  const tone = getDialogTone(dialog.message, dialog.variant, dialog.tone, isDark);
  const Icon = tone.icon;
  const isConfirm = dialog.variant === "confirm";
  const [secHovered, setSecHovered] = useState(false);
  const [priHovered, setPriHovered] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const dialogStyles = {
    overlay: {
      position: "fixed",
      inset: 0,
      zIndex: 20000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      backgroundColor: isDark ? "rgba(0, 0, 0, 0.7)" : "rgba(15, 23, 42, 0.45)",
      backdropFilter: "blur(8px)",
      animation: "messageBoxOverlayIn 180ms ease-out both",
    },
    dialog: {
      width: "100%",
      maxWidth: "420px",
      borderRadius: "14px",
      backgroundColor: isDark ? "#111827" : "#ffffff",
      border: isDark ? "1px solid #1f2937" : "1px solid #e2e8f0",
      borderTop: `4px solid ${tone.accent}`,
      boxShadow: isDark
        ? "0 25px 60px -15px rgba(0, 0, 0, 0.85)"
        : "0 20px 45px -10px rgba(0, 0, 0, 0.15)",
      padding: "24px 26px",
      fontFamily: "'Plus Jakarta Sans', Inter, -apple-system, sans-serif",
      animation: "messageBoxDialogIn 220ms cubic-bezier(0.22, 1, 0.36, 1) both",
      boxSizing: "border-box",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "16px",
    },
    iconWrap: {
      width: "44px",
      height: "44px",
      borderRadius: "10px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDark ? "rgba(34, 197, 94, 0.15)" : "#f0fdf4",
      border: isDark ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid #dcfce7",
      color: tone.accent,
    },
    closeBtn: {
      width: "34px",
      height: "34px",
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
      borderRadius: "8px",
      backgroundColor: isDark ? "#1e293b" : "#f8fafc",
      color: isDark ? "#94a3b8" : "#64748b",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.15s ease",
    },
    title: {
      margin: 0,
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: "19px",
      fontWeight: "800",
      letterSpacing: "-0.02em",
    },
    message: {
      margin: "8px 0 0",
      color: isDark ? "#94a3b8" : "#64748b",
      fontSize: "14px",
      lineHeight: 1.55,
      whiteSpace: "pre-line",
    },
    actions: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "10px",
      marginTop: "22px",
    },
    primaryBtn: {
      minWidth: "96px",
      padding: "10px 18px",
      border: "none",
      borderRadius: "8px",
      backgroundColor: priHovered
        ? isDark
          ? "#15803d"
          : "#166534"
        : tone.primaryBg,
      color: "#ffffff",
      fontSize: "13.5px",
      fontWeight: "700",
      cursor: "pointer",
      transition: "all 0.15s ease",
      boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
    },
    secondaryBtn: {
      minWidth: "90px",
      padding: "10px 18px",
      border: isDark ? "1px solid #334155" : "1px solid #cbd5e1",
      borderRadius: "8px",
      backgroundColor: secHovered
        ? isDark
          ? "#28374d"
          : "#f8fafc"
        : isDark
          ? "#1e293b"
          : "#ffffff",
      color: isDark ? "#f1f5f9" : "#334155",
      fontSize: "13.5px",
      fontWeight: "700",
      cursor: "pointer",
      transition: "all 0.15s ease",
    },
  };

  return (
    <div
      className="messageBoxOverlay"
      style={dialogStyles.overlay}
      role="presentation"
      onMouseDown={() => isConfirm && onClose(false)}
    >
      <div
        className="messageBoxDialog"
        style={dialogStyles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-box-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div style={dialogStyles.header}>
          <div style={dialogStyles.iconWrap}>
            <Icon size={22} />
          </div>
          <button
            type="button"
            className="messageBoxCloseBtn animatedCloseButton"
            style={dialogStyles.closeBtn}
            onClick={() => onClose(isConfirm ? false : true)}
            aria-label="Close message"
          >
            <X size={17} />
          </button>
        </div>

        <h2 id="message-box-title" style={dialogStyles.title}>
          {dialog.title || tone.title}
        </h2>
        <p style={dialogStyles.message}>{String(dialog.message || "")}</p>

        <div style={dialogStyles.actions}>
          {isConfirm && (
            <button
              type="button"
              className="messageBoxSecondaryBtn"
              style={dialogStyles.secondaryBtn}
              onMouseEnter={() => setSecHovered(true)}
              onMouseLeave={() => setSecHovered(false)}
              onClick={() => onClose(false)}
            >
              {dialog.secondaryLabel || "Cancel"}
            </button>
          )}
          <button
            type="button"
            className="messageBoxPrimaryBtn"
            style={dialogStyles.primaryBtn}
            onMouseEnter={() => setPriHovered(true)}
            onMouseLeave={() => setPriHovered(false)}
            onClick={() => onClose(true)}
          >
            {dialog.primaryLabel || tone.primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
