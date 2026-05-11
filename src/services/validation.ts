import { z } from 'zod';
import { CalculationMode, CalculatorInputs, ValidationError, ValidationResult } from '../types';

/**
 * Zod schema for all numeric input fields with appropriate constraints.
 * Non-numeric fields (mode, startMode, work_assignment_mode, service_hub_on_different_floor, comments)
 * are excluded from numeric validation.
 */
export const calculatorSchema = z.object({
  // Workload
  actual_area_per_floor: z.number().positive('must be a positive number'),
  num_of_passes: z.number().int('must be a positive integer').min(1, 'must be a positive integer'),
  overlap_percentage: z.number().gt(0, 'must be between 0 and 1 exclusive').lt(1, 'must be between 0 and 1 exclusive'),
  effective_cleaning_width: z.number().positive('must be a positive number'),

  // Fleet
  num_of_robots: z.number().int('must be a positive integer').min(1, 'must be a positive integer'),
  time_constraint: z.number().positive('must be a positive number'),
  num_of_charging_points: z.number().int('must be a positive integer').min(1, 'must be a positive integer'),
  num_of_refill_stations: z.number().int('must be a positive integer').min(1, 'must be a positive integer'),
  num_of_floors: z.number().int('must be a positive integer').min(1, 'must be a positive integer'),
  num_of_robots_per_elevator_trip: z.number().int('must be a positive integer').min(1, 'must be a positive integer'),
  num_of_elevators: z.number().int('must be a positive integer').min(1, 'must be a positive integer'),

  // Performance
  effective_speed: z.number().positive('must be a positive number'),
  total_battery_life: z.number().positive('must be a positive number'),
  battery_reserve_threshold: z.number().gt(0, 'must be between 0 and 1 exclusive').lt(1, 'must be between 0 and 1 exclusive'),
  tank_capacity_time: z.number().positive('must be a positive number'),

  // Time & Transitions
  distance_to_service_hub: z.number().positive('must be a positive number'),
  vertical_travel_time: z.number().min(0, 'must be zero or positive'),
  effective_charge_time: z.number().min(0, 'must be zero or positive'),
  refill_duration: z.number().min(0, 'must be zero or positive'),

  // Logistical
  field_buffer_multiplier: z.number().min(1.0, 'must be 1.0 or greater'),
});

/** All fields that are validated by the schema */
export type ValidatedField = keyof z.infer<typeof calculatorSchema>;

/** Fields to skip in time-constraint mode (num_of_robots is not needed) */
const TIME_CONSTRAINT_SKIP: ValidatedField[] = ['num_of_robots'];

/** Fields to skip in robot-count mode (time_constraint is not needed) */
const ROBOT_COUNT_SKIP: ValidatedField[] = ['time_constraint'];

/**
 * Validate a single field value against its schema constraint.
 * Returns a ValidationError if invalid, or null if valid.
 */
export function validateField(field: string, value: unknown): ValidationError | null {
  const fieldSchema = calculatorSchema.shape[field as ValidatedField];
  if (!fieldSchema) {
    // Field is not in the validated schema (e.g., mode, comments, booleans)
    return null;
  }

  const result = fieldSchema.safeParse(value);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'Invalid value';
    return { field, message };
  }

  return null;
}

/**
 * Validate all inputs for the given calculation mode.
 * In time-constraint mode, num_of_robots is skipped.
 * In robot-count mode, time_constraint is skipped.
 */
export function validateAll(inputs: CalculatorInputs, mode: CalculationMode): ValidationResult {
  const skipFields = mode === 'time-constraint' ? TIME_CONSTRAINT_SKIP : ROBOT_COUNT_SKIP;
  const errors: ValidationError[] = [];

  for (const [field, schema] of Object.entries(calculatorSchema.shape)) {
    if (skipFields.includes(field as ValidatedField)) {
      continue;
    }

    const value = inputs[field as keyof CalculatorInputs];
    const result = schema.safeParse(value);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'Invalid value';
      errors.push({ field, message });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
