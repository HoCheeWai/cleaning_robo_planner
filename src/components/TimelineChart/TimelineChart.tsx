import React, { useState } from 'react';
import { RobotTimeline, ActivityType } from '../../types';
import { niceTickInterval } from '../EfficiencyGraph/graphUtils';
import styles from './TimelineChart.module.css';

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  cleaning: '#22c55e',
  traveling: '#3b82f6',
  charging: '#eab308',
  'waiting-charge': '#f97316',
  refilling: '#a855f7',
  'waiting-refill': '#ef4444',
  elevator: '#6b7280',
  idle: '#e2e8f0',
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  cleaning: 'Cleaning',
  traveling: 'Traveling',
  charging: 'Charging',
  'waiting-charge': 'Waiting (Charge)',
  refilling: 'Refilling',
  'waiting-refill': 'Waiting (Refill)',
  elevator: 'Elevator',
  idle: 'Idle',
};

interface TimelineChartProps {
  timelines: RobotTimeline[];
  totalTime: number;
}

interface TooltipInfo {
  x: number;
  y: number;
  activity: string;
  start: number;
  end: number;
  duration: number;
}

export function TimelineChart({ timelines, totalTime }: TimelineChartProps) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const numRobots = timelines.length;
  const rowHeight = 28;
  const labelWidth = 60;
  const chartPadding = { top: 30, bottom: 30, left: labelWidth + 10, right: 20 };
  const chartWidth = 700;
  const chartHeight = chartPadding.top + numRobots * rowHeight + chartPadding.bottom;
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;

  const xScale = (t: number) => chartPadding.left + (t / totalTime) * plotWidth;

  // X-axis ticks (nice round intervals)
  const xTickStep = niceTickInterval(totalTime);
  const ticks: number[] = [];
  for (let t = 0; t <= totalTime; t += xTickStep) {
    ticks.push(t);
  }
  if (ticks[ticks.length - 1] < totalTime) {
    ticks.push(ticks[ticks.length - 1] + xTickStep);
  }

  const handleMouseEnter = (e: React.MouseEvent, activity: ActivityType, start: number, end: number) => {
    setTooltip({
      x: e.clientX + 10,
      y: e.clientY - 30,
      activity: ACTIVITY_LABELS[activity],
      start,
      end,
      duration: end - start,
    });
  };

  const handleMouseLeave = () => setTooltip(null);

  return (
    <div className={styles.wrapper}>
      <svg
        className={styles.chart}
        width={chartWidth}
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label="Timeline Gantt chart showing robot activities over time"
      >
        {/* X-axis */}
        <line
          x1={chartPadding.left}
          y1={chartHeight - chartPadding.bottom}
          x2={chartWidth - chartPadding.right}
          y2={chartHeight - chartPadding.bottom}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={xScale(t)}
              y1={chartPadding.top}
              x2={xScale(t)}
              y2={chartHeight - chartPadding.bottom}
              stroke="#f1f5f9"
              strokeWidth={1}
            />
            <line
              x1={xScale(t)}
              y1={chartHeight - chartPadding.bottom}
              x2={xScale(t)}
              y2={chartHeight - chartPadding.bottom + 5}
              stroke="#94a3b8"
              strokeWidth={1}
            />
            <text
              x={xScale(t)}
              y={chartHeight - chartPadding.bottom + 16}
              textAnchor="middle"
              fontSize={10}
              fill="#64748b"
            >
              {t.toFixed(0)} min
            </text>
          </g>
        ))}

        {/* Robot rows */}
        {timelines.map((tl) => {
          const y = chartPadding.top + tl.robotIndex * rowHeight;
          return (
            <g key={tl.robotIndex}>
              {/* Label */}
              <text
                x={chartPadding.left - 8}
                y={y + rowHeight / 2 + 4}
                textAnchor="end"
                fontSize={11}
                fill="#475569"
              >
                R{tl.robotIndex + 1}
              </text>
              {/* Segments */}
              {tl.segments.map((seg, si) => {
                const sx = xScale(seg.start);
                const ex = xScale(seg.end);
                const w = Math.max(ex - sx, 0.5);
                return (
                  <rect
                    key={si}
                    x={sx}
                    y={y + 2}
                    width={w}
                    height={rowHeight - 4}
                    fill={ACTIVITY_COLORS[seg.activity]}
                    rx={2}
                    onMouseEnter={(e) => handleMouseEnter(e, seg.activity, seg.start, seg.end)}
                    onMouseLeave={handleMouseLeave}
                    style={{ cursor: 'pointer' }}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className={styles.legend}>
        {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
          <div key={key} className={styles.legendItem}>
            <span
              className={styles.legendSwatch}
              style={{ background: ACTIVITY_COLORS[key as ActivityType] }}
            />
            {label}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className={styles.tooltip} style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.activity}</strong><br />
          {tooltip.start.toFixed(1)} → {tooltip.end.toFixed(1)} min ({tooltip.duration.toFixed(1)} min)
        </div>
      )}
    </div>
  );
}
