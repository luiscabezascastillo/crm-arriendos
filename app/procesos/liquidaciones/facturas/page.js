'use client'
// VERSION: v10 · 2026-07-18 · Transferido/Diferencia leen de la RPC transferido_propietario (misma fuente que CARTAS), no de la columna liquidacion_idprop.transferido que está vacía
// VERSION: v9 · 2026-07-08 · nombre "Pxxx — Nombre" + bloque resumen por propietario (validado/enviada/transferir/dif/observaciones)
//   (facturar por grupo, fecha solo-lectura, comentario por propietario),
//   sin RUT/Comuna, propietario+inmueble juntas, excluye P y Paola. Solo 3 usuarios.
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'

// Solo Alberto, Luis, Karina (ver + editar). Nadie más entra.
const EMAILS_OK = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const PAOLA = 'P001'   // proceso separado, se excluye de esta vista

const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const aammToTxt = aamm => { if (!aamm || String(aamm).length !== 4) return aamm; const a = String(aamm).slice(0, 2), m = parseInt(String(aamm).slice(2), 10); return `${MESES_TXT[m - 1] || '?'} 20${a}` }
function mesEnCurso() { const d = new Date(); return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}` }
function listaMeses() { const out = []; const d = new Date(); for (let i = 0; i < 14; i++) { out.push(`${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`); d.setMonth(d.getMonth() - 1) } return out }
const fmtPesos = n => (n == null || n === '') ? '—' : Number(n).toLocaleString('es-CL')

const TIPO_DOC = { '33': 'Factura', '39': 'Boleta', '41': 'Boleta exenta' }
const tipoColor = t => t === '33' ? { bg: '#EEF2FF', fg: '#3730A3' } : (t === '39' || t === '41') ? { bg: '#ECFDF5', fg: '#065F46' } : { bg: '#F3F4F6', fg: '#6B7280' }

const FACT_OPCIONES = ['SI', 'NO', 'DESPUES', 'HECHO']
const factColor = f => f === 'SI' ? { bg: '#DCFCE7', fg: '#166534' } : f === 'HECHO' ? { bg: '#E0E7FF', fg: '#3730A3' } : f === 'DESPUES' ? { bg: '#FEF9C3', fg: '#854D0E' } : { bg: '#FEE2E2', fg: '#991B1B' }

// ── Autofiltro tipo Excel: flechita ▼ que abre desplegable con checkboxes ──
function FiltroExcel({ col, valores, sel, onChange, abierto, setAbierto }) {
  const [q, setQ] = useState('')
  const activo = sel && sel.size > 0 && sel.size < valores.length
  const vis = q ? valores.filter(v => String(v).toLowerCase().includes(q.toLowerCase())) : valores
  const todos = !sel || sel.size === 0 || sel.size === valores.length
  function toggle(v) {
    const s = new Set(sel && sel.size ? sel : valores)   // si vacío = todos marcados
    if (s.has(v)) s.delete(v); else s.add(v)
    onChange(s.size === valores.length ? new Set() : s)  // todos marcados = sin filtro
  }
  function marcarTodos(on) { onChange(on ? new Set() : new Set(['__none__'])) }
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span onClick={e => { e.stopPropagation(); setAbierto(abierto === col ? null : col) }}
        style={{ cursor: 'pointer', marginLeft: 4, color: activo ? '#A5F3FC' : '#9CA3AF', fontSize: 11, userSelect: 'none' }}
        title="Filtrar">{activo ? '▼●' : '▼'}</span>
      {abierto === col && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 20, left: 0, zIndex: 50, background: '#fff', border: '1px solid #CBD5E1', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', width: 240, color: '#1a1a2e', fontWeight: 400 }}>
          <div style={{ padding: 8, borderBottom: '1px solid #EEE' }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…" style={{ width: '100%', fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid #D1D5DB' }} />
          </div>
          <div style={{ padding: '4px 8px', borderBottom: '1px solid #EEE', display: 'flex', gap: 10, fontSize: 11 }}>
            <span onClick={() => marcarTodos(true)} style={{ cursor: 'pointer', color: '#2563EB' }}>Todos</span>
            <span onClick={() => marcarTodos(false)} style={{ cursor: 'pointer', color: '#2563EB' }}>Ninguno</span>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', padding: 4 }}>
            {vis.map(v => {
              const marcado = todos || (sel && sel.has(v))
              return (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!marcado} onChange={() => toggle(v)} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(v) || '(vacío)'}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </span>
  )
}

export default function FacturasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email || ''
  const rol = session?.user?.role || ''

  const [accesoOk, setAccesoOk] = useState(null)
  const [mes, setMes] = useState(mesEnCurso())
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [lineas, setLineas] = useState([])       // filas por inmueble (liquidacion_idadmon)
  const [propMap, setPropMap] = useState({})     // idprop -> {facturar, fecha_emision, comentario, cerrado, ...}
  const [actualizado, setActualizado] = useState(null)
  const [buscar, setBuscar] = useState('')
  const [guardando, setGuardando] = useState('')  // idprop en curso de guardado
  const [editCom, setEditCom] = useState(null)    // idprop cuyo comentario se edita
  const [comTexto, setComTexto] = useState('')
  const [limite, setLimite] = useState(10)         // >= limite inmuebles -> parte factura en 2
  const [generando, setGenerando] = useState(false)
  const [resumenGen, setResumenGen] = useState(null)
  const [csvGen, setCsvGen] = useState({ facturas: '', boletas: '' })  // CSV generados, para redescargar
  const [fCol, setFCol] = useState({ idadmon: new Set(), propietario: new Set(), inmueble: new Set() })  // filtros por columna
  const [filtroAbierto, setFiltroAbierto] = useState(null)  // qué columna tiene el desplegable abierto

  // Descargar un CSV como archivo
  function descargarCSV(contenido, nombre) {
    if (!contenido) return
    const blob = new Blob(['\ufeff' + contenido], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = nombre; a.click()
    URL.revokeObjectURL(url)
  }

  async function generarCSV() {
    if (generando) return
    setGenerando(true); setError(null); setResumenGen(null)
    try {
      const res = await fetch('/api/liquidaciones/generar-csv', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, limite }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Error al generar'); setGenerando(false); return }
      // guardar los CSV para poder redescargar con botones si el navegador bloquea alguno
      setCsvGen({ facturas: d.facturas_csv || '', boletas: d.boletas_csv || '' })
      // descargar los dos, con un pequeño retardo entre ambos (Chrome bloquea descargas dobles simultáneas)
      if (d.facturas_csv) descargarCSV(d.facturas_csv, `facturas_33_${mes}.csv`)
      if (d.boletas_csv) {
        setTimeout(() => descargarCSV(d.boletas_csv, `boletas_39_${mes}.csv`), 800)
      }
      setResumenGen(d.resumen)
      // recargar para ver los HECHO actualizados
      cargar(mes)
    } catch (err) {
      setError(String(err?.message || err))
    }
    setGenerando(false)
  }

  // Acceso: SOLO los tres emails (o rol admin). Nadie más.
  useEffect(() => {
    if (status !== 'authenticated' || !email) return
    const ok = (rol === 'admin' || EMAILS_OK.includes(email))
    setAccesoOk(ok)
  }, [status, email, rol])
  useEffect(() => { if (accesoOk === false) router.replace('/') }, [accesoOk, router])
  useEffect(() => { if (accesoOk === true) cargar(mes) }, [accesoOk])

  async function cargar(m) {
    setCargando(true); setError(null); setLineas([]); setPropMap({})
    try {
      // Lee de las tablas CONGELADAS (no en vivo). Requiere haber "Preparado mes" antes.
      // El "Transferido" NO se lee de liquidacion_idprop.transferido (esa columna no se
      // puebla y queda null): se toma de la MISMA RPC que usa CARTAS (transferido_propietario),
      // para que ambas vistas muestren el mismo dato y la decisión de facturar sea correcta.
      const [rLin, rProp, rTransf] = await Promise.all([
        supabase.from('liquidacion_idadmon')
          .select('idadmon, idprop, propietario, inmueble, a_cobrar, comision, iva, estado, observaciones')
          .eq('mes', m),
        supabase.from('liquidacion_idprop')
          .select('idprop, nombre, tipo_factura, facturar, fecha_emision, comentario, cerrado, total_comision, total_a_transferir, transferido, transfer_validado, enviada_at')
          .eq('mes', m),
        supabase.rpc('transferido_propietario', { p_mes: m }),
      ])
      if (rLin.error) { setError('lineas: ' + rLin.error.message); setCargando(false); return }
      if (rProp.error) { setError('propietarios: ' + rProp.error.message); setCargando(false); return }

      // Mapa idprop -> transferido real (RPC). Mismo cálculo que CARTAS.
      const transfMap = {}
      for (const t of rTransf.data || []) transfMap[t.idprop] = Number(t.transferido) || 0

      const pm = {}
      for (const p of rProp.data || []) pm[p.idprop] = { ...p, _transf: transfMap[p.idprop] || 0 }

      // Observaciones de Alberto: vienen por línea en liquidacion_idadmon.
      // Se recopilan por propietario (la primera no vacía de cada idprop).
      for (const l of rLin.data || []) {
        if (l.observaciones && pm[l.idprop] && !pm[l.idprop]._obs) {
          pm[l.idprop] = { ...pm[l.idprop], _obs: l.observaciones }
        }
      }

      // Filtrar: fuera Paola (P001) y fuera estado P (desocupados no se facturan)
      const lin = (rLin.data || [])
        .filter(l => l.idprop !== PAOLA)
        .filter(l => (l.estado || '').toUpperCase() !== 'P')
        // orden Propietario -> Inmueble
        .sort((a, b) => {
          const pa = (a.propietario || '').localeCompare(b.propietario || '', 'es', { sensitivity: 'base' })
          return pa !== 0 ? pa : (a.inmueble || '').localeCompare(b.inmueble || '', 'es', { sensitivity: 'base' })
        })

      setLineas(lin)
      setPropMap(pm)
      setActualizado(new Date())
      if (lin.length === 0) setError(`No hay datos congelados para ${aammToTxt(m)}. Usa "Preparar mes" en TRANSFER primero.`)
    } catch (err) {
      setError(String(err?.message || err))
    }
    setCargando(false)
  }

  // Guardar facturar (aplica a TODO el propietario) o comentario
  async function guardar(idprop, campos) {
    setGuardando(idprop)
    try {
      const res = await fetch('/api/liquidaciones/facturar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, idprop, ...campos }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Error al guardar'); setGuardando(''); return }
      // actualizar en memoria (todas las filas del propietario reflejan el cambio)
      setPropMap(prev => ({ ...prev, [idprop]: { ...prev[idprop], ...campos } }))
    } catch (err) {
      setError(String(err?.message || err))
    }
    setGuardando('')
  }

  if (accesoOk === null || status === 'loading') return <div style={{ padding: 40, fontSize: 14, color: '#666' }}>Comprobando acceso…</div>
  if (accesoOk === false) return null

  const q = buscar.trim().toLowerCase()
  const pasaCol = (f) => {
    if (fCol.idadmon.size && !fCol.idadmon.has(f.idadmon)) return false
    if (fCol.propietario.size && !fCol.propietario.has(f.propietario || '')) return false
    if (fCol.inmueble.size && !fCol.inmueble.has(f.inmueble || '')) return false
    return true
  }
  const visibles = (q ? lineas.filter(f => (f.propietario + ' ' + f.inmueble + ' ' + f.idadmon + ' ' + f.idprop).toLowerCase().includes(q)) : lineas).filter(pasaCol)

  // valores únicos para cada filtro (de todas las líneas, ordenados)
  const uniq = (key) => [...new Set(lineas.map(l => l[key] || ''))].sort((a, b) => String(a).localeCompare(String(b), 'es'))
  const valIdadmon = uniq('idadmon'), valProp = uniq('propietario'), valInmueble = uniq('inmueble')

  // Totales
  const totComision = visibles.reduce((s, f) => s + (Number(f.comision) || 0), 0)
  const totIva = visibles.reduce((s, f) => s + (Number(f.iva) || 0), 0)
  const idpropsVis = [...new Set(visibles.map(f => f.idprop))]
  const nFactura = idpropsVis.filter(ip => propMap[ip]?.tipo_factura === '33').length
  const nBoleta = idpropsVis.filter(ip => ['39', '41'].includes(propMap[ip]?.tipo_factura)).length

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px 60px', fontFamily: 'system-ui, -apple-system, sans-serif' }}
      onClick={() => setFiltroAbierto(null)}>

      {/* Zona superior FIJA al hacer scroll: navegación + controles */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#F7F6F2', paddingTop: 8, paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid #E8E6DF' }}>
      {/* Barra navegación */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <button onClick={() => router.push('/procesos/liquidaciones')} style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#2C2C2A', cursor: 'pointer' }}>← TRANSFER</button>
        <button onClick={() => router.push('/procesos/liquidaciones/cartas')} style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#3730A3', cursor: 'pointer' }}>📄 CARTAS</button>
        <button onClick={() => router.push('/procesos/liquidaciones/faltan')} style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer' }}>⚠ FALTAN</button>
        <button onClick={() => router.push('/procesos/liquidaciones/emails')} style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#065F46', cursor: 'pointer' }}>✉ EMAILS</button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>🧾 FACTURAS · preparación SimpleFactura</h1>
      </div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
        Facturación de <b>{aammToTxt(mes)}</b> por inmueble. El estado <b>SI/NO/DESPUÉS/HECHO</b> y el comentario son por propietario (se aplican a todos sus inmuebles).
        {actualizado && <> Actualizado el <b>{actualizado.toLocaleString('es-CL')}</b>.</>}
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ fontSize: 14, color: '#444' }}>Mes:</label>
        <select value={mes} onChange={e => setMes(e.target.value)} style={{ fontSize: 14, padding: '7px 10px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff' }}>
          {listaMeses().map(m => <option key={m} value={m}>{aammToTxt(m)}</option>)}
        </select>
        <button onClick={() => cargar(mes)} disabled={cargando} style={{ fontSize: 14, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: cargando ? 'default' : 'pointer', opacity: cargando ? 0.6 : 1 }}>{cargando ? '⏳ Cargando…' : '🔄 Recargar'}</button>
        <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar propietario, inmueble, IDADMON…" style={{ fontSize: 14, padding: '8px 12px', borderRadius: 8, border: '1px solid #D3D1C7', minWidth: 200, flex: '0 1 240px' }} />
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 13, color: '#666' }} title="Si un propietario tiene este nº de inmuebles o más, su factura se parte en dos">Máx líneas/doc:</label>
        <input type="number" value={limite} min={2} onChange={e => setLimite(Number(e.target.value) || 10)}
          style={{ fontSize: 14, padding: '7px 8px', borderRadius: 8, border: '1px solid #D3D1C7', width: 60 }} />
        <button onClick={generarCSV} disabled={generando}
          style={{ fontSize: 14, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6D28D9', color: '#fff', cursor: generando ? 'default' : 'pointer', opacity: generando ? 0.6 : 1 }}>
          {generando ? '⏳ Generando…' : '⬇ Generar CSV SimpleFactura'}
        </button>
      </div>
      </div>{/* fin zona sticky */}

      {resumenGen && (
        <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#5B21B6' }}>
          <b>CSV generados.</b>{' '}
          Facturas (33): {resumenGen.facturas?.propietarios || 0} propietarios · {resumenGen.facturas?.docs || 0} docs · {resumenGen.facturas?.lineas || 0} líneas.{' '}
          Boletas (39): {resumenGen.boletas?.propietarios || 0} propietarios · {resumenGen.boletas?.docs || 0} docs · {resumenGen.boletas?.lineas || 0} líneas.
          {resumenGen.partidos?.length > 0 && <div style={{ marginTop: 4 }}>Partidos en 2: {resumenGen.partidos.map(x => `${x.propietario} (${x.inmuebles})`).join(', ')}.</div>}
          {resumenGen.aviso && <div>{resumenGen.aviso}</div>}
          {(csvGen.facturas || csvGen.boletas) && (
            <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
              <span style={{ color: '#6B7280', fontSize: 12 }}>¿No se descargó algún archivo? Descárgalo aquí:</span>
              {csvGen.facturas && <span onClick={() => descargarCSV(csvGen.facturas, `facturas_33_${mes}.csv`)} style={{ cursor: 'pointer', color: '#6D28D9', fontWeight: 600, fontSize: 12, textDecoration: 'underline' }}>⬇ facturas_33</span>}
              {csvGen.boletas && <span onClick={() => descargarCSV(csvGen.boletas, `boletas_39_${mes}.csv`)} style={{ cursor: 'pointer', color: '#6D28D9', fontWeight: 600, fontSize: 12, textDecoration: 'underline' }}>⬇ boletas_39</span>}
            </div>
          )}
        </div>
      )}

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{error}</div>}

      {/* Tarjetas */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: '1 1 150px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 12, padding: '14px 18px' }}><div style={{ fontSize: 13, color: '#6D28D9' }}>Líneas</div><div style={{ fontSize: 26, fontWeight: 700, color: '#5B21B6' }}>{visibles.length}</div></div>
        <div style={{ flex: '1 1 150px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '14px 18px' }}><div style={{ fontSize: 13, color: '#3730A3' }}>Propietarios factura (33)</div><div style={{ fontSize: 26, fontWeight: 700, color: '#3730A3' }}>{nFactura}</div></div>
        <div style={{ flex: '1 1 150px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: '14px 18px' }}><div style={{ fontSize: 13, color: '#065F46' }}>Propietarios boleta (39/41)</div><div style={{ fontSize: 26, fontWeight: 700, color: '#065F46' }}>{nBoleta}</div></div>
        <div style={{ flex: '1 1 150px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 18px' }}><div style={{ fontSize: 13, color: '#6B7280' }}>Admon (comisión)</div><div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>${fmtPesos(totComision)}</div></div>
        <div style={{ flex: '1 1 150px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 18px' }}><div style={{ fontSize: 13, color: '#6B7280' }}>IVA</div><div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>${fmtPesos(totIva)}</div></div>
      </div>

      {/* Tabla: filas por inmueble, columnas juntas, sin RUT/Comuna, + 3 columnas nuevas */}
      <div style={{ overflowX: 'auto', border: '1px solid #ECEAE3', borderRadius: 12 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, minWidth: 980 }}>
          <thead>
            <tr style={{ background: '#1a1a2e', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '10px 10px', fontWeight: 600 }}>
                IdAdmon<FiltroExcel col="idadmon" valores={valIdadmon} sel={fCol.idadmon} onChange={s => setFCol(p => ({ ...p, idadmon: s }))} abierto={filtroAbierto} setAbierto={setFiltroAbierto} />
              </th>
              <th style={{ padding: '10px 10px', fontWeight: 600 }}>
                Propietario<FiltroExcel col="propietario" valores={valProp} sel={fCol.propietario} onChange={s => setFCol(p => ({ ...p, propietario: s }))} abierto={filtroAbierto} setAbierto={setFiltroAbierto} />
              </th>
              <th style={{ padding: '10px 10px', fontWeight: 600 }}>
                Inmueble<FiltroExcel col="inmueble" valores={valInmueble} sel={fCol.inmueble} onChange={s => setFCol(p => ({ ...p, inmueble: s }))} abierto={filtroAbierto} setAbierto={setFiltroAbierto} />
              </th>
              <th style={{ padding: '10px 10px', fontWeight: 600, textAlign: 'right' }}>Admon</th>
              <th style={{ padding: '10px 10px', fontWeight: 600, textAlign: 'right' }}>IVA</th>
              <th style={{ padding: '10px 10px', fontWeight: 600, textAlign: 'center' }}>Tipo</th>
              <th style={{ padding: '10px 10px', fontWeight: 600, textAlign: 'center' }}>Facturar</th>
              <th style={{ padding: '10px 10px', fontWeight: 600, textAlign: 'center' }}>Fecha emisión</th>
              <th style={{ padding: '10px 10px', fontWeight: 600 }}>Comentario</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && !cargando && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Sin datos para {aammToTxt(mes)}.</td></tr>
            )}
            {visibles.map((f, i) => {
              const prev = visibles[i - 1]
              const sig = visibles[i + 1]
              const nuevoProp = !prev || prev.idprop !== f.idprop
              const ultimaDelProp = !sig || sig.idprop !== f.idprop
              const p = propMap[f.idprop] || {}
              const tc = tipoColor(p.tipo_factura)
              const fact = p.facturar || 'NO'
              const fc = factColor(fact)
              const cerrado = !!p.cerrado
              // datos del bloque de resumen (informativo, para conocer la historia antes de facturar)
              const aTransf = Number(p.total_a_transferir) || 0
              const transf = Number(p._transf) || 0   // de la RPC (igual que CARTAS), no de la columna vacía
              const dif = aTransf - transf
              const validado = p.transfer_validado || ''
              const enviada = p.enviada_at
              const obs = p._obs || ''
              return ([
                <tr key={f.idadmon + '_' + i} style={{ borderTop: nuevoProp ? '2px solid #DDD6FE' : '1px solid #F0EEE8', background: nuevoProp ? '#FBFAFF' : '#fff' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1a1a2e' }}>{f.idadmon}</td>
                  <td style={{ padding: '8px 10px', fontWeight: nuevoProp ? 600 : 400, color: '#1a1a2e', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${f.idprop} — ${f.propietario}`}>{nuevoProp ? `${f.idprop} — ${f.propietario}` : ''}</td>
                  <td style={{ padding: '8px 10px', color: '#444', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.inmueble}>{f.inmueble}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{fmtPesos(f.comision)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#666' }}>{fmtPesos(f.iva)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: tc.bg, color: tc.fg, whiteSpace: 'nowrap' }}>{p.tipo_factura || '?'}{TIPO_DOC[p.tipo_factura] ? ' · ' + TIPO_DOC[p.tipo_factura] : ''}</span>
                  </td>
                  {/* Facturar: editable, aplica a TODO el propietario. Solo en la primera fila del grupo. */}
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    {nuevoProp ? (
                      <select value={fact} disabled={cerrado || guardando === f.idprop}
                        onChange={e => guardar(f.idprop, { facturar: e.target.value })}
                        style={{ fontSize: 12, fontWeight: 700, padding: '3px 6px', borderRadius: 8, border: 'none', background: fc.bg, color: fc.fg, cursor: cerrado ? 'default' : 'pointer' }}>
                        {FACT_OPCIONES.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : <span style={{ fontSize: 11, color: '#C7C4BC' }}>↑</span>}
                  </td>
                  {/* Fecha emisión: solo lectura (se rellena al generar el archivo) */}
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: '#666', fontSize: 12 }}>
                    {nuevoProp ? (p.fecha_emision ? new Date(p.fecha_emision).toLocaleString('es-CL') : '—') : ''}
                  </td>
                  {/* Comentario: editable, por propietario. Solo en la primera fila del grupo. */}
                  <td style={{ padding: '8px 10px', maxWidth: 220 }}>
                    {nuevoProp ? (
                      editCom === f.idprop ? (
                        <input autoFocus value={comTexto} onChange={e => setComTexto(e.target.value)}
                          onBlur={() => { guardar(f.idprop, { comentario: comTexto }); setEditCom(null) }}
                          onKeyDown={e => { if (e.key === 'Enter') { guardar(f.idprop, { comentario: comTexto }); setEditCom(null) } }}
                          style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid #A5B4FC', width: '100%' }} />
                      ) : (
                        <span onClick={() => { if (!cerrado) { setEditCom(f.idprop); setComTexto(p.comentario || '') } }}
                          style={{ fontSize: 12, color: p.comentario ? '#444' : '#C7C4BC', cursor: cerrado ? 'default' : 'text', display: 'inline-block', minWidth: 60 }}
                          title={cerrado ? 'Mes cerrado' : 'Clic para editar'}>
                          {p.comentario || (cerrado ? '—' : '✎ comentar')}
                        </span>
                      )
                    ) : ''}
                  </td>
                </tr>,
                /* Bloque de resumen informativo (solo en la última fila del propietario):
                   estado validación + enviada + A transferir / Transferido / Diferencia + Observaciones de Alberto.
                   Es solo para conocer la historia antes de decidir facturar. */
                ultimaDelProp ? (
                  <tr key={f.idadmon + '_' + i + '_resumen'} style={{ background: '#FBFAFF' }}>
                    <td colSpan={9} style={{ padding: '6px 14px 12px', borderBottom: '2px solid #DDD6FE' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
                        {validado && <span style={{ fontWeight: 700, color: '#166534' }}>✓ {validado}</span>}
                        {enviada && <span style={{ fontWeight: 600, color: '#065F46', background: '#ECFDF5', padding: '2px 8px', borderRadius: 10 }}>✉ Enviada · {new Date(enviada).toLocaleString('es-CL')}</span>}
                        <span style={{ color: '#6B7280' }}>A transferir: <b style={{ color: '#1a1a2e' }}>{fmtPesos(aTransf)}</b></span>
                        <span style={{ color: '#6B7280' }}>Transferido: <b style={{ color: '#1a1a2e' }}>{fmtPesos(transf)}</b></span>
                        <span style={{ color: '#6B7280' }}>Diferencia: <b style={{ color: dif === 0 ? '#166534' : '#B91C1C' }}>{fmtPesos(dif)}</b></span>
                        {obs && <span style={{ color: '#6D28D9', fontStyle: 'italic' }}>📝 {obs}</span>}
                      </div>
                    </td>
                  </tr>
                ) : null
              ])
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 12 }}>
        Lee de los datos congelados (liquidacion_idadmon / liquidacion_idprop). El "Facturar" y el comentario se guardan por propietario. La generación del archivo SimpleFactura y la fecha de emisión se añadirán en la siguiente fase.
      </div>
    </div>
  )
}