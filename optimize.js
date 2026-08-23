
const fs = require('fs');
let code = fs.readFileSync('C:/Users/jokemaster/Desktop/projects/Ireport-june-24-2026/updates/admin_system/client/src/components/DashboardMap.jsx', 'utf8');

const markerMemoStr = \
  const reportMarkers = useMemo(() => {
    return validReports.map(report => {
      const typeLabel = report.type || report.incident_type || report.category || 'Unknown';
      const color = stringToColor(typeLabel);
      return (
        <Marker 
          key={\\\eport-\\\\\\} 
          position={[report.latitude, report.longitude]}
          icon={createCustomIcon(color, false)}
        >
          <Popup>
            <div style={{ fontWeight: 'bold', color: color, textTransform: 'capitalize', fontSize: '14px', marginBottom: '4px' }}>
              {typeLabel}
            </div>
            <div style={{ fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
              <strong>Status:</strong> {report.status}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              {new Date(report.created).toLocaleString()}
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [validReports]);

  const sosMarkers = useMemo(() => {
    return validSos.map(s => (
      <Marker 
        key={\\\sos-\\\\\\} 
        position={[s.latitude, s.longitude]}
        icon={createCustomIcon('#ef4444', true)}
      >
        <Popup>
          <div style={{ fontWeight: 'bold', color: '#ef4444', fontSize: '14px', marginBottom: '4px' }}>
            ?? ACTIVE SOS
          </div>
          <div style={{ fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
            <strong>User:</strong> {s.expand?.user?.name || 'Unknown'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {new Date(s.created).toLocaleString()}
          </div>
        </Popup>
      </Marker>
    ));
  }, [validSos]);

  const backupMarkers = useMemo(() => {
    return validBackups.map(b => {
      const reqName = b.expand?.requester_id?.unit_name || b.expand?.requester_id?.first_name || 'Unit';
      return (
        <Marker 
          key={\\\ackup-\\\\\\} 
          position={[b.latitude, b.longitude]}
          icon={createCustomIcon('#f59e0b', true)}
        >
          <Popup>
            <div style={{ fontWeight: 'bold', color: '#f59e0b', fontSize: '14px', marginBottom: '4px' }}>
              ?? BACKUP REQUEST
            </div>
            <div style={{ fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
              <strong>Requester:</strong> {reqName}
            </div>
            <div style={{ fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
              <strong>Reason:</strong> {b.reason || 'Not specified'}
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [validBackups]);

  const dispatchPaths = useMemo(() => {
    return dispatches.map(dispatch => {
      if (dispatch.status === 'resolved') return null;
      const responder = responders.find(r => r.id === dispatch.responder_id);
      if (!responder || !responder.latitude || !responder.longitude) return null;
      
      let target = validReports.find(r => r.id === dispatch.incident_id);
      let isSosTarget = false;
      if (!target) {
        target = validSos.find(s => s.id === dispatch.sos_id);
        if (target) isSosTarget = true;
      }
      if (!target || !target.latitude || !target.longitude) return null; 
      
      const metrics = calculateDistanceAndETA(responder.latitude, responder.longitude, target.latitude, target.longitude);
      
      return (
        <React.Fragment key={\\\dispatch-\\\\\\}>
          <Polyline 
            positions={[[responder.latitude, responder.longitude], [target.latitude, target.longitude]]} 
            pathOptions={{ color: '#2563eb', dashArray: '5, 10', weight: 3, opacity: 0.8 }} 
          />
          <Marker 
            position={[responder.latitude, responder.longitude]}
            icon={createResponderIcon()}
            zIndexOffset={1000}
          >
            <Popup>
              <div style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '14px', marginBottom: '4px' }}>
                {responder.unit_name || \\\\\\ \\\\\\}
              </div>
              <div style={{ fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
                <strong>Dept:</strong> <span style={{ textTransform: 'capitalize' }}>{responder.department}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
                <strong>Target:</strong> <span style={{ textTransform: 'capitalize' }}>{isSosTarget ? 'SOS Alert' : (target.type || 'Incident')}</span>
              </div>
              <hr style={{ margin: '6px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
              <div style={{ fontSize: '12px', color: '#334155', marginBottom: '2px' }}>
                <strong>Distance:</strong> {metrics.distance} km
              </div>
              <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 'bold' }}>
                <strong>ETA:</strong> {metrics.eta}
              </div>
            </Popup>
          </Marker>
        </React.Fragment>
      );
    });
  }, [dispatches, responders, validReports, validSos]);

  return (
\;

code = code.replace('  return (\\r\\n    <div style={{ width: \\'100%', markerMemoStr.replace(/\\r\\n/g, '\\n'));
code = code.replace('  return (\\n    <div style={{ width: \\'100%', markerMemoStr.replace(/\\r\\n/g, '\\n'));

const mapChildrenStr = \
        {reportMarkers}
        {sosMarkers}
        {backupMarkers}
        {dispatchPaths}
      </MapContainer>
\;

const splitBy = '{validReports.map(report => {';
if (code.includes(splitBy)) {
  const top = code.split(splitBy)[0];
  code = top + mapChildrenStr.trim() + '\\n    </div>\\n  );\\n}\\n';
  fs.writeFileSync('C:/Users/jokemaster/Desktop/projects/Ireport-june-24-2026/updates/admin_system/client/src/components/DashboardMap.jsx', code);
  console.log('Successfully optimized DashboardMap.jsx');
} else {
  console.log('Failed to find split block');
}

