import { useReducer, useEffect } from 'react';
import { CalculatorInputs, CalculationResult } from '../../types';
import { getScenarios, saveScenario, deleteScenario, isAtLimit, SavedScenario } from '../../services/scenarioStorage';
import { ComparisonTable } from '../ComparisonTable/ComparisonTable';
import styles from './ScenarioPanel.module.css';

// ===== State & Actions =====

export interface ScenarioState {
  scenarios: SavedScenario[];
  selectedIds: Set<string>;
}

export type ScenarioAction =
  | { type: 'LOAD_SCENARIOS'; scenarios: SavedScenario[] }
  | { type: 'ADD_SCENARIO'; scenario: SavedScenario }
  | { type: 'DELETE_SCENARIO'; id: string }
  | { type: 'TOGGLE_SELECTION'; id: string }
  | { type: 'CLEAR_SELECTION' };

export function scenarioReducer(state: ScenarioState, action: ScenarioAction): ScenarioState {
  switch (action.type) {
    case 'LOAD_SCENARIOS':
      return {
        ...state,
        scenarios: action.scenarios,
        selectedIds: new Set(),
      };

    case 'ADD_SCENARIO':
      return {
        ...state,
        scenarios: [...state.scenarios, action.scenario],
      };

    case 'DELETE_SCENARIO': {
      const newSelected = new Set(state.selectedIds);
      newSelected.delete(action.id);
      return {
        ...state,
        scenarios: state.scenarios.filter(s => s.id !== action.id),
        selectedIds: newSelected,
      };
    }

    case 'TOGGLE_SELECTION': {
      const newSelected = new Set(state.selectedIds);
      if (newSelected.has(action.id)) {
        newSelected.delete(action.id);
      } else {
        newSelected.add(action.id);
      }
      return {
        ...state,
        selectedIds: newSelected,
      };
    }

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedIds: new Set(),
      };

    default:
      return state;
  }
}

// ===== Props =====

interface ScenarioPanelProps {
  currentResult: CalculationResult | null;
  currentInputs: CalculatorInputs;
  onLoadScenario: (inputs: CalculatorInputs) => void;
  onExportComparison: (scenarios: SavedScenario[]) => void;
}

// ===== Component =====

export function ScenarioPanel({ currentResult, currentInputs, onLoadScenario, onExportComparison }: ScenarioPanelProps) {
  const initialState: ScenarioState = {
    scenarios: [],
    selectedIds: new Set<string>(),
  };
  const [state, dispatch] = useReducer(scenarioReducer, initialState);

  // Load scenarios from localStorage on mount
  useEffect(() => {
    const scenarios = getScenarios();
    dispatch({ type: 'LOAD_SCENARIOS', scenarios });
  }, []);

  const atLimit = isAtLimit();
  const saveDisabled = !currentResult || atLimit;

  const handleSave = () => {
    if (!currentResult) return;

    const name = window.prompt('Enter a name for this scenario:');
    if (!name || !name.trim()) return;

    const scenario: SavedScenario = {
      id: crypto.randomUUID(),
      name: name.trim(),
      savedAt: new Date().toISOString(),
      inputs: currentInputs,
      result: currentResult,
    };

    const result = saveScenario(scenario);
    if (result.success) {
      dispatch({ type: 'ADD_SCENARIO', scenario });
    } else {
      window.alert(result.error || 'Failed to save scenario.');
    }
  };

  const handleDelete = (id: string) => {
    deleteScenario(id);
    dispatch({ type: 'DELETE_SCENARIO', id });
  };

  const handleLoad = (scenario: SavedScenario) => {
    onLoadScenario(scenario.inputs);
  };

  const handleToggleSelection = (id: string) => {
    dispatch({ type: 'TOGGLE_SELECTION', id });
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const getModeLabel = (scenario: SavedScenario) => {
    return scenario.result.mode === 'time-constraint' ? 'Time Constraint' : 'Robot Count';
  };

  const formatElapsed = (min: number) => {
    if (min > 60) {
      const h = Math.floor(min / 60);
      const m = Math.round(min % 60);
      return `${h}h ${m}m`;
    }
    return `${min.toFixed(1)} min`;
  };

  const selectedScenarios = state.scenarios.filter(s => state.selectedIds.has(s.id));
  const showComparison = selectedScenarios.length >= 2 && selectedScenarios.length <= 4;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Saved Scenarios</span>
        <div>
          {atLimit && <span className={styles.limitMessage}>Limit reached (20) </span>}
          <button
            type="button"
            className={styles.saveBtn}
            disabled={saveDisabled}
            onClick={handleSave}
            aria-label="Save Scenario"
          >
            Save Scenario
          </button>
        </div>
      </div>

      {state.scenarios.length === 0 ? (
        <div className={styles.placeholder}>
          No scenarios saved yet. Calculate a result and save it to compare configurations.
        </div>
      ) : (
        <div className={styles.scenarioList}>
          {state.scenarios.map(scenario => (
            <div key={scenario.id} className={styles.card}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={state.selectedIds.has(scenario.id)}
                onChange={() => handleToggleSelection(scenario.id)}
                aria-label={`Select ${scenario.name} for comparison`}
              />
              <div className={styles.cardContent}>
                <div className={styles.cardName}>{scenario.name}</div>
                <div className={styles.cardMeta}>
                  <span>{formatTimestamp(scenario.savedAt)}</span>
                  <span>·</span>
                  <span>{getModeLabel(scenario)}</span>
                  <span>·</span>
                  <span>{scenario.result.num_of_robots} robots</span>
                  <span>·</span>
                  <span>{formatElapsed(scenario.result.total_elapsed_time)}</span>
                </div>
              </div>
              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={styles.loadBtn}
                  onClick={() => handleLoad(scenario)}
                  aria-label={`Load ${scenario.name}`}
                >
                  Load
                </button>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(scenario.id)}
                  aria-label={`Delete ${scenario.name}`}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ComparisonTable */}
      {showComparison && (
        <ComparisonTable
          scenarios={selectedScenarios}
          onExportComparison={() => onExportComparison(selectedScenarios)}
        />
      )}
    </div>
  );
}
