// VERSION: v2 · 2026-08-24 · Explicacion inicial (COVID, solo S/SQ/Q, negativos->A00000; Karina lidera/Adalis colidera).
// VERSION: v1 · 2026-08-24 · Panel "Cartolas a auditar": deuda grande (bajo cobranza) + saldo a favor
//   (posible abono mal asignado), con Tipo, Seguimiento (Karina/Direccion) y Acciones/Notas.
//   Adalis/Fabiola VEN y SUGIEREN; el trio (Alberto/Luis/Karina) hace seguimiento y registra acciones.
//   Lee /api/cobranza/saldos-favor (v3). NO mueve dinero.
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import TopNav from '@/app/components/ui/TopNav'

const VERDE = '#085041', BORDE = '#E5E4DF', TENUE = '#888780', ROJO = '#B23A3A', AZUL = '#1D4ED8', AMBAR = '#B8860B'
const clp = (n) => '$' + (Number(n) || 0).toLocaleString('es-CL')
const EST = {
  pendiente: { lb: 'Pendiente', c: AMBAR, bg: '#FBF7EC' },
  en_curso: { lb: 'En curso', c: AZUL, bg: '#EEF4FF' },
  resuelto: { lb: 'Resuelto', c: VERDE, bg: '#E9F4E4' },
}

