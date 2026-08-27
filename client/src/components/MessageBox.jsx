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

// ...

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

const getDialogTone = (message, variant, toneOverride) => {
  const text = String(message || "").toLowerCase();

  if (toneOverride === "app") {
    return {
      icon: ShieldAlert,
      accent: "#18864b",
      title: "Confirm Action",
      primaryLabel: "Confirm",
      primaryBg: "#18864b",
    };
  }

  if (variant === "confirm") {
    return {
      icon: ShieldAlert,
      accent: "#18864b",
      title: "Confirm Action",
      primaryLabel: "Confirm",
      primaryBg: "#18864b",
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
      accent: "#10b981",
      title: "System Notice",
      primaryLabel: "OK",
      primaryBg: "#10b981",
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
      primaryBg: "#d32f2f",
    };
  }

  return {
    icon: Info,
    accent: "#18864b",
    title: "System Message",
    primaryLabel: "OK",
    primaryBg: "#18864b",
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
  const { isDark } = useTheme();
  const tone = getDialogTone(dialog.message, dialog.variant, dialog.tone);
  const Icon = tone.icon;
  const isConfirm = dialog.variant === "confirm";

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="messageBoxOverlay"
      style={styles.overlay}
      role="presentation"
      onMouseDown={() => isConfirm && onClose(false)}
    >
      <div
        className="messageBoxDialog"
        style={{
          ...styles.dialog,
          borderTopColor: tone.accent,
          backgroundColor: isDark ? "#131c2e" : "#ffffff",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "none",
          borderTop: `5px solid ${tone.accent}`,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-box-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div style={styles.header}>
          <div
            style={{
              ...styles.iconWrap,
              backgroundColor: isDark ? `${tone.accent}25` : `${tone.accent}18`,
              color: tone.accent,
            }}
          >
            <Icon size={24} />
          </div>
          <button
            type="button"
            className="messageBoxCloseBtn animatedCloseButton"
            style={{
              ...styles.closeBtn,
              backgroundColor: isDark ? "#1e293b" : "#f9fafb",
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#e5e7eb",
              color: isDark ? "#cbd5e1" : "#4b5563",
            }}
            onClick={() => onClose(isConfirm ? false : true)}
            aria-label="Close message"
          >
            <X size={18} />
          </button>
        </div>

        <h2 id="message-box-title" style={{ ...styles.title, color: isDark ? "#f8fafc" : "#111827" }}>
          {dialog.title || tone.title}
        </h2>
        <p style={{ ...styles.message, color: isDark ? "#94a3b8" : "#4b5563" }}>
          {String(dialog.message || "")}
        </p>

        <div style={styles.actions}>
          {isConfirm && (
            <button
              type="button"
              className="messageBoxSecondaryBtn"
              style={{
                ...styles.secondaryBtn,
                backgroundColor: isDark ? "#172338" : "#ffffff",
                borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "#d1d5db",
                color: isDark ? "#cbd5e1" : "#374151",
              }}
              onClick={() => onClose(false)}
            >
              {dialog.secondaryLabel || "Cancel"}
            </button>
          )}
          <button
            type="button"
            className="messageBoxPrimaryBtn"
            style={{ ...styles.primaryBtn, backgroundColor: tone.primaryBg }}
            onClick={() => onClose(true)}
          >
            {dialog.primaryLabel || tone.primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 20000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    backgroundColor: "rgba(24, 95, 53, 0.42)",
    backdropFilter: "blur(8px)",
    animation: "messageBoxOverlayIn 180ms ease-out both",
  },
  dialog: {
    width: "100%",
    maxWidth: "430px",
    borderTop: "5px solid #18864b",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    boxShadow: "0 24px 70px rgba(0, 0, 0, 0.32)",
    padding: "24px",
    fontFamily: "Inter, Arial, sans-serif",
    animation: "messageBoxDialogIn 220ms cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  iconWrap: {
    width: "48px",
    height: "48px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    width: "36px",
    height: "36px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    backgroundColor: "#f9fafb",
    color: "#4b5563",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    margin: 0,
    color: "#111827",
    fontSize: "20px",
    fontWeight: 800,
  },
  message: {
    margin: "10px 0 0",
    color: "#4b5563",
    fontSize: "14px",
    lineHeight: 1.6,
    whiteSpace: "pre-line",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "24px",
  },
  primaryBtn: {
    minWidth: "96px",
    padding: "11px 18px",
    border: "none",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryBtn: {
    minWidth: "96px",
    padding: "11px 18px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    color: "#374151",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
  },
};


