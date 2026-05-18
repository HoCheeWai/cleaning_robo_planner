// Services entry point
export { calculatorSchema, validateField, validateAll } from './validation';
export type { ValidatedField } from './validation';
export { saveInputs, loadInputs, clearInputs } from './localStorage';
export { parseSpreadsheet, generateTemplate } from './spreadsheet';
export { generatePDF, getPDFFilename, svgToDataUrl } from './pdfExport';
export { getScenarios, saveScenario, deleteScenario, isAtLimit } from './scenarioStorage';
export type { SavedScenario } from './scenarioStorage';
