import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, LayersControl, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Sidebar from '../components/Sidebar';
import { useTheme } from '../themes/ThemeContext';
import { Activity, Wind, AlertTriangle, Info, CloudRain } from 'lucide-react';

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
  color: '#d97706',
  weight: 2,
  opacity: 0.9,
  fillOpacity: 0.5,
  fillColor: '#f59e0b',
  dashArray: '3, 6'
};

const onEachBarangay = (feature, layer) => {
  if (feature.properties && feature.properties.NAME_3) {
    layer.bindTooltip(feature.properties.NAME_3, {
      permanent: true,
      direction: 'center',
      className: 'barangay-label' // Reusing the style from DashboardMap
    });
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
  const [loading, setLoading] = useState(true);

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
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=8.8066&longitude=124.7880&current=temperature_2m,wind_speed_10m,precipitation,weather_code&hourly=precipitation_probability&timezone=Asia%2FManila`);
        const data = await res.json();
        if (!cancelled && data.current) {
          setWeather(data.current);
        }
      } catch (err) {
        console.error("Error fetching weather:", err);
      }
    };

    Promise.all([fetchEarthquakes(), fetchWeather()]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

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
      
      <main style={{ flex: 1, marginLeft: '216px', padding: '32px', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle color="#ef4444" size={32} />
            Calamities & Hazards Monitor
          </h1>
          <p style={{ margin: 0, color: isDark ? '#94a3b8' : '#64748b' }}>
            Live tracking for earthquakes and weather anomalies localized to Lagonglong, Misamis Oriental.
          </p>
        </header>

        <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
          {/* LEFT PANEL - Live Stats */}
          <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '8px' }}>
            
            {/* Weather Panel */}
            <div style={{ background: isDark ? '#1e293b' : '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6' }}>
                <CloudRain size={20} /> Local Weather Status
              </h3>
              {loading ? <p>Scanning radars...</p> : weather ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Condition</span>
                    <span style={{ fontWeight: 'bold' }}>{getWeatherDescription(weather.weather_code)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Temperature</span>
                    <span style={{ fontWeight: 'bold' }}>{weather.temperature_2m} °C</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Wind Speed</span>
                    <span style={{ fontWeight: 'bold' }}>{weather.wind_speed_10m} km/h</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>Precipitation</span>
                    <span style={{ fontWeight: 'bold' }}>{weather.precipitation} mm</span>
                  </div>
                  {weather.precipitation > 5 && (
                    <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <AlertTriangle size={14} /> Heavy Rain Detected - Flood Risk
                    </div>
                  )}
                </div>
              ) : <p>Unable to fetch weather.</p>}
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

          {/* RIGHT PANEL - Map */}
          <div style={{ flex: 1, borderRadius: '16px', overflow: 'hidden', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <MapContainer 
              key={isDark ? 'cal-map-dark' : 'cal-map-light'}
              center={COMMAND_CENTER}
              zoom={12} 
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom={true}
              maxBounds={MAP_BOUNDS}
            >
              <LayersControl position="bottomleft">
                <LayersControl.BaseLayer checked={isDark} name="Dark Tactical View">
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer checked={!isDark} name="Satellite View">
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
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
                    />
                  </LayersControl.Overlay>
                )}

                {landslideHazardJSON && (
                  <LayersControl.Overlay checked name="Rain-Induced Landslide Susceptibility (Uplands)">
                    <GeoJSON
                      data={landslideHazardJSON}
                      style={hazardLandslideStyle}
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
      </main>
    </div>
  );
}
