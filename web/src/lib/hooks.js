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

/**
 * How many of `total` items to render: a first screenful, then more each time the sentinel
 * (an element placed after the list) scrolls into view. Starts over when `resetKey` changes.
 */
export function useProgressive(total, resetKey, first = 40, step = 80) {
  const [count, setCount] = useState(first);
  const [sentinel, setSentinel] = useState(null);
  useEffect(() => setCount(first), [resetKey, first]);
  useEffect(() => {
    if (!sentinel || count >= total || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && setCount((c) => c + step), {
      rootMargin: '800px 0px',
    });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [sentinel, count, total, step]);
  return [typeof IntersectionObserver === 'undefined' ? total : count, setSentinel];
}

export function toggleIn(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
