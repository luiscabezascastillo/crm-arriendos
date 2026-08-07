'use client';
// VERSION: v2 · 2026-08-07 · Monta <TabTitle/> para que el título de cada pestaña muestre el proceso abierto.
import { DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import TabTitle from "./components/ui/TabTitle";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});
const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${dmSans.variable} ${dmMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <TabTitle />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
