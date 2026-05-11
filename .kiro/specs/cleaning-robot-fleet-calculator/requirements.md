# Requirements Document

## Introduction

A responsive web application that serves as a cleaning robot fleet calculator/planner. The application operates in two modes: (1) given a time constraint, calculate the number of robots required to complete a cleaning task, and (2) given a number of available robots, calculate the time to complete the task. The calculator considers workload coverage, fleet infrastructure, performance characteristics, transition times, and logistical multipliers to produce a detailed, explainable output that supports fleet purchasing decisions.

## Glossary

- **Calculator**: The core computation engine of the web application that processes input variables and produces fleet planning results
- **Input_Form**: The user interface component that collects all variable inputs from the user
- **Result_Display**: The user interface component that presents calculation results with per-variable contribution breakdowns
- **Mode_Selector**: The UI control that allows the user to switch between "Time Constraint" mode and "Robot Count" mode
- **actual_area_per_floor**: floor space per floor (m²) to be cleaned
- **num_of_passes**: positive integer representing the number of cleaning passes (typically 1–3), where each additional pass multiplies the effective workload
- **overlap_percentage**: cleaning overlap fraction to ensure no streaks (e.g., 0.10 for 10%)
- **effective_cleaning_width**: actual cleaning path width (m)
- **num_of_robots**: total number of robots in the deployment
- **num_of_charging_points**: number of charging docks available
- **num_of_refill_stations**: number of water/drainage points for consumables
- **num_of_floors**: total number of floors the fleet must service
- **num_of_robots_per_elevator_trip**: number of robots that can fit in a single lift trip
- **num_of_elevators**: total number of elevators available for robot transport between floors
- **service_hub_on_different_floor**: boolean flag indicating whether the charging/refill hub is located on a different floor from the cleaning zones (when true, vertical_travel_time is added to each service trip)
- **effective_speed**: actual operational speed (m/min)
- **total_battery_life**: rated runtime on a 100% charge (min)
- **battery_reserve_threshold**: safety floor fraction (e.g., 0.20) where the robot triggers return to base
- **tank_capacity_time**: minutes of active cleaning before a water refill/waste dump is required
- **travel_time_to_service_hub**: (derived) round-trip time for a robot to travel from its cleaning zone to the charging/refill hub and return, calculated as (2 × distance_to_service_hub) / effective_speed (min)
- **distance_to_service_hub**: one-way distance from the cleaning zone to the charging/refill hub (m). Default is estimated as the radius of a circle with area equal to actual_area_per_floor: sqrt(actual_area_per_floor / π)
- **vertical_travel_time**: total time for one elevator cycle including wait and ride (min)
- **effective_charge_time**: time to charge from battery_reserve_threshold back to 100% (min)
- **refill_duration**: actual time tethered to the water/waste station (min)
- **charging_contention_time**: (derived) estimated queue time when robots outnumber docks, calculated as max(0, (num_of_robots / num_of_charging_points - 1)) × effective_charge_time (min)
- **refill_contention_time**: (derived) estimated queue time when robots outnumber stations, calculated as max(0, (num_of_robots / num_of_refill_stations - 1)) × refill_duration (min)
- **num_of_recharge_cycles**: (derived) total recharges required per robot, calculated as max(0, ceil(cleaning_time_per_robot / usable_battery_time) - 1)
- **num_of_refill_cycles**: (derived) total refill stops required per robot, calculated as max(0, ceil(cleaning_time_per_robot / tank_capacity_time) - 1)
- **field_buffer_multiplier**: real-world multiplier for maintenance and unexpected obstacles (e.g., 1.20)
- **work_assignment_mode**: toggle controlling how cleaning work is distributed among robots. "Fixed Zones" assigns each robot 1/N of the total area upfront (robots sit idle after finishing their share). "Collaborative" uses a shared work pool where robots pick up the next available unfinished area whenever they are free (no robot idles while work remains)
- **total_cleaning_distance**: The total linear cleaning path calculated as (actual_area_per_floor × num_of_floors) × num_of_passes / (effective_cleaning_width × (1 - overlap_percentage)), expressed in metres
- **usable_battery_time**: The productive cleaning time per charge cycle: total_battery_life × (1 - battery_reserve_threshold)
- **cleaning_time_per_robot**: The active cleaning time assigned to each robot: total_cleaning_distance / (effective_speed × num_of_robots)
- **effective_fleet_cleaning_rate**: The instantaneous rate at which the total cleaning work pool is being consumed, equal to effective_speed × number_of_robots_currently_in_cleaning_state (expressed in m/min). This rate is NOT constant — it changes dynamically over time as robots enter and leave service stops (charging, refilling, waiting for resources, traveling to service hub). For example, with 3 robots: when all 3 are cleaning the rate is 3 × effective_speed; when 2 are servicing and 1 is cleaning the rate drops to 1 × effective_speed. The simulation must track this dynamic rate to correctly model how quickly the shared work pool (in Collaborative mode) or individual work assignments are consumed.

## Requirements

### Requirement 1: Mode Selection

**User Story:** As a fleet planner, I want to select between two calculation modes, so that I can either determine the number of robots needed for a time constraint or the time needed for a given number of robots.

#### Acceptance Criteria

