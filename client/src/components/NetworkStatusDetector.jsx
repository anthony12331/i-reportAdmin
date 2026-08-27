import React, { useState, useEffect, useCallback, useRef } from "react";
import { WifiOff, Wifi, RefreshCw, CheckCircle2, X } from "lucide-react";
import { useTheme } from "../themes/ThemeContext";
import { pb } from "../config/pocketbase";

export default function NetworkStatusDetector() {
  const { isDark } = useTheme();
  
  // Status states: 'online' | 'offline'
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const prevStatusRef = useRef(true);
  const restoredTimeoutRef = useRef(null);

  // Ping probe to test true internet connectivity
  const checkConnectivity = useCallback(async () => {
    setIsChecking(true);

    // 1. Fast browser check
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOnline(false);
      setIsChecking(false);
      return;
    }

    let reachable = false;

    // 2. Ping reliable public endpoints with timeout
    const testEndpoints = [
      "https://cloudflare.com/cdn-cgi/trace",
      "https://dns.google/resolve?name=google.com",
      "https://httpbin.org/status/200",
      "https://www.google.com/generate_204"
    ];

    try {
      reachable = await Promise.any(
        testEndpoints.map(async (url) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          try {
            await fetch(`${url}?_t=${Date.now()}`, {
              method: "HEAD",
              mode: "no-cors",
              cache: "no-store",
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return true;
          } catch (e) {
            clearTimeout(timeoutId);
            throw e;
          }
        })
      );
    } catch {
      reachable = false;
    }

    // 3. Also check local server connection
    if (reachable) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const baseUrl = pb.baseUrl || window.location.origin;
        const res = await fetch(`${baseUrl}/api/health?_t=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok && res.status !== 200 && res.status !== 404) {
          reachable = false;
        }
      } catch {
        reachable = false;
      }
    }

    setIsChecking(false);
    setIsOnline(reachable);
    if (!reachable) {
      setIsDismissed(false);
    }
  }, []);

  // Track transitions to show 'Restored' notification
  useEffect(() => {
    if (!prevStatusRef.current && isOnline) {
      setShowRestoredNotice(true);
      if (restoredTimeoutRef.current) clearTimeout(restoredTimeoutRef.current);
      restoredTimeoutRef.current = setTimeout(() => {
        setShowRestoredNotice(false);
      }, 3500);
    }
    prevStatusRef.current = isOnline;
  }, [isOnline]);

  // Event Listeners for browser online/offline + window focus + periodic heartbeat
  useEffect(() => {
    const handleOnline = () => {
      checkConnectivity();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsDismissed(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleOnline);

    // Initial check
    checkConnectivity();

    // Periodic Heartbeat check every 15 seconds
    const interval = setInterval(() => {
      checkConnectivity();
    }, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleOnline);
      clearInterval(interval);
      if (restoredTimeoutRef.current) clearTimeout(restoredTimeoutRef.current);
    };
  }, [checkConnectivity]);

  // Don't render anything if online and no restored toast is active
  if (isOnline && !showRestoredNotice) {
    return null;
  }

  if (isDismissed && !showRestoredNotice) {
    // Render a minimal floating pill badge at bottom right when dismissed so the user still knows
    return (
      <button
        type="button"
        onClick={() => setIsDismissed(false)}
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 100000,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 14px",
          borderRadius: "30px",
          backgroundColor: "#ef4444",
          color: "#ffffff",
          border: "2px solid #ffffff",
          boxShadow: "0 8px 24px rgba(239, 68, 68, 0.45)",
          fontSize: "12px",
          fontWeight: "800",
          cursor: "pointer",
        }}
        title="Click to view connection status"
      >
        <WifiOff size={15} />
        <span>No Internet</span>
      </button>
    );
  }

  const isRestored = showRestoredNotice && isOnline;

  // Palette tokens
  const bgColor = isRestored
    ? (isDark ? "rgba(20, 83, 45, 0.95)" : "#f0fdf4")
    : (isDark ? "rgba(127, 29, 29, 0.95)" : "#fef2f2");

  const borderColor = isRestored
    ? (isDark ? "rgba(34, 197, 94, 0.4)" : "#bbf7d0")
    : (isDark ? "rgba(239, 68, 68, 0.4)" : "#fecaca");

  const textColor = isRestored
    ? (isDark ? "#f0fdf4" : "#14532d")
    : (isDark ? "#fef2f2" : "#7f1d1d");

  const subTextColor = isRestored
    ? (isDark ? "#86efac" : "#15803d")
    : (isDark ? "#fca5a5" : "#991b1b");

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100000,
        maxWidth: "520px",
        width: "calc(100% - 40px)",
        animation: "slideDownNetBanner 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
      role="alert"
      aria-live="assertive"
    >
      <style>{`
        @keyframes slideDownNetBanner {
          from { transform: translate(-50%, -30px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes spinNet {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
          padding: "14px 18px",
          borderRadius: "14px",
          backgroundColor: bgColor,
          border: `1px solid ${borderColor}`,
          backdropFilter: "blur(12px)",
          boxShadow: isDark
            ? "0 20px 45px rgba(0, 0, 0, 0.65), 0 4px 12px rgba(0, 0, 0, 0.4)"
            : "0 10px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)",
          color: textColor,
          fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
        }}
      >
        {/* Left icon and message */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              backgroundColor: isRestored
                ? (isDark ? "rgba(34, 197, 94, 0.25)" : "#dcfce7")
                : (isDark ? "rgba(239, 68, 68, 0.25)" : "#fee2e2"),
              color: isRestored ? "#22c55e" : "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {isRestored ? (
              <CheckCircle2 size={20} />
            ) : (
              <WifiOff size={20} />
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: "800", fontSize: "14px", letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>
                {isRestored
                  ? "Connection Restored"
                  : "No Internet Connection"}
              </span>
              {!isRestored && (
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block" }} />
              )}
            </div>
            <div style={{ fontSize: "12px", color: subTextColor, marginTop: "2px", lineHeight: "1.4" }}>
              {isRestored
                ? "You are back online. Real-time updates reconnected."
                : "Please check your network connection and try again."}
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {!isRestored && (
            <button
              type="button"
              onClick={checkConnectivity}
              disabled={isChecking}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: isDark ? "#ef4444" : "#dc2626",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: "800",
                cursor: isChecking ? "not-allowed" : "pointer",
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
                transition: "all 0.15s ease",
              }}
              title="Check connection"
            >
              <RefreshCw size={13} style={{ animation: isChecking ? "spinNet 0.7s linear infinite" : "none" }} />
              <span>{isChecking ? "Checking..." : "Retry"}</span>
            </button>
          )}

          {!isRestored && (
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              style={{
                background: "none",
                border: "none",
                color: textColor,
                opacity: 0.7,
                cursor: "pointer",
                padding: "6px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Dismiss banner"
              aria-label="Dismiss banner"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

