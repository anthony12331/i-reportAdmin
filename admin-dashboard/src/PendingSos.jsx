import React, { useState, useEffect } from 'react';
import { pb } from './pocketbase';
import Sidebar from './Sidebar';
import { getReadableAddress } from './utils';
import { ui } from './uiStyles';
import SosRoutingTracker from './SosRoutingTracker'; 
import { MapPin, User, X, RefreshCw, Phone, Radio, CheckCircle } from 'lucide-react';

export default function PendingSos() {
  const [sosSignals, setSosSignals] = useState([]);
  const [addresses, setAddresses] = useState({});
  const [selectedMap, setSelectedMap] = useState(null); 
  const [loading, setLoading] = useState(false);

  // Initial load or manual refresh
  const fetchSosSignals = async () => {
    setLoading(true);
    try {
      const records = await pb.collection('sos_tracking').getFullList({
        filter: 'status = "active"',
        sort: '-created',
        expand: 'user', 
        requestKey: null 
      });
      setSosSignals(records);
      resolveAddresses(records);
    } catch (e) { 
      console.error("Fetch SOS error:", e); 
    }
    setLoading(false);
  };

  const resolveAddresses = async (records) => {
    const newAddresses = { ...addresses };
    for (const r of records.filter(r => r.latitude && !addresses[r.id])) {
      newAddresses[r.id] = await getReadableAddress(r.latitude, r.longitude);
    }
    setAddresses(newAddresses);
  };

  // Mark an emergency record as resolved
  const handleResolve = async (id) => {
    if (!window.confirm("Are you sure you want to mark this emergency as resolved?")) return;

    try {
      await pb.collection('sos_tracking').update(id, { status: 'resolved' });
      
      if (selectedMap?.id === id) {
        setSelectedMap(null);
      }
      setSosSignals(prev => prev.filter(item => item.id !== id));
    } catch (e) {
      console.error("Error resolving SOS case:", e);
      alert("Failed to resolve emergency record.");
    }
  };

  // High-performance, Realtime Event Stream Connection
  useEffect(() => {
    fetchSosSignals();

    const handleRealtimeUpdate = async (e) => {
      const { action, record } = e;

      if (action === 'delete' || (action === 'update' && record.status !== 'active')) {
        // If deleted or changed status away from "active", instantly pop it out of view
        setSosSignals(prev => prev.filter(item => item.id !== record.id));
        setSelectedMap(current => current?.id === record.id ? null : current);
      } 
      
      else if (action === 'update' && record.status === 'active') {
        // CRITICAL REAL-TIME FIX: Patch modified coordinates directly into local state instantly
        setSosSignals(prev => prev.map(item => {
          if (item.id === record.id) {
            // Keep existing expand properties intact while swapping dynamic coordinates
            return { ...item, latitude: record.latitude, longitude: record.longitude };
          }
          return item;
        }));

        // Keep full-screen popup modal in perfect sync if it is currently open
        setSelectedMap(current => {
          if (current?.id === record.id) {
            return { ...current, latitude: record.latitude, longitude: record.longitude };
          }
          return current;
        });

        // Resolve geocoding address only if coordinates moved significantly or are new
        if (record.latitude && !addresses[record.id]) {
          const readable = await getReadableAddress(record.latitude, record.longitude);
          setAddresses(prev => ({ ...prev, [record.id]: readable }));
        }
      } 
      
      else if (action === 'create' && record.status === 'active') {
        // Handle brand-new inbound SOS distress logs immediately
        try {
          const freshRecord = await pb.collection('sos_tracking').getOne(record.id, { expand: 'user' });
          setSosSignals(prev => [freshRecord, ...prev]);
          const readable = await getReadableAddress(freshRecord.latitude, freshRecord.longitude);
          setAddresses(prev => ({ ...prev, [freshRecord.id]: readable }));
        } catch (err) {
          console.error("Error fetching newly created record metadata:", err);
        }
      }
    };

    // Listen to collection stream changes reactively
    const unsub = pb.collection('sos_tracking').subscribe('*', handleRealtimeUpdate);

    return () => { 
      unsub.then(u => u?.()); 
    };
  }, []);

  return (
    <div style={ui.shell}>
      <Sidebar />
      <main style={ui.main}>
        <header style={styles.header}>
          <h1 style={ui.pageTitle}>Live SOS Feed</h1>
          <button onClick={fetchSosSignals} style={styles.refreshBtn} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} style={{ marginRight: '5px' }} /> 
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </header>

        <div style={ui.contentGrid}>
          {sosSignals.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#666' }}>
              No active distress calls found.
            </div>
          ) : (
            sosSignals.map((sos) => (
              <div key={sos.id} style={styles.card}>
                <div style={styles.cardHeader}><Radio size={16} /> ACTIVE DISTRESS</div>
                <div style={styles.cardBody}>
                  <div style={styles.profileBox}>
                    <User size={30} color="#dc2626" />
                    <div>
                      <h3 style={{ margin: 0 }}>
                        {sos.expand?.user?.first_name || 'Resident'} {sos.expand?.user?.last_name || ''}
                      </h3>
                      <p style={styles.subText}><Phone size={12} /> {sos.expand?.user?.contact_number || 'No contact'}</p>
                    </div>
                  </div>
                  <p style={styles.location}>
                    <MapPin size={16} color="#dc2626" /> {addresses[sos.id] || "Locating..."}
                  </p>
                  
                  {/* Direct Map Preview Container */}
                  <div onClick={() => setSelectedMap(sos)} style={styles.mapContainer}>
                    <SosRoutingTracker targetLat={sos.latitude} targetLng={sos.longitude} />
                    <div style={styles.overlay}>CLICK FOR FULL ROUTE</div>
                  </div>

                  {/* Resolve Trigger Button */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); // Stop click from opening full map modal
                      handleResolve(sos.id);
                    }} 
                    style={styles.resolveBtn}
                  >
                    <CheckCircle size={16} /> Mark as Resolved
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* FULL SCREEN MODAL */}
      {selectedMap && (
        <div style={styles.modalOverlay} onClick={() => setSelectedMap(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedMap(null)} style={styles.closeBtn}><X size={24} /></button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingRight: '40px' }}>
              <h2 style={{ color: '#dc2626', margin: 0 }}>EMERGENCY DISPATCH ROUTE</h2>
              <button 
                onClick={() => handleResolve(selectedMap.id)} 
                style={{...styles.resolveBtn, marginTop: 0, width: 'auto', padding: '10px 20px'}}
              >
                <CheckCircle size={16} /> Mark Case Resolved
              </button>
            </div>
            <div style={{ width: '100%', height: 'calc(100% - 65px)' }}>
              <SosRoutingTracker targetLat={selectedMap.latitude} targetLng={selectedMap.longitude} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  card: { background: '#fff', borderRadius: '12px', border: '2px solid #ef4444', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', overflow: 'hidden' },
  cardHeader: { background: '#ef4444', color: '#fff', padding: '8px 15px', fontSize: '12px', fontWeight: 'bold', display: 'flex', gap: '5px', alignItems: 'center' },
  cardBody: { padding: '15px' },
  profileBox: { display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' },
  location: { fontSize: '0.85rem', fontWeight: '600', marginBottom: '15px', color: '#333', display: 'flex', alignItems: 'center', gap: '4px' },
  mapContainer: { height: '180px', borderRadius: '8px', overflow: 'hidden', position: 'relative', cursor: 'pointer', marginBottom: '12px' },
  overlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', zIndex: 5, transition: 'background 0.2s' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal: { background: '#fff', padding: '25px', borderRadius: '20px', width: '90%', height: '80%', maxWidth: '1000px', position: 'relative' },
  closeBtn: { position: 'absolute', top: '22px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', color: '#333', zIndex: 10 },
  subText: { fontSize: '0.8rem', color: '#666', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' },
  refreshBtn: { padding: '8px 12px', borderRadius: '6px', border: 'none', background: '#333', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' },
  resolveBtn: { 
    width: '100%', 
    padding: '10px 0', 
    background: '#16a34a', 
    color: '#fff', 
    border: 'none', 
    borderRadius: '6px', 
    fontWeight: 'bold', 
    fontSize: '0.9rem', 
    cursor: 'pointer', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: '6px',
    transition: 'background 0.2s',
    marginTop: '5px'
  }
};