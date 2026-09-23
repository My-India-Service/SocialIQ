import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'sad-theme';
const ThemeContext = createContext(null);

function readStoredTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* ignore */
  }
  return 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const initial = readStoredTheme();
    if (typeof document !== 'undefined') applyTheme(initial);
    return initial;
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  function setThemeMode(next) {
    if (next === 'dark' || next === 'light') setTheme(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
