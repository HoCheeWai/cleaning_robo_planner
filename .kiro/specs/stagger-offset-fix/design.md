# Stagger Offset Fix - Bugfix Design

## Overview

The stagger offset calculation in `simulateTimeline` uses the raw service cycle time (`cycleTime`) to space robot start times. When battery/tank capacity is very large (or effectively infinite), `cycleTime` becomes enormous, causing robots 2..N to be scheduled far beyond the actual cleaning duration. The fix caps the effective cycle time at `cleanPerRobot` so that stagger offsets never exceed the time each robot actually needs to clean.

## Glossary

- **Bug_Condition (C)**: The condition where `rawCycleTime > cleanPerRobot` AND `startMode === 'staggered'`, causing offsets that exceed the cleaning window
- **Property (P)**: When the bug condition holds, the stagger offset should use `effectiveCycleTime = min(rawCycleTime, cleanPerRobot)` so all robots start within the cleaning duration
- **Preservation**: When `rawCycleTime <= cleanPerRobot` (normal finite battery/tank), the offset calculation remains unchanged
- **cycleTime**: The full service cycle: `min(usableBatt, tank_capacity_time) + 2*travelTime + refill_duration`
- **cleanPerRobot**: The cleaning time assigned to each robot: `totalDist / (effective_speed * numRobots)`
- **offset**: The time delay between consecutive robot starts in staggered mode: `effectiveCycleTime / numRobots`

## Bug Details

### Bug Condition

The bug manifests when battery and/or tank capacity are very large (e.g., 99999 min) and start mode is "staggered". The `cycleTime` calculation produces a value far exceeding the actual cleaning duration, so `offset = cycleTime / numRobots` schedules robots 2..N to start after all work is already complete.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { inputs: CalculatorInputs, numRobots: number, startMode: StartMode }
  OUTPUT: boolean

  LET usableBatt = computeUsableBatteryTime(input.inputs.total_battery_life, input.inputs.battery_reserve_threshold)
  LET travelTime = computeTravelTimeToServiceHub(input.inputs.distance_to_service_hub, input.inputs.effective_speed)
  LET rawCycleTime = MIN(usableBatt, input.inputs.tank_capacity_time) + 2 * travelTime + input.inputs.refill_duration
  LET totalDist = computeTotalCleaningDistance(...)
  LET cleanPerRobot = totalDist / (input.inputs.effective_speed * input.numRobots)

  RETURN input.startMode == 'staggered'
         AND rawCycleTime > cleanPerRobot
