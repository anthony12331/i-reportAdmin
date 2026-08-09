import { useState, useEffect } from "react";
import { pb } from "../config/pocketbase";
import { manageAdminsStyle as styles } from "../themes/manageAdminsStyle";
import Sidebar from "../components/Sidebar";

export default function ManageAdmins() {
  const [admins, setAdmins] = useState([]);
  const [superAdmins, setSuperAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // New Admin Form State
  const [newEmail, setNewEmail] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [adminsRes, superAdminsRes] = await Promise.all([
        pb.collection("admins").getFullList({ requestKey: null }),
        pb.collection("super_admins").getFullList({ requestKey: null }),
      ]);
      setAdmins(adminsRes);
      setSuperAdmins(superAdminsRes);
    } catch (err) {
      console.error("Failed to fetch admins:", err);
      alert("Error fetching admin lists.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!newEmail || !newFirstName || !newLastName) {
      return alert("Email, First Name, and Last Name are required.");
    }

    setIsCreating(true);
    try {
      await pb.collection("admins").create({
        email: newEmail.trim(),
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        password: "12345678",
        passwordConfirm: "12345678",
        emailVisibility: true,
        suspended: false,
      });
      alert("Admin created successfully with password: 12345678");
      setNewEmail("");
      setNewFirstName("");
      setNewLastName("");
      fetchUsers();
    } catch (err) {
      console.error("Failed to create admin:", err);
      alert(err.message || "Failed to create admin.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleSuspend = async (admin, collectionName) => {
    const isSuspending = !admin.suspended;
    const action = isSuspending ? "suspend" : "unsuspend";
    
    const adminName = (`${admin.first_name || ''} ${admin.last_name || ''}`.trim()) || admin.email || "this admin";
    if (!window.confirm(`Are you sure you want to ${action} ${adminName}?`)) return;

    try {
      await pb.collection(collectionName).update(admin.id, {
        suspended: isSuspending
      });
      fetchUsers();
    } catch (err) {
      console.error(`Failed to ${action} admin:`, err);
      alert(`Error: ${err.message}`);
    }
  };

  const handlePromote = async (admin) => {
    const adminName = (`${admin.first_name || ''} ${admin.last_name || ''}`.trim()) || admin.email || "this admin";
    if (!window.confirm(`Are you sure you want to promote ${adminName} to Super Admin?`)) return;

    try {
      // 1. Create in super_admins
      await pb.collection("super_admins").create({
        email: admin.email,
        first_name: admin.first_name,
        last_name: admin.last_name,
        middle_name: admin.middle_name,
        password: "12345678", // Must reset password because we can't extract the hash
        passwordConfirm: "12345678",
        emailVisibility: true,
        suspended: admin.suspended || false,
      });
      
      // 2. Delete from admins
      await pb.collection("admins").delete(admin.id);
      
      const adminName = (`${admin.first_name || ''} ${admin.last_name || ''}`.trim()) || admin.email || "The user";
      alert(`${adminName} has been promoted. Their password has been reset to 12345678.`);
      fetchUsers();
    } catch (err) {
      console.error("Failed to promote admin:", err);
      alert(`Error promoting admin: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <>
        <Sidebar />
        <div style={styles.container}>
          <h2 style={{ color: "#f8fafc" }}>Loading Admin Management...</h2>
        </div>
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title}>Admin Management Console</h2>
        </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#f8fafc" }}>Create New Admin</h3>
        <form onSubmit={handleCreateAdmin} style={{ display: "flex", gap: "15px", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>First Name</label>
            <input
              type="text"
              style={styles.input}
              placeholder="e.g. John"
              value={newFirstName}
              onChange={(e) => setNewFirstName(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Last Name</label>
            <input
              type="text"
              style={styles.input}
              placeholder="e.g. Doe"
              value={newLastName}
              onChange={(e) => setNewLastName(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Email Address</label>
            <input 
              type="email" 
              value={newEmail} 
              onChange={(e) => setNewEmail(e.target.value)} 
              style={styles.input} 
              placeholder="e.g. admin@lgu.gov.ph"
            />
          </div>
          <button type="submit" style={styles.buttonPrimary} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Admin (Pwd: 12345678)"}
          </button>
        </form>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#f8fafc" }}>Super Admins</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {superAdmins.map(admin => (
              <tr key={admin.id}>
                <td style={styles.td}>{(`${admin.first_name || ''} ${admin.last_name || ''}`.trim()) || <span style={{color:"#64748b", fontStyle:"italic"}}>Legacy/None</span>}</td>
                <td style={styles.td}>{admin.email || <span style={{color:"#64748b", fontStyle:"italic"}}>Hidden (Legacy)</span>}</td>
                <td style={styles.td}><span style={styles.badgeSuper}>Super Admin</span></td>
                <td style={styles.td}>
                  {admin.suspended ? (
                    <span style={styles.badgeSuspended}>Suspended</span>
                  ) : (
                    <span style={{ color: "#34d399", fontSize: "12px", fontWeight: "600" }}>Active</span>
                  )}
                </td>
                <td style={styles.td}>
                  {pb.authStore.model.id !== admin.id && (
                    <button 
                      style={admin.suspended ? styles.buttonUnsuspend : styles.buttonSuspend}
                      onClick={() => handleToggleSuspend(admin, "super_admins")}
                    >
                      {admin.suspended ? "Unsuspend" : "Suspend"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {superAdmins.length === 0 && (
              <tr><td colSpan="5" style={styles.td}>No super admins found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0, color: "#f8fafc" }}>Standard Admins</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map(admin => (
              <tr key={admin.id}>
                <td style={styles.td}>{(`${admin.first_name || ''} ${admin.last_name || ''}`.trim()) || <span style={{color:"#64748b", fontStyle:"italic"}}>Legacy/None</span>}</td>
                <td style={styles.td}>{admin.email || <span style={{color:"#64748b", fontStyle:"italic"}}>Hidden (Legacy)</span>}</td>
                <td style={styles.td}><span style={styles.badgeAdmin}>Admin</span></td>
                <td style={styles.td}>
                  {admin.suspended ? (
                    <span style={styles.badgeSuspended}>Suspended</span>
                  ) : (
                    <span style={{ color: "#34d399", fontSize: "12px", fontWeight: "600" }}>Active</span>
                  )}
                </td>
                <td style={styles.td}>
                  <button 
                    style={styles.buttonPromote}
                    onClick={() => handlePromote(admin)}
                  >
                    Promote to Super
                  </button>
                  <button 
                    style={admin.suspended ? styles.buttonUnsuspend : styles.buttonSuspend}
                    onClick={() => handleToggleSuspend(admin, "admins")}
                  >
                    {admin.suspended ? "Unsuspend" : "Suspend"}
                  </button>
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr><td colSpan="5" style={styles.td}>No standard admins found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}
