'use client'
// VERSION: 2026-08-26 · Añadido "← Volver" (BotonVolver, history.back) — convención de retorno. Hereda versión previa.
// VERSION: v1 · 2026-08-15 · "Alberto" · Cuenta corriente del propietario de la empresa (Financiero).
//   Libro de movimientos que afectan al dinero/deuda entre la empresa (FCR) y Alberto: aportes, retiros,
//   gastos que la empresa le debe, devoluciones, ajustes… Columnas: Fecha · Tipo · Descripción · Procedencia ·
//   Destino · Debe · Haber · Saldo (corrido) · Referencia · Estado. Convenio: HABER aumenta lo que la empresa
//   le debe; DEBE lo reduce; Saldo = Σ(Haber − Debe) = lo que la empresa le debe. Alta/edición/anular (auditado
//   por registrado_por), saldo corrido (excluye anuladas) y exportación a Excel. De aquí saldrán los asientos.
//   Escritura: Dirección + Alberto/Luis/Karina. Requiere tabla `cuenta_alberto` y /api/financiero/alberto.

import { useSession } from 'next-auth/react'
import BotonVolver from '../../../components/ui/BotonVolver'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import TopNav from '@/app/components/ui/TopNav'
import FinancieroNav from '@/app/components/ui/FinancieroNav'

const num = (v) => { const n = Math.round(Number(String(v ?? '').replace(/[^\d.-]/g, ''))); return Number.isFinite(n) ? n : 0 }
const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(Number(n) || 0)).toLocaleString('es-CL')
const fmtFecha = (iso) => { const m = String(iso || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '') }
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const TIPOS = ['Aporte', 'Retiro', 'Gasto asumido por Alberto', 'Pago de la empresa', 'Devolución', 'Ajuste']
const VACIO = { fecha: '', tipo: '', descripcion: '', procedencia: '', destino: '', debe: '', haber: '', referencia: '', estado: 'pendiente' }

