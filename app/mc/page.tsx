'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initSocket, getSocket, closeSocket } from '@/lib/socket';
import PlayerList from '@/components/mc/PlayerList';
import RoundTimer from '@/components/mc/RoundTimer';
import ResultsDisplay from '@/components/mc/ResultsDisplay';
import RankingTable from '@/components/mc/RankingTable';
import ScoreChart from '@/components/mc/ScoreChart';
import RoundHistoryChart from '@/components/mc/RoundHistoryChart';
import styles from './page.module.css';

const ROUND_DURATION = 30;
const RESULT_TIMEOUT_MS = 15000;

export default function MCPage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [roomCreated, setRoomCreated] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [playerScores, setPlayerScores] = useState<any[]>([]);
  const [roundActive, setRoundActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [roundNumber, setRoundNumber] = useState(0);
  const [roundHistory, setRoundHistory] = useState<any[]>([]);

  const latest = useRef({ players, playerScores, roundNumber, roomId, roundActive });
  const calculatingRound = useRef<number | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latest.current = { players, playerScores, roundNumber, roomId, roundActive };
  });

  useEffect(() => {
    return () => {
      if (resultTimer.current) clearTimeout(resultTimer.current);
    };
  }, []);

  const clearResultTimer = () => {
    if (resultTimer.current) {
      clearTimeout(resultTimer.current);
      resultTimer.current = null;
    }
  };

  const normalizePlayer = (data: any) => {
    const player = data?.player ?? data ?? {};
    const playerId = player.player_id ?? player.id ?? player.playerId ?? null;
    const playerName = player.player_name ?? player.name ?? 'Unknown Player';

    return {
      ...player,
      player_id: playerId,
      player_name: playerName,
      submitted: Boolean(player.submitted),
    };
  };

  useEffect(() => {
    const socket = initSocket();

    socket.on('connect', () => {
      console.log('MC connected to server');
    });

    socket.on('join_room_response', (data: any) => {
      if (data.success) {
        setRoomCreated(true);
        setError('');
      } else {
        setError(data.error || 'Failed to create room');
      }
    });

    socket.on('start_round_response', (data: any) => {
      if (data?.success) {
        setRoundNumber(Number(data.round_id) || 0);
        calculatingRound.current = null;
        clearResultTimer();
        setError('');
      } else {
        setError(data?.error || 'Failed to start round');
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
        const hasPlayer = prev.some((p) => p.player_id && playerData.player_id && p.player_id === playerData.player_id);
        if (hasPlayer) {
          return prev;
        }
        return [...prev, { ...playerData, submitted: false }];
      });

      // Initialize score for new player
      setPlayerScores((prev) => {
        const hasScore = prev.some((p) => p.player_id === playerData.player_id);
        if (hasScore) return prev;
        
        return [...prev, {
          player_id: playerData.player_id,
          player_name: playerData.player_name,
          score: 0,
        }];
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

    socket.on('round_result_ready', (data: any) => {
      setRoundActive(false);
      setTimeLeft(0);
      setResult(data?.result ?? null);
      setError('');
      calculatingRound.current = null;
      clearResultTimer();

      const resultData = data?.result;
      if (!resultData) return;

      const { players: currentPlayers, roundNumber: currentRound } = latest.current;

      // Update scores based on result
      setPlayerScores((prevScores) => {
        const updated: Record<string, any> = {};

        prevScores.forEach((score) => {
          updated[score.player_id] = { ...score };
        });

        currentPlayers.forEach((player) => {
          if (!updated[player.player_id]) {
            updated[player.player_id] = {
              player_id: player.player_id,
              player_name: player.player_name,
              score: 0,
            };
          }
        });

        // Award winner +10, all participants +1
        Object.keys(updated).forEach((playerId) => {
          if (resultData.winner?.player_id === playerId) {
            updated[playerId].score += 10;
          } else if (currentPlayers.some((p) => p.player_id === playerId)) {
            updated[playerId].score += 1;
          }
        });

        return Object.values(updated);
      });

      // Add to round history
      setRoundHistory((prev) => [
        ...prev,
        {
          round: Number(data?.round_id) || currentRound,
          average: Math.round(resultData.average * 100) / 100,
          target: Math.round(resultData.target * 100) / 100,
        },
      ]);
    });

    socket.on('error', (data: any) => {
      calculatingRound.current = null;
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
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!roundActive || timeLeft <= 0) return;

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [roundActive, timeLeft]);

  // Auto-end when timer reaches 0
  useEffect(() => {
    if (roundActive && timeLeft === 0) {
      emitCalculate(false);
    }
  }, [timeLeft, roundActive]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const socket = getSocket();
    socket.emit('join_room', {
      room_id: newRoomId,
      player_name: 'MC',
      is_mc: true,
    });

    setPlayers([]);
    setPlayerScores([]);
    setRoundHistory([]);
    setRoundNumber(0);
    setResult(null);
    setRoomId(newRoomId);
    setRoomCreated(true);
    setError('');
  };

  const handleStartRound = () => {
    const socket = getSocket();
    socket.emit('start_round', {
      room_id: roomId,
    });

    setRoundActive(true);
    setTimeLeft(ROUND_DURATION);
    setResult(null);
    setPlayers((prev) => prev.map((p) => ({ ...p, submitted: false })));
  };

  const emitCalculate = (force: boolean, resetGuard = false) => {
    if (roundNumber <= 0) {
      setError('Start a round before calculating results');
      return;
    }
    if (resetGuard) calculatingRound.current = null;
    if (calculatingRound.current === roundNumber) return;

    calculatingRound.current = roundNumber;
    const socket = getSocket();
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

  const submittedCount = players.filter((p) => p.submitted).length;
  const allSubmitted = submittedCount === players.length && players.length > 0;

  if (!roomCreated) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2>🎛️ MC Control</h2>
          <p>Create a new game room</p>
          <button onClick={handleCreateRoom} className={styles.createButton}>
            Create Room
          </button>
          {error && <p className={styles.error}>{error}</p>}
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
          <PlayerList players={players} />

          {/* Round Control */}
          {!roundActive && !result && (
            <button
              onClick={handleStartRound}
              disabled={players.length === 0}
              className={styles.startButton}
            >
              ▶ Start Round
            </button>
          )}

          {/* Timer Section */}
          {roundActive && !result && (
            <RoundTimer
              timeLeft={timeLeft}
              submittedCount={submittedCount}
              totalPlayers={players.length}
              onSkipRound={handleSkipRound}
              onCalculateResults={handleCalculateResults}
              allSubmitted={allSubmitted}
            />
          )}

          {/* Results Section */}
          {result && (
            <ResultsDisplay result={result} onNextRound={handleStartRound} />
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
            <RankingTable players={playerScores} />
            <ScoreChart players={playerScores} />
            <RoundHistoryChart roundHistory={roundHistory} />
          </>
        ) : (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#999',
          }}>
            <p style={{ fontSize: '18px' }}>📊 Stats appear after first round</p>
          </div>
        )}
      </div>
    </div>
  );
}
