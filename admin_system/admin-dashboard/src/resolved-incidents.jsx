import React, { useState, useEffect } from 'react';
import { pb } from './pocketbase';
import Sidebar from './Sidebar';
import { getReadableAddress } from './utils';
import { 
  CheckCircle, MapPin, Search, Calendar, 
  ShieldCheck, FileText, User, FolderOpen
} from 'lucide-react';

export default function ResolvedIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState({});
  const [searchTerm, setSearchTerm] = useState("");

  // 1. Fetching ONLY "resolved" incidents
  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const records = await pb.collection('incident_reports').getFullList({
        filter: 'status = "resolved"', 
        sort: '-updated', 
        expand: 'users,responders', 
        requestKey: null
      });
      setIncidents(records);
      await resolveAddresses(records);
    } catch (error) {
      if (!error.isAbort) console.error("Fetch error:", error);
    }
    setLoading(false);
  };

  // 2. Address Resolver
  const resolveAddresses = async (records) => {
    const newAddresses = { ...addresses };
    let hasChanged = false;

    for (const record of records) {
      if (record.latitude && record.longitude && !newAddresses[record.id]) {
        newAddresses[record.id] = await getReadableAddress(record.latitude, record.longitude);
        hasChanged = true;
      }
    }
    if (hasChanged) {
      setAddresses(newAddresses);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  // 3. Search Filter Logic
  const filteredIncidents = incidents.filter(incident => {
    const reporterName = `${incident.expand?.users?.first_name || ''} ${incident.expand?.users?.last_name || ''}`.toLowerCase();
    const type = incident.type.toLowerCase();
    const address = (addresses[incident.id] || "").toLowerCase();
    const searchLower = searchTerm.toLowerCase();

    return reporterName.includes(searchLower) || type.includes(searchLower) || address.includes(searchLower);
  });

  // 4. THE MAGIC: Grouping the data by Category
  // This takes the filtered list and organizes it into an object: { "fire": [...], "accident": [...] }
  const groupedIncidents = filteredIncidents.reduce((acc, incident) => {
    // If the category doesn't exist in our object yet, create an empty array for it
    const category = incident.type.toLowerCase();
    if (!acc[category]) {
      acc[category] = [];
    }
    // Push the incident into its specific category bucket
    acc[category].push(incident);
    return acc;
  }, {});

  // Helper function to format dates nicely
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Helper function to assign professional colors to categories
  const getCategoryColor = (category) => {
    const colors = {
      fire: '#ef4444',       // Red
      accident: '#f59e0b',   // Orange
      landslide: '#8b5cf6',  // Purple
      crime: '#1e40af',      // Dark Blue
      medical: '#10b981'     // Green
    };
    return colors[category] || '#64748b'; // Default gray
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '40px', marginLeft: '260px' }}>
        
        {/* Header Section */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a', letterSpacing: '-1px', margin: '0 0 8px 0' }}>INCIDENT HISTORY LOG</h1>
            <p style={{ color: '#10b981', fontSize: '15px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderOpen size={18} /> Categorized Record of Resolved Cases
            </p>
          </div>
          
          {/* Search Bar */}
          <div style={{ position: 'relative', width: '350px' }}>
            <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search by name, type, or location..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '14px 14px 14px 45px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', backgroundColor: 'white' }}
            />
          </div>
        </header>

        {/* Dynamic Categorized Tables */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', backgroundColor: 'white', borderRadius: '24px' }}>Loading history records...</div>
        ) : Object.keys(groupedIncidents).length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', backgroundColor: 'white', borderRadius: '24px' }}>
            <FileText size={48} style={{ marginBottom: '15px', opacity: 0.5 }} />
            <h3>No Records Found</h3>
            <p>Try adjusting your search terms.</p>
          </div>
        ) : (
          /* Map through each category group and create a separate table for it */
          Object.entries(groupedIncidents).map(([category, items]) => (
            <div key={category} style={{ marginBottom: '40px' }}>
              
              {/* Category Section Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <div style={{ width: '15px', height: '15px', borderRadius: '50%', backgroundColor: getCategoryColor(category) }}></div>
                <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>
                  {category} INCIDENTS
                </h2>
                <span style={{ backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>
                  {items.length} Records
                </span>
              </div>

              {/* The Table for this specific category */}
              <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      
                      <th style={{ padding: '20px', fontWeight: '800' }}>Location</th>
                      <th style={{ padding: '20px', fontWeight: '800' }}>Reporter & Responder</th>
                      <th style={{ padding: '20px', fontWeight: '800' }}>Time Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((incident) => {
                      const reporter = incident.expand?.users;
                      const responder = incident.expand?.responders;

                      return (
                        <tr key={incident.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}>
                          
                        

                          {/* Column 2: Location */}
                          <td style={{ padding: '20px', maxWidth: '300px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#334155', fontSize: '14px', fontWeight: '500', lineHeight: '1.4' }}>
                              <MapPin size={16} color="#64748b" style={{ flexShrink: 0, marginTop: '2px' }} />
                              {addresses[incident.id] || "Locating..."}
                            </div>
                          </td>

                          {/* Column 3: People Involved */}
                          <td style={{ padding: '20px' }}>
                            <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                              <User size={14} color="#64748b" /> {reporter?.first_name} {reporter?.last_name || 'Unknown'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#d97706', backgroundColor: '#fef3c7', padding: '4px 8px', borderRadius: '6px', width: 'fit-content' }}>
                              <ShieldCheck size={12} /> Unit: {responder ? responder.department.toUpperCase() : "Local LGU"}
                            </div>
                          </td>

                          {/* Column 4: Timestamps */}
                          <td style={{ padding: '20px' }}>
                            <div style={{ color: '#10b981', fontWeight: '700', fontSize: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <CheckCircle size={14} /> {formatDate(incident.updated)}
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Calendar size={12} /> Reported: {new Date(incident.created).toLocaleDateString()}
                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}

      </main>
    </div>
  );
}