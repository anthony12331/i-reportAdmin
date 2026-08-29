import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "../themes/ThemeContext";

export default function PremiumPagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
  onPageSizeChange,
  totalItems,
  showQuickJumper = true,
  showSizeChanger = true,
}) {
  const { isDark } = useTheme();
  const [goToVal, setGoToVal] = useState("");

  const handlePageClick = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  const handleGoToSubmit = (e) => {
    e.preventDefault();
    const pageNum = parseInt(goToVal, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setGoToVal("");
    }
  };

  // Generate page numbers with smart ellipsis (... 1 2 3 ... 10)
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
        start = 2;
        end = 4;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
        end = totalPages - 1;
      }

      if (start > 2) {
        pages.push("ellipsis-left");
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push("ellipsis-right");
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className="premium-pagination-container"
      style={{
        display: "inline-flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "10px",
        padding: "6px 14px",
        borderRadius: "999px",
        backgroundColor: isDark ? "#131c2e" : "#ffffff",
        border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #e2e8f0",
        boxShadow: isDark
          ? "0 4px 20px rgba(0, 0, 0, 0.4)"
          : "0 4px 20px rgba(0, 0, 0, 0.05)",
        userSelect: "none",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Previous Page Arrow */}
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => handlePageClick(currentPage - 1)}
        title="Previous Page"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          border: "none",
          backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9",
          color: currentPage <= 1 ? (isDark ? "#475569" : "#cbd5e1") : (isDark ? "#f8fafc" : "#334155"),
          cursor: currentPage <= 1 ? "not-allowed" : "pointer",
          transition: "all 0.15s ease",
        }}
      >
        <ChevronLeft size={16} />
      </button>

      {/* Page Numbers */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {pageNumbers.map((p, idx) => {
          if (typeof p === "string") {
            return (
              <span
                key={p + idx}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "32px",
                  color: isDark ? "#64748b" : "#94a3b8",
                  fontSize: "13px",
                  fontWeight: "700",
                }}
              >
                •••
              </span>
            );
          }

          const isActive = p === currentPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => handlePageClick(p)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "32px",
                height: "32px",
                padding: "0 6px",
                borderRadius: "50%",
                border: "none",
                fontSize: "13px",
                fontWeight: isActive ? "800" : "600",
                cursor: "pointer",
                transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                color: isActive ? "#ffffff" : (isDark ? "#cbd5e1" : "#475569"),
                background: isActive
                  ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
                  : "transparent",
                boxShadow: isActive
                  ? isDark
                    ? "0 4px 14px rgba(34, 197, 94, 0.45)"
                    : "0 4px 14px rgba(21, 128, 61, 0.35)"
                  : "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = isDark ? "rgba(255, 255, 255, 0.08)" : "#f1f5f9";
                  e.currentTarget.style.color = isDark ? "#ffffff" : "#0f172a";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = isDark ? "#cbd5e1" : "#475569";
                }
              }}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* Next Page Arrow */}
      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => handlePageClick(currentPage + 1)}
        title="Next Page"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          border: "none",
          backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9",
          color: currentPage >= totalPages ? (isDark ? "#475569" : "#cbd5e1") : (isDark ? "#f8fafc" : "#334155"),
          cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
          transition: "all 0.15s ease",
        }}
      >
        <ChevronRight size={16} />
      </button>

      {/* Page Size Changer Dropdown */}
      {showSizeChanger && onPageSizeChange && (
        <div style={{ marginLeft: "4px" }}>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{
              padding: "5px 8px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
              backgroundColor: isDark ? "#172338" : "#f1f5f9",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
              color: isDark ? "#f8fafc" : "#334155",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} / page
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Quick Jumper "Go to [input] Page" */}
      {showQuickJumper && totalPages > 1 && (
        <form
          onSubmit={handleGoToSubmit}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12.5px",
            color: isDark ? "#94a3b8" : "#64748b",
            fontWeight: "600",
            marginLeft: "6px",
          }}
        >
          <span>Go to</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            placeholder={String(currentPage)}
            value={goToVal}
            onChange={(e) => setGoToVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleGoToSubmit(e);
              }
            }}
            style={{
              width: "44px",
              height: "28px",
              padding: "0 6px",
              borderRadius: "8px",
              textAlign: "center",
              fontSize: "12px",
              fontWeight: "700",
              backgroundColor: isDark ? "#172338" : "#f1f5f9",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
              color: isDark ? "#f8fafc" : "#0f172a",
              outline: "none",
            }}
          />
          <span>Page</span>
        </form>
      )}
    </div>
  );
}
