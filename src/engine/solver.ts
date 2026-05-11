/**
 * Solver module — uses the timeline simulation as the source of truth for elapsed time.
 * Provides both Robot Count mode (direct simulation) and Time Constraint mode (iterative solver).
 */

import {
  CalculatorInputs,
  CalculationResult,
  DerivedValues,
  TimeContributions,
  OptimizationSuggestion,
  RobotTimeline,
} from '../types';
import {
  computeTotalCleaningDistance,
  computeUsableBatteryTime,
  computeCleaningTimePerRobot,
  computeRechargeCycles,
  computeRefillCycles,
  computeChargingContention,
  computeRefillContention,
  computeTravelTimeToServiceHub,
  computeFloorDistributionTime,
} from './formulas';
import { simulateTimeline, computeDeadTime } from './timeline';

const MAX_ROBOTS = 1000;

/**
 * Compute total elapsed time for a given number of robots.
 * Runs the simulation and returns rawElapsedTime × field_buffer_multiplier.
 */
export function computeTotalElapsedTime(inputs: CalculatorInputs, numRobots: number): number {
  const result = simulateTimeline(inputs, numRobots, inputs.startMode);
  return result.rawElapsedTime * inputs.field_buffer_multiplier;
}

/**
 * Solve Robot Count mode: compute total time for the given fleet size.
 */
export function solveRobotCount(inputs: CalculatorInputs): CalculationResult {
  const numRobots = inputs.num_of_robots;
  const simResult = simulateTimeline(inputs, numRobots, inputs.startMode);
  const totalElapsedTime = simResult.rawElapsedTime * inputs.field_buffer_multiplier;

  const derived = computeDerivedValues(inputs, numRobots);
  const contributions = extractBreakdownFromTimeline(simResult.timelines, numRobots, inputs.field_buffer_multiplier, simResult.rawElapsedTime);
  const optimizations = computeOptimizations(contributions, derived, inputs);
  const deadTime = computeDeadTime(simResult.timelines, simResult.rawElapsedTime);

  return {
    mode: 'robot-count',
    num_of_robots: numRobots,
    total_elapsed_time: totalElapsedTime,
    cleaning_time_per_robot: derived.cleaning_time_per_robot,
    recharge_downtime_total: contributions._rechargeMin * numRobots,
    refill_downtime_total: contributions._refillMin * numRobots,
    initial_floor_distribution_time: computeFloorDistributionTime(
      numRobots, inputs.num_of_robots_per_elevator_trip, inputs.num_of_elevators,
      inputs.vertical_travel_time, inputs.num_of_floors
    ),
    field_buffer_impact: simResult.rawElapsedTime * (inputs.field_buffer_multiplier - 1),
    derived,
    contributions,
    optimizations,
    timeline: simResult.timelines,
    efficiencyData: simResult.efficiencyData,
    deadTime,
    infeasible: false,
  };
}

/**
 * Solve Time Constraint mode: find minimum robots to complete within the time constraint.
 * Uses iterative approach — runs simulation for each candidate num_of_robots.
 * Stops early if adding more robots makes things worse (diminishing returns from floor distribution overhead).
 */
