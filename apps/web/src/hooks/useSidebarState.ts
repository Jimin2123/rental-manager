import { useState } from 'react';

const KEY = 'sidebar-collapsed';

export function useSidebarState(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    const stored = localStorage.getItem(KEY);
    if (stored !== null) return stored === 'true';
    return window.innerWidth < 1024;
  });

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    localStorage.setItem(KEY, String(v));
  };

  return [collapsed, setCollapsed];
}
