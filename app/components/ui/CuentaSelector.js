// VERSION: v3 · 2026-07-30 · El desplegable ya no se corta en 80 cuentas.
//   Sin texto de busqueda mostraba solo las primeras 80 por codigo; con 121 imputables,
//   las 4301-xx caian mas alla del corte y la lista terminaba en 4201-41 (parecia que
//   faltaban en el plan, pero solo era el tope). Subido a 500: el plan entero cabe y se
//   ve completo, con scroll. La busqueda tambien devuelve hasta 500.
// VERSION: v2 · 2026-07-29 · Opciones del desplegable en DOS lineas.
//   Antes el codigo y la descripcion iban en la misma linea y la descripcion se
//   recortaba con puntos suspensivos: "4201-41 TELEFONO E INTE…", justo el texto que
//   hace falta para elegir bien. Ahora cada opcion muestra el codigo en negrita arriba
//   y la descripcion COMPLETA debajo, que envuelve si no cabe. Sin recortes.
//   Mismo comportamiento en todo lo demas; lo usan SA (cuenta_1 y cuenta_2) y Compras.
// VERSION: v1 · 2026-07-27 · Buscador del plan de cuentas, compartido.
//
// Nace en el panel de SA y lo usa tambien Compras: la misma ayuda en los dos sitios,
// escrita una sola vez. Sustituye a un campo de texto donde habia que recordar el
// codigo de memoria — de ahi salio el 1103-01 tecleado por 1101-03 que descuadro
// 42 millones.
//
// Props:
//   valor      texto actual del campo
//   plan       [{ codigo, descripcion }] cuentas imputables
//   onChange   (texto) => void
//   sugerida   codigo propuesto por el historico (opcional). Se ofrece con un boton
//              dentro del campo SOLO si esta vacio: sugerir es ayudar, no decidir.
//   formato    'codigo'       -> escribe "4201-41"            (SA, campo cuenta_1)
//              'codigo+desc'  -> escribe "4201-41 TELEFONO"   (Compras, campo cuenta)
'use client'

import { useState, useMemo } from 'react'

export default function CuentaSelector({
  valor, plan = [], onChange, sugerida = null, disabled = false,
  formato = 'codigo', placeholder = 'código o texto', estilo = null,
}) {
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState('')

  const planMap = useMemo(() => {
    const m = {}
    for (const c of plan) m[c.codigo] = c.descripcion
    return m
  }, [plan])

  const opciones = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return plan.slice(0, 500)
    return plan.filter(c =>
      c.codigo.toLowerCase().includes(t) ||
      String(c.descripcion || '').toLowerCase().includes(t)
    ).slice(0, 500)
  }, [q, plan])

  const texto = (c) => formato === 'codigo+desc'
    ? `${c.codigo} ${c.descripcion || ''}`.trim()
    : c.codigo

  const elegir = (c) => { onChange(texto(c)); setAbierto(false); setQ('') }

  // descripcion de lo que ya hay puesto, para el tooltip
  const cod = String(valor || '').trim().match(/^[0-9]{4}-[0-9]{2}(-[0-9]{2})?/)
  const desc = cod ? planMap[cod[0]] : null

  const base = estilo || {
    width: '100%', fontSize: 13, padding: '7px 9px', borderRadius: 6,
    border: '0.5px solid #D3D1C7', boxSizing: 'border-box',
    background: disabled ? '#F7F6F2' : '#fff',
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={abierto ? q : (valor || '')}
        disabled={disabled}
        placeholder={placeholder}
        title={desc || undefined}
        onFocus={() => { if (!disabled) { setAbierto(true); setQ('') } }}
        onChange={e => { setQ(e.target.value); onChange(e.target.value); if (!abierto) setAbierto(true) }}
        onKeyDown={e => {
          if (e.key === 'Escape') setAbierto(false)
          if (e.key === 'Enter' && opciones.length === 1) { e.preventDefault(); elegir(opciones[0]) }
        }}
        style={base}
      />

      {!abierto && sugerida && !String(valor || '').trim() && (
        <button
          onClick={() => onChange(
            formato === 'codigo+desc' && planMap[sugerida]
              ? `${sugerida} ${planMap[sugerida]}` : sugerida
          )}
          disabled={disabled}
          title={`Sugerido por el histórico: ${planMap[sugerida] || sugerida}`}
          style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            border: '0.5px solid #CDEBDF', background: '#F3FBF8', color: '#085041', cursor: 'pointer',
          }}>
          {sugerida}
        </button>
      )}

      {abierto && (<>
        <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 9100 }} />
        <div style={{
          position: 'absolute', top: 34, left: 0, zIndex: 9101, background: '#fff',
          border: '0.5px solid #D3D1C7', borderRadius: 8, boxShadow: '0 8px 22px rgba(0,0,0,0.16)',
          width: 'max(100%, 330px)', maxHeight: 260, overflowY: 'auto',
        }}>
          {plan.length === 0 && (
            <div style={{ fontSize: 11, color: '#B4B2A9', padding: 10 }}>
              No hay plan de cuentas cargado. Escribe el código a mano.
            </div>
          )}
          {plan.length > 0 && opciones.length === 0 && (
            <div style={{ fontSize: 11, color: '#B4B2A9', padding: 10 }}>Ninguna cuenta casa con «{q}»</div>
          )}
          {opciones.map(c => (
            <div key={c.codigo}
              onMouseDown={(e) => { e.preventDefault(); elegir(c) }}
              style={{ padding: '7px 10px', cursor: 'pointer', borderBottom: '0.5px solid #F3F2ED', display: 'flex', flexDirection: 'column', gap: 2 }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F7F6F2' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}>
              <span style={{ fontWeight: 700, color: '#085041', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{c.codigo}</span>
              <span style={{ color: '#4A4A46', fontSize: 11, lineHeight: 1.35, whiteSpace: 'normal', wordBreak: 'break-word' }}>{c.descripcion}</span>
            </div>
          ))}
        </div>
      </>)}
    </div>
  )
}
