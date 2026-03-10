import React, { useState, useEffect } from 'react';
import { pb } from './pocketbase';
import Sidebar from './Sidebar';
import { getReadableAddress } from './utils';
import { 
  AlertTriangle, MapPin, User, ImageIcon, 
  Activity, X, RefreshCw, Phone, Calendar, 
  ShieldCheck, Maximize2, Map as MapIcon, PlayCircle
} from 'lucide-react';

export default function PendingIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});
  const [duplicateMap, setDuplicateMap] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null); 
  const [processingId, setProcessingId] = useState(null);

  // 1. Mapping Logic: Identifies incidents with reliability pings
  const generateDuplicateMap = (records) => {
    const result = {};
    records.forEach(record => {
      const count = record.reporters_count || 0; 
      if (count >= 1) {
        result[record.id] = {
          count: count,
          isVerified: true
        };
      }
    });
    return result;
  };

  // 2. Fetching Logic: Retrieves data and populates the duplicate map
  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const pendingRecords = await pb.collection('incident_reports').getFullList({
        filter: 'status = "pending"',
        sort: '-created',
        expand: 'users',
        requestKey: null 
      });

      setIncidents(pendingRecords);
      setDuplicateMap(generateDuplicateMap(pendingRecords)); 
      await resolveAddresses(pendingRecords);
    } catch (error) {
      if (!error.isAbort) console.error("Fetch error:", error);
    }
    setLoading(false);
  };

  const resolveAddresses = async (records) => {
    const newAddresses = { ...addresses };
    let hasChanged = false;

    for (const record of records) {
      if (record.latitude && record.longitude && !newAddresses[record.id]) {
        newAddresses[record.id] = await getReadableAddress(record.latitude, record.longitude);
        hasChanged = true;
      }
    }
    
    if (hasChanged) {
      setAddresses(newAddresses);
    }
  };

  // Real-time listener
  useEffect(() => {
    let isMounted = true;
    if (isMounted) fetchIncidents();

    pb.collection('incident_reports').subscribe('*', (e) => {
      if (isMounted && (e.action === 'create' || e.action === 'update' || e.action === 'delete')) {
        fetchIncidents(); 
      }
    });

    return () => {
      isMounted = false;
      pb.collection('incident_reports').unsubscribe('*');
    };
  }, []);

  const updateStatus = async (incident, newStatus) => {
    setProcessingId(incident.id);
    try {
      let updateData = { status: newStatus };

      if (newStatus === 'ongoing') {
        const typeToDept = { 'fire': 'Fire', 'accident': 'ambulance', 'landslide': 'MDRRMO' };
        const targetDept = typeToDept[incident.type.toLowerCase()] || 'Fire';

        try {
          const responder = await pb.collection('responder_accounts').getFirstListItem(
            `department = "${targetDept}" && is_available = true`, { requestKey: null }
          );

          if (responder) {
            updateData.responders = responder.id;
            await pb.collection('responder_accounts').update(responder.id, { is_available: true });
          }
        } catch {
          console.warn(`No available ${targetDept} unit found.`);
        }
      }

      await pb.collection('incident_reports').update(incident.id, updateData);
      setIncidents(prev => prev.filter(i => i.id !== incident.id));
      alert(`Incident successfully set to ${newStatus.toUpperCase()}.`);
      
    } catch (error) {
      console.error("Update Failure:", error);
    }
    setProcessingId(null);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '40px', marginLeft: '260px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a', letterSpacing: '-1px' }}>PENDING EMERGENCY FEED</h1>
            <p style={{ color: '#64748b', fontSize: '15px', fontWeight: '500' }}>Lagonglong Emergency Management Dashboard</p>
          </div>
          <button onClick={fetchIncidents} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '14px 28px', borderRadius: '16px', border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: '800' }}>
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} /> REFRESH LIST
          </button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: '30px' }}>
          {incidents.map((incident) => {
            const reporter = incident.expand?.users;
            const imgUrl = incident.incident_image ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_image}` : null;
            const videoUrl = incident.incident_video ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_video}` : null;
            const selfieUrl = reporter?.selfie ? `${pb.baseUrl}/api/files/_pb_users_auth_/${reporter.id}/${reporter.selfie}` : null;
            const duplicateInfo = duplicateMap[incident.id];

            return (
              <div key={incident.id} style={{ backgroundColor: 'white', border: duplicateInfo?.count >= 1 ? '2px solid #10b981' : '1px solid #e2e8f0', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' }}>
                
                {/* 🚨 Emergency Header */}
                <div style={{ backgroundColor: incident.type === 'fire' ? '#ef4444' : '#f59e0b', padding: '20px 30px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '900', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <AlertTriangle size={24} /> {incident.type.toUpperCase()}
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', opacity: 0.9 }}>{new Date(incident.created).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                    <div style={{ fontSize: '14px', fontWeight: '900' }}>{new Date(incident.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>

                <div style={{ padding: '30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  
                  {/* 👤 Reporter Info with Selfie */}
                  <div style={{ border: '1px solid #f1f5f9', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '24px', marginBottom: '25px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                      <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', border: '3px solid white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', backgroundColor: '#eef2ff' }}>
                        {selfieUrl ? (
                          <img src={selfieUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Reporter" />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}><User size={30} /></div>
                        )}
                      </div>
                      <div>
                        <span style={{ display: 'block', fontWeight: '900', fontSize: '18px', color: '#1e293b' }}>{reporter?.first_name} {reporter?.last_name || 'Citizen'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', fontSize: '12px', fontWeight: '700' }}>
                          <ShieldCheck size={14} /> Verified Citizen
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={16} color="#4f46e5" /> {reporter?.contact_number || 'N/A'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={16} color="#4f46e5" /> Age: {reporter?.age || 'N/A'}</div>
                    </div>
                  </div>

                  {/* 🟢 Reliability Badge */}
                  {duplicateInfo && (
                    <div style={{ backgroundColor: '#ecfdf5', border: '2px solid #10b981', color: '#065f46', padding: '16px 20px', borderRadius: '24px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ backgroundColor: '#10b981', color: 'white', width: '42px', height: '42px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '20px' }}>{duplicateInfo.count}</div>
                        <div>
                            <span style={{ fontWeight: '900', fontSize: '15px', display: 'block' }}>HIGH-RELIABILITY REPORT</span>
                            <span style={{ fontSize: '13px', fontWeight: '600', opacity: 0.8 }}>Verified by {duplicateInfo.count} additional citizen(s).</span>
                        </div>
                    </div>
                  )}

                  {/* 📸 Media Evidence Section (TOP) - Hover to Play implemented */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                    {/* Image Thumbnail */}
                    <div 
                      style={{ border: '1px solid #e2e8f0', borderRadius: '24px', overflow: 'hidden', height: '180px', position: 'relative', cursor: 'zoom-in', backgroundColor: '#f8fafc' }} 
                      onClick={() => setSelectedImage(imgUrl)}
                    >
                      {imgUrl ? <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Evidence" /> : <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}><ImageIcon size={28} /><span style={{ fontSize: '10px', fontWeight: 'bold' }}>NO PHOTO</span></div>}
                    </div>

                    {/* Video Thumbnail with Hover-to-Play and Click-to-Enlarge */}
                    <div 
                      style={{ border: '1px solid #e2e8f0', borderRadius: '24px', overflow: 'hidden', height: '180px', position: 'relative', cursor: 'zoom-in', backgroundColor: '#f8fafc' }} 
                      onClick={() => setSelectedImage(videoUrl)}
                    >
                      {videoUrl ? (
                        <div style={{ position: 'relative', height: '100%' }}>
                          <video 
                            src={videoUrl} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            muted 
                            loop
                            onMouseEnter={(e) => e.target.play()} 
                            onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }} 
                          />
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)', pointerEvents: 'none' }}>
                            <PlayCircle size={48} color="white" style={{ opacity: 0.8 }} />
                          </div>
                          <div style={{ position: 'absolute', bottom: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold' }}>HOVER TO PLAY</div>
                        </div>
                      ) : (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}><Activity size={28} /><span style={{ fontSize: '10px', fontWeight: 'bold' }}>NO VIDEO</span></div>
                      )}
                    </div>
                  </div>

                  {/* 📍 Location Section (BELOW MEDIA) - Fixed Google Maps URL */}
                  <div style={{ marginBottom: '25px' }}>
                    <p style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: '#1e40af', display: 'flex', alignItems: 'start', gap: '8px' }}>
                      <MapPin size={18} color="#2563eb" /> {addresses[incident.id] || "Locating..."}
                    </p>
                    <div onClick={() => setSelectedMap({ lat: incident.latitude, lng: incident.longitude, address: addresses[incident.id] })} style={{ width: '100%', height: '150px', borderRadius: '24px', overflow: 'hidden', border: '1px solid #dbeafe', position: 'relative', cursor: 'zoom-in' }}>
                      <iframe 
                        title="Map Preview" 
                        width="100%" 
                        height="100%" 
                        frameBorder="0" 
                        src={`https://maps.google.com/maps?q=${incident.latitude},${incident.longitude}&z=16&output=embed`} 
                        style={{ border: 0, pointerEvents: 'none' }}
                      ></iframe>
                      <div style={{ position: 'absolute', bottom: '10px', right: '10px', backgroundColor: 'white', padding: '6px 12px', borderRadius: '10px', fontSize: '10px', fontWeight: '900', color: '#2563eb', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>ENLARGE MAP</div>
                    </div>
                  </div>

                  {/* 🎮 Action Buttons - Reject now deletes */}
                  <div style={{ display: 'flex', gap: '15px', marginTop: 'auto' }}>
                    <button onClick={() => updateStatus(incident, 'ongoing')} disabled={processingId === incident.id} style={{ flex: 2, padding: '18px', backgroundColor: '#0f172a', color: 'white', borderRadius: '20px', fontWeight: '900', cursor: 'pointer', border: 'none' }}>
                      {processingId === incident.id ? 'DEPLOYING...' : 'DEPLOY HELP'}
                    </button>
                    <button 
                      onClick={async () => {
                        if(window.confirm("PERMANENTLY REJECT and DELETE this report?")) {
                           setProcessingId(incident.id);
                           try {
                             await pb.collection('incident_reports').delete(incident.id);
                             setIncidents(prev => prev.filter(i => i.id !== incident.id));
                           } catch (err) { alert("Failed to delete report."); }
                           setProcessingId(null);
                        }
                      }} 
                      disabled={processingId === incident.id} 
                      style={{ flex: 1, padding: '18px', backgroundColor: '#fd0909', color: 'white', borderRadius: '20px', fontWeight: '900', cursor: 'pointer', border: 'none' }}
                    >
                      REJECT
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 🗺️ MODAL: FULL SCREEN MAP */}
      {selectedMap && (
        <div onClick={() => setSelectedMap(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', backdropFilter: 'blur(12px)', cursor: 'zoom-out' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '90vw', maxWidth: '1100px', backgroundColor: 'white', borderRadius: '40px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '25px 40px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><h2 style={{ margin: 0, fontSize: '22px', fontWeight: '900' }}><MapIcon size={24} color="#2563eb" /> INTERACTIVE LOCATION</h2><p style={{ margin: '4px 0 0 0', color: '#64748b' }}>{selectedMap.address}</p></div>
              <button onClick={() => setSelectedMap(null)} style={{ backgroundColor: '#f1f5f9', border: 'none', padding: '10px', borderRadius: '15px', cursor: 'pointer' }}><X size={24} color="#64748b" /></button>
            </div>
            <div style={{ width: '100%', height: '65vh' }}>
              <iframe 
                title="Full Map" 
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

      {/* 🎬 MODAL: ENLARGE MEDIA (PHOTO/VIDEO) */}
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.98)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', backdropFilter: 'blur(10px)', cursor: 'zoom-out' }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {selectedImage.match(/\.(mp4|mov|avi|wmv)/i) || selectedImage.includes('video') ? (
              <video 
                src={selectedImage} 
                controls 
                autoPlay 
                style={{ maxWidth: '100%', maxHeight: '100vh', borderRadius: '12px' }} 
                onClick={(e) => e.stopPropagation()} 
              />
            ) : (
              <img 
                src={selectedImage} 
                style={{ maxWidth: '95%', maxHeight: '95vh', borderRadius: '12px', objectFit: 'contain' }} 
                alt="Evidence" 
              />
            )}
            <button onClick={() => setSelectedImage(null)} style={{ position: 'absolute', top: '20px', right: '20px', backgroundColor: '#ef4444', color: 'white', border: 'none', width: '60px', height: '60px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={32} strokeWidth={3} /></button>
          </div>
        </div>
      )}
    </div>
  );
}