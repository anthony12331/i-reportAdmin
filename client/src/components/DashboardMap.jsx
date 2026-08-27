import React, { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, GeoJSON, LayersControl } from 'react-leaflet';
import { Radio, Phone, ShieldAlert, Clock, CheckCircle2, Navigation, MapPin, Activity, Flame } from 'lucide-react';
// GeoJSON files are loaded lazily when the map mounts, not at app startup
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { dashboardStyles } from '../themes/dashboardStyles';
import { useTheme } from '../themes/ThemeContext';

const style = document.createElement('style');
style.textContent = `
  .barangay-label {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    color: #ffffff;
    font-weight: bold;
    font-size: 11px;
    letter-spacing: 0.5px;
    text-shadow: 1px 1px 3px #000, -1px -1px 3px #000, 1px -1px 3px #000, -1px 1px 3px #000, 0px 0px 5px rgba(0,0,0,1);
  }
  .barangay-label::before {
    display: none !important;
  }
`;
document.head.appendChild(style);

const getLagongStyle = (isDark) => ({
  color: isDark ? '#38bdf8' : '#3b82f6',
  weight: 2,
  fillColor: isDark ? '#0284c7' : '#3b82f6',
  fillOpacity: isDark ? 0.18 : 0.1,
});

const getBalingasagStyle = (isDark) => ({
  color: isDark ? '#fbbf24' : '#f59e0b',
  weight: 2,
  fillColor: isDark ? '#d97706' : '#f59e0b',
  fillOpacity: isDark ? 0.18 : 0.1,
});

const onEachBarangay = (feature, layer) => {
  if (feature.properties && feature.properties.NAME_3) {
    layer.bindTooltip(feature.properties.NAME_3, {
      permanent: true,
      direction: 'center',
      className: 'barangay-label'
    });
  }
};

const MAP_BOUNDS = [
  [8.60, 124.60], // South-West
  [8.90, 124.95]  // North-East
];

// Fix for default marker icon issues in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PALETTE = [
  '#f97316', '#3b82f6', '#eab308', '#10b981', 
  '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'
];

function stringToColor(str) {
  if (!str) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  return PALETTE[hash % PALETTE.length];
}

