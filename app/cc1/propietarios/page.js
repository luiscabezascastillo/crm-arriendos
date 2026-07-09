// VERSION: v2 · 2026-07-09 · desacople ver/editar: Karina (Finanzas) entra en modo solo lectura
'use client'

import { useState, useEffect, useRef, forwardRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { supabase } from '../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

// EDITAR: Dirección, Legal y Administración (por rol/departamento o email).
const ROLES_EDIT = ['admin', 'legal', 'operaciones']
const EMAILS_OK = [
  'luis.cabezas@fondocapital.com', 'alberto.cabezas@fondocapital.com',
  'anthony.mendoza@fondocapital.com', 'adalis@fondocapital.com', 'fabiola.guerra@fondocapital.com',
]
// VER en solo lectura (además de quien edita): Karina (Finanzas). Navega y consulta,
// pero no crea ni edita (sin botones de alta/editar, panel en modo lectura).
const EMAILS_VER = [
  'karina.morales@fondocapital.com',
]

// Campos visibles al principio
const PRINCIPALES = [
  { k: 'propietario', label: 'Propietario (Apellido, Nombre)', w: 2 },
  { k: 'nombre', label: 'Nombre' },
  { k: 'apellidos', label: 'Apellidos' },
  { k: 'fis_jurid', label: 'Física / Jurídica', sel: ['', 'F', 'J'] },
  { k: 'genero', label: 'Género', sel: ['', 'M', 'F', '—'] },
  { k: 'rut', label: 'RUT' },
  { k: 'mail1', label: 'Email' },
  { k: 'telefono', label: 'Teléfono' },
  { k: 'direccion', label: 'Dirección', w: 2 },
  { k: 'comuna', label: 'Comuna' },
  { k: 'tipo_factura', label: 'Tipo factura' },
]
// Campos opcionales (desplegable)
const OPCIONALES = [
  { k: 'email_2', label: 'Email 2' },
  { k: 'fecha_cumpleanos', label: 'Fecha cumpleaños' },
  { k: 'llaves', label: 'Llaves' },
  { k: 'plantilla', label: 'Plantilla' },
  { k: 'advertencias', label: 'Advertencias', w: 2 },
  { k: 'comentarios', label: 'Comentarios', w: 2, ta: true },
  { k: 'range', label: 'Range' },
  { k: 'para_uso_futuro', label: 'Para uso futuro' },
]
const TODOS = [...PRINCIPALES, ...OPCIONALES].map(f => f.k)

// Columnas de la tabla (orden + filtro tipo Excel). tipo: 'nat' = orden natural (numérico-aware)
const COLT = [
  { k: 'idprop',      label: 'IdProp',      tipo: 'nat' },
  { k: 'propietario', label: 'Propietario', tipo: 'txt' },
  { k: 'rut',         label: 'RUT',         tipo: 'nat' },
  { k: 'mail1',       label: 'Email',       tipo: 'txt' },
  { k: 'comuna',      label: 'Comuna',      tipo: 'txt' },
  { k: 'activo',      label: 'Activo',      tipo: 'txt' },
]
const GRID = '70px 1.6fr 110px 1.4fr 1fr 70px 90px'

export default function PropietariosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role
  const [puedeEditar, setPuedeEditar] = useState(null)
  const [puedeVer, setPuedeVer] = useState(null)
  const [rows, setRows] = useState([])
  const [cargando, setCargando] = useState(true)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)     // {modo:'crear'|'editar', campos:{...}, idprop}
  const [opcAbierto, setOpcAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  // Orden y filtro tipo Excel
  const [sortCol, setSortCol] = useState('propietario')
  const [sortDir, setSortDir] = useState('asc')
  const [filtros, setFiltros] = useState({})     // col -> Set(valores seleccionados)
  const [menuCol, setMenuCol] = useState(null)   // col con menú de filtro abierto
  const [busca, setBusca] = useState('')
  const menuRef = useRef(null)

  useEffect(() => {
    function onDoc(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuCol(null) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (status !== 'authenticated' || !email) return
    const editar = ROLES_EDIT.includes(rol) || EMAILS_OK.includes(email)
    setPuedeEditar(editar)
    // Puede ver: quien edita, o quien está en la lista de solo-lectura (Karina).
    setPuedeVer(editar || EMAILS_VER.includes(email))
  }, [status, email, rol])
  // Solo se redirige a quien NO puede ni ver. Quien puede ver (aunque no edite) se queda.
  useEffect(() => { if (puedeVer === false) { const t = setTimeout(() => router.replace('/'), 2500); return () => clearTimeout(t) } }, [puedeVer, router])

  useEffect(() => { cargar() }, [])
  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('propietarios').select('*').limit(2000)
    const ord = (data || []).sort((a, b) => (parseInt(String(b.idprop).replace(/\D/g, ''), 10) || 0) - (parseInt(String(a.idprop).replace(/\D/g, ''), 10) || 0))
    setRows(ord)
    setCargando(false)
  }

  const proximoIdprop = () => {
    let max = 0
    for (const r of rows) { const n = parseInt(String(r.idprop).replace(/\D/g, ''), 10); if (!isNaN(n) && n > max) max = n }
    return 'P' + String(max + 1).padStart(3, '0')
  }

  function abrirNuevo() {
    if (!puedeEditar) return
    setMsg(null); setOpcAbierto(false)
    const campos = {}; TODOS.forEach(k => campos[k] = '')
    campos.activo = 'SI'
    setEdit({ modo: 'crear', idprop: proximoIdprop(), campos })
  }
  function abrirEditar(r) {
    setMsg(null); setOpcAbierto(false)
    const campos = {}; TODOS.forEach(k => campos[k] = r[k] ?? '')
    setEdit({ modo: puedeEditar ? 'editar' : 'ver', idprop: r.idprop, campos })
  }

  async function guardar() {
    if (!puedeEditar) { setMsg({ err: 'Tu perfil es de solo lectura.' }); return }
    if (guardando || !edit) return
    setGuardando(true); setMsg(null)
    try {
      const res = await fetch('/api/propietarios/guardar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: edit.modo, idprop: edit.idprop, campos: edit.campos }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ err: data.error || `Error ${res.status}` }); setGuardando(false); return }
      await cargar()
      setEdit(null)
    } catch (e) { setMsg({ err: e.message }) }
    setGuardando(false)
  }

  const setCampo = (k, v) => setEdit(e => ({ ...e, campos: { ...e.campos, [k]: v } }))

  const filtro = q.trim().toLowerCase()
  const norm = v => String(v ?? '')
  const cmp = (a, b) => norm(a).localeCompare(norm(b), 'es', { numeric: true, sensitivity: 'base' })
  const cellVal = (r, k) => norm(r[k])
  const etiqueta = (r, k) => { const v = cellVal(r, k); return v === '' ? '(vacío)' : v }
  function valoresUnicos(k) {
    const s = new Set(); rows.forEach(r => s.add(etiqueta(r, k)))
    return Array.from(s).sort(cmp)
  }
  function toggleSort(k) {
    if (sortCol === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(k); setSortDir('asc') }
  }
  function toggleValor(col, val) {
    setFiltros(prev => { const a = new Set(prev[col] || valoresUnicos(col)); a.has(val) ? a.delete(val) : a.add(val); return { ...prev, [col]: a } })
  }
  function soloEste(col, val) { setFiltros(prev => ({ ...prev, [col]: new Set([val]) })); setMenuCol(null) }
  function limpiarFiltro(col) { setFiltros(prev => { const n = { ...prev }; delete n[col]; return n }); setMenuCol(null) }
  const colFiltrada = (col) => filtros[col] && filtros[col].size > 0 && filtros[col].size < valoresUnicos(col).length

  let visibles = rows
  if (filtro) visibles = visibles.filter(r => ['idprop', 'propietario', 'rut', 'mail1', 'comuna'].some(k => norm(r[k]).toLowerCase().includes(filtro)))
  for (const [col, set] of Object.entries(filtros)) {
    if (set && set.size > 0) visibles = visibles.filter(r => set.has(etiqueta(r, col)))
  }
  visibles = [...visibles].sort((a, b) => { const d = cmp(cellVal(a, sortCol), cellVal(b, sortCol)); return sortDir === 'asc' ? d : -d })

  if (status === 'loading' || puedeVer === null) return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (puedeVer === false) return (<><TopNav /><div style={{ padding: 40, color: '#991B1B' }}>Sin acceso. Esta sección no está disponible para tu perfil. Redirigiendo…</div></>)

  const inp = { width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '7px 9px', border: '1px solid #D1D5DB', borderRadius: 7, fontFamily: 'inherit' }
  const lbl = { fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }

  const renderCampo = (f) => {
    const val = edit.campos[f.k] ?? ''
    const ro = !puedeEditar
    let control
    if (f.sel) {
      const opts = f.sel.includes(val) ? f.sel : [...f.sel, val]
      control = <select value={val} disabled={ro} onChange={e => setCampo(f.k, e.target.value)} style={{ ...inp, background: ro ? '#F3F4F6' : '#fff', color: ro ? '#6B7280' : 'inherit' }}>
        {opts.map(o => <option key={o} value={o}>{o === '' ? '—' : o}</option>)}
      </select>
    } else if (f.ta) {
      control = <textarea value={val} disabled={ro} onChange={e => setCampo(f.k, e.target.value)} rows={2} style={{ ...inp, resize: 'vertical', background: ro ? '#F3F4F6' : '#fff', color: ro ? '#6B7280' : 'inherit' }} />
    } else {
      control = <input value={val} disabled={ro} onChange={e => setCampo(f.k, e.target.value)} style={{ ...inp, background: ro ? '#F3F4F6' : '#fff', color: ro ? '#6B7280' : 'inherit' }} />
    }
    return (
      <div key={f.k} style={{ gridColumn: f.w === 2 ? '1 / -1' : 'auto' }}>
        <label style={lbl}>{f.label}</label>
        {control}
      </div>
    )
  }

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <button onClick={() => router.push('/cc1')}
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#2C2C2A', cursor: 'pointer' }}>
            ← CC1
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Propietarios</h1>
          {puedeEditar && (
            <button onClick={abrirNuevo}
              style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer' }}>
              + Nuevo propietario
            </button>
          )}
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>{rows.length} propietarios · {puedeEditar ? 'edición: Dirección, Legal y Administración.' : 'modo solo lectura.'}</div>

        <input placeholder="Buscar por idprop, nombre, RUT, email o comuna…" value={q} onChange={e => setQ(e.target.value)}
          style={{ width: '100%', maxWidth: 460, boxSizing: 'border-box', fontSize: 13, padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 9, marginBottom: 14 }} />

        {cargando ? <div style={{ color: '#888', padding: 20 }}>Cargando…</div> : (
          <div style={{ border: '1px solid #E8E6E0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 0, background: '#334155', color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {COLT.map((c, ci) => (
                <div key={c.k} style={{ padding: '10px 12px', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'space-between' }}>
                    <span onClick={() => toggleSort(c.k)} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', userSelect: 'none' }} title="Ordenar">
                      {c.label}{sortCol === c.k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </span>
                    <button onClick={() => { setMenuCol(menuCol === c.k ? null : c.k); setBusca('') }} title="Filtrar"
                      style={{ border: 'none', cursor: 'pointer', borderRadius: 3, padding: 0, flexShrink: 0, width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: colFiltrada(c.k) ? '#BF8F00' : 'rgba(255,255,255,.30)', color: '#fff', fontSize: 9, lineHeight: 1 }}>▼</button>
                  </div>
                  {menuCol === c.k && (
                    <FiltroMenu ref={menuRef} lado={ci < COLT.length / 2 ? 'left' : 'right'}
                      valores={valoresUnicos(c.k)} seleccion={filtros[c.k]} busca={busca} setBusca={setBusca}
                      onToggle={v => toggleValor(c.k, v)} onSolo={v => soloEste(c.k, v)} onTodos={() => limpiarFiltro(c.k)} onCerrar={() => setMenuCol(null)} />
                  )}
                </div>
              ))}
              <div style={{ padding: '10px 12px' }}></div>
            </div>
            <div style={{ maxHeight: '62vh', overflowY: 'auto' }}>
              {visibles.map((r, i) => (
                <div key={r.idprop} style={{ display: 'grid', gridTemplateColumns: '70px 1.6fr 110px 1.4fr 1fr 70px 90px', gap: 0, fontSize: 13, borderTop: '1px solid #F1F0EC', background: i % 2 ? '#FCFCFB' : '#fff', alignItems: 'center' }}>
                  <div style={{ padding: '9px 12px', fontWeight: 700, color: '#1e3a8a' }}>{r.idprop}</div>
                  <div style={{ padding: '9px 12px' }}>{r.propietario || '—'}</div>
                  <div style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{r.rut || '—'}</div>
                  <div style={{ padding: '9px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.mail1 || ''}>{r.mail1 || '—'}</div>
                  <div style={{ padding: '9px 12px' }}>{r.comuna || '—'}</div>
                  <div style={{ padding: '9px 12px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: r.activo === 'SI' ? '#DCFCE7' : '#FEE2E2', color: r.activo === 'SI' ? '#166534' : '#991B1B' }}>{r.activo || '—'}</span>
                  </div>
                  <div style={{ padding: '9px 12px' }}>
                    <button onClick={() => abrirEditar(r)} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 7, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#3730A3', cursor: 'pointer' }}>{puedeEditar ? 'Editar' : 'Ver'}</button>
                  </div>
                </div>
              ))}
              {visibles.length === 0 && <div style={{ padding: 20, color: '#9CA3AF', fontSize: 13 }}>Sin resultados.</div>}
            </div>
          </div>
        )}
      </div>

      {/* Panel lateral de edición / alta */}
      {edit && (
        <>
          <div onClick={() => !guardando && setEdit(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 400 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(560px, 94vw)', background: '#fff', zIndex: 401, boxShadow: '-8px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8E6E0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>{edit.modo === 'crear' ? 'Nuevo propietario' : edit.modo === 'ver' ? 'Ficha del propietario' : 'Editar propietario'}</div>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#EEF2FF', color: '#3730A3' }}>
                {edit.idprop}{edit.modo === 'crear' ? ' (se asigna al guardar)' : ''}
              </span>
              <button onClick={() => !guardando && setEdit(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Activo (toggle) */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Activo</label>
                  <div style={{ display: 'inline-flex', border: '1px solid #D1D5DB', borderRadius: 8, overflow: 'hidden' }}>
                    {['SI', 'NO'].map(v => (
                      <button key={v} onClick={() => setCampo('activo', v)}
                        style={{ padding: '7px 22px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                          background: edit.campos.activo === v ? (v === 'SI' ? '#16a34a' : '#dc2626') : '#fff',
                          color: edit.campos.activo === v ? '#fff' : '#6B7280' }}>{v}</button>
                    ))}
                  </div>
                </div>
                {PRINCIPALES.map(renderCampo)}
              </div>

              {/* Opcionales */}
              <button onClick={() => setOpcAbierto(v => !v)}
                style={{ marginTop: 18, marginBottom: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#3730A3', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ transition: 'transform 0.15s', transform: opcAbierto ? 'rotate(90deg)' : 'none' }}>▸</span>
                Campos opcionales
              </button>
              {opcAbierto && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {OPCIONALES.map(renderCampo)}
                </div>
              )}

              {msg?.err && <div style={{ marginTop: 14, fontSize: 12, color: '#991B1B', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 12px' }}>{msg.err}</div>}
            </div>

            <div style={{ padding: 16, borderTop: '1px solid #E8E6E0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => !guardando && setEdit(null)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{puedeEditar ? 'Cancelar' : 'Cerrar'}</button>
              {puedeEditar && (
                <button onClick={guardar} disabled={guardando} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: guardando ? '#9CA3AF' : '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: guardando ? 'wait' : 'pointer' }}>
                  {guardando ? 'Guardando…' : (edit.modo === 'crear' ? 'Crear propietario' : 'Guardar cambios')}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ---- Menú de filtro tipo Excel (mismo patrón que Descuentos) ----
function btnMini(bg) { return { background: bg, color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 11 } }
const FiltroMenu = forwardRef(function FiltroMenu({ valores, seleccion, busca, setBusca, onToggle, onSolo, onTodos, onCerrar, lado = 'right' }, ref) {
  const sel = seleccion && seleccion.size > 0 ? seleccion : new Set(valores)
  const vis = valores.filter(v => v.toLowerCase().includes((busca || '').toLowerCase()))
  const anchor = lado === 'left' ? { left: 0 } : { right: 0 }
  return (
    <div ref={ref} style={{ position: 'absolute', zIndex: 50, top: '100%', ...anchor, marginTop: 4, background: '#fff', color: '#222', border: '1px solid #b9c2d0', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,.18)', width: 230, padding: 8, textAlign: 'left', fontWeight: 400, fontSize: 12, textTransform: 'none', letterSpacing: 0 }}>
      <input autoFocus placeholder="Buscar…" value={busca} onChange={e => setBusca(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', marginBottom: 6, fontSize: 12 }} />
      <div style={{ marginBottom: 6 }}><button onClick={onTodos} style={btnMini('#1f4e79')}>Mostrar todos</button></div>
      <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #eee', borderRadius: 4, padding: 4 }}>
        {vis.map(v => (
          <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={sel.has(v)} onChange={() => onToggle(v)} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
            <a onClick={() => onSolo(v)} style={{ color: '#1f4e79', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}>solo</a>
          </label>
        ))}
        {vis.length === 0 && <div style={{ color: '#999', padding: 4 }}>Sin coincidencias</div>}
      </div>
      <div style={{ textAlign: 'right', marginTop: 6 }}><button onClick={onCerrar} style={btnMini('#6b7280')}>Cerrar</button></div>
    </div>
  )
})
