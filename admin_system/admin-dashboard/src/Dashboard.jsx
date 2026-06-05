import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from './pocketbase';
import Sidebar from './Sidebar';
import { getReadableAddress } from './utils';
import { ui } from './uiStyles';
import { getPriorityLabel, getPriorityStyles, sortIncidentReportsByPriority } from './incidentPriority';
import { isIncidentReviewed } from './incidentReview';
import { formatWaitTime } from './timeUtils';
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
        const pending = sortIncidentReportsByPriority(
          reportRecords.filter(r => r.status === 'new' || r.status === 'pending')
        ).slice(0, 5);
        const fetchedAddresses = {};
        const addressPairs = await Promise.all(
          pending
            .filter(report => report.latitude != null && report.longitude != null)
            .map(async (report) => [report.id, await getReadableAddress(report.latitude, report.longitude)])
        );

        for (const [id, address] of addressPairs) {
          fetchedAddresses[id] = address;
        }
        setAddresses(fetchedAddresses);

      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    
    fetchData();

    let unsubscribeUsers;
    let unsubscribeReports;

    const setupSubscriptions = async () => {
      unsubscribeUsers = await pb.collection('users').subscribe('*', (e) => {
        setUsers(prev => {
          if (e.action === 'create') return [...prev, e.record];
          if (e.action === 'update') return prev.map(u => u.id === e.record.id ? e.record : u);
          if (e.action === 'delete') return prev.filter(u => u.id !== e.record.id);
          return prev;
        });
      });
      unsubscribeReports = await pb.collection('incident_reports').subscribe('*', (e) => {
        setReports(prev => {
          if (e.action === 'create') return [e.record, ...prev];
          if (e.action === 'update') return prev.map(r => r.id === e.record.id ? e.record : r);
          if (e.action === 'delete') return prev.filter(r => r.id !== e.record.id);
          return prev;
        });

        // Auto-resolve new addresses for live alerts
        if ((e.action === 'create' || e.action === 'update') && 
            (e.record.status === 'new' || e.record.status === 'pending') && 
            e.record.latitude && e.record.longitude) {
           getReadableAddress(e.record.latitude, e.record.longitude).then(addr => {
             setAddresses(prev => ({ ...prev, [e.record.id]: addr }));
           });
        }
      }, { expand: 'users' });
    };

    setupSubscriptions();

    return () => {
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeReports) unsubscribeReports();
    };
  }, []);

  const pendingUsersCount = users.filter(u => u.status === 'pending').length;
  const verifiedUsersCount = users.filter(u => u.status === 'verified').length;
  const pendingIncidents = sortIncidentReportsByPriority(reports.filter(r => r.status === 'new' || r.status === 'pending'));
  const ongoingIncidentsCount = reports.filter(r => r.status === 'ongoing' || r.status === 'dispatched').length;
  const resolvedIncidentsCount = reports.filter(r => r.status === 'resolved').length;

  return (
    <div style={ui.shell}>
      
      {/* --- IMPORTED SIDEBAR --- */}
      <Sidebar />

      <main style={ui.main}>
        <header style={ui.headerStack}>
          <h1 style={ui.pageTitle}>Command Center Overview</h1>
          <p style={ui.subtitle}>Real-time monitoring and administration</p>
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
                    <td style={{ fontWeight: 'bold', color: '#d32f2f' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {!isIncidentReviewed(report.id) && <span style={styles.newBadge}>NEW</span>}
                        {report.type.toUpperCase()}
                      </div>
                    </td>
                    <td>{report.expand?.users?.first_name} {report.expand?.users?.last_name || 'Citizen'}</td>
                    <td style={{ fontSize: '12px', color: '#4b5563', maxWidth: '250px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} color="#d32f2f" />
                        {addresses[report.id] || "Locating..."}
                      </div>
                    </td>
                    <td>
                      <div>{new Date(report.created).toLocaleTimeString()}</div>
                      <div style={styles.waitText}>{formatWaitTime(report.created)}</div>
                      <span style={{ ...styles.priorityBadge, color: getPriorityStyles(report).color, backgroundColor: getPriorityStyles(report).bg, borderColor: getPriorityStyles(report).border }}>
                        {getPriorityLabel(report)}
                      </span>
                    </td>
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
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '18px', marginBottom: '28px' },
  card: { ...ui.card, padding: '20px', cursor: 'pointer' },
  bigNumber: { fontSize: '30px', fontWeight: 'bold', margin: '10px 0', color: '#1f2937' },
  alertSection: { ...ui.panel, padding: '22px' },
  alertBoxPlaceholder: { height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #ddd', borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '12px', borderBottom: '2px solid #eee', fontSize: '14px' },
  tr: { borderBottom: '1px solid #eee' },
  actionBtn: { padding: '8px 12px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  viewAllBtn: { padding: '8px 14px', backgroundColor: 'transparent', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 },
  newBadge: { padding: '3px 7px', borderRadius: '8px', backgroundColor: '#d32f2f', color: 'white', fontSize: '10px', fontWeight: 900 },
  priorityBadge: { display: 'inline-flex', marginTop: '4px', padding: '3px 7px', border: '1px solid', borderRadius: '8px', fontSize: '10px', fontWeight: 900 },
  waitText: { marginTop: '2px', color: '#64748b', fontSize: '11px', fontWeight: 700 }
};
