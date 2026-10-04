'use client';

import styles from '@/app/mc/page.module.css';

interface RoundTimerProps {
  timeLeft: number;
  submittedCount: number;
  totalPlayers: number;
  onSkipRound: () => void;
  onCalculateResults: () => void;
  allSubmitted: boolean;
}

export default function RoundTimer({
  timeLeft,
  submittedCount,
  totalPlayers,
  onSkipRound,
  onCalculateResults,
  allSubmitted,
}: RoundTimerProps) {
  return (
    <div className={styles.timerSection}>
      <div className={styles.timer}>
        <span>Time left:</span>
        <strong className={styles.timerValue}>{timeLeft}s</strong>
      </div>
      <p className={styles.submitted}>
        {submittedCount} / {totalPlayers} players submitted
      </p>
      <div className={styles.buttonGroup}>
        <button onClick={onSkipRound} className={styles.skipButton}>
          ⏭ Skip (End Now)
        </button>
        {allSubmitted && (
          <button onClick={onCalculateResults} className={styles.endButton}>
            ✓ Calculate Results
          </button>
        )}
      </div>
    </div>
  );
}
