'use client';

interface PlayerScore {
  player_id: string;
  player_name: string;
  score: number;
  rank: number;
}

interface RankingTableProps {
  players: PlayerScore[];
}

export default function RankingTable({ players }: RankingTableProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div style={{
      marginTop: '20px',
      padding: '20px',
      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
      borderRadius: '12px',
      border: '2px solid rgba(102, 126, 234, 0.3)',
    }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '20px', color: '#333' }}>
        🏆 Ranking
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
              <th style={{ padding: '10px', textAlign: 'right', color: '#667eea', fontWeight: 'bold' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, idx) => (
              <tr key={player.player_id} style={{
                borderBottom: '1px solid rgba(102, 126, 234, 0.2)',
                background: idx === 0 ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                transition: 'all 0.3s ease',
              }}>
                <td style={{ padding: '10px', fontWeight: 'bold', color: idx === 0 ? '#FFD700' : '#333' }}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                </td>
                <td style={{ padding: '10px', color: '#333' }}>{player.player_name}</td>
                <td style={{ 
                  padding: '10px', 
                  textAlign: 'right',
                  fontWeight: 'bold',
                  color: idx === 0 ? '#FFD700' : '#667eea',
                  fontSize: '16px',
                }}>
                  {player.score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
