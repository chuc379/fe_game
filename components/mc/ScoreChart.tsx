'use client';

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from 'recharts';

interface PlayerScore {
  player_id: string;
  player_name: string;
  points?: number;
  total_points?: number;
  eliminated?: boolean;
}

interface GuessEntry {
  player_id: string;
  guess_number: number;
}

interface ScoreChartProps {
  players: PlayerScore[];
  /** Guesses are only sent by the server once the round has ended. */
  guesses?: GuessEntry[];
  /** True only after the MC ended/skipped the round. */
  revealed?: boolean;
}

// The chart always shows 7 columns; extra players scroll horizontally instead
// of squeezing every bar into the same width.
const VISIBLE_COLUMNS = 7;
const COLUMN_WIDTH = 88;
const MAX_NAME_LENGTH = 8;

const shortName = (name?: string) => {
  const value = (name ?? 'Unknown').trim() || 'Unknown';
  return value.length > MAX_NAME_LENGTH
    ? `${value.slice(0, MAX_NAME_LENGTH)}…`
    : value;
};

export default function ScoreChart({
  players,
  guesses = [],
  revealed = false,
}: ScoreChartProps) {
  const pointsOf = (player: PlayerScore) =>
    Number(player.points ?? player.total_points ?? 0);

  const guessByPlayer = new Map<string, number>();
  for (const guess of guesses) {
    if (guess?.player_id) {
      guessByPlayer.set(guess.player_id, Number(guess.guess_number));
    }
  }

  const data = [...players]
    .sort((a, b) => {
      if (Boolean(a.eliminated) !== Boolean(b.eliminated)) {
        return a.eliminated ? 1 : -1;
      }
      return pointsOf(b) - pointsOf(a);
    })
    .map((p) => ({
      name: shortName(p.player_name),
      fullName: p.player_name,
      Lives: pointsOf(p),
      guess: guessByPlayer.has(p.player_id)
        ? guessByPlayer.get(p.player_id)
        : null,
      eliminated: Boolean(p.eliminated),
    }));

  const chartWidth =
    Math.max(VISIBLE_COLUMNS, data.length) * COLUMN_WIDTH;
  const showGuesses = revealed && guessByPlayer.size > 0;

  return (
    <div
      style={{
        marginTop: '20px',
        padding: '20px',
        background:
          'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
        borderRadius: '12px',
        border: '2px solid rgba(102, 126, 234, 0.3)',
      }}
    >
      <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', color: '#333' }}>
        📊 Survival Lives
      </h3>
      <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#666' }}>
        {showGuesses
          ? 'Số trên mỗi cột là dự đoán của người chơi ở vòng vừa kết thúc.'
          : 'Số dự đoán chỉ hiện sau khi MC kết thúc vòng.'}
      </p>

      <div
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: '8px',
        }}
      >
        <div style={{ width: `${chartWidth}px` }}>
          <BarChart
            width={chartWidth}
            height={340}
            data={data}
            margin={{ top: 24, right: 12, left: 0, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              interval={0}
              tick={{ fontSize: 11 }}
              height={46}
            />
            <YAxis allowDecimals={false} />
            <Tooltip
              formatter={(value: any, key: any) =>
                key === 'Lives' ? [`${value} ❤️`, 'Mạng'] : [value, key]
              }
              labelFormatter={(_label: any, payload: any) =>
                payload?.[0]?.payload?.fullName ?? _label
              }
            />
            <Legend />
            <Bar dataKey="Lives" animationDuration={500}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.eliminated ? '#9aa0a6' : '#667eea'}
                />
              ))}
              {showGuesses && (
                <LabelList
                  dataKey="guess"
                  position="top"
                  fill="#333"
                  fontSize={12}
                  fontWeight={700}
                />
              )}
            </Bar>
          </BarChart>
        </div>
      </div>
    </div>
  );
}
