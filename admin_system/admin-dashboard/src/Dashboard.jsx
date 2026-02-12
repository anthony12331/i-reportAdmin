import { useNavigate } from 'react-router-dom';
import { pb } from './pocketbase';

export default function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    pb.authStore.clear();
    navigate('/');
  };

  return (
    <div style={{ padding: '40px' }}>
      <h1>✅ Welcome to the Dashboard</h1>
      <p>You are logged in as: <strong>{pb.authStore.model?.email}</strong></p>
      <p>Position: {pb.authStore.model?.position}</p>
      <button onClick={handleLogout} style={{ padding: '10px', background: 'red', color: 'white' }}>
        Logout
      </button>
    </div>
  );
}