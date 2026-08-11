import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

export default function DashboardMap({ reports = [], sos = [] }) {
  const validReports = useMemo(() => 
    reports.filter(r => r.latitude && r.longitude && r.status?.toLowerCase() !== 'resolved' && r.status?.toLowerCase() !== 'false_alarm'), 
  [reports]);
  
  const validSos = useMemo(() => 
    sos.filter(s => s.latitude && s.longitude && s.status?.toLowerCase() !== 'resolved'), 
  [sos]);

  return (
    <div style={{ width: '100%', height: '450px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155', position: 'relative' }}>
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
      </MapContainer>
    </div>
  );
}
