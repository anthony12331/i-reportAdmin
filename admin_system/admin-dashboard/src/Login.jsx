    import { useState } from 'react';
    import {useNavigate, Link } from 'react-router-dom';
    import {pb} from './pocketbase';
    import { Lock, User } from 'lucide-react';

    export default function Login(){
        const [email, setEmail ]= useState('');
        const [password, setPassword] = useState('');
        const[loading, setLoading ]= useState(false);
        const navigate = useNavigate();
    

        const handleLogin = async (e) => {
            e.preventDefault();
            setLoading(true);

            try {
                //login of admin

await pb.collection('admins').authWithPassword(email, password);
                //if success
                alert ("successfully login");
                navigate('/dashboard');
            } catch{
                alert('failed please try agin');
            }
            setLoading(false);
        };  
        
        return (
                <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '350px' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#dc2626' }}>🚑 Admin Login</h2>
            
            <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', border: '1px solid #ddd', padding: '10px', borderRadius: '5px' }}>
                <User size={18} color="#666" />
                <input 
                type="email" 
                placeholder="admin@lagonglong.gov" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                style={{ border: 'none', outline: 'none', marginLeft: '10px', width: '100%' }} 
                />
            </div>

            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', border: '1px solid #ddd', padding: '10px', borderRadius: '5px' }}>
                <Lock size={18} color="#666" />
                <input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                style={{ border: 'none', outline: 'none', marginLeft: '10px', width: '100%' }} 
                />
            </div>

            <button type="submit" style={{ width: '100%', padding: '10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                {loading ? "Logging in..." : "LOGIN"}
            </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '14px' }}>
            <Link to="./Register" style={{ color: '#2563eb', textDecoration: 'none' }}>Register</Link>
            </p>
            
        </div>
        </div>
                
        )


    }