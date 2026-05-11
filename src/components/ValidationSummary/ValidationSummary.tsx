import { ValidationError } from '../../types';
import { FIELD_METADATA } from '../../types/defaults';
import styles from './ValidationSummary.module.css';

interface ValidationSummaryProps {
  errors: ValidationError[];
}

export function ValidationSummary({ errors }: ValidationSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <div className={styles.wrapper} role="alert" aria-live="polite">
      <div className={styles.title}>Please fix the following errors:</div>
      <ul className={styles.list}>
        {errors.map((err) => {
          const meta = FIELD_METADATA[err.field];
          const label = meta?.label || err.field;
          return (
            <li key={err.field} className={styles.item}>
              <span className={styles.field}>{label}:</span> {err.message}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
