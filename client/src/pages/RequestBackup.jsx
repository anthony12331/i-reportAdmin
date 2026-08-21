import React, { useState, useEffect } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { requestBackupStyles as styles } from "../themes/requestBackupStyles";
import { useMessageBox } from "../components/MessageBox";
import {
  ShieldAlert,
  User,
  Radio,
  Clock,
  CheckCircle,
  Siren,
  MapPin,
  Map as MapIcon,
  X
} from "lucide-react";

export default function RequestBackup() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableResponders, setAvailableResponders] = useState([]);
  const [selectedResponderIds, setSelectedResponderIds] = useState({});
  const [processingId, setProcessingId] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  
  const { confirm, showAlert } = useMessageBox();

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const records = await pb.collection("backup_requests").getFullList({
        filter: 'dispatch_status = "pending"',
        sort: "-created",
        expand: "requester_id,incident_id,sos_id",
      });
      setBackups(records);
    } catch (err) {
      console.error("Fetch backups error:", err);
    }
    setLoading(false);
  };

  const fetchAvailableResponders = async () => {
    try {
      const responders = await pb.collection("responder_accounts").getFullList({
        filter: "is_available = true",
        sort: "department, first_name",
      });
      setAvailableResponders(responders);
    } catch (err) {
      console.error("Fetch responders error:", err);
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchAvailableResponders();

    let unsubscribeBackups;
    let unsubscribeResponders;

    const setupSubscriptions = async () => {
      unsubscribeBackups = await pb.collection("backup_requests").subscribe("*", () => {
        fetchBackups();
      });
      unsubscribeResponders = await pb.collection("responder_accounts").subscribe("*", () => {
        fetchAvailableResponders();
      });
    };

    setupSubscriptions();

    return () => {
      if (unsubscribeBackups) unsubscribeBackups();
      if (unsubscribeResponders) unsubscribeResponders();
    };
  }, []);

  const handleDispatch = async (backupId) => {
    const responderId = selectedResponderIds[backupId];
    if (!responderId) {
      showAlert("Please select a responder to dispatch.");
      return;
    }

    const backup = backups.find((b) => b.id === backupId);
    const responder = availableResponders.find((r) => r.id === responderId);

    const isConfirmed = await confirm(
      `Dispatch backup?`,
      `Are you sure you want to dispatch ${responder.unit_name || responder.first_name} to provide backup?`
    );

    if (!isConfirmed) return;

    setProcessingId(backupId);
    try {
      // 1. Update the backup request
      await pb.collection("backup_requests").update(backupId, {
        assigned_responder: responderId,
        dispatch_status: "assigned",
      });

      // 2. Create a dispatch record to link them officially
      await pb.collection("dispatches").create({
        incident_id: backup.incident_id || null,
        sos_id: backup.sos_id || null,
        responder_id: responderId,
        department: responder.department,
        status: "pending",
      });

      showAlert("Backup Dispatched", "success");
      
      // Update local state temporarily
      setBackups((prev) => prev.filter((b) => b.id !== backupId));
    } catch (error) {
      console.error("Dispatch error:", error);
      showAlert("Failed to dispatch backup unit.");
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
              <ShieldAlert size={28} color="#ef4444" />
              Backup Requests
            </h1>
            <p style={styles.subtitle}>Manage pending backup calls from units on the field</p>
          </div>
        </header>

        <div style={styles.cardGrid}>
          {!loading && backups.length === 0 && (
            <div style={styles.emptyState}>
              <CheckCircle size={48} style={styles.emptyIcon} />
              <p style={styles.emptyText}>No pending backup requests at this time.</p>
            </div>
          )}

              {backups.map((backup) => {
                const requester = backup.expand?.requester_id;
                const reqName = requester ? (requester.unit_name || `${requester.first_name} ${requester.last_name}`) : "Unknown Unit";
                
                return (
                  <div key={backup.id} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <div>
                        <h3 style={styles.requesterName}>{reqName}</h3>
                        <div style={styles.metaText}>
                          <User size={14} /> Requested Backup
                        </div>
                      </div>
                      <span style={styles.departmentTag(backup.department)}>
                        {backup.department || "ANY DEPT"}
                      </span>
                    </div>

                    <div style={styles.metaText}>
                      <Clock size={14} /> 
                      {new Date(backup.created).toLocaleString()}
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

                    {backup.reason && (
                      <div style={styles.reasonBox}>
                        <strong>Reason:</strong><br />
                        {backup.reason}
                      </div>
                    )}

                    <div style={{ marginTop: "auto" }}>
                      <select
                        style={styles.selectBox}
                        value={selectedResponderIds[backup.id] || ""}
                        onChange={(e) =>
                          setSelectedResponderIds({
                            ...selectedResponderIds,
                            [backup.id]: e.target.value,
                          })
                        }
                      >
                        <option value="" disabled>Select Backup Unit...</option>
                        {availableResponders
                          .filter(r => !backup.department || r.department === backup.department || backup.department === "ANY")
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              [{r.department?.toUpperCase()}] {r.unit_name || `${r.first_name} ${r.last_name}`}
                            </option>
                        ))}
                        {availableResponders.length > 0 && backup.department && (
                           <optgroup label="Other Available Units">
                             {availableResponders
                               .filter(r => r.department !== backup.department)
                               .map((r) => (
                               <option key={r.id} value={r.id}>
                                 [{r.department?.toUpperCase()}] {r.unit_name || `${r.first_name} ${r.last_name}`}
                               </option>
                             ))}
                           </optgroup>
                        )}
                      </select>

                      <button
                        onClick={() => handleDispatch(backup.id)}
                        disabled={processingId === backup.id || !selectedResponderIds[backup.id]}
                        style={styles.dispatchBtn(processingId === backup.id || !selectedResponderIds[backup.id])}
                      >
                        <Siren size={16} />
                        {processingId === backup.id ? "DISPATCHING..." : "DISPATCH BACKUP"}
                      </button>
                    </div>
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
