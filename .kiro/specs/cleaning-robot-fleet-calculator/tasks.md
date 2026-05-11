# Implementation Plan: Cleaning Robot Fleet Calculator

## Overview

Build a client-side React 18 + TypeScript + Vite application that calculates cleaning robot fleet requirements. Implementation follows the layered architecture: Validation → Calculation Engine → Services → State → UI. Each task builds incrementally, wiring components together as they are completed.

## Tasks

- [x] 1. Project setup and core type definitions
  - [x] 1.1 Initialize Vite + React + TypeScript project with CSS Modules support
    - Run `npm create vite@latest` with React + TypeScript template
    - Install dependencies: zod, xlsx (SheetJS), jspdf, jspdf-autotable, fast-check
    - Configure Vitest in vite.config.ts
    - Set up directory structure: `src/engine/`, `src/services/`, `src/components/`, `src/state/`, `src/types/`
    - _Requirements: All (project foundation)_

  - [x] 1.2 Define all TypeScript interfaces and types
    - Create `src/types/index.ts` with: CalculationMode, StartMode, WorkAssignmentMode, CalculatorInputs, DerivedValues, CalculationResult, TimeContributions, OptimizationSuggestion, ActivityType, TimelineSegment, RobotTimeline, EfficiencyDataPoint, ValidationError, ValidationResult, InfeasibilityResult, DeadTimeAnalysis
    - Create `src/types/defaults.ts` with DEFAULT_INPUTS constant (including `work_assignment_mode: 'fixed-zones'`) and field metadata (units, tooltips, default justifications)
    - _Requirements: 1.1, 7.1, 15.2, 20.2_

- [x] 2. Validation service
  - [x] 2.1 Implement Zod validation schema and validation service
    - Create `src/services/validation.ts`
    - Define Zod schema for all input fields with appropriate constraints
    - Implement `validateField(field, value)` for single-field validation
    - Implement `validateAll(inputs, mode)` for full-form validation (mode-aware: skip num_of_robots in time-constraint mode, skip time_constraint in robot-count mode)
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.2, 4.2, 4.3, 4.4, 4.5, 5.2, 5.3, 6.2, 17.3_

  - [ ]* 2.2 Write property tests for input validation
    - **Property 1: Input validation rejects all invalid values**
    - **Property 21: Form blocks submission on invalid inputs**
    - Create `src/services/__tests__/validation.property.test.ts`
    - Use fast-check to generate invalid values for each field type and verify rejection
    - **Validates: Requirements 2.2–2.5, 3.2, 4.2–4.5, 5.2, 5.3, 6.2, 17.3**

- [x] 3. Calculation engine — formula functions
  - [x] 3.1 Implement core formula functions
    - Create `src/engine/formulas.ts`
    - Implement `computeTotalCleaningDistance(areaPerFloor, numFloors, numPasses, cleaningWidth, overlapPct)`
    - Implement `computeUsableBatteryTime(totalBatteryLife, batteryReserveThreshold)`
    - Implement `computeCleaningTimePerRobot(totalDistance, speed, numRobots)`
    - Implement `computeRechargeCycles(cleaningTime, usableBatteryTime)`
    - Implement `computeRefillCycles(cleaningTime, tankCapacityTime)`
    - Implement `computeChargingContention(numRobots, numDocks, chargeTime)`
    - Implement `computeRefillContention(numRobots, numStations, refillDuration)`
    - Implement `computeTravelTimeToServiceHub(distance, speed)`
    - Implement `computeFloorDistributionTime(numRobots, robotsPerTrip, numElevators, verticalTravelTime, numFloors)`
    - _Requirements: 5.4, 5.6, 5.7, 6.3, 6.4, 8.2, 8.3, 8.5, 8.6, 8.7, 8.10, 9.2, 9.3, 9.4, 9.5, 9.6, 9.9_

  - [ ]* 3.2 Write property tests for formula functions
    - **Property 2: Total cleaning distance formula**
    - **Property 3: Usable battery time formula**
    - **Property 4: Cleaning time per robot formula**
    - **Property 5: Service cycle computation**
    - **Property 6: Contention time computation**
    - **Property 7: Travel time to service hub formula**
    - **Property 8: Floor distribution time formula**
    - Create `src/engine/__tests__/formulas.property.test.ts`
    - Use fast-check arbitraries constrained to valid input ranges
    - **Validates: Requirements 5.4, 5.6, 5.7, 6.3, 6.4, 8.2–8.10, 9.2–9.9**

