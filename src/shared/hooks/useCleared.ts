import { useCallback, useEffect, useState } from 'react';

// Notifications a user has cleared ("deleted") from their list. Clearing only hides the notice;
// the booking/report/account itself is untouched (use Approve, Dismiss, Archive… for that).
// shortcut: kept per device in localStorage, move to a table if cleared notices must follow the user across devices.
const KEEP = 500;
const read = (key: string) => { try { return new Set<string>(JSON.parse(localStorage.getItem(key) ?? '[]')); } catch { return new Set<string>(); } };

export function useCleared(userId: string | undefined) {
  const key = `comlab-cleared:${userId ?? 'anon'}`;
  const [cleared, setCleared] = useState(() => read(key));
  useEffect(() => setCleared(read(key)), [key]);
  // other tabs/components clearing the same list
  useEffect(() => {
    const sync = (e: Event) => { if (e instanceof StorageEvent ? e.key === key : (e as CustomEvent).detail === key) setCleared(read(key)); };
    window.addEventListener('storage', sync); window.addEventListener('comlab:cleared', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('comlab:cleared', sync); };
  }, [key]);
  const clear = useCallback((ids: string[]) => {
    const next = [...read(key), ...ids].slice(-KEEP);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* private mode: cleared for this session only */ }
    setCleared(new Set(next));
    window.dispatchEvent(new CustomEvent('comlab:cleared', { detail: key }));
  }, [key]);
  return { cleared, clear };
}
