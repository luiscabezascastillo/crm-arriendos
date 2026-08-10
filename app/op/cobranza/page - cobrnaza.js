'use client'
// VERSION: v3 · 2026-07-21 · Cartolas operativa y por defecto (endpoint unificado /api/cobranza?tipo=).
//   Cabecera "Cobranza de {tipo} · situación al {fecha, hora}". Columna "Último abono". Toggles vigente/término,
//   sin_cobrador resaltado. Inicios sigue disponible como sub-vista. Servicios enlaza a /op/deudas.

import { useState, useEffect } from 'react'
import Link from 'next/link'

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const money = (v) => { const n = num(v); return (n ? '$' + n.toLocaleString('es-CL') : '$0') }

const C = {
  txt: '#2C2C2A', sub: '#888780', line: '#D3D1C7', panel: '#F1EFE8',
  rojo: '#9B1C1C', rojoBg: '#FBEDEC', verde: '#085041', verdeBg: '#E9F4E4',
  ambar: '#B8860B', ambarBg: '#FBF7EC', acento: '#1D9E75',
}

function fechaHoraLocal(iso) {
  const d = iso ? new Date(iso) : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ', ' + p(d.getHours()) + ':' + p(d.getMinutes())
}

const TABS = [
  { k: 'cartolas', label: 'Cartolas' },
  { k: 'servicios', label: 'Servicios', href: '/op/deudas' },
  { k: 'inicios', label: 'Inicios' },
  { k: 'bitacora', label: 'Bitácora', pronto: true },
]
const TITULO_TIPO = { cartolas: 'Cobranza de Cartolas', inicios: 'Cobranza de Inicios' }

export default function Cobranza() {
  const [tab, setTab] = useState('cartolas')

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 20px', fontFamily: 'system-ui, -apple-system, sans-serif', color: C.txt }}>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>
        <Link href="/procesos" style={{ color: C.sub, textDecoration: 'none' }}>← Procesos</Link> / Cobranza
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 2px' }}>Cobranza</h1>
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>Impago → pago o acción legal</div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid ' + C.line, marginBottom: 18 }}>
        {TABS.map(t => {
          const active = tab === t.k
          const base = {
            fontSize: 13, fontWeight: 600, padding: '9px 16px', cursor: 'pointer',
            border: 'none', background: 'none', borderBottom: active ? '2px solid ' + C.acento : '2px solid transparent',
            color: active ? C.txt : C.sub, position: 'relative', top: 1,
          }
          if (t.href) return <Link key={t.k} href={t.href} style={{ ...base, textDecoration: 'none' }}>{t.label}</Link>
          return (
            <button key={t.k} onClick={() => setTab(t.k)} style={base}>
              {t.label}{t.pronto ? <span style={{ fontSize: 10, color: C.sub, marginLeft: 5 }}>· pronto</span> : null}
            </button>
          )
        })}
      </div>

      {(tab === 'cartolas' || tab === 'inicios') && <VistaCobranza tipo={tab} />}
      {tab === 'bitacora' && (
        <div style={{ padding: 40, textAlign: 'center', color: C.sub, fontSize: 14 }}>Esta vista estará disponible próximamente.</div>
      )}
    </div>
  )
}

