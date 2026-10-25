import { useEffect, useState } from 'react';

const PREFIX = 'montreel:';

// Favorites and preferences live in this browser only; storage can be blocked, so never throw.
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw == null) return initial;
      const parsed = JSON.parse(raw);
      return initial && typeof initial === 'object' && !Array.isArray(initial)
        ? { ...initial, ...parsed }
        : parsed;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* private mode, quota… */
    }
  }, [key, value]);
  return [value, setValue];
}

export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    const onVisible = () => document.visibilityState === 'visible' && setNow(new Date());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}

export function toggleIn(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
