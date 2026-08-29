import React from "react";
import MetricCardHolder from "./MetricCardHolder";

export default function SummaryCard({ title, val, icon, accent, urgent, onClick, subtitle, trend }) {
  // Map legacy accent string to variant
  let variant = "emerald";
  if (accent === "red" || urgent) variant = "red";
  else if (accent === "amber" || accent === "orange" || accent === "yellow") variant = "amber";
  else if (accent === "blue" || accent === "sky") variant = "sky";
  else if (accent === "purple" || accent === "violet") variant = "purple";
  else if (accent === "gray" || accent === "slate") variant = "slate";

  return (
    <MetricCardHolder
      title={title}
      value={val}
      icon={icon}
      variant={variant}
      urgent={urgent}
      onClick={onClick}
      subtitle={subtitle}
      trend={trend}
    />
  );
}
