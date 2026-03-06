import { useState, useEffect } from 'react';
import { pb } from './pocketbase';
import Sidebar from './Sidebar'; 
import { 
  Check, X, ShieldAlert, MapPin, Phone, User, 
  CheckSquare, Square, ZoomIn, Send, MessageSquare 
} from 'lucide-react';

export default function PendingUserRegistration() {
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [rejectionModal, setRejectionModal] = useState({ isOpen: false, userId: null, userEmail: null, reason: "" });

  const fetchBatch = async () => {
    setLoading(true);
    try {
      const records = await pb.collection('users').getList(1, 10, {
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

  // --- 1. APPROVE LOGIC (Using your Node.js Mailer) ---
  const handleApprove = async (user) => {
    if (!user || !user.email) {
      return alert("Error: User email is blank in the database. Please ensure emailVisibility is true.");
    }

    setIsProcessing(true);
    try {
      // Step A: Update status to verified in your PocketBase database
      await pb.collection('users').update(user.id, { 
        status: 'verified' 
      });
      
      // Step B: Trigger the email via your custom Node.js Nodemailer server
      const response = await fetch('http://localhost:5000/send-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          name: user.first_name
        }),
      });

      if (response.ok) {
        setUsers(prev => prev.filter(u => u.id !== user.id));
        setSelectedIds(prev => prev.filter(item => item !== user.id));
        if (users.length <= 1) fetchBatch();
        alert("Success: User verified and custom LAGONGLONG email sent to " + user.email);
      } else {
        const errorText = await response.text();
        throw new Error(errorText || "Email server failed to send.");
      }
    } catch (error) {
      console.error("Approval error details:", error);
      alert("System Error: " + (error.data?.message || error.message));
    }
    setIsProcessing(false);
  };

  // --- 2. REJECT LOGIC (Using your Node.js Mailer) ---
  const submitRejection = async () => {
    if (!rejectionModal.reason.trim()) return alert("Please provide a reason.");
    
    setIsProcessing(true);
    try {
      // Step A: Store the rejection reason in the DB
      await pb.collection('users').update(rejectionModal.userId, { 
        status: 'rejected',
        rejection_reason: rejectionModal.reason 
      });

      // Step B: Send the custom rejection email via your Node.js server
      const response = await fetch('http://localhost:5000/send-rejection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: rejectionModal.userEmail, 
          reason: rejectionModal.reason    
        }),
      });

      if (response.ok) {
        setUsers(prev => prev.filter(user => user.id !== rejectionModal.userId));
        setRejectionModal({ isOpen: false, userId: null, userEmail: null, reason: "" });
        if (users.length <= 1) fetchBatch();
        alert("User rejected and notification email sent!");
      } else {
        const errorText = await response.text();
        throw new Error(errorText || "Email server failed to send.");
      }
      
    } catch (error) {
      alert("Update Error: " + error.message);
    }
    setIsProcessing(false);
  };

  // --- 3. BATCH APPROVE LOGIC (This was missing!) ---
  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    try {
      await Promise.all(
        selectedIds.map(id => pb.collection('users').update(id, { status: 'verified' }))
      );
      alert("Batch approval complete. System records updated.");
      setSelectedIds([]);
      fetchBatch(); 
    } catch (error) {
      alert("Batch error: " + error.message);
    }
    setIsProcessing(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6f8', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar pendingUsersCount={users.length} />
      <main style={styles.mainContent}>
        <header style={styles.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              <h1 style={styles.pageTitle}>User Verification</h1>
              <p style={{ color: '#666', marginTop: '5px' }}>Pending citizens for LAGONGLONG INCIDENT REPORT.</p>
            </div>
            
            {users.length > 0 && (
              <div style={styles.batchBar}>
                <button onClick={toggleSelectAll} style={styles.selectBtn}>
                   {selectedIds.length === users.length ? "Unselect All" : "Select All"}
                </button>
                <button onClick={handleBatchApprove} disabled={isProcessing} style={styles.batchApproveBtn}>
                  Approve Selected ({selectedIds.length})
                </button>
              </div>
            )}
          </div>
        </header>

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
                </div>

                <div style={styles.detailsBox}>
                  <p style={styles.detailText}><Phone size={14} /> {user.contact_number}</p>
                  <p style={styles.detailText}><MapPin size={14} /> {user.baranggay}</p>
                </div>

                <div style={styles.imageGrid}>
                  <div style={styles.imgContainer} onClick={() => setPreviewImage(pb.files.getURL(user, user.selfie))}>
                    <img src={pb.files.getURL(user, user.selfie)} style={styles.img} alt="Selfie" />
                  </div>
                  <div style={styles.imgContainer} onClick={() => setPreviewImage(pb.files.getURL(user, user.id_photo))}>
                    <img src={pb.files.getURL(user, user.id_photo)} style={styles.img} alt="ID" />
                  </div>
                </div>

                <div style={styles.cardActions}>
                  <button style={styles.rejectBtn} onClick={() => setRejectionModal({ isOpen: true, userId: user.id, userEmail: user.email, reason: "" })}>
                    REJECT
                  </button>
                  <button style={styles.approveBtn} onClick={() => handleApprove(user)}>
                    APPROVE
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* --- MODALS --- */}
      {rejectionModal.isOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.rejectionBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <MessageSquare color="#ef4444" />
              <h2 style={{ margin: 0, fontSize: '20px' }}>Rejection Reason</h2>
            </div>
            <textarea 
              style={styles.textarea}
              placeholder="Example: Blurred ID photo..."
              value={rejectionModal.reason}
              onChange={(e) => setRejectionModal({...rejectionModal, reason: e.target.value})}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={styles.cancelBtn} onClick={() => setRejectionModal({ isOpen: false, userId: null, userEmail: null, reason: "" })}>CANCEL</button>
              <button style={styles.sendRejectBtn} onClick={submitRejection} disabled={isProcessing}>CONFIRM REJECT</button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div style={styles.modalOverlay} onClick={() => setPreviewImage(null)}>
          <img src={previewImage} style={styles.modalImage} alt="Large Preview" />
        </div>
      )}
    </div>
  );
}

