'use client';

import { createContext, useContext, useState, useEffect } from 'react';

type ThemeContextType = {
  isDarkMode: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({ isDarkMode: false, toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false); // 서버와 클라이언트 렌더링 충돌 방지용

  useEffect(() => {
    setMounted(true); // 클라이언트 마운트 완료 확인
    
    // 1. 기기의 시스템 설정(다크모드 여부) 감지
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    const savedTheme = localStorage.getItem('kt_global_theme');

    // 2. 사용자가 강제로 지정한 테마가 있으면 그걸 우선하고, 없으면 기기 설정을 따름
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      setIsDarkMode(systemPrefersDark.matches);
    }

    // 3. 기기의 시간이 되어 자동으로 다크모드/라이트모드로 바뀔 때 이를 감지하는 리스너
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('kt_global_theme')) {
        setIsDarkMode(e.matches);
      }
    };

    systemPrefersDark.addEventListener('change', handleChange);
    return () => systemPrefersDark.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('kt_global_theme', newMode ? 'dark' : 'light');
  };

  // 마운트 전에는 빈 화면을 렌더링하여 Next.js 에러 방지
  if (!mounted) {
    return <div style={{ visibility: 'hidden', minHeight: '100vh' }}>{children}</div>;
  }

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
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