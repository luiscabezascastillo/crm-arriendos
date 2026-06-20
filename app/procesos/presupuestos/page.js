'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']

// normaliza texto para buscar sin tildes ni mayusculas
const norm = s => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

const fmtPesos = n => {
  const v = Number(n)
  if (isNaN(v)) return '—'
  return '$' + v.toLocaleString('es-CL')
}
const fmtFecha = s => {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// linea con totales recalculados
function calcLinea(l) {
  const cant = Number(l.cantidad) || 0
  const cu = Number(l.coste_unit) || 0
  const base = cant * cu
  const iva = Math.round(base * 0.19)
  return { ...l, base_imponible: base, iva, total: base + iva }
}
const LINEA_VACIA = { descripcion: '', cantidad: '', coste_unit: '', base_imponible: 0, iva: 0, total: 0 }

function hoyISO() { return new Date().toISOString().slice(0, 10) }

const FORM_VACIO = {
  numero: '', fecha: hoyISO(), id_admon_new: '', id_admon_old: '',
  ubicacion: '', propietario: '', descripcion: '',
}

export default function PresupuestosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role

  const [accesoOk, setAccesoOk] = useState(null) // null = verificando · true/false
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState(null) // null = listado; {} o {...} = form
  const [form, setForm] = useState(FORM_VACIO)
  const [lineas, setLineas] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  // Acceso: admin (Direccion) o quien tenga permiso ACTIVO del proceso 'presupuestos'
  useEffect(() => {
    if (status !== 'authenticated' || !email) return
    if (rol === 'admin' || DIRECCION_EMAILS.includes(email)) { setAccesoOk(true); return }
    supabase
      .from('proceso_permisos')
      .select('proceso')
      .eq('email', email)
      .eq('proceso', 'presupuestos')
      .eq('activo', true)
      .limit(1)
      .then(({ data }) => setAccesoOk(!!(data && data.length)))
  }, [status, email, rol])

  useEffect(() => { if (accesoOk === false) router.replace('/') }, [accesoOk, router])
  useEffect(() => { if (accesoOk === true) cargar() }, [accesoOk])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('presupuestos')
      .select('id, numero, fecha, id_admon_new, id_admon_old, ubicacion, propietario, descripcion, neto, iva, total')
      .order('id', { ascending: false })
    if (!error) setLista(data || [])
    setLoading(false)
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // ── líneas ──
  function setLinea(i, k, v) {
    setLineas(ls => ls.map((l, j) => j === i ? calcLinea({ ...l, [k]: v }) : l))
  }
  function agregarLinea() { setLineas(ls => [...ls, { ...LINEA_VACIA }]) }
  function quitarLinea(i) { setLineas(ls => ls.filter((_, j) => j !== i)) }

  const totBase = lineas.reduce((a, l) => a + (Number(l.base_imponible) || 0), 0)
  const totIva = lineas.reduce((a, l) => a + (Number(l.iva) || 0), 0)
  const totTotal = totBase + totIva

  async function siguienteNumero() {
    const { data } = await supabase.from('presupuestos').select('numero')
    let max = 0
    ;(data || []).forEach(x => {
      const m = /^[Cc](\d+)$/.exec((x.numero || '').trim())
      if (m) max = Math.max(max, parseInt(m[1], 10))
    })
    return 'C' + String(max + 1).padStart(3, '0')
  }

  async function nuevo() {
    setMsg(null)
    const num = await siguienteNumero()
    setForm({ ...FORM_VACIO, numero: num })
    setLineas([{ ...LINEA_VACIA }])
    setEditando({})
  }

  async function editar(r) {
    setMsg(null)
    setForm({
      ...FORM_VACIO, ...r,
      fecha: r.fecha ? String(r.fecha).slice(0, 10) : hoyISO(),
      id_admon_new: r.id_admon_new || '', id_admon_old: r.id_admon_old || '',
      ubicacion: r.ubicacion || '', propietario: r.propietario || '', descripcion: r.descripcion || '',
    })
    const { data } = await supabase
      .from('presupuesto_detalle')
      .select('orden, descripcion, cantidad, coste_unit, base_imponible, iva, total')
      .eq('presupuesto_id', r.id)
      .order('orden')
    setLineas((data && data.length ? data : [{ ...LINEA_VACIA }]).map(calcLinea))
    setEditando(r)
  }

  async function eliminar(r) {
    if (!window.confirm(`¿Eliminar el presupuesto ${r.numero}? Se borran también sus líneas.`)) return
    await supabase.from('presupuestos').delete().eq('id', r.id) // detalle cae por ON DELETE CASCADE
    await cargar()
  }

  function aamm(fecha) {
    const d = new Date(fecha)
    if (isNaN(d.getTime())) return null
    return (d.getFullYear() % 100) * 100 + (d.getMonth() + 1)
  }

  async function guardar() {
    setGuardando(true); setMsg(null)
    const validas = lineas.filter(l => (l.descripcion || '').trim())
    const cab = {
      numero: (form.numero || '').trim() || null,
      fecha: form.fecha || null,
      aamm: aamm(form.fecha),
      id_admon_new: (form.id_admon_new || '').trim() || null,
      id_admon_old: (form.id_admon_old || '').trim() || null,
      ubicacion: form.ubicacion || null,
      propietario: form.propietario || null,
      descripcion: form.descripcion || null,
      neto: totBase, iva: totIva, total: totTotal,
      updated_at: new Date().toISOString(),
    }

    let presupuestoId = editando && editando.id ? editando.id : null
    if (presupuestoId) {
      const { error } = await supabase.from('presupuestos').update(cab).eq('id', presupuestoId)
      if (error) { setMsg({ tipo: 'error', txt: 'Error: ' + error.message }); setGuardando(false); return }
      await supabase.from('presupuesto_detalle').delete().eq('presupuesto_id', presupuestoId)
    } else {
      const { data, error } = await supabase.from('presupuestos').insert(cab).select('id').single()
      if (error) { setMsg({ tipo: 'error', txt: 'Error: ' + error.message }); setGuardando(false); return }
      presupuestoId = data.id
    }

    if (validas.length) {
      const filas = validas.map((l, i) => ({
        presupuesto_id: presupuestoId,
        orden: i + 1,
        descripcion: l.descripcion.trim(),
        cantidad: l.cantidad === '' ? null : Number(l.cantidad),
        coste_unit: l.coste_unit === '' ? null : Number(l.coste_unit),
        base_imponible: Number(l.base_imponible) || 0,
        iva: Number(l.iva) || 0,
        total: Number(l.total) || 0,
      }))
      const { error } = await supabase.from('presupuesto_detalle').insert(filas)
      if (error) { setMsg({ tipo: 'error', txt: 'Guardó la cabecera pero falló el detalle: ' + error.message }); setGuardando(false); return }
    }

    setGuardando(false)
    setEditando(null)
    await cargar()
  }

  // ── filtrado del listado ──
  const filtradas = (() => {
    const q = norm(busca)
    if (!q) return lista
    return lista.filter(r => norm([r.numero, r.id_admon_new, r.id_admon_old, r.ubicacion, r.propietario, r.descripcion].join(' ')).includes(q))
  })()

  if (status === 'loading' || accesoOk === null) return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (accesoOk === false) return null

  // estilos
  const input = { padding: '8px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const label = { fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4, display: 'block' }
  const card = { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, padding: 20, marginBottom: 16 }
  const tdNum = { padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }

  // ───────────── FORMULARIO ─────────────
  if (editando !== null) {
    return (
      <>
        <TopNav />
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
              {editando.id ? 'Editar presupuesto' : 'Nuevo presupuesto'} <span style={{ fontSize: 13, color: '#888', fontWeight: 400 }}>· {form.numero}</span>
            </h1>
            <button onClick={() => setEditando(null)} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#F0EEE8' }}>← Volver</button>
          </div>

          {msg && <div style={{ ...card, background: msg.tipo === 'error' ? '#fef2f2' : '#f0fdf4', color: msg.tipo === 'error' ? '#dc2626' : '#16a34a', padding: 12 }}>{msg.txt}</div>}

          {/* Datos */}
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>Datos del presupuesto</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={label}>Número</label><input style={input} value={form.numero} onChange={e => set('numero', e.target.value)} /></div>
              <div><label style={label}>Fecha</label><input style={input} type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></div>
              <div><label style={label}>IDADMON (new)</label><input style={input} value={form.id_admon_new} onChange={e => set('id_admon_new', e.target.value)} placeholder="A00600" /></div>
              <div><label style={label}>IDADMON (old)</label><input style={input} value={form.id_admon_old} onChange={e => set('id_admon_old', e.target.value)} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={label}>Ubicación (copiar de APP-VISION)</label><input style={input} value={form.ubicacion} onChange={e => set('ubicacion', e.target.value)} /></div>
              <div><label style={label}>Propietario</label><input style={input} value={form.propietario} onChange={e => set('propietario', e.target.value)} /></div>
            </div>
            <div><label style={label}>Descripción</label><input style={input} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Ej. REPARACION DEPTO" /></div>
          </div>

          {/* Líneas */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Líneas del presupuesto</div>
              <button onClick={agregarLinea} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#E6F1FB', color: '#185FA5', border: '1px solid #185FA5', fontWeight: 600 }}>+ Agregar línea</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#FAFAF8' }}>
                    {['Descripción', 'Cant.', 'Coste unit.', 'Base imp.', 'IVA', 'Total', ''].map((h, i) => (
                      <th key={i} style={{ padding: '8px', textAlign: i >= 1 && i <= 5 ? 'right' : 'left', fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: .4 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '4px 6px' }}><input style={{ ...input, padding: '6px 8px' }} value={l.descripcion} onChange={e => setLinea(i, 'descripcion', e.target.value)} /></td>
                      <td style={{ padding: '4px 6px', width: 70 }}><input style={{ ...input, padding: '6px 8px', textAlign: 'right' }} type="number" value={l.cantidad} onChange={e => setLinea(i, 'cantidad', e.target.value)} /></td>
                      <td style={{ padding: '4px 6px', width: 110 }}><input style={{ ...input, padding: '6px 8px', textAlign: 'right' }} type="number" value={l.coste_unit} onChange={e => setLinea(i, 'coste_unit', e.target.value)} /></td>
                      <td style={{ ...tdNum, color: '#555' }}>{Number(l.base_imponible).toLocaleString('es-CL')}</td>
                      <td style={{ ...tdNum, color: '#888' }}>{Number(l.iva).toLocaleString('es-CL')}</td>
                      <td style={{ ...tdNum, fontWeight: 600 }}>{Number(l.total).toLocaleString('es-CL')}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <button onClick={() => quitarLinea(i)} title="Quitar" style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                      </td>
                    </tr>
                  ))}
                  {lineas.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center', color: '#888' }}>Sin líneas. Agrega la primera con "+ Agregar línea".</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #E8E6E0' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700, color: '#1a1a2e' }}>TOTALES</td>
                    <td></td><td></td>
                    <td style={{ ...tdNum, fontWeight: 700 }}>{totBase.toLocaleString('es-CL')}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: '#888' }}>{totIva.toLocaleString('es-CL')}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: '#185FA5' }}>{totTotal.toLocaleString('es-CL')}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 8 }}>Base imponible = cantidad × coste unitario · IVA = 19% · Total = base + IVA (se calculan solos).</div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditando(null)} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#F0EEE8' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#185FA5', color: '#fff', border: 'none', fontWeight: 600, opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando…' : (editando.id ? 'Guardar cambios' : 'Crear presupuesto')}
            </button>
          </div>
        </div>
      </>
    )
  }

  // ───────────── LISTADO ─────────────
  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Presupuestos</h1>
          <button onClick={nuevo} style={{ padding: '8px 16px', borderRadius: 8, background: '#185FA5', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Nuevo presupuesto</button>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Presupuestos de reparación · proceso de administraciones</div>

        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por IDADMON, número, dirección o propietario…"
          style={{ ...input, marginBottom: 14, maxWidth: 520 }} />

        {loading ? (
          <div style={{ color: '#888' }}>Cargando…</div>
        ) : filtradas.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', color: '#888', padding: 40 }}>
            {busca ? 'Sin resultados para esa búsqueda.' : 'No hay presupuestos aún. Crea el primero con "+ Nuevo presupuesto".'}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #E8E6E0' }}>
                  {['N°', 'Fecha', 'IDADMON', 'Ubicación', 'Descripción', 'Neto', 'Total', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: (h === 'Neto' || h === 'Total') ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: .5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.numero}</td>
                    <td style={{ padding: '10px 12px', color: '#555', whiteSpace: 'nowrap' }}>{fmtFecha(r.fecha)}</td>
                    <td style={{ padding: '10px 12px', color: '#185FA5', fontWeight: 600 }}>{r.id_admon_new || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#555' }}>{r.ubicacion || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#555' }}>{r.descripcion || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtPesos(r.neto)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtPesos(r.total)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => editar(r)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #185FA5', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', marginRight: 6, fontFamily: 'inherit' }}>Ver / Editar</button>
                      <button onClick={() => eliminar(r)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit' }}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
