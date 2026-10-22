import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Me } from '@fixnow/shared';
import { useI18n } from '../i18n';
import { api, setAuthToken, setUnauthorizedHandler } from './api';

const TOKEN_KEY = 'fixnow.token';

interface AuthState {
  ready: boolean;
  me: Me | null;
  signInWithToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<Me | null>;
  setMe: (me: Me) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setLang } = useI18n();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setMe(null);
    await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
  }, []);

  const refreshMe = useCallback(async () => {
    const m = await api<Me>('/me');
    setMe(m);
    return m;
  }, []);

  const signInWithToken = useCallback(async (token: string) => {
    setAuthToken(token);
    await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
    const m = await refreshMe();
    setLang(m.preferredLanguage);
  }, [refreshMe, setLang]);

  useEffect(() => {
    setUnauthorizedHandler(() => { signOut(); });
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          await refreshMe();
        }
      } catch {
        // invalid/expired session or offline: stay signed out, user can sign in again
        setAuthToken(null);
      } finally {
        setReady(true);
      }
    })();
  }, [refreshMe, signOut]);

  const value = useMemo(() => ({ ready, me, signInWithToken, signOut, refreshMe, setMe }), [ready, me, signInWithToken, signOut, refreshMe]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside provider');
  return v;
}