- [x] 4. Calculation engine — timeline simulation
  - [x] 4.1 Implement timeline simulation
    - Create `src/engine/timeline.ts`
    - Implement `simulateTimeline(inputs, numRobots, startMode): { timelines: RobotTimeline[], efficiencyData: EfficiencyDataPoint[] }`
    - **Event-driven concurrent drain model**: Use a priority-queue-based event-driven simulation where ALL currently-cleaning robots drain the pool/battery/tank simultaneously at the combined rate between events. A robot must NOT pre-claim its entire next cleaning segment from the pool. Instead:
      1. Maintain a priority queue of upcoming events (battery empty, tank empty, pool empty, service complete, robot starts cleaning)
      2. Between events, advance simulation clock and drain pool at `num_cleaning_robots × effective_speed`; each cleaning robot's battery and tank drain at 1 min/min
      3. At each event, process state transitions (robot leaves cleaning → enters service, robot finishes service → resumes cleaning, pool reaches 0 → job done)
      4. When the number of cleaning robots changes, recalculate scheduled pool-empty events based on the new drain rate
    - **Determinism**: The simulation must be fully deterministic. Use deterministic tie-breaking: when multiple robots reach an event at the same time, process them in robot ID order (lowest first). No randomness or non-deterministic data structures (e.g., hash maps with random iteration order) shall be used.
    - Support two work assignment modes via `inputs.work_assignment_mode`:
      - **Fixed Zones**: Each robot gets `remainingCleaningTime = cleaningTimePerRobot` (total_cleaning_distance / (effective_speed × numRobots)). Robot sits idle after finishing its share.
      - **Collaborative**: Maintain a `sharedRemainingDistance` pool. All currently-cleaning robots drain it simultaneously at the combined rate. When a robot returns from service, it checks the pool and continues if work remains. Job completes when pool reaches 0.
    - **Efficiency data production**: At each state transition (whenever a robot starts or stops cleaning), record an EfficiencyDataPoint with the current time, fleet_utilization_pct = (robots_currently_cleaning / num_of_robots) × 100, and cumulative_progress_pct = (distance_cleaned_so_far / total_cleaning_distance) × 100
    - For simultaneous start: all robots begin at t=0, use priority queues for dock/station scheduling
    - For staggered start: offset robot i by `i × (single_robot_cycle_time / numRobots)`
    - Insert waiting segments when resources are occupied
    - Pad with idle segments so all robots end at the same total elapsed time (in fixed-zones mode, robots that finish early get idle segments; in collaborative mode, idle segments should be minimal)
    - Implement `computeSimulatedElapsedTime(timelines): number` returning the max end time across all robot timelines (the rightmost point on the Gantt chart)
    - **Validation target**: The simulation must produce results matching the validated prototype for the test scenario (3 robots, 2 docks, 1 station, 2000m², battery 96min, tank 60min): Simultaneous+Fixed=335.6min, Simultaneous+Collaborative=268.7min, Staggered+Fixed=335.6min, Staggered+Collaborative=277.5min
    - _Requirements: 8.8, 8.9, 8.10, 8.11, 8.12, 8.16, 8.17, 9.7, 9.8, 9.9, 9.10, 9.11, 9.14, 9.15, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.14, 11.15, 20.3, 20.4, 20.5, 20.6_

  - [ ]* 4.2 Write property tests for timeline simulation
    - **Property 9: Total elapsed time equals simulation completion time × buffer**
    - **Property 13: Simultaneous start — all robots begin at t=0**
    - **Property 14: Staggered start — robots offset correctly**
    - **Property 15: Timeline resource exclusivity**
    - **Property 16: Timeline equal span**
    - **Property 22: Collaborative mode never exceeds Fixed Zones elapsed time**
    - **Property 23: Collaborative mode — no idle robot while work remains**
    - **Property 24: Collaborative mode — dynamic drain rate accounts for all work**
    - **Property 25: Efficiency data boundary conditions**
    - **Property 26: Simulation determinism**
    - Create `src/engine/__tests__/timeline.property.test.ts`
    - Verify resource constraints are never violated at any point in time
    - Verify that computeTotalElapsedTime returns max(timeline end times) × field_buffer_multiplier
    - Verify collaborative mode elapsed time ≤ fixed-zones elapsed time for same inputs
    - Verify no robot is idle while shared pool has remaining work (collaborative mode)
    - Verify that sum of all cleaning segment durations × effective_speed equals total_cleaning_distance (within floating-point tolerance) in collaborative mode, confirming the dynamic drain rate correctly accounts for all work
    - Verify that cumulative_progress_pct reaches 100% at simulation completion and fleet_utilization_pct is 0% when no robots are cleaning
    - Verify that running the simulation twice with identical inputs produces byte-identical CalculationResult objects (same timelines, same elapsed time, same work distribution)
    - **Validates: Requirements 8.8, 8.10, 8.11, 8.12, 8.16, 9.7, 9.9, 9.10, 9.14, 11.4, 11.5, 11.7, 11.8, 11.15, 20.3, 20.4, 20.5, 20.6**

