'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initSocket, getSocket, closeSocket } from '@/lib/socket';
import ExecutionOverlay from '@/components/mc/ExecutionOverlay';
import styles from './page.module.css';

const DEFAULT_STARTING_LIVES = 5;
const DEFAULT_ROUND_DURATION = 30;

const normalizeRoomId = (value: string) => value.trim().toUpperCase();

const renderHearts = (points: number, startingLives: number) => {
  const total = Math.max(1, startingLives);
  const alive = Math.max(0, Math.min(points, total));
  const lost = Math.max(0, total - alive);
  return '❤️'.repeat(alive) + '🖤'.repeat(lost);
};

export default function PlayerPage() {
  const router = useRouter();

  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);

  const [guess, setGuess] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roundActive, setRoundActive] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_ROUND_DURATION);
  const [lastGuess, setLastGuess] = useState<number | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const [points, setPoints] = useState(DEFAULT_STARTING_LIVES);
  const [startingLives, setStartingLives] = useState(DEFAULT_STARTING_LIVES);
  const [eliminated, setEliminated] = useState(false);
  const [executionVisible, setExecutionVisible] = useState(false);

  const roomIdRef = useRef('');
  const playerNameRef = useRef('');
  const playerIdRef = useRef('');
  const joinedRef = useRef(false);
  const eliminatedRef = useRef(false);

  // Keep refs in sync for socket handlers that are registered only once.
  const rememberRoom = (value: string) => {
    const normalized = normalizeRoomId(value);
    roomIdRef.current = normalized;
    setRoomId(normalized);
    if (normalized) sessionStorage.setItem('game_room_id', normalized);
  };

  const rememberPlayer = (value: string) => {
    playerIdRef.current = value;
    setPlayerId(value);
    if (value) sessionStorage.setItem('game_player_id', value);
  };

  const rememberName = (value: string) => {
    playerNameRef.current = value;
    setPlayerName(value);
    if (value) sessionStorage.setItem('game_player_name', value);
  };

  useEffect(() => {
    // Restore identity and pre-fill the room from ?room=, URL or storage.
    const params = new URLSearchParams(window.location.search);
    const queryRoom = params.get('room');
    const savedRoom = sessionStorage.getItem('game_room_id');
    const savedPlayerId = sessionStorage.getItem('game_player_id');
    const savedName = sessionStorage.getItem('game_player_name');

    if (savedPlayerId) {
      playerIdRef.current = savedPlayerId;
      setPlayerId(savedPlayerId);
    }
    if (savedName) {
      playerNameRef.current = savedName;
      setPlayerName(savedName);
    }
    if (queryRoom || savedRoom) {
      const nextRoom = normalizeRoomId(queryRoom || savedRoom || '');
      roomIdRef.current = nextRoom;
      setRoomId(nextRoom);
    }
  }, []);

  useEffect(() => {
    const socket = initSocket();

    const applyRoomState = (state: any) => {
      if (!state) return;

      if (state.room_id) rememberRoom(String(state.room_id));
      if (state.started_lives) {
        setStartingLives(Number(state.started_lives) || DEFAULT_STARTING_LIVES);
      }
      if (typeof state.current_round === 'number') {
        setCurrentRound(Number(state.current_round) || 0);
      }
      if (state.round_status === 'LOCKED') {
        setRoundActive(true);
      } else if (state.round_status === 'ENDED' || state.round_status === 'WAITING') {
        setRoundActive(false);
      }

      const me = Array.isArray(state.players)
        ? state.players.find((player: any) => player?.player_id === playerIdRef.current)
        : null;

      if (me) {
        setPoints(Number(me.points ?? DEFAULT_STARTING_LIVES));
        setSubmitted(Boolean(me.submitted));
        const isOut = Boolean(me.eliminated);
        setEliminated(isOut);
        eliminatedRef.current = isOut;
      }
    };

    socket.on('connect', () => {
      // Re-join after a reconnect: the server binds identity to the socket id,
      // so the new socket has to register again to keep receiving events.
      if (joinedRef.current && roomIdRef.current && playerNameRef.current) {
        socket.emit('join_room', {
          room_id: roomIdRef.current,
          player_name: playerNameRef.current,
          player_id: playerIdRef.current || undefined,
        });
      }
    });

    socket.on('connect_error', (err: any) => {
      setJoining(false);
      setError(
        err?.message === 'invalid_token'
          ? 'Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang.'
          : 'Không thể kết nối tới máy chủ.'
      );
    });

    socket.on('disconnect', () => {
      if (joinedRef.current) {
        setError('Mất kết nối. Đang thử kết nối lại...');
      }
    });

    socket.on('join_room_response', (data: any) => {
      setJoining(false);

      if (!data?.success) {
        setError(data?.error || 'Không thể vào phòng');
        return;
      }

      const serverPlayerId = data.player?.player_id || data.player_id || '';
      if (serverPlayerId) rememberPlayer(serverPlayerId);

      if (data.room_id) rememberRoom(String(data.room_id));

      const resolvedName =
        data.player?.name ||
        data.player?.player_name ||
        data.player_name ||
        playerNameRef.current;
      if (resolvedName) rememberName(resolvedName);

      joinedRef.current = true;
      setJoined(true);
      setError('');

      if (data.room_state) applyRoomState(data.room_state);
    });

    socket.on('room_state', (state: any) => {
      applyRoomState(state);
    });

    socket.on('round_started', (data: any) => {
      const roundId = Number(data?.round_id) || 0;
      const roundDuration = Number(data?.duration) || DEFAULT_ROUND_DURATION;

      setCurrentRound(roundId);
      setRoundActive(true);
      setSubmitted(false);
      setSubmitting(false);
      setGuess('');
      setLastGuess(null);
      setTimeLeft(roundDuration);
      setResult(null);
      setError('');
    });

    socket.on('player_submitted', (data: any) => {
      if (data?.player_id && data.player_id === playerIdRef.current) {
        setSubmitted(true);
        if (data.guess_number !== undefined) {
          setLastGuess(Number(data.guess_number));
        }
      }
    });

    socket.on('submit_guess_response', (data: any) => {
      setSubmitting(false);

      if (!data?.success) {
        setSubmitted(false);
        setError(data?.error || 'Gửi dự đoán thất bại');
        return;
      }

      setSubmitted(true);
      setError('');
      if (data.guess?.guess_number !== undefined) {
        setLastGuess(Number(data.guess.guess_number));
      }
      setGuess('');
    });

    socket.on('round_result_ready', (data: any) => {
      const resultData = data?.result ?? null;

      setRoundActive(false);
      setSubmitting(false);
      setTimeLeft(0);
      setError('');
      setResult(resultData);

      if (!resultData) return;

      const scoreboard = Array.isArray(resultData.scoreboard)
        ? resultData.scoreboard
        : [];
      const me = scoreboard.find(
        (player: any) => player?.player_id === playerIdRef.current
      );
      if (me) {
        setPoints(Number(me.points ?? 0));
        const isOut = Boolean(me.eliminated);
        setEliminated(isOut);
        eliminatedRef.current = isOut;
      }

      const guesses = Array.isArray(resultData.guesses) ? resultData.guesses : [];
      const myGuess = guesses.find(
        (entry: any) => entry?.player_id === playerIdRef.current
      );
      if (myGuess) setLastGuess(Number(myGuess.guess_number));

      const eliminatedNow = Array.isArray(resultData.eliminated)
        ? resultData.eliminated
        : [];
      if (
        eliminatedNow.some(
          (player: any) => player?.player_id === playerIdRef.current
        )
      ) {
        setExecutionVisible(true);
      }
    });

    socket.on('warning', (data: any) => {
      setError(data?.message || 'Cảnh báo');
    });

    socket.on('error', (data: any) => {
      setJoining(false);
      setSubmitting(false);
      setError(data?.error || 'Đã xảy ra lỗi');
    });

    return () => {
      socket.removeAllListeners();
      closeSocket();
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!roundActive || timeLeft <= 0) return;

    const timer = setTimeout(() => {
      setTimeLeft((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [roundActive, timeLeft]);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();

    const nextRoom = normalizeRoomId(roomId);
    const nextName = playerName.trim();

    if (!nextRoom || !nextName) {
      setError('Vui lòng nhập mã phòng và tên của bạn');
      return;
    }

    rememberRoom(nextRoom);
    rememberName(nextName);

    setJoining(true);
    setError('');

    const socket = getSocket();
    const emitJoin = () =>
      socket.emit('join_room', {
        room_id: nextRoom,
        player_name: nextName,
        player_id: playerIdRef.current || undefined,
      });

    // Never lose the join because the socket was still connecting.
    if (socket.connected) {
      emitJoin();
    } else {
      socket.once('connect', emitJoin);
    }
  };

  const handleSubmitGuess = (e: React.FormEvent) => {
    e.preventDefault();

    if (eliminated || eliminatedRef.current) {
      setError('Bạn đã bị loại và không thể dự đoán nữa');
      return;
    }
    if (submitting || submitted) return;
    if (!guess) {
      setError('Vui lòng nhập dự đoán');
      return;
    }

    const guessNum = parseFloat(guess);
    if (isNaN(guessNum) || guessNum < 0 || guessNum > 100) {
      setError('Dự đoán phải là số từ 0 đến 100');
      return;
    }

    const activeRoom = roomIdRef.current;
    if (currentRound <= 0 || !activeRoom) {
      setError('Chưa có vòng chơi. Hãy chờ MC bắt đầu...');
      return;
    }

    const activePlayerId =
      playerIdRef.current || sessionStorage.getItem('game_player_id') || '';
    if (!activePlayerId) {
      setError('Phiên người chơi chưa sẵn sàng. Hãy vào phòng lại.');
      return;
    }

    setSubmitting(true);
    setError('');

    getSocket().emit('submit_guess', {
      room_id: activeRoom,
      round_id: currentRound,
      player_id: activePlayerId,
      player_name: playerNameRef.current,
      guess_number: guessNum,
    });
  };

  const handleExitGame = () => {
    closeSocket();
    router.push('/');
  };

  if (!joined) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2>👤 Vào phòng</h2>
          <p className={styles.subtitle}>
            Mỗi người có {DEFAULT_STARTING_LIVES} mạng. Đoán sai mất 1 mạng — hết
            mạng là bị loại.
          </p>
          <form onSubmit={handleJoinRoom} className={styles.form}>
            <input
              type="text"
              placeholder="Mã phòng"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              className={styles.input}
              autoComplete="off"
              autoCapitalize="characters"
            />
            <input
              type="text"
              placeholder="Tên của bạn"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className={styles.input}
              autoComplete="off"
              autoFocus={Boolean(roomId)}
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.submitButton} disabled={joining}>
              {joining ? 'Đang vào phòng...' : 'Vào phòng'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const myResult = Array.isArray(result?.scoreboard)
    ? result.scoreboard.find(
        (player: any) => player?.player_id === playerId
      ) ?? null
    : null;
  const myDelta = Number(myResult?.last_delta ?? 0);
  const eliminatedNow = Array.isArray(result?.eliminated)
    ? result.eliminated
    : [];
  const gameOver = Boolean(result?.game_over);
  const iAmSurvivor = Boolean(
    gameOver && result?.survivor && result.survivor.player_id === playerId
  );

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <h2>🎮 {playerName}</h2>
            <p className={styles.subtitle}>
              Phòng: <strong>{roomId}</strong>
              {currentRound > 0 ? ` · Vòng ${currentRound}` : ''}
            </p>
          </div>
          <div
            className={`${styles.lives} ${eliminated ? styles.livesEmpty : ''}`}
            title={`${points}/${startingLives} mạng`}
          >
            {eliminated
              ? '☠️ ĐÃ BỊ LOẠI'
              : renderHearts(points, startingLives)}
          </div>
        </div>

        {eliminated && !gameOver && (
          <div className={styles.eliminatedBanner}>
            ☠️ Bạn đã hết mạng và bị xử tử. Bạn vẫn có thể theo dõi ván đấu với
            tư cách khán giả.
          </div>
        )}

        {gameOver && (
          <div className={iAmSurvivor ? styles.victory : styles.gameOver}>
            {iAmSurvivor
              ? '🏆 Bạn là người sống sót cuối cùng!'
              : result?.survivor
                ? `🏁 Ván đấu kết thúc. Người sống sót: ${result.survivor.player_name}`
                : '☠️ Tất cả người chơi đã bị loại.'}
          </div>
        )}

        {!roundActive && !result && (
          <div className={styles.waiting}>
            {eliminated ? (
              <p>💀 Bạn đang là khán giả. Chờ MC bắt đầu vòng tiếp theo...</p>
            ) : (
              <p>⏳ Chờ MC bắt đầu vòng chơi...</p>
            )}
          </div>
        )}

        {roundActive && !result && (
          <div className={styles.gameSection}>
            <div className={styles.timer}>
              {timeLeft > 0 ? (
                <>
                  Thời gian còn lại:{' '}
                  <span className={styles.timerValue}>{timeLeft}s</span>
                </>
              ) : (
                <span className={styles.timerDone}>⏳ Hết giờ — đang chờ kết quả...</span>
              )}
            </div>

            {timeLeft <= 0 ? (
              <div className={styles.waiting}>
                <p>Đang chờ MC công bố kết quả vòng này.</p>
              </div>
            ) : eliminated ? (
              <div className={styles.spectator}>
                ☠️ Bạn đã bị loại — hãy xem những người còn lại chiến đấu.
              </div>
            ) : submitted ? (
              <div className={styles.submitted}>
                ✓ Đã gửi dự đoán
                {lastGuess !== null ? `: ${lastGuess}` : ''}
                <span className={styles.submittedHint}>
                  Đang chờ những người chơi khác...
                </span>
              </div>
            ) : (
              <form onSubmit={handleSubmitGuess} className={styles.form}>
                <label>Nhập dự đoán của bạn (0-100):</label>
                <div className={styles.inputGroup}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    placeholder="50.5"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    className={styles.input}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className={styles.guessButton}
                    disabled={submitting}
                  >
                    {submitting ? 'Đang gửi...' : '✓ Gửi'}
                  </button>
                </div>
              </form>
            )}

            {error && <p className={styles.error}>{error}</p>}
          </div>
        )}

        {result && (
          <div className={styles.resultsSection}>
            <h3>
              📊 Kết quả{currentRound ? ` — Vòng ${currentRound}` : ''}
            </h3>

            <div className={styles.resultsGrid}>
              <div className={styles.resultItem}>
                <span>Dự đoán của bạn</span>
                <strong>{lastGuess ?? '—'}</strong>
              </div>
              <div className={styles.resultItem}>
                <span>Trung bình</span>
                <strong>{result.average}</strong>
              </div>
              <div className={styles.resultItem}>
                <span>Target (2/3)</span>
                <strong>{result.target}</strong>
              </div>
              <div className={styles.resultItem}>
                <span>Người thắng</span>
                <strong>{result.winner?.player_name ?? '—'}</strong>
              </div>
            </div>

            <div
              className={
                eliminated && !iAmSurvivor
                  ? styles.spectator
                  : myDelta < 0
                    ? styles.deltaDown
                    : iAmSurvivor
                      ? styles.deltaUp
                      : styles.deltaNeutral
              }
            >
              {eliminated && !iAmSurvivor
                ? '☠️ Bạn đã bị loại — đang theo dõi ván đấu.'
                : myDelta < 0
                  ? `💔 Đoán sai: ${myDelta} mạng → còn ${points}/${startingLives}`
                  : iAmSurvivor
                    ? '🏆 Bạn đã sống sót tới cuối cùng!'
                    : `🛡️ An toàn vòng này · còn ${points}/${startingLives} mạng`}
            </div>

            {result.convergence && (
              <div className={styles.ruleNotice}>
                🌀 Target hội tụ về 0: tất cả người chọn <strong>0</strong> bị
                trừ 1 mạng.
              </div>
            )}

            {eliminatedNow.length > 0 && (
              <div className={styles.executionNotice}>
                ☠️ Bị xử tử:{' '}
                {eliminatedNow
                  .map((player: any) => player.player_name)
                  .filter(Boolean)
                  .join(', ')}
              </div>
            )}
          </div>
        )}

        {error && !roundActive && <p className={styles.error}>{error}</p>}

        <button onClick={handleExitGame} className={styles.exitButton}>
          ← Thoát
        </button>
      </div>

      {executionVisible && (
        <ExecutionOverlay
          names={[playerName || 'Bạn']}
          variant="player"
          autoHideMs={6000}
          onDismiss={() => setExecutionVisible(false)}
        />
      )}
    </div>
  );
}
