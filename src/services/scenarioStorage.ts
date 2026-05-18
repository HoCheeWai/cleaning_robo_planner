/**
 * Scenario Storage service — persists saved scenarios in localStorage.
 * Uses a dedicated key separate from the existing input persistence.
 */

import { CalculatorInputs, CalculationResult } from '../types';

const STORAGE_KEY = 'cleaning-robot-fleet-scenarios';
const MAX_SCENARIOS = 20;

export interface SavedScenario {
  id: string;
  name: string;
  savedAt: string;
  inputs: CalculatorInputs;
  result: CalculationResult;
}

/**
 * Load all saved scenarios from localStorage.
 * Returns an empty array if no data exists or data is corrupted.
 */
export function getScenarios(): SavedScenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    console.warn('Failed to parse saved scenarios, resetting');
    return [];
  }
}

/**
 * Save a new scenario to localStorage.
 * Enforces a maximum of 20 scenarios and handles quota errors.
 */
export function saveScenario(scenario: SavedScenario): { success: boolean; error?: string } {
  try {
    const scenarios = getScenarios();
    if (scenarios.length >= MAX_SCENARIOS) {
      return { success: false, error: 'Maximum of 20 scenarios reached. Delete some to save new ones.' };
    }
    scenarios.push(scenario);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to save scenario' };
  }
}

/**
 * Delete a scenario by ID and persist the updated array.
 */
export function deleteScenario(id: string): void {
  const scenarios = getScenarios().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
}

/**
 * Check if the maximum scenario limit has been reached.
 */
export function isAtLimit(): boolean {
  return getScenarios().length >= MAX_SCENARIOS;
}
