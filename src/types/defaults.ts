import { CalculatorInputs } from './index';

export const DEFAULT_INPUTS: CalculatorInputs = {
  mode: 'time-constraint',
  startMode: 'simultaneous',
  work_assignment_mode: 'fixed-zones',
  actual_area_per_floor: 500,
  num_of_passes: 1,
  overlap_percentage: 0.10,
  effective_cleaning_width: 0.30,
  num_of_robots: 3,
  time_constraint: 480, // 8 hours
  num_of_charging_points: 2,
  num_of_refill_stations: 1,
  num_of_floors: 1,
  num_of_robots_per_elevator_trip: 1,
  num_of_elevators: 1,
  service_hub_on_different_floor: false,
  effective_speed: 18,
  total_battery_life: 120,
  battery_reserve_threshold: 0.20,
  tank_capacity_time: 60,
  distance_to_service_hub: Math.round(Math.sqrt(500 / Math.PI) * 10) / 10, // ≈ 12.6m
  vertical_travel_time: 5,
  effective_charge_time: 90,
  refill_duration: 5,
  field_buffer_multiplier: 1.20,
  comments: '',
};

// Field metadata for UI display
export interface FieldMetadata {
  label: string;
  unit: string;
  tooltip: string;
  defaultJustification: string;
}

export const FIELD_METADATA: Record<string, FieldMetadata> = {
  actual_area_per_floor: {
    label: 'Area per Floor',
    unit: 'm²',
    tooltip: 'Total floor space per floor to be cleaned',
    defaultJustification: 'Typical small-to-medium commercial floor area',
  },
  num_of_passes: {
    label: 'Number of Passes',
    unit: 'passes',
    tooltip: 'Number of cleaning passes over the same area (each pass multiplies the workload)',
    defaultJustification: 'Single pass is standard for routine cleaning',
  },
  overlap_percentage: {
    label: 'Overlap Percentage',
    unit: 'fraction (0–1), e.g. 0.10 = 10%',
    tooltip: 'Cleaning overlap fraction to ensure no streaks between adjacent paths',
    defaultJustification: '10% overlap is typical to avoid missed strips',
  },
  effective_cleaning_width: {
    label: 'Effective Cleaning Width',
    unit: 'm',
    tooltip: 'Actual cleaning path width of the robot',
    defaultJustification: '30cm is a common cleaning width for commercial robots',
  },
  num_of_robots: {
    label: 'Number of Robots',
    unit: 'robots',
    tooltip: 'Total number of robots in the deployment (used in Robot Count mode)',
    defaultJustification: '3 robots is a common small fleet size',
  },
  time_constraint: {
    label: 'Time Constraint',
    unit: 'min',
    tooltip: 'Maximum allowed time to complete the cleaning task',
    defaultJustification: '480 minutes (8 hours) represents a standard work shift',
  },
  num_of_charging_points: {
    label: 'Charging Docks',
    unit: 'docks',
    tooltip: 'Number of charging docks available for the fleet',
    defaultJustification: '2 docks provides some redundancy for a small fleet',
  },
  num_of_refill_stations: {
    label: 'Refill Stations',
    unit: 'stations',
    tooltip: 'Number of water/drainage points for consumables',
    defaultJustification: '1 station is typical for small deployments',
  },
  num_of_floors: {
    label: 'Number of Floors',
    unit: 'floors',
    tooltip: 'Total number of floors the fleet must service',
    defaultJustification: 'Single floor is the simplest deployment scenario',
  },
  num_of_robots_per_elevator_trip: {
    label: 'Robots per Elevator Trip',
    unit: 'robots/trip',
    tooltip: 'Number of robots that can fit in a single elevator trip',
    defaultJustification: '1 robot per trip is conservative for standard elevators',
  },
  num_of_elevators: {
    label: 'Number of Elevators',
    unit: 'elevators',
    tooltip: 'Total number of elevators available for robot transport between floors',
    defaultJustification: '1 elevator is the minimum for multi-floor deployments',
  },
  service_hub_on_different_floor: {
    label: 'Service Hub on Different Floor',
    unit: 'yes/no',
    tooltip: 'Whether the charging/refill hub is on a different floor from cleaning zones (adds vertical travel time to each service trip)',
    defaultJustification: 'Same floor is the most common and efficient setup',
  },
  effective_speed: {
    label: 'Effective Speed',
    unit: 'm/min',
    tooltip: 'Actual operational speed of the robot during cleaning',
    defaultJustification: '18 m/min is typical for commercial cleaning robots',
  },
  total_battery_life: {
    label: 'Total Battery Life',
    unit: 'min',
    tooltip: 'Rated runtime on a full 100% charge',
    defaultJustification: '120 minutes is a common battery capacity for cleaning robots',
  },
  battery_reserve_threshold: {
    label: 'Battery Reserve Threshold',
    unit: 'fraction (0–1), e.g. 0.20 = 20%',
    tooltip: 'Safety floor fraction where the robot triggers return to base for charging',
    defaultJustification: '20% reserve ensures the robot can safely return to dock',
  },
  tank_capacity_time: {
    label: 'Tank Capacity Time',
    unit: 'min',
    tooltip: 'Minutes of active cleaning before a water refill or waste dump is required',
    defaultJustification: '60 minutes is typical for medium-sized water tanks',
  },
  distance_to_service_hub: {
    label: 'Distance to Service Hub',
    unit: 'm',
    tooltip: 'One-way distance from the cleaning zone to the charging/refill hub. Default is estimated as the radius of a circle with area equal to actual_area_per_floor: √(area / π)',
    defaultJustification: 'Estimated as √(area / π) — the radius of a circle with the same area as the floor',
  },
  vertical_travel_time: {
    label: 'Vertical Travel Time',
    unit: 'min',
    tooltip: 'Total time for one elevator cycle including wait and ride',
    defaultJustification: '5 minutes accounts for wait time and ride in a typical building',
  },
  effective_charge_time: {
    label: 'Effective Charge Time',
    unit: 'min',
    tooltip: 'Time to charge from battery_reserve_threshold back to 100%',
    defaultJustification: '90 minutes is typical for a full recharge cycle',
  },
  refill_duration: {
    label: 'Refill Duration',
    unit: 'min',
    tooltip: 'Actual time tethered to the water/waste station for refilling',
    defaultJustification: '5 minutes is typical for automated refill systems',
  },
  field_buffer_multiplier: {
    label: 'Field Buffer Multiplier',
    unit: 'multiplier, e.g. 1.20 = 20% buffer',
    tooltip: 'Real-world multiplier for maintenance, unexpected obstacles, and other inefficiencies. Can also be used to account for multi-floor cleaning overhead (e.g., inter-floor travel not explicitly modelled). This is a rule of thumb, not a scientifically derived value — adjust based on your operational experience.',
    defaultJustification: '1.20 (20% buffer) accounts for typical real-world inefficiencies',
  },
  work_assignment_mode: {
    label: 'Work Assignment Mode',
    unit: 'toggle (Fixed Zones / Collaborative)',
    tooltip: 'Fixed Zones assigns each robot 1/N of the area upfront. Collaborative uses a shared work pool where robots pick up work as they become available.',
    defaultJustification: 'Fixed Zones matches current-generation robot behavior',
  },
};
