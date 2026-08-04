import { useState, useRef } from "react";
import { pb } from "./pocketbase";
import Sidebar from "./Sidebar";
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
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getReadableAddress } from "./utils";

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
import { Bar, Pie } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function Report() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Data States
  const [reports, setReports] = useState([]);
  const [analytics, setAnalytics] = useState({
    types: {},
    statuses: { pending: 0, ongoing: 0, resolved: 0 },
    topAreas: [],
    topResponders: [],
    topReporters: [],
  });

  // Chart Refs
  const typeChartRef = useRef(null);
  const statusChartRef = useRef(null);
  const areaChartRef = useRef(null);
  const responderChartRef = useRef(null);

  const fetchAnalyticsData = async () => {
    if (!startDate || !endDate) {
      alert("Please select both start and end dates.");
      return;
    }

    setIsLoading(true);
    setIsDataLoaded(false);
    setLoadingProgress(5);

    try {
      // PocketBase Date Filter Formatting
      const start = new Date(startDate).toISOString().replace("T", " ");
      const end = new Date(`${endDate}T23:59:59.999Z`)
        .toISOString()
        .replace("T", " ");

      // Fetch incident_reports expanding related auth collections
      const rawData = await pb.collection("incident_reports").getFullList({
        filter: `created >= "${start}" && created <= "${end}"`,
        sort: "-created",
        expand: "users,responders",
      });

      if (rawData.length === 0) {
        alert("No incident reports found for this time period.");
        setIsLoading(false);
        setLoadingProgress(0);
        return;
      }

      setLoadingProgress(15);

      const addressCache = {};
      let completedGeocodes = 0;
      const totalToGeocode = rawData.length;

      // Location Resolution with Schema-based Fallback
      const processedData = await Promise.all(
        rawData.map(async (item) => {
          let locationStr = "";

          // 1. Geocoding lookup via coordinates
          if (item.latitude && item.longitude) {
            const coordKey = `${item.latitude},${item.longitude}`;

            if (!addressCache[coordKey]) {
              try {
                const address = await getReadableAddress(
                  item.latitude,
                  item.longitude,
                  "barangay"
                );
                addressCache[coordKey] = address || null;
              } catch {
                addressCache[coordKey] = null;
              }
            }
            locationStr = addressCache[coordKey] || "";
          }

          // 2. Database Schema Fallback to User Record Location Fields
          if (
            !locationStr ||
            locationStr === "Coordinates Error" ||
            locationStr === "Unknown Location"
          ) {
            const userBgry = item.expand?.users?.baranggay;
            const userMuni = item.expand?.users?.municipality;

            if (userBgry && userMuni) {
              locationStr = `Brgy. ${userBgry}, ${userMuni}`;
            } else if (userBgry) {
              locationStr = `Brgy. ${userBgry}`;
            } else {
              locationStr = "Lagonglong Area (Unspecified)";
            }
          }

          completedGeocodes++;
          const currentPercentage =
            15 + Math.round((completedGeocodes / totalToGeocode) * 80);
          setLoadingProgress(currentPercentage);

          return { ...item, resolvedLocation: locationStr };
        })
      );

      // Aggregation Engine reflecting PocketBase Select Enums
      const typeCounts = {
        FIRE: 0,
        ACCIDENT: 0,
        LANDSLIDE: 0,
        POLICE: 0,
        OTHER: 0,
      };

      const statusCounts = { pending: 0, ongoing: 0, resolved: 0 };
      const areaCounts = {};
      const responderCounts = {};
      const reporterCounts = {};

      processedData.forEach((item) => {
        // 1. Incident Type Counting
        const rawType = (item.type || "OTHER").toUpperCase().trim();
        if (Object.prototype.hasOwnProperty.call(typeCounts, rawType)) {
          typeCounts[rawType]++;
        } else {
          typeCounts["OTHER"] = (typeCounts["OTHER"] || 0) + 1;
        }

        // 2. Status Categorization
        const rawStatus = (item.status || "").toLowerCase().trim();
        if (rawStatus === "resolved") {
          statusCounts.resolved++;
        } else if (rawStatus === "pending") {
          statusCounts.pending++;
        } else {
          statusCounts.ongoing++;
        }

        // 3. Location Hotspots
        const area = item.resolvedLocation;
        areaCounts[area] = (areaCounts[area] || 0) + 1;

        // 4. Responder Deployments
        const responderObj = item.expand?.responders;
        let responderName = "Unassigned Unit";

        if (responderObj) {
          if (responderObj.unit_name) {
            responderName = responderObj.department
              ? `${responderObj.unit_name} (${responderObj.department.toUpperCase()})`
              : responderObj.unit_name;
          } else if (responderObj.department) {
            responderName = `${responderObj.department.toUpperCase()} Unit`;
          } else if (responderObj.first_name || responderObj.last_name) {
            responderName = `${responderObj.first_name || ""} ${
              responderObj.last_name || ""
            }`.trim();
          }
        }
        responderCounts[responderName] =
          (responderCounts[responderName] || 0) + 1;

        // 5. Reporter Contributions
        const userObj = item.expand?.users;
        let reporterName = "Anonymous";

        if (userObj) {
          const fullName = `${userObj.first_name || ""} ${
            userObj.last_name || ""
          }`.trim();
          reporterName =
            fullName || userObj.contact_number || "Registered Citizen";
        }
        reporterCounts[reporterName] = (reporterCounts[reporterName] || 0) + 1;
      });

      const getTop = (obj, limit = 5) => {
        return Object.entries(obj)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit);
      };

      // Filter out zero-count categories for cleaner UI charts
      const activeTypeCounts = Object.fromEntries(
        Object.entries(typeCounts).filter(([, count]) => count > 0)
      );

      setReports(processedData);
      setAnalytics({
        types: activeTypeCounts,
        statuses: statusCounts,
        topAreas: getTop(areaCounts, 5),
        topResponders: getTop(responderCounts, 5),
        topReporters: getTop(reporterCounts, 8),
      });

      setLoadingProgress(100);
      setTimeout(() => {
        setIsDataLoaded(true);
        setIsLoading(false);
      }, 300);
    } catch (error) {
      console.error("Database telemetry read error:", error);
      alert("Failed to read parameters from PocketBase.");
      setIsLoading(false);
      setLoadingProgress(0);
    }
  };

  const generatePDFReport = () => {
    const doc = new jsPDF("p", "mm", "a4");

    // Header Branding
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 35, "F");

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("LAGONGLONG DRRMO COMMAND CENTER", 14, 16);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("Official Operations & Telemetry Audit Report", 14, 24);

    // Summary Box
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Date Range: ${startDate} to ${endDate}`, 14, 44);
    doc.text(`Total Incidents Processed: ${reports.length}`, 14, 50);
    doc.text(
      `Active Dispatches (Ongoing): ${analytics.statuses.ongoing}`,
      110,
      44
    );
    doc.text(
      `Resolved Emergency Cases: ${analytics.statuses.resolved}`,
      110,
      50
    );

    // Render Canvas Charts
    const typeImg = typeChartRef.current?.toBase64Image();
    const statusImg = statusChartRef.current?.toBase64Image();

    if (typeImg && statusImg) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Visual Classification & Response Distribution", 14, 62);

      doc.addImage(typeImg, "PNG", 14, 68, 90, 50);
      doc.addImage(statusImg, "PNG", 110, 68, 85, 50);
    }

    // Page 2: Detailed Table Logs
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Incident Log Entries Audit Table", 14, 16);

    const tableHeaders = [
      "Timestamp",
      "Incident Location",
      "Type",
      "Status",
      "Assigned Unit",
      "Reporter",
    ];

    const tableRows = reports.map((r) => {
      const unit =
        r.expand?.responders?.unit_name ||
        (r.expand?.responders?.department
          ? `${r.expand.responders.department.toUpperCase()} Dept`
          : "Unassigned");

      const reporterName = r.expand?.users
        ? `${r.expand.users.first_name || ""} ${
            r.expand.users.last_name || ""
          }`.trim() ||
          r.expand.users.contact_number ||
          "Registered Citizen"
        : "Anonymous";

      return [
        new Date(r.created).toLocaleDateString([], {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        r.resolvedLocation,
        (r.type || "OTHER").toUpperCase(),
        (r.status || "UNKNOWN").toUpperCase().replace("_", " "),
        unit,
        reporterName,
      ];
    });

    autoTable(doc, {
      startY: 22,
      head: [tableHeaders],
      body: tableRows,
      theme: "striped",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
    });

    doc.save(`DRRMO_Report_${startDate}_to_${endDate}.pdf`);
  };

  const darkChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: "#cbd5e1", font: { weight: "700", size: 11 } },
      },
    },
    scales: {
      x: {
        ticks: { color: "#94a3b8", font: { weight: "600" } },
        grid: { color: "#334155" },
      },
      y: {
        ticks: { color: "#94a3b8", font: { weight: "600" } },
        grid: { color: "#334155" },
      },
    },
  };

  const horizontalBarOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { color: "#94a3b8", font: { weight: "600" } },
        grid: { color: "#334155" },
      },
      y: {
        ticks: { color: "#cbd5e1", font: { weight: "700" } },
        grid: { color: "#334155" },
      },
    },
  };

  const typeChartData = {
    labels: Object.keys(analytics.types),
    datasets: [
      {
        label: "Incidents Captured",
        data: Object.values(analytics.types),
        backgroundColor: ["#ef4444", "#f97316", "#a855f7", "#38bdf8", "#10b981"],
      },
    ],
  };

  const statusChartData = {
    labels: ["Pending Queue", "Active Dispatches", "Resolved"],
    datasets: [
      {
        data: [
          analytics.statuses.pending,
          analytics.statuses.ongoing,
          analytics.statuses.resolved,
        ],
        backgroundColor: ["#ef4444", "#f59e0b", "#10b981"],
      },
    ],
  };

  const areaChartData = {
    labels: analytics.topAreas.map((item) => item[0]),
    datasets: [
      {
        label: "Incident Hotspots",
        data: analytics.topAreas.map((item) => item[1]),
        backgroundColor: "#f43f5e",
      },
    ],
  };

  const responderChartData = {
    labels: analytics.topResponders.map((item) => item[0]),
    datasets: [
      {
        label: "Deployments",
        data: analytics.topResponders.map((item) => item[1]),
        backgroundColor: "#a855f7",
      },
    ],
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#0b0f19",
        color: "#f8fafc",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <Sidebar />

      <main style={{ flex: 1, padding: "32px", marginLeft: "260px" }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "28px",
            paddingBottom: "20px",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "#a855f7",
                  boxShadow: "0 0 12px #a855f7",
                }}
              />
              <h1
                style={{
                  fontSize: "28px",
                  fontWeight: "900",
                  letterSpacing: "-0.5px",
                  color: "#ffffff",
                  margin: 0,
                }}
              >
                OPERATIONS ANALYTICS & AUDIT RECORDS
              </h1>
            </div>
            <p
              style={{
                color: "#94a3b8",
                fontSize: "14px",
                margin: "6px 0 0 24px",
                fontWeight: "500",
              }}
            >
              Generate telemetry metrics, hotspot maps, and export DRRMO audit forms
            </p>
          </div>
        </header>

        {/* Date Filter Bar */}
        <div
          style={{
            backgroundColor: "#1e293b",
            padding: "20px",
            borderRadius: "16px",
            border: "1px solid #334155",
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "28px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
            <label
              style={{
                fontSize: "12px",
                fontWeight: "800",
                color: "#94a3b8",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Calendar size={14} color="#38bdf8" /> START DATE
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #334155",
                backgroundColor: "#0f172a",
                color: "#f8fafc",
                fontSize: "13px",
                fontWeight: "600",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
            <label
              style={{
                fontSize: "12px",
                fontWeight: "800",
                color: "#94a3b8",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Calendar size={14} color="#38bdf8" /> END DATE
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #334155",
                backgroundColor: "#0f172a",
                color: "#f8fafc",
                fontSize: "13px",
                fontWeight: "600",
                outline: "none",
              }}
            />
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              onClick={fetchAnalyticsData}
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "11px 20px",
                backgroundColor: "#38bdf8",
                color: "#0f172a",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontWeight: "900",
                fontSize: "13px",
                minHeight: "42px",
              }}
            >
              {isLoading ? (
                <Loader className="animate-spin" size={18} />
              ) : (
                <BarChart3 size={18} />
              )}
              {isLoading
                ? `COMPILING TELEMETRY... ${loadingProgress}%`
                : "GENERATE ANALYTICS"}
            </button>

            {isLoading && (
              <div
                style={{
                  width: "100%",
                  height: "6px",
                  backgroundColor: "#0f172a",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    backgroundColor: "#38bdf8",
                    width: `${loadingProgress}%`,
                    transition: "width 0.2s ease-in-out",
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Telemetry Stats & Charts */}
        {isDataLoaded && (
          <div>
            {/* Top Key Metrics Banner */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#1e293b",
                  padding: "16px 20px",
                  borderRadius: "14px",
                  border: "1px solid #334155",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#94a3b8" }}>
                  TOTAL LOGGED
                </span>
                <h2 style={{ margin: "4px 0 0 0", fontSize: "24px", color: "#f8fafc" }}>
                  {reports.length}
                </h2>
              </div>

              <div
                style={{
                  backgroundColor: "#1e293b",
                  padding: "16px 20px",
                  borderRadius: "14px",
                  border: "1px solid #f59e0b",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#fbbf24" }}>
                  ACTIVE DISPATCHES (ONGOING)
                </span>
                <h2 style={{ margin: "4px 0 0 0", fontSize: "24px", color: "#fbbf24" }}>
                  {analytics.statuses.ongoing}
                </h2>
              </div>

              <div
                style={{
                  backgroundColor: "#1e293b",
                  padding: "16px 20px",
                  borderRadius: "14px",
                  border: "1px solid #10b981",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#34d399" }}>
                  RESOLVED EMERGENCIES
                </span>
                <h2 style={{ margin: "4px 0 0 0", fontSize: "24px", color: "#34d399" }}>
                  {analytics.statuses.resolved}
                </h2>
              </div>

              <div
                style={{
                  backgroundColor: "#1e293b",
                  padding: "16px 20px",
                  borderRadius: "14px",
                  border: "1px solid #ef4444",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#f87171" }}>
                  PENDING QUEUE
                </span>
                <h2 style={{ margin: "4px 0 0 0", fontSize: "24px", color: "#f87171" }}>
                  {analytics.statuses.pending}
                </h2>
              </div>
            </div>

            {/* Dashboard Action Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: "900",
                  color: "#f8fafc",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <CheckCircle2 size={20} color="#10b981" /> VISUAL OPERATIONS SUMMARY
              </h2>

              <button
                onClick={generatePDFReport}
                style={{
                  padding: "10px 18px",
                  backgroundColor: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontWeight: "900",
                  fontSize: "13px",
                }}
              >
                <Download size={16} /> EXPORT PDF REPORT
              </button>
            </div>

            {/* Top Charts Row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: "20px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#1e293b",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid #334155",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "14px",
                    fontWeight: "800",
                    color: "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <ShieldAlert size={18} color="#f87171" /> CLASSIFICATION BREAKDOWN
                </h3>
                <div style={{ maxHeight: "280px", position: "relative" }}>
                  <Bar
                    ref={typeChartRef}
                    data={typeChartData}
                    options={darkChartOptions}
                  />
                </div>
              </div>

              <div
                style={{
                  backgroundColor: "#1e293b",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid #334155",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "14px",
                    fontWeight: "800",
                    color: "#f8fafc",
                  }}
                >
                  RESPONSE LIFECYCLE
                </h3>
                <div
                  style={{
                    maxHeight: "280px",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <Pie
                    ref={statusChartRef}
                    data={statusChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          labels: {
                            color: "#cbd5e1",
                            font: { weight: "700", size: 11 },
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Middle Charts Row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#1e293b",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid #334155",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "14px",
                    fontWeight: "800",
                    color: "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <MapPin size={18} color="#f43f5e" /> TOP INCIDENT HOTSPOTS
                </h3>
                <div style={{ height: "220px", position: "relative" }}>
                  <Bar
                    ref={areaChartRef}
                    data={areaChartData}
                    options={horizontalBarOptions}
                  />
                </div>
              </div>

              <div
                style={{
                  backgroundColor: "#1e293b",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid #334155",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "14px",
                    fontWeight: "800",
                    color: "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <TrendingUp size={18} color="#a855f7" /> RESPONDER UNIT DEPLOYMENTS
                </h3>
                <div style={{ height: "220px", position: "relative" }}>
                  <Bar
                    ref={responderChartRef}
                    data={responderChartData}
                    options={horizontalBarOptions}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Row: Active Reporters & Log Table */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr",
                gap: "20px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#1e293b",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid #334155",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "14px",
                    fontWeight: "800",
                    color: "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Users size={18} color="#38bdf8" /> MOST ACTIVE REPORTERS
                </h3>
                <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
                  {analytics.topReporters.map((reporter, index) => (
                    <li
                      key={index}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 0",
                        borderBottom: "1px solid #334155",
                      }}
                    >
                      <span style={{ fontWeight: "700", color: "#f8fafc", fontSize: "13px" }}>
                        {reporter[0]}
                      </span>
                      <span
                        style={{
                          backgroundColor: "rgba(56, 189, 248, 0.15)",
                          color: "#38bdf8",
                          padding: "4px 10px",
                          borderRadius: "10px",
                          fontSize: "11px",
                          fontWeight: "800",
                          border: "1px solid #38bdf8",
                        }}
                      >
                        {reporter[1]} Reports
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div
                style={{
                  backgroundColor: "#1e293b",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid #334155",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "14px",
                    fontWeight: "800",
                    color: "#f8fafc",
                  }}
                >
                  RECENT LOG ENTRIES AUDIT
                </h3>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: "2px solid #334155",
                        textAlign: "left",
                        color: "#94a3b8",
                        fontSize: "11px",
                        fontWeight: "800",
                        textTransform: "uppercase",
                      }}
                    >
                      <th style={{ padding: "8px" }}>Type</th>
                      <th>Incident Location</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.slice(0, 5).map((r) => (
                      <tr key={r.id} style={{ borderBottom: "1px solid #334155" }}>
                        <td
                          style={{
                            padding: "12px 8px",
                            fontWeight: "800",
                            color: "#f8fafc",
                            fontSize: "13px",
                          }}
                        >
                          {(r.type || "OTHER").toUpperCase()}
                        </td>
                        <td style={{ fontSize: "12px", color: "#cbd5e1" }}>
                          {r.resolvedLocation}
                        </td>
                        <td>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: "800",
                              backgroundColor:
                                r.status?.toLowerCase() === "resolved"
                                  ? "rgba(16, 185, 129, 0.15)"
                                  : r.status?.toLowerCase() === "pending"
                                  ? "rgba(239, 68, 68, 0.15)"
                                  : "rgba(245, 158, 11, 0.15)",
                              color:
                                r.status?.toLowerCase() === "resolved"
                                  ? "#34d399"
                                  : r.status?.toLowerCase() === "pending"
                                  ? "#f87171"
                                  : "#fbbf24",
                              border: `1px solid ${
                                r.status?.toLowerCase() === "resolved"
                                  ? "#10b981"
                                  : r.status?.toLowerCase() === "pending"
                                  ? "#ef4444"
                                  : "#f59e0b"
                              }`,
                            }}
                          >
                            {(r.status || "UNKNOWN").toUpperCase().replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
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