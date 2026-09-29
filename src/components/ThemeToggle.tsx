'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';
const KEY = 'eq-theme';

/**
 * Runs before first paint (inlined in layout.tsx <head>) so the page never
 * flashes the wrong theme. A stored choice wins; otherwise light.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${KEY}');if(t!=='dark'&&t!=='light'){t='light'}document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='light'?'#FAF7F2':'#171738')}catch(e){}})();`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as Theme) || 'light');
  }, []);

  const flip = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'light' ? '#FAF7F2' : '#171738');
    localStorage.setItem(KEY, next);
    setTheme(next);
  };

  return (
    <button
      onClick={flip}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="text-[13px] font-medium text-t3 transition-colors hover:text-t1"
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}
