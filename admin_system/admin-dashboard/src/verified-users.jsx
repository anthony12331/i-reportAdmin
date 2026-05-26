import { useState, useEffect } from 'react';
import { pb } from './pocketbase';
import Sidebar from './Sidebar'; 
import { 
  ShieldCheck, MapPin, Phone, User, 
  Search, ExternalLink, Calendar, ZoomIn 
} from 'lucide-react';

export default function VerifiedUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [previewImage, setPreviewImage] = useState(null); // State for clickable image

  const fetchVerifiedUsers = async () => {
    setLoading(true);
    try {
      const records = await pb.collection('users').getFullList({
        filter: 'status = "verified"',
        sort: '-user_id', 
      });
      setUsers(records);
    } catch (error) {
      console.error("Error fetching verified users:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVerifiedUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.user_id?.toString().includes(searchTerm)
  );

  return (
    <div style={styles.container}>
      <Sidebar />
      <main style={styles.mainContent}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Verified Citizens</h1>
            <p style={styles.subtitle}>Official members of the Lagonglong Emergency System.</p>
          </div>
          
          <div style={styles.searchWrapper}>
            <Search size={18} color="#9ca3af" />
            <input 
              type="text" 
              placeholder="Search Name or ID..." 
              style={styles.searchInput}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </header>

        {loading ? (
          <div style={styles.emptyState}>Loading verified database...</div>
        ) : (
          <div style={styles.grid}>
            {filteredUsers.map((user) => {
              // PocketBase Helper to get the File URL
              const profileImageUrl = user.selfie 
                ? pb.files.getURL(user, user.selfie) 
                : null;

              return (
                <div key={user.id} style={styles.card}>
                  {/* CLICKABLE USER ID */}
                  <div 
                    style={styles.idBadge} 
                    onClick={() => alert(`System ID: ${user.id}\nDisplay ID: #${user.user_id}`)}
                    title="Click for details"
                  >
                    ID #{user.user_id}
                  </div>
                  
                  <div style={styles.profileSection}>
                    {/* CLICKABLE PROFILE IMAGE */}
                    <div 
                      style={styles.avatarWrapper} 
                      onClick={() => profileImageUrl && setPreviewImage(profileImageUrl)}
                    >
                      {profileImageUrl ? (
                        <img src={profileImageUrl} alt="Profile" style={styles.avatarImg} />
                      ) : (
                        <User size={24} color="#10b981" />
                      )}
                      <div style={styles.zoomOverlay}><ZoomIn size={14} color="white" /></div>
                    </div>

                    <div>
                      <h3 style={styles.userName}>{user.first_name} {user.last_name}</h3>
                      <span style={styles.statusLabel}>
                        <ShieldCheck size={12} /> Verified
                      </span>
                    </div>
                  </div>

                  <div style={styles.infoGrid}>
                    <div style={styles.infoItem}>
                      <Phone size={14} color="#6b7280" />
                      <span>{user.contact_number}</span>
                    </div>
                    <div style={styles.infoItem}>
                      <MapPin size={14} color="#6b7280" />
                      <span>{user.baranggay}</span>
                    </div>
                  </div>

                 
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* IMAGE PREVIEW MODAL */}
      {previewImage && (
        <div style={styles.modalOverlay} onClick={() => setPreviewImage(null)}>
          <div style={styles.modalContent}>
            <img src={previewImage} style={styles.largeImage} alt="Large Profile Preview" />
            <p style={{ color: 'white', marginTop: '10px' }}>Click anywhere to close</p>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' },
  mainContent: { marginLeft: '260px', flex: 1, padding: '40px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' },
  pageTitle: { fontSize: '28px', color: '#111827', margin: 0, fontWeight: '800' },
  subtitle: { color: '#6b7280', marginTop: '5px' },
  searchWrapper: { display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '10px 15px', borderRadius: '10px', border: '1px solid #e5e7eb', width: '300px', gap: '10px' },
  searchInput: { border: 'none', outline: 'none', width: '100%', fontSize: '14px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' },
  card: { backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative', border: '1px solid #f3f4f6' },
  
  // ID Badge Style
  idBadge: { position: 'absolute', top: '20px', right: '20px', backgroundColor: '#ecfdf5', color: '#065f46', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
  
  profileSection: { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' },
  
  // Avatar Wrapper Logic
  avatarWrapper: { width: '55px', height: '55px', borderRadius: '14px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', position: 'relative', border: '2px solid #fff', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  zoomOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' },
  // Adding hover effect via standard CSS would be better, but for inline styles:
  userName: { margin: 0, fontSize: '18px', color: '#111827' },
  statusLabel: { fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '15px 0', borderTop: '1px solid #f3f4f6', marginBottom: '15px' },
  infoItem: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#4b5563' },
  viewBtn: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  
  // Modal Styles
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, flexDirection: 'column' },
  modalContent: { textAlign: 'center' },
  largeImage: { maxWidth: '80vw', maxHeight: '80vh', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' },
  emptyState: { textAlign: 'center', padding: '100px', color: '#9ca3af' }
};