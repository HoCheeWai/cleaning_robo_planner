# Implementation Plan: Scenario Comparison & What-Changed Delta Banner

## Overview

Incremental implementation of scenario save/load/compare and delta banner features. The plan starts with the foundational storage service, builds up UI components with state management, adds comparison and delta logic, wires everything into the existing ResultDisplay, and finishes with property-based and unit tests.

## Tasks

- [x] 1. Implement scenarioStorage service
  - [x] 1.1 Create `src/services/scenarioStorage.ts` with CRUD operations
    - Define `SavedScenario` interface (id, name, savedAt, inputs, result)
    - Implement `getScenarios()` — parse localStorage, return empty array on corruption
    - Implement `saveScenario(scenario)` — append to array, enforce max 20 limit, handle quota errors
    - Implement `deleteScenario(id)` — remove by ID, persist updated array
    - Implement `isAtLimit()` — return true when 20 scenarios stored
    - Use dedicated key `cleaning-robot-fleet-scenarios`
    - _Requirements: 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 5.1_

  - [ ]* 1.2 Write property tests for scenarioStorage
    - Create `src/services/__tests__/scenarioStorage.property.test.ts`
    - **Property 1: Round-trip persistence** — save then load preserves all fields
    - **Property 2: Maximum count invariant** — never exceeds 20 scenarios
    - **Property 3: Corrupted data recovery** — arbitrary strings yield empty array
    - **Property 4: Delete removes exactly one** — list shrinks by 1, ID gone
    - _Requirements: 1.2, 1.4, 2.3, 5.1_

- [x] 2. Implement ScenarioPanel component and scenario state
  - [x] 2.1 Create `src/components/ScenarioPanel/ScenarioPanel.tsx` and CSS module
    - Create `ScenarioState` and `ScenarioAction` types
    - Implement `scenarioReducer` with LOAD_SCENARIOS, ADD_SCENARIO, DELETE_SCENARIO, TOGGLE_SELECTION, CLEAR_SELECTION actions
    - Render scenario cards with name, timestamp, mode label, robots, elapsed time
    - Add checkbox for comparison selection per card
    - Add Load and Delete buttons per card
    - Show placeholder when no scenarios exist
    - Disable save when at limit or no result
    - _Requirements: 1.1, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 2.2 Add `LOAD_SCENARIO` action to CalculatorContext
    - Add new action type `{ type: 'LOAD_SCENARIO'; inputs: CalculatorInputs }` to `CalculatorAction` union
    - Implement reducer case: merge inputs, clear result, update customized fields
    - _Requirements: 4.1, 4.2_

  - [ ]* 2.3 Write unit tests for ScenarioPanel
    - Create `src/components/ScenarioPanel/__tests__/ScenarioPanel.test.tsx`
    - Test renders cards, placeholder when empty, disable save at limit
    - Test Load dispatches LOAD_SCENARIO, Delete removes scenario
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 5.1_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement ComparisonTable component
  - [x] 4.1 Create `src/components/ComparisonTable/ComparisonTable.tsx` and CSS module
    - Accept selected scenarios as props
    - Render 2–4 scenarios as columns
    - Display rows: calculation mode, start mode, work assignment mode, number of robots, total elapsed time, dead time minutes, dead time percentage, active cleaning percentage
    - Implement `getBestValueIndex` utility for highlighting (min for time/dead-time, max for active cleaning %)
    - Apply distinct visual style to best value cells
    - Show warning when >4 selected, hide when <2 selected
    - Add "Export Comparison" button
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 4.2 Write property test for best-value highlighting
    - Create `src/components/ComparisonTable/__tests__/bestValue.property.test.ts`
    - **Property 5: Best-value highlighting selects correct index** — min for time metrics, max for active cleaning %
    - _Requirements: 6.3_

  - [ ]* 4.3 Write unit tests for ComparisonTable
    - Create `src/components/ComparisonTable/__tests__/ComparisonTable.test.tsx`
    - Test renders correct columns for 2–4 scenarios
    - Test hides when <2 selected, shows warning when >4
    - _Requirements: 6.1, 6.4, 6.5_

- [x] 5. Implement DeltaBanner component
  - [x] 5.1 Create `src/components/DeltaBanner/DeltaBanner.tsx` and CSS module
    - Accept previous and current `CalculationResult` as props
    - Compute `DeltaMetrics`: elapsed time delta, robot count delta, dead time delta
    - Display green for improvements (less time, fewer robots, less dead time)
    - Display red for degradation (more time, more robots, more dead time)
    - Show "Mode changed — comparison not applicable" when modes differ
    - Implement dismiss button (hides until next recalculation)
    - Handle division by zero (old value is 0) — show absolute change only
    - Do not render when previous result is null
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.4_

  - [ ]* 5.2 Write property test for delta computation
    - Create `src/components/DeltaBanner/__tests__/deltaComputation.property.test.ts`
    - **Property 6: Delta computation correctness** — correct deltas, percentage changes, and color assignments
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 5.3 Write unit tests for DeltaBanner
    - Create `src/components/DeltaBanner/__tests__/DeltaBanner.test.tsx`
    - Test shows/hides correctly, dismiss works, mode-change message displays
    - _Requirements: 8.5, 8.6, 9.2, 9.4_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement comparison PDF export
  - [x] 7.1 Add `generateComparisonPDF` function to `src/services/pdfExport.ts`
    - Accept `SavedScenario[]` (2–4 scenarios)
    - Generate PDF with comparison table: scenario names as column headers, metric rows
    - Include best-value highlighting in PDF (bold or colored cells)
    - Return Blob for download
    - _Requirements: 7.1, 7.2_

  - [ ]* 7.2 Write unit test for generateComparisonPDF
    - Create `src/services/__tests__/generateComparisonPDF.test.ts`
    - Test returns non-empty Blob for valid 2–4 scenario input
    - _Requirements: 7.1, 7.2_

- [x] 8. Integration wiring in ResultDisplay
  - [x] 8.1 Modify `src/components/ResultDisplay/ResultDisplay.tsx`
    - Add "Save Scenario" button (disabled when no result or limit reached)
    - Store previous result in `useRef` for delta comparison
    - Render `DeltaBanner` above results section
    - Render `ScenarioPanel` below results section
    - Clear previous result ref on form reset
    - Wire Save button to open name dialog → call `saveScenario`
    - Wire Load button to dispatch `LOAD_SCENARIO`
    - Wire Delete button to call `deleteScenario`
    - Wire "Export Comparison" to call `generateComparisonPDF` and trigger download
    - Ensure DeltaBanner is excluded from PDF capture DOM
    - _Requirements: 1.1, 1.5, 3.1, 7.3, 8.1, 8.7, 9.1, 9.2, 9.3_

  - [x] 8.2 Update `src/components/index.ts` barrel exports
    - Export ScenarioPanel, ComparisonTable, DeltaBanner
    - _Requirements: N/A (project structure)_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Build verification
  - [x] 10.1 Run full build and verify no TypeScript errors
    - Run `tsc -b && vite build`
    - Fix any type errors or import issues
    - Verify production bundle generates successfully
    - _Requirements: All_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses TypeScript, React 18, vitest, and fast-check (already installed)
- All scenarios use localStorage key `cleaning-robot-fleet-scenarios` (separate from existing input persistence)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "4.1", "5.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "5.2", "5.3", "7.1"] },
    { "id": 4, "tasks": ["7.2", "8.1"] },
    { "id": 5, "tasks": ["8.2"] },
    { "id": 6, "tasks": ["10.1"] }
  ]
}
```
