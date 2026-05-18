# Requirements Document

## Introduction

This feature adds two related capabilities to the Cleaning Robot Fleet Calculator: (1) Scenario Comparison — allowing users to save named calculation scenarios and compare them side-by-side in a structured table, and (2) What-Changed Summary — showing a delta banner after recalculation that highlights how key metrics changed from the previous result. Together these features help fleet planners evaluate trade-offs between different configurations without losing context or manually recording results.

## Glossary

- **Scenario_Manager**: The service responsible for persisting, retrieving, and deleting saved scenarios in localStorage
- **Scenario_Card**: A UI component displaying a saved scenario's name, timestamp, and key metrics in a compact card format
- **Comparison_Table**: A UI component that renders selected scenarios side-by-side with highlighted best values per metric row
- **Delta_Banner**: A UI component that displays the difference between the current calculation result and the immediately previous result
- **Saved_Scenario**: A data object containing a name, timestamp, the full CalculatorInputs, and the full CalculationResult at the time of saving
- **Calculator**: The core computation engine that processes inputs and produces a CalculationResult
- **Result_Display**: The UI component that presents calculation results
- **Input_Form**: The UI component that collects all variable inputs from the user
- **PDF_Exporter**: The service that generates PDF documents from calculation results and comparison data

## Requirements

### Requirement 1: Save Scenario

**User Story:** As a fleet planner, I want to save a named snapshot of my current inputs and results after calculating, so that I can recall and compare configurations later.

#### Acceptance Criteria

1. WHEN the user clicks the "Save Scenario" button after a successful calculation, THE Scenario_Manager SHALL display a dialog prompting for a scenario name.
2. WHEN the user confirms the dialog with a non-empty name, THE Scenario_Manager SHALL persist a Saved_Scenario object containing the name, current ISO timestamp, current CalculatorInputs, and current CalculationResult to localStorage.
3. IF localStorage write fails due to quota or other error, THEN THE Scenario_Manager SHALL display an error message indicating the save failed and the reason.
4. THE Scenario_Manager SHALL enforce a maximum of 20 saved scenarios; WHEN the limit is reached, THE Scenario_Manager SHALL disable the save button and display a message indicating the limit has been reached.
5. WHILE no successful calculation result exists, THE Result_Display SHALL disable the "Save Scenario" button.

### Requirement 2: Scenario Persistence

**User Story:** As a fleet planner, I want my saved scenarios to persist between browser sessions, so that I do not lose my saved configurations when I close the browser.

#### Acceptance Criteria

1. THE Scenario_Manager SHALL store all Saved_Scenario objects as a JSON array under a dedicated localStorage key separate from the existing input persistence key.
2. WHEN the application loads, THE Scenario_Manager SHALL read and parse the stored scenarios from localStorage.
3. IF the stored scenario data is corrupted or unparseable, THEN THE Scenario_Manager SHALL discard the corrupted data, initialize an empty scenario list, and log a warning to the console.

### Requirement 3: Display Saved Scenarios

**User Story:** As a fleet planner, I want to see all my saved scenarios displayed as cards with key metrics, so that I can quickly identify and select scenarios for comparison.

#### Acceptance Criteria

1. THE Result_Display SHALL render a "Saved Scenarios" section listing all persisted scenarios as Scenario_Card components.
2. WHEN no scenarios are saved, THE Result_Display SHALL display a placeholder message indicating no scenarios have been saved yet.
3. THE Scenario_Card SHALL display the scenario name, saved timestamp, calculation mode label, number of robots, and total elapsed time.
4. THE Scenario_Card SHALL provide a checkbox for selecting the scenario for comparison.
5. THE Scenario_Card SHALL provide a "Load" button and a "Delete" button.

### Requirement 4: Load Scenario

**User Story:** As a fleet planner, I want to load a saved scenario back into the input form, so that I can resume working from a previously saved configuration.

#### Acceptance Criteria

1. WHEN the user clicks the "Load" button on a Scenario_Card, THE Input_Form SHALL restore all input fields to the values stored in that Saved_Scenario's CalculatorInputs.
2. WHEN a scenario is loaded, THE Calculator SHALL clear any existing calculation result from the display until the user recalculates.

