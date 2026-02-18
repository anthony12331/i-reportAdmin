import React, { useState, useEffect } from 'react';
import { pb } from './pocketbase';
import Sidebar from './Sidebar';
import { 
  AlertTriangle, MapPin, User, ImageIcon, 
  Activity, X, RefreshCw, ZoomIn, Phone, Mail, Calendar, ExternalLink
} from 'lucide-react';

export default function PendingIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  // 1. Fetching logic
  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const records = await pb.collection('incident_reports').getFullList({
        filter: 'status = "pending"',
        sort: '-created',
        expand: 'users',
        requestKey: null
      });
      setIncidents(records);
      resolveAddresses(records);
    } catch (error) {
      if (!error.isAbort) console.error("Fetch error:", error);
    }
    setLoading(false);
  };

  // 2. Address Resolver
  const resolveAddresses = async (records) => {
    const newAddresses = { ...addresses };
    for (const record of records) {
      if (record.latitude && record.longitude && !newAddresses[record.id]) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${record.latitude}&lon=${record.longitude}&zoom=18&addressdetails=1`
          );
          const data = await res.json();
          const addr = data.address;
          const barangay = addr.village || addr.suburb || addr.neighbourhood || "";
          const town = addr.municipality || addr.city || addr.town || "";
          const province = addr.state || "";
          const cleanAddress = [barangay, town, province].filter(part => part !== "").join(', ');
          newAddresses[record.id] = cleanAddress || "Location Identified";
          setAddresses({ ...newAddresses }); 
        } catch (e) {
          newAddresses[record.id] = "Coordinates pinpointed";
        }
      }
    }
  };

  // 3. Real-time listener
  useEffect(() => {
    fetchIncidents();
    pb.collection('incident_reports').subscribe('*', (e) => {
      if (e.action === 'create' || (e.action === 'update' && e.record.status === 'pending')) {
        fetchIncidents(); 
      }
    });
    return () => pb.collection('incident_reports').unsubscribe('*');
  }, []);

  const openMap = (lat, lng) => {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const updateStatus = async (id, newStatus) => {
    setProcessingId(id);
    try {
      await pb.collection('incident_reports').update(id, { status: newStatus });
      setIncidents(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      alert("Update failed");
    }
    setProcessingId(null);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '30px', marginLeft: '260px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '2px solid #e2e8f0', paddingBottom: '15px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', margin: 0 }}>PENDING EMERGENCY FEED</h1>
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Real-time monitoring for Lagonglong Emergency System</p>
          </div>
          <button onClick={fetchIncidents} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'white', padding: '12px 24px', borderRadius: '10px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 'bold' }}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> REFRESH LIST
          </button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '30px' }}>
          {incidents.map((incident) => {
            const reporter = incident.expand?.users;
            const imgUrl = incident.incident_image ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_image}` : null;
            const videoUrl = incident.incident_video ? `${pb.baseUrl}/api/files/${incident.collectionId}/${incident.id}/${incident.incident_video}` : null;

            return (
              <div key={incident.id} style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                
                <div style={{ backgroundColor: incident.type === 'fire' ? '#dc2626' : '#d97706', padding: '15px 25px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '900', fontSize: '18px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={20} /> {incident.type.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: '20px' }}>
                    {new Date(incident.created).toLocaleTimeString()}
                  </span>
                </div>

                <div style={{ padding: '25px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  
                  <div style={{ border: '1px solid #f1f5f9', backgroundColor: '#f8fafc', padding: '18px', borderRadius: '18px', marginBottom: '20px' }}>
                    <p style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Reporter Information</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                        <User size={24} />
                      </div>
                      <span style={{ fontWeight: '800', fontSize: '17px', color: '#1e293b' }}>
                        {reporter?.first_name} {reporter?.last_name || 'Unverified Citizen'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px', color: '#475569' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={14} /> {reporter?.contact_number || 'N/A'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={14} /> Age: <b>{reporter?.age || 'N/A'}</b></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: 'span 2' }}><Mail size={14} /> {reporter?.email || 'N/A'}</div>
                    </div>
                  </div>

                  <div style={{ border: '1px solid #dbeafe', backgroundColor: '#eff6ff', padding: '18px', borderRadius: '18px', marginBottom: '20px' }}>
                    <p style={{ fontSize: '11px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', marginBottom: '10px' }}>Incident Location</p>
                    <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                      <MapPin size={22} color="#2563eb" />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1e40af' }}>
                          {addresses[incident.id] || "Calculating address..."}
                        </p>
                        <button onClick={() => openMap(incident.latitude, incident.longitude)} style={{ marginTop: '12px', width: '100%', backgroundColor: '#2563eb', color: 'white', padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <ExternalLink size={14} /> GOOGLE MAPS
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 📸 IMAGE EVIDENCE */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '18px', overflow: 'hidden', height: '220px', marginBottom: '25px', position: 'relative', cursor: 'zoom-in', backgroundColor: '#f1f5f9' }} onClick={() => setSelectedImage(imgUrl)}>
                    {imgUrl ? (
                      <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Evidence" />
                    ) : (
                      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                        <ImageIcon size={40} />
                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>NO IMAGE PROVIDED</span>
                      </div>
                    )}
                    {imgUrl && (
                      <div style={{ position: 'absolute', bottom: '15px', right: '15px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '8px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)' }}>
                        <ZoomIn size={20} color="white" />
                      </div>
                    )}
                  </div>

                  {/* 📹 VIDEO EVIDENCE */}
                  <div 
                    style={{ border: '1px solid #e2e8f0', borderRadius: '18px', overflow: 'hidden', height: '220px', marginBottom: '25px', position: 'relative', cursor: 'zoom-in', backgroundColor: '#f1f5f9' }} 
                    onClick={() => setSelectedImage(videoUrl)} 
                  >
                    {videoUrl ? (
                      <video 
                        src={videoUrl} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        muted 
                        loop 
                        onMouseOver={e => e.target.play()} 
                        onMouseOut={e => e.target.pause()}
                      />
                    ) : (
                      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                        <Activity size={40} />
                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>NO VIDEO PROVIDED</span>
                      </div>
                    )}
                    {videoUrl && (
                      <div style={{ position: 'absolute', bottom: '15px', right: '15px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '8px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', pointerEvents: 'none' }}>
                        <ZoomIn size={20} color="white" />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
                    <button onClick={() => updateStatus(incident.id, 'ongoing')} disabled={processingId === incident.id} style={{ flex: 1, padding: '14px', backgroundColor: '#1e293b', color: 'white', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', border: 'none' }}>
                      {processingId === incident.id ? '...' : 'DEPLOY HELP'}
                    </button>
                    <button onClick={() => updateStatus(incident.id, 'resolved')} disabled={processingId === incident.id} style={{ flex: 1, padding: '14px', backgroundColor: '#059669', color: 'white', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', border: 'none' }}>
                      {processingId === incident.id ? '...' : 'RESOLVE'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 🖼️ FULL SCREEN MODAL */}
      {selectedImage && (
        <div 
          onClick={() => setSelectedImage(null)} 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(15, 23, 42, 0.98)', 
            zIndex: 9999, 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            padding: '20px', 
            backdropFilter: 'blur(8px)', 
            cursor: 'zoom-out' 
          }}
        >
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {selectedImage.toLowerCase().includes('.mp4') ? (
              <video 
                src={selectedImage} 
                controls 
                autoPlay 
                style={{ 
                  width: '80vw',      /* Enlarged width */
                  height: '80vh',     /* Enlarged height */
                  maxHeight: '90vh', 
                  maxWidth: '90vw', 
                  borderRadius: '24px', 
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', 
                  backgroundColor: '#000',
                  objectFit: 'contain' /* Ensures video aspect ratio is kept */
                }} 
                onClick={(e) => e.stopPropagation()} 
              />
            ) : (
              <img 
                src={selectedImage} 
                style={{ 
                  maxWidth: '90vw', 
                  maxHeight: '90vh', 
                  borderRadius: '24px', 
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                  objectFit: 'contain' 
                }} 
                alt="Enlarged Evidence" 
              />
            )}
            <div 
              onClick={() => setSelectedImage(null)} 
              style={{ 
                position: 'absolute', 
                top: '-20px', 
                right: '-20px', 
                color: 'white', 
                cursor: 'pointer', 
                backgroundColor: '#ef4444', 
                width: '50px', 
                height: '50px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                border: '4px solid #0f172a',
                zIndex: 10000
              }}
            >
              <X size={30} strokeWidth={3} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}