- [x] 5. Calculation engine — solver (simulation-based) and elapsed time
  - [x] 5.1 Implement total elapsed time computation and solvers
    - Create `src/engine/solver.ts`
    - Implement `computeTotalElapsedTime(inputs, numRobots)` which runs `simulateTimeline` and returns the simulation completion time × field_buffer_multiplier (the simulation is the source of truth)
    - Implement `solveRobotCount(inputs): CalculationResult` — runs simulation for given num_of_robots to get total_elapsed_time
    - Implement `solveTimeConstraint(inputs): CalculationResult` — iterative solver incrementing from 1 to 1000 robots, running the simulation for each candidate to find the minimum fleet size
    - Implement `computeDerivedValues(inputs, numRobots): DerivedValues`
    - Implement `extractBreakdownFromTimeline(timelines, numRobots, fieldBufferMultiplier): TimeContributions` — aggregates simulation segment durations by activity type to produce approximate percentage contributions for the explanatory breakdown
    - Implement `computeOptimizations(contributions): OptimizationSuggestion[]` returning top 3 by contribution
    - Implement `computeDeadTime(timelines, rawElapsed): DeadTimeAnalysis` — identifies all periods where zero robots are in the cleaning state, returns total dead time, list of dead periods (start/end), and dead time percentage. This is a key metric for identifying service storms
    - _Requirements: 8.1, 8.4, 8.8, 8.9, 8.11, 8.12, 9.1, 9.7, 9.8, 9.10, 9.11, 10.2, 10.3, 10.4, 10.6_

  - [ ]* 5.2 Write property tests for solver
    - **Property 10: Time Constraint solver produces valid result**
    - **Property 11: Percentage contributions sum to 100%**
    - **Property 12: Top-3 optimizations correctly ranked**
    - Create `src/engine/__tests__/solver.property.test.ts`
    - For Property 10, generate feasible inputs and verify minimality (n-1 robots exceed constraint when simulated)
    - **Validates: Requirements 8.1, 8.4, 8.11, 9.10, 10.3, 10.4**

