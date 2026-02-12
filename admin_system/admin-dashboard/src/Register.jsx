import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { pb } from './pocketbase';

export default function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        passwordConfirm: '',
        first_name: '',
        middle_name: '',
        last_name: '',
        extension: '',
        position: ''
    });

    const handleRegister = async (e) => {
        e.preventDefault();

        // 1. Logic to check if passwords match
        if (formData.password !== formData.passwordConfirm) {
            alert("Passwords do not match!");
            return;
        }

        try {
            // 2. Create the record in your super_admins collection
            await pb.collection('admins').create(formData);
            alert("Registration Successful!");
            navigate('/'); 
        } catch (error) {
            // This catches errors like "email already exists" or "invalid email"
            alert("Error: " + error.message);
        }
    };

    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '100vh', 
            background: '#f3f4f6',
            padding: '20px'
        }}>
            <div style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '450px' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#111827' }}>Admin Registration</h2>
                
                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Email and Passwords */}
                    <input type="email" placeholder="Email" required style={styles.input}
                        onChange={e => setFormData({...formData, email: e.target.value})} />
                    
                    <input type="password" placeholder="Password" required style={styles.input}
                        onChange={e => setFormData({...formData, password: e.target.value})} />
                    
                    <input type="password" placeholder="Confirm Password" required style={styles.input}
                        onChange={e => setFormData({...formData, passwordConfirm: e.target.value})} />
                    
                    <hr style={{ border: '0', borderTop: '1px solid #eee', margin: '10px 0' }} />

                    {/* Personal Info */}
                    <input type="text" placeholder="First Name" required style={styles.input}
                        onChange={e => setFormData({...formData, first_name: e.target.value})} />
                    
                    <input type="text" placeholder="Middle Name" required style={styles.input}
                        onChange={e => setFormData({...formData, middle_name: e.target.value})} />
                    
                    <input type="text" placeholder="Last Name" required style={styles.input}
                        onChange={e => setFormData({...formData, last_name: e.target.value})} />
                    
                    <input type="text" placeholder="Extension (e.g. Jr., Sr.) - Optional" style={styles.input}
                        onChange={e => setFormData({...formData, extension: e.target.value})} />
                    
                    <input type="text" placeholder="Position (e.g. Head IT Officer)" required style={styles.input}
                        onChange={e => setFormData({...formData, position: e.target.value})} />
                    
                    <button type="submit" style={styles.button}>
                        Register Admin Account
                    </button>
                </form>
                
                <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '14px' }}>
                    <Link to="/" style={{ color: '#2563eb', textDecoration: 'none' }}>Back to Login</Link>
                </p>
            </div>
        </div>
    );
}

// Reusable styles to keep the code clean
const styles = {
    input: {
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        fontSize: '14px'
    },
    button: {
        padding: '12px',
        background: '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 'bold',
        marginTop: '10px'
    }
};