1. THE Mode_Selector SHALL provide exactly two modes: "Time Constraint" mode and "Robot Count" mode
2. WHEN the user selects "Time Constraint" mode, THE Input_Form SHALL display a time constraint input field and hide the num_of_robots input field
3. WHEN the user selects "Robot Count" mode, THE Input_Form SHALL display a num_of_robots input field and hide the time constraint input field
4. THE Mode_Selector SHALL default to "Time Constraint" mode on initial page load

### Requirement 2: Workload and Coverage Input

**User Story:** As a fleet planner, I want to enter workload and coverage variables, so that the calculator can determine the total cleaning effort required.

#### Acceptance Criteria

1. THE Input_Form SHALL accept the following workload variables: actual_area_per_floor (in m²), num_of_passes (as a positive integer), overlap_percentage (as a decimal between 0 and 1 exclusive), and effective_cleaning_width (in meters)
2. WHEN num_of_passes is provided as a value less than 1 or is not an integer, THE Input_Form SHALL display a validation error indicating that num_of_passes must be a positive integer
3. WHEN overlap_percentage is provided as a value less than 0 or greater than or equal to 1, THE Input_Form SHALL display a validation error indicating that overlap_percentage must be between 0 and 1 exclusive
4. WHEN actual_area_per_floor is provided as a value less than or equal to 0, THE Input_Form SHALL display a validation error indicating that actual_area_per_floor must be a positive number
5. WHEN effective_cleaning_width is provided as a value less than or equal to 0, THE Input_Form SHALL display a validation error indicating that effective_cleaning_width must be a positive number

### Requirement 3: Fleet and Infrastructure Input

**User Story:** As a fleet planner, I want to enter fleet and infrastructure variables, so that the calculator accounts for physical constraints of the deployment environment.

#### Acceptance Criteria

1. THE Input_Form SHALL accept the following fleet variables: num_of_robots (in Robot Count mode), num_of_charging_points, num_of_refill_stations, num_of_floors, num_of_robots_per_elevator_trip, num_of_elevators, and service_hub_on_different_floor (as a boolean toggle)
2. WHEN any fleet or infrastructure variable (except service_hub_on_different_floor) is provided as a non-positive integer, THE Input_Form SHALL display a validation error indicating that the value must be a positive integer
3. WHEN num_of_robots_per_elevator_trip is provided as a value greater than num_of_robots, THE Input_Form SHALL accept the value without error since elevator capacity may exceed fleet size
4. WHEN num_of_floors equals 1, THE Input_Form SHALL disable the service_hub_on_different_floor toggle and set it to "No", with a tooltip explaining that a single-floor deployment cannot have the hub on a different floor

### Requirement 4: Performance and Speed Input

**User Story:** As a fleet planner, I want to enter performance and speed variables, so that the calculator reflects actual robot operational capabilities.

#### Acceptance Criteria

1. THE Input_Form SHALL accept the following performance variables: effective_speed (in m/min), total_battery_life (in minutes), battery_reserve_threshold (as a decimal between 0 and 1 exclusive), and tank_capacity_time (in minutes)
2. WHEN effective_speed is provided as a value less than or equal to 0, THE Input_Form SHALL display a validation error indicating that effective_speed must be a positive number
3. WHEN total_battery_life is provided as a value less than or equal to 0, THE Input_Form SHALL display a validation error indicating that total_battery_life must be a positive number
4. WHEN battery_reserve_threshold is provided as a value less than 0 or greater than or equal to 1, THE Input_Form SHALL display a validation error indicating that battery_reserve_threshold must be between 0 and 1 exclusive
5. WHEN tank_capacity_time is provided as a value less than or equal to 0, THE Input_Form SHALL display a validation error indicating that tank_capacity_time must be a positive number

### Requirement 5: Time and Transition Input

**User Story:** As a fleet planner, I want to enter time and transition variables, so that the calculator accounts for non-cleaning overhead time.

#### Acceptance Criteria

1. THE Input_Form SHALL accept the following time variables: distance_to_service_hub (in metres), vertical_travel_time (in minutes), effective_charge_time (in minutes), and refill_duration (in minutes)
2. WHEN any time or transition variable is provided as a negative value, THE Input_Form SHALL display a validation error indicating that time values must be zero or positive
3. WHEN distance_to_service_hub is provided as a value less than or equal to 0, THE Input_Form SHALL display a validation error indicating that distance_to_service_hub must be a positive number
4. THE Calculator SHALL derive travel_time_to_service_hub as (2 × distance_to_service_hub) / effective_speed
5. THE Input_Form SHALL display the derived travel_time_to_service_hub as a read-only computed field so the user can see the estimated round-trip travel time
6. THE Calculator SHALL derive charging_contention_time automatically as: max(0, (num_of_robots / num_of_charging_points - 1)) × effective_charge_time
7. THE Calculator SHALL derive refill_contention_time automatically as: max(0, (num_of_robots / num_of_refill_stations - 1)) × refill_duration
8. THE Input_Form SHALL display the derived charging_contention_time and refill_contention_time as read-only computed fields so the user can see the estimated queue time without editing it
9. WHEN num_of_robots is less than or equal to num_of_charging_points, THE Input_Form SHALL display charging_contention_time as 0 with a note explaining that no contention exists
10. WHEN num_of_robots is less than or equal to num_of_refill_stations, THE Input_Form SHALL display refill_contention_time as 0 with a note explaining that no contention exists

### Requirement 6: Logistical Multiplier Input