- [x] 6. Calculation engine — infeasibility detection
  - [x] 6.1 Implement infeasibility detection
    - Create `src/engine/infeasibility.ts`
    - Implement `detectInfeasibility(inputs): InfeasibilityResult | null`
    - Check: solver exceeds 1000 robots without meeting constraint (simulation-based)
    - Check: minimum single-robot cycle time exceeds constraint
    - Check: elevator throughput bottleneck
    - Generate binding constraint descriptions and actionable suggestions (e.g., "Add 1 more charging dock to reduce contention by Y minutes")
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 6.2 Write property test for infeasibility detection
    - **Property 17: Infeasibility detection**
    - Create test in `src/engine/__tests__/solver.property.test.ts` (or separate file)
    - Generate inputs where time_constraint is less than minimum achievable time and verify infeasible flag
    - **Validates: Requirements 12.1**

- [x] 7. Calculation engine — main entry point
  - [x] 7.1 Create CalculationEngine facade
    - Create `src/engine/index.ts`
    - Implement `compute(inputs: CalculatorInputs): CalculationResult` that orchestrates validation, solver selection, timeline simulation, and infeasibility detection
    - Wire together all engine sub-modules
    - _Requirements: 8.1, 9.1_

- [x] 8. Checkpoint — Core engine complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Services — localStorage, spreadsheet, PDF
  - [x] 9.1 Implement LocalStorage service
    - Create `src/services/localStorage.ts`
    - Implement `saveInputs(inputs: CalculatorInputs): void` with version metadata and ISO timestamp
    - Implement `loadInputs(): CalculatorInputs | null` with error handling for corrupted/missing data
    - Implement `clearInputs(): void`
    - Handle storage-full errors gracefully (non-blocking warning)
    - _Requirements: 14.1, 14.2, 14.3_

  - [ ]* 9.2 Write property test for localStorage round-trip
    - **Property 18: LocalStorage round-trip**
    - Create `src/services/__tests__/localStorage.property.test.ts`
    - Generate arbitrary valid CalculatorInputs and verify serialize → deserialize equality
    - **Validates: Requirements 14.1, 14.2**

  - [x] 9.3 Implement Spreadsheet service
    - Create `src/services/spreadsheet.ts`
    - Implement `parseSpreadsheet(file: File): Promise<{inputs: Partial<CalculatorInputs>, warnings: string[]}>`
    - Support .csv and .xlsx formats using SheetJS
    - Map recognized variable names to CalculatorInputs fields, collect unrecognized names as warnings
    - Implement `generateTemplate(): Blob` that creates a .csv with all variable names and default values
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_

  - [ ]* 9.4 Write property test for spreadsheet parsing
    - **Property 19: Spreadsheet parsing correctness**
    - Create `src/services/__tests__/spreadsheet.property.test.ts`
    - Generate subsets of valid variable names with valid values, format as CSV, verify parsing
    - **Validates: Requirements 16.2**

  - [x] 9.5 Implement PDF export service
    - Create `src/services/pdfExport.ts`
    - Implement `generatePDF(inputs, result, comments, timelineChartSvg?): Blob`
    - Include: title with date and mode, all input values with labels, full breakdown, percentage contributions, optimization opportunities, comments, infeasibility analysis if applicable
    - Format for A4 with margins and page breaks
    - Filename format: `fleet_calculation_YYYY-MM-DD_HHmm.pdf`
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 12.6_

- [x] 10. State management
  - [x] 10.1 Implement React Context and reducer for calculator state
    - Create `src/state/CalculatorContext.tsx`
    - Implement `calculatorReducer` handling all CalculatorAction types (including SET_WORK_ASSIGNMENT_MODE)
    - Track `hasCustomizedFields` set for visual distinction of modified fields
    - On CALCULATE action: run validation → compute → update result
    - On RESET: clear localStorage, reset to defaults
    - On LOAD_FROM_STORAGE: restore inputs on mount
    - On LOAD_FROM_SPREADSHEET: merge uploaded values into state
    - Provide context with state + dispatch + derived convenience values
    - _Requirements: 1.1, 1.4, 14.1, 14.2, 14.3, 15.5, 20.2, 20.8_

