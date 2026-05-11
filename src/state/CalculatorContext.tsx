import React, { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
import {
  CalculatorInputs,
  CalculationMode,
  StartMode,
  WorkAssignmentMode,
  CalculationResult,
  DerivedValues,
  ValidationError,
} from '../types';
import { DEFAULT_INPUTS } from '../types/defaults';
import { validateAll, validateField } from '../services/validation';
import { saveInputs, loadInputs, clearInputs } from '../services/localStorage';
import { compute } from '../engine/index';
import { computeDerivedValues } from '../engine/solver';

// ===== Actions =====

export type CalculatorAction =
  | { type: 'UPDATE_INPUT'; field: keyof CalculatorInputs; value: unknown }
  | { type: 'SET_MODE'; mode: CalculationMode }
  | { type: 'SET_START_MODE'; startMode: StartMode }
  | { type: 'SET_WORK_ASSIGNMENT_MODE'; workAssignmentMode: WorkAssignmentMode }
  | { type: 'CALCULATE' }
  | { type: 'RESET' }
  | { type: 'LOAD_FROM_STORAGE'; inputs: Partial<CalculatorInputs> }
  | { type: 'LOAD_FROM_SPREADSHEET'; inputs: Partial<CalculatorInputs> }
  | { type: 'SET_VALIDATION_ERRORS'; errors: ValidationError[] }
  | { type: 'CLEAR_VALIDATION_ERROR'; field: string };

// ===== State =====

export interface CalculatorState {
  inputs: CalculatorInputs;
  derived: DerivedValues | null;
  result: CalculationResult | null;
  validationErrors: ValidationError[];
  isCalculating: boolean;
  hasCustomizedFields: Set<string>;
}

const initialState: CalculatorState = {
  inputs: { ...DEFAULT_INPUTS },
  derived: null,
  result: null,
  validationErrors: [],
  isCalculating: false,
  hasCustomizedFields: new Set(),
};

// ===== Reducer =====

function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case 'UPDATE_INPUT': {
      const { field, value } = action;
      const newInputs = { ...state.inputs, [field]: value };

      // Track customized fields
      const newCustomized = new Set(state.hasCustomizedFields);
      const defaultVal = DEFAULT_INPUTS[field];
      if (value !== defaultVal) {
        newCustomized.add(field);
      } else {
        newCustomized.delete(field);
      }

      // Dynamic default for distance_to_service_hub when area changes
      if (field === 'actual_area_per_floor' && !state.hasCustomizedFields.has('distance_to_service_hub')) {
        const area = value as number;
        if (area > 0) {
          newInputs.distance_to_service_hub = Math.round(Math.sqrt(area / Math.PI) * 10) / 10;
        }
      }

      // Disable service_hub_on_different_floor when num_of_floors = 1
      if (field === 'num_of_floors' && value === 1) {
        newInputs.service_hub_on_different_floor = false;
      }

      // Clear validation error for this field on change
      const newErrors = state.validationErrors.filter(e => e.field !== field);

      // Validate the field inline
      const error = validateField(field, value);
      if (error) {
        newErrors.push(error);
      }

      // Recompute derived values
      const numRobots = newInputs.mode === 'time-constraint' ? (newInputs.num_of_robots || 3) : newInputs.num_of_robots;
      let derived: DerivedValues | null = null;
      try {
        derived = computeDerivedValues(newInputs, numRobots);
      } catch {
        // If inputs are invalid, derived stays null
      }

      return {
        ...state,
        inputs: newInputs,
        derived,
        validationErrors: newErrors,
        hasCustomizedFields: newCustomized,
      };
    }

    case 'SET_MODE': {
      const newInputs = { ...state.inputs, mode: action.mode };
      return {
        ...state,
        inputs: newInputs,
        result: null,
      };
    }

    case 'SET_START_MODE': {
      const newInputs = { ...state.inputs, startMode: action.startMode };
      return {
        ...state,
        inputs: newInputs,
        result: null,
      };
    }

    case 'SET_WORK_ASSIGNMENT_MODE': {
      const newInputs = { ...state.inputs, work_assignment_mode: action.workAssignmentMode };
      return {
        ...state,
        inputs: newInputs,
        result: null,
      };
    }

    case 'CALCULATE': {
      // Validate all inputs
      const validation = validateAll(state.inputs, state.inputs.mode);
      if (!validation.valid) {
        return {
          ...state,
          validationErrors: validation.errors,
          isCalculating: false,
        };
      }

      // Run computation
      try {
        const result = compute(state.inputs);
        // Save to localStorage on successful calculation
        saveInputs(state.inputs);
        return {
          ...state,
          result,
          validationErrors: [],
          isCalculating: false,
          derived: result.derived,
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Calculation failed';
        return {
          ...state,
          validationErrors: [{ field: '_general', message }],
          isCalculating: false,
        };
      }
    }

    case 'RESET': {
      clearInputs();
      return {
        ...initialState,
        inputs: { ...DEFAULT_INPUTS },
        derived: computeDerivedValues(DEFAULT_INPUTS, DEFAULT_INPUTS.num_of_robots),
      };
    }

    case 'LOAD_FROM_STORAGE': {
      const merged = { ...DEFAULT_INPUTS, ...action.inputs };
      const customized = new Set<string>();
      for (const key of Object.keys(action.inputs) as Array<keyof CalculatorInputs>) {
        if (action.inputs[key] !== DEFAULT_INPUTS[key]) {
          customized.add(key);
        }
      }
      const numRobots = merged.mode === 'time-constraint' ? merged.num_of_robots : merged.num_of_robots;
      let derived: DerivedValues | null = null;
      try {
        derived = computeDerivedValues(merged, numRobots);
      } catch {
        // ignore
      }
      return {
        ...state,
        inputs: merged,
        derived,
        hasCustomizedFields: customized,
      };
    }

    case 'LOAD_FROM_SPREADSHEET': {
      const merged = { ...state.inputs, ...action.inputs };
      const newCustomized = new Set(state.hasCustomizedFields);
      for (const key of Object.keys(action.inputs) as Array<keyof CalculatorInputs>) {
        if (action.inputs[key] !== DEFAULT_INPUTS[key]) {
          newCustomized.add(key);
        }
      }
      let derived: DerivedValues | null = null;
      try {
        derived = computeDerivedValues(merged, merged.num_of_robots);
      } catch {
        // ignore
      }
      return {
        ...state,
        inputs: merged,
        derived,
        hasCustomizedFields: newCustomized,
        result: null,
      };
    }

    case 'SET_VALIDATION_ERRORS': {
      return {
        ...state,
        validationErrors: action.errors,
      };
    }

    case 'CLEAR_VALIDATION_ERROR': {
      return {
        ...state,
        validationErrors: state.validationErrors.filter(e => e.field !== action.field),
      };
    }

    default:
      return state;
  }
}

// ===== Context =====

interface CalculatorContextValue {
  state: CalculatorState;
  dispatch: React.Dispatch<CalculatorAction>;
}

const CalculatorContext = createContext<CalculatorContextValue | null>(null);

// ===== Provider =====

export function CalculatorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(calculatorReducer, initialState);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadInputs();
    if (stored) {
      dispatch({ type: 'LOAD_FROM_STORAGE', inputs: stored });
    } else {
      // Compute initial derived values
      dispatch({ type: 'LOAD_FROM_STORAGE', inputs: DEFAULT_INPUTS });
    }
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <CalculatorContext.Provider value={value}>
      {children}
    </CalculatorContext.Provider>
  );
}

// ===== Hook =====

export function useCalculator() {
  const context = useContext(CalculatorContext);
  if (!context) {
    throw new Error('useCalculator must be used within a CalculatorProvider');
  }
  return context;
}
