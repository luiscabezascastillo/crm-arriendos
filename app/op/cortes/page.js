// VERSION: 2026-08-26 · Añadido "← Volver" (BotonVolver, history.back) — convención de retorno. Hereda versión previa.
// VERSION: v1 · 2026-08-23 · Página "Cortes de servicios" (plan B). Lista los cortes tomados (GET
//   /api/servicios/cortes) y permite TOMAR un corte nuevo (POST action:'tomar') con selector de fecha y nota:
//   copia la foto actual del mes de ggcc_agua_luz a ggcc_cortes_datos. No toca la tabla viva.
'use client'
import { useState, useEffect } from 'react'
import BotonVolver from '../../components/ui/BotonVolver'
import TopNav from '@/app/components/ui/TopNav'

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }
const th = { textAlign: 'left', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', padding: '6px 10px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }
const td = { fontSize: 13, color: '#374151', padding: '6px 10px', borderBottom: '.5px solid #f3f4f6' }
const input = { padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit' }

export default function CortesServiciosPage() {
  const [cortes, setCortes] = useState([])
  const [loading, setLoading] = useState(true)
  const [aamm, setAamm] = useState('2608')
  const [fecha, setFecha] = useState(() => new Date().toISOString().substring(0, 10))
  const [nota, setNota] = useState('')
  const [tomando, setTomando] = useState(false)
  const [msg, setMsg] = useState(null)

  async function cargar() {
    setLoading(true)
    try {
      const r = await fetch('/api/servicios/cortes')
      const j = await r.json()
      if (!r.ok || j.error) throw new Error(j.error || ('Error ' + r.status))
      setCortes(j.cortes || [])
    } catch (e) { setMsg({ tipo: 'error', txt: String(e?.message || e) }) }
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  async function tomar() {
    const a = (aamm || '').trim()
    if (!a) { setMsg({ tipo: 'error', txt: 'Indica el periodo (AAMM, p.ej. 2608).' }); return }
    if (!window.confirm(`Tomar una FOTO (corte) del periodo ${a} con fecha ${fecha}.\nCopia el estado actual de la tabla viva; no la modifica. ¿Continuar?`)) return
    setTomando(true); setMsg(null)
    try {
      const r = await fetch('/api/servicios/cortes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tomar', aamm: a, fecha, nota: nota || undefined }),
      })
      const j = await r.json()
      if (!r.ok || j.error) { setMsg({ tipo: 'error', txt: j.error || ('Error ' + r.status) }) }
      else { setMsg({ tipo: 'ok', txt: `✓ Corte ${j.corte} tomado del periodo ${j.aamm} (fecha ${j.fecha}) — ${j.filas} filas congeladas.` }); setNota(''); await cargar() }
    } catch (e) { setMsg({ tipo: 'error', txt: String(e?.message || e) }) }
    setTomando(false)
  }

  const porAamm = {}
  for (const c of cortes) (porAamm[c.aamm] = porAamm[c.aamm] || []).push(c)
  const aamms = Object.keys(porAamm).sort().reverse()

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <TopNav />
      <BotonVolver />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 24px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Cortes de servicios</h1>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 0, marginBottom: 16 }}>
          Cada corte es una <b>foto congelada</b> de la GGCC/agua/luz/gas del mes (para seguir la evolución dentro
          del mes). Tomar un corte copia el estado actual de la tabla viva a <code>ggcc_cortes_datos</code>; no la modifica.
        </p>

        {/* Tomar corte */}
        <div style={{ ...card, marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Tomar corte</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ fontSize: 11, color: '#6b7280' }}>Periodo (AAMM)<br />
              <input style={{ ...input, width: 90, marginTop: 4 }} value={aamm} onChange={e => setAamm(e.target.value)} placeholder="2608" />
            </label>
            <label style={{ fontSize: 11, color: '#6b7280' }}>Fecha del corte<br />
              <input type="date" style={{ ...input, marginTop: 4 }} value={fecha} onChange={e => setFecha(e.target.value)} />
            </label>
            <label style={{ fontSize: 11, color: '#6b7280', flex: 1, minWidth: 160 }}>Nota (opcional)<br />
              <input style={{ ...input, width: '100%', marginTop: 4 }} value={nota} onChange={e => setNota(e.target.value)} placeholder="p.ej. semana 3" />
            </label>
            <button onClick={tomar} disabled={tomando}
              style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: tomando ? '#cbd5e1' : '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: tomando ? 'default' : 'pointer' }}>
              {tomando ? 'Tomando…' : '📸 Tomar corte'}
            </button>
          </div>
          {msg && <div style={{ marginTop: 12, fontSize: 13, color: msg.tipo === 'ok' ? '#16a34a' : '#b91c1c', fontWeight: 600 }}>{msg.txt}</div>}
        </div>

        {/* Cortes existentes */}
        <div style={{ ...card }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Cortes tomados</div>
            <button onClick={cargar} disabled={loading} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7, border: '1px solid #0891b2', background: '#ecfeff', color: '#0891b2', cursor: 'pointer', fontFamily: 'inherit' }}>{loading ? 'Cargando…' : '↻ Actualizar'}</button>
          </div>
          {loading && !cortes.length ? <div style={{ fontSize: 13, color: '#888' }}>Cargando…</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Periodo</th><th style={th}>Mes</th><th style={th}>Cortes</th></tr></thead>
                <tbody>
                  {aamms.map(a => {
                    const cs = porAamm[a].sort((x, y) => x.corte - y.corte)
                    return (
                      <tr key={a}>
                        <td style={td}><b>{a}</b></td>
                        <td style={td}>{cs[0]?.mes || ''}</td>
                        <td style={td}>{cs.map(c => `#${c.corte} (${c.fecha})`).join('  ·  ')}</td>
                      </tr>
                    )
                  })}
                  {!aamms.length && <tr><td style={td} colSpan={3}>Aún no hay cortes.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
