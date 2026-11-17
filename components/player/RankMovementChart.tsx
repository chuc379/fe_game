'use client';

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import styles from './RankMovementChart.module.css';

interface ScoreEntry {
  player_id: string;
  player_name?: string;
  points?: number;
  total_points?: number;
  rank?: number;
  eliminated?: boolean;
}

interface RankMovementChartProps {
  players: ScoreEntry[];
  playerId: string;
  /** player_id -> (previous rank - current rank); positive = climbed. */
  rankDeltas?: Record<string, number>;
}

const MAX_NAME_LENGTH = 8;

const shortName = (name?: string) => {
  const value = (name ?? 'Unknown').trim() || 'Unknown';
  return value.length > MAX_NAME_LENGTH
    ? `${value.slice(0, MAX_NAME_LENGTH)}…`
    : value;
};

export default function RankMovementChart({
  players,
  playerId,
  rankDeltas = {},
}: RankMovementChartProps) {
  const sorted = [...players]
    .filter((player) => player?.player_id)
    .sort((a, b) => Number(a.rank ?? 999) - Number(b.rank ?? 999));

  if (sorted.length === 0) return null;

  const meIndex = sorted.findIndex((player) => player.player_id === playerId);
  const me = meIndex >= 0 ? sorted[meIndex] : null;
  if (!me) return null;
  const myRank = Number(me.rank ?? meIndex + 1);

  // Show at most 3 columns: the player plus the neighbours around their rank.
  let windowPlayers: ScoreEntry[];
  if (myRank <= 3) {
    windowPlayers = sorted.slice(0, 3);
  } else {
    windowPlayers = sorted.slice(Math.max(0, meIndex - 2), meIndex + 1);
  }

  // The player's own column always comes first.
  const ordered = [
    me,
    ...windowPlayers.filter((p) => p.player_id !== playerId),
  ];

  const total = sorted.length;
  const data = ordered.map((player) => {
    const rank = Number(player.rank ?? 0);
    return {
      name: shortName(player.player_name),
      rank,
      isMe: player.player_id === playerId,
      // Higher rank => taller bar, so the column visibly moves with the rank.
      score: Math.max(1, total - rank + 1),
      lives: Number(player.points ?? player.total_points ?? 0),
    };
  });

  const delta = me ? Number(rankDeltas[playerId] ?? 0) : 0;
  const deltaClass =
    delta > 0 ? styles.up : delta < 0 ? styles.down : styles.flat;
  const deltaLabel =
    delta > 0 ? `▲ +${delta} hạng` : delta < 0 ? `▼ ${delta} hạng` : '— giữ hạng';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h4 className={styles.title}>📈 Di chuyển hạng</h4>
          <p className={styles.sub}>3 vị trí quanh bạn</p>
        </div>
        <div className={styles.rankBadge}>
          <span key={`rank-${myRank}`} className={styles.rankNumber}>
            #{myRank}
          </span>
          <span key={`delta-${delta}`} className={`${styles.delta} ${deltaClass}`}>
            {deltaLabel}
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={210}>
        <BarChart
          data={data}
          margin={{ top: 28, right: 10, left: 10, bottom: 4 }}
        >
          <YAxis hide domain={[0, total + 1]} />
          <XAxis
            dataKey="name"
            interval={0}
            tick={{ fontSize: 11 }}
            height={32}
          />
          <Tooltip
            formatter={(_value: any, _key: any, item: any) => [
              `Hạng #${item?.payload?.rank} · ${item?.payload?.lives} ❤️`,
              'Vị trí',
            ]}
          />
          <Bar
            dataKey="score"
            radius={[6, 6, 0, 0]}
            animationDuration={750}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isMe ? '#f5a623' : '#8b9dc3'}
              />
            ))}
            <LabelList
              dataKey="rank"
              position="top"
              fontSize={12}
              fontWeight={800}
              fill="#333"
              formatter={(value: any) => `#${value}`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