export function solveTimeConstraint(inputs: CalculatorInputs): CalculationResult {
  let prevElapsed = Infinity;
  let bestRobots = 1;
  let bestElapsed = Infinity;

  for (let numRobots = 1; numRobots <= MAX_ROBOTS; numRobots++) {
    const elapsed = computeTotalElapsedTime(inputs, numRobots);
    
    // Track the best (minimum elapsed time) seen so far
    if (elapsed < bestElapsed) {
      bestElapsed = elapsed;
      bestRobots = numRobots;
    }

    if (elapsed <= inputs.time_constraint) {
      // Found the minimum — run full simulation for the result
      const simResult = simulateTimeline(inputs, numRobots, inputs.startMode);
      const totalElapsedTime = simResult.rawElapsedTime * inputs.field_buffer_multiplier;
      const derived = computeDerivedValues(inputs, numRobots);
      const contributions = extractBreakdownFromTimeline(simResult.timelines, numRobots, inputs.field_buffer_multiplier, simResult.rawElapsedTime);
      const optimizations = computeOptimizations(contributions, derived, inputs);
      const deadTime = computeDeadTime(simResult.timelines, simResult.rawElapsedTime);

      return {
        mode: 'time-constraint',
        num_of_robots: numRobots,
        total_elapsed_time: totalElapsedTime,
        cleaning_time_per_robot: derived.cleaning_time_per_robot,
        recharge_downtime_total: contributions._rechargeMin * numRobots,
        refill_downtime_total: contributions._refillMin * numRobots,
        initial_floor_distribution_time: computeFloorDistributionTime(
          numRobots, inputs.num_of_robots_per_elevator_trip, inputs.num_of_elevators,
          inputs.vertical_travel_time, inputs.num_of_floors
        ),
        field_buffer_impact: simResult.rawElapsedTime * (inputs.field_buffer_multiplier - 1),
        derived,
        contributions,
        optimizations,
        timeline: simResult.timelines,
        efficiencyData: simResult.efficiencyData,
        deadTime,
        infeasible: false,
      };
    }

    // Early termination: if elapsed is increasing (adding robots makes it worse),
    // and we've already passed the minimum, stop searching
    if (elapsed > prevElapsed && numRobots > bestRobots + 5) {
      break;
    }
    prevElapsed = elapsed;
  }

  // Infeasible — couldn't find a solution
  return {
    mode: 'time-constraint',
    num_of_robots: bestRobots,
    total_elapsed_time: bestElapsed,
    cleaning_time_per_robot: 0,
    recharge_downtime_total: 0,
    refill_downtime_total: 0,
    initial_floor_distribution_time: 0,
    field_buffer_impact: 0,
    derived: computeDerivedValues(inputs, bestRobots),
    contributions: { active_cleaning_pct: 0, charging_overhead_pct: 0, refill_overhead_pct: 0, travel_overhead_pct: 0, waiting_contention_pct: 0, floor_distribution_pct: 0, field_buffer_pct: 0 },
    optimizations: [],
    timeline: [],
    efficiencyData: [],
    deadTime: { total_dead_time: 0, dead_periods: [], dead_time_pct: 0 },
    infeasible: true,
    infeasibilityReason: `Cannot complete within ${inputs.time_constraint} minutes. Best achievable: ${bestElapsed.toFixed(0)} minutes with ${bestRobots} robots. Adding more robots increases overhead (elevator distribution time) without reducing cleaning time.`,
    infeasibilitySuggestions: [
      `Increase time constraint to at least ${Math.ceil(bestElapsed)} minutes`,
      inputs.num_of_floors > 1 ? 'Add more elevators or increase elevator capacity to reduce distribution overhead' : '',
      'Add more charging docks to reduce contention',
      'Add more refill stations to reduce contention',
    ].filter(Boolean),
  };
}

/**
 * Compute derived values from inputs (for display in the UI).
 */
export function computeDerivedValues(inputs: CalculatorInputs, numRobots: number): DerivedValues {
  const totalDist = computeTotalCleaningDistance(
    inputs.actual_area_per_floor, inputs.num_of_floors, inputs.num_of_passes,
    inputs.effective_cleaning_width, inputs.overlap_percentage
  );
  const usableBatt = computeUsableBatteryTime(inputs.total_battery_life, inputs.battery_reserve_threshold);
  const cleanPerRobot = computeCleaningTimePerRobot(totalDist, inputs.effective_speed, numRobots);
  const travelTime = computeTravelTimeToServiceHub(inputs.distance_to_service_hub, inputs.effective_speed);
  const floorPenalty = inputs.service_hub_on_different_floor ? inputs.vertical_travel_time : 0;

  return {
    travel_time_to_service_hub: travelTime,
    charging_contention_time: computeChargingContention(numRobots, inputs.num_of_charging_points, inputs.effective_charge_time),
    refill_contention_time: computeRefillContention(numRobots, inputs.num_of_refill_stations, inputs.refill_duration),
    num_of_recharge_cycles: computeRechargeCycles(cleanPerRobot, usableBatt),
    num_of_refill_cycles: computeRefillCycles(cleanPerRobot, inputs.tank_capacity_time),
    total_cleaning_distance: totalDist,
    usable_battery_time: usableBatt,
    cleaning_time_per_robot: cleanPerRobot,
    service_hub_floor_penalty: floorPenalty,
  };
}

