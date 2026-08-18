// RUTA: app/procesos/financiero/pagos/page.js
// VERSION: v1 · 2026-08-17 · Pagos recurrentes: estado del mes (por vencer / vencido / pagado), botón "Pagado"
//   (Alberto/Luis/Karina) con constancia de quién y cuándo, y alta/edición del catálogo (editable sin código).
//   Luis y Karina ven el estado; el aviso al entrar sale en /panel y /direccion.
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TopNav from '@/app/components/ui/TopNav'
import FinancieroNav from '@/app/components/ui/FinancieroNav'

const BADGE = {
  vencido:   { bg: '#FEE2E2', color: '#B91C1C', label: 'VENCIDO' },
  por_vencer:{ bg: '#FFEDD5', color: '#C2410C', label: 'Por vencer' },
  pagado:    { bg: '#DCFCE7', color: '#15803D', label: '✓ Pagado' },
  futuro:    { bg: '#F1F5F9', color: '#64748B', label: 'Al día' },
  inactivo:  { bg: '#F1EFE9', color: '#9C9A92', label: 'Inactivo' },
  sin_fecha: { bg: '#FEF9C3', color: '#A16207', label: 'Sin fecha' },
}
const clp = (n) => (n == null ? '' : '$' + Number(n).toLocaleString('es-CL'))
const VACIO = { id: null, proveedor: '', dia_venc: 15, periodicidad: 'mensual', meses_anual: '', monto: '', aviso_dias: 3, activo: true, nota: '' }

