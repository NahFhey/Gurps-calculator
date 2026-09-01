import { useState } from 'react';

export function ThemeDevToggle() {
  const [isLight, setIsLight] = useState(
    () => document.documentElement.dataset.theme === 'light',
  );

  const toggleTheme = () => {
    setIsLight((current) => {
      if (current) {
        delete document.documentElement.dataset.theme;
      } else {
        document.documentElement.dataset.theme = 'light';
      }
      return !current;
    });
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle development theme"
      aria-pressed={isLight}
      className="rounded border border-edge-strong bg-surface-2 px-2 py-1 text-[10px] font-medium text-fg-secondary hover:border-edge-bright hover:bg-surface-3"
    >
      {isLight ? 'Light' : 'Dark'} theme
    </button>
  );
}
