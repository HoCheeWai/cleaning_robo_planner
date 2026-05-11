import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getDerivedFieldStatus,
  DERIVED_FIELD_DEPENDENCIES,
} from '../derivedFieldStatus';
import { DEFAULT_INPUTS } from '../../../types/defaults';
import { CalculatorInputs } from '../../../types';

// Helper: create inputs with specific overrides
function makeInputs(overrides: Partial<CalculatorInputs> = {}): CalculatorInputs {
  return { ...DEFAULT_INPUTS, ...overrides };
}

// Arbitrary for numeric fields that can be parents
const numericFieldArb = fc.double({ min: 0.01, max: 10000, noNaN: true });

describe('derivedFieldStatus', () => {
  describe('DERIVED_FIELD_DEPENDENCIES', () => {
    it('contains the expected dependency mappings', () => {
      expect(DERIVED_FIELD_DEPENDENCIES.travel_time_to_service_hub).toEqual([
        'distance_to_service_hub',
        'effective_speed',
      ]);
      expect(DERIVED_FIELD_DEPENDENCIES.charging_contention_time).toEqual([
        'num_of_robots',
        'num_of_charging_points',
        'effective_charge_time',
      ]);
      expect(DERIVED_FIELD_DEPENDENCIES.refill_contention_time).toEqual([
        'num_of_robots',
        'num_of_refill_stations',
        'refill_duration',
      ]);
      expect(DERIVED_FIELD_DEPENDENCIES.num_of_recharge_cycles).toContain('total_battery_life');
      expect(DERIVED_FIELD_DEPENDENCIES.num_of_recharge_cycles).toContain('num_of_robots');
      expect(DERIVED_FIELD_DEPENDENCIES.num_of_refill_cycles).toContain('tank_capacity_time');
      expect(DERIVED_FIELD_DEPENDENCIES.num_of_refill_cycles).toContain('num_of_robots');
    });
  });

  // Feature: derived-field-indicators, Property 1: Non-default parent detection
  describe('Property 1: Non-default parent detection', () => {
    // For each derived field, pick a random parent and change it from default.
    // The status should be 'non-default-parents'.
    const derivedFields = Object.keys(DERIVED_FIELD_DEPENDENCIES);

    it('returns non-default-parents when at least one parent differs from default', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...derivedFields),
          numericFieldArb,
          (fieldName, randomValue) => {
            const parents = DERIVED_FIELD_DEPENDENCIES[fieldName];
            // Pick a parent that is NOT distance_to_service_hub for simplicity
            const nonDistanceParents = parents.filter(p => p !== 'distance_to_service_hub');
            if (nonDistanceParents.length === 0) return true; // skip if only distance

            const parentToChange = nonDistanceParents[0];
            const defaultVal = DEFAULT_INPUTS[parentToChange as keyof CalculatorInputs] as number;
            // Ensure the value actually differs from default
            const newValue = randomValue === defaultVal ? defaultVal + 1 : randomValue;

            const inputs = makeInputs({ [parentToChange]: newValue });
            const customized = new Set<string>([parentToChange]);

            const status = getDerivedFieldStatus(fieldName, inputs, customized, DEFAULT_INPUTS);
            return status === 'non-default-parents';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns default when all parents are at their default values', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...derivedFields),
          (fieldName) => {
            // All inputs at defaults, nothing customized
            const inputs = makeInputs();
            const customized = new Set<string>();

            const status = getDerivedFieldStatus(fieldName, inputs, customized, DEFAULT_INPUTS);
            return status === 'default';
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: derived-field-indicators, Property 2: Override detection for distance_to_service_hub
  describe('Property 2: Override detection for distance_to_service_hub', () => {
    it('returns overridden iff distance_to_service_hub is in hasCustomizedFields', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          numericFieldArb,
          (isCustomized, value) => {
            const inputs = makeInputs({ distance_to_service_hub: value });
            const customized = new Set<string>(isCustomized ? ['distance_to_service_hub'] : []);

            const status = getDerivedFieldStatus(
              'distance_to_service_hub',
              inputs,
              customized,
              DEFAULT_INPUTS
            );

            if (isCustomized) {
              return status === 'overridden';
            } else {
              return status === 'default';
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: derived-field-indicators, Property 3: Dynamic default awareness
  describe('Property 3: Dynamic default awareness', () => {
    it('shows non-default-parents on travel_time_to_service_hub when area differs and distance is not customized', () => {
      fc.assert(
        fc.property(
          numericFieldArb,
          (areaValue) => {
            // Ensure area differs from default
            const defaultArea = DEFAULT_INPUTS.actual_area_per_floor;
            const area = areaValue === defaultArea ? defaultArea + 100 : areaValue;

            // distance_to_service_hub is NOT customized — uses dynamic default
            const dynamicDistance = Math.round(Math.sqrt(area / Math.PI) * 10) / 10;
            const inputs = makeInputs({
              actual_area_per_floor: area,
              distance_to_service_hub: dynamicDistance,
            });
            const customized = new Set<string>();

            const status = getDerivedFieldStatus(
              'travel_time_to_service_hub',
              inputs,
              customized,
              DEFAULT_INPUTS
            );
            return status === 'non-default-parents';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('shows default on travel_time_to_service_hub when area is at default and effective_speed is at default and distance is not customized', () => {
      const inputs = makeInputs(); // all defaults
      const customized = new Set<string>();

      const status = getDerivedFieldStatus(
        'travel_time_to_service_hub',
        inputs,
        customized,
        DEFAULT_INPUTS
      );
      expect(status).toBe('default');
    });
  });

  // Feature: derived-field-indicators, Property 4: Static default comparison when distance is overridden
  describe('Property 4: Static default comparison when distance is overridden', () => {
    it('uses static default comparison for travel_time_to_service_hub when distance is overridden', () => {
      fc.assert(
        fc.property(
          numericFieldArb,
          (distanceValue) => {
            const staticDefault = DEFAULT_INPUTS.distance_to_service_hub;
            // Ensure value differs from static default
            const distance = distanceValue === staticDefault ? staticDefault + 5 : distanceValue;

            const inputs = makeInputs({
              distance_to_service_hub: distance,
              // Keep effective_speed at default so only distance matters
              effective_speed: DEFAULT_INPUTS.effective_speed,
            });
            const customized = new Set<string>(['distance_to_service_hub']);

            const status = getDerivedFieldStatus(
              'travel_time_to_service_hub',
              inputs,
              customized,
              DEFAULT_INPUTS
            );
            return status === 'non-default-parents';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns default for travel_time_to_service_hub when overridden distance equals static default', () => {
      const inputs = makeInputs({
        distance_to_service_hub: DEFAULT_INPUTS.distance_to_service_hub,
        effective_speed: DEFAULT_INPUTS.effective_speed,
      });
      const customized = new Set<string>(['distance_to_service_hub']);

      const status = getDerivedFieldStatus(
        'travel_time_to_service_hub',
        inputs,
        customized,
        DEFAULT_INPUTS
      );
      expect(status).toBe('default');
    });
  });

  describe('Edge cases', () => {
    it('returns default for unknown field names', () => {
      const inputs = makeInputs();
      const customized = new Set<string>();
      const status = getDerivedFieldStatus('unknown_field', inputs, customized, DEFAULT_INPUTS);
      expect(status).toBe('default');
    });

    it('returns default for fields not in dependency map and not distance_to_service_hub', () => {
      const inputs = makeInputs();
      const customized = new Set<string>();
      const status = getDerivedFieldStatus('effective_speed', inputs, customized, DEFAULT_INPUTS);
      expect(status).toBe('default');
    });
  });
});
