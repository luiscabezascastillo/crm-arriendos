// RUTA: app/op/liquidacion-paola/historico/page.js
// VERSION: v1 · 2026-08-16 · Hoja HISTÓRICA de Liquidación Paola (solo lectura). Tres vistas:
//   a) HISTÓRICO — matriz "A cobrar" por idadmon × mes (foto congelada liquidacion_idadmon, 2501→hoy),
//      con el candado del mes congelado y totales por mes. (El "Recibido" histórico es fase 2: no está
//      en BD, se recalcula de la cartola de Drive.)
//   b) MES EN CURSO — botón que lleva a la pantalla normal /op/liquidacion-paola.
//   c) RUT ↔ IDADMON — el buscador pagadores_idadmon agrupado por pagador (RUT/glosa) → contratos,
//      al estilo del RUT→IDADMON del BI (clase renta/ambiguo/no_es_renta, vigente, buscador).
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import TopNav from '../../../components/ui/TopNav'

const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const labelMes = (aamm) => { const s = String(aamm || ''); if (!/^\d{4}$/.test(s)) return s; return `${MES_CORTO[parseInt(s.slice(2), 10) - 1]} ${s.slice(0, 2)}` }
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL'))
const CLASE = {
  renta: { bg: '#f0fdf4', color: '#16a34a', label: 'renta' },
  ambiguo: { bg: '#fffbeb', color: '#d97706', label: 'ambiguo' },
  no_es_renta: { bg: '#f3f4f6', color: '#6b7280', label: 'no es renta' },
}

