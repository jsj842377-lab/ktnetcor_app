'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

type ThemeContextType = {
  isDarkMode: boolean;
  toggleTheme: () => void;
  workerName: string;
  setWorkerName: (name: string) => void;
  level: number;
  exp: number;
  setExpAndLevel: (exp: number, level: number) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleTheme: () => {},
  workerName: '작업자',
  setWorkerName: () => {},
  level: 1,
  exp: 0,
  setExpAndLevel: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [workerName, setWorkerNameState] = useState<string>('작업자');
  const [level, setLevel] = useState<number>(1);
  const [exp, setExp] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // 1. 로컬스토리지에서 테마 및 작업자 세션 복구
    const savedTheme = localStorage.getItem('kt_global_theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      setIsDarkMode(systemPrefersDark.matches);
    }

    const savedWorker = localStorage.getItem('kt_current_worker');
    if (savedWorker) {
      setWorkerNameState(savedWorker);
      // 서버에서 최신 EXP와 레벨 동기화
      supabase
        .from('workers')
        .select('exp, level')
        .eq('worker_name', savedWorker)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setExp(data.exp || 0);
            setLevel(data.level || 1);
          }
        });
    }
  }, []);

  const setWorkerName = (name: string) => {
    setWorkerNameState(name);
    localStorage.setItem('kt_current_worker', name);
  };

  const setExpAndLevel = (newExp: number, newLevel: number) => {
    setExp(newExp);
    setLevel(newLevel);
  };

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('kt_global_theme', newMode ? 'dark' : 'light');
  };

  if (!mounted) {
    return <div style={{ visibility: 'hidden', minHeight: '100vh' }}>{children}</div>;
  }

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, workerName, setWorkerName, level, exp, setExpAndLevel }}>
      <div style={{ 
        background: isDarkMode ? '#0f172a' : '#f8fafc', 
        color: isDarkMode ? '#f8fafc' : '#0f172a',
        minHeight: '100vh',
        transition: 'background 0.3s, color 0.3s'
      }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);