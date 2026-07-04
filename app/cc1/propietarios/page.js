'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { supabase } from '../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const ROLES_EDIT = ['admin', 'legal', 'operaciones']
const EMAILS_OK = [
  'luis.cabezas@fondocapital.com', 'alberto.cabezas@fondocapital.com',
  'anthony.mendoza@fondocapital.com', 'adalis@fondocapital.com', 'fabiola.guerra@fondocapital.com',
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

export default function PropietariosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role
  const [puedeEditar, setPuedeEditar] = useState(null)
  const [rows, setRows] = useState([])
  const [cargando, setCargando] = useState(true)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)     // {modo:'crear'|'editar', campos:{...}, idprop}
  const [opcAbierto, setOpcAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (status !== 'authenticated' || !email) return
    setPuedeEditar(ROLES_EDIT.includes(rol) || EMAILS_OK.includes(email))
  }, [status, email, rol])
  useEffect(() => { if (puedeEditar === false) { const t = setTimeout(() => router.replace('/'), 2500); return () => clearTimeout(t) } }, [puedeEditar, router])

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
    setMsg(null); setOpcAbierto(false)
    const campos = {}; TODOS.forEach(k => campos[k] = '')
    campos.activo = 'SI'
    setEdit({ modo: 'crear', idprop: proximoIdprop(), campos })
  }
  function abrirEditar(r) {
    setMsg(null); setOpcAbierto(false)
    const campos = {}; TODOS.forEach(k => campos[k] = r[k] ?? '')
    setEdit({ modo: 'editar', idprop: r.idprop, campos })
  }

  async function guardar() {
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
  const visibles = !filtro ? rows : rows.filter(r =>
    ['idprop', 'propietario', 'rut', 'mail1', 'comuna'].some(k => String(r[k] || '').toLowerCase().includes(filtro)))

  if (status === 'loading' || puedeEditar === null) return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (puedeEditar === false) return (<><TopNav /><div style={{ padding: 40, color: '#991B1B' }}>Sin acceso. Esta sección es solo para Dirección, Legal y Administración. Redirigiendo…</div></>)

  const inp = { width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '7px 9px', border: '1px solid #D1D5DB', borderRadius: 7, fontFamily: 'inherit' }
  const lbl = { fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }

  const renderCampo = (f) => {
    const val = edit.campos[f.k] ?? ''
    let control
    if (f.sel) {
      const opts = f.sel.includes(val) ? f.sel : [...f.sel, val]
      control = <select value={val} onChange={e => setCampo(f.k, e.target.value)} style={inp}>
        {opts.map(o => <option key={o} value={o}>{o === '' ? '—' : o}</option>)}
      </select>
    } else if (f.ta) {
      control = <textarea value={val} onChange={e => setCampo(f.k, e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
    } else {
      control = <input value={val} onChange={e => setCampo(f.k, e.target.value)} style={inp} />
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
          <button onClick={abrirNuevo}
            style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer' }}>
            + Nuevo propietario
          </button>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>{rows.length} propietarios · edición: Dirección, Legal y Administración.</div>

        <input placeholder="Buscar por idprop, nombre, RUT, email o comuna…" value={q} onChange={e => setQ(e.target.value)}
          style={{ width: '100%', maxWidth: 460, boxSizing: 'border-box', fontSize: 13, padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 9, marginBottom: 14 }} />

        {cargando ? <div style={{ color: '#888', padding: 20 }}>Cargando…</div> : (
          <div style={{ border: '1px solid #E8E6E0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1.6fr 110px 1.4fr 1fr 70px 90px', gap: 0, background: '#334155', color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {['IdProp', 'Propietario', 'RUT', 'Email', 'Comuna', 'Activo', ''].map((h, i) => <div key={i} style={{ padding: '10px 12px' }}>{h}</div>)}
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
                    <button onClick={() => abrirEditar(r)} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 7, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#3730A3', cursor: 'pointer' }}>Editar</button>
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
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>{edit.modo === 'crear' ? 'Nuevo propietario' : 'Editar propietario'}</div>
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
              <button onClick={() => !guardando && setEdit(null)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: guardando ? '#9CA3AF' : '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: guardando ? 'wait' : 'pointer' }}>
                {guardando ? 'Guardando…' : (edit.modo === 'crear' ? 'Crear propietario' : 'Guardar cambios')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
