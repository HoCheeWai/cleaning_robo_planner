// Calculation mode
export type CalculationMode = 'time-constraint' | 'robot-count';

// Start mode for timeline chart
export type StartMode = 'simultaneous' | 'staggered';

// Work assignment mode
export type WorkAssignmentMode = 'fixed-zones' | 'collaborative';

// All user-editable inputs
export interface CalculatorInputs {
  mode: CalculationMode;
  startMode: StartMode;
  work_assignment_mode: WorkAssignmentMode;
  // Workload
  actual_area_per_floor: number;
  num_of_passes: number;
  overlap_percentage: number;
  effective_cleaning_width: number;
  // Fleet
  num_of_robots: number; // used in Robot Count mode
  time_constraint: number; // used in Time Constraint mode
  num_of_charging_points: number;
  num_of_refill_stations: number;
  num_of_floors: number;
  num_of_robots_per_elevator_trip: number;
  num_of_elevators: number;
  service_hub_on_different_floor: boolean;
  // Performance
  effective_speed: number;
  total_battery_life: number;
  battery_reserve_threshold: number;
  tank_capacity_time: number;
  // Time & Transitions
  distance_to_service_hub: number;
  vertical_travel_time: number;
  effective_charge_time: number;
  refill_duration: number;
  // Logistical
  field_buffer_multiplier: number;
  // Meta
  comments: string;
}

// Derived values computed from inputs
export interface DerivedValues {
  travel_time_to_service_hub: number;
  charging_contention_time: number;
  refill_contention_time: number;
  num_of_recharge_cycles: number;
  num_of_refill_cycles: number;
  total_cleaning_distance: number;
  usable_battery_time: number;
  cleaning_time_per_robot: number;
  service_hub_floor_penalty: number;
}

// Time contributions as percentage breakdown
export interface TimeContributions {
  active_cleaning_pct: number;
  charging_overhead_pct: number;
  refill_overhead_pct: number;
  travel_overhead_pct: number;
  waiting_contention_pct: number;
  floor_distribution_pct: number;
  field_buffer_pct: number;
}

// Optimization suggestion
export interface OptimizationSuggestion {
  variable: string;
  label: string;
  contribution_minutes: number;
  suggestion: string;
}

// Timeline chart data — activity types
export type ActivityType =
  | 'cleaning'
  | 'traveling'
  | 'charging'
  | 'waiting-charge'
  | 'refilling'
  | 'waiting-refill'
  | 'elevator'
  | 'idle';

// A single segment in a robot's timeline
export interface TimelineSegment {
  activity: ActivityType;
  start: number; // minutes from t=0
  end: number;   // minutes from t=0
  robotIndex: number;
}

// A robot's full timeline
export interface RobotTimeline {
  robotIndex: number;
  segments: TimelineSegment[];
  totalCleaned: number; // total distance cleaned by this robot
}

// Efficiency graph data point (sampled at each state transition)
export interface EfficiencyDataPoint {
  time: number; // minutes from t=0
  fleet_utilization_pct: number; // 0-100: (robots_currently_cleaning / num_of_robots) × 100
  cumulative_progress_pct: number; // 0-100: (distance_cleaned_so_far / total_cleaning_distance) × 100
}

// Validation error for a single field
export interface ValidationError {
  field: string;
  message: string;
}

// Result of validating all inputs
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Infeasibility detection result
export interface InfeasibilityResult {
  reason: string;
  bindingConstraints: string[];
  suggestions: string[];
}

// Dead time analysis — periods where zero robots are cleaning
export interface DeadTimeAnalysis {
  total_dead_time: number; // total minutes of dead time
  dead_periods: Array<{ start: number; end: number }>; // list of dead periods
  dead_time_pct: number; // dead time as % of raw elapsed time
}

// Result of a calculation
export interface CalculationResult {
  mode: CalculationMode;
  // Primary result
  num_of_robots: number; // computed in time-constraint mode
  total_elapsed_time: number; // computed in robot-count mode (or for display)
  // Breakdown
  cleaning_time_per_robot: number;
  recharge_downtime_total: number;
  refill_downtime_total: number;
  initial_floor_distribution_time: number;
  field_buffer_impact: number;
  // Derived
  derived: DerivedValues;
  // Percentage contributions
  contributions: TimeContributions;
  // Optimization opportunities (top 3)
  optimizations: OptimizationSuggestion[];
  // Timeline data
  timeline: RobotTimeline[];
  // Efficiency data (sampled at each state transition in the simulation)
  efficiencyData: EfficiencyDataPoint[];
  // Dead time analysis
  deadTime: DeadTimeAnalysis;
  // Infeasibility
  infeasible: boolean;
  infeasibilityReason?: string;
  infeasibilitySuggestions?: string[];
}
