export const requestBackupStyles = {
  container: {
    display: "flex",
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
    fontFamily: "Inter, Arial, sans-serif",
  },
  main: {
    flex: 1,
    padding: "24px 24px 40px",
    marginLeft: "216px",
  },
  header: {
    marginBottom: "20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "14px",
  },
  title: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#0f172a",
    margin: "0 0 4px 0",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: "13px",
    color: "#64748b",
    margin: 0,
    fontWeight: "400",
  },
  contentWrapper: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
  },
  leftColumn: {
    flex: "1 1 50%",
    minWidth: "320px",
  },
  rightColumn: {
    flex: "1 1 50%",
    position: "sticky",
    top: "24px",
    height: "calc(100vh - 120px)",
    minWidth: "320px",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
    gap: "16px",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "12px",
  },
  requesterName: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#0f172a",
    margin: "0 0 2px 0",
  },
  departmentTag: (dept) => {
    let bg = "#f0f9ff";
    let color = "#0369a1";
    let border = "#e0f2fe";
    const d = dept?.toLowerCase() || "";
    if (d.includes("fire")) {
      bg = "#fef2f2";
      color = "#b91c1c";
      border = "#fee2e2";
    } else if (d.includes("mdrrmo")) {
      bg = "#fff7ed";
      color = "#c2410c";
      border = "#ffedd5";
    } else if (d.includes("police")) {
      bg = "#f0f9ff";
      color = "#0369a1";
      border = "#e0f2fe";
    }

    return {
      padding: "3px 8px",
      borderRadius: "4px",
      backgroundColor: bg,
      color: color,
      fontSize: "10px",
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      border: `1px solid ${border}`,
    };
  },
  metaText: {
    fontSize: "12px",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "6px",
    lineHeight: 1.4,
  },
  reasonBox: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: "10px 12px",
    borderRadius: "6px",
    fontSize: "13px",
    color: "#334155",
    marginBottom: "14px",
    lineHeight: "1.5",
  },
  selectBox: {
    width: "100%",
    padding: "8px 12px",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    color: "#0f172a",
    fontSize: "13px",
    outline: "none",
    marginBottom: "12px",
  },
  dispatchBtn: (disabled) => ({
    width: "100%",
    padding: "10px 14px",
    background: disabled ? "#f1f5f9" : "#15803d",
    color: disabled ? "#94a3b8" : "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontWeight: "600",
    fontSize: "13px",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    transition: "background-color 0.15s ease",
  }),
  emptyState: {
    gridColumn: "1 / -1",
    textAlign: "center",
    padding: "60px 20px",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    border: "1px dashed #cbd5e1",
  },
  emptyIcon: {
    color: "#15803d",
    marginBottom: "12px",
  },
  emptyText: {
    color: "#64748b",
    fontSize: "14px",
    margin: 0,
    fontWeight: "500",
  },
  miniMapContainer: {
    position: "relative",
    width: "100%",
    height: "110px",
    borderRadius: "6px",
    overflow: "hidden",
    marginTop: "8px",
    marginBottom: "12px",
    cursor: "pointer",
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
  },
  mapHoverTag: {
    position: "absolute",
    bottom: "6px",
    right: "6px",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    color: "#15803d",
    padding: "3px 6px",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: "600",
    pointerEvents: "none",
    border: "1px solid #e2e8f0",
  },
  modalBackdrop: {
    position: "fixed",
    top: 0, left: 0, width: "100vw", height: "100vh",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  modalWindow: {
    width: "750px",
    maxWidth: "95vw",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
    border: "1px solid #e2e8f0",
  },
  modalHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 18px",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
  },
  closeBtn: {
    background: "none",
    border: "1px solid #e2e8f0",
    color: "#475569",
    cursor: "pointer",
    padding: "6px",
    display: "flex",
    borderRadius: "6px",
  },
};