END FUNCTION
```

### Examples

- **3 robots, battery=99999, tank=99999, area=2000m²**: `cycleTime ≈ 99999`, `cleanPerRobot ≈ 352.9 min`, offset ≈ 33333 min → Robot 2 starts at minute 33333, Robot 3 at minute 66666. Only Robot 1 cleans. Elapsed ≈ 1083.8 min.
- **3 robots, battery=99999, tank=99999, area=2000m² (fixed)**: With fix, `effectiveCycleTime = min(99999, 352.9) = 352.9`, offset ≈ 117.6 min → All robots start within cleaning window. Elapsed ≈ 352.9 min.
- **3 robots, battery=60, tank=45, area=2000m² (no bug)**: `cycleTime ≈ 50.3`, `cleanPerRobot ≈ 352.9` → `rawCycleTime < cleanPerRobot`, no capping needed, existing behavior preserved.
- **1 robot, staggered**: offset = 0 regardless (cycleTime / 1 = cycleTime, but only one robot so no stagger effect).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When `rawCycleTime <= cleanPerRobot` (normal finite battery/tank scenarios), the offset calculation remains exactly `rawCycleTime / numRobots`
- When `startMode === 'simultaneous'`, offset remains zero regardless of battery/tank values
- All existing test scenarios (reference scenario with default battery/tank) continue to produce identical results
- The simulation logic beyond the offset calculation (resource contention, pool draining, service scheduling) is completely unaffected

**Scope:**
All inputs where `rawCycleTime <= cleanPerRobot` OR `startMode !== 'staggered'` are completely unaffected by this fix. This includes:
- Simultaneous start mode (any battery/tank values)
- Staggered start with normal finite battery/tank where servicing is needed within the cleaning window
- Any number of robots, floors, or work assignment modes when the above conditions hold

## Hypothesized Root Cause

Based on the bug description, the root cause is:

1. **Missing upper bound on cycle time for offset calculation**: The original code uses `cycleTime` directly without considering that when battery/tank are large enough to never require servicing, the "cycle" concept is meaningless — robots will finish cleaning before ever needing service. The offset should be bounded by the actual cleaning duration.

2. **Implicit assumption violated**: The stagger formula assumes robots will actually complete a full service cycle and return to cleaning. When battery/tank exceed `cleanPerRobot`, no service cycle ever occurs, so spacing robots by `cycleTime / numRobots` is nonsensical.

## Correctness Properties

Property 1: Bug Condition - Stagger offset capped at cleaning time per robot

_For any_ input where the bug condition holds (startMode is 'staggered' AND rawCycleTime > cleanPerRobot), the fixed function SHALL compute the offset as `min(rawCycleTime, cleanPerRobot) / numRobots`, ensuring all robots start within the cleaning duration and contribute to the work.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Normal stagger behavior unchanged

_For any_ input where the bug condition does NOT hold (startMode is 'simultaneous' OR rawCycleTime <= cleanPerRobot), the fixed function SHALL produce exactly the same stagger offset and simulation results as the original function, preserving all existing behavior.

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `src/engine/timeline.ts`

**Function**: `simulateTimeline`

**Specific Changes**:
1. **Rename `cycleTime` to `rawCycleTime`**: Clarify that this is the uncapped value
2. **Add `effectiveCycleTime` computation**: `const effectiveCycleTime = Math.min(rawCycleTime, cleanPerRobot);`
3. **Use `effectiveCycleTime` in offset calculation**: `const offset = startMode === 'staggered' ? effectiveCycleTime / numRobots : 0;`

**Location**: Lines ~77-78 in `src/engine/timeline.ts`

**Before**:
```typescript
const cycleTime = Math.min(usableBatt, inputs.tank_capacity_time) + travelTime + inputs.refill_duration + travelTime;
const offset = startMode === 'staggered' ? cycleTime / numRobots : 0;
```

**After**:
```typescript
const rawCycleTime = Math.min(usableBatt, inputs.tank_capacity_time) + travelTime + inputs.refill_duration + travelTime;
const effectiveCycleTime = Math.min(rawCycleTime, cleanPerRobot);
const offset = startMode === 'staggered' ? effectiveCycleTime / numRobots : 0;
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that large battery/tank values cause only Robot 1 to clean.

**Test Plan**: Create inputs with very large battery/tank (99999 min) and staggered start, then verify that the elapsed time is unreasonably large and only Robot 1 contributes cleaning.

**Test Cases**:
1. **Infinite battery stagger test**: 3 robots, battery=99999, tank=99999, staggered → elapsed time ≈ single-robot time (will fail on unfixed code by showing the bug)
2. **All robots contribute test**: Same inputs → verify robots 2 and 3 have non-zero cleaning (will fail on unfixed code)

**Expected Counterexamples**:
- Elapsed time ≈ 1083.8 min (single robot) instead of ≈ 352.9 min (three robots)
- Robots 2 and 3 have zero `totalCleaned`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := simulateTimeline_fixed(input.inputs, input.numRobots, 'staggered')
  simultResult := simulateTimeline_fixed(input.inputs, input.numRobots, 'simultaneous')
  ASSERT result.rawElapsedTime IS CLOSE TO simultResult.rawElapsedTime
  ASSERT ALL robots in result.timelines HAVE totalCleaned > 0
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT simulateTimeline_original(input) = simulateTimeline_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Run existing reference scenario tests (which use normal battery/tank values) to confirm they pass unchanged. Add a property-based test that generates inputs where `rawCycleTime <= cleanPerRobot` and verifies identical results.

**Test Cases**:
1. **Existing reference tests pass**: All 9 existing tests in `timeline-verify.test.ts` must continue to pass with identical values
2. **Simultaneous mode unaffected**: Verify simultaneous start produces identical results regardless of battery/tank size
3. **Normal stagger preserved**: Verify stagger with finite battery/tank (where servicing is needed) produces identical offsets

### Unit Tests

- Test that with infinite battery/tank and staggered start, elapsed time is close to simultaneous start
- Test that all robots contribute cleaning in the infinite battery/tank staggered scenario
- Test that existing reference scenarios produce unchanged results (regression)

### Property-Based Tests

- Generate random inputs with large battery/tank and verify staggered ≈ simultaneous elapsed time
- Generate random inputs with normal battery/tank (rawCycleTime < cleanPerRobot) and verify offset = rawCycleTime / numRobots
- Generate random inputs in simultaneous mode and verify offset is always zero

### Integration Tests

- Full simulation with infinite battery staggered: verify timeline segments show all robots cleaning
- Verify efficiency data points are reasonable (not showing 0% for extended periods)
- Verify dead time analysis is consistent with all robots contributing
