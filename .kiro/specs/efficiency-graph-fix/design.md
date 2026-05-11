# Efficiency Graph Fix — Bugfix Design

## Overview

The efficiency graph and Gantt chart in the Cleaning Robot Fleet Calculator have three bugs: (1) the utilization line uses linear interpolation (`L` commands) instead of a step function, misrepresenting the discrete nature of robot state changes, (2) the x-axis ticks on both the efficiency graph and Gantt chart are computed by dividing total time by a fixed count, producing non-round labels, and (3) the efficiency data recording misses the initial transition when robots first start cleaning after floor distribution. The fix involves SVG path-building, tick-computation logic, tick marks for readability, and a data recording correction in the simulation engine.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — utilization line rendered with diagonal `L` commands, or x-axis ticks computed as `totalTime / fixedCount`
- **Property (P)**: The desired behavior — utilization line rendered as a step function (H/V commands), x-axis ticks at nice round intervals
- **Preservation**: Cumulative progress line rendering, tooltip behavior, dead-time shading, and data recording must remain unchanged
- **EfficiencyGraph.tsx**: React component at `src/components/EfficiencyGraph/EfficiencyGraph.tsx` that renders the SVG efficiency chart
- **effSvg()**: Function in `simulation-output.html` that builds the efficiency SVG string for the static reference page
- **Step function**: A piecewise-constant curve — flat horizontal segments with instantaneous vertical transitions at each data point

## Bug Details

### Bug Condition

The bug manifests in two independent rendering issues:

**Bug 1 — Utilization line style**: Both `EfficiencyGraph.tsx` and `effSvg()` build the utilization path using `L` (lineTo) commands between consecutive data points, producing diagonal lines. Since utilization is a discrete metric (integer count of cleaning robots / total robots), the correct rendering is a step function.

**Bug 2 — X-axis ticks**: Both files compute x-axis tick positions as `totalTime * i / numTicks` (where `numTicks` is hardcoded to 6), producing non-round labels like 74, 148, 222.

**Formal Specification:**

```
FUNCTION isBugCondition(input)
  INPUT: input of type GraphRenderCall
  OUTPUT: boolean

  RETURN (input.lineType = "utilization" AND input.pathUsesLinearInterpolation)
         OR (input.xAxisTickMethod = "totalTime / fixedCount")
END FUNCTION
```

### Examples

- **Bug 1 example**: With data points `[(0, 100%), (96, 66%), (120, 33%)]`, the current code produces `M 0,0 L 96,33 L 120,66` (diagonal). Expected: `M 0,0 H 96 V 33 H 120 V 66` (step).
- **Bug 2 example**: For `totalTime = 443.9`, current ticks are `[0, 74, 148, 222, 296, 370, 444]`. Expected: `[0, 50, 100, 150, 200, 250, 300, 350, 400, 450]` (interval = 50).
- **Bug 2 short simulation**: For `totalTime = 35`, expected ticks: `[0, 5, 10, 15, 20, 25, 30, 35]` (interval = 5).
- **Preservation**: The cumulative progress line (dashed blue/green) should remain as linear interpolation since progress is continuous.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Cumulative progress line continues to render with linear `L` commands (smooth curve)
- Tooltip on hover continues to show time, utilization %, and progress % for the closest data point
- Dead-time zone shading (yellow/amber rectangles) continues to highlight periods with zero cleaning robots
- Y-axis ticks and labels remain at 0%, 25%, 50%, 75%, 100%
- Legend, chart dimensions, colors, and stroke styles remain unchanged
- The simulation engine's data recording logic is untouched

**Scope:**
All rendering logic unrelated to the utilization path shape and x-axis tick computation is completely unaffected. This includes:
- Progress line path construction
- Dead-time shading rectangles
- Tooltip interaction and display
- Y-axis rendering
- Chart layout and dimensions

## Hypothesized Root Cause

Based on code inspection, the root causes are clear and confirmed:

1. **Utilization path in `EfficiencyGraph.tsx` (line ~34)**: The `utilizationPath` is built with `.map((d, i) => \`${i === 0 ? 'M' : 'L'} ...\`)` — this produces `M x0 y0 L x1 y1 L x2 y2 ...` which is linear interpolation. It should use step-function commands: for each new point, first draw horizontally to the new x at the old y, then vertically to the new y.