export default function CuentaAlbertoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [movs, setMovs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [puedeEditar, setPuedeEditar] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(VACIO)
  const [editId, setEditId] = useState(null)      // null = alta; id = edición
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState(null)

  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  const cargar = () => {
    setLoading(true); setError(null)
    fetch('/api/financiero/alberto').then(r => r.json()).then(d => {
      if (d.error) { setError(d.error); setMovs([]) }
      else { setMovs(d.movimientos || []); setPuedeEditar(!!d.puedeEditar) }
    }).catch(e => setError(String(e))).finally(() => setLoading(false))
  }
  useEffect(() => { if (status === 'authenticated') cargar() }, [status])   // eslint-disable-line

  // Saldo corrido: excluye anuladas. Saldo = Σ(haber − debe). Orden: el que devuelve el API (fecha, id).
  const conSaldo = useMemo(() => {
    let s = 0
    return (movs || []).map(m => {
      if (m.anulado) return { ...m, _saldo: null }
      s += num(m.haber) - num(m.debe)
      return { ...m, _saldo: s }
    })
  }, [movs])

  const saldoActual = useMemo(() => (movs || []).filter(m => !m.anulado).reduce((a, m) => a + num(m.haber) - num(m.debe), 0), [movs])
  const totDebe = useMemo(() => (movs || []).filter(m => !m.anulado).reduce((a, m) => a + num(m.debe), 0), [movs])
  const totHaber = useMemo(() => (movs || []).filter(m => !m.anulado).reduce((a, m) => a + num(m.haber), 0), [movs])

  const abrirAlta = () => { setEditId(null); setForm({ ...VACIO, fecha: hoyISO() }); setFormErr(null); setFormOpen(true) }
  const abrirEdicion = (m) => {
    setEditId(m.id)
    setForm({ fecha: String(m.fecha || '').slice(0, 10), tipo: m.tipo || '', descripcion: m.descripcion || '', procedencia: m.procedencia || '', destino: m.destino || '', debe: m.debe ? String(m.debe) : '', haber: m.haber ? String(m.haber) : '', referencia: m.referencia || '', estado: m.estado || 'pendiente' })
    setFormErr(null); setFormOpen(true)
  }

  const guardar = async () => {
    if (!form.fecha) { setFormErr('Falta la fecha.'); return }
    if (num(form.debe) === 0 && num(form.haber) === 0) { setFormErr('Pon un importe en Debe o en Haber.'); return }
    setSaving(true); setFormErr(null)
    try {
      const method = editId ? 'PUT' : 'POST'
      const body = editId ? { id: editId, ...form } : { ...form }
      const res = await fetch('/api/financiero/alberto', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) { setFormErr(d.error || 'No se pudo guardar.'); setSaving(false); return }
      setFormOpen(false); setSaving(false); cargar()
    } catch { setFormErr('Error de conexión'); setSaving(false) }
  }

  const anular = async (m) => {
    if (!confirm(m.anulado ? '¿Reactivar este movimiento?' : '¿Anular este movimiento? (reversible, deja de contar en el saldo)')) return
    const res = await fetch('/api/financiero/alberto', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, soloAnulado: true, anulado: !m.anulado }) })
    const d = await res.json()
    if (!res.ok) { setError(d.error || 'No se pudo anular.'); return }
    cargar()
  }

  const exportarExcel = async () => {
    if (!movs.length) return
    const XLSX = await import('xlsx')
    let s = 0
    const salida = movs.map(m => {
      const anul = !!m.anulado
      if (!anul) s += num(m.haber) - num(m.debe)
      return {
        Fecha: fmtFecha(m.fecha), Tipo: m.tipo || '', Descripción: m.descripcion || '',
        Procedencia: m.procedencia || '', Destino: m.destino || '',
        Debe: num(m.debe) || '', Haber: num(m.haber) || '', Saldo: anul ? '' : s,
        Referencia: m.referencia || '', Estado: m.estado || '', Anulado: anul ? 'SÍ' : '',
        'Registrado por': m.registrado_por || '',
      }
    })
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(salida)
    XLSX.utils.book_append_sheet(wb, ws, 'Cuenta Alberto')
    const hoy = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `Cuenta_Alberto_${hoy}.xlsx`)
  }

  const th = { padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '.03em', borderBottom: '1px solid #E3E1D8', whiteSpace: 'nowrap', background: '#FAFAF8', position: 'sticky', top: 0, zIndex: 2 }
  const td = { padding: '7px 10px', fontSize: 12, color: '#2C2C2A', borderBottom: '0.5px solid #EDEBE4', verticalAlign: 'top' }
  const numTd = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

  return (
    <>
      <TopNav />
      <BotonVolver />
      <FinancieroNav activo="alberto" />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 20px 40px' }}>

        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 2px', color: '#2C2C2A' }}>Alberto · Cuenta corriente</h1>
            <div style={{ fontSize: 12, color: '#888780', maxWidth: 720 }}>
              Movimientos entre la empresa y Alberto (aportes, retiros, gastos asumidos, devoluciones, ajustes…).
              Convenio: <b>Haber</b> aumenta lo que la empresa le debe · <b>Debe</b> lo reduce · <b>Saldo</b> = lo que la empresa le debe. De aquí saldrán los asientos.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {puedeEditar && (
              <button onClick={abrirAlta}
                style={{ fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: '0.5px solid #1D9E75', background: '#EAF7F1', color: '#0F6D4E', cursor: 'pointer' }}>
                ➕ Nuevo movimiento
              </button>
            )}
            <button onClick={exportarExcel} disabled={!movs.length}
              style={{ fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: '0.5px solid #1c7d3f', background: movs.length ? '#EAF7EF' : '#eee', color: movs.length ? '#1c7d3f' : '#aaa', cursor: movs.length ? 'pointer' : 'default' }}>
              ⭳ Exportar Excel ({movs.length})
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
          <div style={{ border: '1px solid #E3E1D8', borderRadius: 12, padding: '12px 16px', background: '#fff' }}>
            <div style={{ fontSize: 11, color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em' }}>Saldo actual</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: saldoActual >= 0 ? '#085041' : '#9B1C1C' }}>{money(saldoActual)}</div>
            <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>{saldoActual >= 0 ? 'la empresa le debe' : 'a favor de la empresa'}</div>
          </div>
          <div style={{ border: '1px solid #E3E1D8', borderRadius: 12, padding: '12px 16px', background: '#fff' }}>
            <div style={{ fontSize: 11, color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total Haber</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: '#085041' }}>{money(totHaber)}</div>
          </div>
          <div style={{ border: '1px solid #E3E1D8', borderRadius: 12, padding: '12px 16px', background: '#fff' }}>
            <div style={{ fontSize: 11, color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total Debe</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: '#9B1C1C' }}>{money(totDebe)}</div>
          </div>
          <div style={{ border: '1px solid #E3E1D8', borderRadius: 12, padding: '12px 16px', background: '#fff' }}>
            <div style={{ fontSize: 11, color: '#888780', textTransform: 'uppercase', letterSpacing: '.04em' }}>Movimientos</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: '#2C2C2A' }}>{movs.filter(m => !m.anulado).length}</div>
          </div>
        </div>

        {error && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FDECEC', border: '0.5px solid #F1B0B0', color: '#9B1C1C', fontSize: 12 }}>{error}</div>}

        {/* Tabla */}
        <div style={{ border: '1px solid #E3E1D8', borderRadius: 12, overflow: 'auto', maxHeight: '68vh', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 1080 }}>
            <thead>
              <tr>
                <th style={th}>Fecha</th>
                <th style={th}>Tipo</th>
                <th style={th}>Descripción</th>
                <th style={th}>Procedencia</th>
                <th style={th}>Destino</th>
                <th style={{ ...th, textAlign: 'right' }}>Debe</th>
                <th style={{ ...th, textAlign: 'right' }}>Haber</th>
                <th style={{ ...th, textAlign: 'right' }}>Saldo</th>
                <th style={th}>Referencia</th>
                <th style={th}>Estado</th>
                {puedeEditar && <th style={{ ...th, textAlign: 'center' }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={puedeEditar ? 11 : 10} style={{ padding: 30, textAlign: 'center', color: '#888780', fontSize: 13 }}>Cargando…</td></tr>
              ) : conSaldo.length === 0 ? (
                <tr><td colSpan={puedeEditar ? 11 : 10} style={{ padding: 30, textAlign: 'center', color: '#888780', fontSize: 13 }}>Sin movimientos todavía. {puedeEditar && 'Pulsa "Nuevo movimiento" para empezar.'}</td></tr>
              ) : conSaldo.map(m => {
                const anul = !!m.anulado
                const strike = anul ? { textDecoration: 'line-through', color: '#B4B2A9' } : {}
                return (
                  <tr key={m.id} style={{ background: anul ? '#FBFAF7' : '#fff' }}>
                    <td style={{ ...td, whiteSpace: 'nowrap', ...strike }}>{fmtFecha(m.fecha)}</td>
                    <td style={{ ...td, ...strike }}>{m.tipo || '—'}{anul && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#9B1C1C', background: '#FDECEC', borderRadius: 4, padding: '0 5px' }}>ANULADO</span>}</td>
                    <td style={{ ...td, ...strike, minWidth: 180 }}>{m.descripcion || '—'}</td>
                    <td style={{ ...td, ...strike }}>{m.procedencia || '—'}</td>
                    <td style={{ ...td, ...strike }}>{m.destino || '—'}</td>
                    <td style={{ ...numTd, color: anul ? '#B4B2A9' : '#9B1C1C' }}>{num(m.debe) ? num(m.debe).toLocaleString('es-CL') : '—'}</td>
                    <td style={{ ...numTd, color: anul ? '#B4B2A9' : '#085041' }}>{num(m.haber) ? num(m.haber).toLocaleString('es-CL') : '—'}</td>
                    <td style={{ ...numTd, fontWeight: 600, color: m._saldo == null ? '#B4B2A9' : (m._saldo < 0 ? '#9B1C1C' : '#2C2C2A') }}>{m._saldo == null ? '—' : m._saldo.toLocaleString('es-CL')}</td>
                    <td style={{ ...td, ...strike }}>{m.referencia || '—'}</td>
                    <td style={td}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: m.estado === 'contabilizado' ? '#E1F5EE' : '#FEF3C7', color: m.estado === 'contabilizado' ? '#085041' : '#92400E' }}>{m.estado || 'pendiente'}</span>
                    </td>
                    {puedeEditar && (
                      <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {!anul && <button onClick={() => abrirEdicion(m)} title="Editar" style={{ border: '0.5px solid #D3D1C7', background: '#fff', borderRadius: 5, cursor: 'pointer', color: '#0C447C', fontSize: 11, padding: '2px 8px', marginRight: 4 }}>editar</button>}
                        <button onClick={() => anular(m)} title={anul ? 'Reactivar' : 'Anular'} style={{ border: '0.5px solid ' + (anul ? '#B4D8CB' : '#E7B4B4'), background: '#fff', borderRadius: 5, cursor: 'pointer', color: anul ? '#085041' : '#9B1C1C', fontSize: 11, padding: '2px 8px' }}>{anul ? 'reactivar' : 'anular'}</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: '#888780', marginTop: 8 }}>
          {movs.filter(m => !m.anulado).length} movimiento(s) activos · saldo corrido = Σ(Haber − Debe), sin líneas anuladas.
        </div>
      </div>

      {/* Modal alta / edición */}
      {formOpen && (
        <>
          <div onClick={() => !saving && setFormOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9000 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(560px, 96vw)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 9001, padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2A', marginBottom: 12 }}>{editId ? 'Editar movimiento' : 'Nuevo movimiento'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <L label="Fecha"><input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} style={inp} /></L>
              <L label="Tipo"><input list="alberto-tipos" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} placeholder="Aporte, Retiro…" style={inp} />
                <datalist id="alberto-tipos">{TIPOS.map(t => <option key={t} value={t} />)}</datalist>
              </L>
              <L label="Descripción" full><input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Qué es este movimiento" style={inp} /></L>
              <L label="Procedencia"><input value={form.procedencia} onChange={e => setForm(f => ({ ...f, procedencia: e.target.value }))} placeholder="De dónde viene" style={inp} /></L>
              <L label="Destino"><input value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} placeholder="A dónde va" style={inp} /></L>
              <L label="Debe (reduce la deuda)"><input inputMode="numeric" value={form.debe} onChange={e => setForm(f => ({ ...f, debe: e.target.value }))} placeholder="0" style={{ ...inp, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }} /></L>
              <L label="Haber (aumenta la deuda)"><input inputMode="numeric" value={form.haber} onChange={e => setForm(f => ({ ...f, haber: e.target.value }))} placeholder="0" style={{ ...inp, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }} /></L>
              <L label="Referencia"><input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} placeholder="Nº transferencia / documento" style={inp} /></L>
              <L label="Estado"><select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} style={inp}><option value="pendiente">pendiente</option><option value="contabilizado">contabilizado</option></select></L>
            </div>
            {formErr && <div style={{ fontSize: 12, color: '#9B1C1C', marginTop: 10 }}>{formErr}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button onClick={() => setFormOpen(false)} disabled={saving} style={{ fontSize: 13, padding: '8px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: '#5F5E5A', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#B4D8CB' : '#1D9E75', color: '#fff', cursor: saving ? 'default' : 'pointer' }}>{saving ? 'Guardando…' : (editId ? 'Guardar cambios' : 'Añadir')}</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

const inp = { width: '100%', marginTop: 4, fontSize: 13, padding: '7px 9px', border: '0.5px solid #B4B2A9', borderRadius: 8, boxSizing: 'border-box' }
function L({ label, full, children }) {
  return (
    <label style={{ fontSize: 11, color: '#888780', display: 'block', gridColumn: full ? '1 / -1' : 'auto' }}>
      {label}
      {children}
    </label>
  )
}
