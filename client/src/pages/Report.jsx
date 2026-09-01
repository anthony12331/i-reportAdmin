import React, { useState, useRef, useMemo } from "react";
import { pb } from "../config/pocketbase";
import Sidebar from "../components/Sidebar";
import CustomDropdown from "../components/CustomDropdown";
import PremiumDateRangePicker from "../components/PremiumDateRangePicker";
import PremiumSearchBar from "../components/PremiumSearchBar";
import { useTheme } from "../themes/ThemeContext";
import { addAuditLog } from "../utils/auditLog";
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
import { getIncidentResponseTime, calculateResponseDuration } from "../utils/timeUtils";

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
  { value: "accident", label: "Vehicular Collision", icon: Car, color: "#eab308" },
  { value: "police", label: "Police & Security", icon: Shield, color: "#2563eb" },
  { value: "landslide", label: "Landslide Hazard", icon: Layers, color: "#92400e" },
  { value: "medical", label: "Medical Emergency", icon: HeartPulse, color: "#16a34a" },
];

export default function Report() {
  const { isDark } = useTheme();
  const [activePreset, setActivePreset] = useState("30days");
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
    setActivePreset(preset);
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
    setLoadingStep("Querying resolved incident records...");

    try {
      const start = new Date(startDate).toISOString().replace("T", " ");
      const end = new Date(`${endDate}T23:59:59.999Z`)
        .toISOString()
        .replace("T", " ");

      let rawData = [];
      if (reportSource === "incident") {
        let filterQuery = `status = "resolved" && updated >= "${start}" && updated <= "${end}"`;
        if (selectedIncidentType !== "ALL") {
          filterQuery += ` && type = "${selectedIncidentType}"`;
        }
        rawData = await pb.collection("incident_reports").getFullList({
          filter: filterQuery,
          sort: "-updated",
          expand: "users",
        });
      } else {
        rawData = await pb.collection("sos_tracking").getFullList({
          filter: `status = "resolved" && updated >= "${start}" && updated <= "${end}"`,
          sort: "-updated",
          expand: "user,assigned_responder",
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
      setLoadingStep("Resolving geographic coordinates & computing response times...");

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
      const areaCounter = {};
      const responderCounter = {};
      const reporterCounter = {};
      const responseTimeValues = [];

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

          // Compute response time using the resolved incident helper
          const itemWithDispatches = { ...item, dispatches: matchedDispatches };
          const responseTime = getIncidentResponseTime(itemWithDispatches);

          // Compute numeric resolution duration in minutes for averaging
          const resolvedDate = item.updated || item.resolved_at;
          let resolutionMinutes = null;
          if (item.created && resolvedDate) {
            const diffMs = new Date(resolvedDate).getTime() - new Date(item.created).getTime();
            if (diffMs > 0) {
              resolutionMinutes = Math.round(diffMs / 60000);
              responseTimeValues.push(resolutionMinutes);
            }
          }

          // Extract resolution notes from dispatches
          const resolutionNotes = matchedDispatches
            .filter((d) => d.description && d.description.trim())
            .map((d) => {
              const resp = d.expand?.responder_id;
              const name = resp ? `${resp.first_name || ""} ${resp.last_name || ""}`.trim() : d.department || "Unit";
              return `${name}: ${d.description.trim()}`;
            })
            .join(" | ");

          return {
            ...item,
            resolvedLocation,
            reporterUser,
            dispatches: matchedDispatches,
            responseTime,
            resolutionMinutes,
            resolvedDate: resolvedDate || item.updated,
            resolutionNotes,
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

      // Compute average response time
      const avgResponseMinutes = responseTimeValues.length > 0
        ? Math.round(responseTimeValues.reduce((a, b) => a + b, 0) / responseTimeValues.length)
        : 0;
      const fastestResponse = responseTimeValues.length > 0 ? Math.min(...responseTimeValues) : 0;

      setReports(processedData);
      setAnalytics({
        types: typeCounter,
        statuses: { pending: 0, ongoing: 0, resolved: processedData.length },
        topAreas,
        topResponders,
        topReporters,
        avgResponseMinutes,
        fastestResponse,
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

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("MUNICIPALITY OF LAGONGLONG - EMERGENCY OPERATIONS CENTER", 14, 11);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Official Executive Incident Analytics & Audit Dossier • Range: ${startDate} to ${endDate}`, 14, 17.5);
    doc.text(`Report Source: ${reportSource === "incident" ? "Incident Reports" : "SOS Emergency Alerts"} • Generated on ${new Date().toLocaleString()}`, 14, 22);

    // Summary Metric Box
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("EXECUTIVE PERFORMANCE INDICATORS", 14, 34);

    const summaryData = [
      ["Total Resolved Cases", reports.length.toString()],
      ["Resolution Efficiency", `100% (All ${reports.length} cases resolved)`],
      ["Average Resolution Time", analytics.avgResponseMinutes > 60 ? `${Math.floor(analytics.avgResponseMinutes / 60)}h ${analytics.avgResponseMinutes % 60}m per case` : `${analytics.avgResponseMinutes} minutes per case`],
      ["Fastest Resolution", analytics.fastestResponse > 60 ? `${Math.floor(analytics.fastestResponse / 60)}h ${analytics.fastestResponse % 60}m` : `${analytics.fastestResponse} minutes`],
      ["Primary Incident Driver", `${primaryIncidentType.name} (${primaryIncidentType.count} cases / ${primaryIncidentType.pct}%)`],
    ];

    autoTable(doc, {
      startY: 38,
      head: [["Operational Indicator", "Telemetry Metric"]],
      body: summaryData,
      theme: "grid",
      headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 2.2 },
      margin: { left: 14, right: 14 },
    });

    // Capture Charts and place with dynamic offset after summary table
    const summaryTableEndY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 88;
    const typeImg = typeChartRef.current?.toBase64Image("image/png", 1.0);
    const statusImg = statusChartRef.current?.toBase64Image("image/png", 1.0);

    if (typeImg && statusImg) {
      const chartHeaderY = summaryTableEndY + 10;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("INCIDENT CLASSIFICATION & STATUS BREAKDOWN", 14, chartHeaderY);

      // Printable width = 182mm (14mm left/right margin)
      const chartTopY = chartHeaderY + 4;
      doc.addImage(typeImg, "PNG", 14, chartTopY, 110, 60);
      doc.addImage(statusImg, "PNG", 128, chartTopY, 68, 60);
    }

    doc.addPage();
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("INCIDENT LOG AUDIT RECORDS", 14, 16);

    const tableHeaders = [
      "Classification",
      "Reported",
      "Resolved",
      "Response Time",
      "Location",
      "Reporter",
      "Assigned Units",
      "Resolution Notes",
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
        rawType.toUpperCase(),
        new Date(r.created).toLocaleDateString([], {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        r.resolvedDate ? new Date(r.resolvedDate).toLocaleDateString([], {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) : "N/A",
        r.responseTime || "N/A",
        r.resolvedLocation || "N/A",
        reporterName,
        unit,
        r.resolutionNotes ? (r.resolutionNotes.length > 80 ? r.resolutionNotes.substring(0, 80) + "..." : r.resolutionNotes) : "—",
      ];
    });

    autoTable(doc, {
      startY: 21,
      head: [tableHeaders],
      body: tableRows,
      theme: "striped",
      headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      styles: { fontSize: 6.5, cellPadding: 1.8 },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 22 },
        2: { cellWidth: 22 },
        3: { cellWidth: 16 },
        4: { cellWidth: 28 },
        5: { cellWidth: 22 },
        6: { cellWidth: 22 },
        7: { cellWidth: 32 },
      },
      margin: { left: 14, right: 14 },
    });

    // Signature Block with page overflow protection
    let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 14 : 220;
    if (finalY + 28 > 275) {
      doc.addPage();
      finalY = 25;
    }

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("VERIFIED & AUDITED BY:", 14, finalY);
    doc.setDrawColor(148, 163, 184);
    doc.line(14, finalY + 12, 74, finalY + 12);
    doc.setFont("helvetica", "normal");
    doc.text("MDRRMO Lead Operations Officer", 14, finalY + 17);

    doc.setFont("helvetica", "bold");
    doc.text("NOTED BY:", 130, finalY);
    doc.line(130, finalY + 12, 190, finalY + 12);
    doc.setFont("helvetica", "normal");
    doc.text("Municipal Mayor / DRRMC Chairman", 130, finalY + 17);

    // Page numbers footer on all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Municipality of Lagonglong MDRRMO • Executive Incident Dossier • Page ${i} of ${totalPages}`,
        105,
        290,
        { align: "center" }
      );
    }

    doc.save(`MDRRMO_Executive_Report_${startDate}_to_${endDate}.pdf`);

    addAuditLog({
      action: "EXECUTIVE_REPORT_EXPORTED",
      target: `Dossier (${reportSource === "incident" ? "Incident Reports" : "SOS Distress Alerts"})`,
      details: `Exported official PDF Executive Analytics Dossier covering ${startDate} to ${endDate} (${reports.length} records analyzed).`,
      actor: pb.authStore.model?.username || "Admin",
    });
  };

  const customCanvasBackgroundColor = {
    id: "customCanvasBackgroundColor",
    beforeDraw: (chart, args, options) => {
      const { ctx } = chart;
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = options.color || (isDark ? "#131c2e" : "#ffffff");
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


  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: isDark ? "#090d16" : "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
              <span style={{
                fontSize: "11.5px",
                fontWeight: "900",
                color: isDark ? "#4ade80" : "#15803d",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4",
                border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0",
                padding: "3px 9px",
                borderRadius: "6px"
              }}>
                Lagonglong MDRRMO Intelligence & Audit
              </span>
            </div>
            <h1 style={{ fontSize: "clamp(24px, 3.2vw, 32px)", fontWeight: "900", color: isDark ? "#f8fafc" : "#0f172a", margin: 0, letterSpacing: "-0.03em" }}>
              Incident Reports & Analytics
            </h1>
            <p style={{ margin: "6px 0 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: "14px", fontWeight: "500" }}>
              View emergency charts, incident statistics, barangay summaries, and download PDF or Excel reports.
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
              <span>Export PDF Report</span>
            </button>
          )}
        </header>

        {/* TACTICAL FILTER & CONTROL RIBBON */}
        <div
          className="premium-table-card"
          style={{
            position: "relative",
            zIndex: 100,
            padding: "24px",
            marginBottom: "28px",
            borderTop: isDark ? "4px solid #4ade80" : "4px solid #15803d",
            backgroundColor: isDark ? "#131c2e" : "#ffffff",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
            boxShadow: isDark ? "0 4px 20px -2px rgba(0, 0, 0, 0.5)" : "0 4px 20px -2px rgba(15, 23, 42, 0.06)",
          }}
        >
          {/* Top Source Selector Toolbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px",
              paddingBottom: "16px",
              borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9",
              marginBottom: "18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Filter size={16} color={isDark ? "#4ade80" : "#15803d"} />
              <span style={{ fontSize: "13.5px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a" }}>
                Filter Parameters
              </span>
            </div>

            {/* Source Segmented Toggle */}
            <div
              style={{
                display: "inline-flex",
                backgroundColor: isDark ? "#172338" : "#f1f5f9",
                borderRadius: "10px",
                padding: "3px",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #e2e8f0",
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
                  backgroundColor: reportSource === "incident" ? (isDark ? "#1e293b" : "#ffffff") : "transparent",
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
                  backgroundColor: reportSource === "sos" ? (isDark ? "#1e293b" : "#ffffff") : "transparent",
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
            className="report-filter-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
              gap: "16px",
              alignItems: "flex-end",
            }}
          >
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: "800", color: isDark ? "#cbd5e1" : "#334155", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                <Calendar size={13} color={isDark ? "#4ade80" : "#15803d"} /> Analytics Date Range
              </label>
              <PremiumDateRangePicker
                startDate={startDate}
                endDate={endDate}
                align="left"
                onChange={({ startDate: s, endDate: e }) => {
                  setStartDate(s);
                  setEndDate(e);
                  setActivePreset(null);
                }}
                onClear={() => {
                  setStartDate("");
                  setEndDate("");
                  setActivePreset(null);
                }}
                placeholder="Select Date Range"
              />
            </div>

            {reportSource === "incident" && (
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: "800", color: isDark ? "#cbd5e1" : "#334155", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
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
                  transition: "all 0.15s ease",
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
              <div style={{ width: "100%", height: "6px", backgroundColor: isDark ? "#1e293b" : "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
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
                  borderLeft: isDark ? "6px solid #4ade80" : "6px solid #0f172a",
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
                <div style={{ width: "100%", height: "5px", backgroundColor: isDark ? "rgba(34, 197, 94, 0.15)" : "#f0fdf4", borderRadius: "999px", marginTop: "12px", overflow: "hidden" }}>
                  <div style={{ width: `${resolutionRate}%`, height: "100%", backgroundColor: isDark ? "#4ade80" : "#15803d" }} />
                </div>
              </div>

              {/* Average Response Time Card */}
              <div
                className="premium-table-card"
                style={{
                  padding: "22px 24px",
                  borderLeft: "6px solid #0284c7",
                  backgroundColor: isDark ? "#131c2e" : "#ffffff",
                }}
              >
                <span style={{ fontSize: "11.5px", fontWeight: "800", color: isDark ? "#38bdf8" : "#0284c7", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Clock size={14} color={isDark ? "#38bdf8" : "#0284c7"} /> Avg Resolution Time
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "10px" }}>
                  <h2 style={{ fontSize: "38px", fontWeight: "900", color: isDark ? "#38bdf8" : "#0284c7", margin: 0, letterSpacing: "-0.03em" }}>
                    {analytics.avgResponseMinutes > 60 ? `${Math.floor(analytics.avgResponseMinutes / 60)}h ${analytics.avgResponseMinutes % 60}m` : `${analytics.avgResponseMinutes}m`}
                  </h2>
                  <span style={{ fontSize: "12.5px", fontWeight: "700", color: isDark ? "#7dd3fc" : "#0369a1" }}>per case</span>
                </div>
                <div style={{ marginTop: "12px", fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600" }}>
                  Fastest: {analytics.fastestResponse > 60 ? `${Math.floor(analytics.fastestResponse / 60)}h ${analytics.fastestResponse % 60}m` : `${analytics.fastestResponse}m`}
                </div>
              </div>

              {/* Leading Incident Driver */}
              <div
                className="premium-table-card"
                style={{
                  padding: "22px 24px",
                  borderLeft: "6px solid #dc2626",
                  backgroundColor: isDark ? "#131c2e" : "#ffffff",
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
                <div style={{ marginTop: "12px", fontSize: "12px", color: isDark ? "#fca5a5" : "#b91c1c", fontWeight: "800" }}>
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
                          ticks: { color: isDark ? "#94a3b8" : "#475569", font: { weight: "700", size: 11 } },
                          grid: { display: false },
                        },
                        y: {
                          ticks: { color: isDark ? "#94a3b8" : "#64748b", font: { weight: "600" }, precision: 0 },
                          grid: { color: isDark ? "rgba(255, 255, 255, 0.08)" : "#f1f5f9" },
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
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                      <PieChart size={18} color={isDark ? "#38bdf8" : "#0284c7"} /> Operational Status Distribution
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
              <div className="premium-table-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <MapPin size={17} color={isDark ? "#f87171" : "#dc2626"} /> Top Incident Hotspots (Barangays)
                  </h3>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: isDark ? "#f87171" : "#dc2626", backgroundColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fef2f2", padding: "2px 7px", borderRadius: "6px" }}>
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
                              <span style={{ width: "20px", height: "20px", borderRadius: "6px", backgroundColor: idx === 0 ? "#dc2626" : (isDark ? "#1e293b" : "#f1f5f9"), color: idx === 0 ? "#fff" : (isDark ? "#cbd5e1" : "#475569"), fontSize: "11px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: "900" }}>
                                {idx + 1}
                              </span>
                              {areaName}
                            </span>
                            <span style={{ fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a" }}>
                              {count} <span style={{ color: isDark ? "#94a3b8" : "#64748b", fontWeight: "600", fontSize: "11.5px" }}>({pct}%)</span>
                            </span>
                          </div>
                          <div style={{ width: "100%", height: "6px", backgroundColor: isDark ? "#1e293b" : "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: idx === 0 ? "linear-gradient(90deg, #dc2626 0%, #f87171 100%)" : (isDark ? "#475569" : "#94a3b8") }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Responders Leaderboard */}
              <div className="premium-table-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid #f1f5f9", marginBottom: "16px" }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: isDark ? "#f8fafc" : "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Users size={17} color={isDark ? "#4ade80" : "#15803d"} /> Top Deployed Response Units
                  </h3>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d", backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4", padding: "2px 7px", borderRadius: "6px" }}>
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
                          <div style={{ width: "26px", height: "26px", borderRadius: "8px", backgroundColor: isDark ? "#166534" : "#15803d", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11.5px", fontWeight: "900" }}>
                            {idx + 1}
                          </div>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: isDark ? "#f8fafc" : "#0f172a" }}>
                            {responderName}
                          </span>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: "800", color: isDark ? "#4ade80" : "#15803d", backgroundColor: isDark ? "rgba(34, 197, 94, 0.18)" : "#f0fdf4", border: isDark ? "1px solid rgba(34, 197, 94, 0.35)" : "1px solid #bbf7d0", padding: "3px 8px", borderRadius: "6px" }}>
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
                <PremiumSearchBar
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  onClear={() => setTableSearch("")}
                  placeholder="Search logs by keyword, location, or unit..."
                  expandedWidth="300px"
                />
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="premium-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "12px 14px", backgroundColor: isDark ? "#14532d" : "#15803d", color: "#ffffff", fontSize: "12px", fontWeight: "800", borderRadius: "10px 0 0 0" }}>
                        Classification
                      </th>
                      <th style={{ textAlign: "left", padding: "12px 14px", backgroundColor: isDark ? "#14532d" : "#15803d", color: "#ffffff", fontSize: "12px", fontWeight: "800" }}>
                        Date Reported
                      </th>
                      <th style={{ textAlign: "left", padding: "12px 14px", backgroundColor: isDark ? "#14532d" : "#15803d", color: "#ffffff", fontSize: "12px", fontWeight: "800" }}>
                        Date Resolved
                      </th>
                      <th style={{ textAlign: "center", padding: "12px 14px", backgroundColor: isDark ? "#14532d" : "#15803d", color: "#ffffff", fontSize: "12px", fontWeight: "800" }}>
                        Response Time
                      </th>
                      <th style={{ textAlign: "left", padding: "12px 14px", backgroundColor: isDark ? "#14532d" : "#15803d", color: "#ffffff", fontSize: "12px", fontWeight: "800" }}>
                        Location
                      </th>
                      <th style={{ textAlign: "left", padding: "12px 14px", backgroundColor: isDark ? "#14532d" : "#15803d", color: "#ffffff", fontSize: "12px", fontWeight: "800" }}>
                        Reporter
                      </th>
                      <th style={{ textAlign: "left", padding: "12px 14px", backgroundColor: isDark ? "#14532d" : "#15803d", color: "#ffffff", fontSize: "12px", fontWeight: "800", borderRadius: "0 10px 0 0" }}>
                        Assigned Units
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
                                backgroundColor: isDark ? "#1e293b" : "#f8fafc",
                                color: isDark ? "#f8fafc" : "#0f172a",
                                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
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
                          <td style={{ padding: "12px 14px", fontSize: "12.5px", color: isDark ? "#4ade80" : "#15803d", fontWeight: "700", whiteSpace: "nowrap" }}>
                            {r.resolvedDate ? new Date(r.resolvedDate).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }) : "N/A"}
                          </td>
                          <td style={{ padding: "12px 14px", textAlign: "center" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: "800",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                backgroundColor: isDark ? "rgba(2, 132, 199, 0.2)" : "#f0f9ff",
                                color: isDark ? "#38bdf8" : "#0284c7",
                                border: isDark ? "1px solid rgba(56, 189, 248, 0.35)" : "1px solid #bae6fd",
                              }}
                            >
                              {r.responseTime || "N/A"}
                            </span>
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