2. **Utilization path in `effSvg()` (simulation-output.html)**: Same pattern — the utilization path `u` is built with `u += \`${i ? 'L' : ''}${x},${y}\`` producing linear interpolation.

3. **X-axis ticks in `EfficiencyGraph.tsx` (line ~44)**: `xTickInterval = totalTime / numXTicks` with `numXTicks = 6` hardcoded. Should use a "nice number" algorithm.

4. **X-axis ticks in `effSvg()` (simulation-output.html)**: `for(let i=0;i<=6;i++){let x=PL+W*i/6; ... (T*i/6).toFixed(0)}` — same fixed-division approach.

## Correctness Properties

Property 1: Bug Condition - Utilization Line Renders as Step Function

_For any_ efficiency data set with two or more points, the rendered utilization SVG path SHALL consist only of an initial `M` (moveTo) followed by alternating `H` (horizontal lineTo) and `V` (vertical lineTo) commands (or equivalent coordinate pairs producing only horizontal and vertical segments), with no diagonal segments between consecutive data points.

**Validates: Requirements 2.1**

Property 2: Bug Condition - X-Axis Ticks Use Nice Round Intervals

_For any_ total time value > 0, the computed x-axis ticks SHALL start at 0, use a uniform interval from the set {5, 10, 15, 20, 25, 30, 50, 60, 100, 120, 150, 200, 250, 300, 500}, produce between 4 and 15 ticks, and the last tick SHALL be ≥ totalTime.

**Validates: Requirements 2.2**

Property 3: Preservation - Progress Line and Other Elements Unchanged

_For any_ rendering of the efficiency graph, the cumulative progress line SHALL continue to use linear interpolation (`L` commands), and all other visual elements (dead-time shading, tooltips, y-axis, legend) SHALL produce identical output to the original code.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/components/EfficiencyGraph/EfficiencyGraph.tsx`

**Change 1 — Step-function utilization path (line ~34)**:
Replace the linear `L` path builder with step-function logic:
```typescript
const utilizationPath = data.length > 0
  ? data.map((d, i) => {
      const x = xScale(d.time).toFixed(1);
      const y = yScale(d.fleet_utilization_pct).toFixed(1);
      if (i === 0) return `M ${x} ${y}`;
      const prevY = yScale(data[i - 1].fleet_utilization_pct).toFixed(1);
      return `H ${x} V ${y}`;
    }).join(' ')
  : '';
```
This draws horizontally to the new x at the previous y-level, then vertically to the new y.

**Change 2 — Nice x-axis ticks (line ~44)**:
Replace the fixed-division tick computation with a nice-number algorithm:
```typescript
function niceTickInterval(range: number, targetTicks: number = 8): number {
  const candidates = [1, 2, 2.5, 5, 10, 15, 20, 25, 30, 50, 60, 100, 120, 150, 200, 250, 300, 500, 1000];
  const rough = range / targetTicks;
  for (const c of candidates) {
    if (c >= rough) return c;
  }
  return candidates[candidates.length - 1];
}

