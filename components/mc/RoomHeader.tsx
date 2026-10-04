import styles from '@/app/mc/page.module.css';

interface RoomHeaderProps {
  roomId: string;
  roundNumber: number;
  playersCount: number;
}

export default function RoomHeader({ roomId, roundNumber, playersCount }: RoomHeaderProps) {
  return (
    <div className={styles.section}>
      <p className={styles.roomInfo}>
        Room: <strong>{roomId}</strong> | Round: <strong>{roundNumber}</strong> | Players: <strong>{playersCount}</strong>
      </p>
    </div>
  );
}
