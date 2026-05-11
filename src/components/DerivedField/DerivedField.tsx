import { DerivedFieldStatus } from '../InputForm/derivedFieldStatus';
import styles from './DerivedField.module.css';

interface DerivedFieldProps {
  label: string;
  value: number | null;
  unit: string;
  tooltip: string;
  note?: string;
  decimals?: number;
  indicatorStatus?: DerivedFieldStatus;
}

export function DerivedField({ label, value, unit, tooltip, note, decimals = 2, indicatorStatus = 'default' }: DerivedFieldProps) {
  const displayValue = value !== null && value !== undefined ? value.toFixed(decimals) : '—';

  const wrapperClass = [
    styles.fieldWrapper,
    indicatorStatus === 'non-default-parents' ? styles.nonDefaultParents : '',
    indicatorStatus === 'overridden' ? styles.overridden : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClass}>
      <div className={styles.labelRow}>
        <span className={styles.label}>{label}</span>
        <span className={styles.derivedBadge}>derived</span>
        {indicatorStatus === 'non-default-parents' && (
          <span className={styles.indicatorBadge} aria-label="This value is computed from modified inputs">
            modified inputs
          </span>
        )}
        {indicatorStatus === 'overridden' && (
          <span className={styles.overriddenBadge} aria-label="This value has been manually overridden">
            overridden
          </span>
        )}
        <span className={styles.tooltipIcon} tabIndex={0} aria-label={tooltip}>
          ?
          <span className={styles.tooltipText}>{tooltip}</span>
        </span>
      </div>
      <div className={styles.valueRow}>
        <span className={styles.value}>{displayValue}</span>
        <span className={styles.unitSuffix}>{unit}</span>
      </div>
      {note && <span className={styles.note}>{note}</span>}
    </div>
  );
}
