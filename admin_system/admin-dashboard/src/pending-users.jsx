import { useState, useEffect } from 'react';
import { pb } from './pocketbase';
import Sidebar from './Sidebar'; 
import { Check, X, ShieldAlert, MapPin, Phone, User, CheckSquare, Square, ZoomIn } from 'lucide-react';

export default function PendingUserRegistration() {
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // State to hold the full-size image URL
  const [previewImage, setPreviewImage] = useState(null);

  const fetchBatch = async () => {
    setLoading(true);
    try {
      const records = await pb.collection('users').getList(1, 7, {
        filter: 'status = "pending"',
        requestKey: null 
      });
      setUsers(records.items);
      setSelectedIds(records.items.map(u => u.id));
    } catch (error) {
      console.error("Error fetching batch:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBatch();
  }, []);

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map(u => u.id));
    }
  };

  const handleApprove = async (id) => {
    try {
      await pb.collection('users').update(id, { status: 'verified' });
      setUsers(prev => prev.filter(user => user.id !== id));
      setSelectedIds(prev => prev.filter(item => item !== id));
      if (users.length <= 1) fetchBatch();
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm("Reject and delete this user?")) return;
    try {
      await pb.collection('users').delete(id);
      setUsers(prev => prev.filter(user => user.id !== id));
      setSelectedIds(prev => prev.filter(item => item !== id));
      if (users.length <= 1) fetchBatch();
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Batch approve ${selectedIds.length} users?`)) return;

    setIsProcessing(true);
    try {
      await Promise.all(
        selectedIds.map(id => pb.collection('users').update(id, { status: 'verified' }))
      );
      alert(`✅ ${selectedIds.length} users verified.`);
      fetchBatch(); 
    } catch (error) {
      alert("Batch error: " + error.message);
    }
    setIsProcessing(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const safeDate = dateString.replace(" ", "T");
    const date = new Date(safeDate);
    return isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6f8' }}>
      
      {/* Sidebar is now a separate component to keep alignment clean */}
      <Sidebar pendingUsersCount={users.length} />

      <main style={styles.mainContent}>
        <header style={styles.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={styles.pageTitle}>Pending User Verifications</h1>
              <p style={{ color: '#666', marginTop: '5px' }}>Review identity documents before granting access.</p>
            </div>
            
            {users.length > 0 && (
              <div style={styles.batchBar}>
                <button onClick={toggleSelectAll} style={styles.selectBtn}>
                   {selectedIds.length === users.length ? <CheckSquare size={18} /> : <Square size={18} />}
                   {selectedIds.length === users.length ? "Unselect All" : "Select All"}
                </button>
                <button 
                  onClick={handleBatchApprove} 
                  disabled={selectedIds.length === 0 || isProcessing}
                  style={styles.batchApproveBtn}
                >
                  <Check size={18} /> {isProcessing ? "Wait..." : `Approve ${selectedIds.length} Selected`}
                </button>
              </div>
            )}
          </div>
        </header>

        {loading ? (
          <p>Fetching next batch...</p>
        ) : users.length === 0 ? (
          <div style={styles.emptyState}>
            <ShieldAlert size={48} color="#ccc" />
            <p style={{ marginTop: '10px', color: '#888' }}>No pending verifications.</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {users.map((user) => {
              const isSelected = selectedIds.includes(user.id);
              return (
                <div key={user.id} style={{ ...styles.card, border: isSelected ? '2px solid #10b981' : '1px solid #f0f0f0' }}>
                  
                  <div style={styles.checkboxWrapper} onClick={() => toggleSelect(user.id)}>
                    {isSelected ? <CheckSquare size={22} color="#10b981" /> : <Square size={22} color="#ccc" />}
                  </div>

                  <div style={styles.cardHeader}>
                    <h3 style={styles.userName}>{user.first_name} {user.last_name}</h3>
                    <div style={styles.dateBadge}>Registered: {formatDate(user.date_time)}</div>
                  </div>

                  <div style={styles.detailsBox}>
                    <p style={styles.detailText}><User size={14} /> Age: <b>{user.age}</b></p>
                    <p style={styles.detailText}><Phone size={14} /> {user.contact_number}</p>
                    <p style={styles.detailText}><MapPin size={14} /> {user.address}</p>
                  </div>

                  <div style={styles.imageGrid}>
                    <div style={styles.imgContainer} onClick={() => setPreviewImage(pb.files.getURL(user, user.selfie))}>
                      <span style={styles.imgLabel}>Live Selfie</span>
                      <div style={styles.zoomIcon}><ZoomIn size={14} /></div>
                      <img src={pb.files.getURL(user, user.selfie)} style={styles.img} alt="Selfie" />
                    </div>
                    <div style={styles.imgContainer} onClick={() => setPreviewImage(pb.files.getURL(user, user.id_photo))}>
                      <span style={styles.imgLabel}>Valid ID</span>
                      <div style={styles.zoomIcon}><ZoomIn size={14} /></div>
                      <img src={pb.files.getURL(user, user.id_photo)} style={styles.img} alt="ID" />
                    </div>
                  </div>

                  <div style={styles.cardActions}>
                    <button style={styles.rejectBtn} onClick={(e) => { e.stopPropagation(); handleReject(user.id); }}>
                      <X size={16} /> REJECT
                    </button>
                    <button style={styles.approveBtn} onClick={(e) => { e.stopPropagation(); handleApprove(user.id); }}>
                      <Check size={16} /> APPROVE
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* --- ENLARGED FULL-SCREEN IMAGE PREVIEW --- */}
      {previewImage && (
        <div style={styles.modalOverlay} onClick={() => setPreviewImage(null)}>
          <button style={styles.closeModal} onClick={() => setPreviewImage(null)}>
            <X size={40} />
          </button>
          <img 
            src={previewImage} 
            style={styles.modalImage} 
            alt="Large Preview" 
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
}

const styles = {
  mainContent: { marginLeft: '260px', flex: 1, padding: '40px' },
  header: { marginBottom: '35px' },
  pageTitle: { fontSize: '28px', color: '#1a1c23', margin: 0 },
  batchBar: { display: 'flex', gap: '12px', backgroundColor: 'white', padding: '12px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  selectBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' },
  batchApproveBtn: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', padding: '10px 20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '25px' },
  card: { backgroundColor: 'white', borderRadius: '12px', padding: '20px', position: 'relative', boxShadow: '0 2px 12px rgba(0,0,0,0.03)' },
  checkboxWrapper: { position: 'absolute', top: '15px', left: '15px', cursor: 'pointer', zIndex: 5 },
  cardHeader: { marginBottom: '15px', marginLeft: '30px' },
  userName: { margin: 0, fontSize: '18px', color: '#1f2937' },
  dateBadge: { fontSize: '11px', color: '#4f46e5', backgroundColor: '#eef2ff', padding: '3px 8px', borderRadius: '4px', marginTop: '5px', display: 'inline-block' },
  detailsBox: { backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px', marginBottom: '15px' },
  detailText: { margin: '4px 0', fontSize: '13px', color: '#555', display: 'flex', alignItems: 'center', gap: '8px' },
  imageGrid: { display: 'flex', gap: '10px', height: '120px', marginBottom: '20px' },
  imgContainer: { flex: 1, borderRadius: '8px', overflow: 'hidden', position: 'relative', border: '1px solid #eee', cursor: 'zoom-in' },
  imgLabel: { position: 'absolute', top: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '10px', padding: '2px 6px', borderBottomRightRadius: '6px', zIndex: 2 },
  zoomIcon: { position: 'absolute', bottom: '5px', right: '5px', backgroundColor: 'rgba(255,255,255,0.8)', padding: '4px', borderRadius: '50%', display: 'flex', zIndex: 2 },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  cardActions: { display: 'flex', gap: '12px' },
  approveBtn: { flex: 1, padding: '10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  rejectBtn: { flex: 1, padding: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  emptyState: { textAlign: 'center', marginTop: '100px', padding: '40px', backgroundColor: 'white', borderRadius: '15px' },

  // --- MODAL STYLES (ENLARGED TO FULL SCREEN) ---
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.95)', // Nearly black for focus
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  modalImage: {
    width: '90vw', // 90% of screen width
    height: '90vh', // 90% of screen height
    objectFit: 'contain', // Keeps original photo aspect ratio
    borderRadius: '10px',
    boxShadow: '0 0 50px rgba(0,0,0,1)',
  },
  closeModal: {
    position: 'absolute',
    top: '20px',
    right: '30px',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    zIndex: 10001
  }
};