const styles = {
  mainContent: { marginLeft: '260px', flex: 1, padding: '40px' },
  header: { marginBottom: '35px' },
  pageTitle: { fontSize: '28px', color: '#1a1c23', margin: 0 },
  batchBar: { display: 'flex', gap: '12px' },
  selectBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer' },
  batchApproveBtn: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', padding: '10px 20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' },
  card: { backgroundColor: 'white', borderRadius: '12px', padding: '20px', position: 'relative', boxShadow: '0 2px 12px rgba(0,0,0,0.03)' },
  checkboxWrapper: { position: 'absolute', top: '15px', left: '15px', cursor: 'pointer' },
  cardHeader: { marginBottom: '15px', marginLeft: '30px' },
  userName: { margin: 0, fontSize: '18px' },
  detailsBox: { backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px', marginBottom: '15px' },
  detailText: { margin: '4px 0', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' },
  imageGrid: { display: 'flex', gap: '10px', height: '110px', marginBottom: '20px' },
  imgContainer: { flex: 1, borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee' },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  cardActions: { display: 'flex', gap: '10px' },
  approveBtn: { flex: 1, padding: '10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  rejectBtn: { flex: 1, padding: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  rejectionBox: { backgroundColor: 'white', padding: '30px', borderRadius: '15px', width: '450px' },
  textarea: { width: '100%', height: '100px', padding: '15px', borderRadius: '10px', border: '1px solid #ddd', marginBottom: '15px' },
  sendRejectBtn: { flex: 1, padding: '12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  cancelBtn: { flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  modalImage: { maxWidth: '90%', maxHeight: '90%', borderRadius: '10px' }
};