const createCustomIcon = (color, isSos = false) => {
  const markerHtml = `
    <div style="
      background-color: ${color};
      width: 20px;
      height: 20px;
      display: block;
      left: -10px;
      top: -10px;
      position: relative;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    ">
      ${isSos ? `<div style="
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background-color: ${color};
        animation: radar-pulse-map 1.5s infinite ease-out;
        z-index: -1;
        left: 0;
        top: 0;
      "></div>` : ''}
    </div>
  `;
  return L.divIcon({ className: '', html: markerHtml, iconSize: [0, 0] });
};

const createResponderIcon = () => {
  const markerHtml = `
    <div style="
      background-color: #2563eb;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      left: -13px;
      top: -13px;
      position: relative;
      border-radius: 50%;
      border: 2.5px solid white;
      box-shadow: 0 4px 10px rgba(0,0,0,0.35);
      color: white;
      z-index: 999;
    ">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
    </div>
  `;
  return L.divIcon({ className: '', html: markerHtml, iconSize: [0, 0] });
};

function calculateDistanceAndETA(lat1, lon1, lat2, lon2, speedKmh = 40) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distanceKm = R * c;
  const etaMinutes = Math.round((distanceKm / speedKmh) * 60);

  return {
    distanceKm: distanceKm.toFixed(2),
    etaMinutes: Math.max(1, etaMinutes)
  };
}

const COMMAND_CENTER = [8.8066, 124.788];

function MapFlyToListener({ reports, sos }) {
  const map = useMap();
  const prevLatestId = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let timeout1, timeout2;

    const allIncidents = [...reports, ...sos]
      .filter(i => i.latitude && i.longitude)
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    if (allIncidents.length > 0) {
      const latest = allIncidents[0];
      if (prevLatestId.current !== latest.id) {
        prevLatestId.current = latest.id;
        
        timeout1 = setTimeout(() => {
          if (map && isMounted) {
            try {
              map.flyTo([latest.latitude, latest.longitude], 17, { 
                duration: 2.0,
                animate: true
              });

              timeout2 = setTimeout(() => {
                if (map && isMounted) {
                  try {
                    map.flyTo([latest.latitude, latest.longitude], 12, { 
                      duration: 4.0,
                      animate: true
                    });
                  } catch (e) {
                    console.warn("Map zoom out interrupted", e);
                  }
                }
              }, 3500);
            } catch (e) {
              console.warn("Map flyTo interrupted", e);
            }
          }
        }, 300);
      }
    }

    return () => {
      isMounted = false;
      if (timeout1) clearTimeout(timeout1);
      if (timeout2) clearTimeout(timeout2);
    };
  }, [reports, sos, map]);

  useEffect(() => {
    if (!map) return;

    const invalidate = () => {
      try {
        map.invalidateSize();
      } catch (e) {}
    };

    invalidate();
    const t1 = setTimeout(invalidate, 100);
    const t2 = setTimeout(invalidate, 200);
    const t3 = setTimeout(invalidate, 320);

    const handleResize = () => {
      invalidate();
      setTimeout(invalidate, 150);
      setTimeout(invalidate, 320);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("leaflet-map-resize", handleResize);

    let resizeObserver = null;
    try {
      const container = map.getContainer();
      if (container && window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
          invalidate();
        });
        resizeObserver.observe(container);
      }
    } catch (e) {
      console.warn("ResizeObserver initialization:", e);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("leaflet-map-resize", handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [map]);

  return null;
}

const PENDING_AND_ONGOING_STATUSES = [
  "new",
  "pending",
  "unassigned",
  "ongoing",
  "accepted",
  "en_route",
  "enroute",
  "at_scene",
  "atscene",
  "dispatched",
  "in_progress",
];

const renderStatusBadge = (status) => {
  const s = (status || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s === "pending" || s === "new") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#fef3c7", color: "#d97706", border: "1px solid #fde68a", padding: "2px 7px", borderRadius: "5px", fontSize: "11px", fontWeight: "800" }}>
        <Clock size={11} /> PENDING
      </span>
    );
  }
  if (s === "accepted") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", padding: "2px 7px", borderRadius: "5px", fontSize: "11px", fontWeight: "800" }}>
        <CheckCircle2 size={11} /> ACCEPTED
      </span>
    );
  }
  if (s === "enroute") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd", padding: "2px 7px", borderRadius: "5px", fontSize: "11px", fontWeight: "800" }}>
        <Navigation size={11} /> EN ROUTE
      </span>
    );
  }
  if (s === "atscene") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", padding: "2px 7px", borderRadius: "5px", fontSize: "11px", fontWeight: "800" }}>
        <MapPin size={11} /> AT SCENE
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", padding: "2px 7px", borderRadius: "5px", fontSize: "11px", fontWeight: "800" }}>
      <Activity size={11} /> {status?.toUpperCase() || "ONGOING"}
    </span>
  );
};

export default function DashboardMap({ reports = [], sos = [], responders = [], dispatches = [], backupRequests = [] }) {
  const { isDark } = useTheme();
  const [showStatusDetails, setShowStatusDetails] = useState(true);
  const [lagonglongGeoJSON, setLagonglongGeoJSON] = useState(null);
  const [balingasagGeoJSON, setBalingasagGeoJSON] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import('../lagonglong_boundary.json'),
      import('../balingasag_boundary.json'),
    ]).then(([lagong, balingasag]) => {
      if (!cancelled) {
        setLagonglongGeoJSON(lagong.default);
        setBalingasagGeoJSON(balingasag.default);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const validReports = useMemo(() => {
    const activeDispatches = dispatches.filter(d => (d.status || "").toLowerCase().trim() !== "resolved");
    const activeIncidentIds = new Set(activeDispatches.map(d => d.incident_id).filter(Boolean));

    return reports.filter(r => {
      if (!r.latitude || !r.longitude) return false;
      const s = (r.status || "").toLowerCase().trim();
      if (s === "resolved" || s === "false_alarm" || s === "cancelled") return false;
      return (
        PENDING_AND_ONGOING_STATUSES.includes(s) ||
        activeIncidentIds.has(r.id) ||
        (s !== "resolved" && s !== "false_alarm" && s !== "cancelled")
      );
    });
  }, [reports, dispatches]);

  const validSos = useMemo(() => {
    const activeDispatches = dispatches.filter(d => (d.status || "").toLowerCase().trim() !== "resolved");
    const activeSosIds = new Set(activeDispatches.map(d => d.sos_id).filter(Boolean));

    return sos.filter(s => {
      if (!s.latitude || !s.longitude) return false;
      const st = (s.status || "").toLowerCase().trim();
      if (st === "resolved" || st === "false_alarm" || st === "cancelled") return false;
      return (
        PENDING_AND_ONGOING_STATUSES.includes(st) ||
        activeSosIds.has(s.id) ||
        (st !== "resolved" && st !== "false_alarm" && st !== "cancelled")
      );
    });
  }, [sos, dispatches]);

  const validBackups = useMemo(() => {
    return backupRequests
      .filter(b => b.dispatch_status === 'pending')
      .map(b => {
        const lat = b.expand?.requester_id?.latitude || b.expand?.incident_id?.latitude || b.expand?.sos_id?.latitude;
        const lng = b.expand?.requester_id?.longitude || b.expand?.incident_id?.longitude || b.expand?.sos_id?.longitude;
        return { ...b, latitude: lat, longitude: lng };
      })
      .filter(b => b.latitude && b.longitude);
  }, [backupRequests]);

  const reportMarkers = useMemo(() => {
    return validReports.map(report => {
      const typeLabel = report.type || report.incident_type || report.category || "Incident";
      const color = stringToColor(typeLabel);
      const isOngoing = ["accepted", "en_route", "enroute", "at_scene", "atscene", "ongoing", "dispatched"].includes((report.status || "").toLowerCase().trim());
      
      return (
        <Marker 
          key={`report-${report.id}`} 
          position={[report.latitude, report.longitude]}
          icon={createCustomIcon(color, isOngoing)}
        >
          <Popup>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontWeight: '900', color: color, textTransform: 'uppercase', fontSize: '13.5px' }}>
                {typeLabel}
              </span>
              {renderStatusBadge(report.status)}
            </div>
            {report.description && (
              <div style={{ fontSize: '12px', color: '#0f172a', marginBottom: '6px', fontWeight: '500' }}>
                {report.description}
              </div>
            )}
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>
              Logged: {new Date(report.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(report.created).toLocaleDateString()}
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [validReports]);

  const sosMarkers = useMemo(() => {
    return validSos.map(s => {
      const citizen = s.expand?.user || s.expand?.users;
      const citizenName = citizen ? `${citizen.first_name || ""} ${citizen.last_name || ""}`.trim() || citizen.contact_number : (s.name || "Resident SOS");
      const isOngoing = ["accepted", "en_route", "enroute", "at_scene", "atscene", "ongoing", "dispatched"].includes((s.status || "").toLowerCase().trim());

      return (
        <Marker 
          key={`sos-${s.id}`} 
          position={[s.latitude, s.longitude]}
          icon={createCustomIcon('#ef4444', true)}
        >
          <Popup>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontWeight: '900', color: '#dc2626', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Radio size={14} /> {isOngoing ? "ONGOING SOS" : "ACTIVE SOS"}
              </span>
              {renderStatusBadge(s.status || "active")}
            </div>
            <div style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: '800', marginBottom: '2px' }}>
              {citizenName}
            </div>
            {citizen?.contact_number && (
              <div style={{ fontSize: '12px', color: '#334155', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={12} color="#64748b" /> {citizen.contact_number}
              </div>
            )}
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>
              Triggered: {new Date(s.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(s.created).toLocaleDateString()}
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [validSos]);

  const backupMarkers = useMemo(() => {
    return validBackups.map(b => {
      const reqName = b.expand?.requester_id?.unit_name || b.expand?.requester_id?.first_name || "Unit";
      return (
        <Marker 
          key={`backup-${b.id}`} 
          position={[b.latitude, b.longitude]}
          icon={createCustomIcon('#f59e0b', true)}
        >
          <Popup>
            <div style={{ fontWeight: 'bold', color: '#f59e0b', fontSize: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ShieldAlert size={14} /> BACKUP REQUEST
            </div>
            <div style={{ fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
              <strong>Requester:</strong> {reqName}
            </div>
            <div style={{ fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
              <strong>Reason:</strong> {b.reason || "Not specified"}
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [validBackups]);

  const dispatchPaths = useMemo(() => {
    return dispatches.map(dispatch => {
      const responder = responders.find(r => r.id === dispatch.responder_id);
      if (!responder || !responder.latitude || !responder.longitude) return null;

      let target = validReports.find(r => r.id === dispatch.incident_id);
      let isSosTarget = false;

      if (!target) {
        target = validSos.find(s => s.id === dispatch.sos_id || s.id === dispatch.incident_id);
        isSosTarget = true;
      }

      if (!target || !target.latitude || !target.longitude) return null;

      const metrics = calculateDistanceAndETA(
        responder.latitude, responder.longitude,
        target.latitude, target.longitude
      );

      return (
        <React.Fragment key={`dispatch-${dispatch.id}`}>
          <Polyline 
            positions={[[responder.latitude, responder.longitude], [target.latitude, target.longitude]]} 
            pathOptions={{ color: '#2563eb', dashArray: '5, 10', weight: 3, opacity: 0.8 }} 
          />
          <Marker 
            position={[responder.latitude, responder.longitude]}
            icon={createResponderIcon()}
            zIndexOffset={1000}
          >
            <Popup>
              <div style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '14px', marginBottom: '4px' }}>
                {responder.unit_name || `${responder.first_name} ${responder.last_name}`}
              </div>
              <div style={{ fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
                <strong>Dept:</strong> <span style={{ textTransform: 'capitalize' }}>{responder.department}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
                <strong>Target:</strong> <span style={{ textTransform: 'capitalize' }}>{isSosTarget ? 'SOS Alert' : (target.type || 'Incident')}</span>
              </div>
              <hr style={{ margin: '6px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
              <div style={{ fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
                <strong>Distance:</strong> {metrics.distance} km
              </div>
              <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 'bold' }}>
                <strong>ETA:</strong> {metrics.eta}
              </div>
            </Popup>
          </Marker>
        </React.Fragment>
      );
    });
  }, [dispatches, responders, validReports, validSos]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '430px', flex: 1, borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', position: 'relative' }}>
      <style>{`
        .leaflet-container {
          background: ${isDark ? '#0f172a' : '#f8fafc'};
          width: 100% !important;
          height: 100% !important;
          min-height: 430px !important;
        }
        @keyframes radar-pulse-map {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(3.5); opacity: 0; }
        }
      `}</style>
      
      <div style={dashboardStyles.mapOverlayPosition}>
        {showStatusDetails ? (
          <div className="dashboard-map-status-overlay" style={dashboardStyles.mapStatusPanel}>
            <button
              type="button"
              style={dashboardStyles.mapStatusHeaderButton}
              onClick={() => setShowStatusDetails(false)}
              aria-label="Collapse incident status"
            >
              <div style={dashboardStyles.mapStatusHeader}>
                <div style={dashboardStyles.mapStatusDot}></div>
                <span style={dashboardStyles.mapStatusTitle}>ACTIVE SOS</span>
              </div>
            </button>
            <div style={dashboardStyles.mapStatusDivider}></div>
            <div style={dashboardStyles.mapStatusLabel}>DYNAMIC INCIDENT TYPES</div>
            {Array.from(new Set(validReports.map(r => r.type || r.incident_type || r.category || 'Unknown'))).map(type => (
              <div key={type} style={dashboardStyles.mapStatusItem}>
                <div style={{ ...dashboardStyles.mapStatusTypeDot, background: stringToColor(type) }}></div>
                <span style={dashboardStyles.mapStatusType}>{type}</span>
              </div>
            ))}
            {validReports.length === 0 && (
              <div style={dashboardStyles.mapStatusEmpty}>No active incidents.</div>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="dashboard-map-status-collapsed"
            style={dashboardStyles.mapStatusCollapsed}
            onClick={() => setShowStatusDetails(true)}
            aria-label="Show incident status"
          >
            <span style={dashboardStyles.mapStatusDot}></span>
          </button>
        )}
      </div>

      <MapContainer 
        key={isDark ? 'map-dark' : 'map-light'}
        center={COMMAND_CENTER}
        zoom={13} 
        style={{ width: '100%', height: '100%', minHeight: '430px' }}
        scrollWheelZoom={true}
        maxBounds={MAP_BOUNDS}
        maxBoundsViscosity={0.8}
        minZoom={11}
        preferCanvas={true}
      >
        <MapFlyToListener reports={validReports} sos={validSos} />
        
        <LayersControl position="bottomleft">
          <LayersControl.BaseLayer checked name="Satellite View">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; Esri &copy; Earthstar Geographics'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Dark Tactical View">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap &copy; CARTO'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Standard View">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap &copy; CARTO'
            />
          </LayersControl.BaseLayer>

          {/* LAGONGLONG MUNICIPAL BOUNDARY */}
          {lagonglongGeoJSON && (
            <LayersControl.Overlay checked name="Lagonglong Area">
              <GeoJSON
                data={lagonglongGeoJSON}
                style={getLagongStyle(isDark)}
                onEachFeature={onEachBarangay}
              />
            </LayersControl.Overlay>
          )}

          {/* BALINGASAG MUNICIPAL BOUNDARY */}
          {balingasagGeoJSON && (
            <LayersControl.Overlay name="Balingasag Area">
              <GeoJSON
                data={balingasagGeoJSON}
                style={getBalingasagStyle(isDark)}
                onEachFeature={onEachBarangay}
              />
            </LayersControl.Overlay>
          )}
        </LayersControl>
        
        {reportMarkers}
        {sosMarkers}
        {backupMarkers}
        {dispatchPaths}
      </MapContainer>
    </div>
  );
}
