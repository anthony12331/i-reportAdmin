import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Flame,
  Ambulance,
  Car,
  ShieldAlert,
  Radio,
  CheckCircle2,
  Activity,
  Search,
  RotateCcw,
  ExternalLink,
  Shield,
  Clock,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import CustomDropdown from "../components/CustomDropdown";
import { useTheme } from "../themes/ThemeContext";
import { getReadableAddress } from "../utils/utils";

const COMMAND_CENTER = [8.8066, 124.788];
const MAP_BOUNDS = [
  [8.6, 124.6],
  [8.95, 124.95],
];

// Fix for default marker icon issues in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Simple Glowing Circle Dot Generator matching the clean dots design
function createMarkerIcon(incident) {
  const isResolved = incident.status?.toLowerCase() === "resolved";
  const isSos = incident.recordType === "sos";
  const type = (incident.type || "").toLowerCase();

  let mainColor = "#ef4444"; // Default Red
  let glowColor = "rgba(239, 68, 68, 0.6)";

  if (isResolved) {
    mainColor = "#10b981"; // Green
    glowColor = "rgba(16, 185, 129, 0.6)";
  } else if (isSos || type.includes("fire")) {
    mainColor = "#ef4444"; // Red (Fire & SOS)
    glowColor = "rgba(239, 68, 68, 0.65)";
  } else if (type.includes("traffic") || type.includes("accident") || type.includes("car") || type.includes("vehicular")) {
    mainColor = "#eab308"; // Yellow (Accident)
    glowColor = "rgba(234, 179, 8, 0.65)";
  } else if (type.includes("police") || type.includes("crime") || type.includes("security") || type.includes("pnp")) {
    mainColor = "#2563eb"; // Blue (Police)
    glowColor = "rgba(37, 99, 235, 0.65)";
  } else if (type.includes("landslide")) {
    mainColor = "#92400e"; // Brown (Landslide)
    glowColor = "rgba(146, 64, 14, 0.65)";
  } else if (type.includes("medical") || type.includes("health")) {
    mainColor = "#f97316"; // Orange (Medical)
    glowColor = "rgba(249, 115, 22, 0.65)";
  } else if (type.includes("flood") || type.includes("rescue")) {
    mainColor = "#0284c7"; // Cyan / Ocean (Flood)
    glowColor = "rgba(2, 132, 199, 0.65)";
  }

  const isPulsing = !isResolved;
  const dotSize = 20;

  const html = `
    <div style="
      position: relative;
      width: ${dotSize}px;
      height: ${dotSize}px;
      left: -${dotSize / 2}px;
      top: -${dotSize / 2}px;
      cursor: pointer;
    ">
      ${
        isPulsing
          ? `<div style="
              position: absolute;
              inset: -6px;
              border-radius: 50%;
              background-color: ${mainColor};
              opacity: 0.45;
              animation: mapPulse 1.8s infinite ease-out;
            "></div>`
          : ""
      }
      <div style="
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background-color: ${mainColor};
        box-shadow: 0 0 10px 3px ${glowColor}, 0 2px 6px rgba(0,0,0,0.5);
        border: 2px solid #ffffff;
        transition: transform 0.2s ease;
      "></div>
    </div>
  `;

  return L.divIcon({
    className: "custom-incident-dot",
    html,
    iconSize: [0, 0],
    popupAnchor: [0, -12],
  });
}

function MapViewController({ bounds, center }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.isValid && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (center) {
      map.setView(center, 13);
    }
  }, [bounds, center, map]);

  return null;
}

export default function IncidentMap() {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  // Telemetry State
  const [incidents, setIncidents] = useState([]);
  const [sosList, setSosList] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [boundaryGeoJSON, setBoundaryGeoJSON] = useState(null);

  // Filters State
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'ongoing' | 'resolved' | 'sos'
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [resolvedAddresses, setResolvedAddresses] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapWrapperRef = useRef(null);

  // Fullscreen Handler
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      if (mapWrapperRef.current?.requestFullscreen) {
        mapWrapperRef.current.requestFullscreen().catch((err) => {
          console.warn("Fullscreen request error:", err);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn("Exit fullscreen error:", err);
        });
      }
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 100);
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 300);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // 1. Lazy load Lagonglong GeoJSON Boundary
  useEffect(() => {
    let cancelled = false;
    import("../lagonglong_boundary.json")
      .then((mod) => {
        if (!cancelled) setBoundaryGeoJSON(mod.default);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Fetch Incidents & SOS from PocketBase
  const fetchMapData = useCallback(async () => {
    setLoading(true);
    try {
      const [incidentRecords, sosRecords, dispatchRecords] = await Promise.all([
        pb.collection("incident_reports").getFullList({
          sort: "-created",
          expand: "users",
          requestKey: null,
        }),
        pb.collection("sos_tracking").getFullList({
          sort: "-created",
          expand: "user,assigned_responder",
          requestKey: null,
        }),
        pb.collection("dispatches").getFullList({
          expand: "responder_id",
          requestKey: null,
        }),
      ]);

      setIncidents(incidentRecords);
      setSosList(sosRecords);
      setDispatches(dispatchRecords);

      // Pre-resolve reverse geocoding addresses for incidents with coordinates
      const validCoords = [...incidentRecords, ...sosRecords].filter(
        (item) => item.latitude && item.longitude
      );

      const addressMap = {};
      await Promise.all(
        validCoords.slice(0, 30).map(async (item) => {
          try {
            const addr = await getReadableAddress(item.latitude, item.longitude);
            addressMap[item.id] = addr;
          } catch {
            addressMap[item.id] = `Coordinates: ${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`;
          }
        })
      );
      setResolvedAddresses(addressMap);
    } catch (error) {
      console.error("Failed to load incident map data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time PocketBase subscription
  useEffect(() => {
    let isMounted = true;
    let unsubIncidents;
    let unsubSos;
    let unsubDispatches;

    fetchMapData();

    const setupSubscriptions = async () => {
      try {
        unsubIncidents = await pb.collection("incident_reports").subscribe("*", (e) => {
          if (!isMounted) return;
          if (e.action === "create") setIncidents((prev) => [e.record, ...prev]);
          else if (e.action === "update")
            setIncidents((prev) => prev.map((item) => (item.id === e.record.id ? e.record : item)));
          else if (e.action === "delete")
            setIncidents((prev) => prev.filter((item) => item.id !== e.record.id));
        });

        unsubSos = await pb.collection("sos_tracking").subscribe("*", (e) => {
          if (!isMounted) return;
          if (e.action === "create") setSosList((prev) => [e.record, ...prev]);
          else if (e.action === "update")
            setSosList((prev) => prev.map((item) => (item.id === e.record.id ? e.record : item)));
          else if (e.action === "delete")
            setSosList((prev) => prev.filter((item) => item.id !== e.record.id));
        });

        unsubDispatches = await pb.collection("dispatches").subscribe("*", () => {
          if (isMounted) fetchMapData();
        });
      } catch (err) {
        console.warn("Map realtime subscription error:", err);
      }
    };

    setupSubscriptions();

    return () => {
      isMounted = false;
      unsubIncidents?.();
      unsubSos?.();
      unsubDispatches?.();
    };
  }, [fetchMapData]);

  // Group All Incident Data
  const unifiedIncidents = useMemo(() => {
    const regular = incidents.map((item) => ({
      ...item,
      recordType: "incident",
      title: item.type || "Incident Report",
    }));

    const sos = sosList.map((item) => ({
      ...item,
      recordType: "sos",
      type: "SOS Distress",
      title: "SOS Distress Emergency",
    }));

    return [...regular, ...sos];
  }, [incidents, sosList]);

  // Apply User Filters
  const filteredIncidents = useMemo(() => {
    return unifiedIncidents.filter((item) => {
      // Coordinate validity check
      if (!item.latitude || !item.longitude) return false;

      const isResolved = item.status?.toLowerCase() === "resolved";
      const isSos = item.recordType === "sos";

      // 1. Status Filter
      if (statusFilter === "ongoing" && (isResolved || isSos)) return false;
      if (statusFilter === "resolved" && !isResolved) return false;
      if (statusFilter === "sos" && !isSos) return false;

      // 2. Incident Type Filter
      if (typeFilter !== "all") {
        if (typeFilter === "sos" && !isSos) return false;
        if (typeFilter !== "sos" && (item.type || "").toLowerCase() !== typeFilter.toLowerCase())
          return false;
      }

      // 3. Search Filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const address = (resolvedAddresses[item.id] || item.location || item.barangay || "").toLowerCase();
        const idMatch = (item.id || "").toLowerCase().includes(term);
        const typeMatch = (item.type || "").toLowerCase().includes(term);
        const citizen = (
          item.expand?.users?.first_name ||
          item.expand?.user?.first_name ||
          item.citizen_name ||
          ""
        ).toLowerCase();

        if (!address.includes(term) && !idMatch && !typeMatch && !citizen.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedIncidents, statusFilter, typeFilter, searchTerm, resolvedAddresses]);

  // Simple Metrics Counters
  const metrics = useMemo(() => {
    const total = unifiedIncidents.filter((i) => i.latitude && i.longitude).length;
    const ongoing = unifiedIncidents.filter(
      (i) => i.status?.toLowerCase() !== "resolved" && i.recordType !== "sos" && i.latitude && i.longitude
    ).length;
    const resolved = unifiedIncidents.filter(
      (i) => i.status?.toLowerCase() === "resolved" && i.latitude && i.longitude
    ).length;
    const activeSos = unifiedIncidents.filter(
      (i) => i.recordType === "sos" && i.status?.toLowerCase() !== "resolved" && i.latitude && i.longitude
    ).length;

    return { total, ongoing, resolved, activeSos };
  }, [unifiedIncidents]);

  // Calculate Map Bounds
  const mapBounds = useMemo(() => {
    if (filteredIncidents.length === 0) return null;
    const latLngs = filteredIncidents.map((i) => [i.latitude, i.longitude]);
    return L.latLngBounds(latLngs);
  }, [filteredIncidents]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        backgroundColor: isDark ? "#090d16" : "#f8fafc",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        overflow: "hidden",
      }}
    >
      <Sidebar />

      <main
        ref={mapWrapperRef}
        style={{
          flex: 1,
          marginLeft: isFullscreen ? "0" : "216px",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100vh",
          padding: isFullscreen ? "0" : "20px 28px 24px 28px",
          boxSizing: "border-box",
          position: "relative",
          backgroundColor: isDark ? "#090d16" : "#f8fafc",
          overflow: "hidden",
        }}
      >
        {/* Simple & Clean Header */}
        {!isFullscreen && (
          <header
            style={{
              marginBottom: "16px",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              flexShrink: 0,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: isDark ? "#4ade80" : "#15803d",
                    boxShadow: "0 0 10px rgba(74, 222, 128, 0.5)",
                  }}
                />
                <h1
                  style={{
                    fontSize: "22px",
                    fontWeight: "800",
                    color: isDark ? "#f8fafc" : "#14532d",
                    margin: 0,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Incidents Map
                </h1>
              </div>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "13px",
                  color: isDark ? "#94a3b8" : "#64748b",
                }}
              >
                Satellite map view of all active emergencies, responder dispatches, and resolved incidents in Lagonglong.
              </p>
            </div>

            {/* Quick Counter Summary */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "6px 14px",
                  borderRadius: "12px",
                  backgroundColor: isDark ? "#172338" : "#ffffff",
                  border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <MapIcon size={15} color={isDark ? "#38bdf8" : "#0284c7"} />
                <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600" }}>
                  Total:{" "}
                  <strong style={{ color: isDark ? "#f8fafc" : "#0f172a", fontSize: "13px" }}>
                    {metrics.total}
                  </strong>
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "6px 14px",
                  borderRadius: "12px",
                  backgroundColor: isDark ? "rgba(245, 158, 11, 0.16)" : "#fffbeb",
                  border: isDark ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid #fef3c7",
                }}
              >
                <Activity size={15} color={isDark ? "#fbbf24" : "#d97706"} />
                <span style={{ fontSize: "12px", color: isDark ? "#fbbf24" : "#b45309", fontWeight: "700" }}>
                  Active: {metrics.ongoing}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "6px 14px",
                  borderRadius: "12px",
                  backgroundColor: isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4",
                  border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #bbf7d0",
                }}
              >
                <CheckCircle2 size={15} color={isDark ? "#4ade80" : "#15803d"} />
                <span style={{ fontSize: "12px", color: isDark ? "#4ade80" : "#15803d", fontWeight: "700" }}>
                  Resolved: {metrics.resolved}
                </span>
              </div>

              {metrics.activeSos > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "6px 14px",
                    borderRadius: "12px",
                    backgroundColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fef2f2",
                    border: isDark ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid #fecaca",
                    animation: "urgentPulse 1.5s infinite",
                  }}
                >
                  <Radio size={15} color={isDark ? "#f87171" : "#b91c1c"} />
                  <span style={{ fontSize: "12px", color: isDark ? "#f87171" : "#b91c1c", fontWeight: "800" }}>
                    Active SOS: {metrics.activeSos}
                  </span>
                </div>
              )}
            </div>
          </header>
        )}

        {/* Map Card Holder */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            borderRadius: isFullscreen ? "0" : "16px",
            border: isFullscreen ? "none" : (isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0"),
            boxShadow: isFullscreen ? "none" : (isDark ? "0 8px 30px rgba(0,0,0,0.35)" : "0 4px 20px -2px rgba(0, 0, 0, 0.05)"),
            overflow: "hidden",
            backgroundColor: isDark ? "#131c2e" : "#ffffff",
            position: "relative",
          }}
        >
          {/* Clean Single-Row Filter Toolbar */}
          <div
            style={{
              padding: "10px 18px",
              backgroundColor: isDark ? "#131c2e" : "#ffffff",
              borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexShrink: 0,
              zIndex: 1001,
              overflow: "visible",
            }}
          >
          {/* Status Segment Pills */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            {[
              { id: "all", label: "All", count: metrics.total },
              { id: "ongoing", label: "Active", count: metrics.ongoing, color: "#f59e0b" },
              { id: "resolved", label: "Resolved", count: metrics.resolved, color: "#10b981" },
              { id: "sos", label: "SOS Calls", count: metrics.activeSos, color: "#ef4444" },
            ].map((btn) => {
              const active = statusFilter === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setStatusFilter(btn.id)}
                  style={{
                    padding: "5px 11px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: active ? "700" : "600",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    border: active
                      ? `1.5px solid ${btn.color || (isDark ? "#4ade80" : "#15803d")}`
                      : isDark
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "1px solid #cbd5e1",
                    backgroundColor: active
                      ? isDark
                        ? "#1e293b"
                        : "#f0fdf4"
                      : isDark
                      ? "#131c2e"
                      : "#ffffff",
                    color: active
                      ? btn.color || (isDark ? "#4ade80" : "#15803d")
                      : isDark
                      ? "#94a3b8"
                      : "#64748b",
                    boxShadow: active ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  <span>{btn.label}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "0.5px 5px",
                      borderRadius: "10px",
                      backgroundColor: active
                        ? isDark
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(21,128,61,0.12)"
                        : isDark
                        ? "rgba(255,255,255,0.06)"
                        : "#f1f5f9",
                      color: active ? (btn.color || (isDark ? "#4ade80" : "#15803d")) : "inherit",
                    }}
                  >
                    {btn.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search, Type Dropdown, Fullscreen & Reset in one clean group */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            {/* Search Box */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 10px",
                borderRadius: "8px",
                backgroundColor: isDark ? "#131c2e" : "#f8fafc",
                border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #cbd5e1",
                width: "200px",
              }}
            >
              <Search size={14} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search place or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: "12px",
                  backgroundColor: "transparent",
                  color: isDark ? "#f8fafc" : "#0f172a",
                  width: "100%",
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Custom Type Filter Dropdown */}
            <CustomDropdown
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              options={[
                { value: "all", label: "All Types" },
                { value: "fire", label: "Fire" },
                { value: "medical", label: "Medical" },
                { value: "traffic", label: "Traffic" },
                { value: "flood", label: "Flood" },
                { value: "sos", label: "SOS" },
              ]}
              minWidth="120px"
              size="sm"
            />

            {/* Reset Filter Button */}
            {(statusFilter !== "all" || typeFilter !== "all" || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setSearchTerm("");
                }}
                title="Reset all filters"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "5px 8px",
                  borderRadius: "8px",
                  fontSize: "11.5px",
                  fontWeight: "600",
                  backgroundColor: "transparent",
                  border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #cbd5e1",
                  color: isDark ? "#94a3b8" : "#64748b",
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}

            {/* Fullscreen Toggle Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen (Esc)" : "Expand Map to Fullscreen"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 10px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                backgroundColor: isFullscreen ? "#15803d" : isDark ? "#1e293b" : "#f1f5f9",
                border: isFullscreen ? "1px solid #16a34a" : isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #cbd5e1",
                color: isFullscreen ? "#ffffff" : isDark ? "#f8fafc" : "#0f172a",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                transition: "all 0.18s ease",
              }}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span>{isFullscreen ? "Exit" : "Fullscreen"}</span>
            </button>
          </div>
        </div>

        {/* Satellite Map Container */}
        <div style={{ flex: 1, position: "relative", minHeight: 0, height: "100%" }}>

          <MapContainer
            center={COMMAND_CENTER}
            zoom={13}
            maxBounds={MAP_BOUNDS}
            minZoom={11}
            maxZoom={18}
            style={{ height: "100%", width: "100%" }}
            zoomControl={true}
          >
            {/* Pure Satellite View */}
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />

            {/* Barangay Boundaries Overlay (Cyan outline on satellite) */}
            {boundaryGeoJSON && (
              <GeoJSON
                data={boundaryGeoJSON}
                style={{
                  color: "#38bdf8",
                  weight: 2,
                  fillColor: "#0284c7",
                  fillOpacity: 0.08,
                  dashArray: "4, 4",
                }}
              />
            )}

            {/* Map Bounds Adjuster */}
            <MapViewController bounds={mapBounds} center={COMMAND_CENTER} />

            {/* Plotted Incident Markers */}
            {filteredIncidents.map((incident) => {
              const icon = createMarkerIcon(incident);
              const isResolved = incident.status?.toLowerCase() === "resolved";
              const isSos = incident.recordType === "sos";
              const locationDisplay =
                resolvedAddresses[incident.id] ||
                incident.location ||
                incident.barangay ||
                `Coordinates: ${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}`;

              // Find dispatches for this incident
              const incidentDispatches = dispatches.filter((d) =>
                isSos ? d.sos_id === incident.id : d.incident_id === incident.id
              );

              return (
                <Marker
                  key={`${incident.recordType}-${incident.id}`}
                  position={[incident.latitude, incident.longitude]}
                  icon={icon}
                >
                  <Popup minWidth={290} maxWidth={340} className="custom-incident-popup">
                    <div
                      style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        padding: "4px 2px",
                      }}
                    >
                      {/* Popup Header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          marginBottom: "8px",
                          borderBottom: "1px solid #e2e8f0",
                          paddingBottom: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: "800",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            backgroundColor: isResolved
                              ? "#f0fdf4"
                              : isSos
                              ? "#fef2f2"
                              : "#fffbeb",
                            color: isResolved
                              ? "#15803d"
                              : isSos
                              ? "#b91c1c"
                              : "#b45309",
                            border: isResolved
                              ? "1px solid #bbf7d0"
                              : isSos
                              ? "1px solid #fecaca"
                              : "1px solid #fef3c7",
                            textTransform: "uppercase",
                          }}
                        >
                          {isResolved ? "RESOLVED INCIDENT" : isSos ? "ACTIVE SOS CALL" : "ACTIVE EMERGENCY"}
                        </span>

                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "11px",
                            fontWeight: "700",
                            color: "#64748b",
                          }}
                        >
                          #{incident.id.slice(0, 8)}
                        </span>
                      </div>

                      {/* Incident Title */}
                      <h4
                        style={{
                          margin: "0 0 4px 0",
                          fontSize: "14px",
                          fontWeight: "800",
                          color: "#0f172a",
                        }}
                      >
                        {incident.type || (isSos ? "Emergency SOS Call" : "Incident Report")}
                      </h4>

                      {/* Location Address */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "6px",
                          fontSize: "12px",
                          color: "#334155",
                          marginBottom: "8px",
                          lineHeight: "1.4",
                        }}
                      >
                        <MapPin size={14} color="#15803d" style={{ flexShrink: 0, marginTop: "2px" }} />
                        <span>{locationDisplay}</span>
                      </div>

                      {/* Description if present */}
                      {incident.description && (
                        <p
                          style={{
                            margin: "0 0 8px 0",
                            fontSize: "11.5px",
                            color: "#64748b",
                            lineHeight: "1.4",
                            backgroundColor: "#f8fafc",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          {incident.description}
                        </p>
                      )}

                      {/* Dispatched Units Info */}
                      {incidentDispatches.length > 0 && (
                        <div
                          style={{
                            marginBottom: "8px",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            backgroundColor: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                          }}
                        >
                          <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#15803d", display: "block" }}>
                            Assigned Responders ({incidentDispatches.length}):
                          </span>
                          <div style={{ fontSize: "11px", color: "#166534", marginTop: "2px", fontWeight: "600" }}>
                            {incidentDispatches
                              .map(
                                (d) =>
                                  d.expand?.responder_id?.unit_name ||
                                  `${d.expand?.responder_id?.first_name || ""} ${d.expand?.responder_id?.last_name || ""}`.trim() ||
                                  d.department ||
                                  "Responder"
                              )
                              .join(", ")}
                          </div>
                        </div>
                      )}

                      {/* Timestamps */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "11px",
                          color: "#64748b",
                          marginBottom: "10px",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Clock size={12} />
                          {new Date(incident.created).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {isResolved && (
                          <span style={{ color: "#15803d", fontWeight: "700" }}>Resolved</span>
                        )}
                      </div>

                      {/* Action Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (isResolved) {
                            navigate(
                              isSos
                                ? `/resolved-incidents/sos/${incident.id}`
                                : `/resolved-incidents/${incident.id}`
                            );
                          } else if (isSos) {
                            navigate("/pending-sos");
                          } else {
                            navigate("/ongoing-incidents");
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "7px 12px",
                          borderRadius: "8px",
                          backgroundColor: "#15803d",
                          color: "#ffffff",
                          border: "none",
                          fontSize: "12px",
                          fontWeight: "700",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          boxShadow: "0 2px 6px rgba(21, 128, 61, 0.3)",
                        }}
                      >
                        <span>View Full Details</span>
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Simple Map Guide (Legend) */}
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              left: "20px",
              backgroundColor: isDark ? "rgba(19, 28, 46, 0.94)" : "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(8px)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "12px 16px",
              zIndex: 999,
              boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
              fontSize: "12px",
              color: isDark ? "#f8fafc" : "#0f172a",
              minWidth: "180px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: "800",
                color: isDark ? "#94a3b8" : "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: "8px",
              }}
            >
              Map Guide
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: "#ef4444",
                    display: "inline-block",
                    boxShadow: "0 0 6px #ef4444",
                  }}
                />
                <span style={{ fontSize: "11.5px", fontWeight: "600" }}>Fire / SOS (Red)</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: "#eab308",
                    display: "inline-block",
                    boxShadow: "0 0 6px #eab308",
                  }}
                />
                <span style={{ fontSize: "11.5px", fontWeight: "600" }}>Accident / Traffic (Yellow)</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: "#2563eb",
                    display: "inline-block",
                    boxShadow: "0 0 6px #2563eb",
                  }}
                />
                <span style={{ fontSize: "11.5px", fontWeight: "600" }}>Police & Security (Blue)</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: "#92400e",
                    display: "inline-block",
                    boxShadow: "0 0 6px #92400e",
                  }}
                />
                <span style={{ fontSize: "11.5px", fontWeight: "600" }}>Landslide Hazard (Brown)</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: "#10b981",
                    display: "inline-block",
                    boxShadow: "0 0 6px #10b981",
                  }}
                />
                <span style={{ fontSize: "11.5px", fontWeight: "600" }}>Resolved Incident (Green)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
);
}
