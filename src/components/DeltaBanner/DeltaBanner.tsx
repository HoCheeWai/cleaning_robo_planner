import { CalculationResult } from '../../types';
import styles from './DeltaBanner.module.css';

export interface DeltaMetrics {
  modeChanged: boolean;
  totalElapsedTime?: { old: number; new: number; delta: number; pctChange: number };
  numRobots?: { old: number; new: number; delta: number };
  deadTimeMinutes?: { old: number; new: number; delta: number; pctChange: number };
}

/**
 * Compute delta metrics between a previous and current CalculationResult.
 * Exported separately so it can be tested independently.
 */
export function computeDeltaMetrics(prev: CalculationResult, curr: CalculationResult): DeltaMetrics {
  // If modes differ, comparison is not applicable
  if (prev.mode !== curr.mode) {
    return { modeChanged: true };
  }

  const metrics: DeltaMetrics = { modeChanged: false };

  // Total elapsed time delta
  const oldTime = prev.total_elapsed_time;
  const newTime = curr.total_elapsed_time;
  const timeDelta = newTime - oldTime;
  const timePctChange = oldTime === 0 ? 0 : (timeDelta / oldTime) * 100;
  metrics.totalElapsedTime = {
    old: oldTime,
    new: newTime,
    delta: timeDelta,
    pctChange: oldTime === 0 ? 0 : timePctChange,
  };

  // Number of robots delta (only include if changed)
  const oldRobots = prev.num_of_robots;
  const newRobots = curr.num_of_robots;
  if (oldRobots !== newRobots) {
    metrics.numRobots = {
      old: oldRobots,
      new: newRobots,
      delta: newRobots - oldRobots,
    };
  }

  // Dead time in minutes delta
  const oldDeadTime = prev.deadTime.total_dead_time;
  const newDeadTime = curr.deadTime.total_dead_time;
  const deadTimeDelta = newDeadTime - oldDeadTime;
  const deadTimePctChange = oldDeadTime === 0 ? 0 : (deadTimeDelta / oldDeadTime) * 100;
  metrics.deadTimeMinutes = {
    old: oldDeadTime,
    new: newDeadTime,
    delta: deadTimeDelta,
    pctChange: oldDeadTime === 0 ? 0 : deadTimePctChange,
  };

  return metrics;
}

interface DeltaBannerProps {
  previousResult: CalculationResult | null;
  currentResult: CalculationResult;
  onDismiss: () => void;
}

/**
 * Formats a number to a reasonable display precision.
 */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

/**
 * Formats a percentage change string, handling division by zero case.
 * Returns null when old value was 0 (show absolute change only).
 */
function formatPctChange(pctChange: number, oldValue: number): string | null {
  if (oldValue === 0) {
    return null;
  }
  const sign = pctChange > 0 ? '+' : '';
  return `${sign}${pctChange.toFixed(1)}%`;
}

/**
 * Returns the CSS class for a metric delta.
 * For time, robots, and dead time: negative delta = improvement (green), positive = degradation (red).
 */
function getDeltaClass(delta: number): string {
  if (delta < 0) return styles.improvement;
  if (delta > 0) return styles.degradation;
  return styles.neutral;
}

export function DeltaBanner({ previousResult, currentResult, onDismiss }: DeltaBannerProps) {
  // Do not render when previous result is null
  if (!previousResult) {
    return null;
  }

  const metrics = computeDeltaMetrics(previousResult, currentResult);

  // Mode changed — show message instead of deltas
  if (metrics.modeChanged) {
    return (
      <div className={styles.wrapper} role="status" aria-live="polite">
        <div className={styles.content}>
          <span className={styles.modeChanged}>Mode changed — comparison not applicable</span>
        </div>
        <button
          className={styles.dismissButton}
          onClick={onDismiss}
          aria-label="Dismiss delta banner"
          type="button"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <div className={styles.content}>
        <span className={styles.title}>What changed:</span>
        <div className={styles.metrics}>
          {metrics.totalElapsedTime && (
            <span className={`${styles.metric} ${getDeltaClass(metrics.totalElapsedTime.delta)}`}>
              <span className={styles.metricLabel}>Elapsed time:</span>{' '}
              {formatNumber(metrics.totalElapsedTime.old)} → {formatNumber(metrics.totalElapsedTime.new)} min
              {' '}({metrics.totalElapsedTime.delta > 0 ? '+' : ''}{formatNumber(metrics.totalElapsedTime.delta)})
              {formatPctChange(metrics.totalElapsedTime.pctChange, metrics.totalElapsedTime.old) && (
                <span className={styles.pctChange}>
                  {formatPctChange(metrics.totalElapsedTime.pctChange, metrics.totalElapsedTime.old)}
                </span>
              )}
            </span>
          )}
          {metrics.numRobots && (
            <span className={`${styles.metric} ${getDeltaClass(metrics.numRobots.delta)}`}>
              <span className={styles.metricLabel}>Robots:</span>{' '}
              {metrics.numRobots.old} → {metrics.numRobots.new}
              {' '}({metrics.numRobots.delta > 0 ? '+' : ''}{metrics.numRobots.delta})
            </span>
          )}
          {metrics.deadTimeMinutes && (
            <span className={`${styles.metric} ${getDeltaClass(metrics.deadTimeMinutes.delta)}`}>
              <span className={styles.metricLabel}>Dead time:</span>{' '}
              {formatNumber(metrics.deadTimeMinutes.old)} → {formatNumber(metrics.deadTimeMinutes.new)} min
              {' '}({metrics.deadTimeMinutes.delta > 0 ? '+' : ''}{formatNumber(metrics.deadTimeMinutes.delta)})
              {formatPctChange(metrics.deadTimeMinutes.pctChange, metrics.deadTimeMinutes.old) && (
                <span className={styles.pctChange}>
                  {formatPctChange(metrics.deadTimeMinutes.pctChange, metrics.deadTimeMinutes.old)}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
      <button
        className={styles.dismissButton}
        onClick={onDismiss}
        aria-label="Dismiss delta banner"
        type="button"
      >
        ✕
      </button>
    </div>
  );
}
