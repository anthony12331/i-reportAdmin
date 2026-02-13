import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';

// 👇 CRITICAL CHANGE: Matches your new filename "pending-users.jsx"
import PendingUserRegistration from './pending-users'; 

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Private Admin Routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* 👇 This route now connects to your new file */}
        <Route path="/pending-users" element={<PendingUserRegistration />} />
        
      </Routes>
    </Router>
  );
}

export default App;