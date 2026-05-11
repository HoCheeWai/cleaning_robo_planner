# Tasks - Stagger Offset Fix

## Task 1: Implement the stagger offset cap

- [x] 1.1 In `src/engine/timeline.ts` at line ~77, rename `cycleTime` to `rawCycleTime`
- [x] 1.2 Add `const effectiveCycleTime = Math.min(rawCycleTime, cleanPerRobot);` after the rawCycleTime line
- [x] 1.3 Update the offset calculation to use `effectiveCycleTime` instead of `cycleTime`

## Task 2: Add tests for the fix

- [x] 2.1 Add test: "Infinite battery staggered start produces results similar to simultaneous start" in `src/engine/__tests__/timeline-verify.test.ts`
- [x] 2.2 Add test: "All robots contribute to cleaning with infinite battery staggered start" in `src/engine/__tests__/timeline-verify.test.ts`
- [x] 2.3 Run existing tests to verify preservation (no regressions)
