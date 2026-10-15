import { useState } from "react";
import type { FinancialPoint } from "../../../shared/financial";
import { dateLabel } from "../../api";
import { metricValue } from "./format";
export type TrendMetric =
  "arr" | "netWorth" | "revenue" | "grossMargin" | "grossMarginPercentage";
const labels: Record<TrendMetric, string> = {
  arr: "ARR",
  netWorth: "Net worth",
  revenue: "Revenue",
  grossMargin: "Gross margin",
  grossMarginPercentage: "Gross margin %",
};
export function TrendChart({
  points,
  metric,
  granularity,
}: {
  points: FinancialPoint[];
  metric: TrendMetric;
  granularity: string;
}) {
  const [selected, setSelected] = useState<number | null>(null),
    values = points.map((p) => p[metric]),
    present = values.filter((v): v is number => v !== null && v !== undefined),
    min = Math.min(0, ...present),
    max = Math.max(1, ...present),
    range = max - min,
    x = (i: number) => 65 + (i / Math.max(1, points.length - 1)) * 795,
    y = (v: number) => 205 - ((v - min) / range) * 160;
  const paths: string[] = [];
  let path = "";
  values.forEach((v, i) => {
    if (v === null || v === undefined) {
      if (path) paths.push(path);
      path = "";
    } else path += `${path ? " L" : "M"}${x(i)} ${y(v)}`;
  });
  if (path) paths.push(path);
  const index = Math.min(selected ?? points.length - 1, points.length - 1),
    point = points[index],
    unit = metric === "grossMarginPercentage" ? "PERCENT" : "USD";
  return (
    <div className="financial-chart">
      <div className="chart-readout">
        <div>
          <span>{labels[metric]}</span>
          <strong>{point ? metricValue(point[metric], unit) : "—"}</strong>
        </div>
        <p>
          {point ? dateLabel(point.date) : "No data"}
          <br />
          <small>
            {metric === "arr" || metric === "netWorth"
              ? "Point-in-time snapshot"
              : granularity === "quarterly"
                ? "Completed months within the quarter"
                : "Source measurement period"}
          </small>
        </p>
      </div>
      {!present.length ? (
        <div className="empty">
          No eligible observations for this date and knowledge cutoff.
        </div>
      ) : (
        <svg
          viewBox="0 0 900 250"
          role="img"
          aria-label={`${labels[metric]} historical ${granularity} chart`}
        >
          <defs>
            <linearGradient id="financial-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#698c71" stopOpacity=".16" />
              <stop offset="100%" stopColor="#698c71" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const v = min + range * t;
            return (
              <g key={t}>
                <line
                  x1="65"
                  x2="860"
                  y1={y(v)}
                  y2={y(v)}
                  stroke="#e8eee3"
                  strokeDasharray="3 5"
                />
                <text
                  x="53"
                  y={y(v) + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#8c9b7f"
                >
                  {unit === "USD"
                    ? new Intl.NumberFormat("en-US", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(v)
                    : `${v.toFixed(0)}%`}
                </text>
              </g>
            );
          })}
          {paths.map((d, i) => (
            <g key={i}>
              <path
                d={d}
                fill="none"
                stroke="#537e5e"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </g>
          ))}
          {points.map((p, i) => {
            const value = p[metric];
            if (value === null || value === undefined) return null;
            return (
              <g
                key={p.date}
                role="button"
                tabIndex={0}
                aria-label={`${dateLabel(p.date)}: ${metricValue(value, unit)}`}
                onMouseEnter={() => setSelected(i)}
                onFocus={() => setSelected(i)}
                onClick={() => setSelected(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSelected(i);
                }}
              >
                <circle
                  cx={x(i)}
                  cy={y(value)}
                  r={index === i ? 5 : 3}
                  fill={index === i ? "#3f6a48" : "white"}
                  stroke="#537e5e"
                  strokeWidth="1.8"
                />
                <circle cx={x(i)} cy={y(value)} r="13" fill="transparent" />
                {(i % Math.max(1, Math.floor(points.length / 5)) === 0 ||
                  i === points.length - 1) && (
                  <text
                    x={x(i)}
                    y="233"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#8c9b7f"
                  >
                    {new Date(p.date + "T12:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", year: "2-digit" },
                    )}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
