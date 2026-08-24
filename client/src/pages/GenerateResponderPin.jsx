import React, { useState, useEffect } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import { generateResponderPinStyles as styles } from "../themes/generateResponderPinStyles";
import { useMessageBox } from "../components/MessageBox";
import { Copy, KeyRound, RefreshCw, ShieldAlert, Loader } from "lucide-react";

export default function GenerateResponderPin() {
  const [accessRecords, setAccessRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedRecordId, setCopiedRecordId] = useState(null);
  const { alert, confirm } = useMessageBox();

  useEffect(() => {
    let isMounted = true;

    const fetchRecords = async () => {
      try {
        const records = await pb.collection("registration_access").getFullList({
          sort: "department",
          requestKey: null,
        });
        if (isMounted) {
          setAccessRecords(records);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching access records:", error);
        if (isMounted) setLoading(false);
      }
    };

    fetchRecords();

    // Real-time subscription
    let unsubscribe;
    pb.collection("registration_access")
      .subscribe("*", (e) => {
        if (!isMounted) return;
        if (e.action === "create") {
          setAccessRecords((prev) => [...prev, e.record]);
        } else if (e.action === "update") {
          setAccessRecords((prev) =>
            prev.map((record) => (record.id === e.record.id ? e.record : record))
          );
        } else if (e.action === "delete") {
          setAccessRecords((prev) => prev.filter((r) => r.id !== e.record.id));
        }
      })
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch((err) => console.error("Subscription error:", err));

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const generateNewPin = async (record) => {
    const isConfirmed = await confirm(
      `Are you sure you want to generate a new PIN for the ${record.department} department? The old PIN will be invalidated immediately.`,
      {
        title: "Confirm PIN Generation",
        primaryLabel: "Generate New PIN",
      }
    );

    if (!isConfirmed) return;

    // Generate random 5 character alphanumeric PIN
    const newPin = Math.random().toString(36).substring(2, 7).toUpperCase();

    try {
      await pb.collection("registration_access").update(record.id, {
        pin: newPin,
      });
      await alert(`Successfully generated new PIN for ${record.department}.`, {
        title: "Success",
      });
    } catch (error) {
      console.error("Failed to generate PIN:", error);
      await alert("Failed to generate new PIN. Please try again.", {
        title: "Error",
      });
    }
  };

  const toggleStatus = async (record) => {
    const action = record.is_active ? "Deactivate" : "Activate";
    const isConfirmed = await confirm(
      `Are you sure you want to ${action.toLowerCase()} PIN access for ${record.department}?`,
      {
        title: `Confirm ${action}`,
        primaryLabel: action,
      }
    );

    if (!isConfirmed) return;

    try {
      await pb.collection("registration_access").update(record.id, {
        is_active: !record.is_active,
      });
    } catch (error) {
      console.error("Failed to toggle status:", error);
      await alert("Failed to update status. Please try again.", {
        title: "Error",
      });
    }
  };

  const copyPin = async (record) => {
    try {
      await navigator.clipboard.writeText(record.pin);
      setCopiedRecordId(record.id);
      window.setTimeout(() => setCopiedRecordId((current) => current === record.id ? null : current), 1800);
    } catch (error) {
      console.error("Failed to copy PIN:", error);
      await alert("Unable to copy the PIN. Please copy it manually.", { title: "Copy Failed" });
    }
  };

  return (
    <>
      <Sidebar />
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>
            <KeyRound style={{ marginRight: "10px", verticalAlign: "middle" }} size={28} />
            Responder PIN Management
          </h1>
        </div>

        <div style={styles.card}>
          <div style={styles.infoText}>
            <ShieldAlert size={16} style={{ verticalAlign: "middle", marginRight: "6px" }} />
            These PINs are strictly required by Responder accounts during the mobile registration process.
          </div>

          {loading ? (
            <div style={styles.loadingText}>
              <Loader className="animate-spin" size={42} color="#1d7a4d" />
              <span>Loading responder registration PINs...</span>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Department</th>
                    <th style={styles.th}>Current Access PIN</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accessRecords.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ ...styles.td, textAlign: "center" }}>
                        No departments found.
                      </td>
                    </tr>
                  ) : (
                    accessRecords.map((record) => (
                      <tr key={record.id}>
                        <td style={{ ...styles.td, fontWeight: "bold" }}>
                          {record.department.toUpperCase()}
                        </td>
                        <td style={styles.td}>
                          <div style={styles.pinCell}>
                            <span style={styles.pinText}>{record.pin}</span>
                            <button
                              type="button"
                              className="verifiedUsersButton"
                              style={styles.copyButton}
                              onClick={() => copyPin(record)}
                              title={`Copy ${record.department} PIN`}
                            >
                              <Copy size={14} />
                              {copiedRecordId === record.id ? "Copied" : "Copy"}
                            </button>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={record.is_active ? styles.badgeActive : styles.badgeInactive}
                          >
                            {record.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ ...styles.td, ...styles.actionCell }}>
                          <button
                            className="verifiedUsersButton"
                            style={styles.buttonPrimary}
                            onClick={() => generateNewPin(record)}
                            title="Generate a new secure PIN"
                          >
                            <RefreshCw size={14} />
                            Generate New PIN
                          </button>
                          <button
                            className="verifiedUsersButton"
                            style={
                              record.is_active
                                ? { ...styles.buttonPrimary, background: "#ef4444" }
                                : { ...styles.buttonPrimary, background: "#10b981" }
                            }
                            onClick={() => toggleStatus(record)}
                          >
                            {record.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
