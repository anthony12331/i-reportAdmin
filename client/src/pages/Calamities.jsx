import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, LayersControl, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Sidebar from '../components/Sidebar';
import { useTheme } from '../themes/ThemeContext';
import { pb } from '../config/pocketbase';
import { Activity, Wind, AlertTriangle, Info, CloudRain, ChevronDown, ChevronUp, Layers, Waves, Megaphone, Radio } from 'lucide-react';

const COMMAND_CENTER = [8.8066, 124.788];
const MAP_BOUNDS = [
  [8.0, 124.0], // South-West
  [9.5, 125.5]  // North-East
];

const getLagongStyle = (isDark) => ({
  color: isDark ? '#38bdf8' : '#3b82f6',
  weight: 2,
  opacity: 0.8,
  fillOpacity: 0.1,
  fillColor: isDark ? '#0284c7' : '#93c5fd',
  dashArray: '5, 5'
});

const hazardFloodStyle = {
  color: '#2563eb',
  weight: 2,
  opacity: 0.9,
  fillOpacity: 0.5,
  fillColor: '#3b82f6',
  dashArray: '3, 6'
};

const hazardLandslideStyle = {
  color: '#78350f',
  weight: 2,
  opacity: 0.9,
  fillOpacity: 0.55,
  fillColor: '#92400e',
  dashArray: '3, 6'
};

const hazardSeverities = {
  'Poblacion': { flood: 'High (Level 3)', landslide: 'None' },
  'Tabok': { flood: 'High (Level 3)', landslide: 'None' },
  'Kauswagan': { flood: 'High (Level 3)', landslide: 'None' },
  'Kabulawan': { flood: 'Moderate (Level 2)', landslide: 'None' },
  'Lumbo': { flood: 'Low (Level 1)', landslide: 'Low (Level 1)' },
  'Manaol': { flood: 'Low (Level 1)', landslide: 'Moderate (Level 2)' },
  'Dampil': { flood: 'Moderate (Level 2)', landslide: 'Moderate (Level 2)' },
  'Banglay': { flood: 'None', landslide: 'High (Level 3)' },
  'Umagos': { flood: 'None', landslide: 'Very High (Level 4)' },
  'Gaston': { flood: 'None', landslide: 'Very High (Level 4)' }
};

const onEachBarangay = (feature, layer) => {
  if (feature.properties && feature.properties.NAME_3) {
    const name = feature.properties.NAME_3;
    const severity = hazardSeverities[name];
    
    // Keep the permanent label
    layer.bindTooltip(name, {
      permanent: true,
      direction: 'center',
      className: 'barangay-label'
    });

    // Add a clickable popup for severity details
    if (severity) {
      const popupContent = `
        <div style="font-family: sans-serif; min-width: 150px;">
          <h4 style="margin: 0 0 5px 0; font-size: 14px; text-align: center; border-bottom: 1px solid #ccc; padding-bottom: 5px;">${name} Hazard Profile</h4>
          <div style="font-size: 12px; margin-bottom: 4px;">
            <strong style="color: #2563eb;">Flood/Storm Surge:</strong><br/>
            ${severity.flood}
          </div>
          <div style="font-size: 12px;">
            <strong style="color: #78350f;">Rain-Induced Landslide:</strong><br/>
            ${severity.landslide}
          </div>
        </div>
      `;
      layer.bindPopup(popupContent);
    }
  }
};