- [x] 11. Checkpoint — Services and state complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. UI components — Input form
  - [x] 12.1 Implement InputField and DerivedField components
    - Create `src/components/InputField/InputField.tsx` with CSS Module
    - Props: label, name, value, unit, tooltip, defaultValue, isCustomized, error, onChange, type (number/toggle)
    - Display persistent unit suffix, inline validation error, customization indicator
    - Tooltip on hover (desktop) and tap (mobile) with explanation + default justification
    - Minimum 44×44px touch targets
    - Create `src/components/DerivedField/DerivedField.tsx` for read-only computed fields
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 13.3, 15.1, 15.5_

  - [x] 12.2 Implement ModeSelector component
    - Create `src/components/ModeSelector/ModeSelector.tsx` with CSS Module
    - Two-option toggle: "Time Constraint" and "Robot Count"
    - Default to "Time Constraint" on initial load
    - Dispatch SET_MODE action on change
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 12.3 Implement InputForm with all sections
    - Create `src/components/InputForm/InputForm.tsx` with CSS Module
    - Sections: WorkloadSection, FleetSection, PerformanceSection, TimeTransitionSection, LogisticalSection
    - Conditionally show time_constraint or num_of_robots based on mode
    - Show derived fields (travel_time_to_service_hub, charging_contention_time, refill_contention_time, num_of_recharge_cycles, num_of_refill_cycles) as read-only
    - Disable service_hub_on_different_floor when num_of_floors = 1 with tooltip explanation
    - Dynamic default for distance_to_service_hub: recalculate as sqrt(actual_area_per_floor / π) when area changes (unless manually overridden)
    - Show zero-contention notes when robots ≤ docks/stations
    - _Requirements: 2.1, 3.1, 3.4, 4.1, 5.1, 5.5, 5.8, 5.9, 5.10, 6.1, 6.5, 15.3, 15.6_

  - [x] 12.4 Implement ValidationSummary, action buttons, StartModeToggle, and WorkAssignmentModeToggle
    - Create `src/components/ValidationSummary/ValidationSummary.tsx`
    - Display all validation errors at top of form, remove errors in real-time as corrected
    - Implement action buttons: Calculate, Reset, Use All Defaults, Download Template
    - Implement StartModeToggle (Simultaneous / Staggered)
    - Implement WorkAssignmentModeToggle (Fixed Zones / Collaborative) with default "Fixed Zones"
    - Dispatch SET_WORK_ASSIGNMENT_MODE action on change
    - Implement CommentsField (multi-line textarea with character count)
    - Implement SpreadsheetUpload button with file input (.csv, .xlsx)
    - _Requirements: 11.3, 16.1, 16.6, 17.1, 17.2, 17.3, 18.1, 18.2, 18.5, 14.3, 15.4, 20.1, 20.2, 20.7, 20.8_

  - [ ]* 12.5 Write property test for dynamic default distance_to_service_hub
    - **Property 20: Dynamic default for distance_to_service_hub**
    - Create `src/components/__tests__/InputForm.test.ts`
    - Verify that for any positive actual_area_per_floor, the default equals sqrt(area / π)
    - **Validates: Requirements 15.6**

