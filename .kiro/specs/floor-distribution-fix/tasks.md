# Tasks - Floor Distribution Fix

## Task 1: Implement per-robot batch delivery time in simulateTimeline

- [x] 1.1 Compute batchSize constant after floorDistTime calculation
- [x] 1.2 Replace uniform startAt with per-robot deliveryTime + stagger offset
- [x] 1.3 Move elevator segment creation inside robot init loop with per-robot end time
- [x] 1.4 Initialize dockFreeAt and stationFreeAt to 0 instead of floorDistTime
- [x] 1.5 Set initial currentTime to 0 instead of floorDistTime
- [x] 1.6 Update idle segment padding logic to use per-robot delivery time instead of floorDistTime

## Task 2: Verify existing tests pass (preservation)

- [x] 2.1 Run existing timeline-verify.test.ts tests to confirm no regressions

## Task 3: Add unit tests for multi-batch delivery

- [x] 3.1 Write test: multi-batch scenario verifies per-robot delivery times and elevator segments
- [x] 3.2 Write test: single-batch scenario produces same result as before (all same startAt)
- [x] 3.3 Write test: stagger offset applied on top of delivery time in multi-batch scenario
