import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// ★ 다크 모드 적용을 위한 ThemeProvider 불러오기
import { ThemeProvider } from '@/context/ThemeContext';

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "안전점검 시스템",
  description: "경기설계팀 현장 안전점검 보고 시스템",
  openGraph: {
    title: "안전점검 시스템",
    description: "경기설계팀 현장 안전점검 보고 시스템",
  },
};

export default function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <html
      lang="ko"
      className={`${cormorant.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
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