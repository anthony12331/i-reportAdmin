import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { pb } from './pocketbase'; 

import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import OngoingIncidents from './ongoing-incidents'; 
import ResolvedIncidents from './resolved-incidents';
import PendingUserRegistration from './pending-users'; 
import PendingIncidents from './pending-incidents'; 

function App() {
  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // The Global Background Listener
    pb.collection('incident_reports').subscribe('*', (e) => {
      
      // Listens for both brand new records AND updated records set to 'pending'
      if (isMounted && (e.action === 'create' || e.action === 'update') && e.record.status === 'pending') {
        
        console.log("🚨 EMERGENCY DETECTED! Playing alert sound...");
        
        const alertSound = document.getElementById('emergency-alert-sound');
        if (alertSound) {
          alertSound.currentTime = 0; // Reset sound to beginning if it's already playing
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

  // Browser Autoplay Workaround
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
    // minHeight: '100vh' ensures the clickable area covers the whole screen!
    <div onClick={enableAudio} style={{ minHeight: '100vh', width: '100%' }}>
      
      {/* INVISIBLE AUDIO ELEMENT - This is much more reliable in React */}
      <audio id="emergency-alert-sound" src="/notification_sound.mp3" preload="auto" />

      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pending-users" element={<PendingUserRegistration />} />
          <Route path="/pending-incidents" element={<PendingIncidents />} />
          <Route path="/ongoing-incidents" element={<OngoingIncidents />} />
          <Route path="/resolved-incidents" element={<ResolvedIncidents />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;