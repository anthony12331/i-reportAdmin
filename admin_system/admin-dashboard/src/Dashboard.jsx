import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from './pocketbase';

export default function Dashboard() {
  const navigate = useNavigate();
  const [residents, setResidents] = useState([]);
  const admin = pb.authStore.model;

  useEffect(() => {
    const fetchResidents = async () => {
      try {
        const records = await pb.collection('users').getFullList({
          requestKey: null, 
        });
        setResidents(records);
      } catch (error) {
        console.error("Fetch Error:", error);
      }
    };
    fetchResidents();
  }, []);

  const handleLogout = () => {
    pb.authStore.clear();
    navigate('/');
  };

  const handleVerify = async (id) => {
    try {
      // Updates the status in your PocketBase collection
      await pb.collection('users').update(id, { status: 'verified' });
      setResidents(residents.map(res => 
        res.id === id ? { ...res, status: 'verified' } : res
      ));
      alert("Resident Verified!");
    } catch (error) {
      console.error("Verification failed:", error);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
        <div>
          <h2>Incident Reporting Admin Panel</h2>
          <p>Logged in as: <strong>{admin?.first_name} {admin?.last_name}</strong> ({admin?.position})</p>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </div>

      <h3>Registered Residents Management</h3>
      <table style={styles.table}>
        <thead>
          <tr style={{ background: '#f4f4f4' }}>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Selfie</th>
            <th style={styles.th}>ID Photo</th>
            <th style={styles.th}>Address</th>
            <th style={styles.th}>Status/Action</th>
          </tr>
        </thead>
        <tbody>
          {residents.map((res) => {
            // FIX: Using pb.files.getURL() to stop console warnings
            const selfieUrl = res.selfie ? pb.files.getURL(res, res.selfie, { 'thumb': '100x100' }) : null;
            const idUrl = res.id_photo ? pb.files.getURL(res, res.id_photo, { 'thumb': '100x100' }) : null;

            return (
              <tr key={res.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={styles.td}>{res.first_name} {res.last_name}</td>
                <td style={styles.td}>
                  {selfieUrl ? <img src={selfieUrl} alt="Selfie" style={styles.imgThumbnail} onClick={() => window.open(selfieUrl, '_blank')} /> : "No Selfie"}
                </td>
                <td style={styles.td}>
                  {idUrl ? <img src={idUrl} alt="ID" style={styles.imgThumbnail} onClick={() => window.open(idUrl, '_blank')} /> : "No ID"}
                </td>
                <td style={styles.td}>{res.address}</td>
                <td style={styles.td}>
                  {res.status === 'pending' ? (
                    <button onClick={() => handleVerify(res.id)} style={styles.approveBtn}>Approve</button>
                  ) : (
                    <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>Verified ✓</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '10px' },
  th: { padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' },
  td: { padding: '12px', textAlign: 'left' },
  imgThumbnail: { width: '50px', height: '50px', objectFit: 'cover', borderRadius: '5px', cursor: 'pointer', border: '1px solid #ccc' },
  logoutBtn: { padding: '10px 20px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  approveBtn: { padding: '5px 12px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }
};