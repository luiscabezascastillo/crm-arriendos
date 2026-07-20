// VERSION: v1 · 2026-07-20 · Buscador "ir a propietario" (scroll + realce) + filtro opcional "solo no enviadas". Reutilizable en CARTAS/EMAILS/TRANSFER/FALTAN/FACTURAS.
'use client'

import { useRef, useState } from 'react'

// Normaliza: minúsculas y sin tildes, para casar "Pávez" con "pavez".
const quita = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Texto buscable por defecto de un bloque (propietario): idprop + nombre + de cada
// inmueble su idadmon, arrendatario, rut y propiedad. Cada vista puede pasar el suyo.
function textoDefecto(b) {
  const base = [b.idprop, b.propietario]
  for (const x of (b.inmuebles || [])) base.push(x.idadmon, x.arrendatario, x.rut, x.propiedad)
  return quita(base.join(' '))
}

/*
  Props:
  - bloques: array de propietarios que se está renderizando.
  - getId(b): devuelve el identificador; el DOM del bloque debe llevar id = `${idPrefix}-${getId(b)}`.
  - getTexto(b): string buscable (por defecto textoDefecto).
  - idPrefix: prefijo del id en el DOM (por defecto 'liq'). Debe coincidir con el de la página.
  - mostrarFiltroEnviadas: si true, muestra la casilla "Solo no enviadas".
  - soloNoEnviadas / onSoloNoEnviadas: estado controlado del filtro (lo gestiona la página).
  - nNoEnviadas: número para el contador de la casilla (opcional).
  - ancho: ancho del input en px (opcional).

  El scroll y el realce se hacen por DOM (no tocan el estado de React de la página):
  solo requiere que cada tarjeta lleve su id. Si la misma búsqueda se repite, salta a la
  siguiente coincidencia (cicla), útil cuando hay varios inmuebles en la misma dirección.
*/
export default function BuscarLiquidacion({
  bloques = [],
  getId = b => b.idprop,
  getTexto = textoDefecto,
  idPrefix = 'liq',
  mostrarFiltroEnviadas = false,
  soloNoEnviadas = false,
  onSoloNoEnviadas = () => {},
  nNoEnviadas = null,
  ancho = 300,
}) {
  const [q, setQ] = useState('')
  const [aviso, setAviso] = useState('')
  const ultimo = useRef({ term: '', idx: -1 })

  function realzar(id) {
    const el = document.getElementById(idPrefix + '-' + id)
    if (!el) return false
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const prev = el.style.boxShadow
    el.style.transition = 'box-shadow .25s ease'
    el.style.boxShadow = '0 0 0 3px #F59E0B, 0 0 0 9px rgba(245,158,11,.22)'
    setTimeout(() => { el.style.boxShadow = prev || '' }, 1900)
    return true
  }

  function ir() {
    const term = quita(q.trim())
    if (!term) { setAviso(''); ultimo.current = { term: '', idx: -1 }; return }
    const matches = bloques.filter(b => getTexto(b).includes(term))
    if (matches.length === 0) { setAviso('Sin resultados'); ultimo.current = { term, idx: -1 }; return }
    // Misma búsqueda repetida -> siguiente coincidencia (cicla).
    let idx = 0
    if (ultimo.current.term === term && ultimo.current.idx >= 0) idx = (ultimo.current.idx + 1) % matches.length
    ultimo.current = { term, idx }
    setAviso(matches.length > 1 ? `${idx + 1} de ${matches.length}` : '')
    realzar(getId(matches[idx]))
  }

  function onChange(e) {
    setQ(e.target.value)
    setAviso('')
    ultimo.current = { term: '', idx: -1 }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: 7, overflow: 'hidden', background: '#fff' }}>
        <input
          value={q}
          onChange={onChange}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ir() } }}
          placeholder="Ir a propietario (nombre, P0…, IdAdmon, RUT)"
          style={{ fontSize: 13, padding: '7px 10px', border: 'none', outline: 'none', width: ancho }}
        />
        <button onClick={ir} title="Ir al propietario (Enter). Repite para la siguiente coincidencia."
          style={{ fontSize: 13, padding: '7px 12px', border: 'none', borderLeft: '1px solid #E5E7EB', background: '#F3F4F6', color: '#374151', cursor: 'pointer' }}>
          🔎
        </button>
      </div>
      {aviso && (
        <span style={{ fontSize: 12, fontWeight: 600, color: aviso === 'Sin resultados' ? '#B91C1C' : '#64748B' }}>{aviso}</span>
      )}
      {mostrarFiltroEnviadas && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={soloNoEnviadas} onChange={e => onSoloNoEnviadas(e.target.checked)} />
          Solo no enviadas{nNoEnviadas != null ? ` (${nNoEnviadas})` : ''}
        </label>
      )}
    </div>
  )
}
