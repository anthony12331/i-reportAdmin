import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, FileText, Image as ImageIcon, Loader, MapPin, Phone, PlayCircle, User, X } from "lucide-react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { getReadableAddress } from "../utils/utils";
import { resolvedIncidentDetailsStyles as styles } from "../themes/resolvedIncidentDetailsStyles";

const formatDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
};

const fileUrl = (record, field) => record?.[field] ? pb.files.getURL(record, record[field]) : null;
const displayName = (user) => `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Unknown resident";

export default function ResolvedIncidentDetails({ recordType = "incident" }) {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const [incident, setIncident] = useState(null);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const collectionName = recordType === "sos" ? "sos_tracking" : "incident_reports";
        const expand = recordType === "sos" ? "user,assigned_responder" : "users";
        const record = await pb.collection(collectionName).getOne(incidentId, { expand, requestKey: null });
        const dispatches = await pb.collection("dispatches").getFullList({
          filter: `${recordType === "sos" ? "sos_id" : "incident_id"} = "${record.id}"`,
          expand: "responder_id",
          sort: "created",
          requestKey: null,
        });
        if (!active) return;
        setIncident({ ...record, dispatches, recordType });
        if (record.latitude != null && record.longitude != null) {
          setAddress(await getReadableAddress(record.latitude, record.longitude));
        }
      } catch (error) {
        if (!error.isAbort) console.error("Failed to load resolved incident:", error);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [incidentId, recordType]);

  if (loading) return <div style={styles.shell}><Sidebar /><main style={styles.main}><div style={styles.loading}><Loader className="animate-spin" size={22} /> Loading incident details...</div></main></div>;
  if (!incident) return <div style={styles.shell}><Sidebar /><main style={styles.main}><button type="button" className="verifiedUsersButton" style={styles.backButton} onClick={() => navigate("/resolved-incidents")}><ArrowLeft size={16} /> Back to Resolved History</button><p>Incident details could not be loaded.</p></main></div>;

  const reporter = incident.expand?.users || incident.expand?.user;
  const imageUrl = fileUrl(incident, "incident_image");
  const videoUrl = fileUrl(incident, "incident_video");
  const selfieUrl = fileUrl(reporter, "selfie");

  return (
    <div style={styles.shell}>
      <Sidebar />
      <main style={styles.main}>
        <button type="button" className="verifiedUsersButton" style={styles.backButton} onClick={() => navigate("/resolved-incidents")}><ArrowLeft size={16} /> Back to Resolved History</button>
        <header style={styles.header}>
          <div><span style={styles.eyebrow}>Resolved {incident.recordType === "sos" ? "SOS" : "Incident"} Record</span><h1 style={styles.title}>Case #{incident.id}</h1><p style={styles.subtitle}>{incident.recordType === "sos" ? "SOS distress signal" : incident.type || "Incident"} reported {formatDate(incident.created)}</p></div>
          <span style={styles.status}><CheckCircle2 size={13} /> {incident.status || "resolved"}</span>
        </header>

        <div style={styles.grid}>
          <div style={styles.column}>
            <section style={styles.panel}>
              <div style={styles.panelHeader}><h2 style={styles.panelTitle}><FileText size={16} /> Incident Overview</h2></div>
              <div style={styles.metadata}>
                <div><span style={styles.label}>Record Type</span><strong style={styles.value}>{incident.recordType === "sos" ? "SOS Distress Signal" : incident.type || "Not available"}</strong></div>
                <div><span style={styles.label}>Status</span><strong style={styles.value}>{incident.status || "Not available"}</strong></div>
                <div><span style={styles.label}>Date Reported</span><strong style={styles.value}>{formatDate(incident.created)}</strong></div>
                <div><span style={styles.label}>Last Updated</span><strong style={styles.value}>{formatDate(incident.updated)}</strong></div>
                <div style={{ gridColumn: "1 / -1" }}><span style={styles.label}>Location</span><strong style={styles.value}>{address || (incident.latitude != null ? `${incident.latitude}, ${incident.longitude}` : "Not available")}</strong></div>
              </div>
              <div><span style={{ ...styles.label, marginTop: "17px" }}>Incident Resolution</span><p style={styles.description}>{incident.description || "No description provided."}</p></div>
            </section>

            <section style={styles.panel}>
              <div style={styles.panelHeader}><h2 style={styles.panelTitle}><CheckCircle2 size={16} /> Dispatch Activity</h2><span style={styles.muted}>{incident.dispatches?.length || 0} record(s)</span></div>
              {incident.dispatches?.length ? <div style={{ display: "grid", gap: "9px" }}>{incident.dispatches.map((dispatch) => { const responder = dispatch.expand?.responder_id; return <div key={dispatch.id} style={styles.dispatch}><div><strong style={styles.dispatchName}>{responder ? displayName(responder) : `${dispatch.department || "Response"} Unit`}</strong><span style={styles.dispatchMeta}>{responder?.unit_name || dispatch.department || "Department not recorded"} {dispatch.accepted_at ? `• Accepted ${formatDate(dispatch.accepted_at)}` : ""} {dispatch.response_time ? `• Response ${dispatch.response_time}` : ""}</span></div><span style={styles.dispatchStatus}>{dispatch.status || "Not available"}</span></div>; })}</div> : <p style={styles.muted}>No dispatch record attached to this incident.</p>}
            </section>

            {(incident.latitude != null && incident.longitude != null) && <section style={styles.panel}><div style={styles.panelHeader}><h2 style={styles.panelTitle}><MapPin size={16} /> Report Location</h2><a style={styles.mapLink} href={`https://www.google.com/maps?q=${incident.latitude},${incident.longitude}`} target="_blank" rel="noreferrer">Open in Maps</a></div><iframe title="Incident location" src={`https://maps.google.com/maps?q=${incident.latitude},${incident.longitude}&z=15&output=embed`} style={styles.map} /></section>}
          </div>

          <div style={styles.column}>
            <section style={styles.panel}><div style={styles.panelHeader}><h2 style={styles.panelTitle}><User size={16} /> Reporter Information</h2></div><div style={styles.reporter}><div style={styles.avatar}>{selfieUrl ? <img src={selfieUrl} alt="Reporter" style={styles.avatarImage} /> : (displayName(reporter).slice(0, 2).toUpperCase())}</div><div><strong style={styles.reporterName}>{displayName(reporter)}</strong><span style={styles.muted}>Verified Resident</span><span style={styles.muted}>Citizen ID: {reporter?.user_id || "Not available"}</span></div></div><div style={styles.contactList}><div><span style={styles.label}><Phone size={12} /> Contact Number</span><strong style={styles.value}>{reporter?.contact_number || "Not available"}</strong></div><div><span style={styles.label}>Address</span><strong style={styles.value}>{[reporter?.street_address, reporter?.baranggay, reporter?.municipality, reporter?.province].filter(Boolean).join(", ") || "Not available"}</strong></div></div></section>
            <section style={styles.panel}><div style={styles.panelHeader}><h2 style={styles.panelTitle}><ImageIcon size={16} /> Evidence &amp; Media</h2></div><div style={styles.mediaGrid}><div><span style={styles.mediaLabel}>Incident Image</span>{imageUrl ? <button type="button" style={styles.mediaButton} onClick={() => setPreview({ url: imageUrl, video: false })}><img src={imageUrl} alt="Incident evidence" style={styles.media} /></button> : <div style={styles.empty}>No image uploaded</div>}</div><div><span style={styles.mediaLabel}>Incident Video</span>{videoUrl ? <button type="button" style={styles.mediaButton} onClick={() => setPreview({ url: videoUrl, video: true })}><video src={videoUrl} muted style={styles.media} /><PlayCircle size={20} color="#ffffff" style={{ position: "relative", top: "-100px", left: "calc(50% - 10px)" }} /></button> : <div style={styles.empty}>No video uploaded</div>}</div></div></section>
            <section style={styles.panel}><div style={styles.panelHeader}><h2 style={styles.panelTitle}><CalendarDays size={16} /> Record Timestamps</h2></div><div style={styles.metadata}><div><span style={styles.label}><Clock3 size={12} /> Created</span><strong style={styles.value}>{formatDate(incident.created)}</strong></div><div><span style={styles.label}>Updated</span><strong style={styles.value}>{formatDate(incident.updated)}</strong></div></div></section>
          </div>
        </div>
      </main>
      {preview && <div style={styles.overlay} onClick={() => setPreview(null)}><div style={styles.preview} onClick={(event) => event.stopPropagation()}>{preview.video ? <video src={preview.url} controls autoPlay style={styles.previewMedia} /> : <img src={preview.url} alt="Incident evidence enlarged" style={styles.previewMedia} />}<button type="button" style={styles.close} onClick={() => setPreview(null)} aria-label="Close preview"><X size={18} /></button></div></div>}
    </div>
  );
}
