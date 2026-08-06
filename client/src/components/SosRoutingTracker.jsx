import React, { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Baseline coordinates: [lng, lat] (Command Center)
const COMMAND_CENTER = [124.788, 8.8066];

async function fetchRoadRoute(start, end) {
  const url = `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&overview=full`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates;
    }
  } catch (error) {
    console.error("Routing error:", error);
  }
  return [start, end];
}

export default function SosRoutingTracker({ targetLat, targetLng }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const targetMarker = useRef(null);
  const isMapLoaded = useRef(false);
  const isInitialAnimComplete = useRef(false);
  const isUserInteracting = useRef(false); // <-- Add this line here

  // Store coordinates in refs so the initialization effect can read them safely without dependencies
  const initLat = useRef(targetLat);
  const initLng = useRef(targetLng);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Reverting to Liberty for beautiful terrain, water, and road hierarchies
    const detailedStyle = "https://tiles.openfreemap.org/styles/liberty";

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: detailedStyle,
      center: COMMAND_CENTER,
      zoom: 15,
      pitch: 45, //  use a 3D perspective tilt
      bearing: 0, // Keep north facing up
    });

    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    // If the admin drags or zooms, flag it so the camera stops snapping
    map.current.on("movestart", (e) => {
      if (e.originalEvent) { // Only true if triggered by actual mouse/touch interaction
        isUserInteracting.current = true;
      }
    });

    map.current.on("load", async () => {
      // ---  COMMAND CENTER MARKER ---
      const commandEl = document.createElement("div");
      commandEl.className = "custom-command-marker";
      commandEl.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
          <path fill-rule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06l-3.22-3.22V16.5a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clip-rule="evenodd" />
        </svg>
      `;
      new maplibregl.Marker({ element: commandEl })
        .setLngLat(COMMAND_CENTER)
        .addTo(map.current);

      // ---  TARGET RADAR MARKER ---
      const pulseElement = document.createElement("div");
      pulseElement.className = "radar-blip";
      targetMarker.current = new maplibregl.Marker({ element: pulseElement })
        .setLngLat([initLng.current, initLat.current]) // Read from the ref
        .addTo(map.current);

      // Fetch precise routing
      const initialRouteCoords = await fetchRoadRoute(COMMAND_CENTER, [
        initLng.current, // Read from the ref
        initLat.current, // Read from the ref
      ]);
      map.current.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: initialRouteCoords,
          },
        },
      });

      // ---  DESIGN (THE "TUBE" EFFECT) ---
      // Layer 1: Thick Dark Blue Shadow/Border
      map.current.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#1e3a8a",
          "line-width": 8,
          "line-opacity": 0.6,
        },
      });
      // Layer 2: Bright Cyan Inner Core
      map.current.addLayer({
        id: "route-core",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#38bdf8",
          "line-width": 4,
        },
      });

      // --- ELEGANT TYPOGRAPHY FIX ---
      const layers = map.current.getStyle().layers;
      layers.forEach((layer) => {
        if (
          layer.id.includes("village") ||
          layer.id.includes("suburb") ||
          layer.id.includes("town")
        ) {
          map.current.setLayoutProperty(layer.id, "text-size", 13);
          map.current.setPaintProperty(layer.id, "text-color", "#1e293b"); // Soft dark slate
          map.current.setPaintProperty(
            layer.id,
            "text-halo-color",
            "rgba(255, 255, 255, 0.9)",
          ); // Soft glow
          map.current.setPaintProperty(layer.id, "text-halo-width", 1.5);
          map.current.setLayerZoomRange(layer.id, 10, 24);
        }
      });

      isMapLoaded.current = true;
      map.current.resize();

      // CINEMATIC OPENING SEQUENCE
      setTimeout(() => {
        if (!map.current) return;
        
        // Dynamic lookup ensures the latest coordinate values are fetched safely
        const currentCenter = map.current.getCenter();
        const bounds = new maplibregl.LngLatBounds()
          .extend(COMMAND_CENTER)
          .extend(targetMarker.current ? targetMarker.current.getLngLat() : currentCenter);

        map.current.fitBounds(bounds, {
          padding: { top: 90, bottom: 90, left: 90, right: 90 },
          duration: 3500,
          pitch: 45, 
          essential: true,
        });

        setTimeout(() => {
          isInitialAnimComplete.current = true;
        }, 3600);
      }, 1500);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        isMapLoaded.current = false;
      }
    };
  }, []);

  // Real-time Follower
  useEffect(() => {
    if (!map.current || !isMapLoaded.current) return;
    if (targetMarker.current) {
      targetMarker.current.setLngLat([targetLng, targetLat]);
    }

    const updateRoute = async () => {
      const roadCoordinates = await fetchRoadRoute(COMMAND_CENTER, [
        targetLng,
        targetLat,
      ]);
      const routeSource = map.current.getSource("route");
      if (routeSource) {
        routeSource.setData({
          type: "Feature",
          geometry: { type: "LineString", coordinates: roadCoordinates },
        });
      }
    };
    updateRoute();

    // ONLY move the camera if the initial animation is done AND the admin isn't trying to look closely at something else
    if (isInitialAnimComplete.current && !isUserInteracting.current) {
      const currentBounds = new maplibregl.LngLatBounds()
        .extend(COMMAND_CENTER)
        .extend([targetLng, targetLat]);

      map.current.fitBounds(currentBounds, {
        padding: { top: 90, bottom: 90, left: 90, right: 90 },
        pitch: 45,
        duration: 800,
      });
    }
  }, [targetLat, targetLng]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "450px",
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
        boxShadow: "inset 0 0 20px rgba(0,0,0,0.1)",
      }}
    >
      {/* PROFESSIONAL UI STYLES INJECTED HERE */}
      <style>{`
        /* Dispatcher Pin Design */
        .custom-command-marker {
          width: 32px;
          height: 32px;
          background: #0f172a;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          transform: translateY(-5px);
        }
        .custom-command-marker svg { width: 16px; height: 16px; }
        
        /* High-End Target Radar Design */
        .radar-blip {
          width: 18px;
          height: 18px;
          background-color: #ef4444;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 0 rgba(239, 68, 68, 0.5);
          animation: radar-pulse 2s infinite cubic-bezier(0.66, 0, 0, 1);
        }
        
        @keyframes radar-pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>

      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      <div style={styles.badge}>ðŸ”´ LIVE SOS TRACKING</div>
    </div>
  );
}

const styles = {
  badge: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 1,
    background: "rgba(255, 255, 255, 0.95)",
    color: "#ef4444",
    padding: "8px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "800",
    pointerEvents: "none",
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
    backdropFilter: "blur(4px)",
    letterSpacing: "0.5px",
  },
};


