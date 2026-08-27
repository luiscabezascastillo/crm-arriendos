'use client'
// VERSION: v1 · 2026-08-26 · Botón "← Volver" reutilizable (history.back) — convención de navegación
//   (docs/desarrollo/Convencion_navegacion_retorno.md). Devuelve a donde se llamó la vista.
// Ruta real: app/components/ui/BotonVolver.js
export default function BotonVolver({ label = 'Volver' }) {
  return (
    <button
      onClick={() => { if (typeof window !== 'undefined') window.history.back() }}
      title="Volver a donde estabas"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: '#1D9E75', fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: '6px 2px', marginBottom: 6 }}>
      ← {label}
    </button>
  )
}
