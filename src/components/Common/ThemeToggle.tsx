import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-background-tertiary dark:hover:bg-dark-background-tertiary transition-colors"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-dark-text-primary" />
      ) : (
        <Moon className="w-5 h-5 text-text-primary" />
      )}
    </button>
  );
} 