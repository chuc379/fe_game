'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RoundHistory {
  round: number;
  average: number;
  target: number;
}

interface RoundHistoryChartProps {
  roundHistory: RoundHistory[];
}

export default function RoundHistoryChart({ roundHistory }: RoundHistoryChartProps) {
  if (roundHistory.length === 0) {
    return (
      <div style={{
        marginTop: '20px',
        padding: '20px',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
        borderRadius: '12px',
        border: '2px solid rgba(102, 126, 234, 0.3)',
        textAlign: 'center',
        color: '#999',
      }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#333' }}>
          📈 Round History
        </h3>
        <p>Play rounds to see history</p>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: '20px',
      padding: '20px',
      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
      borderRadius: '12px',
      border: '2px solid rgba(102, 126, 234, 0.3)',
    }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '20px', color: '#333' }}>
        📈 Average vs Target (2/3)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={roundHistory}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="round" label={{ value: 'Round', position: 'insideBottom', offset: -5 }} />
          <YAxis label={{ value: 'Value', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="average" stroke="#667eea" strokeWidth={2} dot={{ r: 4 }} name="Average" />
          <Line type="monotone" dataKey="target" stroke="#764ba2" strokeWidth={2} dot={{ r: 4 }} name="Target (2/3)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
