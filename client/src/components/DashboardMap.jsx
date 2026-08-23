import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, GeoJSON, Tooltip } from 'react-leaflet';
import lagonglongGeoJSON from '../lagonglong_boundary.json';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const style = document.createElement('style');
style.textContent = `
  .barangay-label {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    color: #4f46e5;
    font-weight: bold;
    font-size: 10px;
    text-shadow: 1px 1px 2px rgba(255,255,255,0.9), -1px -1px 2px rgba(255,255,255,0.9), 1px -1px 2px rgba(255,255,255,0.9), -1px 1px 2px rgba(255,255,255,0.9);
  }
  .barangay-label::before {
    display: none !important;
  }
`;
document.head.appendChild(style);

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
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      left: -12px;
      top: -12px;
      position: relative;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 4px 10px rgba(0,0,0,0.4);
      color: white;
      font-weight: bold;
      font-size: 14px;
      z-index: 999;
    ">
      🚑
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
  const distance = R * c * 1.3; // 1.3 tortuosity factor to account for road routing
  
  const timeHours = distance / speedKmh;
  const timeMinutes = Math.round(timeHours * 60);
  
  return {
    distance: distance.toFixed(2), // km
    eta: timeMinutes < 1 ? "< 1 min" : `${timeMinutes} min`
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
              // Step 1: Fly directly to the new report and ZOOM IN very close (level 17)
              map.flyTo([latest.latitude, latest.longitude], 17, { 
                duration: 2.0,
                animate: true
              });

              // Step 2: After arriving and pausing briefly, slowly ZOOM OUT to provide context
              timeout2 = setTimeout(() => {
                if (map && isMounted) {
                  try {
                    map.flyTo([latest.latitude, latest.longitude], 12, { 
                      duration: 4.0, // Slow, dramatic zoom out
                      animate: true
                    });
                  } catch (e) {
                    console.warn("Map zoom out interrupted", e);
                  }
                }
              }, 3500); // 2s flight + 1.5s pause at street level
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

  return null;
}

export default function DashboardMap({ reports = [], sos = [], responders = [], dispatches = [], backupRequests = [] }) {
  const validReports = useMemo(() => {
    const activeDispatches = dispatches.filter(d => d.status?.toLowerCase() !== 'resolved');
    const activeIncidentIds = new Set(activeDispatches.map(d => d.incident_id).filter(id => !!id));
    return reports.filter(r => 
      r.latitude && r.longitude && 
      (r.status?.toLowerCase() !== 'resolved' || activeIncidentIds.has(r.id)) && 
      r.status?.toLowerCase() !== 'false_alarm'
    );
  }, [reports, dispatches]);
  
  const validSos = useMemo(() => {
    const activeDispatches = dispatches.filter(d => d.status?.toLowerCase() !== 'resolved');
    const activeSosIds = new Set(activeDispatches.map(d => d.sos_id).filter(id => !!id));
    return sos.filter(s => 
      s.latitude && s.longitude && 
      (s.status?.toLowerCase() !== 'resolved' || activeSosIds.has(s.id))
    );
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

  return (
    <div style={{ width: '100%', height: '100%', flex: 1, borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155', position: 'relative' }}>
      <style>{`
        @keyframes radar-pulse-map {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(3.5); opacity: 0; }
        }
      `}</style>
      
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)',
        color: '#f8fafc', padding: '12px', borderRadius: '8px',
        fontSize: '12px', fontWeight: 'bold', display: 'flex',
        flexDirection: 'column', gap: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }}></div>
          🚨 ACTIVE SOS
        </div>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', width: '100%' }}></div>
        <div style={{ fontSize: '10px', color: '#94a3b8' }}>DYNAMIC INCIDENT TYPES:</div>
        {Array.from(new Set(validReports.map(r => r.type || r.incident_type || r.category || 'Unknown'))).map(type => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: stringToColor(type) }}></div>
            <span style={{ textTransform: 'capitalize' }}>{type}</span>
          </div>
        ))}
        {validReports.length === 0 && (
          <div style={{ color: '#64748b' }}>No active incidents.</div>
        )}
      </div>

      <MapContainer 
        center={COMMAND_CENTER}
        zoom={13} 
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
      >
        <MapFlyToListener reports={validReports} sos={validSos} />
        
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />

        {/* LAGONGLONG MUNICIPAL BOUNDARY */}
        <GeoJSON 
          data={lagonglongGeoJSON}
          style={{
            color: '#6366f1',
            weight: 2,
            fillOpacity: 0.05,
            dashArray: '5, 5'
          }}
          onEachFeature={(feature, layer) => {
            if (feature.properties && feature.properties.NAME_3) {
              layer.bindTooltip(feature.properties.NAME_3, {
                permanent: true,
                direction: 'center',
                className: 'barangay-label'
              });
            }
          }}
        />
        
        {validReports.map(report => {
          const typeLabel = report.type || report.incident_type || report.category || "Unknown";
          const color = stringToColor(typeLabel);
          
          return (
            <Marker 
              key={`report-${report.id}`} 
              position={[report.latitude, report.longitude]}
              icon={createCustomIcon(color, false)}
            >
              <Popup>
                <div style={{ fontWeight: 'bold', color: color, textTransform: 'capitalize', fontSize: '14px', marginBottom: '4px' }}>
                  {typeLabel}
                </div>
                <div style={{ fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
                  <strong>Status:</strong> {report.status}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {new Date(report.created).toLocaleString()}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {validSos.map(s => (
          <Marker 
            key={`sos-${s.id}`} 
            position={[s.latitude, s.longitude]}
            icon={createCustomIcon('#ef4444', true)}
          >
            <Popup>
              <div style={{ fontWeight: 'bold', color: '#ef4444', fontSize: '14px', marginBottom: '4px' }}>
                🚨 ACTIVE SOS
              </div>
              <div style={{ fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
                <strong>User:</strong> {s.expand?.user?.name || "Unknown"}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {new Date(s.created).toLocaleString()}
              </div>
            </Popup>
          </Marker>
        ))}

        {validBackups.map(b => {
          const reqName = b.expand?.requester_id?.unit_name || b.expand?.requester_id?.first_name || "Unit";
          return (
            <Marker 
              key={`backup-${b.id}`} 
              position={[b.latitude, b.longitude]}
              icon={createCustomIcon('#f59e0b', true)}
            >
              <Popup>
                <div style={{ fontWeight: 'bold', color: '#f59e0b', fontSize: '14px', marginBottom: '4px' }}>
                  ⚠️ BACKUP REQUEST
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
        })}

        {dispatches.map(dispatch => {
          if (dispatch.status === 'resolved') return null;
          
          const responder = responders.find(r => r.id === dispatch.responder_id);
          if (!responder || !responder.latitude || !responder.longitude) return null;
          
          let target = validReports.find(r => r.id === dispatch.incident_id);
          let isSosTarget = false;
          
          if (!target) {
            target = validSos.find(s => s.id === dispatch.sos_id);
            if (target) isSosTarget = true;
          }
          
          if (!target || !target.latitude || !target.longitude) return null; 
          
          const metrics = calculateDistanceAndETA(responder.latitude, responder.longitude, target.latitude, target.longitude);
          
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
        })}
      </MapContainer>
    </div>
  );
}
