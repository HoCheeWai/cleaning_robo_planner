import { DerivedFieldStatus } from '../InputForm/derivedFieldStatus';
import styles from './InputField.module.css';

interface InputFieldProps {
  label: string;
  name: string;
  value: number | boolean;
  unit: string;
  tooltip: string;
  defaultValue?: number | boolean;
  isCustomized?: boolean;
  error?: string;
  onChange: (value: number | boolean) => void;
  type?: 'number' | 'toggle';
  disabled?: boolean;
  disabledReason?: string;
  step?: number;
  indicatorStatus?: DerivedFieldStatus;
}

export function InputField({
  label,
  name,
  value,
  unit,
  tooltip,
  isCustomized,
  error,
  onChange,
  type = 'number',
  disabled = false,
  disabledReason,
  step,
  indicatorStatus = 'default',
}: InputFieldProps) {
  const wrapperClasses = [
    styles.fieldWrapper,
    disabled ? styles.disabled : '',
    indicatorStatus === 'overridden' ? styles.overriddenField : '',
    indicatorStatus === 'non-default-parents' ? styles.nonDefaultParentsField : '',
  ].filter(Boolean).join(' ');

  if (type === 'toggle') {
    const checked = value as boolean;
    return (
      <div className={wrapperClasses}>
        <div className={styles.labelRow}>
          <span className={`${styles.label} ${isCustomized ? styles.customized : ''}`}>
            {label}
          </span>
          {isCustomized && <span className={styles.customBadge}>modified</span>}
          {indicatorStatus === 'overridden' && (
            <span className={styles.overriddenBadge} aria-label="This value has been manually overridden">
              overridden
            </span>
          )}
          <span className={styles.tooltipIcon} tabIndex={0} aria-label={tooltip}>
            ?
            <span className={styles.tooltipText}>{disabledReason || tooltip}</span>
          </span>
        </div>
        <div className={styles.toggleWrapper}>
          <button
            type="button"
            className={`${styles.toggle} ${checked ? styles.active : ''}`}
            onClick={() => !disabled && onChange(!checked)}
            aria-pressed={checked}
            aria-label={label}
            disabled={disabled}
          >
            <span className={styles.toggleKnob} />
          </button>
          <span className={styles.toggleLabel}>{checked ? 'Yes' : 'No'}</span>
        </div>
        {error && <span className={styles.errorMessage}>{error}</span>}
      </div>
    );
  }

  return (
    <div className={wrapperClasses}>
      <div className={styles.labelRow}>
        <span className={`${styles.label} ${isCustomized ? styles.customized : ''}`}>
          {label}
        </span>
        {isCustomized && <span className={styles.customBadge}>modified</span>}
        {indicatorStatus === 'overridden' && (
          <span className={styles.overriddenBadge} aria-label="This value has been manually overridden">
            overridden
          </span>
        )}
        {indicatorStatus === 'non-default-parents' && (
          <span className={styles.nonDefaultParentsBadge} aria-label="This value changed because a parent input was modified">
            auto-updated
          </span>
        )}
        <span className={styles.tooltipIcon} tabIndex={0} aria-label={tooltip}>
          ?
          <span className={styles.tooltipText}>{tooltip}</span>
        </span>
      </div>
      <div className={styles.inputRow}>
        <input
          type="number"
          id={name}
          name={name}
          className={`${styles.input} ${error ? styles.inputError : ''}`}
          value={value as number}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          step={step}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        <span className={styles.unitSuffix}>{unit}</span>
      </div>
      {error && <span className={styles.errorMessage} id={`${name}-error`}>{error}</span>}
    </div>
  );
}