**User Story:** As a fleet planner, I want to enter logistical multipliers, so that the calculator accounts for real-world inefficiencies.

#### Acceptance Criteria

1. THE Input_Form SHALL accept the following logistical variable: field_buffer_multiplier (as a decimal greater than or equal to 1.0)
2. WHEN field_buffer_multiplier is provided as a value less than 1.0, THE Input_Form SHALL display a validation error indicating that field_buffer_multiplier must be 1.0 or greater
3. THE Calculator SHALL derive num_of_recharge_cycles automatically as: max(0, ceil(cleaning_time_per_robot / usable_battery_time) - 1)
4. THE Calculator SHALL derive num_of_refill_cycles automatically as: max(0, ceil(cleaning_time_per_robot / tank_capacity_time) - 1)
5. THE Input_Form SHALL display the derived num_of_recharge_cycles and num_of_refill_cycles as read-only computed fields so the user can see how many service stops are required

### Requirement 7: Units of Measure Display

**User Story:** As a fleet planner, I want to clearly see the expected unit of measure for each input field, so that I do not accidentally enter values in the wrong unit.

#### Acceptance Criteria

1. EACH input field SHALL display its unit of measure as a persistent suffix label inside or immediately adjacent to the input field (not only in the tooltip), using the following units:
   - actual_area_per_floor: m² (square metres)
   - num_of_passes: passes (dimensionless count)
   - overlap_percentage: fraction (0–1) with label "e.g. 0.10 = 10%"
   - effective_cleaning_width: m (metres)
   - num_of_robots: robots
   - num_of_charging_points: docks
   - num_of_refill_stations: stations
   - num_of_floors: floors
   - num_of_robots_per_elevator_trip: robots/trip
   - num_of_elevators: elevators
   - service_hub_on_different_floor: yes/no toggle
   - effective_speed: m/min (metres per minute)
   - total_battery_life: min (minutes)
   - battery_reserve_threshold: fraction (0–1) with label "e.g. 0.20 = 20%"
   - tank_capacity_time: min (minutes)
   - distance_to_service_hub: m (metres)
   - travel_time_to_service_hub: min (derived, read-only)
   - vertical_travel_time: min (minutes)
   - effective_charge_time: min (minutes)
   - refill_duration: min (minutes)
   - charging_contention_time: min (derived, read-only)
   - refill_contention_time: min (derived, read-only)
   - num_of_recharge_cycles: cycles (derived, read-only)
   - num_of_refill_cycles: cycles (derived, read-only)
   - field_buffer_multiplier: multiplier (e.g. 1.20 = 20% buffer)
   - work_assignment_mode: toggle (Fixed Zones / Collaborative)
2. THE unit label SHALL remain visible at all times regardless of whether the field is focused, empty, or populated
3. FOR fractional inputs (overlap_percentage, battery_reserve_threshold), THE Input_Form SHALL display an inline hint example (e.g., "0.10 = 10%") to prevent users from entering percentage values like 10 instead of 0.10
4. THE time constraint input in "Time Constraint" mode SHALL display "min (minutes)" as its unit label

### Requirement 8: Time Constraint Mode Calculation

**User Story:** As a fleet planner, I want to calculate the number of robots required given a time constraint, so that I can determine the minimum fleet size for a deadline.

#### Acceptance Criteria

