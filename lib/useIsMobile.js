// VERSION: v1 · 2026-07-10 · Hook responsive reutilizable (semilla mobile-first para todo el CRM)
'use client';
import { useState, useEffect } from 'react';

// Devuelve true cuando el ancho de pantalla <= breakpoint (default 768px).
// SSR-safe: parte en false y se ajusta al montar en el cliente.
// Uso: const isMobile = useIsMobile();  ->  aplicar objetos de estilo condicionales.
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return isMobile;
}

export default useIsMobile;
