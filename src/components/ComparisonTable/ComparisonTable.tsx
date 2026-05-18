import { SavedScenario } from '../../services/scenarioStorage';
import { CalculatorInputs } from '../../types';
import { FIELD_METADATA } from '../../types/defaults';
import styles from './ComparisonTable.module.css';

// ===== Props =====

interface ComparisonTableProps {
  scenarios: SavedScenario[];
  onExportComparison: () => void;
}

// ===== Utility =====

/**
 * Returns the index of the best value in an array of numbers.
 * For 'min' mode: returns the index of the smallest value (best for time/dead-time metrics).
 * For 'max' mode: returns the index of the largest value (best for active cleaning %).
 * In case of ties, returns the first occurrence.
 */
export function getBestValueIndex(values: number[], mode: 'min' | 'max'): number {
  if (values.length === 0) return -1;

  let bestIdx = 0;
  let bestVal = values[0];

  for (let i = 1; i < values.length; i++) {
    if (mode === 'min' && values[i] < bestVal) {
      bestVal = values[i];
      bestIdx = i;
    } else if (mode === 'max' && values[i] > bestVal) {
      bestVal = values[i];
      bestIdx = i;
    }
  }

  return bestIdx;
}

// ===== Delta Helpers =====

/**
 * Format a numeric delta value with sign and percentage relative to baseline.
 * @param baseline - The baseline value
 * @param current - The current scenario value
 * @param unit - The unit suffix (e.g., ' min', '%')
 * @param lowerIsBetter - If true, negative delta is an improvement (green)
 */
export function formatDelta(
  baseline: number,
  current: number,
  unit: string,
  lowerIsBetter: boolean
): { text: string; isImprovement: boolean; isNeutral: boolean } {
  const delta = current - baseline;
  if (Math.abs(delta) < 0.05) {
    return { text: '—', isImprovement: false, isNeutral: true };
  }
  const pct = baseline !== 0 ? (delta / baseline) * 100 : 0;
  const sign = delta > 0 ? '+' : '';
  const text = `${sign}${delta.toFixed(1)}${unit} (${sign}${pct.toFixed(0)}%)`;
  const isImprovement = lowerIsBetter ? delta < 0 : delta > 0;
  return { text, isImprovement, isNeutral: false };
}

/**
 * Format an integer delta (e.g., number of robots).
 */
export function formatIntDelta(
  baseline: number,
  current: number,
  lowerIsBetter: boolean
): { text: string; isImprovement: boolean; isNeutral: boolean } {
  const delta = current - baseline;
  if (delta === 0) {
    return { text: '—', isImprovement: false, isNeutral: true };
  }
  const pct = baseline !== 0 ? (delta / baseline) * 100 : 0;
  const sign = delta > 0 ? '+' : '';
  const text = `${sign}${delta} (${sign}${pct.toFixed(0)}%)`;
  const isImprovement = lowerIsBetter ? delta < 0 : delta > 0;
  return { text, isImprovement, isNeutral: false };
}

// ===== Input Comparison Helpers =====

/** Keys to compare in the input differences section */
export const INPUT_KEYS_TO_COMPARE: (keyof CalculatorInputs)[] = [
  'actual_area_per_floor',
  'num_of_floors',
  'num_of_passes',
  'effective_cleaning_width',
  'overlap_percentage',
  'num_of_robots',
  'num_of_charging_points',
  'num_of_refill_stations',
  'num_of_elevators',
  'num_of_robots_per_elevator_trip',
  'service_hub_on_different_floor',
  'effective_speed',
  'total_battery_life',
  'battery_reserve_threshold',
  'tank_capacity_time',
  'distance_to_service_hub',
  'vertical_travel_time',
  'effective_charge_time',
  'refill_duration',
  'field_buffer_multiplier',
  'work_assignment_mode',
  'startMode',
  'mode',
  'time_constraint',
];

/**
 * Get the differing inputs across scenarios.
 * Returns only keys where at least one scenario differs from the baseline.
 */
export function getDifferingInputs(scenarios: SavedScenario[]): (keyof CalculatorInputs)[] {
  if (scenarios.length < 2) return [];
  const baseline = scenarios[0].inputs;
  return INPUT_KEYS_TO_COMPARE.filter(key => {
    return scenarios.slice(1).some(s => String(s.inputs[key]) !== String(baseline[key]));
  });
}

/**
 * Format an input value for display.
 */
export function formatInputValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === 'time-constraint') return 'Time Constraint';
  if (value === 'robot-count') return 'Robot Count';
  if (value === 'fixed-zones') return 'Fixed Zones';
  if (value === 'collaborative') return 'Collaborative';
  if (value === 'simultaneous') return 'Simultaneous';
  if (value === 'staggered') return 'Staggered';
  return String(value);
}

/**
 * Format the delta for an input value (categorical or numeric).
 */
