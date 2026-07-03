import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Mode = 'light' | 'dark' | 'system';

const KEY = 'tm_theme';

interface ThemeContextValue {
  mode: Mode;
  resolved: 'light' | 'dark';
  setMode: (m: Mode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => (localStorage.getItem(KEY) as Mode) || 'system');

  const resolved: 'light' | 'dark' =
    mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode;

  useEffect(() => {
    const root = document.documentElement;
    if (resolved === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [resolved]);

  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setModeState('system');
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, [mode]);

  const setMode = (m: Mode) => {
    setModeState(m);
    localStorage.setItem(KEY, m);
  };

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
