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

const getDialogTone = (message, variant) => {
  const text = String(message || "").toLowerCase();

  if (variant === "confirm") {
    return {
      icon: ShieldAlert,
      accent: "#ef4444",
      title: "Confirm Action",
      primaryLabel: "Confirm",
      primaryBg: "#d32f2f",
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
    accent: "#3b82f6",
    title: "System Message",
    primaryLabel: "OK",
    primaryBg: "#1a1c23",
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
  const tone = getDialogTone(dialog.message, dialog.variant);
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
      style={styles.overlay}
      role="presentation"
      onMouseDown={() => isConfirm && onClose(false)}
    >
      <div
        style={{ ...styles.dialog, borderTopColor: tone.accent }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-box-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div style={styles.header}>
          <div
            style={{
              ...styles.iconWrap,
              backgroundColor: `${tone.accent}18`,
              color: tone.accent,
            }}
          >
            <Icon size={24} />
          </div>
          <button
            type="button"
            style={styles.closeBtn}
            onClick={() => onClose(isConfirm ? false : true)}
            aria-label="Close message"
          >
            <X size={18} />
          </button>
        </div>

        <h2 id="message-box-title" style={styles.title}>
          {dialog.title || tone.title}
        </h2>
        <p style={styles.message}>{String(dialog.message || "")}</p>

        <div style={styles.actions}>
          {isConfirm && (
            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => onClose(false)}
            >
              {dialog.secondaryLabel || "Cancel"}
            </button>
          )}
          <button
            type="button"
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
    backgroundColor: "rgba(15, 23, 42, 0.62)",
    backdropFilter: "blur(8px)",
  },
  dialog: {
    width: "100%",
    maxWidth: "430px",
    borderTop: "5px solid #3b82f6",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    boxShadow: "0 24px 70px rgba(0, 0, 0, 0.32)",
    padding: "24px",
    fontFamily: "Inter, Arial, sans-serif",
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


