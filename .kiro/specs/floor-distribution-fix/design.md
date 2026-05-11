# Floor Distribution Fix - Bugfix Design

## Overview

The timeline simulation incorrectly models elevator delivery as a single monolithic block — all robots wait for the total floor distribution time before any can start cleaning. The fix changes this to incremental batch delivery: robots are released as soon as their batch arrives, reducing dead time and producing a more realistic timeline. The change is localized to the robot initialization section of `simulateTimeline()` in `src/engine/timeline.ts`.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when multiple elevator batches are needed (`numFloors > 1` AND `numRobots > batchSize`)
- **Property (P)**: Each robot's `startAt` and elevator segment should reflect its batch-specific delivery time, not the total distribution time
- **Preservation**: When `numFloors <= 1` or all robots fit in one batch, behavior must remain identical to the current implementation
- **`simulateTimeline`**: The function in `src/engine/timeline.ts` that runs the event-driven simulation producing robot timelines
- **`computeFloorDistributionTime`**: The function in `src/engine/formulas.ts` that computes total elevator distribution overhead (formula is correct, usage is the issue)
- **batchSize**: `robotsPerTrip × numElevators` — how many robots can be delivered per elevator cycle
- **deliveryTime(i)**: The time at which robot `i` (0-based) is delivered to its floor: `ceil((i+1) / batchSize) × verticalTravelTime`

## Bug Details

### Bug Condition

The bug manifests when multiple elevator batches are needed to distribute robots across floors. The `simulateTimeline` function assigns every robot the same `startAt = floorDistTime` and the same elevator segment `(0, floorDistTime)`, regardless of which batch the robot belongs to. This means early-batch robots are modelled as idle while waiting for later batches.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type {numRobots, robotsPerTrip, numElevators, numFloors}
  OUTPUT: boolean
  
  batchSize ← robotsPerTrip × numElevators
  batchesNeeded ← ceil(numRobots / batchSize)
  RETURN numFloors > 1 AND batchesNeeded > 1
END FUNCTION
```

### Examples

- **10 robots, 1 elevator, 2 robots/trip, 3 floors, verticalTravelTime=2min**: batchSize=2, 5 batches. Robot 0-1 delivered at 2min, robots 2-3 at 4min, ..., robots 8-9 at 10min. Currently ALL start at 10min.
- **6 robots, 2 elevators, 1 robot/trip, 5 floors, verticalTravelTime=3min**: batchSize=2, 3 batches. Robots 0-1 at 3min, 2-3 at 6min, 4-5 at 9min. Currently ALL start at 9min.
- **4 robots, 1 elevator, 4 robots/trip, 2 floors**: batchSize=4, 1 batch. All delivered together — no bug (single batch).
- **3 robots, 1 elevator, 1 robot/trip, 1 floor**: numFloors=1, floorDistTime=0 — no bug (no distribution needed).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When `numFloors <= 1`: no floor distribution occurs, all robots start at time 0 (+ stagger offset)
- When all robots fit in one batch (`numRobots <= batchSize`): all robots get the same delivery time (equivalent to current behavior)
- Stagger offset continues to be applied on top of delivery time
- Battery, tank, and work pool consumption logic remains identical
- Service scheduling (charging, refilling) logic remains identical
- The `computeFloorDistributionTime()` formula itself remains unchanged

**Scope:**
All inputs where `numFloors <= 1` OR `numRobots <= robotsPerTrip × numElevators` should produce identical simulation results to the current code. The fix only changes behavior when multiple batches are needed.

## Hypothesized Root Cause

Based on the code analysis, the root cause is straightforward:

1. **Uniform startAt assignment**: Line `startAt: floorDistTime + i * offset` uses the total `floorDistTime` for every robot, regardless of batch. It should use `deliveryTime(i)` instead.

2. **Uniform elevator segment**: The loop `for (const r of robots) { r.segments.push({ activity: 'elevator', start: 0, end: floorDistTime, ... }) }` gives every robot the same segment duration. Each robot should have a segment ending at its batch-specific delivery time.

3. **Resource tracking initialization**: `dockFreeAt` and `stationFreeAt` are initialized to `floorDistTime`, implying resources are unavailable until all robots are delivered. They should be initialized to 0 since the service hub is available from the start.

4. **Simulation start time**: `currentTime = floorDistTime` jumps past the entire distribution phase. It should start at 0 (or the first batch delivery time) to allow early-batch robots to begin cleaning while later batches are still being delivered.

5. **Initial efficiency point**: Records at `floorDistTime` with 0 robots cleaning. Should record at time 0.

## Correctness Properties

Property 1: Bug Condition - Per-Batch Delivery Times

_For any_ simulation input where the bug condition holds (multiple batches needed AND numFloors > 1), the fixed `simulateTimeline` function SHALL assign each robot at index `i` (0-based) a delivery time of `ceil((i+1) / batchSize) × verticalTravelTime`, set its `startAt` to `deliveryTime(i) + i × offset`, and set its elevator segment to `(0, deliveryTime(i))`.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Single-Batch and Single-Floor Behavior

_For any_ simulation input where the bug condition does NOT hold (numFloors <= 1 OR all robots fit in one batch), the fixed `simulateTimeline` function SHALL produce identical `rawElapsedTime`, robot segments, and timeline data as the original function.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/engine/timeline.ts`

