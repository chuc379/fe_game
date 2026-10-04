'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initSocket } from '@/lib/socket';
import styles from './page.module.css';

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const socket = initSocket();

    socket.on('connect', () => {
      console.log('Connected');
      socket.emit('list_rooms');
    });

    socket.on('rooms_list', (data: any) => {
      if (data.success) {
        setRooms(data.rooms || []);
      }
      setLoading(false);
    });

    return () => {
      // Don't close socket yet
    };
  }, []);

  const joinAsPlayer = (roomId: string) => {
    router.push(`/player?room=${roomId}`);
  };

  const joinAsMC = (roomId: string) => {
    router.push(`/mc?room=${roomId}`);
  };

  const createNew = (role: string) => {
    router.push(`/${role}`);
  };

  if (loading) {
    return <div className={styles.container}><p>Loading rooms...</p></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>🎮 Game Rooms</h1>

        {rooms.length === 0 ? (
          <p>No active rooms</p>
        ) : (
          <div className={styles.roomsList}>
            {rooms.map((room: any) => (
              <div key={room.room_id} className={styles.roomItem}>
                <div className={styles.roomInfo}>
                  <h3>{room.room_id}</h3>
                  <p>{room.player_count || 0} players</p>
                </div>
                <div className={styles.actions}>
                  <button onClick={() => joinAsPlayer(room.room_id)} className={styles.btnJoin}>
                    Join as Player
                  </button>
                  <button onClick={() => joinAsMC(room.room_id)} className={styles.btnMC}>
                    Join as MC
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.createSection}>
          <h3>Create New</h3>
          <div className={styles.buttonGroup}>
            <button onClick={() => createNew('player')} className={styles.createBtn}>
              New Player Room
            </button>
            <button onClick={() => createNew('mc')} className={styles.createBtn}>
              New MC Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
