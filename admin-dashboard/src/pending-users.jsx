import { useState, useEffect } from 'react';
import { pb } from './pocketbase';
import Sidebar from './Sidebar'; 
import { ui } from './uiStyles';
import { useMessageBox } from './MessageBox';
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
  const [previewUser, setPreviewUser] = useState(null);
  const [rejectionModal, setRejectionModal] = useState({ isOpen: false, userId: null, userEmail: null, reason: "" });
  const [operationState, setOperationState] = useState({ open: false, title: '', message: '' });
  const { confirm } = useMessageBox();

  const fetchBatch = async () => {
    setLoading(true);
    try {
      const records = await pb.collection('users').getList(1, 10, {
        filter: 'status = "pending"',
        requestKey: null 
      });
      setUsers(records.items);
      setSelectedIds([]); 
    } catch (error) {
      console.error("Error fetching batch:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBatch();

    let unsubscribe;
    let timeout;
    const setupSubscription = async () => {
      unsubscribe = await pb.collection('users').subscribe('*', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fetchBatch(true), 500);
      });
    };

    setupSubscription();

    return () => {
      if (unsubscribe) unsubscribe();
    };
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

  const shouldIgnoreCardToggle = (target) => {
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(target.closest('button, input, textarea, img, a'));
  };

  const formatFieldLabel = (field) => field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const formatBooleanValue = (value) => value === true ? 'Yes' : value === false ? 'No' : value;
  const formatDateTime = (value) => {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${year}-${month}-${day} ${hours}:${minutes}${period}`;
  };

  const getUserDetails = (user) => {
    const normalizeKey = (key) => {
      switch (key) {
        case 'baranggay':
        case 'barangay':
          return 'barangay';
        case 'contactNumber':
        case 'contact':
        case 'contact_number':
          return 'contact_number';
        case 'dateTime':
        case 'date_time':
          return 'date_time';
        default:
          return key;
      }
    };

    const baseFields = [
      { label: 'Email', value: user.email },
      { label: 'Age', value: user.age },
      { label: 'Contact Number', value: user.contact_number || user.contactNumber || user.contact },
      { label: 'Barangay', value: user.barangay || user.baranggay },
      { label: 'Municipality', value: user.municipality },
      { label: 'Province', value: user.province },
      { label: 'Date / Time', value: formatDateTime(user.date_time || user.dateTime) },
      { label: 'Position', value: user.position },
      { label: 'Status', value: user.status },
      { label: 'Registered', value: formatDateTime(user.created) },
      { label: 'Updated', value: formatDateTime(user.updated) },
    ];

    const ignoredKeys = new Set([
      'id', 'collectionId', 'collectionName', 'created', 'updated',
      'selfie', 'id_photo', 'email', 'first_name', 'middle_name', 'last_name',
      'contact_number', 'contactNumber', 'contact', 'barangay', 'baranggay', 'municipality',
      'province', 'date_time', 'dateTime', 'status', 'position', 'extension',
      'age', 'user_id', 'emailVisibility', 'verified',
    ]);

    const extraFields = Object.entries(user)
      .map(([key, value]) => [normalizeKey(key), value])
      .filter(([key, value]) => !ignoredKeys.has(key) && value != null && value !== '' && typeof value !== 'object')
      .map(([key, value]) => ({ label: formatFieldLabel(key), value: String(value).trim() }));

    const combined = [
      { label: 'Full Name', value: `${user.first_name || ''} ${user.middle_name || ''} ${user.last_name || ''}`.trim() },
      ...baseFields,
      ...extraFields,
    ].filter(item => item.value !== undefined && item.value !== null && item.value !== '');

    const seen = new Set();
    return combined.filter((item) => {
      const entry = `${item.label.trim().toLowerCase()}|${String(item.value).trim()}`;
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
  };

  const getLatestUserId = async () => {
    try {
      const records = await pb.collection('users').getList(1, 1, {
        filter: 'user_id != ""',
        sort: '-user_id', 
      });
      if (records.items.length === 0) return 0;
      return parseInt(records.items[0].user_id) || 0;
    } catch (err) {
      return 0;
    }
  };

  const showOperation = (title, message) => {
    setOperationState({ open: true, title, message });
  };

  const hideOperation = () => {
    setOperationState({ open: false, title: '', message: '' });
  };

  const handleApprove = async (user) => {
    if (!user) return alert("Error: User data is missing.");

    setIsProcessing(true);
    showOperation('Verifying User', `Approving ${user.first_name || 'the selected user'} and assigning an ID.`);
    try {
      const currentMax = await getLatestUserId();
      const nextId = currentMax + 1;

      await pb.collection('users').update(user.id, { 
        status: 'verified',
        user_id: nextId // Pass as number, since PocketBase schema expects number
      });

      // Send individual email
      if (user.email) {
        await fetch('http://localhost:5000/send-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, name: user.first_name }),
        }).catch(err => console.warn("Email service not reachable:", err));
      }

      setUsers(prev => prev.filter(u => u.id !== user.id));
      setSelectedIds(prev => prev.filter(item => item !== user.id));
      if (users.length <= 1) fetchBatch();
      alert(`Success: User verified with ID #${nextId}`);
    } catch (error) {
      alert("System Error: " + error.message);
    }
    hideOperation();
    setIsProcessing(false);
  };

  // --- FIXED: REJECT NOW DELETES THE USER ---
  const submitRejection = async () => {
    if (!rejectionModal.reason.trim()) return alert("Please provide a reason.");
    const shouldReject = await confirm('Reject and permanently delete this user registration?', {
      title: 'Confirm User Rejection',
      primaryLabel: 'Reject & Delete',
      secondaryLabel: 'Cancel',
    });

    if (!shouldReject) return;

    setIsProcessing(true);
    showOperation('Rejecting User', 'Deleting the registration and sending the rejection notice.');
    try {
      // 1. Send the rejection email first
      if (rejectionModal.userEmail) {
        await fetch('http://localhost:5000/send-rejection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: rejectionModal.userEmail, reason: rejectionModal.reason }),
        }).catch(err => console.warn("Email service not reachable:", err));
      }

      // 2. Permanently delete the user from PocketBase
      await pb.collection('users').delete(rejectionModal.userId);
      setUsers(prev => prev.filter(user => user.id !== rejectionModal.userId));
      setRejectionModal({ isOpen: false, userId: null, userEmail: null, reason: "" });
      if (users.length <= 1) fetchBatch();
      alert("User rejected, emailed, and permanently deleted.");
    } catch (error) {
      alert("Delete Error: " + error.message);
    }
    hideOperation();
    setIsProcessing(false);
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    showOperation('Processing Batch', `Verifying ${selectedIds.length} selected users.`);
    
    try {
      let currentMax = await getLatestUserId();
      const emailPromises = [];

      for (const id of selectedIds) {
        currentMax++;
        const targetUser = users.find(u => u.id === id);

        if (targetUser) {
          await pb.collection('users').update(id, { 
            status: 'verified',
            user_id: currentMax // Pass as number, since PocketBase schema expects number
          });

          if (targetUser.email) {
            emailPromises.push(
              fetch('http://localhost:5000/send-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: targetUser.email, name: targetUser.first_name }),
              }).catch(err => console.warn(`Email service not reachable for ${targetUser.email}:`, err)) // Prevent fetch error from breaking flow
            );
          }
        }
      }

      await Promise.all(emailPromises);

      alert(`Batch complete! Verified ${selectedIds.length} users and sent all confirmation emails.`);
      setSelectedIds([]);
      fetchBatch(); 

    } catch (error) {
      alert("Batch error: " + error.message);
    }
    hideOperation();
    setIsProcessing(false);
  };

  return (
    <div style={ui.shell}>
      <Sidebar />
      <main style={styles.mainContent}>
        <header style={styles.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              <h1 style={styles.pageTitle}>User Verification</h1>
              <p style={{ color: '#666', marginTop: '5px' }}>Batch verify citizens for Lagonglong Emergency.</p>
            </div>
            
            {users.length > 0 && (
              <div style={styles.batchBar}>
                <button onClick={toggleSelectAll} style={styles.selectBtn}>
                   {selectedIds.length === users.length ? "Unselect All" : "Select All"}
                </button>
                <button onClick={handleBatchApprove} disabled={isProcessing} style={styles.batchApproveBtn}>
                  {isProcessing ? "Processing..." : `Verify Selected (${selectedIds.length})`}
                </button>
              </div>
            )}
          </div>
        </header>

        {loading && users.length === 0 ? (
          <div style={styles.emptyState}>Loading pending user registrations...</div>
        ) : users.length === 0 ? (
          <div style={styles.emptyState}>No pending user registrations found.</div>
        ) : null}

        <div style={styles.grid}>
          {users.map((user) => {
            const isSelected = selectedIds.includes(user.id);
            return (
              <div
                key={user.id}
                style={{ ...styles.card, border: isSelected ? '2px solid #10b981' : '1px solid #f0f0f0' }}
                onClick={(e) => {
                  if (shouldIgnoreCardToggle(e.target)) return;
                  toggleSelect(user.id);
                }}
              >
                <div
                  style={styles.checkboxWrapper}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(user.id);
                  }}
                >
                  {isSelected ? <CheckSquare size={22} color="#10b981" /> : <Square size={22} color="#ccc" />}
                </div>

                <div style={styles.cardHeader}>
                  <h3 style={styles.userName}>{user.first_name} {user.last_name}</h3>
                </div>

                <div style={styles.detailsBox}>
                  {getUserDetails(user).map((item) => (
                    <p key={item.label} style={styles.detailText}>
                      <strong style={styles.detailLabel}>{item.label}:</strong> {item.value}
                    </p>
                  ))}
                </div>

                <div style={styles.imageGrid}>
                  <div
                    style={styles.imgContainer}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewUser(user);
                    }}
                  >
                    <img src={pb.files.getURL(user, user.selfie)} style={styles.img} alt="Selfie" />
                  </div>
                  <div
                    style={styles.imgContainer}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewUser(user);
                    }}
                  >
                    <img src={pb.files.getURL(user, user.id_photo)} style={styles.img} alt="ID" />
                  </div>
                </div>

                <div style={styles.cardActions}>
                  <button
                    style={styles.rejectBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRejectionModal({ isOpen: true, userId: user.id, userEmail: user.email, reason: "" });
                    }}
                  >
                    REJECT
                  </button>
                  <button
                    style={styles.approveBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(user);
                    }}
                  >
                    APPROVE
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {rejectionModal.isOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.rejectionBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <MessageSquare color="#ef4444" />
              <h2 style={{ margin: 0, fontSize: '20px' }}>Rejection Reason</h2>
            </div>
            <textarea 
              style={styles.textarea}
              placeholder="e.g., ID photo is unclear..."
              value={rejectionModal.reason}
              onChange={(e) => setRejectionModal({...rejectionModal, reason: e.target.value})}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={styles.cancelBtn} onClick={() => setRejectionModal({ isOpen: false, userId: null, userEmail: null, reason: "" })}>CANCEL</button>
              <button style={styles.sendRejectBtn} onClick={submitRejection} disabled={isProcessing}>CONFIRM REJECT & DELETE</button>
            </div>
          </div>
        </div>
      )}

      {previewUser && (
        <div style={styles.modalOverlay} onClick={() => setPreviewUser(null)}>
          <div style={styles.reviewModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.reviewHeader}>
              <div>
                <h2 style={styles.reviewTitle}>Applicant Review</h2>
                <p style={styles.reviewSubtitle}>Compare the photo evidence and profile details before taking action.</p>
              </div>
              <button style={styles.closeReviewBtn} onClick={() => setPreviewUser(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.reviewGrid}>
              <section style={styles.reviewPanel}>
                <span style={styles.panelLabel}>Selfie</span>
                <img
                  src={pb.files.getURL(previewUser, previewUser.selfie)}
                  alt="Selfie preview"
                  style={styles.reviewImage}
                />
              </section>

              <section style={styles.reviewPanel}>
                <span style={styles.panelLabel}>ID Photo</span>
                <img
                  src={pb.files.getURL(previewUser, previewUser.id_photo)}
                  alt="ID preview"
                  style={styles.reviewImage}
                />
              </section>
            </div>

            <div style={styles.reviewDetails}>
              <div style={styles.reviewName}>
                {previewUser.first_name} {previewUser.middle_name} {previewUser.last_name}
              </div>
              <div style={styles.reviewInfoGrid}>
                {getUserDetails(previewUser).map((item) => (
                  <div key={item.label} style={styles.reviewInfoItem}>
                    <span style={styles.reviewInfoLabel}>{item.label}</span>
                    <span style={styles.reviewInfoValue}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {operationState.open && (
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingBox}>
            <div style={styles.loadingSpinner} />
            <h3 style={styles.loadingTitle}>{operationState.title}</h3>
            <p style={styles.loadingText}>{operationState.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  mainContent: ui.main,
  header: ui.headerStack,
  pageTitle: ui.pageTitle,
  batchBar: { display: 'flex', gap: '12px' },
  selectBtn: { padding: '10px 15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontWeight: '600' },
  batchApproveBtn: { backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', padding: '10px 20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' },
  card: { ...ui.card, padding: '20px', position: 'relative' },
  checkboxWrapper: { position: 'absolute', top: '15px', left: '15px', cursor: 'pointer' },
  cardHeader: { marginBottom: '15px', marginLeft: '30px' },
  userName: { margin: 0, fontSize: '18px' },
  detailsBox: { backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '15px', display: 'grid', gap: '10px' },
  detailText: { margin: 0, fontSize: '13px', display: 'flex', flexWrap: 'wrap', gap: '6px' },
  detailLabel: { minWidth: '100px', color: '#374151' },
  imageGrid: { display: 'flex', gap: '10px', height: '110px', marginBottom: '20px' },
  imgContainer: { flex: 1, borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee', cursor: 'zoom-in' },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  cardActions: { display: 'flex', gap: '10px' },
  approveBtn: { flex: 1, padding: '10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  rejectBtn: { flex: 1, padding: '10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.92)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '24px', backdropFilter: 'blur(10px)' },
  rejectionBox: { backgroundColor: 'white', padding: '30px', borderRadius: '15px', width: '450px' },
  textarea: { width: '100%', height: '100px', padding: '15px', borderRadius: '10px', border: '1px solid #ddd', marginBottom: '15px' },
  sendRejectBtn: { flex: 1, padding: '12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  cancelBtn: { flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  modalImage: { maxWidth: '90%', maxHeight: '90%', borderRadius: '10px' },
  reviewModal: { width: 'min(1120px, 100%)', maxHeight: '92vh', overflow: 'auto', backgroundColor: '#ffffff', borderRadius: '18px', boxShadow: '0 30px 80px rgba(15, 23, 42, 0.45)', padding: '22px' },
  reviewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '18px' },
  reviewTitle: { margin: 0, fontSize: '22px', color: '#0f172a' },
  reviewSubtitle: { margin: '6px 0 0', color: '#64748b', fontSize: '13px' },
  closeReviewBtn: { border: 'none', backgroundColor: '#f1f5f9', color: '#0f172a', width: '40px', height: '40px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  reviewGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '18px' },
  reviewPanel: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px' },
  panelLabel: { display: 'block', fontSize: '12px', fontWeight: 800, color: '#475569', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.6px' },
  reviewImage: { width: '100%', height: '320px', objectFit: 'cover', borderRadius: '12px', backgroundColor: '#e2e8f0' },
  reviewDetails: { borderTop: '1px solid #e2e8f0', paddingTop: '18px' },
  reviewName: { fontSize: '18px', fontWeight: 900, color: '#0f172a', marginBottom: '12px' },
  reviewInfoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' },
  reviewInfoItem: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', display: 'grid', gap: '4px' },
  reviewInfoLabel: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', fontWeight: 800 },
  reviewInfoValue: { fontSize: '14px', color: '#0f172a', fontWeight: 700, lineHeight: '1.35' },
  loadingOverlay: { position: 'fixed', inset: 0, zIndex: 1200, backgroundColor: 'rgba(15, 23, 42, 0.78)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  loadingBox: { width: 'min(420px, 100%)', backgroundColor: 'white', borderRadius: '20px', padding: '28px', boxShadow: '0 30px 80px rgba(15, 23, 42, 0.35)', display: 'grid', justifyItems: 'center', textAlign: 'center', gap: '14px' },
  loadingSpinner: { width: '52px', height: '52px', borderRadius: '50%', border: '5px solid #e2e8f0', borderTopColor: '#10b981', animation: 'spin 0.9s linear infinite' },
  loadingTitle: { margin: 0, fontSize: '20px', color: '#0f172a' },
  loadingText: { margin: 0, color: '#64748b', fontSize: '14px', lineHeight: '1.5' },
  emptyState: { textAlign: 'center', padding: '90px 20px', color: '#64748b', fontSize: '16px', fontWeight: 600 }
};
