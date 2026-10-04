'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initSocket, getSocket, closeSocket } from '@/lib/socket';
import styles from './page.module.css';

export default function PlayerPage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const savedPlayerId = sessionStorage.getItem('game_player_id');
    if (savedPlayerId) {
      setPlayerId(savedPlayerId);
    }
  }, []);
  const [guess, setGuess] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [roundActive, setRoundActive] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [duration, setDuration] = useState(30);
  const [timeLeft, setTimeLeft] = useState(30);
  const [lastGuess, setLastGuess] = useState<number | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = initSocket();

    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('join_room_response', (data: any) => {
      if (data.success) {
        const serverPlayerId = data.player?.player_id || data.player_id || '';
        setPlayerId(serverPlayerId);
        if (serverPlayerId) {
          sessionStorage.setItem('game_player_id', serverPlayerId);
        }
        setJoined(true);
        setError('');
      } else {
        setError(data.error || 'Failed to join room');
      }
    });

    socket.on('round_started', (data: any) => {
      const roundId = Number(data?.round_id) || 0;
      const roundDuration = Number(data?.duration) || 30;
      setCurrentRound(roundId);
      setDuration(roundDuration);
      setRoundActive(true);
      setSubmitted(false);
      setGuess('');
      setTimeLeft(roundDuration);
      setResult(null);
      setError('');
    });

    socket.on('round_result_ready', (data: any) => {
      setRoundActive(false);
      setResult(data?.result ?? null);
      setTimeLeft(0);
    });

    socket.on('submit_guess_response', (data: any) => {
      if (!data?.success) {
        setError(data?.error || 'Failed to submit guess');
        setSubmitted(false);
      } else {
        setError('');
      }
    });

    socket.on('error', (data: any) => {
      setError(data.error || 'An error occurred');
    });

    return () => {
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
      setRoundActive(false);
    }
  }, [timeLeft, roundActive]);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !playerName) {
      setError('Please fill in all fields');
      return;
    }

    const socket = getSocket();
    socket.emit('join_room', {
      room_id: roomId,
      player_name: playerName,
      player_id: sessionStorage.getItem('game_player_id') || undefined,
    });
  };

  const handleSubmitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess) {
      setError('Please enter a guess');
      return;
    }

    const guessNum = parseFloat(guess);
    if (isNaN(guessNum) || guessNum < 0 || guessNum > 100) {
      setError('Please enter a number between 0 and 100');
      return;
    }

    if (currentRound <= 0) {
      setError('No active round. Waiting for the MC to start...');
      return;
    }

    const activePlayerId = playerId || sessionStorage.getItem('game_player_id') || '';
    if (!activePlayerId) {
      setError('Player session is not ready yet. Please rejoin the room.');
      return;
    }

    const socket = getSocket();
    socket.emit('submit_guess', {
      room_id: roomId,
      round_id: currentRound,
      player_id: activePlayerId,
      player_name: playerName,
      guess_number: guessNum,
    });

    setPlayerId(activePlayerId);
    setSubmitted(true);
    setLastGuess(guessNum);
    setGuess('');
    setError('');
  };

  const handleExitGame = () => {
    closeSocket();
    router.push('/');
  };

  if (!joined) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2>👤 Join Game</h2>
          <form onSubmit={handleJoinRoom} className={styles.form}>
            <input
              type="text"
              placeholder="Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className={styles.input}
            />
            <input
              type="text"
              placeholder="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className={styles.input}
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.submitButton}>
              Join Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2>🎮 Game</h2>
        <p className={styles.subtitle}>
          Room: {roomId} | Player: {playerName}
          {currentRound ? ` | Round ${currentRound}/${duration}s` : ''}
        </p>

        {!roundActive && !result && (
          <div className={styles.waiting}>
            <p>⏳ Waiting for MC to start the round...</p>
          </div>
        )}

        {roundActive && !result && (
          <div className={styles.gameSection}>
            <div className={styles.timer}>
              Time left: <span className={styles.timerValue}>{timeLeft}s</span>
            </div>

            {!submitted ? (
              <form onSubmit={handleSubmitGuess} className={styles.form}>
                <label>Enter your guess (0-100):</label>
                <div className={styles.inputGroup}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="50.5"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    className={styles.input}
                  />
                  <button type="submit" className={styles.guessButton}>
                    ✓ Submit
                  </button>
                </div>
              </form>
            ) : (
              <div className={styles.submitted}>
                ✓ Your guess submitted: {guess}
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}
          </div>
        )}

            {result && (
              <div className={styles.resultsSection}>
                <h3>📊 Results{currentRound ? ` - Round ${currentRound}` : ''}</h3>
                <div className={styles.resultsGrid}>
                  <div className={styles.resultItem}>
                    <span>Average:</span>
                    <strong>{result.average}</strong>
                  </div>
                  <div className={styles.resultItem}>
                    <span>Target (2/3):</span>
                    <strong>{result.target}</strong>
                  </div>
                  <div className={styles.resultItem}>
                    <span>Your Guess:</span>
                    <strong>{lastGuess ?? '-'}</strong>
                  </div>
                  <div className={styles.resultItem}>
                    <span>Winner:</span>
                    <strong>{result.winner?.player_name}</strong>
                  </div>
                </div>
              </div>
            )}


        <button onClick={handleExitGame} className={styles.exitButton}>
          ← Exit Game
        </button>
      </div>
    </div>
  );
}
