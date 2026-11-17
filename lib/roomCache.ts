/**
 * Tiny in-memory cache for the public room directory.
 *
 * The rooms page is mounted every time the user navigates back to it. Without
 * a cache each mount re-requested the whole directory from the server, which
 * looked like the list was constantly reloading. The module survives client
 * side navigation (Next.js keeps the JS module alive), so the list is shown
 * instantly and only refreshed when it is actually stale or explicitly
 * invalidated (create / delete / join).
 */

export interface RoomSummary {
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

/** How long a cached directory is considered fresh. */
const CACHE_TTL_MS = 15_000;

let cache: { rooms: RoomSummary[]; updatedAt: number } | null = null;

/** Fresh cache, or null when the data is missing/expired. */
export const readRoomCache = (): RoomSummary[] | null => {
  if (!cache) return null;
  if (Date.now() - cache.updatedAt > CACHE_TTL_MS) return null;
  return cache.rooms;
};

/** Cache regardless of freshness (useful to paint instantly, then refresh). */
export const readStaleRoomCache = (): RoomSummary[] | null =>
  cache?.rooms ?? null;

export const writeRoomCache = (rooms: RoomSummary[]): void => {
  cache = { rooms, updatedAt: Date.now() };
};

/** Force the next visit to fetch a fresh directory. */
export const invalidateRoomCache = (): void => {
  cache = null;
};