1. WHEN the user submits inputs in "Time Constraint" mode, THE Calculator SHALL compute the minimum number of robots (num_of_robots) required to complete the cleaning task within the specified time
2. THE Calculator SHALL compute the total_cleaning_distance as (actual_area_per_floor × num_of_floors) × num_of_passes / (effective_cleaning_width × (1 - overlap_percentage))
3. THE Calculator SHALL compute the usable_battery_time as total_battery_life × (1 - battery_reserve_threshold)
4. THE Calculator SHALL solve for num_of_robots iteratively: starting from 1 robot, run the discrete-event timeline simulation for each candidate num_of_robots, and increment until the simulated total elapsed time fits within the time constraint
5. FOR each candidate num_of_robots, THE Calculator SHALL compute cleaning_time_per_robot as total_cleaning_distance / (effective_speed × num_of_robots)
6. FOR each candidate num_of_robots, THE Calculator SHALL derive num_of_recharge_cycles as max(0, ceil(cleaning_time_per_robot / usable_battery_time) - 1) and num_of_refill_cycles as max(0, ceil(cleaning_time_per_robot / tank_capacity_time) - 1)
7. FOR each candidate num_of_robots, THE Calculator SHALL derive charging_contention_time as max(0, (num_of_robots / num_of_charging_points - 1)) × effective_charge_time and refill_contention_time as max(0, (num_of_robots / num_of_refill_stations - 1)) × refill_duration
8. THE Calculator SHALL determine total_elapsed_time via the discrete-event timeline simulation, which models each robot's schedule minute-by-minute tracking dock and station availability. The total_elapsed_time is the completion time of the last robot to finish its cleaning share (the rightmost point on the Gantt chart), multiplied by field_buffer_multiplier. The simulation SHALL respect the selected work_assignment_mode: in "Fixed Zones" mode each robot is assigned exactly total_cleaning_distance / num_of_robots of work and sits idle after completing its share; in "Collaborative" mode robots draw from a shared work pool and continue cleaning whenever they are available until all work is consumed
9. THE Calculator SHALL model resource contention realistically in the simulation: when a robot needs a dock or station that is occupied, it waits until one becomes available, and the resulting wait time is reflected in the timeline
10. THE simulation SHALL model the effective fleet cleaning rate as dynamic — varying over time based on how many robots are actively cleaning at any given moment. When a robot enters a service stop (charging, refilling, waiting for a resource, traveling to service hub), it stops contributing to the cleaning rate. When it returns to cleaning, the rate increases. The effective_fleet_cleaning_rate at any instant equals effective_speed × number_of_robots_currently_in_cleaning_state
11. THE Calculator SHALL compute initial_floor_distribution_time as: ceil(num_of_robots / (num_of_robots_per_elevator_trip × num_of_elevators)) × vertical_travel_time × (num_of_floors - 1), representing the total overhead to distribute ALL robots across floors. However, the simulation SHALL model elevator delivery incrementally: robots are released in batches of (num_of_robots_per_elevator_trip × num_of_elevators) per elevator cycle. Each batch's delivery time = batchNumber × vertical_travel_time × (num_of_floors - 1). Robots in earlier batches SHALL begin cleaning as soon as their batch is delivered, without waiting for later batches. This means the first batch of robots starts cleaning at time = 1 × vertical_travel_time × (num_of_floors - 1), while the last batch starts at the full initial_floor_distribution_time.
12. THE Calculator SHALL compute total_elapsed_time for each candidate num_of_robots by running the timeline simulation for the currently selected start mode, applying field_buffer_multiplier to the simulation result, and comparing against the time constraint
13. THE Calculator SHALL round the computed num_of_robots up to the nearest whole integer since partial robots are not possible
14. THE simulation models actual resource contention by tracking dock and station occupancy over time, producing realistic wait times rather than worst-case estimates
15. IF the specified time constraint is less than or equal to 0, THEN THE Calculator SHALL display an error indicating that the time constraint must be a positive number
16. THE simulation SHALL be fully deterministic: given identical inputs, it SHALL produce identical results (same total_elapsed_time, same timeline segments, same work distribution) on every execution. No randomness or non-deterministic tie-breaking shall be used. When multiple robots reach an event at the same time, they SHALL be processed in robot ID order (lowest first)
17. THE simulation SHALL use an event-driven concurrent drain model: when multiple robots are cleaning simultaneously, the shared work pool (in Collaborative mode) SHALL drain at the combined rate of all active cleaners (num_cleaning_robots × effective_speed). Each robot's share of the pool is determined by how long it remains in the cleaning state, NOT by pre-claiming work upfront. Between events, all currently-cleaning robots drain the pool simultaneously at the combined rate

### Requirement 9: Robot Count Mode Calculation

**User Story:** As a fleet planner, I want to calculate the total time to complete given a number of robots, so that I can evaluate whether my current fleet meets scheduling needs.

#### Acceptance Criteria

1. WHEN the user submits inputs in "Robot Count" mode, THE Calculator SHALL compute the total time required for num_of_robots robots to complete the cleaning task by running the discrete-event timeline simulation
2. THE Calculator SHALL compute the total_cleaning_distance as (actual_area_per_floor × num_of_floors) × num_of_passes / (effective_cleaning_width × (1 - overlap_percentage))
3. THE Calculator SHALL compute the usable_battery_time as total_battery_life × (1 - battery_reserve_threshold)
4. THE Calculator SHALL compute cleaning_time_per_robot as total_cleaning_distance / (effective_speed × num_of_robots)
5. THE Calculator SHALL derive num_of_recharge_cycles as max(0, ceil(cleaning_time_per_robot / usable_battery_time) - 1) and num_of_refill_cycles as max(0, ceil(cleaning_time_per_robot / tank_capacity_time) - 1)
6. THE Calculator SHALL derive charging_contention_time as max(0, (num_of_robots / num_of_charging_points - 1)) × effective_charge_time and refill_contention_time as max(0, (num_of_robots / num_of_refill_stations - 1)) × refill_duration
7. THE Calculator SHALL determine total_elapsed_time via the discrete-event timeline simulation, which models each robot's schedule minute-by-minute tracking dock and station availability. The total_elapsed_time is the completion time of the last robot to finish its cleaning share (the rightmost point on the Gantt chart), multiplied by field_buffer_multiplier. The simulation SHALL respect the selected work_assignment_mode: in "Fixed Zones" mode each robot is assigned exactly total_cleaning_distance / num_of_robots of work and sits idle after completing its share; in "Collaborative" mode robots draw from a shared work pool and continue cleaning whenever they are available until all work is consumed
8. THE Calculator SHALL model resource contention realistically in the simulation: when a robot needs a dock or station that is occupied, it waits until one becomes available, and the resulting wait time is reflected in the timeline
9. THE simulation SHALL model the effective fleet cleaning rate as dynamic — varying over time based on how many robots are actively cleaning at any given moment. When a robot enters a service stop (charging, refilling, waiting for a resource, traveling to service hub), it stops contributing to the cleaning rate. When it returns to cleaning, the rate increases. The effective_fleet_cleaning_rate at any instant equals effective_speed × number_of_robots_currently_in_cleaning_state
10. THE Calculator SHALL compute initial_floor_distribution_time as: ceil(num_of_robots / (num_of_robots_per_elevator_trip × num_of_elevators)) × vertical_travel_time × (num_of_floors - 1), representing the total overhead to distribute ALL robots across floors. However, the simulation SHALL model elevator delivery incrementally: robots are released in batches of (num_of_robots_per_elevator_trip × num_of_elevators) per elevator cycle. Each batch's delivery time = batchNumber × vertical_travel_time × (num_of_floors - 1). Robots in earlier batches SHALL begin cleaning as soon as their batch is delivered, without waiting for later batches.
11. THE Calculator SHALL compute total_elapsed_time by running the timeline simulation for the currently selected start mode and applying field_buffer_multiplier to the simulation result. The simulation produces the actual elapsed time by tracking when the last robot completes its cleaning share, accounting for realistic resource contention
12. THE Calculator SHALL display the result in minutes, and additionally in hours and minutes when the result exceeds 60 minutes
13. THE simulation models actual resource contention by tracking dock and station occupancy over time, producing realistic wait times rather than worst-case estimates
14. THE simulation SHALL be fully deterministic: given identical inputs, it SHALL produce identical results (same total_elapsed_time, same timeline segments, same work distribution) on every execution. No randomness or non-deterministic tie-breaking shall be used. When multiple robots reach an event at the same time, they SHALL be processed in robot ID order (lowest first)
15. THE simulation SHALL use an event-driven concurrent drain model: when multiple robots are cleaning simultaneously, the shared work pool (in Collaborative mode) SHALL drain at the combined rate of all active cleaners (num_cleaning_robots × effective_speed). Each robot's share of the pool is determined by how long it remains in the cleaning state, NOT by pre-claiming work upfront. Between events, all currently-cleaning robots drain the pool simultaneously at the combined rate

