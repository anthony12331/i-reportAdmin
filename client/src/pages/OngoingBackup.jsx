import React, { useState, useEffect } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { ongoingBackupStyles as styles } from "../themes/ongoingBackupStyles";
import { useMessageBox } from "../components/MessageBox";
import {
  ShieldAlert,
  User,
  Radio,
  Clock,
  CheckCircle,
  Siren,
  Truck,
  Activity,
  MapPin,
  Map as MapIcon,
  X
} from "lucide-react";

export default function OngoingBackup() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  
  const { confirm, showAlert } = useMessageBox();

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const records = await pb.collection("backup_requests").getFullList({
        filter: 'dispatch_status != "pending" && dispatch_status != "completed" && dispatch_status != "declined"',
        sort: "-created",
        expand: "requester_id,incident_id,sos_id,assigned_responder",
      });
      setBackups(records);
    } catch (err) {
      console.error("Fetch backups error:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBackups();

    let unsubscribeBackups;

    const setupSubscriptions = async () => {
      unsubscribeBackups = await pb.collection("backup_requests").subscribe("*", () => {
        fetchBackups();
      });
    };

    setupSubscriptions();

    return () => {
      if (unsubscribeBackups) unsubscribeBackups();
    };
  }, []);

  const handleResolve = async (backupId) => {
    const isConfirmed = await confirm(
      `Complete Backup?`,
      `Are you sure you want to mark this backup as completed?`
    );

    if (!isConfirmed) return;

    setProcessingId(backupId);
    try {
      await pb.collection("backup_requests").update(backupId, {
        dispatch_status: "completed",
      });

      showAlert("Backup marked as completed.", "success");
      setBackups((prev) => prev.filter((b) => b.id !== backupId));
    } catch (error) {
      console.error("Resolve error:", error);
      showAlert("Failed to complete backup.");
    }
    setProcessingId(null);
  };

  return (
    <div style={styles.container}>
      <Sidebar />

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>
              <Activity size={28} color="#3b82f6" />
              Ongoing Backups
            </h1>
            <p style={styles.subtitle}>Monitor dispatched backup units that are currently active in the field</p>
          </div>
        </header>

        <div style={styles.cardGrid}>
          {!loading && backups.length === 0 && (
            <div style={styles.emptyState}>
              <CheckCircle size={48} style={styles.emptyIcon} />
              <p style={styles.emptyText}>No ongoing backups at the moment.</p>
            </div>
          )}

          {backups.map((backup) => {
            const requester = backup.expand?.requester_id;
            const responder = backup.expand?.assigned_responder;
            const reqName = requester ? (requester.unit_name || `${requester.first_name} ${requester.last_name}`) : "Unknown Unit";
            const resName = responder ? (responder.unit_name || `${responder.first_name} ${responder.last_name}`) : "Pending Responder";
            
            return (
              <div key={backup.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h3 style={styles.requesterName}>Requested By: {reqName}</h3>
                    <div style={styles.metaText}>
                      <User size={14} /> {backup.department || "ANY DEPT"} Backup Requested
                    </div>
                  </div>
                  <span style={styles.statusBadge(backup.dispatch_status)}>
                    {backup.dispatch_status.replace("_", " ")}
                  </span>
                </div>

                <div style={styles.metaText}>
                  <Clock size={14} /> 
                  Requested: {new Date(backup.created).toLocaleString()}
                </div>

                {requester?.latitude != null && requester?.longitude != null ? (
                    <>
                      <div style={styles.metaText}>
                        <MapPin size={14} color="#3b82f6" /> 
                        <span>Location: {requester.latitude.toFixed(6)}, {requester.longitude.toFixed(6)}</span>
                      </div>
                      <div
                        style={styles.miniMapContainer}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMap({ lat: requester.latitude, lng: requester.longitude, address: `Backup Request Location (${requester.latitude.toFixed(6)}, ${requester.longitude.toFixed(6)})` });
                        }}
                      >
                        <iframe
                          title={`Map for backup request ${backup.id}`}
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          loading="lazy" 
                          referrerPolicy="no-referrer-when-downgrade" 
                          src={`https://maps.google.com/maps?q=${requester.latitude},${requester.longitude}&z=15&output=embed`}
                          style={{ pointerEvents: "none" }}
                        />
                        <span style={styles.mapHoverTag}>ENLARGE MAP</span>
                      </div>
                    </>
                  ) : (
                    <div style={styles.metaText}>
                      <MapPin size={14} color="#94a3b8" /> 
                      Location: Unknown
                    </div>
                  )}

                {backup.incident_id && (
                  <div style={styles.metaText}>
                    <Radio size={14} color="#f97316" /> Incident ID: {backup.incident_id}
                  </div>
                )}
                {backup.sos_id && (
                  <div style={styles.metaText}>
                    <Siren size={14} color="#ef4444" /> SOS ID: {backup.sos_id}
                  </div>
                )}

                <div style={styles.responderBox}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: '#3b82f6' }}>
                    <Truck size={16} /> Dispatched Unit
                  </strong>
                  <div style={{ color: '#f8fafc', fontSize: '15px' }}>{resName}</div>
                  <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '2px' }}>
                    Dept: {responder?.department?.toUpperCase() || 'N/A'}
                  </div>
                </div>

                <button
                  onClick={() => handleResolve(backup.id)}
                  disabled={processingId === backup.id}
                  style={styles.resolveBtn}
                >
                  <CheckCircle size={16} />
                  {processingId === backup.id ? "COMPLETING..." : "MARK COMPLETED"}
                </button>
              </div>
            );
          })}
        </div>
      </main>

      {/* MODAL: MAP FULLSCREEN */}
      {selectedMap && (
        <div style={styles.modalBackdrop} onClick={() => setSelectedMap(null)}>
          <div style={styles.modalWindow} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontSize: '16px' }}><MapIcon size={18} color="#38bdf8" /> {selectedMap.address}</h3>
              <button onClick={() => setSelectedMap(null)} style={styles.closeBtn}><X size={18} /></button>
            </div>
            <iframe
              title="Full Map"
              width="100%"
              height="500px"
              frameBorder="0"
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade" 
              src={`https://maps.google.com/maps?q=${selectedMap.lat},${selectedMap.lng}&z=17&output=embed&t=h`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