function VistaCobranza({ tipo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [verVigente, setVerVigente] = useState(true)
  const [verTermino, setVerTermino] = useState(true)

  useEffect(() => {
    let vivo = true
    setLoading(true); setError(null); setData(null)
    fetch('/api/cobranza?tipo=' + tipo)
      .then(r => r.json())
      .then(j => { if (!vivo) return; if (j.error) setError(j.error); else setData(j); setLoading(false) })
      .catch(e => { if (!vivo) return; setError(String(e)); setLoading(false) })
    return () => { vivo = false }
  }, [tipo])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{TITULO_TIPO[tipo]}</span>
        <span style={{ fontSize: 12, color: C.sub }}>· situación al {fechaHoraLocal(data?.generado)}</span>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: C.sub }}>Calculando saldos…</div>}
      {error && <div style={{ padding: 20, color: C.rojo, fontSize: 13 }}>Error: {error}</div>}

      {data && (() => {
        const filas = data.filas || []
        const rv = data.resumen?.vigente || {}
        const rt = data.resumen?.termino || {}
        const grupos = []
        if (verVigente) grupos.push({ g: 'vigente', titulo: 'Vigentes (S / SQ)', r: rv })
        if (verTermino) grupos.push({ g: 'termino', titulo: 'En término (Q)', r: rt })
        return (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 13 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={verVigente} onChange={e => setVerVigente(e.target.checked)} />
                Vigentes (S/SQ) · {rv.con_deuda || 0} con deuda
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={verTermino} onChange={e => setVerTermino(e.target.checked)} />
                En término (Q) · {rt.con_deuda || 0} con deuda
              </label>
            </div>

            {grupos.map(({ g, titulo, r }) => (
              <div key={g} style={{ marginBottom: 26 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{titulo}</h2>
                  <span style={{ fontSize: 12, color: C.sub }}>
                    {r.con_deuda || 0} con deuda · {r.al_dia || 0} al día · {r.sobrepago || 0} a revisar · deuda total {money(r.total_deuda)}
                  </span>
                </div>
                <Tabla filas={filas.filter(f => f.grupo === g)} tipo={tipo} />
              </div>
            ))}

            <div style={{ fontSize: 11, color: C.sub, marginTop: 8 }}>
              Umbral deuda: {money(data.parametros?.umbral)} · sobrepago a revisar: &gt; {money(data.parametros?.sobrepago)} a favor.
              Saldo corrido a la fecha de hoy (mismo cálculo que la Cartola).
            </div>
          </>
        )
      })()}
    </div>
  )
}

function Tabla({ filas, tipo }) {
  if (!filas.length) return <div style={{ padding: 16, color: C.sub, fontSize: 13 }}>Sin registros en este grupo.</div>

  const th = { fontSize: 11, fontWeight: 600, color: C.sub, textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid ' + C.line, whiteSpace: 'nowrap' }
  const td = { fontSize: 12, padding: '8px 10px', borderBottom: '0.5px solid ' + C.line, verticalAlign: 'top' }
  const esInicios = tipo === 'inicios'

  return (
    <div style={{ overflowX: 'auto', border: '0.5px solid ' + C.line, borderRadius: 8 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}>
        <thead>
          <tr>
            <th style={th}>IDADMON</th>
            <th style={th}>Propietario / Inmueble</th>
            <th style={th}>Arrendatario</th>
            <th style={{ ...th, textAlign: 'center' }}>Est.</th>
            <th style={{ ...th, textAlign: 'right' }}>Último abono</th>
            {esInicios && <th style={{ ...th, textAlign: 'right' }}>Últ. inicio</th>}
            <th style={{ ...th, textAlign: 'right' }}>Deuda</th>
            <th style={th}>Situación</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(f => {
            const esMoroso = f.clase === 'moroso'
            const esSobre = f.clase === 'sobrepago'
            const bg = f.clase === 'al_dia' ? C.verdeBg : (esSobre ? C.ambarBg : '#fff')
            const aviso = f.sin_cobrador
            return (
              <tr key={f.idadmon} style={{ background: bg, boxShadow: aviso ? 'inset 3px 0 0 ' + C.ambar : 'none' }}>
                <td style={{ ...td, fontWeight: 600 }}>{f.idadmon}</td>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{f.propietario || '—'}</div>
                  <div style={{ color: C.sub, fontSize: 11 }}>{f.inmueble || ''}</div>
                </td>
                <td style={{ ...td, color: C.sub }}>{f.arrendatario || '—'}</td>
                <td style={{ ...td, textAlign: 'center' }}>{f.estado || '—'}</td>
                <td style={{ ...td, textAlign: 'right', color: C.sub, fontVariantNumeric: 'tabular-nums' }}>{f.ultimo_abono || '—'}</td>
                {esInicios && <td style={{ ...td, textAlign: 'right', color: C.sub, fontVariantNumeric: 'tabular-nums' }}>{f.fecha_ultimo_inicio || '—'}</td>}
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: esSobre ? 700 : 600,
                  color: esMoroso ? C.rojo : (f.clase === 'al_dia' ? C.verde : C.ambar) }}>
                  {money(f.deuda)}
                </td>
                <td style={td}>
                  {esMoroso && <span style={{ color: C.rojo, fontWeight: 600 }}>Moroso</span>}
                  {f.clase === 'al_dia' && <span style={{ color: C.verde }}>Al día</span>}
                  {esSobre && <span style={{ color: C.ambar, fontWeight: 700 }}>Revisar · posible mala asignación</span>}
                  {aviso && <div style={{ color: C.ambar, fontSize: 11, fontWeight: 600, marginTop: 2 }}>⚠ Falta «quién cobra» en el LOG</div>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
