# Bugfix Requirements Document

## Introduction

The floor distribution phase in the timeline simulation incorrectly models elevator delivery as a single fixed-duration block where ALL robots wait for the total distribution time before starting to clean. In reality, elevators deliver robots incrementally in batches — the first batch is ready much earlier than the last batch. This causes a massive overestimation of dead time and underutilization of early-arriving robots, especially when the fleet is large relative to elevator capacity.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN multiple robots are distributed across floors via elevators THEN the system assigns every robot the same elevator segment from time 0 to the total floor distribution time, regardless of which batch the robot belongs to

1.2 WHEN multiple robots are distributed across floors via elevators THEN the system sets every robot's `startAt` to the total floor distribution time, causing all robots to begin cleaning simultaneously after the last batch is delivered

1.3 WHEN the fleet is large relative to elevator capacity (e.g., 100 robots with 2 elevators carrying 1 robot/trip) THEN the system reports excessive dead time because early-batch robots are modelled as idle while waiting for later batches to be delivered

### Expected Behavior (Correct)

2.1 WHEN multiple robots are distributed across floors via elevators THEN the system SHALL assign each robot an elevator segment from time 0 to that robot's batch-specific delivery time, where batch number = ceil(robotIndex / (robotsPerTrip × numElevators)) and delivery time = batchNumber × verticalTravelTime

2.2 WHEN multiple robots are distributed across floors via elevators THEN the system SHALL set each robot's `startAt` to its batch-specific delivery time (plus any stagger offset), allowing earlier batches to begin cleaning before later batches are delivered

2.3 WHEN the fleet is large relative to elevator capacity THEN the system SHALL produce a timeline where early-batch robots begin cleaning as soon as their batch is delivered, reducing reported dead time to only the per-robot elevator wait

### Unchanged Behavior (Regression Prevention)

3.1 WHEN there is only one floor (numFloors <= 1) THEN the system SHALL CONTINUE TO skip floor distribution entirely (floorDistTime = 0)

3.2 WHEN all robots fit in a single batch (numRobots <= robotsPerTrip × numElevators) THEN the system SHALL CONTINUE TO assign all robots the same start time since they are all delivered in one trip

3.3 WHEN stagger offset is applied in staggered start mode THEN the system SHALL CONTINUE TO apply the stagger offset on top of each robot's elevator-based start time

3.4 WHEN robots begin cleaning THEN the system SHALL CONTINUE TO correctly track battery, tank, and work pool consumption identically to the current logic

3.5 WHEN computing the total floor distribution time via `computeFloorDistributionTime()` THEN the system SHALL CONTINUE TO return the same total value (the formula itself is correct for total overhead)

---

## Bug Condition (Formal)

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SimulationInput (numRobots, robotsPerTrip, numElevators, numFloors)
  OUTPUT: boolean
  
  // The bug manifests when there are multiple batches needed for floor distribution
  batchesNeeded ← ceil(X.numRobots / (X.robotsPerTrip × X.numElevators))
  RETURN X.numFloors > 1 AND batchesNeeded > 1
END FUNCTION
```

### Property Specification (Fix Checking)

```pascal
// Property: Fix Checking - Staggered Elevator Delivery
FOR ALL X WHERE isBugCondition(X) DO
  result ← simulateTimeline'(X)
  batchSize ← X.robotsPerTrip × X.numElevators
  FOR EACH robot R at index i (0-based) DO
    batchNumber ← ceil((i + 1) / batchSize)
    expectedDeliveryTime ← batchNumber × X.verticalTravelTime
    ASSERT R.elevatorSegment.end = expectedDeliveryTime
    ASSERT R.startAt >= expectedDeliveryTime
  END FOR
END FOR
```

### Preservation Property

```pascal
// Property: Preservation Checking - Non-buggy inputs unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT simulateTimeline(X) = simulateTimeline'(X)
END FOR
```