// Custom Icons
const createEarthquakeIcon = (mag) => {
  const size = Math.max(20, mag * 8);
  return L.divIcon({
    className: 'custom-icon',
    html: `
      <div style="
        background-color: rgba(220, 38, 38, 0.7);
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 2px solid #ef4444;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 10px;
        box-shadow: 0 0 15px rgba(220, 38, 38, 0.5);
      ">${mag.toFixed(1)}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
};

export default function Calamities() {
  const { isDark } = useTheme();
  const [lagonglongGeoJSON, setLagonglongGeoJSON] = useState(null);
  const [floodHazardJSON, setFloodHazardJSON] = useState(null);
  const [landslideHazardJSON, setLandslideHazardJSON] = useState(null);
  const [earthquakes, setEarthquakes] = useState([]);
  const [weather, setWeather] = useState(null);
  const [marine, setMarine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [announcement, setAnnouncement] = useState({ targetBarangay: '', message: '', needsSmsBlast: false });
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [showHazardLegend, setShowHazardLegend] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Load Lagonglong Boundary & Hazard Maps
    Promise.all([
      import('../lagonglong_boundary.json'),
      import('../lagonglong_flood_hazard.json'),
      import('../lagonglong_landslide_hazard.json')
    ]).then(([lagong, flood, landslide]) => {
      if (!cancelled) {
        setLagonglongGeoJSON(lagong.default);
        setFloodHazardJSON(flood.default);
        setLandslideHazardJSON(landslide.default);
      }
    }).catch(() => {});

    // Fetch Live Earthquakes from USGS (within last 48 hours, inside regional bounding box)
    const fetchEarthquakes = async () => {
      try {
        const d = new Date();
        d.setDate(d.getDate() - 2);
        const dateStr = d.toISOString().split('T')[0];
        
        // Bounding box around Mindanao to capture nearby quakes
        const res = await fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${dateStr}&minlatitude=6.0&maxlatitude=10.0&minlongitude=123.0&maxlongitude=127.0&minmagnitude=3.0`);
        const data = await res.json();
        if (!cancelled && data.features) {
          setEarthquakes(data.features);
        }
      } catch (err) {
        console.error("Error fetching earthquakes:", err);
      }
    };

    // Fetch Live Weather from Open-Meteo for Lagonglong
    const fetchWeather = async () => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=8.8066&longitude=124.7880&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code&hourly=precipitation_probability,soil_moisture_0_to_7cm&timezone=Asia%2FManila`);
        const data = await res.json();
        if (!cancelled && data.current) {
          setWeather(data); // Store full data to access hourly soil moisture
        }
      } catch (err) {
        console.error("Error fetching weather:", err);
      }
    };

    // Fetch Marine Data (Coastal Macajalar Bay)
    const fetchMarine = async () => {
      try {
        const res = await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=8.8066&longitude=124.7500&current=wave_height,wave_direction,ocean_current_velocity,ocean_current_direction&timezone=Asia%2FManila`);
        const data = await res.json();
        if (!cancelled && data.current) {
          setMarine(data.current);
        }
      } catch (err) {
        console.error("Error fetching marine:", err);
      }
    };

    Promise.all([fetchEarthquakes(), fetchWeather(), fetchMarine()]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const handleSendAnnouncement = async () => {
    if (!announcement.message || !announcement.targetBarangay) return;
    setSendingAnnouncement(true);
    try {
      await pb.collection('notifications').create({
        title: 'Hazard & Calamity Alert',
        message: announcement.message,
        baranggay: announcement.targetBarangay, // Matching the 'baranggay' spelling in users table
        type: 'hazard_alert',
        isRead: false,
        needs_sms_blast: announcement.needsSmsBlast
      });
      alert('Announcement successfully sent to ' + announcement.targetBarangay);
      setAnnouncement({ targetBarangay: '', message: '', needsSmsBlast: false });
    } catch (error) {
      console.error('Error sending announcement:', error);
      alert('Failed to send announcement. Please ensure the notifications table exists and has title, message, baranggay, and type fields.');
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const getWeatherDescription = (code) => {
    if (code <= 3) return "Clear / Partly Cloudy";
    if (code <= 49) return "Fog / Overcast";
    if (code <= 59) return "Drizzle";
    if (code <= 69) return "Rain";
    if (code <= 79) return "Snow (Unlikely!)";
    if (code <= 99) return "Thunderstorms";
    return "Unknown";
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: isDark ? '#0f172a' : '#f8fafc', color: isDark ? '#f8fafc' : '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />
      
      <main className="calamities-main" style={{ flex: 1, marginLeft: '216px', padding: '32px', display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowY: 'auto' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle color="#ef4444" size={32} />
            Weather & Hazard Alerts
          </h1>
          <p style={{ margin: 0, color: isDark ? '#94a3b8' : '#64748b' }}>
            Live weather updates, flood & landslide hazard maps, and earthquake alerts for Lagonglong.
          </p>
        </header>

        <div className="calamities-content-grid" style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
          {/* LEFT PANEL - Live Stats */}
          <div className="calamities-left-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '8px' }}>
            
            {/* Weather Panel */}
            <div style={{ background: isDark ? '#1e293b' : '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6' }}>
                <CloudRain size={20} /> Local Weather Status
              </h3>
              {loading ? <p>Scanning radars...</p> : weather && weather.current ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Condition</span>
                    <span style={{ fontWeight: 'bold' }}>{getWeatherDescription(weather.current.weather_code)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Temperature</span>
                    <span style={{ fontWeight: 'bold' }}>{weather.current.temperature_2m} °C</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Wind Speed</span>
                    <span style={{ fontWeight: 'bold' }}>{weather.current.wind_speed_10m} km/h</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Precipitation</span>
                    <span style={{ fontWeight: 'bold' }}>{weather.current.precipitation} mm</span>
                  </div>

                  {/* Heat Index Gauge */}
                  {(() => {
                     const heatIndex = weather.current.apparent_temperature;
                     let heatColor = "#3b82f6";
                     let heatLevel = "Safe";
                     if (heatIndex >= 27 && heatIndex <= 32) { heatColor = "#eab308"; heatLevel = "Caution"; }
                     else if (heatIndex >= 33 && heatIndex <= 41) { heatColor = "#f97316"; heatLevel = "Extreme Caution"; }
                     else if (heatIndex >= 42 && heatIndex <= 51) { heatColor = "#ef4444"; heatLevel = "Danger"; }
                     else if (heatIndex >= 52) { heatColor = "#7f1d1d"; heatLevel = "Extreme Danger"; }
                     
                     return (
                       <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0' }}>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                           <span style={{ color: isDark ? '#cbd5e1' : '#475569', fontSize: '13px', fontWeight: 'bold' }}>PAGASA Heat Index</span>
                           <span style={{ fontWeight: '900', color: heatColor, fontSize: '15px' }}>{heatIndex}°C <span style={{ fontSize: '12px', fontWeight: '600' }}>({heatLevel})</span></span>
                         </div>
                         <div style={{ height: '8px', width: '100%', backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                           <div style={{ height: '100%', width: `${Math.min(100, (heatIndex / 55) * 100)}%`, backgroundColor: heatColor, transition: 'width 1s ease' }}></div>
                         </div>
                       </div>
                     );
                  })()}

                  {/* Soil Saturation / Flash Flood Risk */}
                  {(() => {
                     const soilRaw = weather.hourly?.soil_moisture_0_to_7cm?.[0] || 0;
                     // Convert raw m3/m3 (typically 0 to 0.5) to a rough percentage saturation
                     const saturation = Math.min(100, Math.round((soilRaw / 0.45) * 100));
                     
                     let riskColor = "#3b82f6"; // Low
                     let riskLevel = "Low";
                     if (saturation > 75) { riskColor = "#f97316"; riskLevel = "High"; }
                     if (saturation > 90) { riskColor = "#ef4444"; riskLevel = "Extreme"; }
                     
                     return (
                       <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0' }}>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                           <span style={{ color: isDark ? '#cbd5e1' : '#475569', fontSize: '13px', fontWeight: 'bold' }}>Flash Flood Risk (Soil Saturation)</span>
                           <span style={{ fontWeight: '900', color: riskColor, fontSize: '15px' }}>{saturation}% <span style={{ fontSize: '12px', fontWeight: '600' }}>({riskLevel})</span></span>
                         </div>
                         <div style={{ height: '8px', width: '100%', backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                           <div style={{ height: '100%', width: `${saturation}%`, backgroundColor: riskColor, transition: 'width 1s ease' }}></div>
                         </div>
                       </div>
                     );
                  })()}

                  {weather.current.precipitation > 5 && (
                    <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <AlertTriangle size={14} /> Heavy Rain Detected - Flood Risk
                    </div>
                  )}
                </div>
              ) : <p>Unable to fetch weather.</p>}
            </div>

            {/* Marine Panel (Macajalar Bay) */}
            <div style={{ background: isDark ? '#1e293b' : '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0ea5e9' }}>
                <Waves size={20} /> Macajalar Bay Coastal
              </h3>
              {loading ? <p>Scanning buoys...</p> : marine ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Wave Height</span>
                    <span style={{ fontWeight: 'bold' }}>{marine.wave_height} m</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Wave Direction</span>
                    <span style={{ fontWeight: 'bold' }}>{marine.wave_direction}°</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Ocean Current</span>
                    <span style={{ fontWeight: 'bold' }}>{marine.ocean_current_velocity} km/h</span>
                  </div>

                  {(() => {
                    const wave = marine.wave_height;
                    let alertColor = "#3b82f6";
                    let alertTitle = "Safe for Fishing";
                    let alertBg = isDark ? "#1e3a8a" : "#eff6ff";
                    if (wave >= 1.0 && wave < 2.0) {
                      alertColor = "#eab308";
                      alertTitle = "Caution for Small Boats";
                      alertBg = isDark ? "#422006" : "#fefce8";
                    } else if (wave >= 2.0) {
                      alertColor = "#ef4444";
                      alertTitle = "Small Craft Warning: NO SAIL";
                      alertBg = isDark ? "#450a0a" : "#fef2f2";
                    }
                    
                    return (
                      <div style={{ marginTop: '8px', padding: '10px', backgroundColor: alertBg, color: alertColor, borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', display: 'flex', gap: '6px', alignItems: 'center', border: `1px solid ${alertColor}40` }}>
                        <AlertTriangle size={15} /> {alertTitle}
                      </div>
                    );
                  })()}
                </div>
              ) : <p>Unable to fetch marine data.</p>}
            </div>

            {/* Hazard Announcements Panel */}
            <div style={{ background: isDark ? '#450a0a' : '#fff1f2', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.2)', border: isDark ? '1px solid #7f1d1d' : '1px solid #fecdd3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: isDark ? '#fca5a5' : '#e11d48' }}>
                  <Megaphone size={22} strokeWidth={2.5} /> Emergency Broadcast
                </h3>
                <span className="pulse-dot" style={{ width: '10px', height: '10px', backgroundColor: '#e11d48', borderRadius: '50%', boxShadow: '0 0 10px #e11d48' }}></span>
              </div>
              <p style={{ fontSize: '12.5px', color: isDark ? '#fecaca' : '#9f1239', marginBottom: '16px', lineHeight: '1.4' }}>
                Push immediate evacuation or hazard alerts directly to citizens' mobile phones in the selected area.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  <select 
                    value={announcement.targetBarangay}
                    onChange={(e) => setAnnouncement({...announcement, targetBarangay: e.target.value})}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: isDark ? '2px solid #7f1d1d' : '2px solid #fda4af', background: isDark ? '#2e0a0a' : '#ffffff', color: isDark ? '#fef2f2' : '#881337', fontWeight: '600', fontSize: '14px', outline: 'none', appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Select Target Barangay...</option>
                    <option value="All">⚠️ ALL BARANGAYS (Town-Wide Alert)</option>
                    {Object.keys(hazardSeverities).map(b => (
                      <option key={b} value={b}>Brgy. {b}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} color={isDark ? '#fca5a5' : '#e11d48'} style={{ position: 'absolute', right: '12px', top: '12px', pointerEvents: 'none' }} />
                </div>

                <textarea 
                  placeholder="Type official hazard warning or evacuation notice here... (Keep it clear and actionable)"
                  value={announcement.message}
                  onChange={(e) => setAnnouncement({...announcement, message: e.target.value})}
                  style={{ width: '100%', height: '90px', padding: '10px 12px', borderRadius: '8px', border: isDark ? '2px solid #7f1d1d' : '2px solid #fda4af', background: isDark ? '#2e0a0a' : '#ffffff', color: isDark ? '#fef2f2' : '#881337', outline: 'none', resize: 'none', fontSize: '13.5px' }}
                />

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: isDark ? '#fecaca' : '#9f1239', cursor: 'pointer', fontWeight: 'bold' }}>
                  <input 
                    type="checkbox" 
                    checked={announcement.needsSmsBlast}
                    onChange={(e) => setAnnouncement({...announcement, needsSmsBlast: e.target.checked})}
                    style={{ width: '16px', height: '16px', accentColor: '#e11d48' }}
                  />
                  Also send via SMS (Requires SMS Server)
                </label>
                
                <button 
                  onClick={handleSendAnnouncement}
                  disabled={sendingAnnouncement || !announcement.targetBarangay || !announcement.message}
                  style={{ 
                    width: '100%', padding: '12px', borderRadius: '8px', border: 'none', 
                    background: (sendingAnnouncement || !announcement.targetBarangay || !announcement.message) ? (isDark ? '#4c1d95' : '#cbd5e1') : 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)', 
                    color: (sendingAnnouncement || !announcement.targetBarangay || !announcement.message) ? (isDark ? '#a78bfa' : '#64748b') : '#ffffff', 
                    fontWeight: '900', fontSize: '14px', cursor: (sendingAnnouncement || !announcement.targetBarangay || !announcement.message) ? 'not-allowed' : 'pointer',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                    boxShadow: (sendingAnnouncement || !announcement.targetBarangay || !announcement.message) ? 'none' : '0 4px 15px rgba(225, 29, 72, 0.4)',
                    transition: 'all 0.2s ease',
                    textTransform: 'uppercase', letterSpacing: '0.5px'
                  }}
                >
                  <Radio size={18} />
                  {sendingAnnouncement ? 'Broadcasting to Network...' : 'SEND PUSH ALERT'}
                </button>
              </div>
            </div>

            {/* Earthquakes Panel */}
            <div style={{ background: isDark ? '#1e293b' : '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                <Activity size={20} /> Regional Earthquakes (48h)
              </h3>
              {loading ? <p>Syncing seismographs...</p> : earthquakes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {earthquakes.slice(0, 5).map((quake, idx) => (
                    <div key={idx} style={{ paddingBottom: '8px', borderBottom: idx !== 4 ? (isDark ? '1px solid #334155' : '1px solid #e2e8f0') : 'none' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#ef4444' }}>
                        Mag {quake.properties.mag.toFixed(1)}
                      </div>
                      <div style={{ fontSize: '12px', color: isDark ? '#cbd5e1' : '#475569', marginTop: '2px' }}>
                        {quake.properties.place}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                        {new Date(quake.properties.time).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p style={{ fontSize: '14px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={16} /> No recent major earthquakes in the region.
              </p>}
            </div>
            
          </div>

        <style>
          {`
            @keyframes dotPulse {
              0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(225, 29, 72, 0.7); }
              70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(225, 29, 72, 0); }
              100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(225, 29, 72, 0); }
            }
            .pulse-dot {
              animation: dotPulse 2s infinite;
            }
          `}
        </style>

          {/* RIGHT PANEL - Map */}
          <div style={{ flex: 1, borderRadius: '16px', overflow: 'hidden', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              
              {/* BEAUTIFUL FLOATING MAP LEGEND (TOGGLEABLE / HIDABLE) */}
              {showHazardLegend ? (
                <div style={{
                  position: 'absolute',
                  bottom: '30px',
                  right: '10px',
                  zIndex: 1000,
                  backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                  padding: '16px',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                  border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                  width: '280px',
                  maxWidth: 'calc(100% - 20px)',
                  backdropFilter: 'blur(4px)',
                  transition: 'all 0.2s ease',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: isDark ? '1px solid #334155' : '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: isDark ? '#f8fafc' : '#0f172a' }}>
                      Hazard Color Coding
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowHazardLegend(false)}
                      title="Hide Hazard Legend"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: isDark ? '#94a3b8' : '#64748b',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ width: '20px', height: '20px', backgroundColor: '#3b82f6', opacity: 0.8, border: '2px solid #2563eb', borderRadius: '4px', flexShrink: 0 }}></div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: isDark ? '#cbd5e1' : '#334155' }}>High Flood & Storm Surge</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Coastal/Riverine: Dampil, Kabulawan, Kauswagan, Lumbo, Manaol, Poblacion, Tabok</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ width: '20px', height: '20px', backgroundColor: '#92400e', opacity: 0.85, border: '2px solid #78350f', borderRadius: '4px', flexShrink: 0 }}></div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: isDark ? '#cbd5e1' : '#334155' }}>Rain-Induced Landslides (Brown)</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Uplands: Banglay, Dampil, Gaston, Lumbo, Manaol, Umagos</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowHazardLegend(true)}
                  title="Show Hazard Color Legend"
                  style={{
                    position: 'absolute',
                    bottom: '30px',
                    right: '10px',
                    zIndex: 1000,
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    boxShadow: '0 8px 20px -4px rgba(0, 0, 0, 0.25)',
                    border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                    backdropFilter: 'blur(6px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontSize: '12px',
                    fontWeight: '800',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', gap: '3px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#3b82f6', display: 'inline-block' }} />
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#f59e0b', display: 'inline-block' }} />
                  </div>
                  <span>Hazard Legend</span>
                  <ChevronUp size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                </button>
              )}

              <MapContainer 
                key={isDark ? 'cal-map-dark' : 'cal-map-light'}
                center={COMMAND_CENTER}
                zoom={13} 
                style={{ width: '100%', height: '100%' }}
                scrollWheelZoom={true}
                maxBounds={MAP_BOUNDS}
              >
                <LayersControl position="topright">
                  <LayersControl.BaseLayer checked name="OpenStreetMap">
                    <TileLayer
                      attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                  </LayersControl.BaseLayer>
                  <LayersControl.BaseLayer name="Satellite">
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                    />
                  </LayersControl.BaseLayer>
                  <LayersControl.BaseLayer name="Dark Tactical View">
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                  </LayersControl.BaseLayer>


                
                {/* BOUNDARY OVERLAY */}
                {lagonglongGeoJSON && (
                  <LayersControl.Overlay checked name="Lagonglong Boundary">
                    <GeoJSON
                      data={lagonglongGeoJSON}
                      style={getLagongStyle(isDark)}
                      onEachFeature={onEachBarangay}
                    />
                  </LayersControl.Overlay>
                )}

                {/* HAZARD ZONES (Precise Coordinates) */}
                {floodHazardJSON && (
                  <LayersControl.Overlay checked name="100-Year Flood Susceptibility (Coastal & Riverine)">
                    <GeoJSON
                      data={floodHazardJSON}
                      style={hazardFloodStyle}
                      onEachFeature={onEachBarangay}
                    />
                  </LayersControl.Overlay>
                )}

                {landslideHazardJSON && (
                  <LayersControl.Overlay checked name="Rain-Induced Landslide Susceptibility (Uplands)">
                    <GeoJSON
                      data={landslideHazardJSON}
                      style={hazardLandslideStyle}
                      onEachFeature={onEachBarangay}
                    />
                  </LayersControl.Overlay>
                )}
              </LayersControl>

              {/* PLOT EARTHQUAKES */}
              {earthquakes.map((quake, idx) => {
                const [lon, lat, depth] = quake.geometry.coordinates;
                return (
                  <Marker 
                    key={`quake-${idx}`} 
                    position={[lat, lon]}
                    icon={createEarthquakeIcon(quake.properties.mag)}
                  >
                    <Popup>
                      <strong style={{color:'#dc2626'}}>Magnitude {quake.properties.mag}</strong><br/>
                      {quake.properties.place}<br/>
                      Depth: {depth} km<br/>
                      {new Date(quake.properties.time).toLocaleString()}
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
