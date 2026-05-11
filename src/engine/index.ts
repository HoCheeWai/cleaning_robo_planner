/**
 * Calculation Engine — main entry point.
 * Orchestrates validation, solver selection, simulation, and infeasibility detection.
 */

import { CalculatorInputs, CalculationResult } from '../types';
import { validateAll } from '../services/validation';
import { solveRobotCount, solveTimeConstraint } from './solver';
import { detectInfeasibility } from './infeasibility';

export { computeTotalCleaningDistance, computeUsableBatteryTime, computeCleaningTimePerRobot, computeRechargeCycles, computeRefillCycles, computeChargingContention, computeRefillContention, computeTravelTimeToServiceHub, computeFloorDistributionTime } from './formulas';
export { simulateTimeline, computeDeadTime, computeSimulatedElapsedTime } from './timeline';
export { solveRobotCount, solveTimeConstraint, computeTotalElapsedTime, computeDerivedValues } from './solver';
export { detectInfeasibility } from './infeasibility';

/**
 * Main computation entry point.
 * Validates inputs, selects the appropriate solver, runs the simulation,
 * and returns the full calculation result.
 */
export function compute(inputs: CalculatorInputs): CalculationResult {
  // Validate inputs
  const validation = validateAll(inputs, inputs.mode);
  if (!validation.valid) {
    throw new Error(`Invalid inputs: ${validation.errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
  }

  // Check infeasibility (Time Constraint mode only)
  // The solver itself handles infeasibility detection with early termination,
  // so we just run it directly and check the result.
  if (inputs.mode === 'time-constraint') {
    const result = solveTimeConstraint(inputs);
    if (result.infeasible) {
      // Enhance with additional suggestions from detectInfeasibility
      const infeasibility = detectInfeasibility(inputs);
      if (infeasibility) {
        return {
          ...result,
          infeasibilityReason: infeasibility.reason,
          infeasibilitySuggestions: infeasibility.suggestions,
        };
      }
    }
    return result;
  }

  // Robot Count mode
  return solveRobotCount(inputs);
}
