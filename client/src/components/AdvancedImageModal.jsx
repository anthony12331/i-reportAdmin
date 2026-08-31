import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  RefreshCw,
  Download,
  X,
  Move,
  Maximize2,
  Minimize2,
  FileImage,
} from "lucide-react";

export default function AdvancedImageModal({
  src,
  alt = "Image Preview",
  title,
  onClose,
}) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const isVideo =
    typeof src === "string" &&
    (src.match(/\.(mp4|mov|avi|webm|ogg)(\?.*)?$/i) || src.includes("video"));

  // Reset transform state
  const handleReset = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 6));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.4));
  }, []);

  // Rotation controls
  const handleRotateCw = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleRotateCcw = useCallback(() => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY * -0.0015;
    setScale((prevScale) => {
      const newScale = Math.min(Math.max(prevScale + delta, 0.4), 6);
      return Number(newScale.toFixed(2));
    });
  }, []);

  // Mouse drag panning (when zoomed or freely)
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only main left click
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        handleZoomOut();
      } else if (e.key === "r" || e.key === "R") {
        handleRotateCw();
      } else if (e.key === "0") {
        handleReset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, handleZoomIn, handleZoomOut, handleRotateCw, handleReset]);

  // Attach non-passive wheel event listener to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  if (!src) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(3, 7, 18, 0.92)",
        backdropFilter: "blur(12px)",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        userSelect: "none",
        animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      onMouseUp={handleMouseUp}
    >
      {/* Top Header Bar */}
      <header
        style={{
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "rgba(15, 23, 42, 0.8)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              backgroundColor: "rgba(34, 197, 94, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4ade80",
            }}
          >
            <FileImage size={18} />
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                color: "#f8fafc",
                fontSize: "15px",
                fontWeight: "700",
              }}
            >
              {title || alt || "Image Inspection Workspace"}
            </h3>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: "12px",
                color: "#94a3b8",
              }}
            >
              Scroll mouse wheel to Zoom in/out • Click & Drag to Pan • Rotate 90°
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <a
            href={src}
            download={title || "inspection-image.jpg"}
            target="_blank"
            rel="noopener noreferrer"
            title="Download Original Image File"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              borderRadius: "8px",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#f8fafc",
              fontSize: "12.5px",
              fontWeight: "600",
              textDecoration: "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Download size={15} />
            <span>Download</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            title="Close Preview (Esc)"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              backgroundColor: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              color: "#f87171",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Main Interactive Stage */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isVideo ? "default" : isDragging ? "grabbing" : "grab",
        }}
      >
        {isVideo ? (
          <video
            src={src}
            controls
            autoPlay
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              borderRadius: "12px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75)",
            }}
          />
        ) : (
          <div
            style={{
              transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${scale})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.15s ease-out",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={src}
              alt={alt}
              draggable={false}
              style={{
                width: "auto",
                height: "auto",
                minWidth: "min(560px, 88vw)",
                minHeight: "min(400px, 68vh)",
                maxWidth: "88vw",
                maxHeight: "78vh",
                objectFit: "contain",
                borderRadius: "12px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.85)",
                pointerEvents: "none",
              }}
            />
          </div>
        )}
      </div>

      {/* Floating Bottom Manipulation Toolbar */}
      {!isVideo && (
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(15, 23, 42, 0.88)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "16px",
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
            zIndex: 20,
          }}
        >
          {/* Zoom Out Button */}
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out (-)"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#f8fafc",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <ZoomOut size={16} />
          </button>

          {/* Zoom Scale Display */}
          <span
            style={{
              color: "#4ade80",
              fontSize: "13px",
              fontWeight: "800",
              minWidth: "55px",
              textAlign: "center",
              fontFamily: "monospace",
            }}
          >
            {Math.round(scale * 100)}%
          </span>

          {/* Zoom In Button */}
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In (+)"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#f8fafc",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <ZoomIn size={16} />
          </button>

          <div
            style={{
              width: "1px",
              height: "22px",
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              margin: "0 4px",
            }}
          />

          {/* Rotate Counter-Clockwise */}
          <button
            type="button"
            onClick={handleRotateCcw}
            title="Rotate Left 90°"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#f8fafc",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <RotateCcw size={16} />
          </button>

          {/* Rotate Clockwise */}
          <button
            type="button"
            onClick={handleRotateCw}
            title="Rotate Right 90° (R)"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#f8fafc",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <RotateCw size={16} />
          </button>

          <div
            style={{
              width: "1px",
              height: "22px",
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              margin: "0 4px",
            }}
          />

          {/* Reset Transforms */}
          <button
            type="button"
            onClick={handleReset}
            title="Reset View (0)"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "0 10px",
              height: "34px",
              borderRadius: "8px",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#cbd5e1",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <RefreshCw size={14} />
            <span>Reset</span>
          </button>
        </div>
      )}
    </div>
  );
}