### Requirement 10: Result Explanation and Breakdown

**User Story:** As a fleet planner, I want a detailed breakdown of how each variable contributes to the result, so that I can make informed purchasing decisions and identify optimization opportunities.

#### Acceptance Criteria

1. THE Result_Display SHALL show the final computed result prominently at the top of the output section
2. THE Result_Display SHALL show an explanatory breakdown derived from the simulation data, including: total_cleaning_distance calculation, cleaning_time_per_robot, approximate time spent charging (aggregated across all robots from the simulation), approximate time spent refilling, approximate time spent traveling to service hub, approximate time spent waiting for resources, vertical travel overhead, and the field_buffer_multiplier impact. Note: these are approximate contributions extracted from the simulation timeline data, not the source of the total elapsed time
3. THE Result_Display SHALL display the percentage contribution of each time component (active cleaning, charging overhead, refill overhead, travel overhead, waiting/contention, field buffer) relative to the total time, derived from the actual simulation timeline segments
4. THE Result_Display SHALL highlight the top three variables with the highest contribution to total time, labeled as optimization opportunities
5. WHEN the user hovers over or taps a breakdown item, THE Result_Display SHALL show a tooltip explaining the variable and its formula
6. THE Result_Display SHALL show the total dead time (sum of all periods where zero robots are actively cleaning) as a metric, helping users identify service storm bottlenecks

### Requirement 11: Fleet Activity Timeline Chart and Efficiency Graph

**User Story:** As a fleet planner, I want to see a Gantt-style horizontal bar chart showing how each robot spends its time and an efficiency line graph showing fleet utilization and cumulative progress over time, so that I can visually identify bottlenecks, resource contention, compare scheduling strategies, and understand how efficiently the fleet is working.

#### Acceptance Criteria

