import React, { useState, useEffect } from 'react';
import { pb } from './pocketbase';
import Sidebar from './Sidebar';
import { getReadableAddress } from './utils'; // Your custom high-speed tool!
import { 
  AlertTriangle, MapPin, User, ImageIcon, 
  Activity, X, RefreshCw, Phone, Calendar, 
  ShieldCheck, Maximize2, Map as MapIcon, CheckCircle
} from 'lucide-react';

export default function OngoingIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  const [filters, setFilters] = useState({ type: '', department: '' });

  const getIncidentTheme = (type) => {
    const normalized = (type || '').toLowerCase();
    if (normalized === 'fire') {
      return {
        header: '#ef4444',
        border: '#dc2626',
        soft: '#fef2f2',
        softBorder: '#fecaca',
        softText: '#991b1b',
        icon: AlertTriangle,
        label: 'ACTIVE FIRE',
      };
    }

    if (normalized === 'landslide') {
      return {
        header: '#8b5cf6',
        border: '#7c3aed',
        soft: '#f5f3ff',
        softBorder: '#ddd6fe',
        softText: '#5b21b6',
        icon: AlertTriangle,
        label: 'ACTIVE LANDSLIDE',
      };
    }

    return {
      header: '#f59e0b',
      border: '#d97706',
      soft: '#fef3c7',
      softBorder: '#fde68a',
      softText: '#b45309',
      icon: Activity,
      label: 'ACTIVE INCIDENT',
    };
  };


  // 1. Fetching ONLY "ongoing" incidents
  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const records = await pb.collection('incident_reports').getFullList({
        filter: 'status = "ongoing"', 
        sort: '-created',
        expand: 'users,responders', 
        requestKey: null
      });
      setIncidents(records);
      await resolveAddresses(records);
    } catch (error) {
      if (!error.isAbort) console.error("Fetch error:", error);
    }
    setLoading(false);
  };

  // 2. NEW Address Resolver: Clean, fast, and uses the shared cache queue!
  const resolveAddresses = async (records) => {
    const pendingAddresses = records.filter(
      record => record.latitude != null && record.longitude != null && !addresses[record.id]
    );

    if (pendingAddresses.length === 0) return;

    const resolved = await Promise.all(
      pendingAddresses.map(async (record) => [
        record.id,
        await getReadableAddress(record.latitude, record.longitude),
      ])
    );

    setAddresses(prev => ({ ...prev, ...Object.fromEntries(resolved) }));
  };

  const filteredIncidents = incidents.filter((incident) => {
    const responderDept = incident.expand?.responders?.department || '';

    if (filters.type && incident.type?.toLowerCase() !== filters.type) return false;
    if (filters.department && responderDept.toLowerCase() !== filters.department.toLowerCase()) return false;

    return true;
  });

  // 3. Real-time listener for ongoing updates
  useEffect(() => {
    let isMounted = true;
    let unsubscribe;
    if (isMounted) fetchIncidents();

    const startSubscription = async () => {
      unsubscribe = await pb.collection('incident_reports').subscribe('*', (e) => {
        if (isMounted && (e.action === 'create' || e.record.status === 'ongoing')) {
          fetchIncidents();
        }
      });
    };

    startSubscription();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);


  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '40px', marginLeft: '260px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a', letterSpacing: '-1px' }}>ONGOING DISPATCHES</h1>
            <p style={{ color: '#d97706', fontSize: '15px', fontWeight: '700' }}>Tracking active emergencies and deployed units in Lagonglong</p>
          </div>
          <button onClick={fetchIncidents} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '12px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: '800', fontSize: '13px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> REFRESH LIST
          </button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: 'white', color: '#1f2937', fontWeight: 700 }}>
            <option value="">All Types</option>
            {[...new Set(incidents.map((incident) => incident.type?.toLowerCase()).filter(Boolean))].map((type) => (
              <option key={type} value={type}>{type.toUpperCase()}</option>
            ))}
          </select>

          
        </div>

        {filteredIncidents.length === 0 && !loading && (
           <div style={{ textAlign: 'center', padding: '100px 0', color: '#64748b' }}>
              <CheckCircle size={64} color="#10b981" style={{ marginBottom: '20px', opacity: 0.5 }} />
              <h2>No Ongoing Incidents</h2>
              <p>All deployed units have completed their tasks. The municipality is safe.</p>
           </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '20px' }}>
          {filteredIncidents.map((incident) => {
            const reporter = incident.expand?.users;
            const responder = incident.expand?.responders;
            const imgUrl = incident.incident_image ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_image}` : null;
            const videoUrl = incident.incident_video ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_video}` : null;
            const theme = getIncidentTheme(incident.type);
            const HeaderIcon = theme.icon;

            return (
              <div key={incident.id} style={{ backgroundColor: 'white', border: `2px solid ${theme.border}`, borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                
                <div style={{ backgroundColor: theme.header, padding: '16px 22px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '900', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <HeaderIcon size={20} className="animate-pulse" /> {theme.label}: {incident.type.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '12px' }}>
                    {new Date(incident.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div style={{ padding: '22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  
                  {/* Reporter Box */}
                  <div style={{ border: '1px solid #f1f5f9', backgroundColor: '#f8fafc', padding: '18px', borderRadius: '20px', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                        <User size={28} />
                      </div>
                      <div>
                        <span style={{ display: 'block', fontWeight: '900', fontSize: '18px', color: '#1e293b' }}>{reporter?.first_name} {reporter?.last_name || 'Citizen'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', fontSize: '12px', fontWeight: '700' }}>
                          <ShieldCheck size={14} /> Verified User
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={16} color="#4f46e5" /> {reporter?.contact_number || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Deployed Responder Status */}
                  <div style={{ backgroundColor: theme.soft, padding: '14px 18px', borderRadius: '14px', marginBottom: '20px', border: `1px solid ${theme.softBorder}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                     <AlertTriangle color={theme.softText} size={20} />
                     <span style={{ color: theme.softText, fontWeight: '800', fontSize: '14px' }}>
                       UNIT DEPLOYED: {responder ? responder.department.toUpperCase() : "Local Responders"}
                     </span>
                  </div>

                  {/* Location & Clickable Map Preview */}
                  <div style={{ marginBottom: '25px' }}>
                    <p style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '900', color: '#1e40af', display: 'flex', alignItems: 'start', gap: '10px', lineHeight: '1.4' }}>
                      <MapPin size={20} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                      {addresses[incident.id] || "Locating..."}
                    </p>
                    
                    <div onClick={() => setSelectedMap({ lat: incident.latitude, lng: incident.longitude, address: addresses[incident.id] })} style={{ width: '100%', height: '160px', borderRadius: '20px', overflow: 'hidden', border: '1px solid #dbeafe', position: 'relative', cursor: 'zoom-in' }}>
                      <iframe title="Map Preview" width="100%" height="100%" frameBorder="0" scrolling="no" src={`https://maps.google.com/maps?q=${incident.latitude},${incident.longitude}&z=16&output=embed&iwloc=near`} style={{ border: 0, pointerEvents: 'none' }}></iframe>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.01)' }}></div>
                      <div style={{ position: 'absolute', bottom: '12px', right: '12px', backgroundColor: 'white', padding: '8px 16px', borderRadius: '12px', fontSize: '11px', fontWeight: '900', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <Maximize2 size={14} /> ENLARGE LIVE MAP
                      </div>
                    </div>
                  </div>

                  {/* Media Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '18px', overflow: 'hidden', height: '140px', position: 'relative', cursor: 'zoom-in', backgroundColor: '#f8fafc' }} onClick={() => setSelectedImage(imgUrl)}>
                      {imgUrl ? <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Evidence" /> : <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}><ImageIcon size={28} /><span style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '5px' }}>NO PHOTO</span></div>}
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '18px', overflow: 'hidden', height: '140px', position: 'relative', cursor: 'zoom-in', backgroundColor: '#f8fafc' }} onClick={() => setSelectedImage(videoUrl)}>
                      {videoUrl ? <video src={videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted onMouseOver={e => e.target.play()} onMouseOut={e => e.target.pause()} /> : <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}><Activity size={28} /><span style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '5px' }}>NO VIDEO</span></div>}
                    </div>
                  </div>

                  {/* Resolution Button (Restored!) */}
                  <div style={{ display: 'flex', marginTop: 'auto' }}>
                   
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 🗺️ MODAL: FULLSCREEN MAP */}
      {selectedMap && (
        <div onClick={() => setSelectedMap(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', backdropFilter: 'blur(12px)', cursor: 'zoom-out' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '90vw', maxWidth: '1100px', backgroundColor: 'white', borderRadius: '40px', overflow: 'hidden', cursor: 'default', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '25px 40px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                   <MapIcon size={24} color="#2563eb" /> INTERACTIVE INCIDENT LOCATION
                </h2>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontWeight: '600' }}>{selectedMap.address}</p>
              </div>
              <button onClick={() => setSelectedMap(null)} style={{ backgroundColor: '#f1f5f9', border: 'none', width: '45px', height: '45px', borderRadius: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={24} color="#64748b" />
              </button>
            </div>
            <div style={{ width: '100%', height: '65vh', backgroundColor: '#f8fafc' }}>
              <iframe title="Full Map" width="100%" height="100%" frameBorder="0" src={`https://maps.google.com/maps?q=${selectedMap.lat},${selectedMap.lng}&z=17&output=embed&t=h`} style={{ border: 0 }} allowFullScreen></iframe>
            </div>
          </div>
        </div>
      )}

      {/* 🖼️ MODAL: MEDIA */}
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.98)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', backdropFilter: 'blur(10px)', cursor: 'zoom-out' }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {selectedImage.toLowerCase().includes('.mp4') ? (
              <video src={selectedImage} controls autoPlay style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()} />
            ) : (
              <img src={selectedImage} style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', objectFit: 'contain' }} alt="Evidence" />
            )}
            <button style={{ position: 'absolute', top: '0', right: '0', backgroundColor: '#ef4444', color: 'white', border: 'none', width: '50px', height: '50px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={24} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
