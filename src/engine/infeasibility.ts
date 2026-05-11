/**
 * Infeasibility detection — identifies when a scenario cannot be completed
 * within the time constraint and provides actionable suggestions.
 */

import { CalculatorInputs, InfeasibilityResult } from '../types';
import {
  computeTotalCleaningDistance,
  computeUsableBatteryTime,
  computeTravelTimeToServiceHub,
  computeFloorDistributionTime,
} from './formulas';

/**
 * Detect if the given inputs are infeasible in Time Constraint mode.
 * Returns null if feasible, or an InfeasibilityResult with explanation and suggestions.
 * Note: This only does quick pre-checks. The solver handles full infeasibility detection.
 */
export function detectInfeasibility(inputs: CalculatorInputs): InfeasibilityResult | null {
  if (inputs.mode !== 'time-constraint') return null;

  const timeConstraint = inputs.time_constraint;
  const bindingConstraints: string[] = [];
  const suggestions: string[] = [];

  // Check 1: Can even 1 robot's minimum cycle fit within the constraint?
  const travelTime = computeTravelTimeToServiceHub(inputs.distance_to_service_hub, inputs.effective_speed);
  const usableBatt = computeUsableBatteryTime(inputs.total_battery_life, inputs.battery_reserve_threshold);
  const minCycleTime = Math.min(usableBatt, inputs.tank_capacity_time) + travelTime + 
    Math.max(inputs.effective_charge_time, inputs.refill_duration) + travelTime;
  
  if (minCycleTime * inputs.field_buffer_multiplier > timeConstraint) {
    bindingConstraints.push('Time constraint is shorter than a single robot\'s minimum service cycle');
    suggestions.push(`Increase time constraint to at least ${(minCycleTime * inputs.field_buffer_multiplier).toFixed(0)} minutes`);
  }

  // Check 2: Floor distribution time with a reasonable robot count
  // Use a rough estimate: total cleaning time / time constraint gives minimum robots needed ignoring overhead
  const totalDist = computeTotalCleaningDistance(
    inputs.actual_area_per_floor, inputs.num_of_floors, inputs.num_of_passes,
    inputs.effective_cleaning_width, inputs.overlap_percentage
  );
  const roughMinRobots = Math.ceil(totalDist / (inputs.effective_speed * timeConstraint / inputs.field_buffer_multiplier));
  const floorDistTime = computeFloorDistributionTime(
    roughMinRobots, inputs.num_of_robots_per_elevator_trip, inputs.num_of_elevators,
    inputs.vertical_travel_time, inputs.num_of_floors
  );
  if (floorDistTime * inputs.field_buffer_multiplier > timeConstraint && inputs.num_of_floors > 1) {
    bindingConstraints.push('Elevator throughput bottleneck — floor distribution time exceeds the constraint for the estimated fleet size');
    suggestions.push('Add more elevators or increase elevator capacity');
  }

  // Check 3 is handled by the solver's early termination logic.
  // We don't run computeTotalElapsedTime(inputs, MAX_ROBOTS) here because
  // with limited elevators, 1000 robots creates an absurd floor distribution time.

  if (bindingConstraints.length === 0) return null;

  // Sort suggestions by impact (those with numbers first)
  suggestions.sort((a, b) => {
    const aNum = a.match(/save ~(\d+)/);
    const bNum = b.match(/save ~(\d+)/);
    if (aNum && bNum) return parseInt(bNum[1]) - parseInt(aNum[1]);
    if (aNum) return -1;
    if (bNum) return 1;
    return 0;
  });

  return {
    reason: `The cleaning task cannot be completed within ${timeConstraint} minutes. ${bindingConstraints[0]}.`,
    bindingConstraints,
    suggestions,
  };
}
