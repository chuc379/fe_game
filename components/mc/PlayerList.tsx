'use client';

import styles from '@/app/mc/page.module.css';

interface PlayerListProps {
  players: any[];
}

export default function PlayerList({ players }: PlayerListProps) {
  return (
    <div className={styles.section}>
      <h3>👥 Players ({players.length})</h3>
      {players.length === 0 ? (
        <p className={styles.noPlayers}>Waiting for players to join...</p>
      ) : (
        <div className={styles.playerList}>
          {players.map((player, idx) => (
            <div key={player.player_id || `${player.player_name}-${idx}`} className={styles.playerItem}>
              <span>{player.player_name}</span>
              <span className={player.submitted ? styles.submitted : styles.waiting}>
                {player.submitted ? '✓ Submitted' : '⏳ Waiting'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
