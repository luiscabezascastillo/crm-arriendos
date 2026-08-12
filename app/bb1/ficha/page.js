'use client'
// VERSION: v1 · 2026-08-12 · app/bb1/ficha/page.js — BB1 (VENTAS): ficha de captura, clonada de BB2 con etiquetas de
//   venta. Bloques: Vendedor · Co-vendedor · Comprador 1 · Comprador 2 · Aval · Inmueble (precio) · Comentarios ·
//   Datos económicos (comisión vendedor/comprador, IVA/Total auto 19% editables). Recupera (?id=V00xxx) o crea
//   (?id=nuevo, siguiente V). Guardar borrador (claves limpias, merge). Candado HECHO (Desbloquear: Dirección).
//   "Terminar e informar" = paso 3 (botón puesto, aún inactivo). Acceso: Dirección + Anthony.
import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import TopNav from '../../components/ui/TopNav'

const AUTORIZADOS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'anthony.mendoza@fondocapital.com']
const DIRECCION = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const n0 = v => { const x = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return isNaN(x) ? 0 : x }
const r2 = x => { const v = Math.round(x * 100) / 100; return Number.isInteger(v) ? String(v) : String(v) }
const PERS = [['prop', 'Vendedor'], ['coprop', 'Co-vendedor'], ['arr', 'Comprador 1'], ['arr2', 'Comprador 2'], ['aval', 'Aval']]

