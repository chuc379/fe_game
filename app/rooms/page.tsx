'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initSocket } from '@/lib/socket';
import { getToken, hasSavedPlayerToken } from '@/lib/auth';
import styles from './page.module.css';

interface RoomSummary {
  room_id: string;
  player_count?: number;
  current_round?: number;
  owner_mc?: string;
  mc_name?: string;
  status?: string;
  config?: {
    session_mode?: string;
    max_player_links?: number;
    lock_on_round_start?: boolean;
    label?: string;
  };
}

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isMc, setIsMc] = useState(false);

  const requestRooms = useCallback((socket: any) => {
    setRefreshing(true);
    socket.emit('list_rooms', {});
  }, []);

  useEffect(() => {
    setIsMc(Boolean(getToken()));

    // The room directory is public: never attach the MC token here, otherwise
    // an expired MC session would break browsing for anonymous players.
    const socket = initSocket();

    const onConnect = () => requestRooms(socket);

    const onRoomsList = (data: any) => {
      setLoading(false);
      setRefreshing(false);
      if (data?.success) {
        setRooms(Array.isArray(data.rooms) ? data.rooms : []);
        setError('');
      } else {
        setError(data?.error || 'Không tải được danh sách phòng');
      }
    };

    const onError = (data: any) => {
      setLoading(false);
      setRefreshing(false);
      setError(data?.error || 'Không thể kết nối tới máy chủ');
    };

    socket.on('connect', onConnect);
    socket.on('rooms_list', onRoomsList);
    socket.on('error', onError);

    if (socket.connected) {
      requestRooms(socket);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('rooms_list', onRoomsList);
      socket.off('error', onError);
    };
  }, [requestRooms]);

  const refresh = () => {
    const socket = initSocket();
    if (socket.connected) {
      requestRooms(socket);
    } else {
      socket.once('connect', () => requestRooms(socket));
    }
  };

  const joinAsPlayer = (roomId: string) => {
    router.push(`/player?room=${roomId}`);
  };

  const joinAsMC = (roomId: string) => {
    router.push(`/mc?room=${roomId}`);
  };

  const isMultiLink = (room: RoomSummary) =>
    room.config?.session_mode === 'multi_link';

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <h1>🎮 Game Rooms</h1>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={refresh}
            disabled={refreshing}
          >
            {refreshing ? 'Đang tải...' : '↻ Làm mới'}
          </button>
        </div>

        <p className={styles.hint}>
          Danh sách phòng công khai. Chọn một phòng để vào chơi hoặc vào lại
          bằng danh tính đã lưu trên máy này.
        </p>

        {error && <p className={styles.error}>{error}</p>}

        {loading ? (
          <p className={styles.empty}>Đang tải danh sách phòng...</p>
        ) : rooms.length === 0 ? (
          <p className={styles.empty}>Chưa có phòng nào đang mở.</p>
        ) : (
          <div className={styles.roomsList}>
            {rooms.map((room) => (
              <div key={room.room_id} className={styles.roomItem}>
                <div className={styles.roomInfo}>
                  <h3>{room.room_id}</h3>
                  <p>
                    {room.player_count || 0} người chơi
                    {room.current_round
                      ? ` · Vòng ${room.current_round}`
                      : ' · Chưa bắt đầu'}
                  </p>
                  <div className={styles.badges}>
                    <span
                      className={
                        isMultiLink(room)
                          ? styles.badgeMulti
                          : styles.badgeSingle
                      }
                    >
                      {isMultiLink(room)
                        ? `Nhiều link / máy (tối đa ${
                            room.config?.max_player_links ?? 6
                          })`
                        : '1 link / máy'}
                    </span>
                    {room.config?.lock_on_round_start && isMultiLink(room) && (
                      <span className={styles.badgeLock}>
                        Khóa 1 link khi vào trận
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button
                    onClick={() => joinAsPlayer(room.room_id)}
                    className={styles.btnJoin}
                  >
                    {hasSavedPlayerToken(room.room_id)
                      ? 'Vào lại'
                      : 'Vào chơi'}
                  </button>
                  {isMc && (
                    <button
                      onClick={() => joinAsMC(room.room_id)}
                      className={styles.btnMC}
                    >
                      MC
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.createSection}>
          <h3>Tạo / vào phòng</h3>
          <div className={styles.buttonGroup}>
            <button
              onClick={() => router.push('/player')}
              className={styles.createBtn}
            >
              Vào bằng mã phòng
            </button>
            <button
              onClick={() => router.push('/mc')}
              className={styles.createBtnAlt}
            >
              MC tạo phòng mới
            </button>
          </div>
        </div>

        <button
          type="button"
          className={styles.backBtn}
          onClick={() => router.push('/')}
        >
          ← Về trang chủ
        </button>
      </div>
    </div>
  );
}
