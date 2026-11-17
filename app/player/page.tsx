'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initSocket, getSocket, closeSocket, getDeviceId } from '@/lib/socket';
import { getPlayerToken, savePlayerToken, clearPlayerToken } from '@/lib/auth';
import { invalidateRoomCache } from '@/lib/roomCache';
import ExecutionOverlay from '@/components/mc/ExecutionOverlay';
import RankMovementChart from '@/components/player/RankMovementChart';
import styles from './page.module.css';

const DEFAULT_STARTING_LIVES = 10;
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
  const [spectating, setSpectating] = useState(false);
  const [notice, setNotice] = useState('');

  const roomIdRef = useRef('');
  const playerNameRef = useRef('');
  const playerIdRef = useRef('');
  const joinedRef = useRef(false);
  const eliminatedRef = useRef(false);
  const spectatingRef = useRef(false);
  // Authoritative round deadline (epoch ms) sent by the server.
  const roundDeadlineRef = useRef(0);
  // Rank before the current result, used to animate rank movement.
  const prevRanksRef = useRef<Record<string, number>>({});
  const [rankDeltas, setRankDeltas] = useState<Record<string, number>>({});

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
        const remaining = Number(state.time_left);
        if (Number.isFinite(remaining)) setTimeLeft(Math.max(0, remaining));
        const deadline = Number(state.round_deadline);
        if (Number.isFinite(deadline) && deadline > 0) {
          roundDeadlineRef.current = deadline;
        }
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

      if (Array.isArray(state.scoreboard)) {
        const ranks: Record<string, number> = {};
        for (const entry of state.scoreboard) {
          if (entry?.player_id && entry?.rank != null) {
            ranks[entry.player_id] = Number(entry.rank);
          }
        }
        if (Object.keys(ranks).length > 0) {
          prevRanksRef.current = ranks;
        }
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
          player_token:
            getPlayerToken(roomIdRef.current, playerNameRef.current) ||
            undefined,
          device_id: getDeviceId() || undefined,
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

      const activeRoom = String(data.room_id || roomIdRef.current || '');
      if (data.player_token && activeRoom && resolvedName) {
        if (data.reauth) {
          clearPlayerToken(activeRoom, resolvedName);
        }
        savePlayerToken(activeRoom, resolvedName, data.player_token);
      }

      if (data.reauth) {
        setNotice(
          'Phiên người chơi cũ đã hết hạn (JWT 2 giờ). Bạn đã vào với một danh tính mới.'
        );
      } else if (data.rejoined) {
        setNotice('Chào mừng trở lại! Hệ thống nhận ra danh tính của bạn.');
      } else {
        setNotice('');
      }

      joinedRef.current = true;
      setJoined(true);
      setSpectating(false);
      spectatingRef.current = false;
      setError('');
      // The player count on the public directory changed.
      invalidateRoomCache();

      if (data.room_state) applyRoomState(data.room_state);
    });

    socket.on('session_demoted', (data: any) => {
      // The MC switched the room to "one link per machine" for the match.
      spectatingRef.current = true;
      setSpectating(true);
      setError(
        data?.message ||
          'Ván đấu đã bắt đầu: tab này chuyển sang chế độ khán giả.'
      );
    });

    socket.on('player_executed', (data: any) => {
      const executed = Array.isArray(data?.players) ? data.players : [];
      if (
        executed.some(
          (player: any) => player?.player_id === playerIdRef.current
        )
      ) {
        eliminatedRef.current = true;
        setEliminated(true);
        setExecutionVisible(true);
      }
    });

    socket.on('room_closed', (data: any) => {
      joinedRef.current = false;
      spectatingRef.current = false;
      setJoined(false);
      setSpectating(false);
      setEliminated(false);
      eliminatedRef.current = false;
      setError(data?.message || 'Phòng đã bị MC đóng.');
    });

    socket.on('room_state', (state: any) => {
      applyRoomState(state);
    });

    socket.on('round_started', (data: any) => {
      const roundId = Number(data?.round_id) || 0;
      const roundDuration = Number(data?.duration) || DEFAULT_ROUND_DURATION;
      const remaining = Number(data?.time_left ?? roundDuration);

      setCurrentRound(roundId);
      setRoundActive(true);
      setSubmitted(false);
      setSubmitting(false);
      setGuess('');
      setLastGuess(null);
      setTimeLeft(Number.isFinite(remaining) ? remaining : roundDuration);
      roundDeadlineRef.current = Number(data?.deadline) || 0;
      setResult(null);
      setError('');
    });

    // The server broadcasts the remaining time every second so all clients
    // (and tabs that were in the background) show the same countdown.
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
        if (data?.code === 'spectator') {
          spectatingRef.current = true;
          setSpectating(true);
        }
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
      roundDeadlineRef.current = 0;
      setError('');
      setResult(resultData);

      if (!resultData) return;

      const scoreboard = Array.isArray(resultData.scoreboard)
        ? resultData.scoreboard
        : [];

      // Compare the new ranking with the one before this round so the player
      // can see how many places they moved (positive = climbed).
      const newRanks: Record<string, number> = {};
      for (const entry of scoreboard) {
        if (entry?.player_id && entry?.rank != null) {
          newRanks[entry.player_id] = Number(entry.rank);
        }
      }
      const deltas: Record<string, number> = {};
      for (const [id, rank] of Object.entries(newRanks)) {
        const previous = prevRanksRef.current[id];
        if (previous != null) deltas[id] = previous - rank;
      }
      prevRanksRef.current = newRanks;
      setRankDeltas(deltas);

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

  // Timer countdown driven by the server deadline so every client agrees.
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

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();

    const nextRoom = normalizeRoomId(roomId);
    const nextName = playerName.trim();

    if (!nextRoom || !nextName) {
      setError('Vui lòng nhập mã phòng và tên của bạn');
      return;
    }

    if (nextName.length > 8) {
      setError('Tên người chơi tối đa 8 ký tự');
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
        player_token: getPlayerToken(nextRoom, nextName) || undefined,
        device_id: getDeviceId() || undefined,
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

    if (spectating || spectatingRef.current) {
      setError('Bạn đang là khán giả nên không thể dự đoán.');
      return;
    }
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
              placeholder="Tên của bạn (tối đa 8 ký tự)"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className={styles.input}
              autoComplete="off"
              maxLength={8}
              autoFocus={Boolean(roomId)}
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.submitButton} disabled={joining}>
              {joining ? 'Đang vào phòng...' : 'Vào phòng'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => router.push('/rooms')}
            >
              🏠 Xem danh sách phòng
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

        {spectating && !eliminated && (
          <div className={styles.spectatorBanner}>
            👁️ Tab này đang ở chế độ khán giả. Phòng chỉ cho phép 1 link người
            chơi mỗi máy khi ván đấu bắt đầu.
          </div>
        )}

        {notice && <div className={styles.notice}>{notice}</div>}

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
            {timeLeft <= 0 ? (
              <div className={styles.waiting}>
                <p>⏳ Hết giờ — đang chờ MC công bố kết quả vòng này.</p>
              </div>
            ) : spectating ? (
              <div className={styles.spectator}>
                👁️ Bạn đang theo dõi ván đấu với tư cách khán giả.
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
                <strong>
                  {Array.isArray(result.winners) && result.winners.length > 1
                    ? `${result.winners.length} người`
                    : result.winner?.player_name ?? '—'}
                </strong>
              </div>
            </div>

            <RankMovementChart
              players={
                Array.isArray(result.scoreboard) ? result.scoreboard : []
              }
              playerId={playerId}
              rankDeltas={rankDeltas}
            />

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
