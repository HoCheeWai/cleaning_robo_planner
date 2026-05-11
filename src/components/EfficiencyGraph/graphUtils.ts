import { EfficiencyDataPoint } from '../../types';

/**
 * Compute a nice tick interval for the x-axis.
 * Selects the smallest candidate interval that produces roughly `targetTicks` ticks.
 */
export function niceTickInterval(range: number, targetTicks: number = 8): number {
  const candidates = [1, 2, 2.5, 5, 10, 15, 20, 25, 30, 50, 60, 100, 120, 150, 200, 250, 300, 500, 1000];
  const rough = range / targetTicks;
  for (const c of candidates) {
    if (c >= rough) return c;
  }
  return candidates[candidates.length - 1];
}

/**
 * Build a step-function SVG path for utilization data.
 * Uses H (horizontal) and V (vertical) commands for discrete state changes.
 */
export function buildUtilizationPath(
  data: EfficiencyDataPoint[],
  xScale: (t: number) => number,
  yScale: (pct: number) => number
): string {
  if (data.length === 0) return '';
  return data.map((d, i) => {
    const x = xScale(d.time).toFixed(1);
    const y = yScale(d.fleet_utilization_pct).toFixed(1);
    if (i === 0) return `M ${x} ${y}`;
    return `H ${x} V ${y}`;
  }).join(' ');
}

/**
 * Build a linear-interpolation SVG path for progress data.
 * Uses L (lineTo) commands for continuous progress.
 */
export function buildProgressPath(
  data: EfficiencyDataPoint[],
  xScale: (t: number) => number,
  yScale: (pct: number) => number
): string {
  if (data.length === 0) return '';
  return data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(d.time).toFixed(1)} ${yScale(d.cumulative_progress_pct).toFixed(1)}`).join(' ');
}

/**
 * Compute x-axis ticks using nice round intervals.
 */
export function computeXTicks(totalTime: number): number[] {
  if (totalTime <= 0) return [0];
  const step = niceTickInterval(totalTime);
  const ticks: number[] = [];
  for (let t = 0; t <= totalTime; t += step) {
    ticks.push(t);
  }
  if (ticks[ticks.length - 1] < totalTime) {
    ticks.push(ticks[ticks.length - 1] + step);
  }
  return ticks;
}
