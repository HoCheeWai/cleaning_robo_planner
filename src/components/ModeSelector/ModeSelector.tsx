import { CalculationMode } from '../../types';
import styles from './ModeSelector.module.css';

interface ModeSelectorProps {
  mode: CalculationMode;
  onChange: (mode: CalculationMode) => void;
}

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>Calculation Mode</span>
      <div className={styles.toggleGroup} role="radiogroup" aria-label="Calculation mode">
        <button
          type="button"
          className={`${styles.option} ${mode === 'time-constraint' ? styles.active : ''}`}
          onClick={() => onChange('time-constraint')}
          role="radio"
          aria-checked={mode === 'time-constraint'}
        >
          Time Constraint
        </button>
        <button
          type="button"
          className={`${styles.option} ${mode === 'robot-count' ? styles.active : ''}`}
          onClick={() => onChange('robot-count')}
          role="radio"
          aria-checked={mode === 'robot-count'}
        >
          Robot Count
        </button>
      </div>
    </div>
  );
}
