import { create } from 'zustand';

interface Player {
  player_id: string;
  socket_id: string;
  name: string;
  is_online: boolean;
  joined_at: number;
}

interface Guess {
  player_id: string;
  player_name: string;
  guess_number: number;
  submitted_at: number;
}

interface Winner {
  player_id: string;
  player_name: string;
  guess_number: number;
  difference: number;
}

interface RoundResult {
  total_players: number;
  average: number;
  target: number;
  winner: Winner;
  calculated_at: number;
}

interface GameStore {
  // Room
  roomId: string | null;
  setRoomId: (id: string) => void;

  // Player
  player: Player | null;
  setPlayer: (player: Player) => void;

  // Game state
  roundId: number;
  setRoundId: (id: number) => void;

  guesses: Guess[];
  addGuess: (guess: Guess) => void;
  clearGuesses: () => void;

  result: RoundResult | null;
  setResult: (result: RoundResult) => void;

  players: Player[];
  addPlayer: (player: Player) => void;
  clearPlayers: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  roomId: null,
  setRoomId: (id: string) => set({ roomId: id }),

  player: null,
  setPlayer: (player: Player) => set({ player }),

  roundId: 1,
  setRoundId: (id: number) => set({ roundId: id }),

  guesses: [],
  addGuess: (guess: Guess) =>
    set((state) => ({
      guesses: [...state.guesses, guess],
    })),
  clearGuesses: () => set({ guesses: [] }),

  result: null,
  setResult: (result: RoundResult) => set({ result }),

  players: [],
  addPlayer: (player: Player) =>
    set((state) => ({
      players: [...state.players.filter((p) => p.player_id !== player.player_id), player],
    })),
  clearPlayers: () => set({ players: [] }),
}));