export default function PagosRecurrentesPage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState(null)   // objeto de edición/alta o null
  const [guardando, setGuardando] = useState(false)

  const cargar = async () => {
    setCargando(true)
    try { const r = await fetch('/api/pagos-recurrentes'); const d = await r.json(); if (d.error) setError(d.error); else { setData(d); setError(null) } }
    catch (e) { setError(String(e?.message || e)) }
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const puedeEscribir = !!data?.puedeEscribir

  async function marcar(it, pagado) {
    if (!puedeEscribir) return
    try {
      await fetch('/api/pagos-recurrentes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'marcar', pago_id: it.id, periodo: it.periodo, pagado, monto: it.monto }) })
      await cargar()
    } catch (e) { setError(String(e?.message || e)) }
  }
  async function guardarCatalogo() {
    if (!form?.proveedor?.trim()) { setError('Falta el proveedor'); return }
    setGuardando(true)
    try {
      const r = await fetch('/api/pagos-recurrentes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'guardar_catalogo', ...form }) })
      const d = await r.json()
      if (!d.ok) { setError(d.error || 'No se pudo guardar'); setGuardando(false); return }
      setForm(null); await cargar()
    } catch (e) { setError(String(e?.message || e)) }
    setGuardando(false)
  }
  async function desactivar(it) {
    if (!confirm(`¿Desactivar «${it.proveedor}»? Dejará de avisar (puedes reactivarlo editándolo).`)) return
    try { await fetch('/api/pagos-recurrentes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'borrar_catalogo', id: it.id }) }); await cargar() }
    catch (e) { setError(String(e?.message || e)) }
  }

  const th = { padding: '9px 10px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #E5E4DF' }
  const td = { padding: '9px 10px', fontSize: 12.5, color: '#2C2C2A', borderBottom: '1px solid #F0EFEA' }
  const inp = { fontSize: 12.5, padding: '7px 9px', borderRadius: 8, border: '1px solid #E0DED6', boxSizing: 'border-box' }
  const items = data?.items || []
  const pend = data?.pendientes || []

  return (
    <>
      <TopNav />
      <FinancieroNav activo="pagos" />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 24px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>Pagos recurrentes</h1>
            <div style={{ fontSize: 12.5, color: '#888780', marginTop: 2 }}>Recordatorio de vencimientos · hoy {data?.hoy || '—'}. Alberto marca «Pagado»; queda constancia para todos.</div>
          </div>
          {puedeEscribir && <button onClick={() => setForm({ ...VACIO })} style={{ fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: 'none', background: '#6b4423', color: '#fff', cursor: 'pointer' }}>＋ Añadir pago</button>}
        </div>

        {pend.length > 0 && (
          <div style={{ margin: '12px 0', padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#7F1D1D', fontSize: 12.5 }}>
            <b>{pend.length} pago(s) por atender:</b> {pend.map(p => `${p.proveedor} (${p.vence})`).join(' · ')}
          </div>
        )}
        {error && <div style={{ margin: '10px 0', padding: '9px 12px', borderRadius: 8, background: '#FBE9E7', border: '0.5px solid #F0C9C2', color: '#B23A3A', fontSize: 12.5 }}>{error}</div>}

        {/* Formulario alta/edición */}
        {form && (
          <div style={{ margin: '12px 0', padding: 14, borderRadius: 12, border: '1px solid #E7C9A0', background: '#FFFBF5' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6b4423', marginBottom: 10 }}>{form.id ? 'Editar pago' : 'Nuevo pago recurrente'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <label style={{ gridColumn: '1 / -1', fontSize: 11, color: '#5A5954' }}>Proveedor<input value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
              <label style={{ fontSize: 11, color: '#5A5954' }}>Día de vencimiento<input type="number" min="1" max="31" value={form.dia_venc} onChange={e => setForm({ ...form, dia_venc: e.target.value })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
              <label style={{ fontSize: 11, color: '#5A5954' }}>Periodicidad
                <select value={form.periodicidad} onChange={e => setForm({ ...form, periodicidad: e.target.value })} style={{ ...inp, width: '100%', marginTop: 3 }}>
                  <option value="mensual">Mensual</option><option value="anual">Anual</option>
                </select>
              </label>
              <label style={{ fontSize: 11, color: '#5A5954' }}>Meses (si anual, p.ej. 01,07)<input value={form.meses_anual || ''} onChange={e => setForm({ ...form, meses_anual: e.target.value })} placeholder="01,07" style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
              <label style={{ fontSize: 11, color: '#5A5954' }}>Monto (opcional)<input type="number" value={form.monto ?? ''} onChange={e => setForm({ ...form, monto: e.target.value })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
              <label style={{ fontSize: 11, color: '#5A5954' }}>Días de aviso antes<input type="number" min="0" value={form.aviso_dias} onChange={e => setForm({ ...form, aviso_dias: e.target.value })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
              <label style={{ gridColumn: '1 / -1', fontSize: 11, color: '#5A5954' }}>Nota<input value={form.nota || ''} onChange={e => setForm({ ...form, nota: e.target.value })} style={{ ...inp, width: '100%', marginTop: 3 }} /></label>
              <label style={{ fontSize: 11, color: '#5A5954', display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}><input type="checkbox" checked={form.activo !== false} onChange={e => setForm({ ...form, activo: e.target.checked })} /> Activo (avisa)</label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={guardarCatalogo} disabled={guardando} style={{ fontSize: 12.5, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer' }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
              <button onClick={() => setForm(null)} style={{ fontSize: 12.5, padding: '8px 16px', borderRadius: 8, border: '1px solid #E0DED6', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}

        <div style={{ border: '0.5px solid #E0DED6', borderRadius: 10, overflow: 'auto', background: '#fff', marginTop: 12 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5, minWidth: 900 }}>
            <thead><tr style={{ background: '#F1EFE9' }}>{['Proveedor', 'Periodicidad', 'Vence', 'Monto', 'Estado', 'Constancia', ''].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {cargando ? <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Cargando…</td></tr>
                : items.length === 0 ? <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Sin pagos configurados.</td></tr>
                  : items.map(it => {
                    const b = BADGE[it.estado] || BADGE.futuro
                    return (
                      <tr key={it.id} style={{ opacity: it.estado === 'inactivo' ? 0.55 : 1 }}>
                        <td style={{ ...td, fontWeight: 600 }}>{it.proveedor}{it.nota ? <div style={{ fontSize: 10.5, color: '#9C9A92', fontWeight: 400 }}>{it.nota}</div> : null}</td>
                        <td style={{ ...td, color: '#5A5954' }}>{it.periodicidad === 'anual' ? `Anual (${it.meses_anual || '—'})` : 'Mensual'} · día {it.dia_venc}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{it.vence || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(it.monto)}</td>
                        <td style={td}><span style={{ fontSize: 10.5, fontWeight: 700, color: b.color, background: b.bg, borderRadius: 6, padding: '2px 8px' }}>{b.label}</span></td>
                        <td style={{ ...td, fontSize: 11, color: '#5A5954' }}>{it.pagado_por ? `${it.pagado_por.split('@')[0]} · ${String(it.pagado_at || '').slice(0, 10)}` : '—'}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                          {puedeEscribir && it.periodo && (it.estado === 'pagado'
                            ? <button onClick={() => marcar(it, false)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, border: '1px solid #E0DED6', background: '#fff', cursor: 'pointer' }}>Deshacer</button>
                            : <button onClick={() => marcar(it, true)} style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer' }}>Pagado</button>)}
                          {puedeEscribir && <>
                            <button onClick={() => setForm({ id: it.id, proveedor: it.proveedor, dia_venc: it.dia_venc, periodicidad: it.periodicidad, meses_anual: it.meses_anual || '', monto: it.monto ?? '', aviso_dias: it.aviso_dias, activo: it.activo, nota: it.nota || '' })} style={{ marginLeft: 6, fontSize: 11, padding: '5px 8px', borderRadius: 7, border: '1px solid #E0DED6', background: '#fff', cursor: 'pointer' }}>Editar</button>
                            {it.activo && <button onClick={() => desactivar(it)} title="Desactivar" style={{ marginLeft: 6, fontSize: 11, padding: '5px 8px', borderRadius: 7, border: '1px solid #F0C9C2', background: '#fff', color: '#B23A3A', cursor: 'pointer' }}>✕</button>}
                          </>}
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 8 }}>
          El aviso al entrar sale en el Panel y en Dirección cuando hay pagos por vencer o vencidos. «Por vencer» = dentro de los días de aviso de cada pago. Anuales inactivos: edítalos para fijar la fecha real y activarlos.
        </div>
      </div>
    </>
  )
}
