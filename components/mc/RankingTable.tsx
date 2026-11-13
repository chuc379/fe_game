'use client';

interface PlayerScore {
  player_id: string;
  player_name: string;
  points?: number;
  total_points?: number;
  eliminated?: boolean;
  last_delta?: number;
  rank: number;
}

interface RankingTableProps {
  players: PlayerScore[];
}

const pointsOf = (player: PlayerScore) =>
  Number(player.points ?? player.total_points ?? 0);

export default function RankingTable({ players }: RankingTableProps) {
  const sorted = [...players].sort((a, b) => {
    if (Boolean(a.eliminated) !== Boolean(b.eliminated)) {
      return a.eliminated ? 1 : -1;
    }
    return pointsOf(b) - pointsOf(a);
  });

  return (
    <div style={{
      marginTop: '20px',
      padding: '20px',
      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
      borderRadius: '12px',
      border: '2px solid rgba(102, 126, 234, 0.3)',
    }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '20px', color: '#333' }}>
        🏆 Survival Ranking
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px',
        }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #667eea' }}>
              <th style={{ padding: '10px', textAlign: 'left', color: '#667eea', fontWeight: 'bold' }}>Rank</th>
              <th style={{ padding: '10px', textAlign: 'left', color: '#667eea', fontWeight: 'bold' }}>Player</th>
              <th style={{ padding: '10px', textAlign: 'center', color: '#667eea', fontWeight: 'bold' }}>Lives</th>
              <th style={{ padding: '10px', textAlign: 'right', color: '#667eea', fontWeight: 'bold' }}>Round Δ</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, idx) => {
              const points = pointsOf(player);
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
                  <td style={{ padding: '10px', fontWeight: 'bold', color: idx === 0 && !player.eliminated ? '#FFD700' : '#333' }}>
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
                  <td style={{ padding: '10px', color: player.eliminated ? '#b02a37' : '#333' }}>
                    {player.player_name}
                    {player.eliminated ? ' (out)' : ''}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', fontSize: '16px' }}>
                    {'❤️'.repeat(Math.max(0, points))}
                    <span style={{ color: '#999' }}>{'🖤'.repeat(Math.max(0, 5 - points))}</span>
                  </td>
                  <td style={{
                    padding: '10px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: delta < 0 ? '#dc3545' : '#28a745',
                  }}>
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
