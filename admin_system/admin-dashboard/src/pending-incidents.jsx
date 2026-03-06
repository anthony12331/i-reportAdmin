import React, { useState, useEffect } from 'react';
import { pb } from './pocketbase';
import Sidebar from './Sidebar';
import { getReadableAddress } from './utils'; // 1. Imported your high-speed tool!
import { 
  AlertTriangle, MapPin, User, ImageIcon, 
  Activity, X, RefreshCw, ZoomIn, Phone, Mail, Calendar, 
  ExternalLink, ShieldCheck, Maximize2, Map as MapIcon
} from 'lucide-react';

export default function PendingIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});
  const [duplicateMap, setDuplicateMap] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null); 
  const [processingId, setProcessingId] = useState(null);

  const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getDuplicateMap = (pendingRecords, ongoingRecords) => {
    const pendingSorted = [...pendingRecords].sort(
      (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()
    );
    const openCandidates = [...ongoingRecords, ...pendingSorted];
    const result = {};

    for (const record of pendingSorted) {
      const recordLat = Number(record.latitude);
      const recordLon = Number(record.longitude);

      if (Number.isNaN(recordLat) || Number.isNaN(recordLon)) continue;

      let nearest = null;

      for (const candidate of openCandidates) {
        if (candidate.id === record.id) continue;
        if ((candidate.type || '').toLowerCase() !== (record.type || '').toLowerCase()) continue;
        if (new Date(candidate.created).getTime() > new Date(record.created).getTime()) continue;

        const candidateLat = Number(candidate.latitude);
        const candidateLon = Number(candidate.longitude);

        if (Number.isNaN(candidateLat) || Number.isNaN(candidateLon)) continue;

        const distanceMeters = calculateDistanceMeters(recordLat, recordLon, candidateLat, candidateLon);
        if (distanceMeters > 10) continue;

        if (!nearest || distanceMeters < nearest.distanceMeters) {
          nearest = { incidentId: candidate.id, distanceMeters };
        }
      }

      if (nearest) {
        result[record.id] = nearest;
      }
    }

    return result;
  };

  // Optimized Fetching logic
  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const [pendingRecords, ongoingRecords] = await Promise.all([
        pb.collection('incident_reports').getFullList({
          filter: 'status = "pending"',
          sort: '-created',
          expand: 'users',
          requestKey: null
        }),
        pb.collection('incident_reports').getFullList({
          filter: 'status = "ongoing"',
          sort: '-created',
          requestKey: null
        })
      ]);

      setIncidents(pendingRecords);
      setDuplicateMap(getDuplicateMap(pendingRecords, ongoingRecords));
      await resolveAddresses(pendingRecords);
    } catch (error) {
      if (!error.isAbort) console.error("Fetch error:", error);
    }
    setLoading(false);
  };

  // 2. NEW Address Resolver: Clean, fast, and uses the shared cache!
  const resolveAddresses = async (records) => {
    const newAddresses = { ...addresses };
    let hasChanged = false;

    for (const record of records) {
      if (record.latitude && record.longitude && !newAddresses[record.id]) {
        // Calls the BigDataCloud API from your utils.js file
        newAddresses[record.id] = await getReadableAddress(record.latitude, record.longitude);
        hasChanged = true;
      }
    }
    
    // Batch update state to prevent multiple re-renders
    if (hasChanged) {
      setAddresses(newAddresses);
    }
  };

  // Real-time listener
  useEffect(() => {
    let isMounted = true;
    if (isMounted) fetchIncidents();

    pb.collection('incident_reports').subscribe('*', (e) => {
      if (isMounted && (e.action === 'create' || (e.action === 'update' && e.record.status === 'pending'))) {
        fetchIncidents(); 
      }
    });

    return () => {
      isMounted = false;
      pb.collection('incident_reports').unsubscribe('*');
    };
  }, []);

  // Update logic to assign responders
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
          alert(`Warning: No available ${targetDept} unit found. Proceeding without responder.`);
        }
      }

      await pb.collection('incident_reports').update(incident.id, updateData);
      setIncidents(prev => prev.filter(i => i.id !== incident.id));
      alert(`Incident successfully set to ${newStatus.toUpperCase()}.`);
      
    } catch (error) {
      console.error("Update Failure:", error);
      alert("Error: System update failed.");
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
            <p style={{ color: '#64748b', fontSize: '15px', fontWeight: '500' }}>Real-time monitoring for Lagonglong Emergency System</p>
          </div>
          <button onClick={fetchIncidents} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', padding: '14px 28px', borderRadius: '16px', border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: '800', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} /> REFRESH LIST
          </button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: '30px' }}>
          {incidents.map((incident) => {
            const reporter = incident.expand?.users;
            const imgUrl = incident.incident_image ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_image}` : null;
            const videoUrl = incident.incident_video ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_video}` : null;
            const duplicateInfo = duplicateMap[incident.id];

            return (
              <div key={incident.id} style={{ backgroundColor: 'white', border: duplicateInfo ? '2px solid #dc2626' : '1px solid #e2e8f0', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' }}>
                
                <div style={{ backgroundColor: incident.type === 'fire' ? '#ef4444' : '#f59e0b', padding: '20px 30px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '900', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <AlertTriangle size={24} /> {incident.type.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.1)', padding: '6px 12px', borderRadius: '12px' }}>
                    {new Date(incident.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div style={{ padding: '30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  
                  {/* Reporter Box */}
                  <div style={{ border: '1px solid #f1f5f9', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '24px', marginBottom: '25px' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={16} color="#4f46e5" /> Age: {reporter?.age || 'N/A'}</div>
                    </div>
                  </div>

                  {duplicateInfo && (
                    <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 14px', borderRadius: '14px', marginBottom: '18px', fontSize: '13px', fontWeight: '800' }}>
                      DUPLICATE REPORT DETECTED: {duplicateInfo.distanceMeters.toFixed(1)}m from report #{duplicateInfo.incidentId}
                    </div>
                  )}

                  {/* Location & Clickable Map Preview */}
                  <div style={{ marginBottom: '25px' }}>
                    <p style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '900', color: '#1e40af', display: 'flex', alignItems: 'start', gap: '10px', lineHeight: '1.4' }}>
                      <MapPin size={20} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                      {addresses[incident.id] || "Locating..."}
                    </p>
                    
                    <div 
                      onClick={() => setSelectedMap({ lat: incident.latitude, lng: incident.longitude, address: addresses[incident.id] })}
                      style={{ width: '100%', height: '180px', borderRadius: '24px', overflow: 'hidden', border: '1px solid #dbeafe', position: 'relative', cursor: 'zoom-in' }}
                    >
                      <iframe 
                        title="Map Preview"
                        width="100%" 
                        height="100%" 
                        frameBorder="0" 
                        scrolling="no"
                        src={`https://maps.google.com/maps?q=${incident.latitude},${incident.longitude}&z=16&output=embed&iwloc=near`}
                        style={{ border: 0, pointerEvents: 'none' }} 
                      ></iframe>
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

                  <div style={{ display: 'flex', gap: '15px', marginTop: 'auto' }}>
                    <button onClick={() => updateStatus(incident, 'ongoing')} disabled={processingId === incident.id} style={{ flex: 2, padding: '18px', backgroundColor: '#0f172a', color: 'white', borderRadius: '20px', fontWeight: '900', cursor: 'pointer', border: 'none', transition: 'all 0.2s' }}>
                      {processingId === incident.id ? 'DEPLOYING...' : 'DEPLOY HELP'}
                    </button>
                    <button onClick={() => updateStatus(incident, 'reject')} disabled={processingId === incident.id} style={{ flex: 1, padding: '18px', backgroundColor: '#fd0909', color: 'white', borderRadius: '20px', fontWeight: '900', cursor: 'pointer', border: 'none' }}>
                      REJECT
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 🗺️ MODAL: FULLSCREEN INTERACTIVE GOOGLE MAP */}
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
            <div style={{ padding: '15px 40px', backgroundColor: '#f8fafc', fontSize: '12px', color: '#94a3b8', fontWeight: '800', textAlign: 'center' }}>
              YOU CAN PAN, ZOOM, AND TOGGLE SATELLITE VIEW DIRECTLY ABOVE
            </div>
          </div>
        </div>
      )}

      {/* 🖼️ MODAL: IMAGE/VIDEO FULLSCREEN */}
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