### Requirement 5: Delete Scenario

**User Story:** As a fleet planner, I want to delete saved scenarios I no longer need, so that I can keep my scenario list manageable.

#### Acceptance Criteria

1. WHEN the user clicks the "Delete" button on a Scenario_Card, THE Scenario_Manager SHALL remove that Saved_Scenario from localStorage and update the displayed list.
2. IF the deleted scenario was selected for comparison, THEN THE Comparison_Table SHALL remove it from the comparison view.

### Requirement 6: Compare Scenarios Side-by-Side

**User Story:** As a fleet planner, I want to compare 2 to 4 selected scenarios in a side-by-side table, so that I can evaluate trade-offs between different fleet configurations.

#### Acceptance Criteria

1. WHEN the user selects between 2 and 4 scenarios using the checkboxes, THE Comparison_Table SHALL appear displaying the selected scenarios as columns.
2. THE Comparison_Table SHALL display the following metrics as rows: calculation mode, start mode, work assignment mode, number of robots, total elapsed time, dead time in minutes, dead time percentage, and active cleaning percentage.
3. THE Comparison_Table SHALL highlight the best value in each numeric row using a distinct visual style (for elapsed time, dead time minutes, and dead time percentage the lowest value is best; for active cleaning percentage the highest value is best).
4. WHILE fewer than 2 scenarios are selected, THE Comparison_Table SHALL not be displayed.
5. WHILE more than 4 scenarios are selected, THE Comparison_Table SHALL display a message indicating that a maximum of 4 scenarios can be compared at once.

### Requirement 7: Export Comparison as PDF

**User Story:** As a fleet planner, I want to export the comparison table as a PDF, so that I can share the side-by-side analysis with stakeholders.

#### Acceptance Criteria

1. WHEN the user clicks the "Export Comparison" button while a valid comparison (2–4 scenarios) is displayed, THE PDF_Exporter SHALL generate a PDF document containing the comparison table with all selected scenarios and metrics.
2. THE PDF_Exporter SHALL include scenario names, all metric rows, and best-value highlighting in the exported PDF.
3. WHILE fewer than 2 scenarios are selected for comparison, THE Result_Display SHALL disable the "Export Comparison" button.

### Requirement 8: What-Changed Delta Banner

**User Story:** As a fleet planner, I want to see how key metrics changed after recalculating, so that I can immediately understand the impact of my input adjustments.

#### Acceptance Criteria

1. WHEN the user triggers a calculation and a previous CalculationResult exists in component state, THE Delta_Banner SHALL appear above the Result_Display showing the difference for each changed metric.
2. THE Delta_Banner SHALL display deltas for: total elapsed time (old → new, absolute change, percentage change), number of robots (if changed), and dead time in minutes (old → new, percentage change).
3. WHEN a metric value decreases (less time, fewer robots, less dead time), THE Delta_Banner SHALL display that delta in green to indicate improvement.
4. WHEN a metric value increases (more time, more robots, more dead time), THE Delta_Banner SHALL display that delta in red to indicate degradation.
5. IF the calculation mode changed between the previous and current result (e.g., time-constraint to robot-count), THEN THE Delta_Banner SHALL display "Mode changed — comparison not applicable" instead of metric deltas.
6. WHEN the user dismisses the Delta_Banner, THE Delta_Banner SHALL hide until the next recalculation.
7. WHEN the user resets the form, THE Delta_Banner SHALL clear the stored previous result and hide.

### Requirement 9: Delta Banner Scope and Exclusion

**User Story:** As a fleet planner, I want the delta banner to be transient and excluded from exports, so that it does not clutter permanent outputs.

#### Acceptance Criteria

1. THE Delta_Banner SHALL store the previous CalculationResult in React component state only; the previous result SHALL NOT be persisted to localStorage.
2. WHEN the page is reloaded, THE Delta_Banner SHALL not display (no previous result exists in component state after reload).
3. THE PDF_Exporter SHALL exclude the Delta_Banner content from all generated PDF documents.
4. WHEN the first calculation is performed after page load, THE Delta_Banner SHALL not display (no previous result to compare against).