function BB1Ficha() {
  const { data: session, status } = useSession()
  const email = session?.user?.email
  const autorizado = !!email && AUTORIZADOS.includes(email)
  const esDireccion = !!email && DIRECCION.includes(email)
  const sp = useSearchParams()
  const router = useRouter()
  const qid = sp.get('id') || 'nuevo'

  const [id, setId] = useState('')
  const [model, setModel] = useState(null)
  const [hecho, setHecho] = useState(false)
  const [existe, setExiste] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [recuperarId, setRecuperarId] = useState('')

  useEffect(() => {
    if (status !== 'authenticated' || !autorizado) return
    let vivo = true
    setCargando(true); setMsg(null)
    ;(async () => {
      try {
        let realId = qid
        if (qid === 'nuevo') {
          const jn = await (await fetch('/api/bb1/nuevo-id')).json()
          realId = jn.siguiente || 'V00001'
        }
        const j = await (await fetch('/api/bb1/recuperar?id=' + encodeURIComponent(realId))).json()
        if (!vivo) return
        if (j.error) { setMsg({ t: 'error', x: j.error }); setCargando(false); return }
        const m = j.model || {}
        if (!j.existe && !String(m.tipo || '').trim()) m.tipo = 'venta'   // por defecto en BB1
        setId(realId); setModel(m); setHecho(!!j.hecho); setExiste(!!j.existe)
      } catch (e) { if (vivo) setMsg({ t: 'error', x: String(e?.message || e) }) }
      finally { if (vivo) setCargando(false) }
    })()
    return () => { vivo = false }
  }, [status, autorizado, qid])

  const bloqueado = hecho && !esDireccion

  const setTop = (k, v) => setModel(m => ({ ...m, [k]: v }))
  const setPers = (b, k, v) => setModel(m => ({ ...m, personas: { ...m.personas, [b]: { ...m.personas[b], [k]: v } } }))
  const setInm = (k, v) => setModel(m => ({ ...m, inmueble: { ...m.inmueble, [k]: v } }))
  const setCom = (side, k, v) => setModel(m => ({ ...m, [side]: { ...m[side], [k]: v } }))
  const calcIva = (side) => setModel(m => { const neto = n0(m[side].neto); const iva = r2(neto * 0.19); const total = r2(neto + neto * 0.19); return { ...m, [side]: { ...m[side], iva, total } } })

  async function guardar(desbloquear = false) {
    if (!model) return
    setGuardando(true); setMsg(null)
    try {
      const res = await fetch('/api/bb1/guardar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, model, desbloquear }),
      })
      const j = await res.json()
      if (!res.ok || j.error) { setMsg({ t: 'error', x: j.error || ('Error ' + res.status) }); return }
      setMsg({ t: 'ok', x: (j.nuevo ? 'Operación creada' : 'Borrador guardado') + ' (' + j.id + ').' })
      setExiste(true)
      if (desbloquear) setHecho(false)
      if (qid === 'nuevo' && j.id) router.replace('/bb1/ficha?id=' + j.id)
    } catch (e) { setMsg({ t: 'error', x: String(e?.message || e) }) }
    finally { setGuardando(false) }
  }
  async function desbloquear() {
    if (!esDireccion) return
    setGuardando(true); setMsg(null)
    try {
      const res = await fetch('/api/bb1/guardar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, accion: 'desbloquear' }) })
      const j = await res.json()
      if (!res.ok || j.error) { setMsg({ t: 'error', x: j.error || ('Error ' + res.status) }); return }
      setHecho(false); setMsg({ t: 'ok', x: 'Operación desbloqueada.' })
    } catch (e) { setMsg({ t: 'error', x: String(e?.message || e) }) } finally { setGuardando(false) }
  }

  if (status === 'loading') return <div style={{ minHeight: '100vh' }}><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></div>
  if (status === 'authenticated' && !autorizado) return <div style={{ minHeight: '100vh' }}><TopNav /><div style={{ padding: 40, color: '#b91c1c' }}>BB1 está restringido a Dirección y Anthony.</div></div>

  const lblS = { fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .3 }
  const inS = d => ({ padding: '6px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12.5, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', background: d ? '#F3F4F6' : '#fff', color: d ? '#6b7280' : '#111827' })
  const card = { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, padding: 14, marginBottom: 12 }
  const titulo = c => ({ fontSize: 11, fontWeight: 800, color: c || '#0C447C', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 10 })
  const btn = (bg, dis) => ({ padding: '9px 16px', borderRadius: 8, border: 'none', background: dis ? '#cbd5e1' : bg, color: '#fff', fontSize: 13, fontWeight: 700, cursor: dis ? 'not-allowed' : 'pointer', fontFamily: 'inherit' })

  const campo = (label, val, setter, opts = {}) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 ' + (opts.w || 150) + 'px', minWidth: opts.w || 150 }}>
      <span style={lblS}>{label}</span>
      {opts.options
        ? <select value={val || ''} onChange={e => setter(e.target.value)} disabled={bloqueado} style={inS(bloqueado)}>{opts.options.map(o => <option key={o} value={o}>{o || '—'}</option>)}</select>
        : opts.area
          ? <textarea value={val || ''} onChange={e => setter(e.target.value)} disabled={bloqueado} style={{ ...inS(bloqueado), minHeight: 54, resize: 'vertical' }} />
          : <input value={val || ''} onChange={e => setter(e.target.value)} onBlur={opts.onBlur} disabled={bloqueado} style={inS(bloqueado)} />}
    </label>
  )

  const bloquePersona = (bk, label) => {
    const p = model?.personas?.[bk] || {}
    return (
      <div style={card} key={bk}>
        <div style={titulo(bk === 'aval' ? '#7c3aed' : (bk.startsWith('arr') ? '#0e7490' : '#0C447C'))}>{label}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {campo('Nombre', p.nombre, v => setPers(bk, 'nombre', v), { w: 260 })}
          {campo('Género', p.genero, v => setPers(bk, 'genero', v), { w: 90 })}
          {campo('Estado civil', p.estado, v => setPers(bk, 'estado', v), { w: 120 })}
          {campo('Nacionalidad', p.nacionalidad, v => setPers(bk, 'nacionalidad', v), { w: 120 })}
          {campo('RUT', p.rut, v => setPers(bk, 'rut', v), { w: 130 })}
          {campo('Pasaporte', p.pasaporte, v => setPers(bk, 'pasaporte', v), { w: 120 })}
          {campo('Dirección', p.direccion, v => setPers(bk, 'direccion', v), { w: 260 })}
          {campo('Comuna', p.comuna, v => setPers(bk, 'comuna', v), { w: 130 })}
          {campo('Teléfono', p.telefono, v => setPers(bk, 'telefono', v), { w: 140 })}
          {campo('Email', p.email, v => setPers(bk, 'email', v), { w: 220 })}
          {campo('Dom. laboral', p.dom_laboral, v => setPers(bk, 'dom_laboral', v), { w: 220 })}
          {campo('Empresa', p.empresa, v => setPers(bk, 'empresa', v), { w: 160 })}
        </div>
      </div>
    )
  }

  const bloqueComision = (side, label, color) => {
    const c = model?.[side] || {}
    return (
      <div style={{ ...card, marginBottom: 0, flex: '1 1 340px' }}>
        <div style={titulo(color)}>Comisión · {label}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {campo('Porcentaje', c.pct, v => setCom(side, 'pct', v), { w: 110 })}
          {campo('Neto', c.neto, v => setCom(side, 'neto', v), { w: 110, onBlur: () => calcIva(side) })}
          {campo('IVA', c.iva, v => setCom(side, 'iva', v), { w: 100 })}
          {campo('Total', c.total, v => setCom(side, 'total', v), { w: 110 })}
          {campo('Boleta/Factura', c.doc, v => setCom(side, 'doc', v), { w: 130, options: ['', 'BOLETA', 'FACTURA'] })}
          {campo('C. especiales', c.cesp, v => setCom(side, 'cesp', v), { w: 200 })}
          {campo('Comentario', c.com, v => setCom(side, 'com', v), { w: 240, area: true })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>
      <TopNav />
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: 18, fontFamily: 'system-ui, sans-serif' }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5 }}>BB1 · Ficha de venta</span>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', margin: 0 }}>{id || '…'}</h1>
            {hecho && <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, color: '#16a34a', background: '#F0FDF4', border: '1px solid #bbf7d0' }}>HECHO {esDireccion ? '' : '· solo lectura'}</span>}
            {!existe && !cargando && <span style={{ fontSize: 11, color: '#b45309' }}>nueva</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={recuperarId} onChange={e => setRecuperarId(e.target.value)} placeholder="V00xxx"
              onKeyDown={e => { if (e.key === 'Enter' && recuperarId.trim()) router.push('/bb1/ficha?id=' + recuperarId.trim().toUpperCase()) }}
              style={{ ...inS(false), width: 110 }} />
            <button onClick={() => recuperarId.trim() && router.push('/bb1/ficha?id=' + recuperarId.trim().toUpperCase())} style={btn('#334155')}>Recuperar</button>
            <button onClick={() => router.push('/bb1/ficha?id=nuevo')} style={btn('#0C447C')}>+ Nueva</button>
            <button onClick={() => router.push('/bb1')} style={{ ...btn('#e5e7eb'), color: '#374151' }}>← Listado</button>
          </div>
        </div>

        {msg && <div style={{ ...card, padding: 10, background: msg.t === 'error' ? '#fef2f2' : '#f0fdf4', color: msg.t === 'error' ? '#b91c1c' : '#166534', borderColor: msg.t === 'error' ? '#fecaca' : '#bbf7d0' }}>{msg.x}</div>}

        {cargando || !model ? <div style={{ ...card, color: '#888' }}>Cargando ficha…</div> : (
          <>
            {/* Datos de cabecera */}
            <div style={card}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {campo('Tipo de operación', model.tipo, v => setTop('tipo', v), { w: 220 })}
                {campo('Vendedor / ejecutivo', model.ejecutivo, v => setTop('ejecutivo', v), { w: 180 })}
                {campo('Fecha registro', model.fecha_registro, v => setTop('fecha_registro', v), { w: 140 })}
              </div>
            </div>

            {PERS.map(([bk, label]) => bloquePersona(bk, label))}

            {/* Inmueble */}
            <div style={card}>
              <div style={titulo('#0f766e')}>Inmueble</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {campo('Dirección', model.inmueble.direccion, v => setInm('direccion', v), { w: 300 })}
                {campo('Comuna', model.inmueble.comuna, v => setInm('comuna', v), { w: 140 })}
                {campo('Moneda', model.inmueble.moneda, v => setInm('moneda', v), { w: 100, options: ['', 'UF', 'Pesos'] })}
                {campo('Precio', model.inmueble.monto, v => setInm('monto', v), { w: 140 })}
                {campo('Fecha promesa', model.inmueble.inicio, v => setInm('inicio', v), { w: 130 })}
                {campo('Fecha escritura', model.inmueble.fin, v => setInm('fin', v), { w: 130 })}
                {campo('Bodega', model.inmueble.bodega, v => setInm('bodega', v), { w: 100 })}
                {campo('Estacionamiento', model.inmueble.estacionamiento, v => setInm('estacionamiento', v), { w: 120 })}
                {campo('Características', model.inmueble.caracteristicas, v => setInm('caracteristicas', v), { w: 300, area: true })}
              </div>
            </div>

            {/* Comentarios */}
            <div style={card}>
              <div style={titulo('#6b7280')}>Comentarios</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {campo('Comentarios', model.comentarios, v => setTop('comentarios', v), { w: 560, area: true })}
                {campo('Otros comentarios', model.otros_comentarios, v => setTop('otros_comentarios', v), { w: 300, area: true })}
              </div>
            </div>

            {/* Datos económicos */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              {bloqueComision('comD', 'Vendedor', '#0C447C')}
              {bloqueComision('comA', 'Comprador', '#0e7490')}
            </div>

            {/* Acciones */}
            <div style={{ ...card, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', position: 'sticky', bottom: 0 }}>
              {!bloqueado
                ? <button onClick={() => guardar(hecho && esDireccion)} disabled={guardando} style={btn('#16a34a', guardando)}>{guardando ? 'Guardando…' : (hecho ? '💾 Guardar (desbloqueando)' : '💾 Guardar borrador')}</button>
                : <span style={{ fontSize: 12, color: '#b45309' }}>Operación protegida (HECHO). Solo Dirección puede editar.</span>}
              {hecho && esDireccion && <button onClick={desbloquear} disabled={guardando} style={btn('#b45309', guardando)}>🔓 Desbloquear</button>}
              <button disabled title="Paso 3: enviará la facturación a Karina (cola + email). Aún no activo." style={{ ...btn('#9ca3af', true) }}>Terminar e informar · pronto</button>
              <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>Guarda en el LOG con claves limpias · no borra datos previos.</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// useSearchParams exige un límite de Suspense en el App Router (si no, falla el build).
export default function BB1FichaPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh' }}><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></div>}>
      <BB1Ficha />
    </Suspense>
  )
}
