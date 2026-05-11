import { CalculatorInputs } from '../../types';
import { DEFAULT_INPUTS } from '../../types/defaults';

export type DerivedFieldStatus = 'default' | 'non-default-parents' | 'overridden';

/**
 * Maps each derived field to its parent input dependencies.
 * Used to determine whether a derived field's computed value
 * is influenced by non-default parent inputs.
 */
export const DERIVED_FIELD_DEPENDENCIES: Record<string, string[]> = {
  total_cleaning_distance: ['actual_area_per_floor', 'num_of_floors', 'num_of_passes', 'effective_cleaning_width', 'overlap_percentage'],
  travel_time_to_service_hub: ['distance_to_service_hub', 'effective_speed'],
  charging_contention_time: ['num_of_robots', 'num_of_charging_points', 'effective_charge_time'],
  refill_contention_time: ['num_of_robots', 'num_of_refill_stations', 'refill_duration'],
  num_of_recharge_cycles: [
    'total_battery_life',
    'battery_reserve_threshold',
    'actual_area_per_floor',
    'num_of_floors',
    'num_of_passes',
    'effective_cleaning_width',
    'overlap_percentage',
    'effective_speed',
    'num_of_robots',
  ],
  num_of_refill_cycles: [
    'tank_capacity_time',
    'actual_area_per_floor',
    'num_of_floors',
    'num_of_passes',
    'effective_cleaning_width',
    'overlap_percentage',
    'effective_speed',
    'num_of_robots',
  ],
};

/**
 * Computes the indicator status for a given field.
 *
 * - 'overridden': The field is distance_to_service_hub and the user has manually overridden it.
 * - 'non-default-parents': At least one parent input differs from its default value.
 * - 'default': All parent inputs are at their default values (no indicator needed).
 *
 * Special handling for distance_to_service_hub as a parent dependency:
 * - If distance_to_service_hub is NOT manually overridden, its effective value is the
 *   dynamic default √(actual_area_per_floor / π). We compare this against the static
 *   DEFAULT_INPUTS.distance_to_service_hub to determine if it's "non-default".
 * - If distance_to_service_hub IS manually overridden, we compare the current input value
 *   directly against the static DEFAULT_INPUTS.distance_to_service_hub.
 */
export function getDerivedFieldStatus(
  fieldName: string,
  inputs: CalculatorInputs,
  hasCustomizedFields: Set<string>,
  defaultInputs: CalculatorInputs = DEFAULT_INPUTS
): DerivedFieldStatus {
  // Override indicator for distance_to_service_hub itself
  if (fieldName === 'distance_to_service_hub') {
    if (hasCustomizedFields.has('distance_to_service_hub')) {
      return 'overridden'; // User manually typed a value — blue
    }
    // Check if the dynamic default differs from the static default (area changed)
    if (inputs.actual_area_per_floor !== defaultInputs.actual_area_per_floor) {
      return 'non-default-parents'; // Value changed because area changed — amber
    }
    return 'default';
  }

  const dependencies = DERIVED_FIELD_DEPENDENCIES[fieldName];
  if (!dependencies) {
    return 'default';
  }

  for (const parent of dependencies) {
    if (parent === 'distance_to_service_hub') {
      // Special handling for dynamic default
      if (hasCustomizedFields.has('distance_to_service_hub')) {
        // User overrode it — compare current value against static default
        if (inputs.distance_to_service_hub !== defaultInputs.distance_to_service_hub) {
          return 'non-default-parents';
        }
      } else {
        // Using dynamic default — check if area differs from default (which changes the dynamic default)
        if (inputs.actual_area_per_floor !== defaultInputs.actual_area_per_floor) {
          return 'non-default-parents';
        }
      }
    } else {
      const currentValue = inputs[parent as keyof CalculatorInputs];
      const defaultValue = defaultInputs[parent as keyof CalculatorInputs];
      if (currentValue !== defaultValue) {
        return 'non-default-parents';
      }
    }
  }

  return 'default';
}
