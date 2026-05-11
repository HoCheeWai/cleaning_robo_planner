# Bugfix Requirements Document

## Introduction

The stagger offset calculation in the Cleaning Robot Fleet Calculator produces absurdly large offsets when battery and/or tank capacity are very large (or effectively infinite). This causes only the first robot to perform any cleaning while all subsequent robots are scheduled to start far in the future — well after the work is already complete. The fix must cap the stagger offset so that robots are distributed within the actual cleaning duration, ensuring all robots contribute to the work.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN battery capacity and/or tank capacity are very large (e.g., 99999 min) AND start mode is "Staggered Start" THEN the system computes a stagger offset of approximately `cycleTime / numRobots` where cycleTime ≈ 99999 min, resulting in offsets far exceeding the total cleaning time

1.2 WHEN the stagger offset exceeds the total cleaning time per robot THEN the system schedules robots 2..N to start after all work is already completed by Robot 1, meaning only Robot 1 performs any cleaning

1.3 WHEN only Robot 1 cleans (due to excessive stagger offset) THEN the system reports an elapsed time equivalent to a single robot cleaning alone (e.g., ~1083.8 min instead of ~352.9 min), negating the benefit of multiple robots

### Expected Behavior (Correct)

2.1 WHEN battery capacity and/or tank capacity are very large AND start mode is "Staggered Start" THEN the system SHALL cap the effective cycle time used for stagger offset calculation to be no greater than the cleaning time per robot (`cleanPerRobot`)

2.2 WHEN the stagger offset is capped THEN the system SHALL schedule all robots to start within the expected cleaning duration, ensuring every robot contributes to the work

2.3 WHEN all robots start within the cleaning duration THEN the system SHALL produce an elapsed time comparable to simultaneous start (since large battery/tank means no service contention to stagger around)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN battery and tank capacity are finite and the raw cycle time is less than or equal to the cleaning time per robot THEN the system SHALL CONTINUE TO compute the stagger offset as `cycleTime / numRobots` without any capping

3.2 WHEN start mode is "Simultaneous Start" THEN the system SHALL CONTINUE TO set the stagger offset to zero regardless of battery or tank capacity

3.3 WHEN battery or tank capacity requires periodic servicing (normal operation) THEN the system SHALL CONTINUE TO stagger robots evenly across the service cycle to distribute resource usage over time
