'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']

const norm = s => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const up = s => (s || '').toString().toUpperCase().replace(/\s+/g, ' ').trim()
const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const fmtPesos = n => { const v = Number(n); if (isNaN(v) || n === null || n === '') return '—'; return '$' + v.toLocaleString('es-CL') }
const fmtFecha = s => { if (!s) return '—'; const str = String(s); if (/^\d{4}-\d{2}-\d{2}/.test(str)) { const [y, m, d] = str.slice(0, 10).split('-'); return `${d}/${m}/${y}` } return str }

function familiaDe(tipo) {
  const t = up(tipo)
  if (['SERVICIOS', 'IMPUESTOS', 'COSTES-CC2'].includes(t)) return 'servicios'
  if (['ARREGLOS', 'LIMPIEZAS'].includes(t)) return 'reparaciones'
  if (['MULTAS', 'DEMANDAS', 'DEUDAS', 'DESCUENTO'].includes(t)) return 'financiero'
  if (['NOTARIOS', 'CORRETAJES', 'SEGUROS', 'SALVOCONDUCTO', 'TERMINO'].includes(t)) return 'gestion'
  if (['GARANTIAS', 'DEVOLUCIONES'].includes(t)) return 'garantia'
  return 'otros'
}
function estadoTarea(t) {
  if (!t) return 'pendiente'
  if (t.fecha_cierre) return 'hecho'
  const e = up(t.estado)
  if (['COMPLETADO', 'COMPLETADA', 'HECHO', 'HECHA', 'CERRADO', 'CERRADA', 'OK', 'DONE', 'FINALIZADO', 'FINALIZADA', 'TERMINADO', 'TERMINADA', 'REALIZADO', 'REALIZADA', 'SI'].includes(e)) return 'hecho'
  if (['ACTIVO', 'EN CURSO', 'EN_CURSO', 'EN PROGRESO', 'EN_PROGRESO', 'PROCESO', 'CURSO'].includes(e)) return 'curso'
  return 'pendiente'
}

// conceptos fijos por bloque (plantilla). 'Arreglos presupuesto' es automatico.
const PLANTILLA = {
  garantia: ['Balance de pagos del arrendatario', 'Intereses de retraso en pagos', 'Multas aplicables (si procede)', 'Pérdida de garantía', 'Otros Liquidación 1', 'Otros Liquidación 2'],
  servicios: ['Gastos Comunes Atrasados', 'Gastos Comunes Pendientes', 'Luz', 'Agua', 'Acuerdos especiales deudas', 'Otros Servicios 1', 'Otros Servicios 2'],
  reparaciones: ['Arreglos presupuesto', 'Reparaciones extras', 'Limpieza General del dpto.', 'Mantención de TERMO', 'Limpieza de alfombras', 'Otros Reparaciones 1', 'Otros Reparaciones 2', 'Otros Reparaciones 3'],
}
const AUTO_CONCEPTO = 'Arreglos presupuesto'
const FORM_T = { fecha_entrega: '', valoracion_legal: '', decision_actuacion: '', lectura_agua: '', lectura_luz: '', markup_fcr: '', comentarios_arrendatario: '', comentarios_internos: '' }

function calcResult(L, markup, garantia, repPresu, quien) {
  const sumB = b => (L[b] || []).reduce((a, l) => a + (l.auto ? repPresu : n0(l.monto)), 0)
  const sg = sumB('garantia'), ss = sumB('servicios'), sr = sumB('reparaciones')
  const totalCargos = sg + ss + sr + n0(markup)
  const resultado = n0(garantia) - totalCargos
  const conSaldo = resultado >= 0
  const esFCR = up(quien).includes('FCR')
  const tipo = `T-${conSaldo ? 'CON' : 'SIN'} SALDO-${esFCR ? 'FCR' : 'DUENO'}`
  return { sg, ss, sr, markup: n0(markup), garantia: n0(garantia), totalCargos, resultado, conSaldo, esFCR, tipo }
}