- [x] 13. UI components — Result display
  - [x] 13.1 Implement ResultDisplay with breakdown and optimizations
    - Create `src/components/ResultDisplay/ResultDisplay.tsx` with CSS Module
    - Show primary result prominently (robot count or elapsed time)
    - Display time in minutes, and hours+minutes when > 60 min
    - Clearly label which work assignment mode and start mode was used in the result
    - Display total dead time (sum of periods where zero robots are cleaning) as a prominent metric alongside elapsed time, helping users identify service storm bottlenecks
    - Step-by-step breakdown with tooltips explaining each formula
    - Percentage contribution bars for each time component
    - Top-3 optimization opportunities highlighted
    - Show per-robot work distribution (how much each robot cleaned as % of total)
    - _Requirements: 9.11, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 20.7, 20.8_

  - [x] 13.2 Implement InfeasibilityPanel
    - Create `src/components/InfeasibilityPanel/InfeasibilityPanel.tsx` with CSS Module
    - Prominent "Infeasible" warning with plain-language explanation
    - List binding constraints
    - Ranked actionable suggestions
    - 24-hour warning for Robot Count mode
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 13.3 Implement TimelineChart (Gantt SVG)
    - Create `src/components/TimelineChart/TimelineChart.tsx` with CSS Module
    - Render horizontal stacked bar chart with SVG
    - One row per robot, all rows sharing a single synchronized x-axis (time in minutes) ensuring visual alignment
    - Each bar segment's horizontal position and width SHALL correspond exactly to its start time and duration on the shared x-axis
    - Color-coded segments: cleaning (green), traveling (blue), charging (yellow), waiting-charge (orange), refilling (purple), waiting-refill (red), elevator (grey), idle (light grey)
    - Colour legend placed OUTSIDE the chart area (above or below), not overlapping any bar segments
    - Tooltip on hover/tap showing activity name, start, end, duration
    - Responsive: horizontal scroll on narrow viewports, robot labels fixed left
    - _Requirements: 11.1, 11.2, 11.8, 11.9, 11.10, 11.11, 11.13_

  - [x] 13.4 Implement EfficiencyGraph (dual-axis line chart)
    - Create `src/components/EfficiencyGraph/EfficiencyGraph.tsx` with CSS Module
    - Render a dual-axis line chart using custom SVG, positioned directly below the TimelineChart and sharing the same x-axis (time in minutes)
    - Left y-axis (0–100%): Fleet Utilization % — (robots_currently_cleaning / num_of_robots) × 100
    - Right y-axis (0–100%): Cumulative Progress % — (distance_cleaned_so_far / total_cleaning_distance) × 100
    - Two visually distinct lines (different colours and/or line styles) with a legend identifying each
    - Shade dead-time zones (periods where utilization = 0%) with a subtle background colour to make service storms visually obvious
    - Tooltip on hover showing time, fleet utilization %, and cumulative progress %
    - Responsive layout matching the TimelineChart width
    - Include in PDF export alongside the Gantt chart
    - _Requirements: 10.6, 11.14, 11.15, 11.16, 11.17, 11.18_

  - [x] 13.5 Implement Export PDF button
    - Add "Export as PDF" button to ResultDisplay, enabled only after successful calculation
    - Wire to PDFExportService, include timeline chart SVG and efficiency graph SVG in export
    - _Requirements: 19.1, 19.5, 11.12, 11.17_

- [x] 14. App shell and responsive layout
  - [x] 14.1 Implement App component, Header, Footer, and responsive layout
    - Create `src/App.tsx` wiring CalculatorContext provider, InputForm, ResultDisplay
    - Create `src/components/Header/Header.tsx` and `src/components/Footer/Footer.tsx`
    - Implement responsive CSS: multi-column grid ≥768px, single-column <768px
    - Ensure readability without horizontal scroll at 320px width
    - Pre-populate all fields with defaults on initial load (or from localStorage)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 15.3_

- [x] 15. Checkpoint — Full UI wired
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Integration and end-to-end wiring
  - [x] 16.1 Wire complete data flow and verify end-to-end scenarios
    - Verify: mode switch hides/shows correct fields
    - Verify: Calculate button triggers validation → engine → result display
    - Verify: Reset clears localStorage and resets to defaults
    - Verify: Spreadsheet upload populates fields and triggers validation
    - Verify: PDF export generates downloadable file with correct filename
    - Verify: localStorage persists inputs on calculate, restores on reload
    - Verify: infeasibility panel shows when solver cannot find solution
    - Verify: timeline chart renders for both start modes
    - _Requirements: 1.2, 1.3, 8.14, 14.1, 14.2, 16.3, 19.1_

  - [ ]* 16.2 Write integration tests
    - Test full calculation flow with known inputs and expected outputs (use reference scenario: 3 robots, 2 docks, 1 station, 2000m² — verify raw times match 335.6/268.7/335.6/277.5 for the 4 combinations)
    - Test dead time computation matches expected values (137.3/93.4/79.4/47.6 min)
    - Test per-robot work distribution matches expected splits
    - Test spreadsheet upload → field population → calculate
    - Test localStorage persistence simulation
    - _Requirements: 8.1, 8.16, 9.1, 9.14, 10.6, 14.1, 16.3_

