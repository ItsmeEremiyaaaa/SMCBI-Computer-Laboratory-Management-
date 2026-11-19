import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authRepo } from '../data/repository';
import type { Profile } from '../../../shared/data/types';

interface AuthState { profile: Profile | null; loading: boolean; refresh: () => Promise<void> }
const Ctx = createContext<AuthState>({ profile: null, loading: true, refresh: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { setProfile(await authRepo.getSession()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); return authRepo.onAuthChange(refresh); }, [refresh]);
  return <Ctx.Provider value={{ profile, loading, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