export function formatInputDelta(
  baselineVal: unknown,
  currentVal: unknown
): { text: string; isCategorical: boolean } {
  if (String(baselineVal) === String(currentVal)) {
    return { text: '—', isCategorical: false };
  }
  // Categorical values
  if (typeof baselineVal === 'boolean' || typeof baselineVal === 'string') {
    return { text: `→ ${formatInputValue(currentVal)}`, isCategorical: true };
  }
  // Numeric values
  if (typeof baselineVal === 'number' && typeof currentVal === 'number') {
    const delta = currentVal - baselineVal;
    const sign = delta > 0 ? '+' : '';
    return { text: `${sign}${delta % 1 === 0 ? delta : delta.toFixed(2)}`, isCategorical: false };
  }
  return { text: formatInputValue(currentVal), isCategorical: true };
}

// ===== Component =====

export function ComparisonTable({ scenarios, onExportComparison }: ComparisonTableProps) {
  // Hide when fewer than 2 selected
  if (scenarios.length < 2) {
    return null;
  }

  // Show warning when more than 4 selected
  if (scenarios.length > 4) {
    return (
      <div className={styles.warning} role="alert">
        Maximum of 4 scenarios can be compared at once. Please deselect some scenarios.
      </div>
    );
  }

  const baseline = scenarios[0];
  const others = scenarios.slice(1);

  // Get differing inputs
  const differingKeys = getDifferingInputs(scenarios);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Scenario Comparison</span>
        <button
          type="button"
          className={styles.exportBtn}
          onClick={onExportComparison}
        >
          Export Comparison
        </button>
      </div>

      {/* Output Metrics Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.metricHeader}>Metric</th>
              <th className={styles.scenarioHeader}>
                {baseline.name}
                <span className={styles.baselineTag}>Baseline</span>
              </th>
              {others.map(s => (
                <th key={s.id} className={styles.scenarioHeader}>{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Total Elapsed Time */}
            <tr>
              <td className={styles.metricCell}>Total Elapsed Time</td>
              <td className={styles.valueCell}>
                {baseline.result.total_elapsed_time.toFixed(1)} min
              </td>
              {others.map(s => {
                const d = formatDelta(
                  baseline.result.total_elapsed_time,
                  s.result.total_elapsed_time,
                  ' min',
                  true
                );
                return (
                  <td key={s.id} className={styles.valueCell}>
                    <span className={d.isNeutral ? '' : d.isImprovement ? styles.deltaPositive : styles.deltaNegative}>
                      {d.text}
                    </span>
                  </td>
                );
              })}
            </tr>

            {/* Dead Time (minutes) */}
            <tr>
              <td className={styles.metricCell}>Dead Time (minutes)</td>
              <td className={styles.valueCell}>
                {baseline.result.deadTime.total_dead_time.toFixed(1)} min
              </td>
              {others.map(s => {
                const d = formatDelta(
                  baseline.result.deadTime.total_dead_time,
                  s.result.deadTime.total_dead_time,
                  ' min',
                  true
                );
                return (
                  <td key={s.id} className={styles.valueCell}>
                    <span className={d.isNeutral ? '' : d.isImprovement ? styles.deltaPositive : styles.deltaNegative}>
                      {d.text}
                    </span>
                  </td>
                );
              })}
            </tr>

            {/* Number of Robots */}
            <tr>
              <td className={styles.metricCell}>Number of Robots</td>
              <td className={styles.valueCell}>
                {baseline.result.num_of_robots}
              </td>
              {others.map(s => {
                const d = formatIntDelta(
                  baseline.result.num_of_robots,
                  s.result.num_of_robots,
                  true
                );
                return (
                  <td key={s.id} className={styles.valueCell}>
                    <span className={d.isNeutral ? '' : d.isImprovement ? styles.deltaPositive : styles.deltaNegative}>
                      {d.text}
                    </span>
                  </td>
                );
              })}
            </tr>

            {/* Active Cleaning % */}
            <tr>
              <td className={styles.metricCell}>Active Cleaning (%)</td>
              <td className={styles.valueCell}>
                {baseline.result.contributions.active_cleaning_pct.toFixed(1)}%
              </td>
              {others.map(s => {
                const d = formatDelta(
                  baseline.result.contributions.active_cleaning_pct,
                  s.result.contributions.active_cleaning_pct,
                  '%',
                  false // higher is better
                );
                return (
                  <td key={s.id} className={styles.valueCell}>
                    <span className={d.isNeutral ? '' : d.isImprovement ? styles.deltaPositive : styles.deltaNegative}>
                      {d.text}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Input Differences Table */}
      {differingKeys.length > 0 && (
        <div className={styles.tableWrapper} style={{ marginTop: '16px' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.metricHeader}>Input Differences</th>
                <th className={styles.scenarioHeader}>
                  {baseline.name}
                  <span className={styles.baselineTag}>Baseline</span>
                </th>
                {others.map(s => (
                  <th key={s.id} className={styles.scenarioHeader}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {differingKeys.map(key => {
                const meta = FIELD_METADATA[key];
                const label = meta?.label || key;
                const baselineVal = baseline.inputs[key];
                return (
                  <tr key={key}>
                    <td className={styles.metricCell}>{label}</td>
                    <td className={styles.valueCell}>
                      {formatInputValue(baselineVal)}
                    </td>
                    {others.map(s => {
                      const currentVal = s.inputs[key];
                      const d = formatInputDelta(baselineVal, currentVal);
                      return (
                        <td key={s.id} className={styles.valueCell}>
                          <span className={d.isCategorical ? styles.deltaArrow : ''}>
                            {d.text}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