/**
 * Extract time breakdown from simulation timeline data.
 * Aggregates segment durations by activity type across all robots.
 */
export function extractBreakdownFromTimeline(
  timelines: RobotTimeline[],
  numRobots: number,
  fieldBufferMultiplier: number,
  _rawElapsedTime: number
): TimeContributions & { _rechargeMin: number; _refillMin: number } {
  let cleaning = 0, charging = 0, refilling = 0, traveling = 0, waiting = 0, idle = 0, elevator = 0;

  for (const tl of timelines) {
    for (const seg of tl.segments) {
      const dur = seg.end - seg.start;
      switch (seg.activity) {
        case 'cleaning': cleaning += dur; break;
        case 'charging': charging += dur; break;
        case 'refilling': refilling += dur; break;
        case 'traveling': traveling += dur; break;
        case 'waiting-charge': case 'waiting-refill': waiting += dur; break;
        case 'elevator': elevator += dur; break;
        case 'idle': idle += dur; break;
      }
    }
  }

  // Percentages based on contribution to total elapsed time
  const effectiveTotal = cleaning + charging + refilling + traveling + waiting + elevator + idle;

  return {
    active_cleaning_pct: effectiveTotal > 0 ? (cleaning / effectiveTotal) * 100 : 0,
    charging_overhead_pct: effectiveTotal > 0 ? (charging / effectiveTotal) * 100 : 0,
    refill_overhead_pct: effectiveTotal > 0 ? (refilling / effectiveTotal) * 100 : 0,
    travel_overhead_pct: effectiveTotal > 0 ? (traveling / effectiveTotal) * 100 : 0,
    waiting_contention_pct: effectiveTotal > 0 ? (waiting / effectiveTotal) * 100 : 0,
    floor_distribution_pct: effectiveTotal > 0 ? (elevator / effectiveTotal) * 100 : 0,
    field_buffer_pct: effectiveTotal > 0 ? ((fieldBufferMultiplier - 1) / fieldBufferMultiplier) * 100 : 0,
    _rechargeMin: charging / numRobots,
    _refillMin: refilling / numRobots,
  };
}

/**
 * Compute top 3 optimization suggestions ranked by time contribution.
 */
export function computeOptimizations(
  contributions: TimeContributions & { _rechargeMin: number; _refillMin: number },
  _derived: DerivedValues,
  inputs: CalculatorInputs
): OptimizationSuggestion[] {
  const items: OptimizationSuggestion[] = [];

  if (contributions.charging_overhead_pct > 0) {
    items.push({
      variable: 'charging',
      label: 'Charging Overhead',
      contribution_minutes: contributions._rechargeMin,
      suggestion: 'Consider robots with larger batteries or faster charging.',
    });
  }
  if (contributions.waiting_contention_pct > 0) {
    items.push({
      variable: 'contention',
      label: 'Resource Contention (Waiting)',
      contribution_minutes: contributions.waiting_contention_pct,
      suggestion: `Add more charging docks (have ${inputs.num_of_charging_points}) or refill stations (have ${inputs.num_of_refill_stations}).`,
    });
  }
  if (contributions.refill_overhead_pct > 0) {
    items.push({
      variable: 'refilling',
      label: 'Refill Overhead',
      contribution_minutes: contributions._refillMin,
      suggestion: 'Consider robots with larger tanks to reduce refill frequency.',
    });
  }
  if (contributions.travel_overhead_pct > 0) {
    items.push({
      variable: 'traveling',
      label: 'Travel Overhead',
      contribution_minutes: contributions.travel_overhead_pct,
      suggestion: `Position service hub closer to cleaning zones (currently ${inputs.distance_to_service_hub.toFixed(1)}m away).`,
    });
  }

  // Sort by percentage contribution descending, return top 3
  items.sort((a, b) => b.contribution_minutes - a.contribution_minutes);
  return items.slice(0, 3);
}
