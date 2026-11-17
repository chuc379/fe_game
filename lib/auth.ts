import { SOCKET_URL } from '@/lib/socket';

const TOKEN_KEY = 'mc_token';
const PLAYER_TAB_TOKEN_KEY = 'game_player_token';
const PLAYER_TAB_ROOM_KEY = 'game_player_token_room';
const PLAYER_TOKEN_PREFIX = 'game_player_token:';
const PLAYER_DISPLAY_PREFIX = 'game_player_display:';
const PLAYER_LAST_PREFIX = 'game_player_last:';

// ---------------------------------------------------------------- MC tokens

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = (): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
};

export const login = async (
  username: string,
  password: string
): Promise<{ token?: string; error?: string }> => {
  try {
    const res = await fetch(`${SOCKET_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.success || !data?.token) {
      return { error: data?.error || 'Login failed' };
    }

    return { token: data.token };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }
};

// ------------------------------------------------------------ Player tokens

const playerStoreKey = (roomId: string, playerName: string) =>
  `${PLAYER_TOKEN_PREFIX}${roomId.trim().toUpperCase()}:${playerName
    .trim()
    .toLowerCase()}`;

/**
 * Store a player identity token.
 *
 * The tab copy (sessionStorage) keeps multiple tabs on one machine separate so
 * they can be different test players, while the localStorage copy is keyed by
 * room + name so a refresh/rejoin can recover the same player.
 */
export const savePlayerToken = (
  roomId: string,
  playerName: string,
  token: string
): void => {
  if (typeof window === 'undefined' || !token) return;
  const normalizedRoom = roomId.trim().toUpperCase();
  window.sessionStorage.setItem(PLAYER_TAB_TOKEN_KEY, token);
  window.sessionStorage.setItem(PLAYER_TAB_ROOM_KEY, normalizedRoom);
  window.localStorage.setItem(
    playerStoreKey(normalizedRoom, playerName),
    token
  );
  window.localStorage.setItem(
    `${PLAYER_DISPLAY_PREFIX}${normalizedRoom}:${playerName
      .trim()
      .toLowerCase()}`,
    playerName.trim()
  );
  window.localStorage.setItem(
    `${PLAYER_LAST_PREFIX}${normalizedRoom}`,
    playerName.trim().toLowerCase()
  );
};

export const getPlayerToken = (
  roomId: string,
  playerName: string
): string | null => {
  if (typeof window === 'undefined') return null;
  const normalizedRoom = roomId.trim().toUpperCase();

  const tabToken = window.sessionStorage.getItem(PLAYER_TAB_TOKEN_KEY);
  const tabRoom = window.sessionStorage.getItem(PLAYER_TAB_ROOM_KEY);
  if (tabToken && tabRoom === normalizedRoom) {
    return tabToken;
  }

  if (!playerName.trim()) return null;
  return window.localStorage.getItem(playerStoreKey(normalizedRoom, playerName));
};

export const clearPlayerToken = (roomId?: string, playerName?: string): void => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PLAYER_TAB_TOKEN_KEY);
  window.sessionStorage.removeItem(PLAYER_TAB_ROOM_KEY);
  if (roomId && playerName) {
    const normalizedRoom = roomId.trim().toUpperCase();
    const storedName = playerName.trim().toLowerCase();
    window.localStorage.removeItem(playerStoreKey(roomId, playerName));
    window.localStorage.removeItem(
      `${PLAYER_DISPLAY_PREFIX}${normalizedRoom}:${storedName}`
    );
    if (
      window.localStorage.getItem(`${PLAYER_LAST_PREFIX}${normalizedRoom}`) ===
      storedName
    ) {
      window.localStorage.removeItem(`${PLAYER_LAST_PREFIX}${normalizedRoom}`);
    }
  }
};

/** True when this browser has a saved player identity for the room. */
export const hasSavedPlayerToken = (roomId: string): boolean => {
  if (typeof window === 'undefined') return false;
  const prefix = `${PLAYER_TOKEN_PREFIX}${roomId.trim().toUpperCase()}:`;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(prefix)) return true;
  }
  return false;
};

/**
 * Name of the player this browser previously used in the room, if any.
 * Used to auto-rejoin when a player scans the room QR code.
 */
export const getSavedPlayerName = (roomId: string): string | null => {
  if (typeof window === 'undefined') return null;
  const normalizedRoom = roomId.trim().toUpperCase();
  const displayOf = (storedName: string) => {
    const displayName = window.localStorage.getItem(
      `${PLAYER_DISPLAY_PREFIX}${normalizedRoom}:${storedName}`
    );
    return (displayName || storedName).trim();
  };

  // Prefer the identity this device used last in the room.
  const last = window.localStorage.getItem(
    `${PLAYER_LAST_PREFIX}${normalizedRoom}`
  );
  if (
    last &&
    window.localStorage.getItem(
      `${PLAYER_TOKEN_PREFIX}${normalizedRoom}:${last}`
    )
  ) {
    return displayOf(last) || null;
  }

  const prefix = `${PLAYER_TOKEN_PREFIX}${normalizedRoom}:`;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const storedName = key.slice(prefix.length).trim();
      if (storedName) return displayOf(storedName) || null;
    }
  }
  return null;
};
