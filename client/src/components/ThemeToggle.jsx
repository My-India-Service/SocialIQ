import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={`theme-toggle${className ? ` ${className}` : ''}`}
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        className={theme === 'light' ? 'is-active' : ''}
        aria-pressed={theme === 'light'}
        onClick={() => setTheme('light')}
      >
        Light
      </button>
      <button
        type="button"
        className={theme === 'dark' ? 'is-active' : ''}
        aria-pressed={theme === 'dark'}
        onClick={() => setTheme('dark')}
      >
        Dark
      </button>
    </div>
  );
}
