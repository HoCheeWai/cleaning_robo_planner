import styles from './InfeasibilityPanel.module.css';

interface InfeasibilityPanelProps {
  reason: string;
  suggestions: string[];
}

export function InfeasibilityPanel({ reason, suggestions }: InfeasibilityPanelProps) {
  return (
    <div className={styles.wrapper} role="alert">
      <div className={styles.title}>⚠ Infeasible</div>
      <div className={styles.reason}>{reason}</div>
      {suggestions.length > 0 && (
        <>
          <div className={styles.suggestionsTitle}>Suggestions to resolve:</div>
          <ul className={styles.suggestionsList}>
            {suggestions.map((s, i) => (
              <li key={i} className={styles.suggestionItem}>{s}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
