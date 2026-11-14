'use client';

import { useEffect, useMemo, useRef } from 'react';
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

  // Every player tied on the winning number is a winner. When the round
  // converged there is no "winner", so show the players that stayed safe.
  const winners = useMemo(() => {
    const declared = Array.isArray(result?.winners) ? result.winners : [];
    if (declared.length > 0) {
      return declared
        .map((player: any) => player?.player_name ?? player?.name)
        .filter(Boolean);
    }
    if (result?.convergence) {
      return scoreboard
        .filter(
          (player) =>
            !player.eliminated && Number(player.last_delta ?? 0) === 0
        )
        .map((player) => player.player_name)
        .filter(Boolean);
    }
    if (result?.winner?.player_name) return [result.winner.player_name];
    return [];
  }, [result, scoreboard]);

  const winnersRef = useRef<HTMLDivElement | null>(null);

  // The list scrolls from the bottom so the latest names are visible.
  useEffect(() => {
    const node = winnersRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [winners.length]);

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
          <span>Winners</span>
          <strong>{winners.length || '—'}</strong>
        </div>
      </div>

      {winners.length > 0 && (
        <div className={styles.winnerBox}>
          <h4>
            🏆 Người thắng / an toàn ({winners.length})
          </h4>
          <div className={styles.winnerScroll} ref={winnersRef}>
            {winners.map((name: string, index: number) => (
              <div key={`${name}-${index}`} className={styles.winnerRow}>
                {name}
              </div>
            ))}
          </div>
        </div>
      )}

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
