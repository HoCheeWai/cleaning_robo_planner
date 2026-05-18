import { useRef, useState, useEffect } from 'react';
import { useCalculator } from '../../state';
import { generatePDF, getPDFFilename, svgToDataUrl, generateComparisonPDF, getComparisonPDFFilename } from '../../services/pdfExport';
import { SavedScenario } from '../../services/scenarioStorage';
import { InfeasibilityPanel } from '../InfeasibilityPanel/InfeasibilityPanel';
import { TimelineChart } from '../TimelineChart/TimelineChart';
import { EfficiencyGraph } from '../EfficiencyGraph/EfficiencyGraph';
import { DeltaBanner } from '../DeltaBanner/DeltaBanner';
import { ScenarioPanel } from '../ScenarioPanel/ScenarioPanel';
import { CalculationResult } from '../../types';
import styles from './ResultDisplay.module.css';

const CONTRIBUTION_COLORS: Record<string, string> = {
  active_cleaning_pct: '#22c55e',
  charging_overhead_pct: '#eab308',
  refill_overhead_pct: '#a855f7',
  travel_overhead_pct: '#3b82f6',
  waiting_contention_pct: '#f97316',
  floor_distribution_pct: '#6b7280',
  field_buffer_pct: '#94a3b8',
};

const CONTRIBUTION_LABELS: Record<string, string> = {
  active_cleaning_pct: 'Active Cleaning',
  charging_overhead_pct: 'Charging Overhead',
  refill_overhead_pct: 'Refill Overhead',
  travel_overhead_pct: 'Travel Overhead',
  waiting_contention_pct: 'Waiting / Contention',
  floor_distribution_pct: 'Floor Distribution',
  field_buffer_pct: 'Field Buffer',
};