const xTickStep = niceTickInterval(totalTime);
const xTicks: number[] = [];
for (let t = 0; t <= totalTime; t += xTickStep) {
  xTicks.push(t);
}
if (xTicks[xTicks.length - 1] < totalTime) {
  xTicks.push(xTicks[xTicks.length - 1] + xTickStep);
}
```

---

**File**: `simulation-output.html`

**Change 3 — Step-function utilization path in `effSvg()`**:
Replace the utilization path builder inside `effSvg()`:
```javascript
let u = '';
for (let i = 0; i < data.length; i++) {
  let x = PL + (data[i].t / T) * W;
  let y = PT + H - data[i].u / 100 * H;
  if (i === 0) { u = `M${x.toFixed(1)},${y.toFixed(1)} `; }
  else {
    let prevY = PT + H - data[i-1].u / 100 * H;
    u += `H${x.toFixed(1)} V${y.toFixed(1)} `;
  }
}
```

**Change 4 — Nice x-axis ticks in `effSvg()`**:
Replace the fixed `for(let i=0;i<=6;i++)` tick loop with a nice-interval computation:
```javascript
function niceInterval(range) {
  const cands = [1,2,2.5,5,10,15,20,25,30,50,60,100,120,150,200,250,300,500,1000];
  const rough = range / 8;
  for (const c of cands) { if (c >= rough) return c; }
  return cands[cands.length - 1];
}
const step = niceInterval(T);
for (let t = 0; t <= T + step * 0.01; t += step) {
  let x = PL + (t / T) * W;
  s += `<text x="${x}" y="${H+PT+14}" text-anchor="middle" font-size="9" fill="#a0aec0">${t.toFixed(0)}</text>`;
}
```

**Change 5 — Update Gantt x-axis in `render()` (optional consistency)**:
The Gantt chart axis also uses `for(let i=0;i<=6;i++)` — this is out of scope per requirements (only efficiency graph x-axis is mentioned), so leave unchanged.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write unit tests that call the path-building logic and x-axis tick computation, asserting step-function shape and round intervals. Run on UNFIXED code to observe failures.

**Test Cases**:
1. **Step function test**: Build utilization path from sample data, assert no diagonal `L` commands exist (will fail on unfixed code)
2. **X-axis round ticks test**: Compute ticks for totalTime=443.9, assert all labels are multiples of a nice interval (will fail on unfixed code)
3. **X-axis short range test**: Compute ticks for totalTime=35, assert interval is 5 (will fail on unfixed code)
4. **Single data point test**: Build utilization path from 1 point, assert only `M` command (may pass on unfixed code)

**Expected Counterexamples**:
- Utilization path contains `L` commands producing diagonal segments
- X-axis ticks are non-round numbers like 74, 148, 222

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL dataPoints WHERE len(dataPoints) >= 2 DO
  path := buildUtilizationPath_fixed(dataPoints)
  ASSERT path starts with M
  ASSERT all subsequent commands are H or V only
  ASSERT no diagonal segments exist
END FOR

FOR ALL totalTime WHERE totalTime > 0 DO
  ticks := computeXTicks_fixed(totalTime)
  interval := ticks[1] - ticks[0]
  ASSERT interval is a nice round number
  ASSERT all ticks are multiples of interval
  ASSERT ticks[0] = 0
  ASSERT ticks[last] >= totalTime
  ASSERT 4 <= len(ticks) <= 15
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL dataPoints DO
  progressPath_original := buildProgressPath(dataPoints)
  progressPath_fixed := buildProgressPath_fixed(dataPoints)
  ASSERT progressPath_original = progressPath_fixed
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random data point arrays to verify progress line is unchanged
- It catches edge cases (empty arrays, single points, very large/small values)
- It provides strong guarantees that non-utilization rendering is unaffected

**Test Plan**: Extract the progress path builder and verify it produces identical output before and after the fix. Verify tooltip logic and dead-time shading are untouched (code inspection — these functions are not modified).

**Test Cases**:
1. **Progress line preservation**: Generate random data arrays, verify progress path output is identical before and after fix
2. **Tooltip preservation**: Verify tooltip logic (closest-point search) is unchanged by code inspection
3. **Dead-time shading preservation**: Verify dead-period rectangle rendering is unchanged by code inspection

### Unit Tests

- Test step-function path builder with known data points, verify H/V commands
- Test nice-tick-interval function with various totalTime values (35, 100, 443.9, 1000, 5)
- Test edge cases: empty data array, single data point, two identical points
- Test that progress path builder still uses L commands

### Property-Based Tests

- Generate random arrays of efficiency data points (time ascending, utilization 0–100), verify utilization path contains only M/H/V commands
- Generate random totalTime values (1–10000), verify tick interval is from the nice-number set and tick count is 4–15
- Generate random data arrays, verify progress path is unchanged (still uses L commands)

### Integration Tests

- Render full EfficiencyGraph component with sample simulation data, verify SVG output contains step-function utilization path
- Verify the static HTML page renders correctly with the updated effSvg() function
- Visual regression: compare rendered graph appearance before/after fix (manual)
