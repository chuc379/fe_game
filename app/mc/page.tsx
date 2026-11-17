'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initSocket, closeSocket } from '@/lib/socket';
import { getToken, setToken, clearToken, login } from '@/lib/auth';
import { invalidateRoomCache } from '@/lib/roomCache';
import PlayerList from '@/components/mc/PlayerList';
import RoundTimer from '@/components/mc/RoundTimer';
import ResultsDisplay from '@/components/mc/ResultsDisplay';
import RankingTable from '@/components/mc/RankingTable';
import ScoreChart from '@/components/mc/ScoreChart';
import RoundHistoryChart from '@/components/mc/RoundHistoryChart';
import ExecutionOverlay from '@/components/mc/ExecutionOverlay';
import PlayerJoinQR from '@/components/mc/PlayerJoinQR';
import styles from './page.module.css';

const ROUND_DURATION = 30;
const RESULT_TIMEOUT_MS = 15000;
const DEFAULT_LIVES = 10;
const DEFAULT_MAX_LINKS = 6;

type SessionMode = 'multi_link' | 'single_link';

const normalizePlayer = (data: any) => {
  const player = data?.player ?? data ?? {};
  const playerId = player.player_id ?? player.id ?? player.playerId ?? null;
  const playerName = player.player_name ?? player.name ?? 'Unknown Player';

  return {
    ...player,
    player_id: playerId,
    player_name: playerName,
    points: Number(player.points ?? player.total_points ?? DEFAULT_LIVES),
    eliminated: Boolean(player.eliminated),
    submitted: Boolean(player.submitted),
  };
};

const normalizeScores = (scores: any[]) =>
  (Array.isArray(scores) ? scores : []).map((score) => ({
    ...score,
    player_name: score.player_name ?? score.name ?? 'Unknown Player',
    points: Number(score.points ?? score.total_points ?? 0),
    eliminated: Boolean(score.eliminated),
    last_delta: Number(score.last_delta ?? 0),
  }));

const normalizeConfig = (config: any) => {
  const mode: SessionMode =
    config?.session_mode === 'single_link' ? 'single_link' : 'multi_link';
  const rawMax = Number(config?.max_player_links ?? DEFAULT_MAX_LINKS);
  return {
    sessionMode: mode,
    maxPlayerLinks: Math.max(
      1,
      Math.min(20, Number.isFinite(rawMax) ? rawMax : DEFAULT_MAX_LINKS)
    ),
    lockOnRoundStart: config?.lock_on_round_start !== false,
  };
};

interface SessionConfigFieldsProps {
  sessionMode: SessionMode;
  maxPlayerLinks: number;
  lockOnRoundStart: boolean;
  onSessionMode: (mode: SessionMode) => void;
  onMaxPlayerLinks: (value: number) => void;
  onLockOnRoundStart: (value: boolean) => void;
}

function SessionConfigFields({
  sessionMode,
  maxPlayerLinks,
  lockOnRoundStart,
  onSessionMode,
  onMaxPlayerLinks,
  onLockOnRoundStart,
}: SessionConfigFieldsProps) {
  return (
    <div className={styles.configFields}>
      <label className={styles.configField}>
        <span>Chính sách link / máy</span>
        <select
          value={sessionMode}
          onChange={(event) =>
            onSessionMode(event.target.value as SessionMode)
          }
        >
          <option value="multi_link">Nhiều link / máy (để test)</option>
          <option value="single_link">Chỉ 1 link / máy</option>
        </select>
      </label>

      {sessionMode === 'multi_link' && (
        <label className={styles.configField}>
          <span>Số link người chơi tối đa / máy</span>
          <input
            type="number"
            min={1}
            max={20}
            value={maxPlayerLinks}
            onChange={(event) =>
              onMaxPlayerLinks(Number(event.target.value) || 1)
            }
          />
        </label>
      )}

      <label className={styles.configCheck}>
        <input
          type="checkbox"
          checked={lockOnRoundStart}
          onChange={(event) => onLockOnRoundStart(event.target.checked)}
        />
        <span>
          Khi bắt đầu ván, chỉ giữ 1 link người chơi / máy (các tab test
          chuyển sang khán giả)
        </span>
      </label>
    </div>
  );
}

