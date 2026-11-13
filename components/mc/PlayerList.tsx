'use client';

import styles from '@/app/mc/page.module.css';

interface PlayerListProps {
  players: any[];
  startingLives?: number;
}

const hearts = (points: number, startingLives: number) => {
  const alive = Math.max(0, Math.min(points, startingLives));
  const lost = Math.max(0, startingLives - alive);
  return '❤️'.repeat(alive) + '🖤'.repeat(lost);
};

export default function PlayerList({ players, startingLives = 10 }: PlayerListProps) {
  const aliveCount = players.filter((player) => !player.eliminated).length;

  return (
    <div className={styles.section}>
      <h3>
        👥 Players ({players.length}) · {aliveCount} còn sống
      </h3>
      {players.length === 0 ? (
        <p className={styles.noPlayers}>Waiting for players to join...</p>
      ) : (
        <div className={styles.playerList}>
          {players.map((player, idx) => (
            <div
              key={player.player_id || `${player.player_name}-${idx}`}
              className={`${styles.playerItem} ${player.eliminated ? styles.playerEliminated : ''}`}
            >
              <div className={styles.playerInfo}>
                <span>
                  {player.eliminated ? '☠️ ' : ''}
                  {player.player_name}
                </span>
                <span className={styles.lives} title={`${player.points ?? 0} điểm sinh mệnh`}>
                  {player.eliminated
                    ? 'ĐÃ BỊ LOẠI'
                    : hearts(Number(player.points ?? startingLives), startingLives)}
                </span>
              </div>
              <span
                className={
                  player.eliminated
                    ? styles.eliminated
                    : player.submitted
                      ? styles.submitted
                      : styles.waiting
                }
              >
                {player.eliminated
                  ? '💀 Out'
                  : player.submitted
                    ? '✓ Submitted'
                    : '⏳ Waiting'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
