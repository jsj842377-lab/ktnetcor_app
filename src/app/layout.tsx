import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// ★ 다크 모드 적용을 위한 ThemeProvider 불러오기
import { ThemeProvider } from '@/context/ThemeContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ★ 웹사이트 탭 이름과 설명 (안전점검 시스템에 맞게 수정)
export const metadata: Metadata = {
  title: "안전점검 시스템",
  description: "경기설계팀 현장 안전점검 보고 시스템",
};

export default function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <html
      lang="ko" // 웹 접근성을 위해 en에서 ko(한국어)로 변경
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* ★ 기존 body 태그 안에 ThemeProvider로 children을 감싸줍니다. */}
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}