export const ongoingBackupStyles = {
  container: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#020617",
    color: "#f8fafc",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  main: {
    flex: 1,
    padding: "32px",
    marginLeft: "260px", 
  },
  header: {
    marginBottom: "32px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: "1px solid #1e293b",
    paddingBottom: "24px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#f8fafc",
    margin: "0 0 8px 0",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  subtitle: {
    fontSize: "15px",
    color: "#94a3b8",
    margin: 0,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
    gap: "24px",
  },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: "16px",
    border: "1px solid #1e293b",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "16px",
  },
  requesterName: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#f8fafc",
    margin: "0 0 4px 0",
  },
  metaText: {
    fontSize: "13px",
    color: "#94a3b8",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "8px",
  },
  statusBadge: (status) => {
    let bg = "#334155";
    let color = "#cbd5e1";
    
    switch (status) {
      case "assigned":
        bg = "#3b82f620"; color = "#3b82f6";
        break;
      case "accepted":
        bg = "#8b5cf620"; color = "#8b5cf6";
        break;
      case "en_route":
        bg = "#f59e0b20"; color = "#f59e0b";
        break;
      case "at_scene":
        bg = "#10b98120"; color = "#10b981";
        break;
      case "completed":
        bg = "#10b98120"; color = "#10b981";
        break;
      default:
        break;
    }
    
    return {
      padding: "4px 10px",
      borderRadius: "12px",
      backgroundColor: bg,
      color: color,
      fontSize: "12px",
      fontWeight: "700",
      textTransform: "uppercase",
    };
  },
  responderBox: {
    backgroundColor: "#1e293b50",
    padding: "16px",
    borderRadius: "8px",
    marginTop: "16px",
    borderLeft: "3px solid #3b82f6"
  },
  resolveBtn: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#10b981",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontWeight: "600",
    fontSize: "15px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "background-color 0.2s",
    marginTop: "20px"
  },
  emptyState: {
    gridColumn: "1 / -1",
    textAlign: "center",
    padding: "64px 20px",
    backgroundColor: "#0f172a",
    borderRadius: "16px",
    border: "1px dashed #334155",
  },
  emptyIcon: {
    color: "#334155",
    marginBottom: "16px",
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: "16px",
    margin: 0,
  },
  miniMapContainer: {
    position: "relative",
    width: "100%",
    height: "120px",
    borderRadius: "12px",
    overflow: "hidden",
    marginTop: "12px",
    marginBottom: "16px",
    cursor: "pointer",
    border: "2px solid #1e293b",
    transition: "border-color 0.2s",
  },
  mapHoverTag: {
    position: "absolute",
    bottom: "8px",
    right: "8px",
    backgroundColor: "#020617ee",
    color: "#38bdf8",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "bold",
    pointerEvents: "none",
  },
  modalBackdrop: {
    position: "fixed",
    top: 0, left: 0, width: "100vw", height: "100vh",
    backgroundColor: "rgba(2, 6, 23, 0.8)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  modalWindow: {
    width: "800px",
    maxWidth: "95vw",
    backgroundColor: "#0f172a",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
  },
  modalHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    backgroundColor: "#1e293b",
    borderBottom: "1px solid #334155",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
  },
};