export default function TerminosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role

  const [accesoOk, setAccesoOk] = useState(null)
  const [modo, setModo] = useState('lista')
  const [listaIds, setListaIds] = useState([])
  const [listaCargada, setListaCargada] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtros, setFiltros] = useState({ idadmon: '', fecha_entrega: '', propietario: '', arrendatario: '', inmueble: '', estado: 'Q' })
  const [sortCol, setSortCol] = useState('idadmon')
  const [sortDir, setSortDir] = useState('desc')

  const [idadmonSel, setIdadmonSel] = useState('')
  const [panel, setPanel] = useState(null)
  const [loadingPanel, setLoadingPanel] = useState(false)
  const [nodos, setNodos] = useState([])
  const [wfExpandido, setWfExpandido] = useState(false)
  const [lineas, setLineas] = useState({ garantia: [], servicios: [], reparaciones: [] })

  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState(FORM_T)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [completandoWf, setCompletandoWf] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated' || !email) return
    if (rol === 'admin' || DIRECCION_EMAILS.includes(email)) { setAccesoOk(true); return }
    supabase.from('proceso_permisos').select('proceso').eq('email', email).eq('activo', true)
      .then(({ data }) => setAccesoOk(!!(data || []).some(p => (p.proceso || '').toLowerCase().includes('termino'))))
  }, [status, email, rol])
  useEffect(() => { if (accesoOk === false) router.replace('/') }, [accesoOk, router])
  useEffect(() => { if (accesoOk === true) { cargarLista(); cargarNodos() } }, [accesoOk])

  async function completarPaso(nodo) {
    if (!nodo) return
    if (!panel?.instanceId) { setMsg('Este término no tiene instancia de workflow.'); return }
    const comentario = window.prompt('Comentario para completar ' + nodo.codigo + ' · ' + nodo.nombre + ' (opcional):', '')
    if (comentario === null) return
    setCompletandoWf(true); setMsg(null)
    try {
      const res = await fetch('/api/workflow/completar-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_instance_id: panel.instanceId,
          node_codigo: nodo.codigo,
          comentarios: comentario || null,
          usuario_email: email,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setMsg('Error: ' + (data.error || res.status)); setCompletandoWf(false); return }
      await abrir(idadmonSel)
      setMsg('Paso ' + nodo.codigo + ' completado.')
    } catch (e) {
      setMsg('Error: ' + e.message)
    }
    setCompletandoWf(false)
  }

  async function cargarNodos() {
    const { data } = await supabase.from('workflow_nodes').select('codigo, nombre, area_responsable, orden_visual').eq('workflow_codigo', 'TERMINO').order('orden_visual')
    setNodos(data || [])
  }
  async function cargarLista() {
    // Origen: datos_arriendos por estado de termino (Q en espera, N_DICOM derivados). No 'descuentos'.
    const ESTADOS_TERMINO = ['Q', 'N_DICOM']
    const { data: da } = await supabase
      .from('datos_arriendos')
      .select('idadmon, arrendatario, inmueble, estado, propietario')
      .in('estado', ESTADOS_TERMINO)
    const base = (da || [])
      .map(r => ({ idadmon: (r.idadmon || '').trim(), arrendatario: r.arrendatario, inmueble: r.inmueble, estado: r.estado, propietario: r.propietario }))
      .filter(r => r.idadmon)
    // cruzar fecha_entrega desde 'terminos'
    const ids = base.map(r => r.idadmon)
    const fechas = {}
    for (let i = 0; i < ids.length; i += 300) {
      const { data: tt } = await supabase.from('terminos').select('idadmon, fecha_entrega').in('idadmon', ids.slice(i, i + 300))
      ;(tt || []).forEach(t => { fechas[(t.idadmon || '').trim()] = t.fecha_entrega })
    }
    base.forEach(r => { r.fecha_entrega = fechas[r.idadmon] || null })
    setListaIds(base.sort((a, b) => a.idadmon.localeCompare(b.idadmon)))
    setListaCargada(true)
  }

  async function abrir(idadmon) {
    setLoadingPanel(true); setIdadmonSel(idadmon); setModo('panel'); setPanel(null); setEditando(false); setMsg(null); setWfExpandido(false)
    const [arrRes, descRes, presRes, termRes, linRes, instRes, ggccRes, cuentasRes] = await Promise.all([
      supabase.from('datos_arriendos').select('*').eq('idadmon', idadmon).limit(1),
      supabase.from('descuentos').select('id, num, fecha, tipo, repercutir_a, monto_a_imputar, texto_explicativo_para_carta_a_propietario').eq('idadmon', idadmon).like('repercutir_a', 'T-%'),
      supabase.from('presupuestos').select('id, numero, fecha, neto, iva, total, descripcion').eq('id_admon_new', idadmon),
      supabase.from('terminos').select('*').eq('idadmon', idadmon).limit(1),
      supabase.from('termino_lineas').select('*').eq('idadmon', idadmon).order('orden'),
      supabase.from('workflow_instances').select('id').eq('idadmon', idadmon).eq('workflow_codigo', 'TERMINO').limit(1),
      supabase.from('ggcc_agua_luz').select('id, aamm, mes, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua').eq('idadmon', idadmon).order('aamm', { ascending: false }).limit(1),
      supabase.from('cuentas').select('cargo, abono').eq('idadmon', idadmon),
    ])
    const ggcc = (ggccRes.data && ggccRes.data[0]) || null
    const cuentasMovs = cuentasRes ? (cuentasRes.data || []) : []
    const balanceCuentas = cuentasMovs.reduce((a, r) => a + n0(r.cargo) - n0(r.abono), 0)
    const arriendo = (arrRes.data && arrRes.data[0]) || null
    const descuentos = descRes.data || []
    const presupuestos = presRes.data || []
    let detalle = []
    if (presupuestos.length) {
      const { data: det } = await supabase.from('presupuesto_detalle').select('presupuesto_id, orden, descripcion, cantidad, coste_unit, base_imponible, iva, total').in('presupuesto_id', presupuestos.map(p => p.id)).order('orden')
      detalle = det || []
    }
    let wfTasks = []
    const inst = (instRes.data && instRes.data[0]) || null
    if (inst) {
      const { data: tk } = await supabase.from('workflow_tasks').select('node_codigo, estado, responsable, fecha_inicio, fecha_limite, fecha_cierre').eq('workflow_instance_id', inst.id)
      wfTasks = tk || []
    }
    const t = (termRes.data && termRes.data[0]) || null
    const saved = linRes.data || []
    const g = (k, d = '') => (t && t[k] != null ? t[k] : d)
    setForm({
      fecha_entrega: t?.fecha_entrega ? String(t.fecha_entrega).slice(0, 10) : '',
      valoracion_legal: g('valoracion_legal'), decision_actuacion: g('decision_actuacion'),
      lectura_agua: g('lectura_agua'), lectura_luz: g('lectura_luz'), markup_fcr: g('markup_fcr'),
      comentarios_arrendatario: g('comentarios_arrendatario'), comentarios_internos: g('comentarios_internos'),
    })

    const repPresu = presupuestos.reduce((a, p) => a + n0(p.total), 0)
    const arreglosRef = presupuestos.map(p => p.numero).filter(Boolean).join(', ') || '0'
    const buildBloque = bk => {
      const out = []
      PLANTILLA[bk].forEach(concepto => {
        if (bk === 'reparaciones' && concepto === AUTO_CONCEPTO) {
          const sv = saved.find(s => s.bloque === bk && s.concepto === concepto)
          out.push({ concepto, monto: repPresu, comentario: sv?.comentario || '', ref: arreglosRef, es_fijo: true, auto: true })
          return
        }
        const sv = saved.find(s => s.bloque === bk && s.concepto === concepto && s.es_fijo)
        out.push({ concepto, monto: sv ? sv.monto : '', comentario: sv?.comentario || '', ref: sv?.ref || '', es_fijo: true, auto: false })
      })
      saved.filter(s => s.bloque === bk && !s.es_fijo).forEach(s => out.push({ concepto: s.concepto || '', monto: s.monto ?? '', comentario: s.comentario || '', ref: s.ref || '', es_fijo: false, auto: false }))
      return out
    }
    const L = { garantia: buildBloque('garantia'), servicios: buildBloque('servicios'), reparaciones: buildBloque('reparaciones') }
    // sembrar desde descuentos SOLO la primera vez (sin lineas guardadas)
    if (saved.length === 0) {
      // Balance de pagos del arrendatario = Σcargo − Σabono (tabla cuentas)
      const linBal = L.garantia.find(x => x.concepto === 'Balance de pagos del arrendatario' && x.es_fijo)
      if (linBal) { linBal.monto = balanceCuentas; linBal.ref = 'Cuentas (' + cuentasMovs.length + ' mov.)' }
      // GC Pendientes, Luz y Agua desde ggcc_agua_luz (mes mas reciente). GC Atrasados queda manual.
      if (ggcc) {
        const fill = (concepto, val) => {
          const lin = L.servicios.find(x => x.concepto === concepto && x.es_fijo)
          if (lin) { lin.monto = n0(val); lin.ref = String(ggcc.id) }
        }
        fill('Gastos Comunes Pendientes', ggcc.deuda_gastos_comunes)
        fill('Luz', ggcc.deuda_vigente_electricidad)
        fill('Agua', ggcc.deuda_vigente_agua)
      }
      const MAP = {
        servicios: [], // servicios vienen de ggcc; los descuentos servicios se listan como lineas aparte
        reparaciones: [
          ['Limpieza de alfombras', ['alfombra']],
          ['Mantención de TERMO', ['termo', 'anodo']],
          ['Limpieza General del dpto.', ['limpieza general', 'limpieza profunda', 'aseo general', 'limpieza del dpto', 'limpieza dpto']],
        ],
      }
      const mapear = (bk, texto) => {
        const tx = norm(texto)
        for (const [concepto, kws] of (MAP[bk] || [])) { if (kws.some(k => tx.includes(norm(k)))) return concepto }
        return null
      }
      descuentos.forEach(d => {
        const fam = familiaDe(d.tipo)
        if (fam === 'garantia') return // informativo
        const bk = fam === 'servicios' ? 'servicios' : 'reparaciones'
        const texto = d.texto_explicativo_para_carta_a_propietario || d.tipo || '(descuento)'
        const monto = n0(d.monto_a_imputar)
        const ref = 'Descto. ' + (d.num || '')
        const conceptoFijo = mapear(bk, texto)
        if (conceptoFijo) {
          const fija = L[bk].find(x => x.concepto === conceptoFijo && x.es_fijo)
          if (fija) { fija.monto = n0(fija.monto) + monto; fija.ref = fija.ref ? (fija.ref + ', ' + ref) : ref; return }
        }
        L[bk].push({ concepto: texto, monto, comentario: '', ref, es_fijo: false, auto: false })
      })
    }
    setLineas(L)

    // asociado = IDADMON inmediatamente mas nuevo del mismo inmueble (idlinmue)
    let asociado = null
    if (arriendo?.idlinmue != null && arriendo.idlinmue !== '') {
      const { data: hermanos } = await supabase.from('datos_arriendos').select('idadmon').eq('idlinmue', arriendo.idlinmue)
      const masNuevos = (hermanos || []).map(h => (h.idadmon || '').trim()).filter(x => x && x > idadmon).sort()
      if (masNuevos.length) asociado = masNuevos[0]
    }
    const idsResumen = asociado ? [idadmon, asociado] : [idadmon]
    const { data: descResumen } = await supabase.from('descuentos')
      .select('num, fecha_contable, idadmon, inmueble, propietario, repercutir_a, monto_a_imputar, texto_explicativo_para_carta_a_propietario')
      .in('idadmon', idsResumen).order('num')

    setPanel({ arriendo, descuentos, presupuestos, detalle, termino: t, wfTasks, instanceId: inst?.id || null, repPresu, arreglosRef, asociado, descResumen: descResumen || [], ggcc })
    setLoadingPanel(false)
  }

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setLinea = (bk, idx, field, v) => setLineas(L => ({ ...L, [bk]: L[bk].map((l, i) => i === idx ? { ...l, [field]: v } : l) }))
  const addLinea = bk => setLineas(L => ({ ...L, [bk]: [...L[bk], { concepto: '', monto: '', comentario: '', ref: '', es_fijo: false, auto: false }] }))
  const removeLinea = (bk, idx) => setLineas(L => ({ ...L, [bk]: L[bk].filter((_, i) => i !== idx) }))

  async function guardar() {
    setGuardando(true); setMsg(null)
    const arr = panel.arriendo
    const garantia = n0(arr?.garantia_pedida)
    const quien = arr?.quien_tiene_garantia || arr?.garantia_con || ''
    const repPresu = panel.presupuestos.reduce((a, p) => a + n0(p.total), 0)
    const arreglosRef = panel.arreglosRef
    const R = calcResult(lineas, form.markup_fcr, garantia, repPresu, quien)

    const rows = []
    ;['garantia', 'servicios', 'reparaciones'].forEach(bk => {
      (lineas[bk] || []).forEach((l, idx) => {
        const monto = l.auto ? repPresu : n0(l.monto)
        const ref = l.auto ? arreglosRef : (l.ref || null)
        const keep = l.auto || monto !== 0 || (l.comentario && l.comentario.trim()) || (l.ref && l.ref.trim()) || !l.es_fijo
        if (!keep) return
        if (!l.es_fijo && !(l.concepto && l.concepto.trim()) && monto === 0) return // linea añadida vacia
        rows.push({ idadmon: idadmonSel, bloque: bk, concepto: l.concepto || '(sin concepto)', monto, comentario: l.comentario || null, ref, orden: idx, es_fijo: l.es_fijo })
      })
    })

    const delR = await supabase.from('termino_lineas').delete().eq('idadmon', idadmonSel)
    if (delR.error) { setMsg({ tipo: 'error', txt: 'Error (borrado líneas): ' + delR.error.message }); setGuardando(false); return }
    if (rows.length) {
      const insR = await supabase.from('termino_lineas').insert(rows)
      if (insR.error) { setMsg({ tipo: 'error', txt: 'Error (líneas): ' + insR.error.message }); setGuardando(false); return }
    }
    const num = k => form[k] === '' || form[k] == null ? 0 : Number(form[k])
    const txt = k => form[k] || null
    const payload = {
      idadmon: idadmonSel, fecha_entrega: form.fecha_entrega || null,
      valoracion_legal: txt('valoracion_legal'), decision_actuacion: txt('decision_actuacion'),
      lectura_agua: txt('lectura_agua'), lectura_luz: txt('lectura_luz'), markup_fcr: num('markup_fcr'),
      comentarios_arrendatario: txt('comentarios_arrendatario'), comentarios_internos: txt('comentarios_internos'),
      resultado_calculado: R.resultado, tipo_resultado: R.tipo, updated_at: new Date().toISOString(),
    }
    const upR = await supabase.from('terminos').upsert(payload, { onConflict: 'idadmon' })
    if (upR.error) { setMsg({ tipo: 'error', txt: 'Error (terminos): ' + upR.error.message }); setGuardando(false); return }
    setEditando(false); setGuardando(false); setMsg({ tipo: 'ok', txt: 'Guardado.' })
  }

  if (status === 'loading' || accesoOk === null) return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (accesoOk === false) return null

  const card = { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, padding: 16, marginBottom: 16 }
  const input = { padding: '8px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const lbl = { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }
  const val = { fontSize: 13, color: '#1a1a2e', fontWeight: 600 }
  const inEd = { ...input, padding: '4px 7px', fontSize: 12 }
  const inNum = { ...inEd, textAlign: 'right', width: 100 }

  // ───────── LISTA ─────────
  if (modo === 'lista') {
    const COLS = [{ key: 'idadmon', label: 'IDADMON' }, { key: 'fecha_entrega', label: 'F. Entrega' }, { key: 'propietario', label: 'Propietario' }, { key: 'arrendatario', label: 'Arrendatario' }, { key: 'inmueble', label: 'Inmueble' }, { key: 'estado', label: 'Estado' }]
    const estadosDisp = [...new Set(listaIds.map(r => up(r.estado)).filter(Boolean))].sort()
    const q = norm(busca)
    let rows = listaIds.filter(r => {
      if (filtros.estado !== '__all__' && up(r.estado) !== filtros.estado) return false
      if (filtros.idadmon && !norm(r.idadmon).includes(norm(filtros.idadmon))) return false
      if (filtros.arrendatario && !norm(r.arrendatario).includes(norm(filtros.arrendatario))) return false
      if (filtros.inmueble && !norm(r.inmueble).includes(norm(filtros.inmueble))) return false
      if (filtros.propietario && !norm(r.propietario).includes(norm(filtros.propietario))) return false
      if (filtros.fecha_entrega && !norm(r.fecha_entrega).includes(norm(filtros.fecha_entrega))) return false
      if (q && !norm([r.idadmon, r.arrendatario, r.inmueble].join(' ')).includes(q)) return false
      return true
    }).sort((a, b) => { const va = norm(a[sortCol]), vb = norm(b[sortCol]); if (va < vb) return sortDir === 'asc' ? -1 : 1; if (va > vb) return sortDir === 'asc' ? 1 : -1; return 0 })
    const inpFiltro = { width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '4px 6px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 5, fontFamily: 'inherit', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }
    const flecha = c => sortCol === c ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''
    const toggleSort = c => { if (sortCol === c) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(c); setSortDir('asc') } }
    return (
      <>
        <TopNav />
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: '0 0 6px' }}>Términos</h1>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Panel de término · arriendo, descuentos, presupuesto y workflow</div>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Búsqueda rápida…" style={{ ...input, marginBottom: 14, maxWidth: 520 }} />
          {!listaCargada ? <div style={{ color: '#888' }}>Cargando…</div> : (
            <>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{rows.length} resultado{rows.length === 1 ? '' : 's'} · estado: <b>{filtros.estado === '__all__' ? 'todos' : filtros.estado}</b></div>
              <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: '#FAFAF8', borderBottom: '1px solid #E8E6E0' }}>
                    {COLS.map(c => (
                      <th key={c.key} style={{ padding: '8px 12px', textAlign: 'left', verticalAlign: 'top' }}>
                        <div onClick={() => toggleSort(c.key)} style={{ cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: .5, userSelect: 'none' }}>{c.label}{flecha(c.key)}</div>
                        {c.key === 'estado' ? <select value={filtros.estado} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))} style={inpFiltro}><option value="__all__">Todos</option>{estadosDisp.map(s => <option key={s} value={s}>{s}</option>)}</select>
                          : <input value={filtros[c.key]} onChange={e => setFiltros(f => ({ ...f, [c.key]: e.target.value }))} placeholder="filtrar…" style={inpFiltro} />}
                      </th>
                    ))}<th style={{ width: 1 }}></th>
                  </tr></thead>
                  <tbody>
                    {rows.length === 0 ? <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#888' }}>Sin resultados.</td></tr>
                      : rows.map(r => (
                        <tr key={r.idadmon} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '10px 12px', color: '#185FA5', fontWeight: 700 }}>{r.idadmon}</td>
                          <td style={{ padding: '10px 12px', color: '#555', whiteSpace: 'nowrap' }}>{r.fecha_entrega ? fmtFecha(r.fecha_entrega) : '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#1a1a2e' }}>{r.propietario || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#1a1a2e' }}>{r.arrendatario || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#555' }}>{r.inmueble || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#888' }}>{r.estado || '—'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}><button onClick={() => abrir(r.idadmon)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid #185FA5', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, whiteSpace: 'nowrap' }}>Abrir término →</button></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </>
    )
  }

  // ───────── PANEL ─────────
  const A = panel?.arriendo
  const presupuestos = panel?.presupuestos || []
  const detalle = panel?.detalle || []
  const descuentos = panel?.descuentos || []
  const wfTasks = panel?.wfTasks || []
  const repPresu = panel?.repPresu || 0
  const arreglosRef = panel?.arreglosRef || '0'
  const asociado = panel?.asociado || null
  const descResumen = panel?.descResumen || []
  const ordenImputar = r => { const x = up(r.repercutir_a); if (!x) return 0; if (x.startsWith('T-')) return 1; if (x === 'PROPIETARIO') return 2; return 3 }
  const descResumenOrd = [...descResumen].sort((a, b) => ordenImputar(a) - ordenImputar(b) || (n0(a.num) - n0(b.num)))
  const quienGar = A?.quien_tiene_garantia || A?.garantia_con || '—'
  const garantiaVal = n0(A?.garantia_pedida)
  const R = panel ? calcResult(lineas, form.markup_fcr, garantiaVal, repPresu, quienGar) : null
  const etiq = R ? `T. ${R.conSaldo ? 'CON' : 'SIN'} SALDO - ${R.esFCR ? 'FCR' : 'DUEÑO'}` : ''
  const descGarantia = descuentos.filter(d => familiaDe(d.tipo) === 'garantia')
  const tareasPorNodo = {}; wfTasks.forEach(t => { tareasPorNodo[t.node_codigo] = t })
  let pasoActual = null
  for (const nd of nodos) { if (estadoTarea(tareasPorNodo[nd.codigo]) !== 'hecho') { pasoActual = nd; break } }

  const btn = (bg, dis) => ({ padding: '7px 12px', borderRadius: 7, border: 'none', background: dis ? '#cbd5e1' : bg, color: '#fff', fontSize: 12, fontWeight: 700, cursor: dis ? 'not-allowed' : 'pointer', fontFamily: 'inherit' })
  const th = { padding: '4px 6px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .3 }
  const tdL = { padding: '4px 6px', fontSize: 12, color: '#374151' }
  const tdR = { padding: '4px 6px', fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }

  function renderBloque(bk, titulo, headColor, bg, bd, subtitulo) {
    const rows = lineas[bk] || []
    return (
      <div style={{ background: bg, border: '1px solid ' + bd, borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: headColor, textTransform: 'uppercase', marginBottom: subtitulo ? 2 : 8 }}>{titulo}</div>
        {subtitulo && <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 8 }}>{subtitulo}</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th}>Concepto</th><th style={{ ...th, textAlign: 'right' }}>Cantidad</th><th style={th}>Comentarios</th><th style={th}>Ref</th>{editando && <th style={{ width: 18 }}></th>}
          </tr></thead>
          <tbody>
            {rows.map((l, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <td style={tdL}>{(!l.es_fijo && editando) ? <input style={{ ...inEd, fontSize: 11, minWidth: 110 }} value={l.concepto} placeholder="(concepto)" onChange={e => setLinea(bk, idx, 'concepto', e.target.value)} /> : (l.concepto || '—')}</td>
                <td style={tdR}>{l.auto ? fmtPesos(repPresu) : (editando ? <input style={inNum} type="number" value={l.monto} onChange={e => setLinea(bk, idx, 'monto', e.target.value)} /> : fmtPesos(n0(l.monto)))}</td>
                <td style={tdL}>{editando ? <input style={{ ...inEd, fontSize: 11 }} value={l.comentario} onChange={e => setLinea(bk, idx, 'comentario', e.target.value)} /> : (l.comentario || '')}</td>
                <td style={{ ...tdL, color: '#9ca3af', width: 82 }}>{l.auto ? ('Pres. ' + arreglosRef) : (editando ? <input style={{ ...inEd, fontSize: 11, width: 72 }} value={l.ref} onChange={e => setLinea(bk, idx, 'ref', e.target.value)} /> : (l.ref || ''))}</td>
                {editando && <td style={{ textAlign: 'center' }}>{!l.es_fijo ? <button onClick={() => removeLinea(bk, idx)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button> : null}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {editando && <button onClick={() => addLinea(bk)} style={{ marginTop: 8, fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px dashed ' + bd, background: '#fff', color: headColor, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>+ línea</button>}
      </div>
    )
  }

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: 18, fontFamily: '"DM Sans", sans-serif' }}>
        {/* B1 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5 }}>Término de arriendo</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', margin: '2px 0' }}>{idadmonSel}</h1>
            <div style={{ fontSize: 13, color: '#666' }}>{A?.inmueble || '—'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button disabled title="Próximamente" style={btn('#2563eb', true)}>Enviar Email</button>
            <button disabled title="Próximamente" style={btn('#7c3aed', true)}>Enviar Presupuesto</button>
            <button disabled title="Próximamente" style={btn('#dc2626', true)}>Hacer Reclamación</button>
            {!editando ? <button onClick={() => { setEditando(true); setMsg(null) }} style={btn('#185FA5')}>✎ Editar</button>
              : <button onClick={guardar} disabled={guardando} style={btn('#16a34a', guardando)}>{guardando ? 'Guardando…' : '✔ Guardar'}</button>}
            <button onClick={() => { setModo('lista'); setPanel(null); setEditando(false) }} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#F0EEE8' }}>← Volver</button>
          </div>
        </div>
        {msg && <div style={{ ...card, padding: 10, marginBottom: 12, background: msg.tipo === 'error' ? '#fef2f2' : '#f0fdf4', color: msg.tipo === 'error' ? '#dc2626' : '#16a34a' }}>{msg.txt}</div>}

        {loadingPanel || !panel ? <div style={{ ...card, color: '#888' }}>Cargando término…</div>
          : !A ? <div style={{ ...card, color: '#b91c1c' }}>No se encontró {idadmonSel} en datos_arriendos.</div>
            : (
              <>
                <div style={{ ...card, display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 16 }}>
                  <div><div style={lbl}>Estado del término</div><div style={{ fontSize: 18, fontWeight: 800, color: R.conSaldo ? '#16a34a' : '#dc2626' }}>{etiq}</div><div style={{ fontSize: 11, color: '#888' }}>{R.conSaldo ? 'Saldo a favor: devolver' : 'Saldo negativo: reclamar / imputar'}</div></div>
                  <div><div style={lbl}>Resultado del término</div><div style={{ fontSize: 22, fontWeight: 800, color: R.resultado < 0 ? '#dc2626' : '#16a34a' }}>{fmtPesos(R.resultado)}</div><div style={{ fontSize: 11, color: '#888' }}>{R.resultado < 0 ? 'a cobrar' : 'a devolver'}</div></div>
                  <div><div style={lbl}>Quién tiene la garantía</div><div style={{ ...val, fontSize: 16 }}>{quienGar}</div></div>
                  <div><div style={lbl}>Garantía entregada</div><div style={{ ...val, fontSize: 16 }}>{fmtPesos(garantiaVal)}</div></div>
                </div>
                <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                  <div><div style={lbl}>Arrendatario</div><div style={val}>{A.arrendatario || '—'}</div><div style={{ fontSize: 11, color: '#888' }}>{A.movil || ''} {A.mail_arrendatario || ''}</div></div>
                  <div><div style={lbl}>Aval</div><div style={val}>{A.avalista || '—'}</div><div style={{ fontSize: 11, color: '#888' }}>{A.telefono_avalista || ''}</div></div>
                  <div><div style={lbl}>Propietario</div><div style={val}>{A.propietario || '—'}</div></div>
                  <div></div>
                  <div><div style={lbl}>Fecha de entrega</div>{editando ? <input type="date" style={inEd} value={form.fecha_entrega} onChange={e => setF('fecha_entrega', e.target.value)} /> : <div style={val}>{fmtFecha(form.fecha_entrega)}</div>}</div>
                  <div><div style={lbl}>Valoración legal</div>{editando ? <input style={inEd} value={form.valoracion_legal} onChange={e => setF('valoracion_legal', e.target.value)} /> : <div style={val}>{form.valoracion_legal || '—'}</div>}</div>
                  <div><div style={lbl}>Decisión actuación</div>{editando ? <input style={inEd} value={form.decision_actuacion} onChange={e => setF('decision_actuacion', e.target.value)} /> : <div style={val}>{form.decision_actuacion || '—'}</div>}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><div style={lbl}>Cont. Agua</div>{editando ? <input style={inEd} value={form.lectura_agua} onChange={e => setF('lectura_agua', e.target.value)} /> : <div style={val}>{form.lectura_agua || '—'}</div>}</div>
                    <div><div style={lbl}>Cont. Luz</div>{editando ? <input style={inEd} value={form.lectura_luz} onChange={e => setF('lectura_luz', e.target.value)} /> : <div style={val}>{form.lectura_luz || '—'}</div>}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, alignItems: 'start' }}>
                  {/* COLUMNA IZQUIERDA: Excel del término + resultado + estado proceso */}
                  <div>
                    {/* Garantía (mismo formato que el resultado; rojo si no es FCR) */}
                    {(() => {
                      const garFCR = up(quienGar).includes('FCR')
                      const garColor = garFCR ? '#185FA5' : '#dc2626'
                      const garBg = garFCR ? '#EAF2FB' : '#FDECEC'
                      return (
                        <div style={{ background: garBg, border: '2px solid ' + garColor, borderRadius: 10, padding: '14px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a2e', textTransform: 'uppercase', letterSpacing: .5 }}>Garantía entregada</div>
                            <div style={{ fontSize: 13, fontWeight: 800, marginTop: 2, color: garColor }}>Quién la tiene: {quienGar}</div>
                          </div>
                          <div style={{ fontSize: 30, fontWeight: 800, color: garColor }}>{fmtPesos(garantiaVal)}</div>
                        </div>
                      )
                    })()}

                    {renderBloque('garantia', 'Datos económicos', '#185FA5', '#EAF2FB', '#CBE0F5')}
                    {renderBloque('servicios', 'Servicios', '#185FA5', '#F2F8FE', '#D8E9F8', panel.ggcc ? `GC pendientes, luz y agua de ${panel.ggcc.mes} (GGCC #${panel.ggcc.id})` : 'Sin datos de GGCC/agua/luz')}
                    {renderBloque('reparaciones', 'Reparaciones', '#b45309', '#FCF4E7', '#F1E0BD')}

                    {/* RESULTADO resaltado (estilo Excel) */}
                    <div style={{ background: R.resultado < 0 ? '#FDECEC' : '#ECFDF3', border: '2px solid ' + (R.resultado < 0 ? '#dc2626' : '#16a34a'), borderRadius: 10, padding: '14px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a2e', textTransform: 'uppercase', letterSpacing: .5 }}>Resultado del término</div>
                        <div style={{ fontSize: 11, color: '#777' }}>(si + transferir, si − reclamar)</div>
                        <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2, color: R.conSaldo ? '#16a34a' : '#dc2626' }}>{etiq} · {R.resultado < 0 ? 'a cobrar al arrendatario' : 'a devolver'}</div>
                      </div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: R.resultado < 0 ? '#dc2626' : '#16a34a' }}>{fmtPesos(R.resultado)}</div>
                    </div>

                    {/* ESTADO DEL PROCESO (debajo del excel del término) */}
                    <div style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Estado del proceso</span>
                        <button onClick={() => router.push('/procesos/terminos/' + idadmonSel)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #185FA5', background: '#185FA5', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, color: '#fff' }}>Abrir workflow →</button>
                        <button onClick={() => setWfExpandido(x => !x)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, color: '#185FA5' }}>{wfExpandido ? 'Ver paso actual' : `Ver los ${nodos.length} pasos`}</button>
                      </div>
                      {nodos.length === 0 ? <div style={{ color: '#888', fontSize: 12 }}>Cargando pasos…</div>
                        : !wfTasks.length ? <div style={{ color: '#9ca3af', fontSize: 12 }}>Sin instancia de workflow para este IDADMON.</div>
                          : !wfExpandido ? (
                            pasoActual ? (
                              <div style={{ padding: 8, background: '#EAF2FB', borderRadius: 8 }}>
                                <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Paso actual</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#185FA5' }}>{pasoActual.codigo} · {pasoActual.nombre}</div>
                                <div style={{ fontSize: 11, color: '#888' }}>{pasoActual.area_responsable}</div>
                                <button onClick={() => completarPaso(pasoActual)} disabled={completandoWf} style={{ marginTop: 8, fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6, border: 'none', background: completandoWf ? '#9ca3af' : '#185FA5', color: '#fff', cursor: completandoWf ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                                  {completandoWf ? 'Completando…' : 'Completar paso →'}
                                </button>
                              </div>
                            ) : <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>Todos los pasos completados ✓</div>
                          ) : (
                            nodos.map(nd => {
                              const t = tareasPorNodo[nd.codigo]; const st = estadoTarea(t)
                              const dot = st === 'hecho' ? '#16a34a' : st === 'curso' ? '#2563eb' : '#d1d5db'
                              const fecha = t?.fecha_cierre || t?.fecha_limite
                              return (
                                <div key={nd.codigo} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid #F6F5F2' }}>
                                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700 }}>{st === 'hecho' ? '✓' : ''}</span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: st === 'pendiente' ? '#9ca3af' : '#1a1a2e' }}>{nd.codigo} · {nd.nombre}</div>
                                    <div style={{ fontSize: 10, color: '#aaa' }}>{nd.area_responsable}{fecha ? ' · ' + fmtFecha(fecha) : ''}{st === 'curso' ? ' · en curso' : ''}</div>
                                  </div>
                                </div>
                              )
                            })
                          )}
                    </div>
                    <div style={{ ...card, color: '#9ca3af', fontSize: 12 }}>Acciones realizadas — <i>próximamente</i>.</div>

                    {descGarantia.length > 0 && (
                      <div style={{ ...card, padding: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginBottom: 6 }}>Movimientos de garantía (informativo, no suma)</div>
                        {descGarantia.map(d => <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}><span style={{ color: '#555' }}>{d.texto_explicativo_para_carta_a_propietario || d.tipo} <span style={{ color: '#bbb' }}>Dto. {d.num}</span></span><span style={{ fontWeight: 600 }}>{fmtPesos(d.monto_a_imputar)}</span></div>)}
                      </div>
                    )}
                    <div style={card}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>Comentarios sobre el arrendatario</div>
                      {editando ? <textarea style={{ ...input, minHeight: 50, resize: 'vertical' }} value={form.comentarios_arrendatario} onChange={e => setF('comentarios_arrendatario', e.target.value)} /> : <div style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap' }}>{form.comentarios_arrendatario || '—'}</div>}
                    </div>
                  </div>

                  {/* COLUMNA DERECHA (ancha): descuentos relacionados + presupuesto */}
                  <div>
                    {/* Resumen de descuentos relacionados (para el controller) */}
                    <div style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Descuentos relacionados (término y propietario)</span>
                        <span style={{ fontSize: 11, color: '#888' }}>{idadmonSel}{asociado ? ' + ' + asociado : ''}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>Todos los descuentos del IDADMON{asociado ? ' y su asociado (mismo inmueble)' : ''}, ordenados por imputar (— · T- · Propietario). Solo lectura.</div>
                      {descResumenOrd.length === 0 ? <div style={{ fontSize: 12, color: '#9ca3af' }}>Sin descuentos.</div> : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead><tr style={{ background: '#FAFAF8' }}>
                            <th style={th}>Num</th><th style={th}>F.Cont</th><th style={th}>IDADMON</th><th style={th}>Imputar a</th><th style={{ ...th, textAlign: 'right' }}>Cantidad</th><th style={th}>Comentario</th>
                          </tr></thead>
                          <tbody>
                            {descResumenOrd.map((d, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', background: d.idadmon === idadmonSel ? '#fff' : '#FBFAF7' }}>
                                <td style={{ ...tdL, color: '#185FA5', fontWeight: 700 }}>{d.num}</td>
                                <td style={{ ...tdL, color: '#888', whiteSpace: 'nowrap' }}>{fmtFecha(d.fecha_contable)}</td>
                                <td style={{ ...tdL, fontWeight: 600 }}>{d.idadmon}</td>
                                <td style={{ ...tdL, color: '#666' }}>{d.repercutir_a || '—'}</td>
                                <td style={tdR}>{fmtPesos(d.monto_a_imputar)}</td>
                                <td style={{ ...tdL, color: '#555' }}>{d.texto_explicativo_para_carta_a_propietario || ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <div style={card}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>Presupuesto de reparaciones</div>
                      {presupuestos.length === 0 ? <div style={{ color: '#9ca3af', fontSize: 12, padding: '8px 0' }}>Sin presupuesto registrado. (Se valora desde el módulo Presupuestos.)</div>
                        : presupuestos.map(p => {
                          const lineas2 = detalle.filter(d => d.presupuesto_id === p.id)
                          return (
                            <div key={p.id} style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#185FA5', marginBottom: 4 }}>{p.numero} · {p.descripcion || 'presupuesto'}</div>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr style={{ background: '#FAFAF8' }}><th style={th}>Descripción</th><th style={{ ...th, textAlign: 'right' }}>Cant</th><th style={{ ...th, textAlign: 'right' }}>Base</th><th style={{ ...th, textAlign: 'right' }}>IVA</th><th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
                                <tbody>
                                  {lineas2.map((l, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                      <td style={tdL}>{l.descripcion}</td><td style={{ ...tdR, fontWeight: 400 }}>{l.cantidad ?? ''}</td>
                                      <td style={{ ...tdR, fontWeight: 400, color: '#666' }}>{n0(l.base_imponible).toLocaleString('es-CL')}</td>
                                      <td style={{ ...tdR, fontWeight: 400, color: '#999' }}>{n0(l.iva).toLocaleString('es-CL')}</td>
                                      <td style={tdR}>{n0(l.total).toLocaleString('es-CL')}</td>
                                    </tr>
                                  ))}
                                  <tr style={{ borderTop: '2px solid #E8E6E0' }}><td style={{ ...tdL, fontWeight: 700 }}>TOTALES</td><td></td><td style={{ ...tdR, fontWeight: 700 }}>{n0(p.neto).toLocaleString('es-CL')}</td><td style={{ ...tdR, fontWeight: 700, color: '#888' }}>{n0(p.iva).toLocaleString('es-CL')}</td><td style={{ ...tdR, fontWeight: 700, color: '#185FA5' }}>{n0(p.total).toLocaleString('es-CL')}</td></tr>
                                </tbody>
                              </table>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                </div>

                <div style={{ ...card, background: '#FEF9E7', border: '1px solid #F1C40F', color: '#8a6d00', fontSize: 12 }}>
                  <b>Panel editable (líneas).</b> Conceptos fijos siempre visibles + líneas añadibles. “Arreglos presupuesto” es automático (= total del presupuesto). Servicios y reparaciones se siembran desde <i>descuentos</i> la primera vez (editables). Pendiente: conectar Servicios a la tabla de GGCC/agua/luz (último mes), botones Email/PDF/Reclamación y marcar pasos del workflow.
                </div>
              </>
            )}
      </div>
    </>
  )
}

function Row({ k, v, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13 }}>
      <span style={{ color: bold ? '#1a1a2e' : '#555', fontWeight: bold ? 700 : 400 }}>{k}</span>
      <span style={{ color: '#1a1a2e', fontWeight: bold ? 700 : 600, whiteSpace: 'nowrap' }}>{v}</span>
    </div>
  )
}