- [x] 17. Final checkpoint — All features complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit/integration tests validate specific examples and edge cases
- The calculation engine is built first (tasks 2–7) because it is pure logic with no UI dependencies, enabling thorough testing before UI integration
- The timeline simulation (task 4) is built BEFORE the solver (task 5) because the solver depends on the simulation to compute total elapsed time. The simulation is the source of truth for elapsed time, not the aggregate formula
- The aggregate formula functions (task 3) are still needed for derived values display and the explanatory breakdown, but they do not determine the final result
- Both start modes (simultaneous and staggered) produce their own total elapsed time via simulation
- The work assignment mode (Fixed Zones vs Collaborative) affects how the timeline simulation distributes cleaning work among robots. Fixed Zones is the default and matches current-generation robot behavior. Collaborative mode uses a shared work pool and should always produce equal or shorter elapsed time.
- **"Fastest total time" and "highest fleet utilization" are different optimization targets.** Simultaneous start finishes sooner but creates "service storms" (long dead periods where all robots are servicing simultaneously). Staggered start takes longer but keeps robots productive more of the time. The app must display BOTH metrics (elapsed time AND dead time) so users can make informed decisions.
- **Dead time (service storms)** must be computed and displayed prominently. It is the sum of all periods where zero robots are actively cleaning. This is a critical metric for understanding fleet efficiency.

## Post-Implementation Bugfixes

The following bugfixes were applied after the initial implementation. Their specs are in separate directories under `.kiro/specs/`. These notes ensure a rebuild from scratch would include these corrections.

### Efficiency Graph Fix (`.kiro/specs/efficiency-graph-fix/`)
- Fleet Utilization line rendered as step function (H/V SVG commands), not linear interpolation
- X-axis ticks on both Gantt chart and efficiency graph use nice round intervals via `niceTickInterval()` algorithm
- Small vertical tick marks added to x-axis for readability
- Efficiency data recording fixed to capture the initial transition when robots first start cleaning after floor distribution
- Explanatory note added above charts: "Charts show raw simulation time (X min). The reported elapsed time (Y min) includes the ×Z field buffer."
- Path-building and tick logic extracted to `src/components/EfficiencyGraph/graphUtils.ts` for testability

### PDF Chart Export Fix (`.kiro/specs/pdf-chart-export/`)
- Gantt chart and efficiency graph captured as PNG images and embedded in PDF via `svgToDataUrl()` + `doc.addImage()`
- Colour-coded legends rendered below each chart in the PDF
- PDF section ordering matches web display sequence
- "Field Buffer" row added to PDF breakdown table
- "Assumptions & Limitations" section added to PDF
- Explanatory note about raw vs buffered time included in PDF

### Stagger Offset Fix (`.kiro/specs/stagger-offset-fix/`)
- Stagger offset capped at `min(rawCycleTime, cleanPerRobot) / numRobots` to prevent absurdly large offsets when battery/tank are very large (infinite)
- Without this cap, only Robot 1 would ever clean when battery/tank exceed cleaning time

### Floor Distribution Fix (`.kiro/specs/floor-distribution-fix/`)
- Robots released incrementally by elevator batch instead of all waiting for total floor distribution time
- Each robot's delivery time = `ceil((i+1) / batchSize) × verticalTravelTime × (numFloors - 1)`
- Earlier batches begin cleaning immediately without waiting for later batches
- Resource tracking (dockFreeAt, stationFreeAt) initialized to 0
- Simulation starts at `currentTime = 0` to allow incremental robot activation
