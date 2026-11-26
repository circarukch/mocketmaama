import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { OtpSession } from './otp';

const KEY = 'mocket-maama/session/v1';

interface AuthValue {
  ready: boolean;
  session: OtpSession | null;
  signIn: (s: OtpSession) => void;
  signOut: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<OtpSession | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setSession(JSON.parse(raw)))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback((s: OtpSession) => {
    setSession(s);
    AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
    AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);

  const value = useMemo(() => ({ ready, session, signIn, signOut }), [ready, session, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
