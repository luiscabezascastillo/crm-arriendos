'use client'
// VERSION: 2026-08-26 · Añadido "← Volver" (BotonVolver, history.back) — convención de retorno. Hereda versión previa.
// VERSION: v1 · 2026-07-31 · Vista de CONSULTA de Inmuebles (regenera la hoja "Inmuebles" del Excel).
//   Muestra por propietario las unidades individuales y las combinaciones (agrupaciones depto+bodega/
//   estacionamiento) con su ROL individual o combinado. Lee de la tabla `inmuebles` (raw_data) por
//   /api/inmuebles con service_role. Solo lectura: la edición se abordará como proyecto aparte.
'use client'
// VERSION: v2 · 2026-07-31 · Vista de Inmuebles sobre tablas NORMALIZADAS + creación de AGRUPACIONES.
//   Lee inmuebles_norm + combinaciones_norm (vía /api/inmuebles v3). Botón "Nueva agrupación"
//   (supervisor/Dirección/Anthony): marca unidades del propietario y compone idinmue+texto+rol
//   (orden dep→bod→est) automáticamente, editable, y guarda en combinaciones_norm.
import Link from 'next/link'
import BotonVolver from '../../components/ui/BotonVolver'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { HeaderFilter, filtroActivo, aplicarFiltros } from '../../../lib/filtroExcel'
import TopNav from '../../components/ui/TopNav'

// Columnas para el filtro estilo Excel (mismo motor que el LOG y SA).
const INM_COLS = [
  { key: 'idinmue', label: 'IDINMUE', tipo: 'texto',
    fkey: p => p.idinmue || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'inmueble', label: 'Inmueble', tipo: 'texto',
    fkey: p => p.inmueble || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'propietario', label: 'Propietario', tipo: 'texto',
    fkey: p => p.propietario || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'rol', label: 'ROL', tipo: 'texto',
    fkey: p => p.rol || '', flabel: k => (k === '' ? '(vacías)' : k) },
]