export default function AuditarPage() {
  const { status } = useSession()
  const router = useRouter()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [abierto, setAbierto] = useState(null)
  const [notaTxt, setNotaTxt] = useState('')
  const [notaAccion, setNotaAccion] = useState(false)
  const [segEstado, setSegEstado] = useState('pendiente')
  const [segTxt, setSegTxt] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { if (status === 'unauthenticated') router.push('/') }, [status, router])

  function cargar() {
    fetch('/api/cobranza/saldos-favor')
      .then(r => r.json())
      .then(j => { if (j.error) setError(j.error); else { setData(j); setError(null) }; setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }
  useEffect(() => { if (status === 'authenticated') cargar() }, [status]) // eslint-disable-line

  const puedeSeg = !!(data && data.puedeSeguimiento)
  const aud = (id) => (data && data.auditoria && data.auditoria[id]) || null
  const notas = (id) => (data && data.sugerencias && data.sugerencias[id]) || []

  function abrir(id) {
    if (abierto === id) { setAbierto(null); return }
    const a = aud(id) || {}
    setAbierto(id); setSegEstado(a.estado || 'pendiente'); setSegTxt(a.seguimiento || ''); setNotaTxt(''); setNotaAccion(false)
  }
  async function guardarSeg(id) {
    setGuardando(true)
    await fetch('/api/cobranza/saldos-favor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'seguimiento', idadmon: id, estado: segEstado, seguimiento: segTxt }) }).then(r => r.json()).catch(() => {})
    setGuardando(false); cargar()
  }
  async function enviarNota(id) {
    if (!notaTxt.trim()) return
    setGuardando(true)
    await fetch('/api/cobranza/saldos-favor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idadmon: id, texto: notaTxt, tipo: notaAccion ? 'accion' : 'sugerencia' }) }).then(r => r.json()).catch(() => {})
    setGuardando(false); setNotaTxt(''); cargar()
  }
  async function atender(nid) {
    await fetch('/api/cobranza/saldos-favor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'atender', id: nid }) }).then(r => r.json()).catch(() => {})
    cargar()
  }

  const th = { fontSize: 11, fontWeight: 600, color: TENUE, textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid ' + BORDE, whiteSpace: 'nowrap', background: '#FBFBF9' }
  const td = { fontSize: 12, padding: '8px 10px', borderBottom: '0.5px solid ' + BORDE, verticalAlign: 'top' }

  const chipTipo = (f) => (
    f.tipo === 'deuda_alta'
      ? <span style={{ fontSize: 10, fontWeight: 700, color: ROJO, background: '#FBE9E7', border: '1px solid #F0CFCB', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>🔴 Deuda</span>
      : <span style={{ fontSize: 10, fontWeight: 700, color: AZUL, background: '#EEF4FF', border: '1px solid #CFE0FF', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>🔵 A favor</span>
  )

  const renderFila = (f) => {
    const a = aud(f.idadmon)
    const est = (a && a.estado) || 'pendiente'
    const e = EST[est] || EST.pendiente
    const lista = notas(f.idadmon)
    const abiertas = lista.filter(x => !x.atendida).length
    const open = abierto === f.idadmon
    return (
      <>
        <tr key={f.idadmon}>
          <td style={{ ...td, fontWeight: 600 }}>
            <a href={'/procesos/cartolas?idadmon=' + encodeURIComponent(f.idadmon)} target="_blank" rel="noopener noreferrer" style={{ color: '#185FA5', textDecoration: 'none' }}>{f.idadmon}</a>
          </td>
          <td style={td}>{f.propietario || '—'}</td>
          <td style={{ ...td, color: TENUE }}>{f.inmueble || '—'}</td>
          <td style={td}>{f.arrendatario || '—'}</td>
          <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: f.tipo === 'deuda_alta' ? ROJO : '#9a6b00', fontVariantNumeric: 'tabular-nums' }}>{clp(Math.abs(f.saldo))}</td>
          <td style={td}>{chipTipo(f)}{f.mismo_piso && f.mismo_piso.length > 0 && <div style={{ fontSize: 9, color: AMBAR, marginTop: 3 }}>⚠ mismo piso</div>}</td>
          <td style={td}><span style={{ fontSize: 10, fontWeight: 700, color: e.c, background: e.bg, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>{e.lb}</span></td>
          <td style={{ ...td, textAlign: 'center' }}>
            <button onClick={() => abrir(f.idadmon)} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 6, cursor: 'pointer', border: '1px solid ' + (abiertas ? '#CFE0FF' : BORDE), background: abiertas ? '#EEF4FF' : '#fff', color: abiertas ? AZUL : TENUE, fontWeight: 600 }}>💬 {lista.length || '+'}</button>
          </td>
        </tr>
        {open && (
          <tr key={f.idadmon + '-x'}>
            <td colSpan={8} style={{ ...td, background: '#FBFBF9' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: TENUE, marginBottom: 6 }}>SEGUIMIENTO (Karina/Dirección)</div>
                  {puedeSeg ? (
                    <>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                        <select value={segEstado} onChange={e => setSegEstado(e.target.value)} style={{ fontSize: 12, padding: '5px 8px', border: '1px solid ' + BORDE, borderRadius: 6 }}>
                          <option value="pendiente">Pendiente</option><option value="en_curso">En curso</option><option value="resuelto">Resuelto</option>
                        </select>
                        <button onClick={() => guardarSeg(f.idadmon)} disabled={guardando} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: 'none', background: VERDE, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Guardar</button>
                      </div>
                      <textarea value={segTxt} onChange={e => setSegTxt(e.target.value)} placeholder="Estado del caso / qué se está haciendo…" style={{ width: '100%', height: 60, fontSize: 12, padding: '7px 9px', border: '1px solid ' + BORDE, borderRadius: 6, boxSizing: 'border-box', resize: 'vertical' }} />
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: '#444' }}>{(a && a.seguimiento) || <span style={{ color: TENUE }}>Sin seguimiento aún.</span>}</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: TENUE, marginBottom: 6 }}>SUGERENCIAS / ACCIONES</div>
                  {lista.map(x => (
                    <div key={x.id} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #F0EFEA', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: x.atendida ? TENUE : '#333', textDecoration: x.atendida ? 'line-through' : 'none' }}>
                        <b>{x.tipo === 'accion' ? '⚙' : '💡'} {String(x.autor || '').split('@')[0]}:</b> {x.texto}
                      </span>
                      {puedeSeg && !x.atendida && <button onClick={() => atender(x.id)} style={{ fontSize: 10, border: 'none', background: 'none', color: VERDE, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>✓</button>}
                    </div>
                  ))}
                  {!lista.length && <div style={{ fontSize: 12, color: TENUE, marginBottom: 4 }}>Sin notas.</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input value={notaTxt} onChange={e => setNotaTxt(e.target.value)} placeholder={notaAccion ? 'Acción realizada…' : 'Sugerencia para Karina…'} style={{ flex: 1, fontSize: 12, padding: '6px 9px', border: '1px solid ' + BORDE, borderRadius: 6 }} />
                    <button onClick={() => enviarNota(f.idadmon)} disabled={guardando || !notaTxt.trim()} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: 'none', background: (guardando || !notaTxt.trim()) ? '#ccc' : '#1D9E75', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Enviar</button>
                  </div>
                  {puedeSeg && <label style={{ fontSize: 11, color: TENUE, display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, cursor: 'pointer' }}><input type="checkbox" checked={notaAccion} onChange={e => setNotaAccion(e.target.checked)} /> registrar como acción de auditoría</label>}
                </div>
              </div>
            </td>
          </tr>
        )}
      </>
    )
  }

  const seccion = (titulo, filas, resumen, colorTot) => (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1A1A17' }}>{titulo}</h2>
        <span style={{ fontSize: 12, color: TENUE }}>{resumen.n} contratos · total <b style={{ color: colorTot }}>{clp(Math.abs(resumen.total))}</b></span>
      </div>
      {filas.length === 0 ? <div style={{ fontSize: 13, color: TENUE }}>Sin casos.</div> : (
        <div style={{ border: '1px solid ' + BORDE, borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr>
              <th style={th}>IDADMON</th><th style={th}>Propietario</th><th style={th}>Inmueble</th><th style={th}>Arrendatario</th>
              <th style={{ ...th, textAlign: 'right' }}>Importe</th><th style={th}>Tipo</th><th style={th}>Seguimiento</th><th style={{ ...th, textAlign: 'center' }}>Notas</th>
            </tr></thead>
            <tbody>{filas.map(renderFila)}</tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <TopNav />
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 20px 80px' }}>
        <div style={{ fontSize: 13, color: TENUE, marginBottom: 4 }}>
          <span style={{ cursor: 'pointer', color: VERDE }} onClick={() => router.push('/procesos/cartolas')}>← Cartolas</span> · Cartolas a auditar
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1A1A17', margin: '0 0 4px' }}>Cartolas a auditar</h1>
        <div style={{ fontSize: 13, color: '#1A1A17', background: '#FBF7EC', border: '1px solid #EADFBD', borderRadius: 10, padding: '14px 16px', marginBottom: 18, lineHeight: 1.55 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Cómo abordar esta auditoría · Karina lidera, Adalis colidera</div>
          Un saldo a favor del arrendatario casi nunca es real: <b>nadie paga de más</b>. Lo que hubo fue la época COVID, con precios especiales, y en aquel momento no se registraba bien; así que un negativo casi siempre es un <b>abono mal anotado</b> (o de otro contrato). Solo nos interesan los contratos <b>S, SQ y Q</b>. Empezad por los de <b>saldo negativo</b> (a favor).
          <div style={{ marginTop: 8 }}>Plan para esta semana: <b>una hora diaria</b> de reunión entre vosotras para ver los casos, y <b>otra hora</b> para analizarlos y, al final, <b>modificar o pasar el abono sospechoso al buffer A00000</b> (eso solo Karina). Todo es reversible: lo del A00000 se devuelve a su IDADMON cuando aparezca el correcto.</div>
          <div style={{ marginTop: 8, color: TENUE }}>Adalis y Fabiola: podéis <b>ver</b> y <b>sugerir</b> (💡); los cambios en la cartola los hace Karina.</div>
        </div>
        {loading && <div style={{ padding: 30, color: TENUE }}>Calculando…</div>}
        {error && <div style={{ padding: 16, color: ROJO, fontSize: 13 }}>Error: {error}</div>}
        {data && (
          <>
            {seccion('Deuda grande (bajo cobranza) · > ' + clp(data.umbralDeuda), data.deuda, data.resumen.deuda, ROJO)}
            {seccion('Saldo a favor · Vigentes (S / SQ)', data.vigente, data.resumen.vigente, '#9a6b00')}
            {seccion('Saldo a favor · En término (Q)', data.termino, data.resumen.termino, '#9a6b00')}
          </>
        )}
      </div>
    </div>
  )
}