export default function MCPage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [roomCreated, setRoomCreated] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [playerScores, setPlayerScores] = useState<any[]>([]);
  const [startingLives, setStartingLives] = useState(DEFAULT_LIVES);
  const [roundActive, setRoundActive] = useState(false);
  const [startingRound, setStartingRound] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [roundNumber, setRoundNumber] = useState(0);
  const [roundHistory, setRoundHistory] = useState<any[]>([]);
  const [executionNames, setExecutionNames] = useState<string[]>([]);

  const [authChecked, setAuthChecked] = useState(false);
  const [token, setTokenState] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Room session policy (Strategy/Factory on the server).
  const [sessionMode, setSessionMode] = useState<SessionMode>('multi_link');
  const [maxPlayerLinks, setMaxPlayerLinks] = useState(DEFAULT_MAX_LINKS);
  const [lockOnRoundStart, setLockOnRoundStart] = useState(true);
  const [applyingConfig, setApplyingConfig] = useState(false);
  const [configNotice, setConfigNotice] = useState('');
  const [myRooms, setMyRooms] = useState<any[]>([]);

  const latest = useRef({
    players,
    playerScores,
    roundNumber,
    roomId,
    roundActive,
    roomCreated,
  });
  const pendingRoomRef = useRef('');
  const calculatingRound = useRef<number | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Authoritative round deadline (epoch ms) sent by the server.
  const roundDeadlineRef = useRef<number>(0);

  useEffect(() => {
    latest.current = {
      players,
      playerScores,
      roundNumber,
      roomId,
      roundActive,
      roomCreated,
    };
  });

  useEffect(() => {
    return () => {
      if (resultTimer.current) clearTimeout(resultTimer.current);
    };
  }, []);

  // Deep link from the public room list: /mc?room=ABC123
  useEffect(() => {
    const queryRoom = new URLSearchParams(window.location.search).get('room');
    if (queryRoom) {
      pendingRoomRef.current = queryRoom.trim().toUpperCase();
    }
  }, []);

  const clearResultTimer = () => {
    if (resultTimer.current) {
      clearTimeout(resultTimer.current);
      resultTimer.current = null;
    }
  };

  useEffect(() => {
    const stored = getToken();
    if (stored) setTokenState(stored);
    setAuthChecked(true);
  }, []);

  const applyConfig = useCallback((config: any) => {
    if (!config) return;
    const next = normalizeConfig(config);
    setSessionMode(next.sessionMode);
    setMaxPlayerLinks(next.maxPlayerLinks);
    setLockOnRoundStart(next.lockOnRoundStart);
  }, []);

  const resetGameState = () => {
    setPlayers([]);
    setPlayerScores([]);
    setRoundHistory([]);
    setRoundNumber(0);
    setResult(null);
    setExecutionNames([]);
    setStartingLives(DEFAULT_LIVES);
    setRoundActive(false);
    setTimeLeft(ROUND_DURATION);
    roundDeadlineRef.current = 0;
    clearResultTimer();
    calculatingRound.current = null;
  };

  useEffect(() => {
    if (!token) return;

    const socket = initSocket(token);

    const applyRoomState = (state: any) => {
      if (!state) return;

      if (state.room_id) setRoomId(state.room_id);
      if (state.started_lives) {
        setStartingLives(Number(state.started_lives) || DEFAULT_LIVES);
      }
      if (state.current_round) setRoundNumber(Number(state.current_round) || 0);
      if (state.config) applyConfig(state.config);

      // Recover the running countdown after a reconnect/refresh.
      if (state.round_status === 'LOCKED') {
        setRoundActive(true);
        const remaining = Number(state.time_left);
        if (Number.isFinite(remaining)) setTimeLeft(Math.max(0, remaining));
        const deadline = Number(state.round_deadline);
        if (Number.isFinite(deadline) && deadline > 0) {
          roundDeadlineRef.current = deadline;
        }
      } else if (
        state.round_status === 'ENDED' ||
        state.round_status === 'WAITING'
      ) {
        setRoundActive(false);
      }

      setPlayers(
        (state.players || []).map((player: any) => ({
          ...normalizePlayer(player),
          // The server knows which players already submitted this round.
          submitted: Boolean(player.submitted),
        }))
      );

      if (Array.isArray(state.scoreboard)) {
        setPlayerScores(normalizeScores(state.scoreboard));
      }
    };

    const joinExistingRoom = (targetRoomId: string) => {
      setCreatingRoom(true);
      socket.emit('join_room', {
        room_id: targetRoomId,
        player_name: 'MC',
      });
    };

    socket.on('connect', () => {
      console.log('MC connected to server');
      socket.emit('list_rooms', {});

      const currentRoom = latest.current.roomId;
      // Re-enter the room after a reconnect: Socket.IO rooms are bound to a
      // socket id, so a new socket must rejoin to keep receiving broadcasts.
      if (latest.current.roomCreated && currentRoom) {
        joinExistingRoom(currentRoom);
      } else if (pendingRoomRef.current) {
        joinExistingRoom(pendingRoomRef.current);
      }
    });

    socket.on('connect_error', (err: any) => {
      setCreatingRoom(false);
      if (err?.message === 'invalid_token') {
        clearToken();
        setTokenState(null);
        setError('Session expired. Please sign in again.');
      } else {
        setError('Failed to connect to the server.');
      }
    });

    socket.on('rooms_list', (data: any) => {
      if (Array.isArray(data?.mine)) {
        setMyRooms(data.mine);
      }
    });

    socket.on('create_room_response', (data: any) => {
      setCreatingRoom(false);
      if (!data?.success) {
        setError(data?.error || 'Failed to create room');
        return;
      }

      const room = data.room || {};
      setRoomId(room.room_id || '');
      setRoomCreated(true);
      setError('');
      setConfigNotice('');
      invalidateRoomCache();
      applyConfig(data.config || room.config);
      if (data.room_state) applyRoomState(data.room_state);
    });

    socket.on('join_room_response', (data: any) => {
      setCreatingRoom(false);
      if (data?.success) {
        setRoomCreated(true);
        setError('');
        if (data.room_id) setRoomId(data.room_id);
        applyConfig(data.config || data.room_state?.config);
        if (data.room_state) applyRoomState(data.room_state);
      } else {
        setError(data?.error || 'Failed to create room');
      }
    });

    socket.on('update_room_response', (data: any) => {
      setApplyingConfig(false);
      if (!data?.success) {
        setError(data?.error || 'Failed to update room');
        return;
      }
      applyConfig(data.config || data.room?.config);
      setConfigNotice('Đã cập nhật cấu hình phòng.');
      invalidateRoomCache();
      setError('');
    });

    socket.on('delete_room_response', (data: any) => {
      if (!data?.success) {
        setError(data?.error || 'Failed to delete room');
        return;
      }
      setMyRooms((rooms) =>
        rooms.filter((room) => room.room_id !== data.room_id)
      );
      invalidateRoomCache();
      setRoomCreated(false);
      setRoomId('');
      resetGameState();
      setConfigNotice('');
      setError('');
    });

    socket.on('room_config_updated', (data: any) => {
      if (data?.config) applyConfig(data.config);
    });

    socket.on('room_state', (state: any) => {
      applyRoomState(state);
    });

    socket.on('room_closed', (data: any) => {
      setRoomCreated(false);
      setRoomId('');
      resetGameState();
      setError(data?.message || 'Phòng đã bị đóng.');
    });

    socket.on('start_round_response', (data: any) => {
      setStartingRound(false);
      if (data?.success) {
        setRoundNumber(Number(data.round_id) || 0);
        setRoundActive(true);
        const remaining = Number(data.time_left ?? data.duration);
        setTimeLeft(Number.isFinite(remaining) ? remaining : ROUND_DURATION);
        roundDeadlineRef.current = Number(data.deadline) || 0;
        setResult(null);
        setExecutionNames([]);
        calculatingRound.current = null;
        clearResultTimer();
        setError('');
        setPlayers((prev) => prev.map((p) => ({ ...p, submitted: false })));
      } else {
        setRoundActive(false);
        setError(data?.error || 'Failed to start round');
      }
    });

    // Authoritative countdown from the server: every client shows the same
    // number, even after a reconnect or when a tab was throttled.
    socket.on('round_tick', (data: any) => {
      const remaining = Number(data?.time_left);
      if (Number.isFinite(remaining)) {
        setTimeLeft(Math.max(0, remaining));
      }
      const deadline = Number(data?.deadline);
      if (Number.isFinite(deadline) && deadline > 0) {
        roundDeadlineRef.current = deadline;
      }
    });

    socket.on('calculate_result_response', (data: any) => {
      if (!data?.success) {
        calculatingRound.current = null;
        setError(data?.error || 'Failed to queue calculation');
        return;
      }

      if (data.status === 'queued') {
        clearResultTimer();
        resultTimer.current = setTimeout(() => {
          resultTimer.current = null;
          calculatingRound.current = null;
          setError('Worker did not return a result. Check that the worker service is running.');
        }, RESULT_TIMEOUT_MS);
      }
    });

    socket.on('player_joined', (data: any) => {
      const playerData = normalizePlayer(data);
      setPlayers((prev) => {
        const hasPlayer = prev.some(
          (p) => p.player_id && playerData.player_id && p.player_id === playerData.player_id
        );
        if (hasPlayer) return prev;
        return [...prev, { ...playerData, submitted: false }];
      });
    });

    socket.on('player_submitted', (data: any) => {
      const playerId = data?.player_id;
      if (playerId) {
        setPlayers((prev) =>
          prev.map((p) =>
            p.player_id === playerId ? { ...p, submitted: true } : p
          )
        );
      }
    });

    socket.on('player_executed', (data: any) => {
      const names: string[] = Array.isArray(data?.names)
        ? data.names.filter(Boolean)
        : Array.isArray(data?.players)
          ? data.players
              .map((player: any) => player?.player_name)
              .filter(Boolean)
          : [];
      if (names.length > 0) {
        setExecutionNames((prev) =>
          Array.from(new Set([...prev, ...names]))
        );
      }
    });

    socket.on('round_result_ready', (data: any) => {
      setRoundActive(false);
      setStartingRound(false);
      setTimeLeft(0);
      roundDeadlineRef.current = 0;
      const resultData = data?.result ?? null;
      setResult(resultData);
      setError('');
      calculatingRound.current = null;
      clearResultTimer();

      if (!resultData) return;

      if (Array.isArray(resultData.scoreboard)) {
        setPlayerScores(normalizeScores(resultData.scoreboard));
      }

      // Newly executed players get the full-screen animation.
      const executed = Array.isArray(resultData.eliminated)
        ? resultData.eliminated
        : [];
      if (executed.length > 0) {
        const names = executed
          .map((player: any) => player.player_name ?? player.name ?? 'Unknown')
          .filter(Boolean);
        setExecutionNames((prev) => Array.from(new Set([...prev, ...names])));
      }

      const round = Number(data?.round_id) || latest.current.roundNumber;
      setRoundHistory((prev) => {
        if (prev.some((entry) => entry.round === round)) return prev;
        return [
          ...prev,
          {
            round,
            average: Math.round((Number(resultData.average) || 0) * 100) / 100,
            target: Math.round((Number(resultData.target) || 0) * 100) / 100,
          },
        ];
      });
    });

    socket.on('error', (data: any) => {
      calculatingRound.current = null;
      setStartingRound(false);
      setCreatingRoom(false);
      setApplyingConfig(false);
      clearResultTimer();
      setError(data.error || 'An error occurred');
    });

    socket.on('warning', (data: any) => {
      setError(data.message || 'Warning');
    });

    return () => {
      socket.removeAllListeners();
      clearResultTimer();
      closeSocket();
    };
  }, [token, applyConfig]);

  // Timer countdown. The deadline comes from the server, so every client
  // (and every reconnect) renders exactly the same remaining time.
  useEffect(() => {
    if (!roundActive) return;

    const tick = () => {
      const deadline = roundDeadlineRef.current;
      if (deadline > 0) {
        setTimeLeft(
          Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
        );
      } else {
        setTimeLeft((value) => Math.max(0, value - 1));
      }
    };

    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [roundActive]);

  // Auto-end when timer reaches 0
  useEffect(() => {
    if (roundActive && timeLeft === 0) {
      emitCalculate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, roundActive]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoggingIn(true);
    const { token: newToken, error: loginError } = await login(username, password);
    setLoggingIn(false);

    if (loginError || !newToken) {
      setError(loginError || 'Login failed');
      return;
    }

    setToken(newToken);
    setTokenState(newToken);
    setPassword('');
  };

  const currentConfig = () => ({
    session_mode: sessionMode,
    max_player_links: maxPlayerLinks,
    lock_on_round_start: lockOnRoundStart,
  });

  const handleCreateRoom = () => {
    if (creatingRoom) return;

    setCreatingRoom(true);
    setError('');
    setConfigNotice('');
    setRoomId('');
    resetGameState();

    const socket = initSocket(token || undefined);
    const emitCreate = () =>
      socket.emit('create_room', {
        config: currentConfig(),
        mc_name: 'MC',
      });

    // Never lose the room creation because the socket was still connecting.
    if (socket.connected) {
      emitCreate();
    } else {
      socket.once('connect', emitCreate);
    }
  };

  const enterRoom = (targetRoomId: string) => {
    const normalized = targetRoomId.trim().toUpperCase();
    if (!normalized || creatingRoom) return;

    setCreatingRoom(true);
    setError('');
    setConfigNotice('');
    setRoomId(normalized);
    resetGameState();

    const socket = initSocket(token || undefined);
    const emitJoin = () =>
      socket.emit('join_room', {
        room_id: normalized,
        player_name: 'MC',
      });

    if (socket.connected) {
      emitJoin();
    } else {
      socket.once('connect', emitJoin);
    }
  };

  const handleApplyConfig = () => {
    if (!roomId || applyingConfig) return;
    setApplyingConfig(true);
    setConfigNotice('');
    initSocket(token || undefined).emit('update_room', {
      room_id: roomId,
      config: currentConfig(),
    });
  };

  const handleDeleteRoom = () => {
    if (!roomId) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Xóa phòng ${roomId}? Toàn bộ người chơi và điểm số sẽ bị xóa.`
      );
      if (!confirmed) return;
    }
    initSocket(token || undefined).emit('delete_room', { room_id: roomId });
  };

  const handleStartRound = () => {
    if (!roomId || startingRound) return;
    setStartingRound(true);
    setError('');
    initSocket(token || undefined).emit('start_round', {
      room_id: roomId,
    });
  };

  const emitCalculate = (force: boolean, resetGuard = false) => {
    if (roundNumber <= 0) {
      setError('Start a round before calculating results');
      return;
    }
    if (resetGuard) calculatingRound.current = null;
    if (calculatingRound.current === roundNumber) return;

    calculatingRound.current = roundNumber;
    const socket = initSocket(token || undefined);
    socket.emit('calculate_result', {
      room_id: roomId,
      round_id: roundNumber,
      force_calculate: force,
    });
  };

  const handleSkipRound = () => emitCalculate(true, true);
  const handleCalculateResults = () => emitCalculate(false, true);
  const handleRetryCalculate = () => emitCalculate(false, true);

  const handleBackToHome = () => {
    closeSocket();
    router.push('/');
  };

  const dismissExecution = useCallback(() => {
    setExecutionNames([]);
  }, []);

  const alivePlayers = players.filter((player) => !player.eliminated);
  const submittedCount = alivePlayers.filter((p) => p.submitted).length;
  const allSubmitted =
    submittedCount === alivePlayers.length && alivePlayers.length > 0;
  const gameOver = Boolean(result?.game_over);

  if (!authChecked) {
    return null;
  }

  if (!token) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2>🎛️ MC Login</h2>
          <p>Sign in to manage game rooms</p>
          <form onSubmit={handleLogin}>
            <input
              className={styles.input}
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <input
              className={styles.input}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button type="submit" className={styles.createButton} disabled={loggingIn}>
              {loggingIn ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    );
  }

  if (!roomCreated) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2>🎛️ MC Control</h2>
          <p>
            Tạo phòng mới. Mã phòng do server sinh ra và có thể cấu hình chính
            sách link cho từng máy.
          </p>

          <div className={styles.configPanel}>
            <h3>⚙️ Session policy</h3>
            <SessionConfigFields
              sessionMode={sessionMode}
              maxPlayerLinks={maxPlayerLinks}
              lockOnRoundStart={lockOnRoundStart}
              onSessionMode={setSessionMode}
              onMaxPlayerLinks={setMaxPlayerLinks}
              onLockOnRoundStart={setLockOnRoundStart}
            />
          </div>

          <button
            onClick={handleCreateRoom}
            className={styles.createButton}
            disabled={creatingRoom}
          >
            {creatingRoom ? 'Creating room...' : 'Create Room'}
          </button>

          {error && <p className={styles.error}>{error}</p>}

          {myRooms.length > 0 && (
            <div className={styles.roomList}>
              <h3>Phòng của bạn</h3>
              {myRooms.map((room) => (
                <div key={room.room_id} className={styles.roomListItem}>
                  <div>
                    <strong>{room.room_id}</strong>
                    <span>
                      {' '}
                      · {room.player_count || 0} người ·{' '}
                      {room.config?.label || 'Nhiều link / máy'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => enterRoom(room.room_id)}
                    className={styles.rejoinButton}
                  >
                    Vào lại
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push('/rooms')}
            className={styles.backButton}
          >
            🏠 Danh sách phòng công khai
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', gap: '0', background: '#f5f5f5' }}>
      {/* Left Panel - Control */}
      <div style={{ flex: '0 0 50%', overflowY: 'auto', padding: '20px', background: 'white' }}>
        <div className={styles.card} style={{ margin: '0' }}>
          <h2>🎛️ MC Control</h2>
          <p className={styles.roomInfo}>Room: <strong>{roomId}</strong></p>

          <PlayerJoinQR roomId={roomId} />

          <div className={styles.survivalHint}>
            🎯 Luật sinh tử: mỗi người có <strong>{startingLives} mạng</strong>.
            Đoán sai bị <strong>-1</strong>. Khi target hội tụ về 0, ai chọn 0 cũng bị -1.
            Hết mạng sẽ bị xử tử và thành khán giả.
          </div>

          <div className={styles.configPanel}>
            <h3>⚙️ Session policy (thay đổi trực tiếp)</h3>
            <SessionConfigFields
              sessionMode={sessionMode}
              maxPlayerLinks={maxPlayerLinks}
              lockOnRoundStart={lockOnRoundStart}
              onSessionMode={setSessionMode}
              onMaxPlayerLinks={setMaxPlayerLinks}
              onLockOnRoundStart={setLockOnRoundStart}
            />
            <div className={styles.configActions}>
              <button
                type="button"
                onClick={handleApplyConfig}
                disabled={applyingConfig}
                className={styles.applyButton}
              >
                {applyingConfig ? 'Đang lưu...' : 'Áp dụng'}
              </button>
              <button
                type="button"
                onClick={handleDeleteRoom}
                className={styles.deleteButton}
              >
                Xóa phòng
              </button>
            </div>
            {configNotice && (
              <p className={styles.configSaved}>{configNotice}</p>
            )}
          </div>

          {error && (
            <div className={styles.error}>
              <span>⚠️ {error}</span>
              {roundNumber > 0 && !result && (
                <button onClick={handleRetryCalculate} className={styles.skipButton}>
                  ↻ Retry
                </button>
              )}
            </div>
          )}

          {/* Players Section */}
          <PlayerList players={players} startingLives={startingLives} />

          {/* Round Control */}
          {!roundActive && !result && (
            <button
              onClick={handleStartRound}
              disabled={alivePlayers.length === 0 || startingRound}
              className={styles.startButton}
            >
              {startingRound ? 'Starting...' : '▶ Start Round'}
            </button>
          )}

          {/* Timer Section */}
          {roundActive && !result && (
            <RoundTimer
              timeLeft={timeLeft}
              submittedCount={submittedCount}
              totalPlayers={alivePlayers.length}
              onSkipRound={handleSkipRound}
              onCalculateResults={handleCalculateResults}
              allSubmitted={allSubmitted}
            />
          )}

          {/* Results Section */}
          {result && (
            <ResultsDisplay
              result={result}
              onNextRound={handleStartRound}
              disabled={alivePlayers.length === 0 || startingRound || gameOver}
              startingLives={startingLives}
            />
          )}

          <button onClick={handleBackToHome} className={styles.backButton}>
            ← Back to Home
          </button>
        </div>
      </div>

      {/* Right Panel - Visualizations */}
      <div style={{ flex: '0 0 50%', overflowY: 'auto', padding: '20px', background: '#f9f9f9' }}>
        {playerScores.length > 0 ? (
          <>
            <RankingTable
              players={playerScores}
              startingLives={startingLives}
            />
            <ScoreChart
              players={playerScores}
              guesses={Array.isArray(result?.guesses) ? result.guesses : []}
              revealed={Boolean(result)}
            />
            <RoundHistoryChart roundHistory={roundHistory} />
          </>
        ) : (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#999',
          }}>
            <p style={{ fontSize: '18px' }}>📊 Stats appear when players join</p>
          </div>
        )}
      </div>

      {executionNames.length > 0 && (
        <ExecutionOverlay
          names={executionNames}
          autoHideMs={4000}
          onDismiss={dismissExecution}
        />
      )}
    </div>
  );
}
