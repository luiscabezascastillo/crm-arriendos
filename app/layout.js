'use client';
// VERSION: v3 · 2026-08-11 · FIX build Vercel: se ELIMINA next/font/google (DM Sans / DM Mono). Turbopack (Next 16)
//   fallaba al descargar el .woff2 de fonts.gstatic.com (404) y tumbaba el build entero con 8 errores. Las variables
//   CSS --font-dm-sans / --font-dm-mono se definen ahora con la pila del sistema (system-ui / ui-monospace), sin
//   dependencia de red en el build. globals.css NO cambia (sigue leyendo esas mismas variables). Hereda v2 (TabTitle).
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import TabTitle from "./components/ui/TabTitle";

// Antes las ponía next/font (DM Sans/DM Mono). Ahora, pila del sistema: idéntico contrato de variables, cero red.
const FUENTES = {
  "--font-dm-sans": "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  "--font-dm-mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" style={FUENTES} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <TabTitle />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
