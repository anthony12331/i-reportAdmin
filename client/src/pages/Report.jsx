import React, { useState, useRef, useMemo } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import CustomDropdown from "../components/CustomDropdown";
import { useTheme } from "../themes/ThemeContext";
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
  const { isDark } = useTheme();
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
      setLoadingStep("Aggregating dispatches & resolving geocoding...");

      // Fetch dispatches for resolution tracking
      let dispatchList = [];
      try {
        dispatchList = await pb.collection("dispatches").getFullList({
          filter: `created >= "${start}" && created <= "${end}"`,
          expand: "responder_id,assigned_to",
        });
      } catch (e) {
        console.warn("Dispatches load warning:", e);
      }

      setLoadingProgress(60);
      setLoadingStep("Processing spatial coordinates & address mapping...");

      // Map raw data with resolved addresses & dispatches
      const enrichedReports = await Promise.all(
        rawData.map(async (item) => {
          let resolvedLocation = "Lagonglong, Misamis Oriental";
          if (item.latitude && item.longitude) {
            try {
              resolvedLocation = await getReadableAddress(item.latitude, item.longitude);
            } catch (err) {
              resolvedLocation = item.location || `GPS (${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)})`;
            }
          } else if (item.location) {
            resolvedLocation = item.location;
          }

          // Match dispatches
          const matchedDispatches = dispatchList.filter((d) =>
            reportSource === "incident"
              ? d.incident_id === item.id || d.incident === item.id
              : d.sos_id === item.id || d.sos === item.id
          );

          return {
            ...item,
            resolvedLocation,
            dispatches: matchedDispatches,
            reporterUser: item.expand?.users || item.expand?.user || null,
          };
        })
      );

      setLoadingProgress(85);
      setLoadingStep("Compiling statistical aggregates...");

      // Compile Analytics Aggregates
      const typeCounts = {};
      const statusCounts = { pending: 0, ongoing: 0, resolved: 0 };
      const areaCounts = {};
      const responderCounts = {};

      enrichedReports.forEach((r) => {
        // Types
        const t = (reportSource === "incident" ? r.type : r.assigned_department) || "OTHER";
        typeCounts[t] = (typeCounts[t] || 0) + 1;

        // Status
        const st = (r.status || "pending").toLowerCase();
        if (st === "resolved" || st === "closed") statusCounts.resolved += 1;
        else if (st === "ongoing" || st === "dispatched" || st === "in_progress") statusCounts.ongoing += 1;
        else statusCounts.pending += 1;

        // Areas (extract barangay/poblacion keywords)
        const loc = r.resolvedLocation || "";
        const cleanArea = loc.split(",")[0]?.trim() || "Lagonglong Central";
        areaCounts[cleanArea] = (areaCounts[cleanArea] || 0) + 1;

        // Responders
        if (r.dispatches && r.dispatches.length > 0) {
          r.dispatches.forEach((d) => {
            const respName =
              d.expand?.responder_id?.unit_name ||
              d.expand?.responder_id?.name ||
              d.expand?.assigned_to?.username ||
              d.department ||
              "Emergency Dispatch Unit";
            responderCounts[respName] = (responderCounts[respName] || 0) + 1;
          });
        }
      });

      // Top Areas Sorted
      const sortedAreas = Object.entries(areaCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      // Top Responders Sorted
      const sortedResponders = Object.entries(responderCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      setReports(enrichedReports);
      setAnalytics({
        types: typeCounts,
        statuses: statusCounts,
        topAreas: sortedAreas,
        topResponders: sortedResponders,
      });

      setLoadingProgress(100);
      setIsDataLoaded(true);
    } catch (error) {
      console.error("Failed to compile analytics:", error);
      alert(`Analytics compilation error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter Table Search
  const filteredReports = useMemo(() => {
    if (!tableSearch.trim()) return reports;
    const query = tableSearch.toLowerCase();
    return reports.filter((r) => {
      const type = (r.type || r.assigned_department || "").toLowerCase();
      const loc = (r.resolvedLocation || "").toLowerCase();
      const user = `${r.reporterUser?.first_name || ""} ${r.reporterUser?.last_name || ""}`.toLowerCase();
      const status = (r.status || "").toLowerCase();
      return type.includes(query) || loc.includes(query) || user.includes(query) || status.includes(query);
    });
  }, [reports, tableSearch]);

  // Resolution Rate Percentage
  const resolutionRate = useMemo(() => {
    const total = reports.length;
    if (!total) return 0;
    return Math.round((analytics.statuses.resolved / total) * 100);
  }, [reports.length, analytics.statuses.resolved]);

  // Primary Incident Type
  const primaryIncidentType = useMemo(() => {
    const entries = Object.entries(analytics.types);
    if (!entries.length) return { name: "None", count: 0, pct: 0 };
    entries.sort((a, b) => b[1] - a[1]);
    const top = entries[0];
    const pct = Math.round((top[1] / (reports.length || 1)) * 100);
    return { name: top[0], count: top[1], pct };
  }, [analytics.types, reports.length]);

  // PDF Executive Report Generator
  const generatePDFReport = () => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const primaryColor = [21, 128, 61]; // #15803d
      const darkColor = [15, 23, 42]; // #0f172a
      const slateColor = [100, 116, 139]; // #64748b

      // Header Banner
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 210, 26, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("LAGONGLONG MDRRMO OPERATIONS & INCIDENT AUDIT", 14, 12);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(`Official Emergency Telemetry Dossier | Range: ${startDate} to ${endDate} | Generated: ${new Date().toLocaleString()}`, 14, 19);

      // Section 1: Executive KPI Metrics
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...darkColor);
      doc.text("1. EXECUTIVE OPERATIONS SUMMARY", 14, 34);

      autoTable(doc, {
        startY: 37,
        head: [["Total Incidents Logged", "Resolved Cases", "Active / Ongoing", "Operational Efficacy Rate"]],
        body: [
          [
            `${reports.length} operations`,
            `${analytics.statuses.resolved} resolved`,
            `${analytics.statuses.ongoing} active units`,
            `${resolutionRate}% resolution efficiency`,
          ],
        ],
        theme: "grid",
        headStyles: { fillColor: [240, 253, 244], textColor: primaryColor, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, fontStyle: "bold", textColor: darkColor },
      });

      // Section 2: Classification Breakdown Table
      let currentY = doc.lastAutoTable.finalY + 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...darkColor);
      doc.text("2. INCIDENT CLASSIFICATION DISTRIBUTION", 14, currentY);

      const typeTableBody = Object.entries(analytics.types).map(([type, count]) => {
        const pct = Math.round((count / (reports.length || 1)) * 100);
        return [type.toUpperCase(), String(count), `${pct}%`];
      });

      autoTable(doc, {
        startY: currentY + 3,
        head: [["Classification / Emergency Type", "Volume Count", "Percentage Share"]],
        body: typeTableBody,
        theme: "striped",
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
        bodyStyles: { fontSize: 8.5, textColor: darkColor },
      });

      // Section 3: Geographic Hotspots
      currentY = doc.lastAutoTable.finalY + 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...darkColor);
      doc.text("3. TOP GEOGRAPHIC HOTSPOTS & DISPATCH LEADERBOARD", 14, currentY);

      const hotspotRows = analytics.topAreas.map(([area, count], idx) => [
        `#${idx + 1} ${area}`,
        `${count} incidents`,
        `${Math.round((count / (reports.length || 1)) * 100)}% volume`,
      ]);

      autoTable(doc, {
        startY: currentY + 3,
        head: [["Location / Barangay", "Incident Count", "Concentration"]],
        body: hotspotRows.length ? hotspotRows : [["No location data", "0", "0%"]],
        theme: "striped",
        headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
        bodyStyles: { fontSize: 8.5, textColor: darkColor },
      });

      // Page 2: Detailed Operation Log Records
      doc.addPage();
      doc.setFillColor(...darkColor);
      doc.rect(0, 0, 210, 16, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("4. ITEMIZED EMERGENCY INCIDENT LOG (CHRONOLOGICAL AUDIT)", 14, 11);

      const tableData = reports.map((r) => [
        (reportSource === "incident" ? r.type : r.assigned_department) || "OTHER",
        new Date(r.created).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        r.resolvedLocation || "Lagonglong",
        r.reporterUser ? `${r.reporterUser.first_name || ""} ${r.reporterUser.last_name || ""}`.trim() : "Citizen",
        r.status?.toUpperCase() || "PENDING",
      ]);

      autoTable(doc, {
        startY: 20,
        head: [["Type", "Date & Time", "Location", "Reporter", "Status"]],
        body: tableData.slice(0, 70), // Keep clean within PDF pages
        theme: "striped",
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 7.5, textColor: darkColor },
        columnStyles: {
          0: { cellWidth: 28, fontStyle: "bold" },
          1: { cellWidth: 28 },
          2: { cellWidth: 70 },
          3: { cellWidth: 35 },
          4: { cellWidth: 25, fontStyle: "bold" },
        },
      });

      // Footer Authentication Stamp
      const finalY = doc.lastAutoTable.finalY + 12;
      if (finalY < 270) {
        doc.setDrawColor(200, 200, 200);
        doc.line(14, finalY, 196, finalY);
        doc.setFontSize(8);
        doc.setTextColor(...slateColor);
        doc.text("Certified Official Emergency Record — Municipal Disaster Risk Reduction & Management Office (MDRRMO)", 14, finalY + 6);
      }

      doc.save(`Lagonglong_MDRRMO_Audit_Report_${startDate}_to_${endDate}.pdf`);
    } catch (error) {
      console.error("PDF Generation failed:", error);
      alert(`Failed to export PDF dossier: ${error.message}`);
    }
  };

  // Chart Custom Canvas Background Plugin
  const customCanvasBackgroundColor = {
    id: "customCanvasBackgroundColor",
    beforeDraw: (chart, args, options) => {
      const { ctx } = chart;
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = isDark ? "#131c2e" : (options.color || "#ffffff");
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    },
  };

  // Chart Configs
  const typeChartData = useMemo(() => {
    const labels = Object.keys(analytics.types);
    const data = Object.values(analytics.types);
    const backgroundColors = labels.map((l) => {
      const match = INCIDENT_CATEGORIES.find((c) => c.value === l.toLowerCase());
      return match ? match.color : "#15803d";
    });

    return {
      labels: labels.map((l) => l.toUpperCase()),
      datasets: [
        {
          data,
          backgroundColor: backgroundColors.length ? backgroundColors : ["#15803d"],
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    };
  }, [analytics.types]);

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

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: isDark ? "#090e17" : "#f8fafc", color: isDark ? "#f8fafc" : "#0f172a", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
              <span className="live-status-pulse" style={{ width: "11px", height: "11px", borderRadius: "50%", backgroundColor: isDark ? "#4ade80" : "#15803d", display: "inline-block" }} />
              <span style={{ fontSize: "11.5px", fontWeight: "900", color: isDark ? "#4ade80" : "#15803d", textTransform: "uppercase", letterSpacing: "0.06em", backgroundColor: isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4", border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #bbf7d0", padding: "3px 9px", borderRadius: "6px" }}>
                Lagonglong MDRRMO Intelligence & Audit
              </span>
            </div>
            <h1 style={{ fontSize: "clamp(24px, 3.2vw, 32px)", fontWeight: "900", color: isDark ? "#f8fafc" : "#0f172a", margin: 0, letterSpacing: "-0.03em" }}>
              Operations Analytics & Reporting Center
            </h1>
            <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: "14px", fontWeight: "500" }}>
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
            borderTop: isDark ? "4px solid #22c55e" : "4px solid #15803d",
            backgroundColor: isDark ? "#131c2e" : "#ffffff",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
            boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : "0 4px 20px -2px rgba(15, 23, 42, 0.06)",
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
              borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
              marginBottom: "18px",
            }}
          >
            {/* Quick Range Presets */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11.5px", fontWeight: "800", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", marginRight: "4px", letterSpacing: "0.04em" }}>
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
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                    backgroundColor: isDark ? "#172338" : "#f8fafc",
                    color: isDark ? "#f8fafc" : "#334155",
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
                backgroundColor: isDark ? "#172338" : "#f1f5f9",
                borderRadius: "10px",
                padding: "3px",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0",
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
                  backgroundColor: reportSource === "incident" ? (isDark ? "#131c2e" : "#ffffff") : "transparent",
                  color: reportSource === "incident" ? (isDark ? "#4ade80" : "#15803d") : (isDark ? "#94a3b8" : "#64748b"),
                  fontWeight: "800",
                  fontSize: "12.5px",
                  cursor: "pointer",
                  boxShadow: reportSource === "incident" ? (isDark ? "0 2px 6px rgba(0,0,0,0.4)" : "0 2px 6px rgba(0,0,0,0.06)") : "none",
                  transition: "all 0.15s ease",
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
                  backgroundColor: reportSource === "sos" ? (isDark ? "#131c2e" : "#ffffff") : "transparent",
                  color: reportSource === "sos" ? (isDark ? "#f87171" : "#dc2626") : (isDark ? "#94a3b8" : "#64748b"),
                  fontWeight: "800",
                  fontSize: "12.5px",
                  cursor: "pointer",
                  boxShadow: reportSource === "sos" ? (isDark ? "0 2px 6px rgba(0,0,0,0.4)" : "0 2px 6px rgba(0,0,0,0.06)") : "none",
                  transition: "all 0.15s ease",
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
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: "800", color: isDark ? "#f8fafc" : "#334155", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                <Calendar size={13} color={isDark ? "#4ade80" : "#15803d"} /> Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                  backgroundColor: isDark ? "#172338" : "#ffffff",
                  color: isDark ? "#f8fafc" : "#0f172a",
                  fontSize: "13.5px",
                  fontWeight: "700",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: "800", color: isDark ? "#f8fafc" : "#334155", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                <Calendar size={13} color={isDark ? "#4ade80" : "#15803d"} /> End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                  backgroundColor: isDark ? "#172338" : "#ffffff",
                  color: isDark ? "#f8fafc" : "#0f172a",
                  fontSize: "13.5px",
                  fontWeight: "700",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {reportSource === "incident" && (
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: "800", color: isDark ? "#f8fafc" : "#334155", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  <Filter size={13} color={isDark ? "#4ade80" : "#15803d"} /> Classification
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
            <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>
                <span style={{ fontWeight: "700", color: isDark ? "#4ade80" : "#15803d", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Loader className="animate-spin" size={12} /> {loadingStep}
                </span>
                <span style={{ fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a" }}>{loadingProgress}%</span>
              </div>
              <div style={{ width: "100%", height: "6px", backgroundColor: isDark ? "#172338" : "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
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
              backgroundColor: isDark ? "#131c2e" : "#ffffff",
              borderRadius: "20px",
              border: isDark ? "1px dashed rgba(255, 255, 255, 0.15)" : "1px dashed #cbd5e1",
              boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined,
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "20px",
                backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
                border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0",
                color: isDark ? "#4ade80" : "#15803d",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <Activity size={30} />
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: "900", color: isDark ? "#f8fafc" : "#0f172a", margin: "0 0 8px" }}>
              Ready to Compile Municipal Telemetry
            </h2>
            <p style={{ maxWidth: "560px", margin: "0 auto 24px", color: isDark ? "#94a3b8" : "#64748b", fontSize: "14px", lineHeight: "1.6" }}>
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
                  backgroundColor: isDark ? "#131c2e" : "#ffffff",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                  borderLeft: isDark ? "6px solid #4ade80" : "6px solid #0f172a",
                  boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined,
                }}
              >
                <span style={{ fontSize: "11.5px", fontWeight: "800", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Layers size={14} color={isDark ? "#4ade80" : "#0f172a"} /> Total Operations Logged
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "10px" }}>
                  <h2 style={{ fontSize: "38px", fontWeight: "900", color: isDark ? "#f8fafc" : "#0f172a", margin: 0, letterSpacing: "-0.03em" }}>
                    {reports.length}
                  </h2>
                  <span style={{ fontSize: "12.5px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b" }}>cases</span>
                </div>
                <div style={{ marginTop: "12px", fontSize: "12px", color: isDark ? "#4ade80" : "#15803d", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                  <TrendingUp size={13} /> {startDate} to {endDate}
                </div>
              </div>

              {/* Resolved / Efficiency Card */}
              <div
                className="premium-table-card"
                style={{
                  padding: "22px 24px",
                  borderLeft: "6px solid #15803d",
                  backgroundColor: isDark ? "#131c2e" : "#ffffff",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                  boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined,
                }}
              >
                <span style={{ fontSize: "11.5px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle2 size={14} color={isDark ? "#4ade80" : "#15803d"} /> Resolved Efficiency
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "10px" }}>
                  <h2 style={{ fontSize: "38px", fontWeight: "900", color: isDark ? "#4ade80" : "#15803d", margin: 0, letterSpacing: "-0.03em" }}>
                    {resolutionRate}%
                  </h2>
                  <span style={{ fontSize: "12.5px", fontWeight: "700", color: isDark ? "#86efac" : "#166534" }}>
                    ({analytics.statuses.resolved} resolved)
                  </span>
                </div>
                {/* Visual mini-bar */}
                <div style={{ width: "100%", height: "5px", backgroundColor: isDark ? "#172338" : "#f0fdf4", borderRadius: "999px", marginTop: "12px", overflow: "hidden" }}>
                  <div style={{ width: `${resolutionRate}%`, height: "100%", backgroundColor: isDark ? "#4ade80" : "#15803d" }} />
                </div>
              </div>

              {/* Active Dispatches Card */}
              <div
                className="premium-table-card"
                style={{
                  padding: "22px 24px",
                  borderLeft: "6px solid #f59e0b",
                  backgroundColor: isDark ? "#131c2e" : "#ffffff",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                  boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined,
                }}
              >
                <span style={{ fontSize: "11.5px", fontWeight: "800", color: isDark ? "#fbbf24" : "#d97706", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Activity size={14} color={isDark ? "#fbbf24" : "#d97706"} /> Active Field Units
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "10px" }}>
                  <h2 style={{ fontSize: "38px", fontWeight: "900", color: isDark ? "#fbbf24" : "#d97706", margin: 0, letterSpacing: "-0.03em" }}>
                    {analytics.statuses.ongoing}
                  </h2>
                  <span style={{ fontSize: "12.5px", fontWeight: "700", color: isDark ? "#fde68a" : "#b45309" }}>en route / scene</span>
                </div>
                <div style={{ marginTop: "12px", fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600" }}>
                  {analytics.statuses.pending} awaiting assignment
                </div>
              </div>

              {/* Leading Incident Driver */}
              <div
                className="premium-table-card"
                style={{
                  padding: "22px 24px",
                  borderLeft: "6px solid #dc2626",
                  backgroundColor: isDark ? "#131c2e" : "#ffffff",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                  boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined,
                }}
              >
                <span style={{ fontSize: "11.5px", fontWeight: "800", color: isDark ? "#f87171" : "#b91c1c", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <ShieldAlert size={14} color={isDark ? "#f87171" : "#dc2626"} /> Primary Incident Driver
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "10px" }}>
                  <h2 style={{ fontSize: "28px", fontWeight: "900", color: isDark ? "#f8fafc" : "#0f172a", margin: 0, textTransform: "uppercase", letterSpacing: "-0.02em" }}>
                    {primaryIncidentType.name}
                  </h2>
                </div>
                <div style={{ marginTop: "12px", fontSize: "12px", color: isDark ? "#f87171" : "#b91c1c", fontWeight: "800" }}>
                  {primaryIncidentType.count} cases ({primaryIncidentType.pct}% of volume)
                </div>
              </div>
            </div>

            {/* DUAL CHARTS DISPLAY */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "24px" }}>
              {/* Classification Bar Chart */}
              <div className="premium-table-card" style={{ padding: "26px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                      <BarChart3 size={18} color={isDark ? "#4ade80" : "#15803d"} /> Incident Classification Breakdown
                    </h3>
                    <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600" }}>
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
                        customCanvasBackgroundColor: { color: isDark ? "#131c2e" : "#ffffff" },
                      },
                      scales: {
                        x: {
                          ticks: { color: isDark ? "#cbd5e1" : "#475569", font: { weight: "700", size: 11 } },
                          grid: { display: false },
                        },
                        y: {
                          ticks: { color: isDark ? "#94a3b8" : "#64748b", font: { weight: "600" }, precision: 0 },
                          grid: { color: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9" },
                        },
                      },
                    }}
                    plugins={[customCanvasBackgroundColor]}
                  />
                </div>
              </div>

              {/* Status Distribution Donut */}
              <div className="premium-table-card" style={{ padding: "26px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                      <PieChart size={18} color="#0284c7" /> Operational Status Distribution
                    </h3>
                    <span style={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600" }}>
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
                          labels: { color: isDark ? "#f8fafc" : "#334155", font: { weight: "700", size: 11.5 }, boxWidth: 12, padding: 14 },
                        },
                        customCanvasBackgroundColor: { color: isDark ? "#131c2e" : "#ffffff" },
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
              <div className="premium-table-card" style={{ padding: "24px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <MapPin size={17} color="#dc2626" /> Top Incident Hotspots (Barangays)
                  </h3>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: isDark ? "#f87171" : "#dc2626", backgroundColor: isDark ? "rgba(239, 68, 68, 0.16)" : "#fef2f2", padding: "2px 7px", borderRadius: "6px" }}>
                    {analytics.topAreas.length} Areas Identified
                  </span>
                </div>

                {analytics.topAreas.length === 0 ? (
                  <p style={{ color: isDark ? "#64748b" : "#94a3b8", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>No location data recorded.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {analytics.topAreas.map(([areaName, count], idx) => {
                      const pct = Math.round((count / (reports.length || 1)) * 100);
                      return (
                        <div key={areaName}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", fontSize: "13px" }}>
                            <span style={{ fontWeight: "700", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ width: "20px", height: "20px", borderRadius: "6px", backgroundColor: idx === 0 ? "#dc2626" : (isDark ? "#172338" : "#f1f5f9"), color: idx === 0 ? "#fff" : (isDark ? "#cbd5e1" : "#475569"), fontSize: "11px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: "900" }}>
                                {idx + 1}
                              </span>
                              {areaName}
                            </span>
                            <span style={{ fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a" }}>
                              {count} <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600", fontSize: "11.5px" }}>({pct}%)</span>
                            </span>
                          </div>
                          <div style={{ width: "100%", height: "6px", backgroundColor: isDark ? "#172338" : "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: idx === 0 ? "linear-gradient(90deg, #dc2626 0%, #f87171 100%)" : (isDark ? "#64748b" : "#94a3b8") }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Responders Leaderboard */}
              <div className="premium-table-card" style={{ padding: "24px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Users size={17} color={isDark ? "#4ade80" : "#15803d"} /> Top Deployed Response Units
                  </h3>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d", backgroundColor: isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4", padding: "2px 7px", borderRadius: "6px" }}>
                    Multi-Agency Telemetry
                  </span>
                </div>

                {analytics.topResponders.length === 0 ? (
                  <p style={{ color: isDark ? "#64748b" : "#94a3b8", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>No unit dispatch logs in selected range.</p>
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
                          backgroundColor: isDark ? "#172338" : "#f8fafc",
                          border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "26px", height: "26px", borderRadius: "8px", backgroundColor: "#15803d", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11.5px", fontWeight: "900" }}>
                            {idx + 1}
                          </div>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: isDark ? "#f8fafc" : "#0f172a" }}>
                            {responderName}
                          </span>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d", backgroundColor: isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4", border: isDark ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid #bbf7d0", padding: "3px 8px", borderRadius: "6px" }}>
                          {count} Dispatches
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* AUDIT LOG TABLE & SEARCH */}
            <div className="premium-table-card" style={{ padding: "24px", backgroundColor: isDark ? "#131c2e" : "#ffffff", border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0", boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.35)" : undefined }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "14px",
                  marginBottom: "18px",
                  paddingBottom: "14px",
                  borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "900", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileText size={19} color={isDark ? "#4ade80" : "#15803d"} /> Incident Telemetry Log Records
                  </h3>
                  <span style={{ fontSize: "12.5px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600" }}>
                    Showing {filteredReports.length} of {reports.length} compiled operation entries
                  </span>
                </div>

                {/* Table Search Bar */}
                <div
                  className="search-box-premium"
                  style={{
                    width: "280px",
                    backgroundColor: isDark ? "#172338" : "#ffffff",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
                  }}
                >
                  <Search size={15} color={isDark ? "#64748b" : "#94a3b8"} />
                  <input
                    type="text"
                    placeholder="Search logs by keyword, location, or unit..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    style={{ fontSize: "12.5px", color: isDark ? "#f8fafc" : "#0f172a" }}
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
                        <tr key={r.id} style={{ borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 14px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: "800",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                backgroundColor: isDark ? "#172338" : "#f8fafc",
                                color: isDark ? "#f8fafc" : "#0f172a",
                                border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #cbd5e1",
                                textTransform: "uppercase",
                              }}
                            >
                              {rawType}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: "12.5px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600", whiteSpace: "nowrap" }}>
                            {new Date(r.created).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: "12.5px", color: isDark ? "#f8fafc" : "#0f172a", fontWeight: "700", maxWidth: "260px" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                              <MapPin size={13} color={isDark ? "#4ade80" : "#15803d"} style={{ flexShrink: 0, marginTop: "2px" }} />
                              <span>{r.resolvedLocation}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: "12.5px", color: isDark ? "#cbd5e1" : "#334155", fontWeight: "600" }}>
                            {reporterName}
                          </td>
                          <td style={{ padding: "12px 14px", fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b" }}>
                            {assignedUnits}
                          </td>
                          <td style={{ padding: "12px 14px", textAlign: "center" }}>
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: "800",
                                padding: "2px 8px",
                                borderRadius: "6px",
                                backgroundColor: r.status === "resolved" ? (isDark ? "rgba(34, 197, 94, 0.16)" : "#f0fdf4") : r.status === "ongoing" ? (isDark ? "rgba(245, 158, 11, 0.16)" : "#fffbeb") : (isDark ? "rgba(239, 68, 68, 0.16)" : "#fef2f2"),
                                color: r.status === "resolved" ? (isDark ? "#4ade80" : "#15803d") : r.status === "ongoing" ? (isDark ? "#fbbf24" : "#b45309") : (isDark ? "#f87171" : "#b91c1c"),
                                border: r.status === "resolved" ? (isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0") : r.status === "ongoing" ? (isDark ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid #fde68a") : (isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #fecaca"),
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
