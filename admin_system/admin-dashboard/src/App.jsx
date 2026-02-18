import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';

// Matches your file "pending-users.jsx"
import PendingUserRegistration from './pending-users'; 

// 1. ADD THIS IMPORT for your new file "pending-incidents.jsx"
import PendingIncidents from './pending-incidents'; 

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Private Admin Routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Route for User Verifications */}
        <Route path="/pending-users" element={<PendingUserRegistration />} />

        {/* 2. REGISTER THE NEW ROUTE FOR INCIDENTS HERE */}
        <Route path="/pending-incidents" element={<PendingIncidents />} />
        
      </Routes>
    </Router>
  );
}

export default App;