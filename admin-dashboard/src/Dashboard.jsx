import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from './pocketbase';
import Sidebar from './Sidebar';
import { getReadableAddress } from './utils';
import { ui } from './uiStyles';
import { sortIncidentReportsByPriority } from './incidentPriority';
import { formatWaitTime } from './timeUtils';
import { MapPin, Radio } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({ users: [], reports: [], sos: [] });
  const [addresses, setAddresses] = useState({});

  const loadData = async () => {
    try {
      const [users, reports, sos] = await Promise.all([
        pb.collection('users').getFullList({ requestKey: null }),
        pb.collection('incident_reports').getFullList({ sort: '-created', expand: 'users', requestKey: null }),
        pb.collection('sos_tracking').getFullList({ filter: 'status != "resolved"', sort: '-created', expand: 'users', requestKey: null })
      ]);
      setData({ users, reports, sos });
      
      // Resolve addresses for visible items only to save bandwidth
      const itemsToResolve = [
        ...reports.filter(r => ['new', 'pending'].includes(r.status)).slice(0, 5),
        ...sos.slice(0, 3)
      ];
      
      const newAddresses = { ...addresses };
      for (const item of itemsToResolve.filter(i => i.latitude && !newAddresses[i.id])) {
        newAddresses[item.id] = await getReadableAddress(item.latitude, item.longitude);
      }
      setAddresses(newAddresses);
    } catch (e) {
      console.error("Telemetry fetch failed", e);
    }
  };

  useEffect(() => {
    loadData();
    const subs = [
      pb.collection('users').subscribe('*', loadData),
      pb.collection('incident_reports').subscribe('*', loadData),
      pb.collection('sos_tracking').subscribe('*', loadData)
    ];
    return () => subs.forEach(s => s.then(u => u()));
  }, []);

  const stats = {
    pending: sortIncidentReportsByPriority(data.reports.filter(r => ['new', 'pending'].includes(r.status))),
    ongoing: data.reports.filter(r => ['ongoing', 'dispatched'].includes(r.status)).length,
    resolved: data.reports.filter(r => r.status === 'resolved').length,
    uPending: data.users.filter(u => u.status === 'pending').length,
    uVerified: data.users.filter(u => u.status === 'verified').length
  };

  return (
    <div style={ui.shell}>
      <Sidebar 
        pendingIncidentsCount={stats.pending.length} 
        ongoingIncidentsCount={stats.ongoing} 
        pendingUsersCount={stats.uPending} 
        pendingSosCount={data.sos.length} 
      />

      <main style={ui.main}>
        <header style={ui.headerStack}>
          <h1>Command Center Overview</h1>
          <p style={ui.subtitle}>Live operations monitoring</p>
        </header>

        {/* --- SUMMARY CARDS --- */}
        <div style={styles.cardGrid}>
          <SummaryCard title="Live SOS" val={data.sos.length} color="#dc2626" onClick={() => navigate('/pending-sos')} />
          <SummaryCard title="Pending" val={stats.pending.length} color="#d32f2f" onClick={() => navigate('/pending-incidents')} />
          <SummaryCard title="Ongoing" val={stats.ongoing} color="#ff9800" onClick={() => navigate('/ongoing-incidents')} />
          <SummaryCard title="Resolved" val={stats.resolved} color="#4caf50" onClick={() => navigate('/resolved-incidents')} />
          <SummaryCard title="Pending Users" val={stats.uPending} color="#2196f3" onClick={() => navigate('/pending-users')} />
        </div>

        {/* --- SOS FEED --- */}
        {data.sos.length > 0 && (
          <div style={{ ...styles.alertSection, border: '2px solid #fca5a5' }}>
            <h2 style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={20}/> Active SOS Alerts
            </h2>
            <table style={styles.table}>
              <tbody>{data.sos.slice(0, 3).map(s => (
                <tr key={s.id} style={styles.tr}>
                  <td style={{ fontWeight: 'bold' }}>{s.expand?.users?.first_name || 'Resident'}</td>
                  <td>{s.sync_channel?.toUpperCase()}</td>
                  <td>{formatWaitTime(s.created)}</td>
                  <td><button onClick={() => navigate('/pending-sos')} style={styles.actionBtn}>Track</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {/* --- INCIDENT FEED --- */}
        <div style={styles.alertSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>⚠️ Pending Reports</h2>
            <button onClick={() => navigate('/pending-incidents')} style={styles.viewAllBtn}>View All</button>
          </div>
          <table style={styles.table}>
            <tbody>{stats.pending.slice(0, 5).map(r => (
              <tr key={r.id} style={styles.tr}>
                <td>{r.type.toUpperCase()}</td>
                <td>{r.expand?.users?.first_name || 'Citizen'}</td>
                <td><MapPin size={12} /> {addresses[r.id] || "Locating..."}</td>
                <td>{formatWaitTime(r.created)}</td>
                <td><button onClick={() => navigate('/pending-incidents')} style={styles.actionBtn}>Dispatch</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

const SummaryCard = ({ title, val, color, onClick }) => (
  <div style={{ ...styles.card, borderLeft: `5px solid ${color}` }} onClick={onClick}>
    <h3>{title}</h3>
    <p style={styles.bigNumber}>{val}</p>
  </div>
);

const styles = {
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' },
  card: { ...ui.card, padding: '20px', cursor: 'pointer' },
  bigNumber: { fontSize: '28px', fontWeight: 'bold', margin: '5px 0' },
  alertSection: { ...ui.panel, padding: '20px', marginBottom: '20px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  tr: { borderBottom: '1px solid #f0f0f0' },
  actionBtn: { padding: '6px 10px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' },
  viewAllBtn: { padding: '6px 10px', border: '1px solid #ddd', borderRadius: '5px', cursor: 'pointer' }
};