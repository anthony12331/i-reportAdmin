export const requestBackupStyles = {
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
    marginLeft: "260px", // Offset for Sidebar
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
  contentWrapper: {
    display: "flex",
    gap: "24px",
    alignItems: "flex-start",
  },
  leftColumn: {
    flex: "1 1 50%",
    minWidth: "350px",
  },
  rightColumn: {
    flex: "1 1 50%",
    position: "sticky",
    top: "32px",
    height: "calc(100vh - 120px)",
    minWidth: "350px",
  },
  cardGrid: {
    display: "flex",
    flexDirection: "column",
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
  departmentTag: (dept) => {
    let bg = "#3b82f620";
    let color = "#3b82f6";
    const d = dept?.toLowerCase() || "";
    if (d.includes("fire")) {
      bg = "#ef444420";
      color = "#ef4444";
    } else if (d.includes("mdrrmo")) {
      bg = "#f9731620";
      color = "#f97316";
    }
    
    return {
      padding: "4px 10px",
      borderRadius: "12px",
      backgroundColor: bg,
      color: color,
      fontSize: "12px",
      fontWeight: "600",
      textTransform: "uppercase",
    };
  },
  metaText: {
    fontSize: "13px",
    color: "#94a3b8",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "8px",
  },
  reasonBox: {
    backgroundColor: "#1e293b50",
    padding: "12px",
    borderRadius: "8px",
    fontSize: "14px",
    color: "#e2e8f0",
    marginBottom: "20px",
    lineHeight: "1.5",
  },
  selectBox: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#f8fafc",
    fontSize: "14px",
    outline: "none",
    marginBottom: "16px",
  },
  dispatchBtn: (disabled) => ({
    width: "100%",
    padding: "14px",
    backgroundColor: disabled ? "#1e293b" : "#3b82f6",
    color: disabled ? "#94a3b8" : "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontWeight: "600",
    fontSize: "15px",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "background-color 0.2s",
  }),
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
  }
};
