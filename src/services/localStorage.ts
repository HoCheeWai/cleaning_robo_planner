/**
 * LocalStorage service — persists calculator inputs between sessions.
 */

import { CalculatorInputs } from '../types';
import { DEFAULT_INPUTS } from '../types/defaults';

const STORAGE_KEY = 'cleaning-robot-fleet-calculator-inputs';
const CURRENT_VERSION = 1;

interface StoredData {
  version: number;
  inputs: CalculatorInputs;
  savedAt: string;
}

/**
 * Save inputs to localStorage with version metadata.
 * Fails gracefully if storage is full.
 */
export function saveInputs(inputs: CalculatorInputs): { success: boolean; error?: string } {
  try {
    const data: StoredData = {
      version: CURRENT_VERSION,
      inputs,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.warn('Failed to save to localStorage:', message);
    return { success: false, error: message };
  }
}

/**
 * Load inputs from localStorage.
 * Returns null if no data exists, data is corrupted, or version mismatch.
 */
export function loadInputs(): CalculatorInputs | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data: StoredData = JSON.parse(raw);

    // Version check
    if (data.version !== CURRENT_VERSION) {
      console.warn('Stored data version mismatch, discarding');
      clearInputs();
      return null;
    }

    // Merge with defaults to handle any missing fields (forward compatibility)
    return { ...DEFAULT_INPUTS, ...data.inputs };
  } catch (e) {
    console.warn('Failed to load from localStorage, discarding corrupted data');
    clearInputs();
    return null;
  }
}

/**
 * Clear all saved inputs from localStorage.
 */
export function clearInputs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // Silently ignore
  }
}
