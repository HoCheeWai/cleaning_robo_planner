# Bugfix Requirements Document

## Introduction

The Efficiency/Utilization graph in the Cleaning Robot Fleet Calculator has two bugs that make it misleading for users assessing fleet performance:

1. **Utilization line should be step-like, not linear** — The utilization line (instantaneous fraction of robots cleaning) is rendered using linear interpolation (`L` lineTo commands) between sampled data points. Since utilization is a discrete state metric (robots are either cleaning or not), the graph should render as a step function with flat horizontal segments and sharp vertical transitions. The current linear rendering creates misleading diagonal slopes that suggest gradual transitions.

2. **X-axis tick labels are not human-readable round numbers** — The efficiency graph's x-axis tick labels (in both the efficiency graph AND the Gantt chart) are computed by dividing total time by a fixed number of ticks (e.g., 443.9 / 6 = ~74), producing values like 0, 74, 148, 222, 296, 370, 444. These numbers are confusing and add no value. The ticks should use nice round intervals like 50, 100, 150, 200... or 10, 20, 30, 40... depending on the total time range. Each tick should have a small vertical mark on the x-axis for readability.

3. **Utilization data not recorded when robots first start cleaning** — The efficiency data recording misses the transition from 0% to 100% when robots first begin cleaning after floor distribution, causing the graph to show 0% utilization for the entire initial cleaning period until the first service event.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the fleet utilization line is rendered in both the React component (`EfficiencyGraph.tsx`) and `simulation-output.html` THEN the system draws diagonal lines between data points using SVG `L` (lineTo) commands, creating a smooth/linear appearance that misrepresents the discrete nature of the utilization metric (robots are either cleaning or not — there is no gradual transition)

1.2 WHEN the efficiency graph or Gantt chart x-axis is rendered (in `EfficiencyGraph.tsx`, `TimelineChart.tsx`, and `simulation-output.html`) THEN the system computes tick positions by dividing total elapsed time by a fixed number of ticks (e.g., 443.9 / 6 ≈ 74), producing labels like 0, 74, 148, 222, 296, 370, 444 — these are confusing non-round numbers that add no value for the reader

### Expected Behavior (Correct)

2.1 WHEN the fleet utilization line is rendered THEN the system SHALL draw the line as a step function: for each pair of consecutive data points, draw a horizontal line at the first point's y-value to the second point's x-position, then a vertical line to the second point's y-value. This produces flat segments with sharp vertical transitions that accurately represent the discrete nature of robot state changes. At the start of the simulation (~20 min after floor distribution), when all robots begin cleaning simultaneously, the utilization correctly shows 100% as a flat step.

2.2 WHEN the efficiency graph or Gantt chart x-axis is rendered (in `EfficiencyGraph.tsx`, `TimelineChart.tsx`, and `simulation-output.html`) THEN the system SHALL choose a "nice" round tick interval based on the total time range (e.g., 10, 20, 25, 50, or 100 min intervals) so that tick labels are always human-readable round numbers (e.g., 0, 50, 100, 150, 200, 250, 300, 350, 400, 450 for a ~444 min simulation). The algorithm should select the interval that produces approximately 5–10 ticks for any given total time. Each tick SHALL have a small vertical mark on the x-axis for readability.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the cumulative progress line is rendered THEN the system SHALL CONTINUE TO display the cumulative distance cleaned as a percentage of total distance, increasing monotonically from 0% to 100% (this line MAY remain as linear interpolation since progress is continuous)

3.2 WHEN the tooltip is displayed on hover over the efficiency graph THEN the system SHALL CONTINUE TO show the time, utilization percentage, and progress percentage for the closest data point

3.3 WHEN dead time zones are shaded on the efficiency graph THEN the system SHALL CONTINUE TO highlight periods where zero robots are cleaning with the yellow/amber shading

3.4 WHEN the simulation engine records efficiency data points THEN the system SHALL CONTINUE TO record data at state transitions (robot starts/stops cleaning) to maintain accuracy in the graph shape

3.5 WHEN the simulation engine records efficiency data points THEN the system SHALL CONTINUE TO record data at state transitions (robot starts/stops cleaning) to maintain accuracy in the graph shape

---

## Bug Condition Analysis

### Bug 1: Utilization Line Rendering Style

```pascal
FUNCTION isBugCondition_StepRendering(X)
  INPUT: X of type GraphRenderContext (any rendering of utilization line)
  OUTPUT: boolean
  
  // The bug manifests in all renderings of the utilization line
  // where linear interpolation is used instead of step function
  RETURN X.lineType = "utilization" AND X.renderStyle = "linear"
END FUNCTION
```

```pascal
// Property: Fix Checking - Step Function Rendering
FOR ALL X WHERE isBugCondition_StepRendering(X) DO
  path ← renderUtilizationLine'(X.dataPoints)
  // Between consecutive points (t1,u1) and (t2,u2), the path must:
  // 1. Draw horizontal from (t1,u1) to (t2,u1)  [hold previous value]
  // 2. Draw vertical from (t2,u1) to (t2,u2)    [step to new value]
  FOR EACH consecutive pair (p1, p2) IN path DO
    ASSERT horizontalSegmentExists(p1.x, p2.x, p1.y)
    ASSERT verticalSegmentExists(p2.x, p1.y, p2.y)
    ASSERT NO diagonalSegmentExists(p1, p2)
  END FOR
END FOR
```

```pascal
// Property: Preservation Checking - Progress Line Unchanged
FOR ALL X WHERE X.lineType = "progress" DO
  // Progress line rendering style is unchanged (linear interpolation is acceptable)
  ASSERT F(X) = F'(X)
END FOR
```

### Bug 2: X-Axis Ticks

```pascal
FUNCTION isBugCondition_XAxis(X)
  INPUT: X of type GraphRenderContext (any efficiency graph rendering)
  OUTPUT: boolean
  
  // Bug occurs in both EfficiencyGraph.tsx and simulation-output.html
  // where x-axis ticks are computed by dividing total time by a fixed count
  RETURN X.tickComputationMethod = "totalTime / fixedCount"
END FUNCTION
```

```pascal
// Property: Fix Checking - Nice Round Tick Intervals
FOR ALL X WHERE isBugCondition_XAxis(X) DO
  ticks ← getXAxisTicks'(X)
  interval ← ticks[1] - ticks[0]
  // Interval must be a "nice" round number
  ASSERT interval IN {5, 10, 15, 20, 25, 30, 50, 60, 100, 120, 150, 200, 250, 300, 500}
  // All ticks must be multiples of the interval
  FOR EACH tick IN ticks DO
    ASSERT tick MOD interval = 0
  END FOR
  // Ticks start at 0 and cover the full range
  ASSERT ticks[0] = 0
  ASSERT ticks[last] >= totalTime * 0.9
  // Approximately 5-10 ticks
  ASSERT 5 <= ticks.length <= 12
END FOR
```

```pascal
// Property: Preservation Checking - Tick Count Reasonable
FOR ALL X DO
  ticks ← getXAxisTicks'(X)
  // Ticks should not be too dense or too sparse
  ASSERT ticks.length >= 4
  ASSERT ticks.length <= 15
END FOR
```