1. THE Result_Display SHALL render a horizontal stacked bar chart where each row represents one robot and the x-axis represents elapsed time in minutes
2. EACH robot's bar SHALL be segmented by activity type, colour-coded as follows: cleaning (green), traveling to service hub (blue), charging (yellow), waiting for charging dock (orange), refilling (purple), waiting for refill station (red), elevator transit (grey), idle (light grey)
3. THE Input_Form SHALL provide a "Start Mode" toggle with two options: "Simultaneous Start" (all robots begin at t=0) and "Staggered Start" (robots offset evenly by one robot's cleaning cycle duration)
4. WHEN "Simultaneous Start" is selected, THE simulation SHALL model all robots beginning their first cleaning segment at t=0, with waiting segments inserted when multiple robots compete for the same dock or station at the same time. The simulation produces the total_elapsed_time for this mode
5. WHEN "Staggered Start" is selected, THE simulation SHALL offset each robot's start by (single_robot_cycle_time / num_of_robots) to distribute resource usage over time, and SHALL produce its own total_elapsed_time independently (which may differ from the Simultaneous Start result)
6. THE Result_Display SHALL show the computed elapsed time for the currently selected Start Mode, clearly labelling which mode is active
7. THE simulation SHALL insert "waiting" segments where a robot's scheduled charge or refill overlaps with another robot already occupying that resource, based on actual dock/station occupancy tracking
8. ALL robot bars SHALL share a single synchronized x-axis (time in minutes) ensuring visual alignment across all rows, with the rightmost point representing the job completion time (the simulation result before field_buffer_multiplier is applied)
9. THE colour legend SHALL be placed outside the chart area (above or below the bars), not overlapping any bar segments
10. WHEN the user hovers over or taps a segment, THE chart SHALL display a tooltip showing the activity name, start time, end time, and duration in minutes
11. THE chart SHALL be responsive, scrolling horizontally on narrow viewports while keeping robot labels visible on the left
12. THE chart SHALL be included in the exported PDF report
13. EACH bar segment's horizontal position and width SHALL correspond exactly to its start time and duration on the shared x-axis, ensuring precise visual alignment between all robot rows
14. THE Result_Display SHALL render an efficiency line graph directly below the Gantt chart, sharing the same x-axis (time in minutes)
15. The efficiency graph SHALL display two lines on a dual-axis chart: Fleet Utilization % (left y-axis, 0–100%) computed as (number_of_robots_currently_cleaning / num_of_robots) × 100 at each point in time, and Cumulative Progress % (right y-axis, 0–100%) computed as (total_distance_cleaned_so_far / total_cleaning_distance) × 100 at each point in time. The Fleet Utilization line SHALL be rendered as a step function (flat horizontal segments with sharp vertical transitions) since it represents a discrete state metric — robots are either cleaning or not, and there is no gradual transition between states. The Cumulative Progress line MAY use linear interpolation since progress is continuous.
16. The two lines on the efficiency graph SHALL be visually distinct (different colours and/or line styles) with a legend identifying each line
17. The efficiency graph SHALL be responsive and included in the PDF export
18. WHEN the user hovers over a point on the efficiency graph, a tooltip SHALL show the time, fleet utilization %, and cumulative progress % at that moment
19. THE x-axis on both the Gantt chart and the efficiency graph SHALL use human-readable round tick intervals (e.g., 10, 20, 50, 100 min) rather than dividing total time by a fixed number of ticks. The algorithm SHALL select the smallest "nice" interval that produces approximately 5–10 ticks for the given time range. Each tick SHALL have a small vertical mark on the x-axis for readability.
20. WHEN the charts display raw simulation time that differs from the reported elapsed time (due to the field buffer multiplier), THE Result_Display SHALL show an explanatory note above the charts stating: "Charts show raw simulation time (X min). The reported elapsed time (Y min) includes the ×Z field buffer."
21. THE simulation engine SHALL record efficiency data points at every state transition, including the initial transition when robots first begin cleaning after floor distribution, so that the utilization graph correctly shows the jump from 0% to 100% at the start of active cleaning

### Requirement 12: Infeasibility Detection and Guidance

**User Story:** As a fleet planner, I want to be clearly informed when the robots cannot complete the job within the given time constraint, so that I know exactly which inputs to adjust to make the scenario feasible.

#### Acceptance Criteria

1. WHEN the Calculator determines that the cleaning task cannot be completed within the specified time constraint (in Time Constraint mode), THE Result_Display SHALL show a prominent "Infeasible" warning instead of a robot count
2. THE infeasibility warning SHALL explain the reason in plain language (e.g., "Even with unlimited robots, resource constraints prevent completion within X minutes")
3. THE Result_Display SHALL identify the binding constraint(s) causing infeasibility, which may include: insufficient charging docks creating excessive contention, insufficient refill stations, elevator bottleneck limiting floor-to-floor throughput, or the time constraint being shorter than a single robot's minimum cycle time
4. THE Result_Display SHALL provide specific actionable suggestions ranked by impact, such as: "Add 1 more charging dock to reduce contention by Y minutes", "Increase time constraint to at least Z minutes", or "Add 1 more elevator to reduce vertical travel bottleneck"
5. WHEN in Robot Count mode and the computed time exceeds a reasonable threshold (e.g., more than 24 hours), THE Result_Display SHALL flag the result with a warning suggesting the user consider adding more robots or infrastructure
6. THE infeasibility analysis SHALL be included in the exported PDF report when applicable

### Requirement 13: Responsive Layout

**User Story:** As a fleet planner, I want to use the calculator on both desktop and mobile devices, so that I can plan fleet deployments from any device.

#### Acceptance Criteria

1. WHILE the viewport width is 768 pixels or greater, THE Input_Form SHALL display input fields in a multi-column grid layout
2. WHILE the viewport width is less than 768 pixels, THE Input_Form SHALL display input fields in a single-column stacked layout
3. THE Input_Form SHALL use appropriately sized touch targets (minimum 44×44 pixels) for all interactive elements on mobile viewports
4. THE Result_Display SHALL remain readable without horizontal scrolling on viewports as narrow as 320 pixels

### Requirement 14: Input Persistence

**User Story:** As a fleet planner, I want my inputs to be preserved between sessions, so that I do not have to re-enter all variables each time I use the calculator.

#### Acceptance Criteria

1. WHEN the user submits a calculation, THE Calculator SHALL save all input values to browser local storage
2. WHEN the user loads the application, THE Input_Form SHALL restore previously saved input values from local storage if available
3. WHEN the user clicks a "Reset" button, THE Input_Form SHALL clear all saved values from local storage and reset all fields to their default values

### Requirement 15: Input Tooltips with Default Values

**User Story:** As a fleet planner, I want to see an explanatory tooltip for each input variable with a reasonable default value, so that I can understand what each variable means and quickly proceed without researching every parameter.

#### Acceptance Criteria

1. EACH input field SHALL display a tooltip (on mouse hover on desktop, on tap on mobile) containing: a plain-language explanation of the variable, its unit of measurement, and a recommended default value with a brief justification for that default
2. THE Input_Form SHALL use the following default values with explanations:
   - actual_area_per_floor: 500 m² (typical medium commercial floor)
   - num_of_passes: 1 (single pass is standard for routine daily cleaning)
   - overlap_percentage: 0.10 (10% overlap prevents streak lines between passes)
   - effective_cleaning_width: 0.30 m (typical commercial robot brush width minus housing offset)
   - num_of_robots: 3 (common starting fleet for a single medium building)
   - num_of_charging_points: 2 (minimum redundancy for continuous operation)
   - num_of_refill_stations: 1 (one station typically serves up to 5 robots)
   - num_of_floors: 1 (single-floor deployment is the simplest scenario)
   - num_of_robots_per_elevator_trip: 1 (most standard elevators fit one robot at a time)
   - num_of_elevators: 1 (minimum for multi-floor buildings)
   - service_hub_on_different_floor: No (assumes docks are on the same floor as cleaning zones for simplest scenario)
   - effective_speed: 18 m/min (typical commercial robot speed with safety factor applied)
   - total_battery_life: 120 min (standard lithium-ion runtime for commercial cleaning robots)
   - battery_reserve_threshold: 0.20 (20% reserve ensures robot reaches dock safely)
   - tank_capacity_time: 60 min (typical tank lasts about half a battery cycle)
   - distance_to_service_hub: sqrt(500 / π) ≈ 12.6 m (default derived as radius of a circle with area equal to actual_area_per_floor, representing average travel distance on a typical floor)
   - vertical_travel_time: 5 min (includes elevator wait and ride time)
   - effective_charge_time: 90 min (typical fast-charge from 20% to 100%)
   - refill_duration: 5 min (automated dock refill time)
   - field_buffer_multiplier: 1.20 (20% buffer accounts for obstacles, maintenance, and navigation inefficiency)
   - work_assignment_mode: Fixed Zones (reflects how current-generation robots operate with pre-assigned cleaning zones)
3. ALL input fields SHALL be pre-populated with their default values on initial load (when no local storage values exist)
4. THE Input_Form SHALL provide a "Use All Defaults" button that resets all fields to their default values in a single action
5. WHEN a user modifies a field away from its default, THE Input_Form SHALL visually distinguish that field (e.g., subtle highlight or indicator) so the user can see which values they have customized
6. THE default value for distance_to_service_hub SHALL be dynamically recalculated as sqrt(actual_area_per_floor / π) whenever actual_area_per_floor changes, unless the user has manually overridden it
7. DERIVED (read-only computed) fields SHALL display a blue left-border indicator with a "modified inputs" text badge when at least one of their parent input dependencies has been changed from its default value. This helps users understand which computed values are influenced by their customisations.
8. WHEN the user manually overrides `distance_to_service_hub` (which normally auto-calculates), THE Input_Form SHALL display an amber left-border indicator with an "overridden" text badge on that field, distinguishing it from a dynamically computed value.
9. THE colour indicators SHALL meet WCAG 2.1 AA contrast requirements and SHALL NOT rely on colour alone — supplementary text labels ("modified inputs", "overridden") are provided for colour-blind users.

### Requirement 16: Spreadsheet Upload

**User Story:** As a fleet planner, I want to upload input variables from a spreadsheet file, so that I can quickly load pre-prepared scenarios without manually entering each value.

#### Acceptance Criteria

1. THE Input_Form SHALL provide an "Upload" button that accepts .csv and .xlsx file formats
2. THE uploaded file SHALL be parsed expecting two columns: the first column containing the variable name (in snake_case) and the second column containing the value
3. WHEN a valid file is uploaded, THE Input_Form SHALL populate all matching input fields with the values from the file, overriding any existing values
4. WHEN the uploaded file contains variable names that do not match any known input variable, THE Input_Form SHALL ignore those rows and display a warning listing the unrecognized variable names
5. WHEN the uploaded file contains values that fail validation for their corresponding variable, THE Input_Form SHALL still populate the field and trigger the standard validation error display so the user can correct them
6. THE Input_Form SHALL provide a "Download Template" link that downloads a .csv file pre-populated with all variable names and their default values, serving as a reference for the expected format
7. WHEN a file upload fails due to an unsupported format or parsing error, THE Input_Form SHALL display a clear error message indicating the accepted formats and expected structure

### Requirement 17: Input Validation Summary

**User Story:** As a fleet planner, I want to see all validation errors at once before submission, so that I can correct all issues in a single pass.

#### Acceptance Criteria

1. WHEN the user attempts to submit the form with one or more invalid inputs, THE Input_Form SHALL display a summary of all validation errors at the top of the form
2. WHEN the user corrects an invalid input, THE Input_Form SHALL remove the corresponding error from the validation summary in real time
3. THE Input_Form SHALL prevent form submission until all validation errors are resolved

### Requirement 18: Free-Text Comments

**User Story:** As a fleet planner, I want to add free-text comments to my calculation, so that I can annotate assumptions, record context, or leave notes for colleagues reviewing the results.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a multi-line text area labeled "Comments / Notes" where the user can enter free-text annotations
2. THE comments field SHALL have no character limit but SHALL display a character count for reference
3. THE comments SHALL be saved alongside input values in browser local storage when a calculation is submitted
4. THE comments SHALL be included in the exported PDF report (see Requirement 19)
5. THE comments field SHALL support basic line breaks and be displayed as entered (preserving whitespace formatting)

### Requirement 19: PDF Export

**User Story:** As a fleet planner, I want to export the calculation results as a PDF, so that I can share the analysis with stakeholders, attach it to procurement proposals, or archive it for future reference.

#### Acceptance Criteria

1. THE Result_Display SHALL provide an "Export as PDF" button that is enabled only after a successful calculation
2. THE exported PDF SHALL include: a title with the date and calculation mode used, all input variable values with their labels, the full result breakdown (as shown in Requirement 10), percentage contribution chart, optimization opportunities, and any user-entered comments
3. THE exported PDF SHALL use a clean, professional layout suitable for inclusion in business proposals
4. THE exported PDF file name SHALL follow the format "fleet_calculation_YYYY-MM-DD_HHmm.pdf" using the local date and time of export
5. WHEN the export is triggered, THE application SHALL generate the PDF client-side without requiring a server round-trip
6. THE exported PDF SHALL be formatted to fit A4 page size with appropriate margins and page breaks between sections
7. THE exported PDF section ordering SHALL match the web display sequence: Primary Result → Input Variables → Time Breakdown → Optimizations → Robot Work Distribution → Gantt Chart → Efficiency Graph → Comments → Assumptions & Limitations. All information visible on the web results page SHALL be present in the PDF.
8. THE exported PDF SHALL include visual images of both the Gantt timeline chart and the efficiency graph (captured from the rendered SVG), each with a colour-coded legend identifying the chart elements
9. THE exported PDF SHALL include the explanatory note about raw simulation time vs buffered elapsed time above the Gantt chart image
10. THE exported PDF SHALL include an "Assumptions & Limitations" section listing all assumptions shown on the web results page


### Requirement 20: Work Assignment Mode

**User Story:** As a fleet planner, I want to choose how robots share cleaning work, so that I can compare the efficiency of fixed zone assignments versus collaborative work pooling.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a "Work Assignment Mode" toggle with two options: "Fixed Zones" and "Collaborative"
2. THE Input_Form SHALL default work_assignment_mode to "Fixed Zones" on initial load (since this reflects how current-generation robots operate)
3. WHEN "Fixed Zones" is selected, THE simulation SHALL assign each robot exactly total_cleaning_distance / num_of_robots of work upfront; a robot that finishes its assigned share before others SHALL sit idle for the remainder of the job
4. WHEN "Collaborative" is selected, THE simulation SHALL maintain a shared work pool of total_cleaning_distance metres; each robot SHALL draw from the pool whenever it is available (not charging, refilling, or waiting for a resource), and the job SHALL complete when the shared pool reaches 0
5. In Collaborative mode, THE simulation SHALL track the shared work pool being consumed at the current effective_fleet_cleaning_rate, which equals effective_speed multiplied by the number of robots currently in the cleaning state at that instant. As robots enter and leave service stops, the rate at which the pool drains changes dynamically
6. WHEN "Collaborative" is selected AND a robot returns from a service stop (charging or refilling), THE simulation SHALL check the shared pool for remaining work and assign the robot to continue cleaning if work remains
7. THE total_elapsed_time in "Collaborative" mode SHALL always be less than or equal to the total_elapsed_time in "Fixed Zones" mode for the same inputs, since no robot sits idle while work remains
8. THE Result_Display SHALL clearly label which work assignment mode was used in the calculation result
9. THE work_assignment_mode selection SHALL be saved alongside other inputs in browser local storage and included in the exported PDF report

---

## Appendix A: Validated Reference Scenario

The following table serves as a regression test target and a reference for human readers. It documents the expected simulation outputs for a specific scenario that has been manually validated.

**Reference Scenario Parameters**: 3 robots, 2 charging docks, 1 refill station, 2000 m², battery 96 min usable, tank 60 min, charge time 90 min, refill 5 min, travel 1.4 min, buffer 1.20

| Scenario | Raw Time | Buffered | Dead Time | Active Time | % Active | R1/R2/R3 Work Split |
|----------|----------|----------|-----------|-------------|----------|---------------------|
| Simultaneous + Fixed Zones | 335.6 min | 402.7 min | 137.3 min | 198.3 min | 59.1% | 33.3% / 33.3% / 33.3% |
| Simultaneous + Collaborative | 268.7 min | 322.4 min | 93.4 min | 175.3 min | 65.2% | 38.9% / 37.7% / 23.3% |
| Staggered + Fixed Zones | 335.6 min | 402.7 min | 79.4 min | 256.2 min | 76.3% | 33.3% / 33.3% / 33.3% |
| Staggered + Collaborative | 277.5 min | 333.0 min | 47.6 min | 229.9 min | 82.8% | 41.1% / 35.6% / 23.3% |

**Key observations:**
- "Fastest total time" (Simultaneous + Collaborative, 268.7 min) and "highest utilization" (Staggered + Collaborative, 82.8%) are DIFFERENT optimization targets
- Simultaneous + Collaborative has a large dead period (82.8 min, t=113.9–196.7) where all 3 robots are in service (2 charging, 1 waiting for dock) — nobody is cleaning
- Staggered start reduces this overlap by offsetting when robots need service, resulting in only 47.6 min of dead time
- The R1/R2 imbalance in collaborative mode (38.9% vs 37.7%) is caused by R1 getting first access to the single refill station each time (R2 waits 5 min)
- R3's lower share (23.3%) is caused by waiting 80 min for a charging dock (both docks occupied by R1 and R2)
