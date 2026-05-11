/**
 * Spreadsheet service — parses uploaded CSV/XLSX files and generates templates.
 */

import * as XLSX from 'xlsx';
import { CalculatorInputs } from '../types';
import { DEFAULT_INPUTS, FIELD_METADATA } from '../types/defaults';

/** Known variable names that can be imported from a spreadsheet */
const KNOWN_FIELDS = new Set(Object.keys(DEFAULT_INPUTS).filter(
  k => !['mode', 'startMode', 'work_assignment_mode', 'comments'].includes(k)
));

export interface SpreadsheetParseResult {
  inputs: Partial<CalculatorInputs>;
  warnings: string[];
}

/**
 * Parse an uploaded spreadsheet file (.csv or .xlsx).
 * Expects two columns: variable name (snake_case) and value.
 */
export async function parseSpreadsheet(file: File): Promise<SpreadsheetParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
    throw new Error(`Unsupported file format: .${ext}. Please upload a .csv or .xlsx file.`);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const inputs: Partial<CalculatorInputs> = {};
  const warnings: string[] = [];

  for (const row of rows) {
    if (!row || row.length < 2) continue;
    const name = String(row[0]).trim().toLowerCase();
    const value = row[1];

    // Skip header rows
    if (name === 'variable' || name === 'name' || name === '') continue;

    if (!KNOWN_FIELDS.has(name)) {
      warnings.push(`Unrecognized variable: "${name}"`);
      continue;
    }

    // Handle boolean field
    if (name === 'service_hub_on_different_floor') {
      const strVal = String(value).toLowerCase();
      (inputs as Record<string, unknown>)[name] = strVal === 'true' || strVal === 'yes' || strVal === '1';
    } else {
      const numVal = Number(value);
      if (isNaN(numVal)) {
        warnings.push(`Invalid value for "${name}": "${value}" (expected a number)`);
      } else {
        (inputs as Record<string, unknown>)[name] = numVal;
      }
    }
  }

  return { inputs, warnings };
}

/**
 * Generate a CSV template blob with all variable names and their default values.
 */
export function generateTemplate(): Blob {
  const rows: string[][] = [['variable', 'value', 'unit', 'description']];

  for (const [key, value] of Object.entries(DEFAULT_INPUTS)) {
    if (['mode', 'startMode', 'work_assignment_mode', 'comments'].includes(key)) continue;
    const meta = FIELD_METADATA[key];
    const unit = meta?.unit || '';
    const desc = meta?.tooltip || '';
    rows.push([key, String(value), unit, desc]);
  }

  const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  return new Blob([csv], { type: 'text/csv' });
}
