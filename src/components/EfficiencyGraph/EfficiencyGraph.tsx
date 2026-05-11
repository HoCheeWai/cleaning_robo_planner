import React, { useState } from 'react';
import { EfficiencyDataPoint } from '../../types';
import { niceTickInterval, buildUtilizationPath, buildProgressPath } from './graphUtils';
import styles from './EfficiencyGraph.module.css';

interface EfficiencyGraphProps {
  data: EfficiencyDataPoint[];
  deadPeriods: Array<{ start: number; end: number }>;
  totalTime: number;
}

interface TooltipInfo {
  x: number;
  y: number;
  time: number;
  utilization: number;
  progress: number;
}

export function EfficiencyGraph({ data, deadPeriods, totalTime }: EfficiencyGraphProps) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const chartWidth = 700;
  const chartHeight = 200;
  const padding = { top: 20, bottom: 30, left: 50, right: 50 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const xScale = (t: number) => padding.left + (t / totalTime) * plotWidth;
  const yScale = (pct: number) => padding.top + plotHeight - (pct / 100) * plotHeight;

  // Build path strings
  const utilizationPath = buildUtilizationPath(data, xScale, yScale);
  const progressPath = buildProgressPath(data, xScale, yScale);

  // Y-axis ticks
  const yTicks = [0, 25, 50, 75, 100];

  // X-axis ticks (nice round intervals)
  const xTickStep = niceTickInterval(totalTime);
  const xTicks: number[] = [];
  for (let t = 0; t <= totalTime; t += xTickStep) {
    xTicks.push(t);
  }
  if (xTicks[xTicks.length - 1] < totalTime) {
    xTicks.push(xTicks[xTicks.length - 1] + xTickStep);
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const time = ((mouseX - padding.left) / plotWidth) * totalTime;
    if (time < 0 || time > totalTime) {
      setTooltip(null);
      return;
    }
    // Find closest data point
    let closest = data[0];
    let minDist = Infinity;
    for (const d of data) {
      const dist = Math.abs(d.time - time);
      if (dist < minDist) {
        minDist = dist;
        closest = d;
      }
    }
    if (closest) {
      setTooltip({
        x: e.clientX + 10,
        y: e.clientY - 40,
        time: closest.time,
        utilization: closest.fleet_utilization_pct,
        progress: closest.cumulative_progress_pct,
      });
    }
  };

  return (
    <div className={styles.wrapper}>
      <svg
        className={styles.chart}
        width={chartWidth}
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        role="img"
        aria-label="Efficiency graph showing fleet utilization and cumulative progress over time"
      >
        {/* Dead time shading */}
        {deadPeriods.map((dp, i) => (
          <rect
            key={i}
            x={xScale(dp.start)}
            y={padding.top}
            width={xScale(dp.end) - xScale(dp.start)}
            height={plotHeight}
            fill="#fef3c7"
            opacity={0.5}
          />
        ))}

        {/* Grid lines */}
        {yTicks.map((t) => (
          <line
            key={t}
            x1={padding.left}
            y1={yScale(t)}
            x2={chartWidth - padding.right}
            y2={yScale(t)}
            stroke="#f1f5f9"
            strokeWidth={1}
          />
        ))}

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={chartHeight - padding.bottom}
          x2={chartWidth - padding.right}
          y2={chartHeight - padding.bottom}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
        {xTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={xScale(t)}
              y1={chartHeight - padding.bottom}
              x2={xScale(t)}
              y2={chartHeight - padding.bottom + 5}
              stroke="#94a3b8"
              strokeWidth={1}
            />
            <text
              x={xScale(t)}
              y={chartHeight - padding.bottom + 16}
              textAnchor="middle"
              fontSize={10}
              fill="#64748b"
            >
              {t.toFixed(0)} min
            </text>
          </g>
        ))}

        {/* Left Y-axis labels */}
        {yTicks.map((t) => (
          <text
            key={t}
            x={padding.left - 6}
            y={yScale(t) + 4}
            textAnchor="end"
            fontSize={10}
            fill="#f97316"
          >
            {t}%
          </text>
        ))}

        {/* Right Y-axis labels */}
        {yTicks.map((t) => (
          <text
            key={t}
            x={chartWidth - padding.right + 6}
            y={yScale(t) + 4}
            textAnchor="start"
            fontSize={10}
            fill="#2563eb"
          >
            {t}%
          </text>
        ))}

        {/* Utilization line */}
        {utilizationPath && (
          <path
            d={utilizationPath}
            fill="none"
            stroke="#f97316"
            strokeWidth={2}
          />
        )}

        {/* Progress line */}
        {progressPath && (
          <path
            d={progressPath}
            fill="none"
            stroke="#2563eb"
            strokeWidth={2}
            strokeDasharray="4 2"
          />
        )}
      </svg>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendLine} style={{ background: '#f97316' }} />
          Fleet Utilization %
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendLine} style={{ background: '#2563eb', borderStyle: 'dashed' }} />
          Cumulative Progress %
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendRect} style={{ background: '#fef3c7' }} />
          Dead Time Zones
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className={styles.tooltip} style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>t = {tooltip.time.toFixed(1)} min</strong><br />
          Utilization: {tooltip.utilization.toFixed(1)}%<br />
          Progress: {tooltip.progress.toFixed(1)}%
        </div>
      )}
    </div>
  );
}