export function ResultDisplay() {
  const { state, dispatch } = useCalculator();
  const { result, inputs } = state;
  const timelineRef = useRef<HTMLDivElement>(null);
  const efficiencyRef = useRef<HTMLDivElement>(null);
  const previousResultRef = useRef<CalculationResult | null>(null);
  const [deltaDismissed, setDeltaDismissed] = useState(false);

  // Track result changes for delta banner
  useEffect(() => {
    if (result && !result.infeasible) {
      // When a new result arrives, reset dismissed state
      setDeltaDismissed(false);
    }
  }, [result]);

  // Update previous result ref AFTER render so DeltaBanner can compare
  // We use a separate effect that runs after the component renders with the new result
  useEffect(() => {
    // Store the current result as previous for the next calculation
    // This runs after the render, so DeltaBanner already has the old previousResultRef.current
    return () => {
      if (result && !result.infeasible) {
        previousResultRef.current = result;
      }
    };
  }, [result]);

  if (!result) {
    return (
      <div className={styles.placeholder}>
        Configure inputs and click <strong>Calculate</strong> to see results.
      </div>
    );
  }

  // Infeasibility
  if (result.infeasible) {
    return (
      <div className={styles.wrapper}>
        <InfeasibilityPanel
          reason={result.infeasibilityReason || 'Cannot meet the time constraint.'}
          suggestions={result.infeasibilitySuggestions || []}
        />
      </div>
    );
  }

  const formatTime = (min: number) => {
    if (min > 60) {
      const h = Math.floor(min / 60);
      const m = Math.round(min % 60);
      return `${min.toFixed(1)} min (${h}h ${m}m)`;
    }
    return `${min.toFixed(1)} min`;
  };

  const workModeLabel = inputs.work_assignment_mode === 'collaborative' ? 'Collaborative' : 'Fixed Zones';
  const startModeLabel = inputs.startMode === 'staggered' ? 'Staggered Start' : 'Simultaneous Start';

  const handleExportPDF = async () => {
    let timelineChart: string | undefined;
    let efficiencyGraph: string | undefined;

    const timelineSvg = timelineRef.current?.querySelector('svg');
    if (timelineSvg) {
      try {
        timelineChart = await svgToDataUrl(timelineSvg as unknown as SVGElement);
      } catch { /* skip if capture fails */ }
    }

    const efficiencySvg = efficiencyRef.current?.querySelector('svg');
    if (efficiencySvg) {
      try {
        efficiencyGraph = await svgToDataUrl(efficiencySvg as unknown as SVGElement);
      } catch { /* skip if capture fails */ }
    }

    const blob = generatePDF(inputs, result, inputs.comments, { timelineChart, efficiencyGraph });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getPDFFilename();
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadScenario = (scenarioInputs: typeof inputs) => {
    dispatch({ type: 'LOAD_SCENARIO', inputs: scenarioInputs });
    // Clear previous result ref on load (acts like a reset for delta purposes)
    previousResultRef.current = null;
    setDeltaDismissed(true);
  };

  const handleExportComparison = (scenarios: SavedScenario[]) => {
    try {
      const blob = generateComparisonPDF(scenarios);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getComparisonPDFFilename();
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert('Failed to generate comparison PDF.');
    }
  };

  const totalDist = result.derived.total_cleaning_distance;

  return (
    <div className={styles.wrapper}>
      {/* Delta Banner — excluded from PDF capture DOM */}
      {!deltaDismissed && (
        <DeltaBanner
          previousResult={previousResultRef.current}
          currentResult={result}
          onDismiss={() => setDeltaDismissed(true)}
        />
      )}

      {/* Primary Result */}
      <div className={styles.primaryResult}>
        <div className={styles.primaryLabel}>
          {result.mode === 'time-constraint' ? 'Robots Required' : 'Total Elapsed Time'}
        </div>
        <div className={styles.primaryValue}>
          {result.mode === 'time-constraint'
            ? `${result.num_of_robots} robots`
            : formatTime(result.total_elapsed_time)}
        </div>
        {result.mode === 'time-constraint' && (
          <div className={styles.primarySub}>
            Elapsed time: {formatTime(result.total_elapsed_time)}
          </div>
        )}
        <div className={styles.modeInfo}>
          {workModeLabel} · {startModeLabel}
        </div>
        <div className={styles.deadTimeBox}>
          <div className={styles.deadTimeLabel}>Dead Time (Service Storms)</div>
          <div className={styles.deadTimeValue}>
            {result.deadTime.total_dead_time.toFixed(1)} min ({result.deadTime.dead_time_pct.toFixed(1)}%)
          </div>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Time Breakdown</div>
        <table className={styles.breakdownTable}>
          <thead>
            <tr>
              <th>Component</th>
              <th>%</th>
              <th className={styles.barCell}></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(CONTRIBUTION_LABELS).map(([key, label]) => {
              const pct = (result.contributions as unknown as Record<string, number>)[key] || 0;
              return (
                <tr key={key}>
                  <td>{label}</td>
                  <td>{pct.toFixed(1)}%</td>
                  <td className={styles.barCell}>
                    <div className={styles.bar}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${pct}%`, background: CONTRIBUTION_COLORS[key] }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Optimizations */}
      {result.optimizations.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Optimization Opportunities</div>
          <ul className={styles.optimizationList}>
            {result.optimizations.map((opt, i) => (
              <li key={i} className={styles.optimizationItem}>
                <div className={styles.optLabel}>{opt.label}</div>
                <div className={styles.optSuggestion}>{opt.suggestion}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Robot Work Distribution */}
      {result.timeline.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Robot Work Distribution</div>
          <div className={styles.robotDistribution}>
            {result.timeline.map((tl) => (
              <div key={tl.robotIndex} className={styles.robotCard}>
                <div className={styles.robotName}>Robot {tl.robotIndex + 1}</div>
                <div className={styles.robotPct}>
                  {totalDist > 0 ? ((tl.totalCleaned / totalDist) * 100).toFixed(1) : '0.0'}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Chart */}
      {result.timeline.length > 0 && (
        <div className={styles.section} ref={timelineRef}>
          <div className={styles.sectionTitle}>Timeline (Gantt Chart)</div>
          <div className={styles.chartNote}>
            Charts show raw simulation time ({(result.total_elapsed_time / inputs.field_buffer_multiplier).toFixed(1)} min). 
            The reported elapsed time ({result.total_elapsed_time.toFixed(1)} min) includes the ×{inputs.field_buffer_multiplier} field buffer.
          </div>
          <TimelineChart timelines={result.timeline} totalTime={result.total_elapsed_time / inputs.field_buffer_multiplier} />
        </div>
      )}

      {/* Efficiency Graph */}
      {result.efficiencyData.length > 0 && (
        <div className={styles.section} ref={efficiencyRef}>
          <div className={styles.sectionTitle}>Fleet Efficiency</div>
          <EfficiencyGraph
            data={result.efficiencyData}
            deadPeriods={result.deadTime.dead_periods}
            totalTime={result.total_elapsed_time / inputs.field_buffer_multiplier}
          />
        </div>
      )}

      {/* Export PDF */}
      <button
        type="button"
        className={styles.exportBtn}
        onClick={handleExportPDF}
      >
        Export as PDF
      </button>

      {/* Assumptions & Limitations */}
      <div className={styles.assumptions}>
        <div className={styles.assumptionsTitle}>Assumptions &amp; Limitations</div>
        <ul className={styles.assumptionsList}>
          <li>Multi-floor buildings are modelled as a single combined work pool. The simulation accounts for initial elevator distribution time and service hub floor travel, but does <strong>not</strong> model robots moving between floors mid-job to assist on other floors.</li>
          <li>Charging docks and refill stations are assumed to be co-located in a single service hub.</li>
          <li>All robots are identical (same speed, battery, tank capacity).</li>
          <li>The field buffer multiplier accounts for real-world inefficiencies (obstacles, navigation errors, maintenance) not explicitly modelled in the simulation.</li>
          <li>In Collaborative mode, work redistribution is instantaneous — no communication overhead between robots.</li>
        </ul>
      </div>

      {/* Scenario Panel */}
      <ScenarioPanel
        currentResult={result}
        currentInputs={inputs}
        onLoadScenario={handleLoadScenario}
        onExportComparison={handleExportComparison}
      />
    </div>
  );
}
