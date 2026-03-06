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
    const newAddresses = { ...addresses };
    let hasChanged = false;

    for (const record of records) {
      if (record.latitude && record.longitude && !newAddresses[record.id]) {
        // Automatically queues the request to prevent 429 errors!
        newAddresses[record.id] = await getReadableAddress(record.latitude, record.longitude);
        hasChanged = true;
      }
    }
    if (hasChanged) {
      setAddresses(newAddresses);
    }
  };

  // 3. Real-time listener for ongoing updates
  useEffect(() => {
    let isMounted = true;
    if (isMounted) fetchIncidents();

    pb.collection('incident_reports').subscribe('*', (e) => {
      if (isMounted && (e.action === 'create' || e.record.status === 'ongoing')) {
        fetchIncidents(); 
      }
    });

    return () => {
      isMounted = false;
      pb.collection('incident_reports').unsubscribe('*');
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
          <button onClick={fetchIncidents} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '14px 28px', borderRadius: '16px', border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: '800', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} /> REFRESH LIST
          </button>
        </header>

        {incidents.length === 0 && !loading && (
           <div style={{ textAlign: 'center', padding: '100px 0', color: '#64748b' }}>
              <CheckCircle size={64} color="#10b981" style={{ marginBottom: '20px', opacity: 0.5 }} />
              <h2>No Ongoing Incidents</h2>
              <p>All deployed units have completed their tasks. The municipality is safe.</p>
           </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: '30px' }}>
          {incidents.map((incident) => {
            const reporter = incident.expand?.users;
            const responder = incident.expand?.responders;
            const imgUrl = incident.incident_image ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_image}` : null;
            const videoUrl = incident.incident_video ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_video}` : null;

            return (
              <div key={incident.id} style={{ backgroundColor: 'white', border: '2px solid #f59e0b', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                
                <div style={{ backgroundColor: '#f59e0b', padding: '20px 30px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '900', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Activity size={24} className="animate-pulse" /> ACTIVE: {incident.type.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '12px' }}>
                    {new Date(incident.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div style={{ padding: '30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  
                  {/* Reporter Box */}
                  <div style={{ border: '1px solid #f1f5f9', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '24px', marginBottom: '15px' }}>
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
                  <div style={{ backgroundColor: '#fef3c7', padding: '15px 20px', borderRadius: '16px', marginBottom: '25px', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                     <AlertTriangle color="#d97706" size={20} />
                     <span style={{ color: '#b45309', fontWeight: '800', fontSize: '14px' }}>
                       UNIT DEPLOYED: {responder ? responder.department.toUpperCase() : "Local Responders"}
                     </span>
                  </div>

                  {/* Location & Clickable Map Preview */}
                  <div style={{ marginBottom: '25px' }}>
                    <p style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '900', color: '#1e40af', display: 'flex', alignItems: 'start', gap: '10px', lineHeight: '1.4' }}>
                      <MapPin size={20} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                      {addresses[incident.id] || "Locating..."}
                    </p>
                    
                    <div onClick={() => setSelectedMap({ lat: incident.latitude, lng: incident.longitude, address: addresses[incident.id] })} style={{ width: '100%', height: '180px', borderRadius: '24px', overflow: 'hidden', border: '1px solid #dbeafe', position: 'relative', cursor: 'zoom-in' }}>
                      <iframe title="Map Preview" width="100%" height="100%" frameBorder="0" scrolling="no" src={`https://maps.google.com/maps?q=${incident.latitude},${incident.longitude}&z=16&output=embed&iwloc=near`} style={{ border: 0, pointerEvents: 'none' }}></iframe>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.01)' }}></div>
                      <div style={{ position: 'absolute', bottom: '12px', right: '12px', backgroundColor: 'white', padding: '8px 16px', borderRadius: '12px', fontSize: '11px', fontWeight: '900', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <Maximize2 size={14} /> ENLARGE LIVE MAP
                      </div>
                    </div>
                  </div>

                  {/* Media Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '24px', overflow: 'hidden', height: '150px', position: 'relative', cursor: 'zoom-in', backgroundColor: '#f8fafc' }} onClick={() => setSelectedImage(imgUrl)}>
                      {imgUrl ? <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Evidence" /> : <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}><ImageIcon size={28} /><span style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '5px' }}>NO PHOTO</span></div>}
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '24px', overflow: 'hidden', height: '150px', position: 'relative', cursor: 'zoom-in', backgroundColor: '#f8fafc' }} onClick={() => setSelectedImage(videoUrl)}>
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