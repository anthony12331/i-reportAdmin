import React, { useState, useEffect, useCallback, useRef } from "react";
import { WifiOff, RefreshCw, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { pb } from "../config/pocketbase";

export default function NetworkStatusModal() {
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showRestoredToast, setShowRestoredToast] = useState(false);
  const wasOfflineRef = useRef(!navigator.onLine);

  // Check actual network connectivity using external probe + navigator.onLine
  const verifyConnection = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOffline(true);
      wasOfflineRef.current = true;
      setIsChecking(false);
      return false;
    }

    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      // Probe public internet endpoints with mode: 'no-cors' (fails instantly when Wi-Fi/data is off)
      await Promise.any([
        fetch(`https://www.google.com/favicon.ico?_=${Date.now()}`, {
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        }),
        fetch(`https://www.cloudflare.com/favicon.ico?_=${Date.now()}`, {
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        }),
      ]);

      clearTimeout(timeoutId);

      if (wasOfflineRef.current) {
        setShowRestoredToast(true);
        setTimeout(() => setShowRestoredToast(false), 3800);
      }
      wasOfflineRef.current = false;
      setIsOffline(false);
      setIsDismissed(false);
      setIsChecking(false);
      return true;
    } catch {
      setIsOffline(true);
      wasOfflineRef.current = true;
      setIsChecking(false);
      return false;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      verifyConnection();
    };

    const handleOffline = () => {
      setIsOffline(true);
      wasOfflineRef.current = true;
      setIsDismissed(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Run immediate check on mount
    verifyConnection();

    // Fast heartbeat every 3.5 seconds to detect immediate Wi-Fi / connection cuts
    const heartbeatInterval = setInterval(() => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsOffline(true);
        wasOfflineRef.current = true;
      } else {
        verifyConnection();
      }
    }, 3500);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(heartbeatInterval);
    };
  }, [verifyConnection]);

  return (
    <>
      {/* 1. RESTORED CONNECTION TOAST */}
      {showRestoredToast && (
        <div
          className="network-restored-toast"
          style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 18px",
            borderRadius: "12px",
            backgroundColor: "#15803d",
            color: "#ffffff",
            boxShadow: "0 10px 25px -5px rgba(21, 128, 61, 0.4)",
            fontSize: "13.5px",
            fontWeight: "700",
            animation: "modalPopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          <CheckCircle2 size={18} color="#4ade80" />
          <span>Connection Restored — Back Online</span>
        </div>
      )}

      {/* 2. PERSISTENT TOP BANNER (WHEN USER DISMISSED MODAL BUT STILL OFFLINE) */}
      {isOffline && isDismissed && (
        <div
          className="network-offline-banner"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 999990,
            backgroundColor: "#b91c1c",
            color: "#ffffff",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "13px",
            fontWeight: "700",
            boxShadow: "0 4px 12px rgba(185, 28, 28, 0.3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <WifiOff size={16} />
            <span>You are offline. Live emergency telemetry and real-time updates are paused.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={verifyConnection}
              disabled={isChecking}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                border: "1px solid rgba(255, 255, 255, 0.35)",
                color: "#ffffff",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "800",
                cursor: isChecking ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <RefreshCw size={12} className={isChecking ? "animate-spin" : ""} />
              <span>{isChecking ? "Checking..." : "Retry"}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDismissed(false)}
              style={{
                backgroundColor: "transparent",
                border: "none",
                color: "#ffffff",
                textDecoration: "underline",
                fontSize: "12px",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              View Details
            </button>
          </div>
        </div>
      )}

      {/* 3. FULL BLOCKING OFFLINE MODAL POPUP */}
      {isOffline && !isDismissed && (
        <div
          className="network-modal-overlay lightboxModalBackdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            className="network-modal-card lightboxModalCard"
            style={{
              width: "100%",
              maxWidth: "460px",
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              padding: "28px 24px",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.4)",
              border: "1px solid #fee2e2",
              textAlign: "center",
              position: "relative",
            }}
          >
            {/* Close / Dismiss Button */}
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              title="Dismiss modal and continue in offline mode"
              aria-label="Dismiss modal"
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color 0.15s ease",
              }}
            >
              <X size={18} />
            </button>

            {/* Offline Icon Badge with Pulsing Ring */}
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "22px",
                backgroundColor: "#fef2f2",
                border: "1.5px solid #fecaca",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px",
                boxShadow: "0 8px 20px rgba(220, 38, 38, 0.15)",
                position: "relative",
              }}
            >
              <WifiOff size={34} strokeWidth={2.3} />
            </div>

            {/* Modal Title */}
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "800",
                color: "#0f172a",
                margin: "0 0 8px",
                letterSpacing: "-0.02em",
              }}
            >
              No Internet Connection
            </h2>

            {/* Description */}
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                margin: "0 0 20px",
                lineHeight: "1.5",
              }}
            >
              Your device is currently offline or disconnected from Wi-Fi / cellular network. Live emergency telemetry, dispatch routing, and data sync are temporarily paused.
            </p>

            {/* Tips Card */}
            <div
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "12px 14px",
                marginBottom: "22px",
                textAlign: "left",
                fontSize: "12.5px",
                color: "#475569",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", color: "#0f172a" }}>
                <AlertTriangle size={14} color="#d97706" />
                <span>Quick Troubleshooting:</span>
              </div>
              <span style={{ paddingLeft: "20px" }}>• Verify Wi-Fi network or Ethernet connection</span>
              <span style={{ paddingLeft: "20px" }}>• Ensure mobile data/hotspot is active</span>
              <span style={{ paddingLeft: "20px" }}>• Reconnection will automatically resume telemetry</span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
              <button
                type="button"
                onClick={verifyConnection}
                disabled={isChecking}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "none",
                  backgroundColor: "#15803d",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: "800",
                  cursor: isChecking ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 14px rgba(21, 128, 61, 0.28)",
                  transition: "all 0.16s ease",
                }}
              >
                <RefreshCw size={16} className={isChecking ? "animate-spin" : ""} />
                <span>{isChecking ? "Verifying Connection..." : "Check Connection Again"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDismissed(true)}
                style={{
                  width: "100%",
                  padding: "9px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                  color: "#64748b",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Dismiss & Browse Cached Data
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
