import { useNavigate, useLocation } from 'react-router-dom';
import { pb } from './pocketbase';
import { LayoutDashboard, Users, Clock, History, LogOut, ShieldCheck } from 'lucide-react';

export default function Sidebar({ pendingIncidentsCount, ongoingIncidentsCount, pendingUsersCount }) {
  const navigate = useNavigate();
  const location = useLocation();
  const admin = pb.authStore.model;

  const handleLogout = () => {
    pb.authStore.clear();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <aside style={styles.sidebar}>
      <div style={styles.brandBox}>
        <h2 style={{ margin: 0, fontSize: '20px', lineHeight: '1.2' }}>Lagonglong<br/>Emergency</h2>
        <div style={styles.onlineBadge}>● System Online</div>
      </div>

      <nav style={styles.nav}>
        <p style={styles.sectionTitle}>MAIN</p>
        <div 
          style={isActive('/dashboard') ? styles.navItemActive : styles.navItem} 
          onClick={() => navigate('/dashboard')}
        >
          <div style={styles.navLinkGroup}>
            <LayoutDashboard size={18} /> 
            <span>Dashboard Overview</span>
          </div>
        </div>

        <p style={styles.sectionTitle}>INCIDENT MANAGEMENT</p>
        
        <div 
          style={isActive('/pending-incidents') ? styles.navItemActive : styles.navItem} 
          onClick={() => navigate('/pending-incidents')}
        >
          <div style={styles.navLinkGroup}>
            <Clock size={18} /> 
            <span>Pending Reports</span>
          </div>
          {pendingIncidentsCount > 0 && <span style={styles.badgeRed}>{pendingIncidentsCount}</span>}
        </div>
        
        <div 
          style={isActive('/ongoing-incidents') ? styles.navItemActive : styles.navItem} 
          onClick={() => navigate('/ongoing-incidents')}
        >
          <div style={styles.navLinkGroup}>
            <Clock size={18} /> 
            <span>Ongoing Incidents</span>
          </div>
          {ongoingIncidentsCount > 0 && <span style={styles.badgeOrange}>{ongoingIncidentsCount}</span>}
        </div>

        <div 
          style={isActive('/resolved-incidents') ? styles.navItemActive : styles.navItem} 
          onClick={() => navigate('/resolved-incidents')}
        >
          <div style={styles.navLinkGroup}>
            <History size={18} /> 
            <span>Resolved Incidents</span>
          </div>
        </div>

        <p style={styles.sectionTitle}>USER MANAGEMENT</p>
        
        <div 
          style={isActive('/pending-users') ? styles.navItemActive : styles.navItem} 
          onClick={() => navigate('/pending-users')}
        >
          <div style={styles.navLinkGroup}>
            <Users size={18} /> 
            <span>Pending Verification</span>
          </div>
          {pendingUsersCount > 0 && <span style={styles.badgeBlue}>{pendingUsersCount}</span>}
        </div>
        
        <div 
          style={isActive('/verified-users') ? styles.navItemActive : styles.navItem} 
          onClick={() => navigate('/verified-users')}
        >
          <div style={styles.navLinkGroup}>
            <ShieldCheck size={18} /> 
            <span>Verified Users</span>
          </div>
        </div>

        <div style={styles.logoutSection}>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
            Logged in as: <b>{admin?.username || 'Admin'}</b>
          </p>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </nav>
    </aside>
  );
}

const styles = {
  sidebar: { width: '260px', backgroundColor: '#1a1c23', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100%', left: 0, top: 0, zIndex: 1000 },
  brandBox: { padding: '25px 20px', borderBottom: '1px solid #2e303e' },
  onlineBadge: { fontSize: '11px', color: '#4caf50', marginTop: '5px', fontWeight: 'bold', letterSpacing: '0.5px' },
  nav: { flex: 1, padding: '10px 0', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  sectionTitle: { padding: '0 20px', fontSize: '10px', color: '#6b7280', fontWeight: 'bold', marginTop: '25px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' },
  
  // Alignment Fix: space-between ensures badges go to the right
  navItem: { padding: '12px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: '0.2s', color: '#9ca3af', fontSize: '14px' },
  navItemActive: { padding: '12px 20px', backgroundColor: '#2e303e', color: 'white', borderLeft: '4px solid #3b82f6', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' },
  
  navLinkGroup: { display: 'flex', alignItems: 'center', gap: '12px' }, // Consistent gap between icon and text
  
  badgeRed: { backgroundColor: '#d32f2f', color: 'white', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' },
  badgeOrange: { backgroundColor: '#ff9800', color: 'white', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' },
  badgeBlue: { backgroundColor: '#3b82f6', color: 'white', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' },
  
  logoutSection: { padding: '20px', borderTop: '1px solid #2e303e', backgroundColor: '#131419', marginTop: 'auto' },
  logoutBtn: { width: '100%', padding: '12px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.2s' },
};