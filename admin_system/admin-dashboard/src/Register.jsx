import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { pb } from './pocketbase';

export default function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '', password: '', passwordConfirm: '',
        first_name: '', middle_name: '', last_name: '',
        extension: '', position: ''
    });

    const handleRegister = async (e) => {
        e.preventDefault();

        // --- 1. CLIENT-SIDE VALIDATION (The Gatekeeper) ---

        // Check for empty required fields
        if (!formData.email.trim() || !formData.password || !formData.first_name.trim() || !formData.last_name.trim() || !formData.position.trim()) {
            alert("⚠️ Security Alert: All required fields must be filled.");
            return; // Stop execution
        }

        // Check if email is valid
        if (!formData.email.includes('@') || !formData.email.includes('.')) {
            alert("⚠️ Security Alert: Invalid email format.");
            return;
        }

        // Check Password Match
        if (formData.password !== formData.passwordConfirm) {
            alert("⚠️ Security Alert: Passwords do not match.");
            return;
        }

        // Check Password Length (Optional but recommended)
        if (formData.password.length < 8) {
            alert("⚠️ Security Alert: Password must be at least 8 characters.");
            return;
        }

        // --- 2. SEND TO SERVER ---
        try {
            await pb.collection('admins').create(formData);
            alert("✅ Registration Successful! You may now login.");
            navigate('/'); 
        } catch  {
            // --- 3. SECURE ERROR HANDLING ---
            
            // TRICK: Clear the red 400 error from console
            console.clear();
            console.warn("Registration blocked by server.");

            // Generic error message for security
            alert("⛔ Registration Failed: Email may already be in use or system is restricted.");
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.brandBox}>
                    <h2 style={{ margin: 0, color: '#1a1c23', fontSize: '22px' }}>Create Admin Profile</h2>
                    <p style={{ margin: '5px 0 0', color: '#666', fontSize: '14px' }}>Register for System Access</p>
                </div>

                <form onSubmit={handleRegister} style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    
                    {/* SECTION 1: CREDENTIALS */}
                    <div>
                        <div style={styles.sectionLabel}>ACCOUNT CREDENTIALS</div>
                        <input type="email" placeholder="Email Address" 
                            style={styles.input}
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})} 
                        />
                    </div>
                    
                    <div style={styles.row}>
                        <input type="password" placeholder="Password" 
                            style={styles.input}
                            value={formData.password}
                            onChange={e => setFormData({...formData, password: e.target.value})} 
                        />
                        <input type="password" placeholder="Confirm" 
                            style={styles.input}
                            value={formData.passwordConfirm}
                            onChange={e => setFormData({...formData, passwordConfirm: e.target.value})} 
                        />
                    </div>

                    {/* SECTION 2: PERSONAL INFO */}
                    <div>
                        <div style={{ ...styles.sectionLabel, marginTop: '10px' }}>OFFICER DETAILS</div>
                        <div style={styles.row}>
                            <input type="text" placeholder="First Name" 
                                style={styles.input}
                                value={formData.first_name}
                                onChange={e => setFormData({...formData, first_name: e.target.value})} 
                            />
                            <input type="text" placeholder="Last Name" 
                                style={styles.input}
                                value={formData.last_name}
                                onChange={e => setFormData({...formData, last_name: e.target.value})} 
                            />
                        </div>
                    </div>

                    <div style={styles.row}>
                        <input type="text" placeholder="Middle Name" 
                            style={styles.input}
                            value={formData.middle_name}
                            onChange={e => setFormData({...formData, middle_name: e.target.value})} 
                        />
                        <input type="text" placeholder="Ext (Jr/Sr)" style={{ ...styles.input, width: '80px' }}
                            value={formData.extension}
                            onChange={e => setFormData({...formData, extension: e.target.value})} 
                        />
                    </div>

                    <input type="text" placeholder="Official Position (e.g. Head IT Officer)" 
                        style={styles.input}
                        value={formData.position}
                        onChange={e => setFormData({...formData, position: e.target.value})} 
                    />

                    <button type="submit" style={styles.button}>
                        REGISTER ACCOUNT
                    </button>
                </form>

                <div style={styles.footer}>
                    <p style={{ fontSize: '13px', color: '#888' }}>
                        Already have access? <Link to="/" style={styles.link}>Back to Login</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

// Consistent Styles
const styles = {
    container: { 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: '#f4f6f8', 
        fontFamily: 'Arial, sans-serif',
        padding: '20px'
    },
    card: { 
        background: 'white', 
        padding: '40px', 
        borderRadius: '10px', 
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)', 
        width: '100%', 
        maxWidth: '480px' 
    },
    brandBox: { textAlign: 'center', marginBottom: '10px' },
    sectionLabel: { fontSize: '11px', color: '#9ca3af', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '5px' },
    row: { display: 'flex', gap: '15px' },
    input: { 
        width: '100%', 
        padding: '12px 15px', 
        border: '1px solid #e5e7eb', 
        borderRadius: '8px', 
        fontSize: '14px', 
        outline: 'none', 
        background: '#fff',
        color: '#1f2937'
    },
    button: { 
        width: '100%', 
        padding: '14px', 
        background: '#1a1c23', 
        color: 'white', 
        border: 'none', 
        borderRadius: '8px', 
        cursor: 'pointer', 
        fontWeight: 'bold', 
        fontSize: '14px', 
        marginTop: '15px'
    },
    footer: { textAlign: 'center', marginTop: '25px', borderTop: '1px solid #f3f4f6', paddingTop: '20px' },
    link: { color: '#d32f2f', textDecoration: 'none', fontWeight: 'bold' }
};