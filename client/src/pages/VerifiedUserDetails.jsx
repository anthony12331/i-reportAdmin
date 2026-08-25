import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Image as ImageIcon, Loader, MapPin, Phone, ShieldAlert, User, X } from "lucide-react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { useMessageBox } from "../components/MessageBox";
import { verifiedUserDetailsStyles as styles } from "../themes/verifiedUserDetailsStyles";

const getFileUrl = (record, field) =>
  record?.[field] ? pb.files.getURL(record, record[field]) : null;

const formatDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

export default function VerifiedUserDetails() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { alert, confirm } = useMessageBox();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reason, setReason] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [incidentReports, setIncidentReports] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const record = await pb.collection("users").getOne(userId, { requestKey: null });
        setUser(record);
      } catch (error) {
        console.error("Failed to load resident details:", error);
        await alert("Unable to load resident details.", { title: "Loading Error" });
        navigate("/verified-users");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [alert, navigate, userId]);

  useEffect(() => {
    const fetchIncidentReports = async () => {
      if (!user) return;
      setIncidentsLoading(true);
      try {
        const records = await pb.collection("incident_reports").getFullList({
          filter: `user = "${user.id}"`,
          sort: "-created",
          requestKey: null,
        });
        setIncidentReports(records);
      } catch (error) {
        console.error("Failed to load incident reports:", error);
        setIncidentReports([]);
      } finally {
        setIncidentsLoading(false);
      }
    };

    fetchIncidentReports();
  }, [user]);

  const handleStatusChange = async () => {
    if (!user) return;
    const isSuspending = user.status !== "suspended";
    if (isSuspending && !reason.trim()) {
      await alert("Please enter a reason before suspending this verification.", { title: "Reason Required" });
      return;
    }

    const confirmed = await confirm(
      isSuspending
        ? `Suspend verification for ${user.first_name} ${user.last_name}?`
        : `Restore verification for ${user.first_name} ${user.last_name}?`,
      {
        title: isSuspending ? "Suspend Verification" : "Restore Verification",
        primaryLabel: isSuspending ? "Suspend" : "Restore",
        secondaryLabel: "Cancel",
      },
    );
    if (!confirmed) return;

    setProcessing(true);
    try {
      const updatedUser = await pb.collection("users").update(user.id, {
        status: isSuspending ? "suspended" : "verified",
        suspension_reason: isSuspending ? reason.trim() : "",
      });
      setUser(updatedUser);
      setReason("");
      await alert(isSuspending ? "Verification suspended." : "Verification restored.", { title: "Status Updated" });
    } catch (error) {
      await alert(error.message || "Failed to update verification status.", { title: "Update Error" });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.shell}>
        <Sidebar />
        <main style={styles.main}>
          <div style={styles.loadingState}>
            <Loader className="animate-spin" size={42} color="#1d7a4d" />
            <span>Loading resident details...</span>
          </div>
        </main>
      </div>
    );
  }

  if (!user) return null;

  const fullName = `${user.first_name || ""} ${user.middle_name || ""} ${user.last_name || ""}`.trim();
  const selfieUrl = getFileUrl(user, "selfie");
  const idPhotoUrl = getFileUrl(user, "id_photo");
  const isSuspended = user.status === "suspended";

  return (
    <div style={styles.shell}>
      <Sidebar />
      <main style={styles.main}>
        <button type="button" className="verifiedUsersButton" style={styles.backButton} onClick={() => navigate("/verified-users")}>
          <ArrowLeft size={16} /> Back to Verified Users
        </button>

        <header style={styles.header}>
          <div>
            <span style={styles.eyebrow}>Resident Details</span>
            <h1 style={styles.title}>Resident Verification Review</h1>
            <p style={styles.subtitle}>Submitted on {formatDate(user.date_time || user.created)} • Citizen ID #{user.user_id || "N/A"}</p>
          </div>
          <span style={styles.statusBadge(isSuspended)}>{isSuspended ? "Suspended" : "Verified"}</span>
        </header>

        <section style={styles.contentGrid}>
          <div style={styles.sidebarColumn}>
            <aside style={styles.profilePanel}>
              {selfieUrl ? <button type="button" className="verifiedUsersButton" style={styles.imageButton} onClick={() => setPreviewImage({ src: selfieUrl, label: "Resident profile" })}><img src={selfieUrl} alt="Resident profile" style={styles.profileImage} /></button> : <div style={styles.profileFallback}><User size={64} /></div>}
              <span style={styles.profileNameLabel}>Full Name:</span>
              <h2 style={styles.profileName}>{fullName || "Registered User"}</h2>
              <div style={styles.profileMeta}><Phone size={14} /><span style={styles.profileMetaLabel}>Phone:</span> {user.contact_number || "No contact number"}</div>
              <div style={styles.profileMeta}><MapPin size={14} /><span style={styles.profileMetaLabel}>Address:</span> {[user.street_address, user.baranggay, user.municipality, user.province].filter(Boolean).join(", ") || "No address"}</div>
              <div style={styles.profileMeta}><CheckCircle2 size={14} /><span style={styles.profileMetaLabel}>Citizen ID:</span> #{user.user_id || "N/A"}</div>
            </aside>

            <section style={{...styles.panel, ...styles.incidentHistoryPanel}}>
              <div style={styles.panelHeader}>
                <div><h2 style={styles.panelTitle}>Incident History</h2><p style={styles.panelSubtitle}>Report history and status tracking for this resident.</p></div>
              </div>
              {incidentsLoading ? (
                <div style={{ flex: 1, textAlign: "center", padding: "24px", color: "#7a9a83", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <Loader className="animate-spin" size={24} style={{ margin: "0 auto 8px" }} />
                  <p>Loading incident reports...</p>
                </div>
              ) : incidentReports.length === 0 ? (
                <div style={{ flex: 1, textAlign: "center", padding: "24px", color: "#7a9a83", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <p>No incident reports found for this resident.</p>
                </div>
              ) : (
                <div style={styles.incidentTableContainer}>
                  <table style={styles.incidentTable}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                      <tr style={styles.incidentTableRow}>
                        <th style={styles.incidentTableHeader}>Incident Type</th>
                        <th style={styles.incidentTableHeader}>Date</th>
                        <th style={styles.incidentTableHeader}>Status</th>
                        <th style={styles.incidentTableHeader}>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidentReports.map((report) => (
                        <tr key={report.id} style={styles.incidentTableRow}>
                          <td style={styles.incidentTableCell}>{report.type || "N/A"}</td>
                          <td style={styles.incidentTableCell}>{formatDate(report.created)}</td>
                          <td style={styles.incidentTableCell}><span style={styles.incidentStatusBadge(report.status)}>{report.status || "N/A"}</span></td>
                          <td style={styles.incidentTableCell}>{report.location || (report.latitude && report.longitude ? `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}` : "N/A")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div style={styles.detailsColumn}>
            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <div><h2 style={styles.panelTitle}><ShieldAlert size={16} /> Information Comparison</h2><p style={styles.panelSubtitle}>Compare the resident's submitted details with the uploaded proof of identity.</p></div>
              </div>
              <div style={styles.comparisonGrid}>
                <div style={styles.infoBlock}>
                  <span style={styles.blockLabel}>ENTERED PERSONAL INFO</span>
                  <Detail label="First Name" value={user.first_name} />
                  <Detail label="Middle Name" value={user.middle_name} />
                  <Detail label="Last Name" value={user.last_name} />
                  {user.extension && <Detail label="Extension" value={user.extension} />}
                  <Detail label="Date of Birth" value={formatDate(user.birthdate)} />
                  <Detail label="Street" value={user.street_address} />
                  <Detail label="Barangay" value={user.baranggay} />
                  <Detail label="Municipality" value={user.municipality} />
                  <Detail label="Email" value={user.email || "No email"} />
                  <Detail label="Province" value={user.province || "Not available"} />
                </div>
                <div style={styles.idBlock}>
                  <div style={styles.mediaHeader}><span style={styles.blockLabel}>UPLOADED PROOF OF ID</span>{idPhotoUrl && <button type="button" className="verifiedUsersButton" style={styles.mediaAction} onClick={() => window.open(idPhotoUrl, "_blank", "noopener,noreferrer")}><ImageIcon size={13} /> Full image</button>}</div>
                  {idPhotoUrl ? <button type="button" className="verifiedUsersButton" style={styles.imageButton} onClick={() => setPreviewImage({ src: idPhotoUrl, label: "Uploaded identification" })}><img src={idPhotoUrl} alt="Uploaded identification" style={styles.idImage} /></button> : <div style={styles.noImage}>No identification photo uploaded.</div>}
                </div>
              </div>
            </section>

            <section style={styles.panel}>
              <h2 style={styles.panelTitle}>Reviewer Decision</h2>
              <p style={styles.panelSubtitle}>Select an action below to update this resident verification record.</p>
              <button type="button" className="verifiedUsersButton" style={styles.statusAction(isSuspended)} onClick={handleStatusChange} disabled={processing}>
                {processing ? <Loader className="animate-spin" size={17} /> : <ShieldAlert size={17} />}
                {processing ? "Updating..." : isSuspended ? "Restore Verification" : "Suspend Verification"}
              </button>
              {!isSuspended && <><label style={styles.reasonLabel} htmlFor="suspension-reason">Review Notes</label><textarea id="suspension-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the reason for suspension or what clarification is needed..." style={styles.reasonInput} /></>}
            </section>
          </div>
        </section>
      </main>
      {previewImage && (
        <div style={styles.previewOverlay} onClick={() => setPreviewImage(null)}>
          <div style={styles.previewPanel} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="animatedCloseButton" style={styles.previewClose} onClick={() => setPreviewImage(null)} aria-label="Close image preview"><X size={20} /></button>
            <img src={previewImage.src} alt={previewImage.label} style={styles.previewImage} />
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return <div style={styles.detail}><span style={styles.detailLabel}>{label}</span><strong style={styles.detailValue}>{value || "Not available"}</strong></div>;
}
