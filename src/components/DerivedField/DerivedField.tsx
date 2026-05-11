import styles from './DerivedField.module.css';

interface DerivedFieldProps {
  label: string;
  value: number | null;
  unit: string;
  tooltip: string;
  note?: string;
  decimals?: number;
}

export function DerivedField({ label, value, unit, tooltip, note, decimals = 2 }: DerivedFieldProps) {
  const displayValue = value !== null && value !== undefined ? value.toFixed(decimals) : '—';

  return (
    <div className={styles.fieldWrapper}>
      <div className={styles.labelRow}>
        <span className={styles.label}>{label}</span>
        <span className={styles.derivedBadge}>derived</span>
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
