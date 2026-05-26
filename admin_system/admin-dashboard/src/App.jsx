import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { pb } from './pocketbase'; 

// Page Imports
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import OngoingIncidents from './ongoing-incidents'; 
import ResolvedIncidents from './resolved-incidents';
import PendingUserRegistration from './pending-users'; 
import PendingIncidents from './pending-incidents'; 
// 🚨 Updated filename to kebab-case below
import VerifiedUsers from './verified-users'; 

function App() {
  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // The Global Background Listener for Emergency Reports
    pb.collection('incident_reports').subscribe('*', (e) => {
      if (isMounted && (e.action === 'create' || e.action === 'update') && e.record.status === 'pending') {
        console.log("🚨 EMERGENCY DETECTED!");
        
        const alertSound = document.getElementById('emergency-alert-sound');
        if (alertSound) {
          alertSound.currentTime = 0; 
          alertSound.play().catch(error => {
            console.warn("Autoplay blocked. Admin must click screen first.", error);
          });
        }
      }
    });

    return () => {
      isMounted = false;
      pb.collection('incident_reports').unsubscribe('*');
    };
  }, []);

  const enableAudio = () => {
    if (!audioEnabled) {
      setAudioEnabled(true);
      const alertSound = document.getElementById('emergency-alert-sound');
      if (alertSound) {
        alertSound.play().then(() => {
          alertSound.pause();
          alertSound.currentTime = 0;
        }).catch(e => console.log("Audio unlock failed:", e));
      }
    }
  };

  return (
    <div onClick={enableAudio} style={{ minHeight: '100vh', width: '100%' }}>
      
      {/* INVISIBLE AUDIO ELEMENT */}
      <audio id="emergency-alert-sound" src="/notification_sound.mp3" preload="auto" />

      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pending-users" element={<PendingUserRegistration />} />
          
          {/* 🚨 Updated Route for the new file */}
          <Route path="/verified-users" element={<VerifiedUsers />} /> 
          
          <Route path="/pending-incidents" element={<PendingIncidents />} />
          <Route path="/ongoing-incidents" element={<OngoingIncidents />} />
          <Route path="/resolved-incidents" element={<ResolvedIncidents />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;