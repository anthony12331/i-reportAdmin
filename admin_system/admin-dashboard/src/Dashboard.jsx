import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from './pocketbase';
import Sidebar from './Sidebar';
import { getReadableAddress } from './utils';
import { MapPin } from 'lucide-react'; // Added an icon for the location

export default function Dashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [addresses, setAddresses] = useState({}); // State to hold translated addresses

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRecords = await pb.collection('users').getFullList({ requestKey: null });
        setUsers(userRecords);

        // Added expand: 'users' so we can get the reporter's name
        const reportRecords = await pb.collection('incident_reports').getFullList({ 
          sort: '-created',
          expand: 'users', 
          requestKey: null 
        });
        setReports(reportRecords);

        // --- THE MAGIC: Translate addresses for the top 5 pending alerts ---
        const pending = reportRecords.filter(r => r.status === 'new' || r.status === 'pending').slice(0, 5);
        const fetchedAddresses = {};
        
        for (const report of pending) {
          if (report.latitude && report.longitude) {
             // We use your pure function tool here!
             fetchedAddresses[report.id] = await getReadableAddress(report.latitude, report.longitude);
          }
        }
        setAddresses(fetchedAddresses);

      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    
    fetchData();
  }, []);

  const pendingUsersCount = users.filter(u => u.status === 'pending').length;
  const verifiedUsersCount = users.filter(u => u.status === 'verified').length;
  const pendingIncidents = reports.filter(r => r.status === 'new' || r.status === 'pending');
  const ongoingIncidentsCount = reports.filter(r => r.status === 'ongoing' || r.status === 'dispatched').length;
  const resolvedIncidentsCount = reports.filter(r => r.status === 'resolved').length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6f8' }}>
      
      {/* --- IMPORTED SIDEBAR --- */}
      <Sidebar 
        pendingIncidentsCount={pendingIncidents.length}
        ongoingIncidentsCount={ongoingIncidentsCount}
        pendingUsersCount={pendingUsersCount}
      />

      <main style={{ marginLeft: '260px', flex: 1, padding: '30px' }}>
        <header style={{ marginBottom: '30px' }}>
          <h1>Command Center Overview</h1>
          <p style={{ color: '#666' }}>Real-time monitoring and administration</p>
        </header>

        {/* --- SUMMARY CARDS --- */}
        <div style={styles.cardGrid}>
          <div style={{ ...styles.card, borderLeft: '5px solid #d32f2f' }} onClick={() => navigate('/pending-incidents')}>
            <h3>Pending Reports</h3>
            <p style={styles.bigNumber}>{pendingIncidents.length}</p>
            <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>NEEDS ACTION!</span>
          </div>

          <div style={{ ...styles.card, borderLeft: '5px solid #ff9800' }} onClick={() => navigate('/ongoing-incidents')}>
            <h3>Ongoing Incidents</h3>
            <p style={styles.bigNumber}>{ongoingIncidentsCount}</p>
            <span style={{ color: '#f57c00' }}>Responders Active</span>
          </div>

          <div style={{ ...styles.card, borderLeft: '5px solid #4caf50' }} onClick={() => navigate('/resolved-incidents')}>
            <h3>Resolved Incidents</h3>
            <p style={styles.bigNumber}>{resolvedIncidentsCount}</p>
            <span style={{ color: '#2e7d32' }}>Cases Closed</span>
          </div>

          <div style={{ ...styles.card, borderLeft: '5px solid #2196f3' }} onClick={() => navigate('/pending-users')}>
            <h3>Pending Users</h3>
            <p style={styles.bigNumber}>{pendingUsersCount}</p>
            <span style={{ color: '#1976d2' }}>Waiting Verification</span>
          </div>

          <div style={{ ...styles.card, borderLeft: '5px solid #607d8b' }} onClick={() => navigate('/verified-users')}>
            <h3>Verified Users</h3>
            <p style={styles.bigNumber}>{verifiedUsersCount}</p>
            <span style={{ color: '#455a64' }}>Total Residents</span>
          </div>
        </div>

        {/* --- LIVE ALERTS TABLE --- */}
        <div style={styles.alertSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2>⚠️ New Pending Reports</h2>
            <button onClick={() => navigate('/pending-incidents')} style={styles.viewAllBtn}>View All</button>
          </div>

          {pendingIncidents.length === 0 ? (
             <div style={styles.alertBoxPlaceholder}>
               <p style={{ color: '#888' }}>No new reports. System is clear.</p>
             </div>
          ) : (
            <table style={styles.table}>
              <thead>
               <tr style={{ textAlign: 'left', backgroundColor: '#f9fafb' }}>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Reporter</th>
                  <th style={styles.th}>Location</th> 
                  <th style={styles.th}>Time</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingIncidents.slice(0, 5).map((report) => (
                  <tr key={report.id} style={styles.tr}>
                    <td style={{ fontWeight: 'bold', color: '#d32f2f' }}>{report.type.toUpperCase()}</td>
                    <td>{report.expand?.users?.first_name} {report.expand?.users?.last_name || 'Citizen'}</td>
                    <td style={{ fontSize: '12px', color: '#4b5563', maxWidth: '250px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} color="#d32f2f" />
                        {addresses[report.id] || "Locating..."}
                      </div>
                    </td>
                    <td>{new Date(report.created).toLocaleTimeString()}</td>
                    <td>
                      <button style={styles.actionBtn} onClick={() => navigate('/pending-incidents')}>
                        Dispatch Now
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

const styles = {
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' },
  card: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', cursor: 'pointer' },
  bigNumber: { fontSize: '32px', fontWeight: 'bold', margin: '10px 0', color: '#1f2937' },
  alertSection: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  alertBoxPlaceholder: { height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #ddd', borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '12px', borderBottom: '2px solid #eee', fontSize: '14px' },
  tr: { borderBottom: '1px solid #eee' },
  actionBtn: { padding: '6px 12px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  viewAllBtn: { padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }
};