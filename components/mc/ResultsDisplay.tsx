'use client';

import styles from '@/app/mc/page.module.css';

interface ResultsDisplayProps {
  result: any;
  onNextRound: () => void;
}

export default function ResultsDisplay({ result, onNextRound }: ResultsDisplayProps) {
  return (
    <div className={styles.resultsSection}>
      <h3>📊 Round Results</h3>
      <div className={styles.resultsGrid}>
        <div className={styles.resultCard}>
          <span>Total Players</span>
          <strong>{result.total_players}</strong>
        </div>
        <div className={styles.resultCard}>
          <span>Average</span>
          <strong>{result.average}</strong>
        </div>
        <div className={styles.resultCard}>
          <span>Target (2/3)</span>
          <strong>{result.target}</strong>
        </div>
        <div className={styles.resultCard}>
          <span>Winner</span>
          <strong>{result.winner?.player_name}</strong>
        </div>
      </div>
      <button onClick={onNextRound} className={styles.nextRoundButton}>
        ▶ Next Round
      </button>
    </div>
  );
}