export default function InmueblesPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [cap, setCap] = useState(null)
  const [todas, setTodas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [openFilter, setOpenFilter] = useState(null)
  const [orden, setOrden] = useState(null)
  const [soloComb, setSoloComb] = useState(false)  // ver solo combinaciones (agrupaciones)
  // Modal "Nueva agrupación"
  const [modalAgrup, setModalAgrup] = useState(false)
  const [propSel, setPropSel] = useState('')          // idprop elegido
  const [unidadesProp, setUnidadesProp] = useState([])// unidades del propietario
  const [marcadas, setMarcadas] = useState(new Set()) // idinmue marcados
  const [cargandoUn, setCargandoUn] = useState(false)
  const [guardandoAg, setGuardandoAg] = useState(false)
  const [agrupResult, setAgrupResult] = useState(null)

  useEffect(() => { cargar() }, [])
  useEffect(() => { cargarCapacidades() }, [])

  async function cargarCapacidades() {
    try {
      const res = await fetch('/api/cc1/pendientes')
      const data = await res.json()
      if (res.ok) setCap(data.capacidades)
    } catch { /* sin permisos: no se muestra el botón de crear */ }
  }

  async function cargar() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/inmuebles')
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Error cargando inmuebles'); setLoading(false); return }
      setTodas(d.inmuebles || [])
    } catch (e) {
      setError('Error de conexión: ' + (e?.message || e))
    }
    setLoading(false)
  }

  // ── Nueva agrupación ──
  // Lista de propietarios (idprop → nombre) desde las unidades ya cargadas.
  const propietarios = useMemo(() => {
    const m = new Map()
    for (const u of todas) { if (!u.combinacion && u.idprop && !m.has(u.idprop)) m.set(u.idprop, u.propietario || u.idprop) }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [todas])

  function abrirAgrupacion() {
    setPropSel(''); setUnidadesProp([]); setMarcadas(new Set()); setAgrupResult(null); setModalAgrup(true)
  }

  async function elegirPropAgrup(idprop) {
    setPropSel(idprop); setMarcadas(new Set()); setAgrupResult(null)
    if (!idprop) { setUnidadesProp([]); return }
    setCargandoUn(true)
    try {
      const res = await fetch('/api/inmuebles/agrupacion?idprop=' + encodeURIComponent(idprop))
      const d = await res.json()
      if (res.ok) setUnidadesProp(d.unidades || [])
    } catch { /* vacío */ }
    setCargandoUn(false)
  }

  const toggleMarcada = (idinmue) => setMarcadas(s => { const n = new Set(s); n.has(idinmue) ? n.delete(idinmue) : n.add(idinmue); return n })

  // Orden y tipo por rango, para la vista previa (misma regla que el backend).
  const tipoOrdenCli = (idinmue) => {
    const n = parseInt(String(idinmue).split('-')[1], 10)
    if (n >= 1 && n <= 49) return { t: 'dep', o: 0, n }
    if (n >= 51 && n <= 79) return { t: 'bod', o: 1, n }
    if (n >= 81 && n <= 99) return { t: 'est', o: 2, n }
    return { t: 'otro', o: 9, n }
  }
  // Vista previa de la composición (idinmue + texto), en orden dep→bod→est.
  const preview = useMemo(() => {
    const sel = unidadesProp.filter(u => marcadas.has(u.idinmue))
    if (sel.length < 2) return null
    const ord = [...sel].sort((a, b) => { const A = tipoOrdenCli(a.idinmue), B = tipoOrdenCli(b.idinmue); return A.o - B.o || A.n - B.n })
    const idinmue = ord.map(u => u.idinmue).join(' ')
    let base = ''; const partes = []
    for (const u of ord) {
      const m = String(u.inmueble || '').match(/^(.*?)-\s*(dep|bod|est)\s+(.+)$/i)
      if (m) { if (!base) base = m[1].trim(); partes.push(`${m[2].toLowerCase()} ${m[3].trim()}`) }
    }
    const texto = base + partes.map(p => `- ${p}`).join('')
    const nDep = ord.filter(u => tipoOrdenCli(u.idinmue).t === 'dep').length
    return { idinmue, texto, nDep, n: ord.length }
  }, [unidadesProp, marcadas])

  async function guardarAgrupacion() {
    if (!preview) return
    if (preview.nDep !== 1) { setAgrupResult({ error: 'La agrupación debe tener exactamente un departamento (dep).' }); return }
    setGuardandoAg(true); setAgrupResult(null)
    try {
      const res = await fetch('/api/inmuebles/agrupacion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idprop: propSel, unidades: [...marcadas], creado_por: session?.user?.email || null }),
      })
      const d = await res.json()
      if (!res.ok) { setAgrupResult({ error: d.error || 'Error al guardar' }); setGuardandoAg(false); return }
      setAgrupResult({ ok: true, idinmue: d.idinmue_combinado })
      await cargar()  // refrescar la vista para que aparezca la nueva agrupación
    } catch (err) {
      setAgrupResult({ error: err.message })
    }
    setGuardandoAg(false)
  }

  const setFiltroCol = (key, val) => setFilters(f => { const n = { ...f }; if (val == null) delete n[key]; else n[key] = val; return n })
  const limpiarTodo = () => { setSearch(''); setFilters({}); setOrden(null); setSoloComb(false) }
  const hayAlgunFiltro = INM_COLS.some(c => filtroActivo(filters[c.key]))
  const hayFiltros = search || hayAlgunFiltro || orden?.key || soloComb

  const filtradas = useMemo(() => {
    let base = todas
    if (soloComb) base = base.filter(p => p.combinacion)
    const q = search.trim().toLowerCase()
    if (q) base = base.filter(p => ['idinmue', 'inmueble', 'propietario', 'rol']
      .some(k => String(p[k] || '').toLowerCase().includes(q)))
    let out = aplicarFiltros(base, INM_COLS, filters, orden)
    if (!orden?.key) {
      out = [...out].sort((a, b) =>
        String(a.propietario || '').localeCompare(String(b.propietario || ''), 'es') ||
        String(a.idinmue || '').localeCompare(String(b.idinmue || ''), 'es'))
    }
    return out
  }, [todas, search, filters, orden, soloComb])

  const totalComb = useMemo(() => todas.filter(p => p.combinacion).length, [todas])

  // Permiso para crear/editar agrupaciones: supervisor, Dirección o Anthony (Legal).
  // Robusto ante distintas formas del objeto cap devuelto por la API.
  const puedeEditar = !!(cap && (
    cap.puedeEditarInmuebles ||
    cap.esDireccion || cap.rol === 'direccion' || cap.rol === 'responsable' || cap.rol === 'supervisor' ||
    cap.email === 'anthony.mendoza@fondocapital.com'
  ))

  const thStyle = { padding: '9px 12px', textAlign: 'left', position: 'sticky', top: 52, zIndex: 20, background: 'var(--gray-50)', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }
  const labelStyle = { fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }
  const hf = (key) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={labelStyle}>{INM_COLS.find(c => c.key === key).label}</span>
      <HeaderFilter col={INM_COLS.find(c => c.key === key)} movs={todas} state={filters[key]} setState={v => setFiltroCol(key, v)} open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden} limpiarTodo={limpiarTodo} hayAlguno={hayFiltros} />
    </span>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopNav />
      <BotonVolver />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px' }}>

        {/* Cabecera: título a la izquierda, búsqueda y botones a la derecha en la misma fila */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
          <Link href="/cc1" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-500)', textDecoration: 'none' }}>‹ Volver al LOG</Link>
          <div style={{ width: 30, height: 30, background: '#0891b2', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: '#2C2C2A', flexShrink: 0 }}>Inmuebles</h1>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por IDINMUE, inmueble, propietario o ROL…"
            style={{ flex: 1, minWidth: 240, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          <button onClick={() => setSoloComb(v => !v)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + (soloComb ? '#0891b2' : 'var(--border)'), background: soloComb ? '#0891b2' : '#fff', color: soloComb ? '#fff' : 'var(--gray-600)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            Solo agrupaciones ({totalComb})
          </button>
          {puedeEditar && (
            <button onClick={abrirAgrupacion}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#0891b2', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
              ➕ Nueva agrupación
            </button>
          )}
          {hayFiltros && (
            <button onClick={limpiarTodo} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fcd34d', background: '#fef9c3', color: '#92400e', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>✕ Limpiar filtros</button>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--gray-400)', margin: '0 0 14px 42px' }}>
          Unidades individuales y agrupaciones (departamento + bodega/estacionamiento) con su ROL. Solo consulta.
        </p>

        {/* Tabla */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>
            Listado de inmuebles <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>({filtradas.length} registro{filtradas.length === 1 ? '' : 's'})</span>
          </div>
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 180 }} />   {/* IDINMUE combinado */}
                <col style={{ width: 320 }} />   {/* Inmueble */}
                <col style={{ width: 150 }} />   {/* Propietario */}
                <col style={{ width: 60 }} />    {/* Bodega */}
                <col style={{ width: 60 }} />    {/* Estac */}
                <col style={{ width: 240 }} />   {/* ROL */}
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--gray-50)' }}>
                  <th style={thStyle}>{hf('idinmue')}</th>
                  <th style={thStyle}>{hf('inmueble')}</th>
                  <th style={thStyle}>{hf('propietario')}</th>
                  <th style={thStyle}>Bod</th>
                  <th style={thStyle}>Est</th>
                  <th style={thStyle}>{hf('rol')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>Cargando inmuebles…</td></tr>
                ) : error ? (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: '#dc2626' }}>{error}</td></tr>
                ) : filtradas.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>No se encontraron inmuebles.</td></tr>
                ) : filtradas.map((p, i) => (
                  <tr key={i} style={{ background: p.combinacion ? '#f0fdfa' : 'transparent' }}>
                    <td title={p.idinmue} style={{ padding: '9px 12px', fontSize: 11, fontFamily: 'monospace', fontWeight: p.combinacion ? 700 : 400, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.idinmue || '—'}</td>
                    <td title={p.inmueble} style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.inmueble || '—'}</td>
                    <td title={p.propietario} style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-600)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.propietario || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--gray-500)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}>{p.bodega || ''}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--gray-500)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}>{p.estac || ''}</td>
                    <td title={p.rol} style={{ padding: '9px 12px', fontSize: 11, fontFamily: 'monospace', color: 'var(--gray-600)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.rol || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--gray-400)', textAlign: 'center', borderTop: '1px solid var(--border-subtle)' }}>
            {filtradas.length} registro{filtradas.length === 1 ? '' : 's'} · las filas resaltadas son agrupaciones (varias unidades en un mismo arriendo)
          </div>
        </div>
      </div>

      {/* ══ MODAL: Nueva agrupación ══ */}
      {modalAgrup && (
        <div onClick={() => !guardandoAg && setModalAgrup(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(720px, 96vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 50px rgba(0,0,0,.28)' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#0e7490' }}>➕ Nueva agrupación</h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: '0 0 16px' }}>
              Elige el propietario y marca las unidades que van juntas (un departamento + sus bodegas/estacionamientos).
              El sistema compone el IDINMUE y la dirección en orden dep → bod → est.
            </p>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Propietario</label>
            <select value={propSel} onChange={e => elegirPropAgrup(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', marginBottom: 14 }}>
              <option value="">— elige un propietario —</option>
              {propietarios.map(([id, nom]) => <option key={id} value={id}>{id} · {nom}</option>)}
            </select>

            {propSel && (
              <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 12 }}>
                {cargandoUn ? (
                  <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>Cargando unidades…</div>
                ) : unidadesProp.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>Sin unidades individuales.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '6px 10px', width: 40 }}></th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>IDINMUE</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Tipo</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Inmueble</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>ROL</th>
                    </tr></thead>
                    <tbody>
                      {unidadesProp.map(u => {
                        const mk = marcadas.has(u.idinmue)
                        return (
                          <tr key={u.idinmue} onClick={() => toggleMarcada(u.idinmue)}
                            style={{ background: mk ? '#ecfeff' : '#fff', borderTop: '1px solid #eef2f7', cursor: 'pointer' }}>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}><input type="checkbox" checked={mk} onChange={() => toggleMarcada(u.idinmue)} onClick={e => e.stopPropagation()} /></td>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{u.idinmue}</td>
                            <td style={{ padding: '6px 10px', color: '#0891b2' }}>{u.tipo}</td>
                            <td style={{ padding: '6px 10px', color: '#475569' }}>{u.inmueble}</td>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#64748b', fontSize: 11 }}>{u.rol || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {preview && (
              <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '12px 14px', marginBottom: 12, fontSize: 13 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6 }}>Vista previa</div>
                <div style={{ marginBottom: 3 }}><b>IDINMUE:</b> <span style={{ fontFamily: 'monospace' }}>{preview.idinmue}</span></div>
                <div><b>Dirección:</b> {preview.texto}</div>
                {preview.nDep !== 1 && <div style={{ color: '#b91c1c', marginTop: 6 }}>⚠ Debe haber exactamente un departamento (dep). Ahora hay {preview.nDep}.</div>}
              </div>
            )}

            {agrupResult && (
              <div style={{ fontSize: 13, padding: '10px 12px', borderRadius: 8, marginBottom: 12,
                background: agrupResult.error ? '#FEF2F2' : '#F0FDF4', border: '1px solid ' + (agrupResult.error ? '#FCA5A5' : '#86EFAC'),
                color: agrupResult.error ? '#991B1B' : '#166534' }}>
                {agrupResult.error ? agrupResult.error : `✓ Agrupación creada: ${agrupResult.idinmue}`}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModalAgrup(false)} disabled={guardandoAg}
                style={{ fontSize: 13, padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: '#475569', cursor: 'pointer' }}>
                {agrupResult?.ok ? 'Cerrar' : 'Cancelar'}
              </button>
              {!agrupResult?.ok && (
                <button onClick={guardarAgrupacion} disabled={guardandoAg || !preview || preview.nDep !== 1}
                  style={{ fontSize: 13, fontWeight: 600, padding: '9px 18px', borderRadius: 8, border: 'none',
                    background: (guardandoAg || !preview || preview.nDep !== 1) ? '#9CA3AF' : '#0891b2', color: '#fff',
                    cursor: (guardandoAg || !preview || preview.nDep !== 1) ? 'default' : 'pointer' }}>
                  {guardandoAg ? 'Guardando…' : 'Crear agrupación'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
