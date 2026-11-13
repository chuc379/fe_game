'use client';

import styles from '@/app/mc/page.module.css';

interface ResultsDisplayProps {
  result: any;
  onNextRound: () => void;
  disabled?: boolean;
  startingLives?: number;
}

export default function ResultsDisplay({
  result,
  onNextRound,
  disabled = false,
  startingLives = 10,
}: ResultsDisplayProps) {
  const scoreboard: any[] = Array.isArray(result?.scoreboard)
    ? result.scoreboard
    : [];
  const eliminatedNow: any[] = Array.isArray(result?.eliminated)
    ? result.eliminated
    : [];
  const changed = scoreboard.filter(
    (player) => Number(player.last_delta ?? 0) !== 0
  );

  return (
    <div className={styles.resultsSection}>
      <h3>📊 Round Results</h3>

      <div className={styles.resultsGrid}>
        <div className={styles.resultCard}>
          <span>Submissions</span>
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
          <strong>{result.winner?.player_name ?? '—'}</strong>
        </div>
      </div>

      {result.convergence && (
        <div className={styles.ruleNotice}>
          🌀 Hội tụ về 0: tất cả người chọn <strong>0</strong> bị trừ 1 điểm.
        </div>
      )}

      {changed.length > 0 && (
        <div className={styles.changeList}>
          <h4>Mạng thay đổi</h4>
          {changed.map((player) => (
            <div key={player.player_id} className={styles.changeRow}>
              <span>
                {player.eliminated ? '☠️ ' : ''}
                {player.player_name}
              </span>
              <span className={styles.deltaDown}>
                {Number(player.last_delta) > 0 ? '+' : ''}
                {player.last_delta} → {player.points}/{startingLives} ❤️
              </span>
            </div>
          ))}
        </div>
      )}

      {eliminatedNow.length > 0 && (
        <div className={styles.executionNotice}>
          ☠️ Đã bị loại: {eliminatedNow.map((p) => p.player_name).join(', ')}
        </div>
      )}

      {result.game_over && (
        <div className={styles.gameOverNotice}>
          {result.survivor
            ? `🏆 Người sống sót cuối cùng: ${result.survivor.player_name}`
            : '☠️ Tất cả người chơi đã bị loại'}
        </div>
      )}

      <button
        onClick={onNextRound}
        className={styles.nextRoundButton}
        disabled={disabled || Boolean(result.game_over)}
      >
        {result.game_over ? '🏁 Game Over' : '▶ Next Round'}
      </button>
    </div>
  );
}
