import React, { useState, useEffect, useCallback, useRef } from "react";
import { pb } from "./pocketbase";
import Sidebar from "./Sidebar";
import { getReadableAddress } from "./utils";
import {
  AlertTriangle,
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
  Flame,
  Mountain,
  Siren,
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

  // Dynamic Incident Themes for Dark UI
  const getIncidentTheme = (type) => {
    const normalized = (type || "").toLowerCase();
    if (normalized === "fire") {
      return {
        headerBg: "rgba(239, 68, 68, 0.15)",
        border: "#ef4444",
        badgeBg: "#ef4444",
        badgeText: "#ffffff",
        accentText: "#f87171",
        icon: Flame,
        label: "ACTIVE FIRE",
      };
    }
    if (normalized === "landslide") {
      return {
        headerBg: "rgba(168, 85, 247, 0.15)",
        border: "#a855f7",
        badgeBg: "#a855f7",
        badgeText: "#ffffff",
        accentText: "#c084fc",
        icon: Mountain,
        label: "ACTIVE LANDSLIDE",
      };
    }
    return {
      headerBg: "rgba(245, 158, 11, 0.15)",
      border: "#f59e0b",
      badgeBg: "#f59e0b",
      badgeText: "#0f172a",
      accentText: "#fbbf24",
      icon: Siren,
      label: "ACTIVE DISPATCH",
    };
  };

  // 1. COMBINED & OPTIMIZED FETCH FUNCTION
  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const records = await pb.collection("incident_reports").getFullList({
        filter: 'status = "ongoing" || status = "accepted"',
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
        .subscribe("*", (e) => {
          if (
            isMounted &&
            (
              e.action === "create" ||
              e.record.status === "ongoing" ||
              e.record.status === "accepted"
            )
          ) {
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
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#0b0f19",
        color: "#f8fafc",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <Sidebar />

      <main style={{ flex: 1, padding: "32px", marginLeft: "260px" }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "28px",
            paddingBottom: "20px",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "#f59e0b",
                  boxShadow: "0 0 12px #f59e0b",
                }}
                className="animate-pulse"
              />
              <h1
                style={{
                  fontSize: "28px",
                  fontWeight: "900",
                  letterSpacing: "-0.5px",
                  color: "#ffffff",
                  margin: 0,
                }}
              >
                ONGOING DISPATCHES
              </h1>
            </div>
            <p
              style={{
                color: "#94a3b8",
                fontSize: "14px",
                margin: "6px 0 0 24px",
                fontWeight: "500",
              }}
            >
              Real-time monitoring of deployed emergency units across Lagonglong
            </p>
          </div>
        </header>

        {/* Category Metrics & Filter Bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "28px",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: "800",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginRight: "8px",
            }}
          >
            <Filter size={14} /> FILTER TYPE:
          </span>

          <button
            onClick={() => setSelectedTypeFilter("ALL")}
            style={{
              backgroundColor:
                selectedTypeFilter === "ALL" ? "#f59e0b" : "#1e293b",
              color: selectedTypeFilter === "ALL" ? "#0f172a" : "#94a3b8",
              border: "1px solid #334155",
              padding: "6px 14px",
              borderRadius: "20px",
              fontWeight: "800",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            ALL ACTIVE ({incidents.length})
          </button>

          {Object.entries(typeCounts).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setSelectedTypeFilter(type)}
              style={{
                backgroundColor:
                  selectedTypeFilter === type ? "#f59e0b" : "#1e293b",
                color: selectedTypeFilter === type ? "#0f172a" : "#94a3b8",
                border: "1px solid #334155",
                padding: "6px 14px",
                borderRadius: "20px",
                fontWeight: "800",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {type} ({count})
            </button>
          ))}
        </div>

        {/* Empty State */}
        {filteredIncidents.length === 0 && !loading && (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
              backgroundColor: "#1e293b",
              borderRadius: "20px",
              border: "1px dashed #334155",
              color: "#94a3b8",
            }}
          >
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
            gap: "24px",
          }}
        >
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
              <div
                key={incident.id}
                style={{
                  backgroundColor: "#1e293b",
                  border: `1px solid ${theme.border}`,
                  borderRadius: "20px",
                  overflow: "hidden",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Header Banner */}
                <div
                  style={{
                    backgroundColor: theme.headerBg,
                    padding: "14px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <span
                    style={{
                      fontWeight: "900",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: theme.accentText,
                      letterSpacing: "0.5px",
                    }}
                  >
                    <HeaderIcon size={18} className="animate-pulse" />
                    {theme.label}: {incident.type?.toUpperCase()}
                  </span>

                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "800",
                      backgroundColor: "rgba(0,0,0,0.4)",
                      color: "#cbd5e1",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    {new Date(incident.created).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div
                  style={{
                    padding: "20px",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Reporter Info */}
                  <div
                    style={{
                      backgroundColor: "#0f172a",
                      padding: "14px",
                      borderRadius: "14px",
                      border: "1px solid #334155",
                      marginBottom: "14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "10px",
                      }}
                    >
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "12px",
                          backgroundColor: "#1e1b4b",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#818cf8",
                        }}
                      >
                        <User size={22} />
                      </div>
                      <div>
                        <span
                          style={{
                            display: "block",
                            fontWeight: "800",
                            fontSize: "15px",
                            color: "#f8fafc",
                          }}
                        >
                          {reporter?.first_name} {reporter?.last_name || "Citizen"}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            color: "#34d399",
                            fontSize: "11px",
                            fontWeight: "700",
                          }}
                        >
                          <ShieldCheck size={12} /> Verified Caller
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        color: "#94a3b8",
                        fontWeight: "600",
                      }}
                    >
                      <Phone size={14} color="#818cf8" />
                      {reporter?.contact_number || "No Contact Number"}
                    </div>
                  </div>

                  {/* Deployed Responder Banner */}
                  <div
                    style={{
                      backgroundColor: "rgba(30, 41, 59, 0.8)",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      marginBottom: "16px",
                      border: `1px solid ${theme.border}`,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Activity color={theme.accentText} size={16} />
                    <span
                      style={{
                        color: "#f8fafc",
                        fontWeight: "800",
                        fontSize: "12px",
                        letterSpacing: "0.3px",
                      }}
                    >
                      DEPLOYED UNIT:{" "}
                      <span style={{ color: theme.accentText }}>
                        {responder?.department?.toUpperCase() || "LOCAL RESPONDERS"}
                      </span>
                    </span>
                  </div>

                  {/* Location & Map Preview */}
                  <div style={{ marginBottom: "20px" }}>
                    <p
                      style={{
                        margin: "0 0 10px 0",
                        fontSize: "13px",
                        fontWeight: "700",
                        color: "#60a5fa",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8px",
                        lineHeight: "1.4",
                      }}
                    >
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
                      style={{
                        width: "100%",
                        height: "140px",
                        borderRadius: "14px",
                        overflow: "hidden",
                        border: "1px solid #334155",
                        position: "relative",
                        cursor: "zoom-in",
                      }}
                    >
                      <iframe
                        title="Incident Location Preview"
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        scrolling="no"
                        src={`https://maps.google.com/maps?q=${incident.latitude},${incident.longitude}&z=16&output=embed&iwloc=near`}
                        style={{ border: 0, pointerEvents: "none" }}
                      ></iframe>
                      <div
                        style={{
                          position: "absolute",
                          bottom: "8px",
                          right: "8px",
                          backgroundColor: "#0f172a",
                          color: "#38bdf8",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          fontSize: "10px",
                          fontWeight: "800",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          border: "1px solid #334155",
                        }}
                      >
                        <Maximize2 size={12} /> ENLARGE MAP
                      </div>
                    </div>
                  </div>

                  {/* Media Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                    }}
                  >
                    {/* Image Preview */}
                    <div
                      style={{
                        border: "1px solid #334155",
                        borderRadius: "12px",
                        overflow: "hidden",
                        height: "120px",
                        position: "relative",
                        cursor: imgUrl ? "zoom-in" : "default",
                        backgroundColor: "#0f172a",
                      }}
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
                        <div
                          style={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#475569",
                          }}
                        >
                          <ImageIcon size={24} />
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: "700",
                              marginTop: "4px",
                            }}
                          >
                            NO PHOTO
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Video Preview */}
                    <div
                      style={{
                        border: "1px solid #334155",
                        borderRadius: "12px",
                        overflow: "hidden",
                        height: "120px",
                        position: "relative",
                        cursor: videoUrl ? "zoom-in" : "default",
                        backgroundColor: "#0f172a",
                      }}
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
                        <div
                          style={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#475569",
                          }}
                        >
                          <Activity size={24} />
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: "700",
                              marginTop: "4px",
                            }}
                          >
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

      {/* 🗺️ MODAL: FULLSCREEN MAP */}
      {selectedMap && (
        <div
          onClick={() => setSelectedMap(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(11, 15, 25, 0.95)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "30px",
            backdropFilter: "blur(10px)",
            cursor: "zoom-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "90vw",
              maxWidth: "1000px",
              backgroundColor: "#1e293b",
              borderRadius: "24px",
              overflow: "hidden",
              border: "1px solid #334155",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
              cursor: "default",
            }}
          >
            <div
              style={{
                padding: "20px 28px",
                borderBottom: "1px solid #334155",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
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
                style={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  color: "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
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
                src={`https://maps.google.com/maps?q=${selectedMap.lat},${selectedMap.lng}&z=17&output=embed&t=h`}
                style={{ border: 0 }}
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}

      {/* 🖼️ MODAL: MEDIA VIEWER */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(11, 15, 25, 0.98)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "30px",
            backdropFilter: "blur(12px)",
            cursor: "zoom-out",
          }}
        >
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
              style={{
                position: "absolute",
                top: "-20px",
                right: "-20px",
                backgroundColor: "#ef4444",
                color: "white",
                border: "none",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)",
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}