'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PlayerScore {
  player_id: string;
  player_name: string;
  score: number;
}

interface ScoreChartProps {
  players: PlayerScore[];
}

export default function ScoreChart({ players }: ScoreChartProps) {
  const data = [...players].sort((a, b) => b.score - a.score).map((p) => ({
    name: p.player_name,
    Score: p.score,
  }));

  return (
    <div style={{
      marginTop: '20px',
      padding: '20px',
      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
      borderRadius: '12px',
      border: '2px solid rgba(102, 126, 234, 0.3)',
    }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '20px', color: '#333' }}>
        📊 Score Distribution
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="Score" fill="#667eea" animationDuration={500} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
