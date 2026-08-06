import React, { useState, useEffect, useCallback, useRef } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { getReadableAddress } from "../utils/utils";
import { ongoingStyles, getIncidentTheme } from "../themes/ongoingStyles"; 
import {
  MapPin,
  User,
  ImageIcon,
  Activity,
  X,
  Phone,
  ShieldCheck,
  Maximize2,
  Map as MapIcon,
  CheckCircle,
  Filter,
} from "lucide-react";

export default function OngoingIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("ALL");

  const fetchedAddressIds = useRef(new Set());

  // 1. COMBINED & OPTIMIZED FETCH FUNCTION
  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const records = await pb.collection("incident_reports").getFullList({
        filter: 'status = "ongoing" || status = "accepted" || status = "en_route" || status = "at_scene" || status = "dispatched"',
        sort: "-created",
        expand: "users,responders",
        requestKey: null,
      });
      setIncidents(records);

      const pendingAddresses = records.filter(
        (record) =>
          record.latitude != null &&
          record.longitude != null &&
          !fetchedAddressIds.current.has(record.id)
      );

      if (pendingAddresses.length > 0) {
        const resolved = await Promise.all(
          pendingAddresses.map(async (record) => {
            fetchedAddressIds.current.add(record.id);
            return [
              record.id,
              await getReadableAddress(record.latitude, record.longitude),
            ];
          })
        );
        setAddresses((prev) => ({ ...prev, ...Object.fromEntries(resolved) }));
      }
    } catch (error) {
      if (!error.isAbort) console.error("Fetch error:", error);
    }
    setLoading(false);
  }, []);

  // 2. OPTIMIZED REAL-TIME LISTENER
  useEffect(() => {
    let isMounted = true;
    let unsubscribe;

    const loadAndSubscribe = async () => {
      await fetchIncidents();

      unsubscribe = await pb
        .collection("incident_reports")
        .subscribe("*", () => {
          if (isMounted) {
            fetchIncidents();
          }
        });
    };

    loadAndSubscribe();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [fetchIncidents]);

  // Filtering Logic
  const filteredIncidents = incidents.filter((incident) => {
    if (selectedTypeFilter === "ALL") return true;
    return incident.type?.toUpperCase() === selectedTypeFilter;
  });

  // Calculate Category Counts
  const typeCounts = incidents.reduce((acc, inc) => {
    const key = (inc.type || "OTHER").toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={ongoingStyles.shell}>
      <Sidebar />

      <main style={ongoingStyles.main}>
        {/* Header */}
        <header style={ongoingStyles.header}>
          <div>
            <div style={ongoingStyles.headerTitleWrapper}>
              <div style={ongoingStyles.pulseDot} className="animate-pulse" />
              <h1 style={ongoingStyles.pageTitle}>ONGOING DISPATCHES</h1>
            </div>
            <p style={ongoingStyles.subtitle}>
              Real-time monitoring of deployed emergency units across Lagonglong
            </p>
          </div>
        </header>

        {/* Category Metrics & Filter Bar */}
        <div style={ongoingStyles.filterBar}>
          <span style={ongoingStyles.filterLabel}>
            <Filter size={14} /> FILTER TYPE:
          </span>

          <button
            onClick={() => setSelectedTypeFilter("ALL")}
            style={ongoingStyles.filterButton(selectedTypeFilter === "ALL")}
          >
            ALL ACTIVE ({incidents.length})
          </button>

          {Object.entries(typeCounts).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setSelectedTypeFilter(type)}
              style={ongoingStyles.filterButton(selectedTypeFilter === type)}
            >
              {type} ({count})
            </button>
          ))}
        </div>

        {/* Empty State */}
        {filteredIncidents.length === 0 && !loading && (
          <div style={ongoingStyles.emptyState}>
            <CheckCircle
              size={56}
              color="#10b981"
              style={{ marginBottom: "16px", opacity: 0.8 }}
            />
            <h3 style={{ color: "#f8fafc", margin: "0 0 8px 0" }}>
              No Ongoing Emergency Dispatches
            </h3>
            <p style={{ margin: 0, fontSize: "14px" }}>
              All dispatched response units have resolved their assignments.
            </p>
          </div>
        )}

        {/* Incident Grid */}
        <div style={ongoingStyles.grid}>
          {filteredIncidents.map((incident) => {
            const reporter = incident.expand?.users;
            const responder = incident.expand?.responders;

            const imgUrl = incident.incident_image
              ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_image}`
              : null;
            const videoUrl = incident.incident_video
              ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_video}`
              : null;

            const theme = getIncidentTheme(incident.type);
            const HeaderIcon = theme.icon;

            return (
              <div key={incident.id} style={ongoingStyles.card(theme.border)}>
                {/* Header Banner */}
                <div style={ongoingStyles.cardHeader(theme.headerBg)}>
                  <span style={ongoingStyles.typeLabel(theme.accentText)}>
                    <HeaderIcon size={18} className="animate-pulse" />
                    {theme.label}: {incident.type?.toUpperCase()}
                  </span>

                  <span style={ongoingStyles.timeBadge}>
                    {new Date(incident.created).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div style={ongoingStyles.cardBody}>
                  {/* Reporter Info */}
                  <div style={ongoingStyles.reporterBox}>
                    <div style={ongoingStyles.reporterHeader}>
                      <div style={ongoingStyles.avatarIcon}>
                        <User size={22} />
                      </div>
                      <div>
                        <span style={ongoingStyles.reporterName}>
                          {reporter?.first_name} {reporter?.last_name || "Citizen"}
                        </span>
                        <div style={ongoingStyles.verifiedBadge}>
                          <ShieldCheck size={12} /> Verified Caller
                        </div>
                      </div>
                    </div>

                    <div style={ongoingStyles.phoneText}>
                      <Phone size={14} color="#818cf8" />
                      {reporter?.contact_number || "No Contact Number"}
                    </div>
                  </div>

                  {/* Deployed Responder Banner */}
                  <div style={ongoingStyles.responderBanner(theme.border)}>
                    <Activity color={theme.accentText} size={16} />
                    <span style={ongoingStyles.responderText}>
                      DEPLOYED UNIT:{" "}
                      <span style={{ color: theme.accentText }}>
                        {responder?.department?.toUpperCase() || "LOCAL RESPONDERS"}
                      </span>
                    </span>
                  </div>

                  {/* Location & Map Preview */}
                  <div style={{ marginBottom: "20px" }}>
                    <p style={ongoingStyles.locationText}>
                      <MapPin
                        size={16}
                        color="#60a5fa"
                        style={{ flexShrink: 0, marginTop: "2px" }}
                      />
                      {addresses[incident.id] || "Locating coordinates..."}
                    </p>

                    <div
                      onClick={() =>
                        setSelectedMap({
                          lat: incident.latitude,
                          lng: incident.longitude,
                          address: addresses[incident.id],
                        })
                      }
                      style={ongoingStyles.mapPreviewWrapper}
                    >
                      <iframe
                        title="Incident Location Preview"
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        scrolling="no"
                        loading="lazy" referrerpolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${incident.latitude},${incident.longitude}&z=16&output=embed&iwloc=near`}
                        style={{ border: 0, pointerEvents: "none" }}
                      ></iframe>
                      <div style={ongoingStyles.mapBadge}>
                        <Maximize2 size={12} /> ENLARGE MAP
                      </div>
                    </div>
                  </div>

                  {/* Media Grid */}
                  <div style={ongoingStyles.mediaGrid}>
                    {/* Image Tile */}
                    <div
                      style={ongoingStyles.mediaTile(Boolean(imgUrl))}
                      onClick={() => imgUrl && setSelectedImage(imgUrl)}
                    >
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          alt="Incident Evidence"
                        />
                      ) : (
                        <div style={ongoingStyles.noMediaBox}>
                          <ImageIcon size={24} />
                          <span style={{ fontSize: "10px", fontWeight: "700", marginTop: "4px" }}>
                            NO PHOTO
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Video Tile */}
                    <div
                      style={ongoingStyles.mediaTile(Boolean(videoUrl))}
                      onClick={() => videoUrl && setSelectedImage(videoUrl)}
                    >
                      {videoUrl ? (
                        <video
                          src={videoUrl}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          muted
                          onMouseOver={(e) => e.target.play()}
                          onMouseOut={(e) => e.target.pause()}
                        />
                      ) : (
                        <div style={ongoingStyles.noMediaBox}>
                          <Activity size={24} />
                          <span style={{ fontSize: "10px", fontWeight: "700", marginTop: "4px" }}>
                            NO VIDEO
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* MODAL: FULLSCREEN MAP */}
      {selectedMap && (
        <div onClick={() => setSelectedMap(null)} style={ongoingStyles.overlayModal}>
          <div onClick={(e) => e.stopPropagation()} style={ongoingStyles.modalMapCard}>
            <div style={ongoingStyles.modalMapHeader}>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: "900",
                    color: "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <MapIcon size={20} color="#60a5fa" /> LIVE MAP DISPATCH LOCATION
                </h3>
                <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "13px" }}>
                  {selectedMap.address}
                </p>
              </div>
              <button
                onClick={() => setSelectedMap(null)}
                style={ongoingStyles.modalCloseBtn}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ width: "100%", height: "60vh", backgroundColor: "#0f172a" }}>
              <iframe
                title="Full Interactive Map"
                width="100%"
                height="100%"
                frameBorder="0"
                loading="lazy" referrerpolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${selectedMap.lat},${selectedMap.lng}&z=17&output=embed&t=h`}
                style={{ border: 0 }}
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MEDIA VIEWER */}
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={ongoingStyles.overlayModal}>
          <div
            style={{
              position: "relative",
              maxWidth: "90%",
              maxHeight: "90%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {selectedImage.split("?")[0].toLowerCase().match(/\.(mp4|webm|ogg)$/) ? (
              <video
                src={selectedImage}
                controls
                autoPlay
                style={{
                  maxWidth: "100%",
                  maxHeight: "85vh",
                  borderRadius: "16px",
                  border: "1px solid #334155",
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={selectedImage}
                style={{
                  maxWidth: "100%",
                  maxHeight: "85vh",
                  borderRadius: "16px",
                  objectFit: "contain",
                  border: "1px solid #334155",
                }}
                alt="Enlarged Evidence"
              />
            )}
            <button
              onClick={() => setSelectedImage(null)}
              style={ongoingStyles.closeCircleBtn}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


