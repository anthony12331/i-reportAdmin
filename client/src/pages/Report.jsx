import React, { useState, useRef, useMemo } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import CustomDropdown from "../components/CustomDropdown";
import {
  Download,
  Loader,
  BarChart3,
  MapPin,
  Users,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Activity,
  RotateCcw,
  Clock,
  Shield,
  FileText,
  Flame,
  Ambulance,
  Car,
  AlertOctagon,
  Search,
  PieChart,
  Radio,
  Layers,
  Sparkles,
  Filter,
  Check,
  Building,
  HeartPulse,
  ChevronDown,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getReadableAddress } from "../utils/utils";

// Chart.js imports and configuration
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const INCIDENT_CATEGORIES = [
  { value: "ALL", label: "All Classifications" },
  { value: "fire", label: "Fire Outbreak", icon: Flame, color: "#dc2626" },
  { value: "accident", label: "Vehicular Collision", icon: Car, color: "#ea580c" },
  { value: "medical", label: "Medical Emergency", icon: HeartPulse, color: "#0284c7" },
  { value: "landslide", label: "Landslide / Flood", icon: Layers, color: "#ca8a04" },
  { value: "police", label: "Police & Security", icon: Shield, color: "#7c3aed" },
];

export default function Report() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [reportSource, setReportSource] = useState("incident"); // "incident" | "sos"
  const [selectedIncidentType, setSelectedIncidentType] = useState("ALL");
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState("");
  const [tableSearch, setTableSearch] = useState("");

  // Data States
  const [reports, setReports] = useState([]);
  const [analytics, setAnalytics] = useState({
    types: {},
    statuses: { pending: 0, ongoing: 0, resolved: 0 },
    topAreas: [],
    topResponders: [],
    topReporters: [],
  });

  // Chart Refs for PDF export snapshot
  const typeChartRef = useRef(null);
  const statusChartRef = useRef(null);
  const areaChartRef = useRef(null);

  // Quick Preset Handlers
  const applyDatePreset = (preset) => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    setEndDate(todayStr);

    if (preset === "today") {
      setStartDate(todayStr);
    } else if (preset === "7days") {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setStartDate(past.toISOString().split("T")[0]);
    } else if (preset === "30days") {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setStartDate(past.toISOString().split("T")[0]);
    } else if (preset === "thisMonth") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().split("T")[0]);
    } else if (preset === "ytd") {
      const janFirst = new Date(today.getFullYear(), 0, 1);
      setStartDate(janFirst.toISOString().split("T")[0]);
    }
  };

  const fetchAnalyticsData = async () => {
    if (!startDate || !endDate) {
      alert("Please select both start and end dates.");
      return;
    }

    setIsLoading(true);
    setIsDataLoaded(false);
    setLoadingProgress(10);
    setLoadingStep("Querying municipal telemetry database...");

    try {
      const start = new Date(startDate).toISOString().replace("T", " ");
      const end = new Date(`${endDate}T23:59:59.999Z`)
        .toISOString()
        .replace("T", " ");

      let rawData = [];
      if (reportSource === "incident") {
        let filterQuery = `created >= "${start}" && created <= "${end}"`;
        if (selectedIncidentType !== "ALL") {
          filterQuery += ` && type = "${selectedIncidentType}"`;
        }
        rawData = await pb.collection("incident_reports").getFullList({
          filter: filterQuery,
          sort: "-created",
          expand: "users",
        });
      } else {
        rawData = await pb.collection("sos_tracking").getFullList({
          filter: `created >= "${start}" && created <= "${end}"`,
          sort: "-created",
          expand: "user",
        });
      }

      setLoadingProgress(35);
      setLoadingStep("Aggregating multi-agency dispatch response logs...");

      // Fetch all Dispatches
      const allDispatches = await pb.collection("dispatches").getFullList({
        expand: "responder_id",
        requestKey: null,
      });

      setLoadingProgress(50);
      setLoadingStep("Resolving geographic coordinates & incident locations...");

      // Group dispatches by incident/sos
      const dispatchesByIncident = {};
      allDispatches.forEach((d) => {
        const targetId = reportSource === "incident" ? d.incident_id : d.sos_id;
        if (targetId) {
          if (!dispatchesByIncident[targetId]) dispatchesByIncident[targetId] = [];
          dispatchesByIncident[targetId].push(d);
        }
      });

      // Parse and resolve locations
      const typeCounter = {};
      const statusCounter = { pending: 0, ongoing: 0, resolved: 0 };
      const areaCounter = {};
      const responderCounter = {};
      const reporterCounter = {};

      const totalItems = rawData.length;
      let completedItems = 0;

      const processedData = await Promise.all(
        rawData.map(async (item) => {
          let resolvedLocation = "GPS Telemetry Acquired";
          if (item.latitude && item.longitude) {
            try {
              resolvedLocation = await getReadableAddress(item.latitude, item.longitude);
            } catch {
              resolvedLocation = `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`;
            }
          }

          completedItems++;
          setLoadingProgress(50 + Math.floor((completedItems / (totalItems || 1)) * 45));

          const rawType = reportSource === "incident" ? item.type || "OTHER" : item.assigned_department || "EMERGENCY SOS";
          const type = rawType.toUpperCase();
          typeCounter[type] = (typeCounter[type] || 0) + 1;

          let normalizedStatus = (item.status || "").toLowerCase();
          if (reportSource === "sos") {
            normalizedStatus = (item.dispatch_status || item.status || "pending").toLowerCase();
          }

          if (normalizedStatus === "resolved") {
            statusCounter.resolved++;
          } else if (
            normalizedStatus === "ongoing" ||
            normalizedStatus === "assigned" ||
            normalizedStatus === "accepted" ||
            normalizedStatus === "en_route" ||
            normalizedStatus === "at_scene"
          ) {
            statusCounter.ongoing++;
          } else {
            statusCounter.pending++;
          }

          if (resolvedLocation) {
            const locKey = resolvedLocation.split(",")[0].trim() || "Lagonglong Center";
            areaCounter[locKey] = (areaCounter[locKey] || 0) + 1;
          }

          const reporterUser = item.expand?.users || item.expand?.user;
          if (reporterUser) {
            const repName = `${reporterUser.first_name || ""} ${reporterUser.last_name || ""}`.trim() || reporterUser.contact_number || "Citizen";
            reporterCounter[repName] = (reporterCounter[repName] || 0) + 1;
          }

          const matchedDispatches = dispatchesByIncident[item.id] || [];
          matchedDispatches.forEach((d) => {
            const responder = d.expand?.responder_id;
            const respName = responder
              ? `${responder.first_name || ""} ${responder.last_name || ""} (${(responder.department || "UNIT").toUpperCase()})`.trim()
              : d.department
              ? `${d.department.toUpperCase()} Dept`
              : "Assigned Unit";
            responderCounter[respName] = (responderCounter[respName] || 0) + 1;
          });

          return {
            ...item,
            resolvedLocation,
            reporterUser,
            dispatches: matchedDispatches,
          };
        })
      );

      const topAreas = Object.entries(areaCounter)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      const topResponders = Object.entries(responderCounter)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      const topReporters = Object.entries(reporterCounter)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      setReports(processedData);
      setAnalytics({
        types: typeCounter,
        statuses: statusCounter,
        topAreas,
        topResponders,
        topReporters,
      });

      setLoadingProgress(100);
      setLoadingStep("Ready!");
      setIsDataLoaded(true);
    } catch (err) {
      console.error("Report aggregation error:", err);
      alert("Failed to compile operations analytics. Please check network connection.");
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered reports for the log table
  const filteredReports = useMemo(() => {
    if (!tableSearch.trim()) return reports;
    const q = tableSearch.toLowerCase();
    return reports.filter((r) => {
      const type = (r.type || r.assigned_department || "").toLowerCase();
      const loc = (r.resolvedLocation || "").toLowerCase();
      const status = (r.status || "").toLowerCase();
      const rep = r.reporterUser
        ? `${r.reporterUser.first_name || ""} ${r.reporterUser.last_name || ""} ${r.reporterUser.contact_number || ""}`.toLowerCase()
        : "anonymous";
      return type.includes(q) || loc.includes(q) || status.includes(q) || rep.includes(q);
    });
  }, [reports, tableSearch]);

  const resolutionRate = useMemo(() => {
    if (!reports.length) return 0;
    return Math.round((analytics.statuses.resolved / reports.length) * 100);
  }, [reports, analytics]);

  const primaryIncidentType = useMemo(() => {
    const entries = Object.entries(analytics.types);
    if (!entries.length) return { name: "N/A", count: 0, pct: 0 };
    entries.sort((a, b) => b[1] - a[1]);
    const top = entries[0];
    return {
      name: top[0],
      count: top[1],
      pct: Math.round((top[1] / reports.length) * 100),
    };
  }, [analytics.types, reports.length]);

  // Executive PDF Generation
  const generatePDFReport = () => {
    if (!reports || reports.length === 0) {
      alert("No data available to export.");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");

    // Header banner
    doc.setFillColor(21, 128, 61);
    doc.rect(0, 0, 210, 26, "F");

    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("MUNICIPALITY OF LAGONGLONG - EMERGENCY OPERATIONS CENTER", 14, 11);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Official Executive Incident Analytics & Audit Dossier • Range: ${startDate} to ${endDate}`, 14, 18);
    doc.text(`Report Source: ${reportSource === "incident" ? "Incident Reports" : "SOS Emergency Alerts"} • Generated on ${new Date().toLocaleString()}`, 14, 22);

    // Summary Metric Box
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("EXECUTIVE PERFORMANCE INDICATORS", 14, 35);

    const summaryData = [
      ["Total Logged Incidents", reports.length.toString()],
      ["Resolved Emergencies", `${analytics.statuses.resolved} (${resolutionRate}% efficiency)`],
      ["Active / Ongoing Operations", analytics.statuses.ongoing.toString()],
      ["Pending Intake Queue", analytics.statuses.pending.toString()],
      ["Primary Incident Driver", `${primaryIncidentType.name} (${primaryIncidentType.count} cases / ${primaryIncidentType.pct}%)`],
    ];

    autoTable(doc, {
      startY: 39,
      head: [["Operational Indicator", "Telemetry Metric"]],
      body: summaryData,
      theme: "grid",
      headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 2.5 },
    });

    // Capture Charts
    const typeImg = typeChartRef.current?.toBase64Image("image/png", 1.0);
    const statusImg = statusChartRef.current?.toBase64Image("image/png", 1.0);

    let nextY = 82;
    if (typeImg && statusImg) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("INCIDENT CLASSIFICATION & STATUS BREAKDOWN", 14, nextY);
      doc.addImage(typeImg, "PNG", 14, nextY + 4, 115, 52);
      doc.addImage(statusImg, "PNG", 135, nextY + 4, 60, 52);
      nextY += 62;
    }

    doc.addPage();
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("INCIDENT LOG AUDIT RECORDS", 14, 16);

    const tableHeaders = [
      "Timestamp",
      "Classification",
      "Resolved Location",
      "Reporter Citizen",
      "Status",
      "Assigned Units",
    ];

    const tableRows = reports.map((r) => {
      let unit = "Unassigned";
      if (r.dispatches && r.dispatches.length > 0) {
        unit = r.dispatches
          .map((d) => {
            const resp = d.expand?.responder_id;
            return resp?.unit_name || (resp?.department ? `${resp.department.toUpperCase()} Dept` : d.department);
          })
          .join(", ");
      }

      const reporterName = r.reporterUser
        ? `${r.reporterUser.first_name || ""} ${r.reporterUser.last_name || ""}`.trim() ||
          r.reporterUser.contact_number ||
          "Registered Citizen"
        : "Anonymous Citizen";

      const rawType = reportSource === "incident" ? r.type || "OTHER" : r.assigned_department || "EMERGENCY SOS";

      return [
        new Date(r.created).toLocaleDateString([], {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        rawType.toUpperCase(),
        r.resolvedLocation,
        reporterName,
        (r.status || (reportSource === "incident" ? "PENDING" : "ACTIVE")).toUpperCase().replace("_", " "),
        unit,
      ];
    });

    autoTable(doc, {
      startY: 22,
      head: [tableHeaders],
      body: tableRows,
      theme: "striped",
      headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 2 },
    });

    // Signature Block
    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 16 : 240;
    if (finalY < 260) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("VERIFIED & AUDITED BY:", 14, finalY);
      doc.line(14, finalY + 14, 74, finalY + 14);
      doc.setFont("helvetica", "normal");
      doc.text("MDRRMO Lead Operations Officer", 14, finalY + 19);

      doc.setFont("helvetica", "bold");
      doc.text("NOTED BY:", 130, finalY);
      doc.line(130, finalY + 14, 190, finalY + 14);
      doc.setFont("helvetica", "normal");
      doc.text("Municipal Mayor / DRRMC Chairman", 130, finalY + 19);
    }

    doc.save(`MDRRMO_Executive_Report_${startDate}_to_${endDate}.pdf`);
  };

  const customCanvasBackgroundColor = {
    id: "customCanvasBackgroundColor",
    beforeDraw: (chart, args, options) => {
      const { ctx } = chart;
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = options.color || "#ffffff";
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    },
  };

  // Chart Configs & Filtered Reports with useMemo
  const typeChartData = useMemo(() => ({
    labels: Object.keys(analytics.types),
    datasets: [
      {
        label: "Logged Incidents",
        data: Object.values(analytics.types),
        backgroundColor: [
          "#dc2626",
          "#ea580c",
          "#0284c7",
          "#15803d",
          "#ca8a04",
          "#7c3aed",
          "#db2777",
        ],
        borderRadius: 8,
        barThickness: 28,
      },
    ],
  }), [analytics.types]);

  const statusChartData = useMemo(() => ({
    labels: ["Resolved", "Active / Ongoing", "Pending Queue"],
    datasets: [
      {
        data: [
          analytics.statuses.resolved,
          analytics.statuses.ongoing,
          analytics.statuses.pending,
        ],
        backgroundColor: ["#15803d", "#f59e0b", "#dc2626"],
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  }), [analytics.statuses]);

  const filteredReports = useMemo(() => {
    if (!tableSearch.trim()) return reports;
    const query = tableSearch.toLowerCase();
    return reports.filter((r) => {
      const rawType = (r.type || r.assigned_department || "").toLowerCase();
      const addr = (r.resolvedAddress || "").toLowerCase();
      const rep = r.reporterUser
        ? `${r.reporterUser.first_name || ""} ${r.reporterUser.last_name || ""}`.toLowerCase()
        : "";
      return rawType.includes(query) || addr.includes(query) || rep.includes(query);
    });
  }, [reports, tableSearch]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar />

      <main style={{ flex: 1, marginLeft: "216px", padding: "32px 38px", minWidth: 0, overflowY: "auto" }}>
        {/* EXECUTIVE HERO BANNER */}
        <header
          style={{
            marginBottom: "28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: "18px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span className="live-status-pulse" style={{ width: "11px", height: "11px", borderRadius: "50%", backgroundColor: "#15803d", display: "inline-block" }} />
              <span style={{ fontSize: "11.5px", fontWeight: "900", color: "#15803d", textTransform: "uppercase", letterSpacing: "0.06em", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "3px 9px", borderRadius: "6px" }}>
                Lagonglong MDRRMO Intelligence & Audit
              </span>
            </div>
            <h1 style={{ fontSize: "clamp(24px, 3.2vw, 32px)", fontWeight: "900", color: "#0f172a", margin: 0, letterSpacing: "-0.03em" }}>
              Operations Analytics & Reporting Center
            </h1>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px", fontWeight: "500" }}>
              Aggregate real-time emergency telemetry, audit response efficacy, analyze geographic hotspots, and generate executive dossiers.
            </p>
          </div>

          {isDataLoaded && (
            <button
              type="button"
              onClick={generatePDFReport}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "11px 22px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #15803d 0%, #166534 100%)",
                color: "#ffffff",
                fontSize: "13.5px",
                fontWeight: "800",
                cursor: "pointer",
                boxShadow: "0 6px 18px rgba(21, 128, 61, 0.28)",
                transition: "all 0.18s ease",
              }}
            >
              <Download size={16} />
              <span>Export Executive PDF Dossier</span>
            </button>
          )}
        </header>

        {/* TACTICAL FILTER & CONTROL RIBBON */}
        <div
          className="premium-table-card"
          style={{
            padding: "24px",
            marginBottom: "28px",
            borderTop: "4px solid #15803d",
            backgroundColor: "#ffffff",
            boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.06)",
          }}
        >
          {/* Top Quick-Preset Buttons & Source Selector */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px",
              paddingBottom: "18px",
              borderBottom: "1px solid #f1f5f9",
              marginBottom: "18px",
            }}
          >
            {/* Quick Range Presets */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11.5px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", marginRight: "4px", letterSpacing: "0.04em" }}>
                Range Presets:
              </span>
              {[
                { id: "today", label: "Today" },
                { id: "7days", label: "Last 7 Days" },
                { id: "30days", label: "Last 30 Days" },
                { id: "thisMonth", label: "This Month" },
                { id: "ytd", label: "Year-to-Date" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyDatePreset(p.id)}
                  style={{
                    padding: "5px 11px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#f8fafc",
                    color: "#334155",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Source Segmented Toggle */}
            <div
              style={{
                display: "inline-flex",
                backgroundColor: "#f1f5f9",
                borderRadius: "10px",
                padding: "3px",
                border: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => setReportSource("incident")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: reportSource === "incident" ? "#ffffff" : "transparent",
                  color: reportSource === "incident" ? "#15803d" : "#64748b",
                  fontWeight: "800",
                  fontSize: "12.5px",
                  cursor: "pointer",
                  boxShadow: reportSource === "incident" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                }}
              >
                <FileText size={14} /> Incident Reports
              </button>
              <button
                type="button"
                onClick={() => setReportSource("sos")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: reportSource === "sos" ? "#ffffff" : "transparent",
                  color: reportSource === "sos" ? "#dc2626" : "#64748b",
                  fontWeight: "800",
                  fontSize: "12.5px",
                  cursor: "pointer",
                  boxShadow: reportSource === "sos" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                }}
              >
                <Radio size={14} /> Emergency SOS Alerts
              </button>
            </div>
          </div>

          {/* Date & Classification Form Inputs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr)) 220px",
              gap: "16px",
              alignItems: "flex-end",
            }}
          >
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: "800", color: "#334155", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                <Calendar size={13} color="#15803d" /> Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  fontSize: "13.5px",
                  fontWeight: "700",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: "800", color: "#334155", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                <Calendar size={13} color="#15803d" /> End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  fontSize: "13.5px",
                  fontWeight: "700",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {reportSource === "incident" && (
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: "800", color: "#334155", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  <Filter size={13} color="#15803d" /> Classification
                </label>
                <CustomDropdown
                  minWidth="100%"
                  value={selectedIncidentType}
                  onChange={(val) => setSelectedIncidentType(val)}
                  options={INCIDENT_CATEGORIES.map((c) => ({
                    value: c.value,
                    label: c.label,
                  }))}
                />
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={fetchAnalyticsData}
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "11px 18px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #15803d 0%, #166534 100%)",
                  color: "#ffffff",
                  fontSize: "13.5px",
                  fontWeight: "900",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 14px rgba(21, 128, 61, 0.25)",
                }}
              >
                {isLoading ? <Loader className="animate-spin" size={16} /> : <BarChart3 size={16} />}
                <span>{isLoading ? `Compiling (${loadingProgress}%)` : "Compile Analytics"}</span>
              </button>
            </div>
          </div>

          {/* Compilation Progress Bar if Loading */}
          {isLoading && (
            <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", fontSize: "12px", color: "#64748b" }}>
                <span style={{ fontWeight: "700", color: "#15803d", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Loader className="animate-spin" size={12} /> {loadingStep}
                </span>
                <span style={{ fontWeight: "800", color: "#0f172a" }}>{loadingProgress}%</span>
              </div>
              <div style={{ width: "100%", height: "6px", backgroundColor: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${loadingProgress}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #15803d 0%, #22c55e 100%)",
                    transition: "width 0.25s ease-out",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* PRE-FLIGHT BRIEFING BANNER IF NOT YET LOADED */}
        {!isDataLoaded && !isLoading && (
          <div
            className="premium-table-card"
            style={{
              padding: "48px 32px",
              textAlign: "center",
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              border: "1px dashed #cbd5e1",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "20px",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#15803d",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <Activity size={30} />
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a", margin: "0 0 8px" }}>
              Ready to Compile Municipal Telemetry
            </h2>
            <p style={{ maxWidth: "560px", margin: "0 auto 24px", color: "#64748b", fontSize: "14px", lineHeight: "1.6" }}>
              Select a date range preset above and click <strong>Compile Analytics</strong> to generate interactive telemetry charts, emergency resolution rates, hotspot analysis, and printable audit dossiers.
            </p>
            <div style={{ display: "inline-flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  applyDatePreset("30days");
                  setTimeout(fetchAnalyticsData, 50);
                }}
                style={{
                  padding: "9px 20px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: "#15803d",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "800",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 4px 12px rgba(21, 128, 61, 0.22)",
                }}
              >
                <Sparkles size={14} /> Quick Compile Last 30 Days
              </button>
            </div>
          </div>
        )}

        {/* COMPILED TELEMETRY INTELLIGENCE VIEW */}
        {isDataLoaded && (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {/* TOP SCALE-JUMP KPI RIBBON */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px" }}>
              {/* Total Cases Card */}
              <div
                className="premium-table-card"
                style={{
                  padding: "22px 24px",
                  position: "relative",
                  overflow: "hidden",
                  borderLeft: "6px solid #0f172a",
                }}
              >
                <span style={{ fontSize: "11.5px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Layers size={14} color="#0f172a" /> Total Operations Logged
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "10px" }}>
                  <h2 style={{ fontSize: "38px", fontWeight: "900", color: "#0f172a", margin: 0, letterSpacing: "-0.03em" }}>
                    {reports.length}
                  </h2>
                  <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#64748b" }}>cases</span>
                </div>
                <div style={{ marginTop: "12px", fontSize: "12px", color: "#15803d", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                  <TrendingUp size={13} /> {startDate} to {endDate}
                </div>
              </div>

              {/* Resolved / Efficiency Card */}
              <div
                className="premium-table-card"
                style={{
                  padding: "22px 24px",
                  borderLeft: "6px solid #15803d",
                  backgroundColor: "#ffffff",
                }}
              >
                <span style={{ fontSize: "11.5px", fontWeight: "800", color: "#15803d", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle2 size={14} color="#15803d" /> Resolved Efficiency
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "10px" }}>
                  <h2 style={{ fontSize: "38px", fontWeight: "900", color: "#15803d", margin: 0, letterSpacing: "-0.03em" }}>
                    {resolutionRate}%
                  </h2>
                  <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#166534" }}>
                    ({analytics.statuses.resolved} resolved)
                  </span>
                </div>
                {/* Visual mini-bar */}
                <div style={{ width: "100%", height: "5px", backgroundColor: "#f0fdf4", borderRadius: "999px", marginTop: "12px", overflow: "hidden" }}>
                  <div style={{ width: `${resolutionRate}%`, height: "100%", backgroundColor: "#15803d" }} />
                </div>
              </div>

              {/* Active Dispatches Card */}
              <div
                className="premium-table-card"
                style={{
                  padding: "22px 24px",
                  borderLeft: "6px solid #f59e0b",
                  backgroundColor: "#ffffff",
                }}
              >
                <span style={{ fontSize: "11.5px", fontWeight: "800", color: "#d97706", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Activity size={14} color="#d97706" /> Active Field Units
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "10px" }}>
                  <h2 style={{ fontSize: "38px", fontWeight: "900", color: "#d97706", margin: 0, letterSpacing: "-0.03em" }}>
                    {analytics.statuses.ongoing}
                  </h2>
                  <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#b45309" }}>en route / scene</span>
                </div>
                <div style={{ marginTop: "12px", fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                  {analytics.statuses.pending} awaiting assignment
                </div>
              </div>

              {/* Leading Incident Driver */}
              <div
                className="premium-table-card"
                style={{
                  padding: "22px 24px",
                  borderLeft: "6px solid #dc2626",
                  backgroundColor: "#ffffff",
                }}
              >
                <span style={{ fontSize: "11.5px", fontWeight: "800", color: "#b91c1c", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <ShieldAlert size={14} color="#dc2626" /> Primary Incident Driver
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "10px" }}>
                  <h2 style={{ fontSize: "28px", fontWeight: "900", color: "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "-0.02em" }}>
                    {primaryIncidentType.name}
                  </h2>
                </div>
                <div style={{ marginTop: "12px", fontSize: "12px", color: "#b91c1c", fontWeight: "800" }}>
                  {primaryIncidentType.count} cases ({primaryIncidentType.pct}% of volume)
                </div>
              </div>
            </div>

            {/* DUAL CHARTS DISPLAY */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "24px" }}>
              {/* Classification Bar Chart */}
              <div className="premium-table-card" style={{ padding: "26px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                      <BarChart3 size={18} color="#15803d" /> Incident Classification Breakdown
                    </h3>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                      Volume distribution across emergency categories
                    </span>
                  </div>
                </div>
                <div style={{ height: "260px", position: "relative" }}>
                  <Bar
                    ref={typeChartRef}
                    data={typeChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        customCanvasBackgroundColor: { color: "#ffffff" },
                      },
                      scales: {
                        x: {
                          ticks: { color: "#475569", font: { weight: "700", size: 11 } },
                          grid: { display: false },
                        },
                        y: {
                          ticks: { color: "#64748b", font: { weight: "600" }, precision: 0 },
                          grid: { color: "#f1f5f9" },
                        },
                      },
                    }}
                    plugins={[customCanvasBackgroundColor]}
                  />
                </div>
              </div>

              {/* Status Distribution Donut */}
              <div className="premium-table-card" style={{ padding: "26px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                      <PieChart size={18} color="#0284c7" /> Operational Status Distribution
                    </h3>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                      Case resolution & operational queue lifecycle
                    </span>
                  </div>
                </div>
                <div style={{ height: "260px", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Doughnut
                    ref={statusChartRef}
                    data={statusChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: "68%",
                      plugins: {
                        legend: {
                          position: "bottom",
                          labels: { color: "#334155", font: { weight: "700", size: 11.5 }, boxWidth: 12, padding: 14 },
                        },
                        customCanvasBackgroundColor: { color: "#ffffff" },
                      },
                    }}
                    plugins={[customCanvasBackgroundColor]}
                  />
                </div>
              </div>
            </div>

            {/* HOTSPOTS & DISPATCHED RESPONDERS LEADERBOARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "24px" }}>
              {/* Geographic Hotspots */}
              <div className="premium-table-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: "1px solid #f1f5f9", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <MapPin size={17} color="#dc2626" /> Top Incident Hotspots (Barangays)
                  </h3>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: "#dc2626", backgroundColor: "#fef2f2", padding: "2px 7px", borderRadius: "6px" }}>
                    {analytics.topAreas.length} Areas Identified
                  </span>
                </div>

                {analytics.topAreas.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>No location data recorded.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {analytics.topAreas.map(([areaName, count], idx) => {
                      const pct = Math.round((count / (reports.length || 1)) * 100);
                      return (
                        <div key={areaName}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", fontSize: "13px" }}>
                            <span style={{ fontWeight: "700", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ width: "20px", height: "20px", borderRadius: "6px", backgroundColor: idx === 0 ? "#dc2626" : "#f1f5f9", color: idx === 0 ? "#fff" : "#475569", fontSize: "11px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: "900" }}>
                                {idx + 1}
                              </span>
                              {areaName}
                            </span>
                            <span style={{ fontWeight: "800", color: "#0f172a" }}>
                              {count} <span style={{ color: "#64748b", fontWeight: "600", fontSize: "11.5px" }}>({pct}%)</span>
                            </span>
                          </div>
                          <div style={{ width: "100%", height: "6px", backgroundColor: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: idx === 0 ? "linear-gradient(90deg, #dc2626 0%, #f87171 100%)" : "#94a3b8" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Responders Leaderboard */}
              <div className="premium-table-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: "1px solid #f1f5f9", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Users size={17} color="#15803d" /> Top Deployed Response Units
                  </h3>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: "#15803d", backgroundColor: "#f0fdf4", padding: "2px 7px", borderRadius: "6px" }}>
                    Multi-Agency Telemetry
                  </span>
                </div>

                {analytics.topResponders.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>No unit dispatch logs in selected range.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {analytics.topResponders.map(([responderName, count], idx) => (
                      <div
                        key={responderName}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "26px", height: "26px", borderRadius: "8px", backgroundColor: "#15803d", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11.5px", fontWeight: "900" }}>
                            {idx + 1}
                          </div>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                            {responderName}
                          </span>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: "800", color: "#15803d", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "3px 8px", borderRadius: "6px" }}>
                          {count} Dispatches
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* AUDIT LOG TABLE & SEARCH */}
            <div className="premium-table-card" style={{ padding: "24px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "14px",
                  marginBottom: "18px",
                  paddingBottom: "14px",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "900", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileText size={19} color="#15803d" /> Incident Telemetry Log Records
                  </h3>
                  <span style={{ fontSize: "12.5px", color: "#64748b", fontWeight: "600" }}>
                    Showing {filteredReports.length} of {reports.length} compiled operation entries
                  </span>
                </div>

                {/* Table Search Bar */}
                <div className="search-box-premium" style={{ width: "280px" }}>
                  <Search size={15} color="#94a3b8" />
                  <input
                    type="text"
                    placeholder="Search logs by keyword, location, or unit..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    style={{ fontSize: "12.5px" }}
                  />
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="premium-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "12px 14px", backgroundColor: "#15803d", color: "#ffffff", fontSize: "12px", fontWeight: "800", borderRadius: "10px 0 0 0" }}>
                        Classification
                      </th>
                      <th style={{ textAlign: "left", padding: "12px 14px", backgroundColor: "#15803d", color: "#ffffff", fontSize: "12px", fontWeight: "800" }}>
                        Date & Time
                      </th>
                      <th style={{ textAlign: "left", padding: "12px 14px", backgroundColor: "#15803d", color: "#ffffff", fontSize: "12px", fontWeight: "800" }}>
                        Resolved Incident Location
                      </th>
                      <th style={{ textAlign: "left", padding: "12px 14px", backgroundColor: "#15803d", color: "#ffffff", fontSize: "12px", fontWeight: "800" }}>
                        Reporter Citizen
                      </th>
                      <th style={{ textAlign: "left", padding: "12px 14px", backgroundColor: "#15803d", color: "#ffffff", fontSize: "12px", fontWeight: "800" }}>
                        Assigned Units
                      </th>
                      <th style={{ textAlign: "center", padding: "12px 14px", backgroundColor: "#15803d", color: "#ffffff", fontSize: "12px", fontWeight: "800", borderRadius: "0 10px 0 0" }}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.slice(0, 100).map((r) => {
                      const rawType = reportSource === "incident" ? r.type || "OTHER" : r.assigned_department || "EMERGENCY SOS";
                      const reporterName = r.reporterUser
                        ? `${r.reporterUser.first_name || ""} ${r.reporterUser.last_name || ""}`.trim() || r.reporterUser.contact_number || "Registered Citizen"
                        : "Anonymous Citizen";

                      let assignedUnits = "None Assigned";
                      if (r.dispatches && r.dispatches.length > 0) {
                        assignedUnits = r.dispatches
                          .map((d) => {
                            const resp = d.expand?.responder_id;
                            return resp?.unit_name || (resp?.department ? `${resp.department.toUpperCase()} Dept` : d.department);
                          })
                          .join(", ");
                      }

                      return (
                        <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 14px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: "800",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                backgroundColor: "#f8fafc",
                                color: "#0f172a",
                                border: "1px solid #cbd5e1",
                                textTransform: "uppercase",
                              }}
                            >
                              {rawType}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: "12.5px", color: "#64748b", fontWeight: "600", whiteSpace: "nowrap" }}>
                            {new Date(r.created).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: "12.5px", color: "#0f172a", fontWeight: "700", maxWidth: "260px" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                              <MapPin size={13} color="#15803d" style={{ flexShrink: 0, marginTop: "2px" }} />
                              <span>{r.resolvedLocation}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: "12.5px", color: "#334155", fontWeight: "600" }}>
                            {reporterName}
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: "12px", color: "#64748b" }}>
                            {assignedUnits}
                          </td>
                          <td style={{ padding: "12px 14px", textAlign: "center" }}>
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: "800",
                                padding: "2px 8px",
                                borderRadius: "6px",
                                backgroundColor: r.status === "resolved" ? "#f0fdf4" : r.status === "ongoing" ? "#fffbeb" : "#fef2f2",
                                color: r.status === "resolved" ? "#15803d" : r.status === "ongoing" ? "#b45309" : "#b91c1c",
                                border: r.status === "resolved" ? "1px solid #bbf7d0" : r.status === "ongoing" ? "1px solid #fde68a" : "1px solid #fecaca",
                                textTransform: "uppercase",
                              }}
                            >
                              {(r.status || (reportSource === "incident" ? "PENDING" : "ACTIVE")).replace("_", " ")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