**Function**: `simulateTimeline`

**Specific Changes**:

1. **Compute per-robot delivery time**: After computing `floorDistTime`, calculate each robot's batch-specific delivery time:
   ```typescript
   const batchSize = inputs.num_of_robots_per_elevator_trip * inputs.num_of_elevators;
   ```

2. **Update robot initialization**: Replace uniform `startAt: floorDistTime + i * offset` with:
   ```typescript
   const batchNumber = Math.ceil((i + 1) / batchSize);
   const deliveryTime = inputs.num_of_floors > 1 ? batchNumber * inputs.vertical_travel_time : 0;
   startAt: deliveryTime + i * offset,
   ```

3. **Update elevator segments**: Replace uniform `(0, floorDistTime)` with per-robot `(0, deliveryTime(i))`:
   ```typescript
   if (deliveryTime > 0.01) {
     r.segments.push({ activity: 'elevator', start: 0, end: deliveryTime, robotIndex: r.id - 1 });
   }
   ```
   Move this inside the robot initialization loop.

4. **Update resource tracking**: Initialize to 0 instead of `floorDistTime`:
   ```typescript
   const dockFreeAt = new Array(inputs.num_of_charging_points).fill(0);
   const stationFreeAt = new Array(inputs.num_of_refill_stations).fill(0);
   ```

5. **Update simulation start time**: Start at 0 instead of `floorDistTime`:
   ```typescript
   let currentTime = 0;
   ```

6. **Update initial efficiency point**: Record at time 0 with 0 robots cleaning (already correct if currentTime starts at 0).

7. **Update idle segment padding**: The staggered-start idle segment logic references `floorDistTime` — update to use each robot's delivery time or remove the reference since robots now have per-robot start times embedded in their elevator segments.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write tests with multi-batch scenarios (numFloors > 1, numRobots > batchSize) and assert that robots in earlier batches have earlier start times. Run on UNFIXED code to observe failures.

**Test Cases**:
1. **Multi-batch delivery**: 6 robots, 1 elevator, 2 robots/trip, 3 floors — assert robot 0 starts before robot 4 (will fail on unfixed code)
2. **Elevator segment duration**: Same scenario — assert robot 0's elevator segment is shorter than robot 4's (will fail on unfixed code)
3. **Dead time reduction**: Large fleet (10 robots, 1 elevator, 1 robot/trip) — assert dead time is less than total floorDistTime (will fail on unfixed code)

**Expected Counterexamples**:
- All robots have identical `startAt` values despite being in different batches
- All elevator segments have the same duration `(0, floorDistTime)`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces per-batch delivery times.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := simulateTimeline_fixed(input)
  batchSize := input.robotsPerTrip × input.numElevators
  FOR EACH robot R at index i DO
    batchNum := ceil((i+1) / batchSize)
    expectedDelivery := batchNum × input.verticalTravelTime
    ASSERT R.elevatorSegment.end = expectedDelivery
    ASSERT R.startAt >= expectedDelivery
  END FOR
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

**Test Plan**: Run existing reference scenario tests (which all use numFloors=1) to confirm they pass unchanged. Write additional property-based tests for single-floor and single-batch scenarios.

**Test Cases**:
1. **Existing reference tests pass**: All 9 tests in `timeline-verify.test.ts` use numFloors=1, so they exercise the preservation path
2. **Single-floor preservation**: Generate random inputs with numFloors=1, verify identical results
3. **Single-batch preservation**: Generate random inputs where numRobots <= batchSize, verify identical results

### Unit Tests

- Test per-robot delivery time calculation for various batch configurations
- Test edge cases: 1 robot, numRobots exactly equals batchSize, numFloors=1
- Test stagger offset applied on top of delivery time
- Test resource tracking starts at 0

### Property-Based Tests

- Generate random multi-batch scenarios and verify delivery times follow the batch formula
- Generate random single-floor/single-batch scenarios and verify preservation against original behavior
- Test that total cleaning distance is unchanged regardless of delivery schedule

### Integration Tests

- Test full simulation with multi-floor, multi-batch scenario and verify timeline segments are correct
- Test that efficiency data starts at time 0 with 0% utilization
- Test that dead time is reduced compared to the old uniform-start approach
