import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Baseline coordinates: [lng, lat]
const COMMAND_CENTER = [124.7880, 8.8066]; 

export default function SosRoutingTracker({ targetLat, targetLng }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const targetMarker = useRef(null); // Keeps track of the active user marker instance
  const isMapLoaded = useRef(false); // Flag to check if the map is completely parsed

  // 1. Map Canvas Initialization Hook (Runs ONLY ONCE when card mounts)
  useEffect(() => {
    if (!mapContainer.current) return;

    // OpenFreeMap Liberty detailed schema configuration
    const detailedStyle = 'https://tiles.openfreemap.org/styles/liberty';

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: detailedStyle, 
      center: [targetLng, targetLat],
      zoom: 15, // Closer view to see real-time moving adjustments clearly
      pitch: 45 // 3D perspective layout
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      // Create fixed command baseline pin
      new maplibregl.Marker({ color: '#1e293b' })
        .setLngLat(COMMAND_CENTER)
        .addTo(map.current);

      // Create mutable moving client pin and assign instance to ref
      targetMarker.current = new maplibregl.Marker({ color: '#dc2626' })
        .setLngLat([targetLng, targetLat])
        .addTo(map.current);

      // Inject mutable route data structure
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [COMMAND_CENTER, [targetLng, targetLat]]
          }
        }
      });

      // Paint route layout attributes onto canvas frame
      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#dc2626', 'line-width': 4 }
      });

      isMapLoaded.current = true;
      map.current.resize();
    });

    // Tear down component context maps safely on screen switch transitions
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        isMapLoaded.current = false;
      }
    };
  }, []); // Intentionally empty to isolate map frame allocation away from component refreshes

  // 2. Real-time Reactive Coordinate Stream Watcher (Fires every time props update via PocketBase subscription)
  useEffect(() => {
    // Stop execution context if map structure layer is still calculating base nodes
    if (!map.current || !isMapLoaded.current) return;

    // A. Move target marker seamlessly across screen coordinates space
    if (targetMarker.current) {
      targetMarker.current.setLngLat([targetLng, targetLat]);
    }

    // B. Re-morph route line string layout array data dynamically without refreshing layers
    const routeSource = map.current.getSource('route');
    if (routeSource) {
      routeSource.setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [COMMAND_CENTER, [targetLng, targetLat]]
        }
      });
    }

    // C. Re-adjust camera position seamlessly following changing coordinates
    map.current.easeTo({
      center: [targetLng, targetLat],
      essential: true,
      duration: 600 // Smooth panning duration over 600 milliseconds
    });

  }, [targetLat, targetLng]); // Instantly reacts when PocketBase real-time client forces values change

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '220px', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      <div style={styles.badge}>REALTIME GPS TRACKING MODE ACTIVE</div>
    </div>
  );
}

const styles = {
  badge: {
    position: 'absolute', top: 10, left: 10, zIndex: 1,
    background: 'rgba(220, 38, 38, 0.9)', color: 'white',
    padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
    pointerEvents: 'none'
  }
};