export default function HistoricoPaolaPage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState('historico')  // 'historico' | 'pagadores'
  const [q, setQ] = useState('')
  const [claseFiltro, setClaseFiltro] = useState('todas')

  useEffect(() => {
    (async () => {
      setCargando(true)
      try { const r = await fetch('/api/liquidacion-paola/historico'); const d = await r.json(); if (d.error) setError(d.error); else setData(d) }
      catch (e) { setError(String(e?.message || e)) }
      setCargando(false)
    })()
  }, [])

  // ── Matriz A cobrar (idadmon × mes) ──────────────────────────────────────────
  const matriz = useMemo(() => {
    if (!data) return null
    const meses = Array.from(new Set(data.historico.map(h => h.mes))).sort()
    const filasMap = new Map()  // idadmon -> { idadmon, inmueble, arrendatario, valores:{mes:aCobrar} }
    for (const h of data.historico) {
      if (!filasMap.has(h.idadmon)) {
        const c = data.contrato[h.idadmon] || {}
        filasMap.set(h.idadmon, { idadmon: h.idadmon, inmueble: h.inmueble || c.inmueble || '', arrendatario: h.arrendatario || c.arrendatario || '', estado: c.estado || null, valores: {} })
      }
      filasMap.get(h.idadmon).valores[h.mes] = h.aCobrar
    }
    const filas = Array.from(filasMap.values()).sort((a, b) => String(a.inmueble).localeCompare(String(b.inmueble), 'es', { numeric: true }) || String(a.idadmon).localeCompare(String(b.idadmon)))
    const totalPorMes = {}
    for (const m of meses) totalPorMes[m] = filas.reduce((s, f) => s + (Number(f.valores[m]) || 0), 0)
    return { meses, filas, totalPorMes }
  }, [data])

  // ── RUT ↔ idadmon (agrupado por pagador) ─────────────────────────────────────
  const grupos = useMemo(() => {
    if (!data) return []
    const g = new Map()  // clave -> { clave, rut, glosa, items:[{idadmon,clase,vigente, inmueble, arrendatario, estado}] }
    for (const p of data.pagadores) {
      const k = p.clave || p.rut || p.glosa || '(sin clave)'
      if (!g.has(k)) g.set(k, { clave: k, rut: p.rut || '', glosa: p.glosa || '', items: [] })
      const c = data.contrato[p.idadmon] || {}
      g.get(k).items.push({ idadmon: p.idadmon, clase: p.clase, vigente: p.vigente, inmueble: c.inmueble || '', arrendatario: c.arrendatario || '', estado: c.estado || null })
    }
    let arr = Array.from(g.values())
    // clase dominante del grupo (para filtro/orden)
    for (const x of arr) x.claseGrupo = x.items.some(i => i.clase === 'no_es_renta') && x.items.every(i => i.clase === 'no_es_renta') ? 'no_es_renta' : (x.items.some(i => i.clase === 'ambiguo') ? 'ambiguo' : 'renta')
    if (claseFiltro !== 'todas') arr = arr.filter(x => x.items.some(i => i.clase === claseFiltro))
    const nq = q.trim().toUpperCase()
    if (nq) arr = arr.filter(x =>
      String(x.rut).toUpperCase().includes(nq) || String(x.glosa).toUpperCase().includes(nq) ||
      x.items.some(i => String(i.idadmon || '').toUpperCase().includes(nq) || String(i.arrendatario).toUpperCase().includes(nq) || String(i.inmueble).toUpperCase().includes(nq)))
    // multi-idadmon primero (son los que hay que vigilar), luego por rut
    arr.sort((a, b) => (b.items.length - a.items.length) || String(a.rut).localeCompare(String(b.rut)))
    return arr
  }, [data, q, claseFiltro])

  const cont = { maxWidth: 1400, margin: '0 auto', padding: '16px 22px 60px' }
  const tabBtn = (activo) => ({ fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: '1px solid ' + (activo ? '#6B4423' : '#E0DED6'), background: activo ? '#6B4423' : '#fff', color: activo ? '#fff' : '#5A5954', cursor: 'pointer' })

  return (
    <>
      <TopNav />
      <div style={cont}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <button onClick={() => router.push('/op/liquidacion-paola')} style={{ fontSize: 13, border: 'none', background: 'transparent', color: '#6B4423', cursor: 'pointer' }}>← Liquidación Paola</button>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: '#1a1a2e' }}>Liquidaciones de Paola · histórico <span style={{ fontSize: 13, fontWeight: 500, color: '#888780' }}>P001</span></h1>
        </div>
        <div style={{ fontSize: 12.5, color: '#888780', marginBottom: 14 }}>2025-2026 · congelado hasta que se cierra cada mes. Solo lectura.</div>

        {/* Botonera de vistas */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => setVista('historico')} style={tabBtn(vista === 'historico')}>📊 Histórico (A cobrar)</button>
          <button onClick={() => setVista('pagadores')} style={tabBtn(vista === 'pagadores')}>🔗 RUT ↔ idadmon</button>
          <button onClick={() => router.push('/op/liquidacion-paola')} style={{ ...tabBtn(false), borderStyle: 'dashed' }}>▶ Ver mes en curso</button>
        </div>

        {cargando && <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Cargando…</div>}
        {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#FBE9E7', border: '0.5px solid #F0C9C2', color: '#B23A3A', fontSize: 13 }}>{error}</div>}

        {/* ── VISTA HISTÓRICO ─────────────────────────────────────────────── */}
        {!cargando && !error && vista === 'historico' && matriz && (
          <>
            <div style={{ fontSize: 11.5, color: '#B4B2A9', marginBottom: 8 }}>
              Importe <b>A cobrar</b> por contrato y mes (foto congelada). 🔒 = mes cerrado. El <b>Recibido</b> histórico no está en la base (se recalcula de la cartola): esta hoja muestra el A cobrar, que es dato firme.
            </div>
            <div style={{ border: '0.5px solid #E0DED6', borderRadius: 10, overflow: 'auto', background: '#fff', maxHeight: '72vh' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11.5, width: '100%' }}>
                <thead>
                  <tr style={{ background: '#F1EFE9' }}>
                    <th style={{ position: 'sticky', left: 0, top: 0, zIndex: 4, background: '#F1EFE9', padding: '8px 10px', textAlign: 'left', color: '#5F5E5A', minWidth: 220, borderBottom: '0.5px solid #D3D1C7' }}>Contrato</th>
                    {matriz.meses.map(m => (
                      <th key={m} style={{ position: 'sticky', top: 0, zIndex: 3, background: '#F1EFE9', padding: '8px 10px', textAlign: 'right', color: '#5F5E5A', whiteSpace: 'nowrap', borderBottom: '0.5px solid #D3D1C7' }}>
                        {labelMes(m)}{data.cierre[m] ? ' 🔒' : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matriz.filas.map(f => (
                    <tr key={f.idadmon}>
                      <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '6px 10px', borderBottom: '0.5px solid #F0EFEA', borderRight: '0.5px solid #EDEBE4' }}>
                        <div style={{ fontWeight: 600, color: '#2C2C2A' }}>{f.inmueble || f.idadmon}</div>
                        <div style={{ fontSize: 10.5, color: '#9C9A92' }}>{f.idadmon}{f.arrendatario ? ' · ' + f.arrendatario : ''}</div>
                      </td>
                      {matriz.meses.map(m => (
                        <td key={m} style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: f.valores[m] == null ? '#D3D1C7' : '#2C2C2A', borderBottom: '0.5px solid #F0EFEA' }}>{num(f.valores[m] ?? null)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#F7F6F2', fontWeight: 700 }}>
                    <td style={{ position: 'sticky', left: 0, background: '#F7F6F2', padding: '8px 10px', borderTop: '1px solid #E0DED6' }}>Total ({matriz.filas.length} contratos)</td>
                    {matriz.meses.map(m => (
                      <td key={m} style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderTop: '1px solid #E0DED6' }}>{num(matriz.totalPorMes[m])}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* ── VISTA RUT ↔ IDADMON ─────────────────────────────────────────── */}
        {!cargando && !error && vista === 'pagadores' && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por RUT, nombre, glosa o idadmon…"
                style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '0.5px solid #E0DED6', minWidth: 300, flex: '1 1 320px' }} />
              {['todas', 'renta', 'ambiguo', 'no_es_renta'].map(c => (
                <button key={c} onClick={() => setClaseFiltro(c)}
                  style={{ fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', border: '1px solid ' + (claseFiltro === c ? '#6B4423' : '#E0DED6'), background: claseFiltro === c ? '#6B4423' : '#fff', color: claseFiltro === c ? '#fff' : '#5A5954' }}>
                  {c === 'todas' ? 'Todas' : (CLASE[c]?.label || c)}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: '#B4B2A9', marginBottom: 10 }}>
              Cada pagador (RUT o glosa de la cartola) con los contratos a los que se le imputa. Los de <b>varios contratos</b> van arriba (hay que desempatar por importe). <b>«no es renta»</b> = ingreso de Paola ajeno al arriendo. {grupos.length} pagador(es).
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
              {grupos.map(g => (
                <div key={g.clave} style={{ border: '0.5px solid ' + (g.items.length > 1 ? '#E7C9A0' : '#E0DED6'), borderRadius: 10, background: '#fff', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontWeight: 700, color: '#2C2C2A', fontSize: 13 }}>{g.rut || g.clave}</div>
                    {g.items.length > 1 && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#B45309', background: '#FEF3C7', borderRadius: 6, padding: '2px 7px' }}>{g.items.length} contratos</span>}
                  </div>
                  {g.glosa && <div style={{ fontSize: 10.5, color: '#9C9A92', marginTop: 2, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.glosa}>{g.glosa}</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {g.items.map((it, i) => {
                      const cl = CLASE[it.clase] || CLASE.renta
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <span style={{ fontWeight: 700, color: it.idadmon ? '#085041' : '#9C9A92', minWidth: 58 }}>{it.idadmon || '—'}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: cl.color, background: cl.bg, borderRadius: 5, padding: '1px 6px' }}>{cl.label}</span>
                          {it.vigente === false && <span style={{ fontSize: 10, color: '#B23A3A' }}>no vigente</span>}
                          <span style={{ color: '#5A5954', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${it.inmueble} · ${it.arrendatario}`}>{it.inmueble || it.arrendatario || ''}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {grupos.length === 0 && <div style={{ padding: 24, color: '#888' }}>Sin resultados.</div>}
            </div>
          </>
        )}
      </div>
    </>
  )
}
