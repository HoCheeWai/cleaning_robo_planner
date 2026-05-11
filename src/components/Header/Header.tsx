import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>🤖 Cleaning Robot Fleet Calculator</h1>
      <span className={styles.subtitle}>Plan your autonomous cleaning fleet</span>
    </header>
  );
}
