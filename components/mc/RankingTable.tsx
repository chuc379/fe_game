'use client';

import styles from '@/app/mc/page.module.css';

interface PlayerScore {
  player_id: string;
  player_name: string;
  points?: number;
  total_points?: number;
  eliminated?: boolean;
  last_delta?: number;
  rank?: number;
}

interface RankingTableProps {
  players: PlayerScore[];
  startingLives: number;
}

const pointsOf = (player: PlayerScore) =>
  Number(player.points ?? player.total_points ?? 0);

export default function RankingTable({
  players,
  startingLives,
}: RankingTableProps) {
  const sorted = [...players].sort((a, b) => {
    if (Boolean(a.eliminated) !== Boolean(b.eliminated)) {
      return a.eliminated ? 1 : -1;
    }
    return (
      pointsOf(b) - pointsOf(a) ||
      a.player_name.localeCompare(b.player_name)
    );
  });

  return (
    <div className={styles.rankingCard}>
      <h3 className={styles.rankingTitle}>
        🏆 Survival Ranking
      </h3>
      <div
        className={styles.rankingTableViewport}
        role="region"
        aria-label="Bảng xếp hạng người chơi"
        tabIndex={0}
      >
        <table className={styles.rankingTable}>
          <colgroup>
            <col className={styles.rankingRankColumn} />
            <col />
            <col className={styles.rankingLivesColumn} />
            <col className={styles.rankingDeltaColumn} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Player</th>
              <th scope="col">Lives</th>
              <th scope="col">Δ</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, idx) => {
              const points = Math.max(
                0,
                Math.min(startingLives, pointsOf(player))
              );
              const delta = Number(player.last_delta ?? 0);
              return (
                <tr key={player.player_id} style={{
                  borderBottom: '1px solid rgba(102, 126, 234, 0.2)',
                  background: player.eliminated
                    ? 'rgba(220, 53, 69, 0.08)'
                    : idx === 0
                      ? 'rgba(255, 215, 0, 0.1)'
                      : 'transparent',
                  transition: 'all 0.3s ease',
                }}>
                  <td className={styles.rankingRank}>
                    {player.eliminated
                      ? '💀'
                      : idx === 0
                        ? '🥇'
                        : idx === 1
                          ? '🥈'
                          : idx === 2
                            ? '🥉'
                            : `#${idx + 1}`}
                  </td>
                  <td
                    className={`${styles.rankingPlayer} ${player.eliminated ? styles.rankingEliminated : ''}`}
                    title={player.player_name}
                  >
                    <span>{player.player_name}</span>
                    {player.eliminated ? ' (out)' : ''}
                  </td>
                  <td className={styles.rankingLives}>
                    {points}/{startingLives} ❤️
                  </td>
                  <td
                    className={`${styles.rankingDelta} ${delta < 0 ? styles.rankingDeltaDown : ''}`}
                  >
                    {delta < 0 ? delta : delta > 0 ? `+${delta}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
