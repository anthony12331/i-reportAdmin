export const ongoingBackupStyles = {
  container: {
    display: "flex",
    minHeight: "100vh",
    background: "radial-gradient(circle at 50% -20%, #ffffff 0%, #f6faf7 80%)",
    color: "#111827",
    fontFamily: "Inter, Arial, sans-serif",
  },
  main: {
    flex: 1,
    padding: "28px 24px 40px",
    marginLeft: "216px",
  },
  header: {
    marginBottom: "24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: "1px solid #dfeae3",
    paddingBottom: "14px",
  },
  title: {
    fontSize: "clamp(24px, 3vw, 32px)",
    fontWeight: "800",
    color: "#111111",
    margin: "0 0 8px 0",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    letterSpacing: "-0.03em",
  },
  subtitle: {
    fontSize: "15px",
    color: "#477257",
    margin: 0,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
    gap: "24px",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    border: "1px solid #dfeae3",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "16px",
  },
  requesterName: {
    fontSize: "18px",
    fontWeight: "800",
    color: "#111827",
    margin: "0 0 4px 0",
  },
  metaText: {
    fontSize: "13px",
    color: "#5f7b69",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "8px",
    lineHeight: 1.5,
  },
  statusBadge: (status) => {
    let bg = "#e5e7eb";
    let color = "#374151";

    switch (status) {
      case "assigned":
        bg = "#dbeafe"; color = "#1d4ed8";
        break;
      case "accepted":
        bg = "#ede9fe"; color = "#6d28d9";
        break;
      case "en_route":
        bg = "#fef3c7"; color = "#b45309";
        break;
      case "at_scene":
        bg = "#dcfce7"; color = "#15803d";
        break;
      case "completed":
        bg = "#dcfce7"; color = "#15803d";
        break;
      default:
        break;
    }

    return {
      padding: "5px 10px",
      borderRadius: "999px",
      backgroundColor: bg,
      color: color,
      fontSize: "11px",
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      border: "1px solid rgba(15, 23, 42, 0.04)",
    };
  },
  responderBox: {
    backgroundColor: "#f6faf7",
    border: "1px solid #dfeae3",
    padding: "16px",
    borderRadius: "10px",
    marginTop: "16px",
    borderLeft: "3px solid #177a4a",
  },
  resolveBtn: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #1a874f 0%, #0f6c3d 100%)",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    fontWeight: "800",
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "all 0.2s ease",
    marginTop: "20px",
    letterSpacing: "0.04em",
    boxShadow: "0 8px 18px rgba(24, 95, 53, 0.16)",
  },
  emptyState: {
    gridColumn: "1 / -1",
    textAlign: "center",
    padding: "64px 20px",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    border: "1px solid #dfeae3",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
  },
  emptyIcon: {
    color: "#1d7a4d",
    marginBottom: "16px",
  },
  emptyText: {
    color: "#5f7b69",
    fontSize: "16px",
    margin: 0,
    fontWeight: "600",
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
    border: "1px solid #dfeae3",
    transition: "border-color 0.2s",
    backgroundColor: "#f6faf7",
  },
  mapHoverTag: {
    position: "absolute",
    bottom: "8px",
    right: "8px",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    color: "#177a4a",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "10px",
    fontWeight: "800",
    pointerEvents: "none",
    border: "1px solid #dfeae3",
  },
  modalBackdrop: {
    position: "fixed",
    top: 0, left: 0, width: "100vw", height: "100vh",
    backgroundColor: "rgba(15, 23, 42, 0.42)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  modalWindow: {
    width: "800px",
    maxWidth: "95vw",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.14)",
    border: "1px solid #dfeae3",
  },
  modalHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    backgroundColor: "#f6faf7",
    borderBottom: "1px solid #e2ebdf",
  },
  closeBtn: {
    background: "none",
    border: "1px solid #dfeae3",
    color: "#1f3a2f",
    cursor: "pointer",
    padding: "8px",
    display: "flex",
    borderRadius: "8px",
  },
};
