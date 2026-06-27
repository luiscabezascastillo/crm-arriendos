'use client'
import * as XLSX from 'xlsx'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabaseClient'
function fmt(n) {
  if (n === null || n === undefined) return null
  const num = parseInt(n)
  return isNaN(num) ? null : num
}
function fmtPeso(n) {
  if (n === null || n === undefined) return '—'
  return '$' + Number(n).toLocaleString('es-CL')
}
function Dot({ val }) {
  const v = fmt(val)
  const color = v === null ? '#B4B2A9' : v === 0 ? '#639922' : '#E24B4A'
  return <span style={{ width:10, height:10, borderRadius:'50%', background:color, display:'inline-block' }} />
}
function totalF(f) {
  return (fmt(f.deuda_gastos_comunes)||0)+(fmt(f.deuda_vigente_electricidad)||0)+
         (fmt(f.deuda_vigente_agua)||0)+(fmt(f.deuda_vigente_gas)||0)
}

const MESES = ['MAYO 2026','ABRIL 2026','MARZO 2026','FEBRERO 2026','ENERO 2026','DICIEMBRE 2025','NOVIEMBRE 2025','OCTUBRE 2025']

function ExcelFilter({ label, type, options, value, onApply, align='left' }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(value.selected || [])
  const [sortDir, setSortDir] = useState(value.sort || null)
  const [minVal, setMinVal] = useState(value.min ?? '')
  const [maxVal, setMaxVal] = useState(value.max ?? '')
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const activo = (value.selected?.length > 0) || value.sort || value.min !== '' || value.max !== ''
  const filteredOpts = options.filter(o => String(o).toLowerCase().includes(search.toLowerCase()))

  function toggleAll() {
    if (selected.length === options.length) setSelected([])
    else setSelected([...options])
  }
  function toggle(opt) {
    setSelected(s => s.includes(opt) ? s.filter(x => x !== opt) : [...s, opt])
  }
  function apply() {
    onApply({ selected, sort: sortDir, min: minVal, max: maxVal })
    setOpen(false)
  }
  function clear() {
    setSelected([]); setSortDir(null); setMinVal(''); setMaxVal('')
    onApply({ selected: [], sort: null, min: '', max: '' })
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position:'relative', display:'inline-flex', alignItems:'center', gap:3 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        background:'none', border:'none', cursor:'pointer', padding:0,
        display:'flex', alignItems:'center', gap:3, fontSize:11, fontWeight:500,
        color: activo ? '#1D4ED8' : '#6B7280'
      }}>
        {label}
        <span style={{ fontSize:10, color: activo ? '#1D4ED8' : '#9CA3AF' }}>
          {value.sort === 'asc' ? ' ↑' : value.sort === 'desc' ? ' ↓' : ' ⬍'}
        </span>
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'100%', [align==='right'?'right':'left']:0, marginTop:4,
          background:'#fff', border:'1px solid #E5E7EB', borderRadius:8,
          boxShadow:'0 8px 24px rgba(0,0,0,0.12)', minWidth:220, zIndex:300
        }}>
          <div style={{ padding:'8px 12px', borderBottom:'0.5px solid #F3F4F6' }}>
            <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:500, marginBottom:6, textTransform:'uppercase' }}>Ordenar</div>
            <div style={{ display:'flex', gap:6 }}>
              {[['asc', type==='number'?'Menor → Mayor':'A → Z'], ['desc', type==='number'?'Mayor → Menor':'Z → A']].map(([dir, lbl]) => (
                <button key={dir} onClick={() => setSortDir(d => d===dir ? null : dir)} style={{
                  flex:1, padding:'4px 8px', borderRadius:6, border:'1px solid',
                  fontSize:11, cursor:'pointer',
                  background: sortDir===dir ? '#EFF6FF' : '#F9FAFB',
                  borderColor: sortDir===dir ? '#BFDBFE' : '#E5E7EB',
                  color: sortDir===dir ? '#1D4ED8' : '#374151'
                }}>{lbl}</button>
              ))}
            </div>
          </div>
          {type === 'number' && (
            <div style={{ padding:'8px 12px', borderBottom:'0.5px solid #F3F4F6' }}>
              <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:500, marginBottom:6, textTransform:'uppercase' }}>Rango</div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <input placeholder="Mín" value={minVal} onChange={e => setMinVal(e.target.value)} type="number"
                  style={{ flex:1, padding:'4px 8px', borderRadius:6, border:'1px solid #E5E7EB', fontSize:12 }} />
                <span style={{ color:'#9CA3AF', fontSize:12 }}>—</span>
                <input placeholder="Máx" value={maxVal} onChange={e => setMaxVal(e.target.value)} type="number"
                  style={{ flex:1, padding:'4px 8px', borderRadius:6, border:'1px solid #E5E7EB', fontSize:12 }} />
              </div>
            </div>
          )}
          <div style={{ padding:'8px 12px', borderBottom:'0.5px solid #F3F4F6' }}>
            <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width:'100%', padding:'4px 8px', borderRadius:6, border:'1px solid #E5E7EB', fontSize:12, boxSizing:'border-box' }} />
          </div>
          <div style={{ maxHeight:180, overflowY:'auto', padding:'4px' }}>
            <div onClick={toggleAll} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', borderRadius:6, cursor:'pointer', fontSize:12 }}
              onMouseEnter={e => e.currentTarget.style.background='#F3F4F6'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <input type="checkbox" readOnly checked={selected.length === options.length} style={{ margin:0 }} />
              <span style={{ fontWeight:500 }}>Seleccionar todo</span>
            </div>
            {filteredOpts.map(opt => (
              <div key={opt} onClick={() => toggle(opt)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', borderRadius:6, cursor:'pointer', fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}
                onMouseEnter={e => e.currentTarget.style.background='#F3F4F6'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <input type="checkbox" readOnly checked={selected.includes(opt)} style={{ margin:0 }} />
                <span>{opt === null || opt === '' ? '(vacío)' : String(opt)}</span>
              </div>
            ))}
          </div>
          <div style={{ padding:'8px 12px', borderTop:'0.5px solid #F3F4F6', display:'flex', gap:6 }}>
            <button onClick={clear} style={{ flex:1, padding:'5px', borderRadius:6, border:'1px solid #E5E7EB', background:'#fff', fontSize:12, cursor:'pointer', color:'#6B7280' }}>Limpiar</button>
            <button onClick={apply} style={{ flex:1, padding:'5px', borderRadius:6, border:'none', background:'#1D4ED8', fontSize:12, cursor:'pointer', color:'#fff', fontWeight:500 }}>Aplicar</button>
          </div>
        </div>
      )}
    </div>
  )
}

const emptyF = { selected:[], sort:null, min:'', max:'' }

export default function Deudas() {
  const [mes, setMes] = useState('ABRIL 2026')
  const [filas, setFilas] = useState([])
  const [contratos, setContratos] = useState({})
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [historial, setHistorial] = useState(null)
  const [editando, setEditando] = useState(false)
  const [editData, setEditData] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  const [fIdadmon, setFIdadmon] = useState(emptyF)
  const [fProp, setFProp] = useState(emptyF)
  const [fEstado, setFEstado] = useState(emptyF)
  const [fGGCC, setFGGCC] = useState(emptyF)
  const [fLuz, setFLuz] = useState(emptyF)
  const [fAgua, setFAgua] = useState(emptyF)
  const [fGas, setFGas] = useState(emptyF)
  const [fTotal, setFTotal] = useState(emptyF)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState(null)

  useEffect(() => {
    supabase.from('datos_arriendos').select('idadmon,propietario,inmueble').in('estado',['S','P'])
      .then(({data}) => {
        const map = {}
        if (data) data.forEach(c => { map[c.idadmon]=c })
        setContratos(map)
      })
  }, [])

  useEffect(() => {
    setLoading(true)
    setFilas([])
    setFIdadmon(emptyF); setFProp(emptyF); setFEstado(emptyF)
    setFGGCC(emptyF); setFLuz(emptyF); setFAgua(emptyF); setFGas(emptyF); setFTotal(emptyF)
    setSortCol(null); setSortDir(null)
    supabase.from('ggcc_agua_luz')
      .select('idadmon,idinmue,estado,aamm,edificio_proyecto,arrendatario,deuda_gastos_comunes,deuda_vigente_electricidad,deuda_vigente_agua,deuda_vigente_gas,fecha_hecho_ggcc,codigo_ele,codigo_agua,codigo_gas,fecha_hecho_luz,fecha_hecho_agua,fecha_hecho_gas,comentarios_se_han_dejado_los_comentarios_mes_anterior,comentarios_y_fecha_corte,deuda_anterior_agua')
      .eq('mes', mes).limit(500)
      .then(({data}) => {
        setFilas((data||[]).filter(f => f.idadmon && !f.idadmon.startsWith('.')))
        setLoading(false)
      })
  }, [mes])

  function abrirDrawer(f) {
    setDrawer(f); setHistorial(null); setEditando(false); setGuardadoOk(false)
    supabase.from('ggcc_agua_luz')
      .select('mes,aamm,deuda_gastos_comunes,deuda_vigente_electricidad,deuda_vigente_agua,deuda_vigente_gas')
      .eq('idadmon', f.idadmon).order('aamm',{ascending:false}).limit(6)
      .then(({data}) => setHistorial(data||[]))
  }

  function abrirEdicion() {
    setEditData({
      deuda_gastos_comunes: drawer.deuda_gastos_comunes || '',
      fecha_hecho_ggcc: drawer.fecha_hecho_ggcc || '',
      comentarios_ggcc: drawer.comentarios_se_han_dejado_los_comentarios_mes_anterior || '',
      deuda_vigente_electricidad: drawer.deuda_vigente_electricidad || '',
      fecha_hecho_luz: drawer.fecha_hecho_luz || '',
      comentarios_luz: drawer.comentarios_y_fecha_corte || '',
      deuda_vigente_agua: drawer.deuda_vigente_agua || '',
      fecha_hecho_agua: drawer.fecha_hecho_agua || '',
      comentarios_agua: drawer.deuda_anterior_agua || '',
      deuda_vigente_gas: drawer.deuda_vigente_gas || '',
      fecha_hecho_gas: drawer.fecha_hecho_gas || '',
    })
    setEditando(true)
    setGuardadoOk(false)
  }

  async function guardarEdicion() {
    setGuardando(true)
    try {
      const { error } = await supabase
        .from('ggcc_agua_luz')
        .update({
          deuda_gastos_comunes: editData.deuda_gastos_comunes,
          fecha_hecho_ggcc: editData.fecha_hecho_ggcc,
          comentarios_se_han_dejado_los_comentarios_mes_anterior: editData.comentarios_ggcc,
          deuda_vigente_electricidad: editData.deuda_vigente_electricidad,
          fecha_hecho_luz: editData.fecha_hecho_luz,
          comentarios_y_fecha_corte: editData.comentarios_luz,
          deuda_vigente_agua: editData.deuda_vigente_agua,
          fecha_hecho_agua: editData.fecha_hecho_agua,
          deuda_anterior_agua: editData.comentarios_agua,
          deuda_vigente_gas: editData.deuda_vigente_gas,
          fecha_hecho_gas: editData.fecha_hecho_gas,
          updated_at: new Date().toISOString(),
        })
        .eq('mes', mes)
        .eq('idadmon', drawer.idadmon)
        .eq('idinmue', drawer.idinmue)
      if (error) throw error
      const updatedDrawer = {
        ...drawer,
        deuda_gastos_comunes: editData.deuda_gastos_comunes,
        fecha_hecho_ggcc: editData.fecha_hecho_ggcc,
        comentarios_se_han_dejado_los_comentarios_mes_anterior: editData.comentarios_ggcc,
        deuda_vigente_electricidad: editData.deuda_vigente_electricidad,
        fecha_hecho_luz: editData.fecha_hecho_luz,
        comentarios_y_fecha_corte: editData.comentarios_luz,
        deuda_vigente_agua: editData.deuda_vigente_agua,
        fecha_hecho_agua: editData.fecha_hecho_agua,
        deuda_anterior_agua: editData.comentarios_agua,
        deuda_vigente_gas: editData.deuda_vigente_gas,
        fecha_hecho_gas: editData.fecha_hecho_gas,
      }
      setDrawer(updatedDrawer)
      setFilas(prev => prev.map(f =>
        f.idadmon === drawer.idadmon && f.idinmue === drawer.idinmue ? updatedDrawer : f
      ))
      setGuardadoOk(true)
      setEditando(false)
    } catch (e) {
      alert('Error al guardar: ' + e.message)
    }
    setGuardando(false)
  }

  function applyFilter(f, setter, newVal) {
    setter(newVal)
    if (newVal.sort) { setSortCol(f); setSortDir(newVal.sort) }
  }

  const optsIdadmon = [...new Set(filas.map(f => f.idadmon))].sort()
  const optsProp = [...new Set(filas.map(f => contratos[f.idadmon]?.propietario||'—'))].sort()
  const optsEstado = [...new Set(filas.map(f => f.estado).filter(Boolean))].sort()

  function inRange(val, f) {
    const v = fmt(val)||0
    if (f.min !== '' && v < Number(f.min)) return false
    if (f.max !== '' && v > Number(f.max)) return false
    return true
  }
  function inSelected(val, f) {
    if (!f.selected || f.selected.length === 0) return true
    return f.selected.includes(val)
  }

  let datos = filas.filter(f => {
    const c = contratos[f.idadmon]||{}
    if (!inSelected(f.idadmon, fIdadmon)) return false
    if (!inSelected(c.propietario||'—', fProp)) return false
    if (!inSelected(f.estado, fEstado)) return false
    if (!inRange(f.deuda_gastos_comunes, fGGCC)) return false
    if (!inRange(f.deuda_vigente_electricidad, fLuz)) return false
    if (!inRange(f.deuda_vigente_agua, fAgua)) return false
    if (!inRange(f.deuda_vigente_gas, fGas)) return false
    if (!inRange(totalF(f), fTotal)) return false
    return true
  })

  const activeSortCol = sortCol || (fIdadmon.sort?'idadmon':fProp.sort?'prop':fEstado.sort?'estado':
    fGGCC.sort?'ggcc':fLuz.sort?'luz':fAgua.sort?'agua':fGas.sort?'gas':fTotal.sort?'total':null)
  const activeSortDir = sortDir || fIdadmon.sort||fProp.sort||fEstado.sort||fGGCC.sort||fLuz.sort||fAgua.sort||fGas.sort||fTotal.sort

  if (activeSortCol) {
    datos = [...datos].sort((a,b) => {
      const c1=contratos[a.idadmon]||{}, c2=contratos[b.idadmon]||{}
      let va, vb
      if (activeSortCol==='idadmon') { va=a.idadmon; vb=b.idadmon }
      else if (activeSortCol==='prop') { va=c1.propietario||''; vb=c2.propietario||'' }
      else if (activeSortCol==='estado') { va=a.estado||''; vb=b.estado||'' }
      else if (activeSortCol==='ggcc') { va=fmt(a.deuda_gastos_comunes)||0; vb=fmt(b.deuda_gastos_comunes)||0 }
      else if (activeSortCol==='luz') { va=fmt(a.deuda_vigente_electricidad)||0; vb=fmt(b.deuda_vigente_electricidad)||0 }
      else if (activeSortCol==='agua') { va=fmt(a.deuda_vigente_agua)||0; vb=fmt(b.deuda_vigente_agua)||0 }
      else if (activeSortCol==='gas') { va=fmt(a.deuda_vigente_gas)||0; vb=fmt(b.deuda_vigente_gas)||0 }
      else { va=totalF(a); vb=totalF(b) }
      if (typeof va==='string') return activeSortDir==='asc'?va.localeCompare(vb):vb.localeCompare(va)
      return activeSortDir==='asc'?va-vb:vb-va
    })
  }

  const hayFiltros = fIdadmon.selected.length||fProp.selected.length||fEstado.selected.length||
    fGGCC.min!==''||fGGCC.max!==''||fLuz.min!==''||fLuz.max!==''||
    fAgua.min!==''||fAgua.max!==''||fGas.min!==''||fGas.max!==''||
    fTotal.min!==''||fTotal.max!==''


  function exportarExcel() {
    const rows = datos.map(f => {
      const c = contratos[f.idadmon] || {}
      return {
        'IDADMON': f.idadmon,
        'Edificio/Proyecto': f.edificio_proyecto || '',
        'Propietario': c.propietario || '',
        'Inmueble': c.inmueble || f.idinmue || '',
        'Arrendatario': f.arrendatario || '',
        'Estado': f.estado || '',
        'AAMM': f.aamm || '',
        'Cód. Luz': f.codigo_ele || '',
        'Cód. Agua': f.codigo_agua || '',
        'Cód. Gas': f.codigo_gas || '',
        'GGCC': fmt(f.deuda_gastos_comunes) ?? '',
        'Fecha GGCC': f.fecha_hecho_ggcc || '',
        'Comentario GGCC': f.comentarios_se_han_dejado_los_comentarios_mes_anterior || '',
        'Luz': fmt(f.deuda_vigente_electricidad) ?? '',
        'Fecha Luz': f.fecha_hecho_luz || '',
        'Comentario Luz': f.comentarios_y_fecha_corte || '',
        'Agua': fmt(f.deuda_vigente_agua) ?? '',
        'Fecha Agua': f.fecha_hecho_agua || '',
        'Comentario Agua': f.deuda_anterior_agua || '',
        'Gas': fmt(f.deuda_vigente_gas) ?? '',
        'Fecha Gas': f.fecha_hecho_gas || '',
        'Total': totalF(f),
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Deudas')

    // Ancho de columnas automático
    const colWidths = Object.keys(rows[0]).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2
    }))
    ws['!cols'] = colWidths

    XLSX.writeFile(wb, 'deudas_' + mes.replace(' ', '_') + '.xlsx')
  }
  function limpiarTodo() {
    setFIdadmon(emptyF);setFProp(emptyF);setFEstado(emptyF)
    setFGGCC(emptyF);setFLuz(emptyF);setFAgua(emptyF);setFGas(emptyF);setFTotal(emptyF)
    setSortCol(null);setSortDir(null)
  }

  const conDeuda = filas.filter(f=>totalF(f)>0).length
  const sinDeuda = filas.filter(f=>totalF(f)===0).length
  const totDeuda = filas.reduce((s,f)=>s+totalF(f),0)

  return (
    <div style={{padding:'24px 32px',maxWidth:1400,margin:'0 auto',fontFamily:'var(--font-sans,sans-serif)'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,fontSize:13}}>
        <Link href="/cc1" style={{color:'#6B7280',textDecoration:'none',display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:6}}>
          ← CC1 Admin
        </Link>
        <span style={{color:'#D1D5DB'}}>/</span>
        <span style={{color:'#374151'}}>Deudas de servicios</span>
      </div>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:500,margin:0}}>Deudas de servicios</h1>
          <p style={{color:'#6B7280',fontSize:13,marginTop:4}}>GGCC · Luz · Agua · Gas</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {hayFiltros && (
            <button onClick={limpiarTodo} style={{padding:'6px 12px',borderRadius:8,border:'1px solid #E5E7EB',
              background:'#FEF3C7',fontSize:12,cursor:'pointer',color:'#92400E'}}>
              ✕ Limpiar filtros
            </button>
          )}
          <button onClick={exportarExcel} style={{padding:'6px 14px',borderRadius:8,
            border:'1px solid #D1D5DB',background:'#fff',fontSize:13,cursor:'pointer',
            color:'#374151',fontWeight:500,display:'flex',alignItems:'center',gap:6}}>
            ⬇ Excel (.xlsx)
          </button>
          <select value={mes} onChange={e=>setMes(e.target.value)}
            style={{padding:'6px 12px',borderRadius:8,border:'1px solid #D1D5DB',fontSize:14}}>
            {MESES.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Barra de acciones del proceso Servicios */}
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:20}}>
        <Link href="/op/comunidad-feliz" style={{padding:'7px 12px',borderRadius:8,border:'1px solid #D1D5DB',background:'#fff',fontSize:13,color:'#374151',fontWeight:500,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}>🏢 Cargar ggcc CF</Link>
        <Link href="/op/servicios/luz" style={{padding:'7px 12px',borderRadius:8,border:'1px solid #D1D5DB',background:'#fff',fontSize:13,color:'#374151',fontWeight:500,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}>⚡ Cargar Luz</Link>
        <Link href="/op/servicios/agua" style={{padding:'7px 12px',borderRadius:8,border:'1px solid #D1D5DB',background:'#fff',fontSize:13,color:'#374151',fontWeight:500,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}>💧 Cargar Agua</Link>
        <Link href="/op/email-deudores" style={{padding:'7px 12px',borderRadius:8,border:'1px solid #D1D5DB',background:'#fff',fontSize:13,color:'#374151',fontWeight:500,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}>📧 Email grandes deudores</Link>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
        {[
          {label:'Contratos',val:filas.length,sub:datos.length!==filas.length?`${datos.length} filtrados`:null,color:'#185FA5'},
          {label:'Con deuda',val:conDeuda,color:'#A32D2D'},
          {label:'Sin deuda',val:sinDeuda,color:'#3B6D11'},
          {label:'Deuda total',val:'$'+Math.round(totDeuda/1000)+'k',color:'#A32D2D'},
        ].map(k=>(
          <div key={k.label} style={{background:'#F9FAFB',borderRadius:8,padding:'12px 16px',border:'0.5px solid #E5E7EB'}}>
            <div style={{fontSize:11,color:'#6B7280',marginBottom:4}}>{k.label}</div>
            <div style={{fontSize:24,fontWeight:500,color:k.color}}>{k.val}</div>
            {k.sub&&<div style={{fontSize:11,color:'#1D4ED8'}}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:10,overflow:'hidden'}}>
        {loading ? (
          <div style={{padding:'2rem',textAlign:'center',color:'#9CA3AF'}}>Cargando...</div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{background:'#F9FAFB'}}>
                  <th style={thS}>
                    <ExcelFilter label="IDADMON" type="text" options={optsIdadmon} value={fIdadmon} onApply={v=>{setFIdadmon(v);if(v.sort){setSortCol('idadmon');setSortDir(v.sort)}}} />
                  </th>
                  <th style={thS}>
                    <ExcelFilter label="Propietario / Inmueble" type="text" options={optsProp} value={fProp} onApply={v=>{setFProp(v);if(v.sort){setSortCol('prop');setSortDir(v.sort)}}} />
                  </th>
                  <th style={thS}>
                    <ExcelFilter label="Est." type="text" options={optsEstado} value={fEstado} onApply={v=>{setFEstado(v);if(v.sort){setSortCol('estado');setSortDir(v.sort)}}} />
                  </th>
                  <th style={thS}>Servicios</th>
                  <th style={{...thS,textAlign:'right'}}>
                    <ExcelFilter label="GGCC" type="number" options={[]} value={fGGCC} onApply={v=>{setFGGCC(v);if(v.sort){setSortCol('ggcc');setSortDir(v.sort)}}} align="right" />
                  </th>
                  <th style={{...thS,textAlign:'right'}}>
                    <ExcelFilter label="Luz" type="number" options={[]} value={fLuz} onApply={v=>{setFLuz(v);if(v.sort){setSortCol('luz');setSortDir(v.sort)}}} align="right" />
                  </th>
                  <th style={{...thS,textAlign:'right'}}>
                    <ExcelFilter label="Agua" type="number" options={[]} value={fAgua} onApply={v=>{setFAgua(v);if(v.sort){setSortCol('agua');setSortDir(v.sort)}}} align="right" />
                  </th>
                  <th style={{...thS,textAlign:'right'}}>
                    <ExcelFilter label="Gas" type="number" options={[]} value={fGas} onApply={v=>{setFGas(v);if(v.sort){setSortCol('gas');setSortDir(v.sort)}}} align="right" />
                  </th>
                  <th style={{...thS,textAlign:'right'}}>
                    <ExcelFilter label="Total" type="number" options={[]} value={fTotal} onApply={v=>{setFTotal(v);if(v.sort){setSortCol('total');setSortDir(v.sort)}}} align="right" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {datos.map((f,i)=>{
                  const c=contratos[f.idadmon]||{}
                  const tot=totalF(f)
                  return (
                    <tr key={f.idadmon+i} onClick={()=>abrirDrawer(f)}
                      style={{background:drawer?.idadmon===f.idadmon?'#EFF6FF':i%2===0?'#fff':'#FAFAFA',cursor:'pointer'}}>
                      <td style={tdS}><span style={{fontWeight:500}}>{f.idadmon}</span></td>
                      <td style={tdS}>
                        <div>{c.propietario||'—'}</div>
                        <div style={{fontSize:11,color:'#6B7280'}}>{c.inmueble||f.idinmue}</div>
                      </td>
                      <td style={tdS}>
                        <span style={{fontSize:10,padding:'2px 7px',borderRadius:8,fontWeight:500,
                          background:f.estado==='S'?'#EAF3DE':'#FAEEDA',color:f.estado==='S'?'#3B6D11':'#854F0B'}}>
                          {f.estado}
                        </span>
                      </td>
                      <td style={tdS}>
                        <div style={{display:'flex',gap:4}}>
                          <Dot val={f.deuda_gastos_comunes}/><Dot val={f.deuda_vigente_electricidad}/>
                          <Dot val={f.deuda_vigente_agua}/><Dot val={f.deuda_vigente_gas}/>
                        </div>
                      </td>
                      {[f.deuda_gastos_comunes,f.deuda_vigente_electricidad,f.deuda_vigente_agua,f.deuda_vigente_gas].map((v,vi)=>(
                        <td key={vi} style={{...tdS,textAlign:'right',fontWeight:500,
                          color:fmt(v)>0?'#A32D2D':fmt(v)===0?'#3B6D11':'#9CA3AF'}}>
                          {v===null?'—':fmtPeso(fmt(v))}
                        </td>
                      ))}
                      <td style={{...tdS,textAlign:'right',fontWeight:600,color:tot>0?'#A32D2D':'#3B6D11'}}>
                        {fmtPeso(tot)}
                      </td>
                    </tr>
                  )
                })}
                <tr style={{background:'#F3F4F6'}}>
                  <td colSpan={4} style={{padding:'8px 12px',fontSize:12,color:'#6B7280',fontWeight:500}}>
                    {datos.length} de {filas.length} contratos
                  </td>
                  {['deuda_gastos_comunes','deuda_vigente_electricidad','deuda_vigente_agua','deuda_vigente_gas'].map((col,i)=>(
                    <td key={i} style={{padding:'8px 12px',textAlign:'right',fontWeight:600,fontSize:12,color:'#A32D2D'}}>
                      {fmtPeso(datos.reduce((s,f)=>s+(fmt(f[col])||0),0))}
                    </td>
                  ))}
                  <td style={{padding:'8px 12px',textAlign:'right',fontWeight:700,fontSize:13,color:'#A32D2D'}}>
                    {fmtPeso(datos.reduce((s,f)=>s+totalF(f),0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawer && (
        <>
          <div onClick={()=>{setDrawer(null);setHistorial(null);setEditando(false)}}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.2)',zIndex:40}}/>
          <div style={{position:'fixed',top:0,right:0,bottom:0,width:440,background:'#fff',
            zIndex:50,boxShadow:'-4px 0 24px rgba(0,0,0,0.1)',overflowY:'auto'}}>
            <div style={{padding:'20px 24px',borderBottom:'0.5px solid #E5E7EB',display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:44,height:44,borderRadius:'50%',background:'#EFF6FF',display:'flex',
                alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:500,color:'#185FA5'}}>
                {(contratos[drawer.idadmon]?.propietario||'??').split(' ').map(w=>w[0]).slice(0,2).join('')}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:500,fontSize:16}}>{drawer.idadmon}</div>
                <div style={{fontSize:12,color:'#6B7280'}}>{contratos[drawer.idadmon]?.propietario||'—'}</div>
              </div>
              <button onClick={()=>{setDrawer(null);setHistorial(null);setEditando(false)}}
                style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#9CA3AF'}}>✕</button>
            </div>
            <div style={{padding:'20px 24px'}}>
              <div style={{fontSize:13,color:'#6B7280',marginBottom:16}}>
                {contratos[drawer.idadmon]?.inmueble||drawer.idinmue}
              </div>

              {/* KPIs servicios */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
                {[
                  {label:'G. Comunes',val:drawer.deuda_gastos_comunes,meta:drawer.fecha_hecho_ggcc,comentario:drawer.comentarios_se_han_dejado_los_comentarios_mes_anterior},
                  {label:'Electricidad',val:drawer.deuda_vigente_electricidad,meta:drawer.codigo_ele,comentario:drawer.comentarios_y_fecha_corte},
                  {label:'Agua',val:drawer.deuda_vigente_agua,meta:drawer.codigo_agua,comentario:drawer.deuda_anterior_agua},
                  {label:'Gas',val:drawer.deuda_vigente_gas,meta:null,comentario:null},
                ].map((s,i)=>{
                  const v=fmt(s.val)
                  return (
                    <div key={i} style={{background:'#F9FAFB',borderRadius:8,padding:'12px 14px',border:'0.5px solid #E5E7EB'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                        <Dot val={s.val}/>
                        <span style={{fontSize:11,color:'#6B7280',fontWeight:500}}>{s.label}</span>
                      </div>
                      <div style={{fontSize:18,fontWeight:500,color:v===null?'#9CA3AF':v===0?'#3B6D11':'#A32D2D'}}>
                        {v===null?'Sin datos':v===0?'Sin deuda':fmtPeso(v)}
                      </div>
                      {s.meta&&s.meta!=='estacionamiento'&&s.meta!=='bodega'&&
                        <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>{s.meta}</div>}
                      {s.comentario&&
                        <div style={{fontSize:11,color:'#854F0B',marginTop:4,background:'#FAEEDA',
                          borderRadius:4,padding:'3px 6px'}}>{s.comentario}</div>}
                    </div>
                  )
                })}
              </div>

              {/* Total */}
              <div style={{background:totalF(drawer)>0?'#FCEBEB':'#EAF3DE',borderRadius:8,padding:'12px 16px',
                marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:13,fontWeight:500,color:totalF(drawer)>0?'#A32D2D':'#3B6D11'}}>Total deuda</span>
                <span style={{fontSize:20,fontWeight:600,color:totalF(drawer)>0?'#A32D2D':'#3B6D11'}}>{fmtPeso(totalF(drawer))}</span>
              </div>

              {/* Botón editar */}
              {!editando && (
                <button onClick={abrirEdicion} style={{
                  width:'100%',padding:'9px',borderRadius:8,border:'1px solid #D1D5DB',
                  background:'#F9FAFB',fontSize:13,cursor:'pointer',color:'#374151',
                  fontWeight:500,marginBottom:20,display:'flex',alignItems:'center',
                  justifyContent:'center',gap:6
                }}>
                  ✏️ Corregir datos / agregar comentarios
                </button>
              )}

              {/* Panel edición */}
              {editando && editData && (
                <div style={{background:'#F0F4FF',borderRadius:10,padding:'16px',marginBottom:20,border:'1px solid #BFDBFE'}}>
                  <div style={{fontSize:12,fontWeight:600,color:'#1D4ED8',marginBottom:14,
                    display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span>✏️ Editar datos del mes</span>
                    <button onClick={()=>setEditando(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#6B7280',fontSize:18}}>✕</button>
                  </div>
                  {[
                    {label:'🏢 G. Comunes',montoKey:'deuda_gastos_comunes',fechaKey:'fecha_hecho_ggcc',comentKey:'comentarios_ggcc',comentLabel:'Comentario GGCC'},
                    {label:'⚡ Electricidad',montoKey:'deuda_vigente_electricidad',fechaKey:'fecha_hecho_luz',comentKey:'comentarios_luz',comentLabel:'Comentario luz / fecha corte'},
                    {label:'💧 Agua',montoKey:'deuda_vigente_agua',fechaKey:'fecha_hecho_agua',comentKey:'comentarios_agua',comentLabel:'Comentario agua'},
                    {label:'🔥 Gas',montoKey:'deuda_vigente_gas',fechaKey:'fecha_hecho_gas',comentKey:null,comentLabel:null},
                  ].map((campo,i)=>(
                    <div key={i} style={{marginBottom:14,paddingBottom:14,borderBottom:i<3?'0.5px solid #BFDBFE':'none'}}>
                      <div style={{fontSize:11,fontWeight:600,color:'#374151',marginBottom:8}}>{campo.label}</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:campo.comentKey?6:0}}>
                        <div>
                          <div style={{fontSize:10,color:'#6B7280',marginBottom:3}}>Monto ($)</div>
                          <input type="number" value={editData[campo.montoKey]}
                            onChange={e=>setEditData(d=>({...d,[campo.montoKey]:e.target.value}))}
                            style={{width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #BFDBFE',fontSize:13,boxSizing:'border-box'}}/>
                        </div>
                        <div>
                          <div style={{fontSize:10,color:'#6B7280',marginBottom:3}}>Fecha</div>
                          <input type="text" value={editData[campo.fechaKey]}
                            onChange={e=>setEditData(d=>({...d,[campo.fechaKey]:e.target.value}))}
                            placeholder="dd/mm/yyyy"
                            style={{width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #BFDBFE',fontSize:13,boxSizing:'border-box'}}/>
                        </div>
                      </div>
                      {campo.comentKey&&(
                        <div>
                          <div style={{fontSize:10,color:'#6B7280',marginBottom:3}}>{campo.comentLabel}</div>
                          <textarea value={editData[campo.comentKey]}
                            onChange={e=>setEditData(d=>({...d,[campo.comentKey]:e.target.value}))}
                            rows={2}
                            style={{width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #BFDBFE',fontSize:12,boxSizing:'border-box',resize:'vertical',fontFamily:'inherit'}}/>
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{display:'flex',gap:8,marginTop:4}}>
                    <button onClick={()=>setEditando(false)} style={{flex:1,padding:'9px',borderRadius:8,border:'1px solid #D1D5DB',background:'#fff',fontSize:13,cursor:'pointer',color:'#6B7280'}}>
                      Cancelar
                    </button>
                    <button onClick={guardarEdicion} disabled={guardando} style={{flex:2,padding:'9px',borderRadius:8,border:'none',
                      background:guardando?'#93C5FD':'#1D4ED8',fontSize:13,cursor:guardando?'not-allowed':'pointer',color:'#fff',fontWeight:600}}>
                      {guardando?'Guardando...':'💾 Guardar cambios'}
                    </button>
                  </div>
                  {guardadoOk&&(
                    <div style={{marginTop:8,fontSize:12,color:'#3B6D11',textAlign:'center',background:'#EAF3DE',borderRadius:6,padding:'6px'}}>
                      ✓ Guardado correctamente
                    </div>
                  )}
                </div>
              )}

              {/* Gráfico evolución */}
              {historial&&historial.length>0&&(()=>{
                const meses=[...historial].reverse()
                const cols=['deuda_gastos_comunes','deuda_vigente_electricidad','deuda_vigente_agua','deuda_vigente_gas']
                const colors=['#378ADD','#F59E0B','#10B981','#8B5CF6']
                const labels=['GGCC','Luz','Agua','Gas']
                const totales=meses.map(h=>cols.reduce((s,c)=>s+(fmt(h[c])||0),0))
                const maxV=Math.max(...cols.flatMap(c=>meses.map(h=>fmt(h[c])||0)),...totales,1)
                const W=360,H=160,padL=50,padR=10,padT=10,padB=30
                const xStep=(W-padL-padR)/Math.max(meses.length-1,1)
                const yS=v=>padT+(H-padT-padB)*(1-v/maxV)
                const pts=vals=>vals.map((v,i)=>`${padL+i*xStep},${yS(v)}`).join(' ')
                return (
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:11,fontWeight:600,color:'#6B7280',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>
                      Evolución de deudas
                    </div>
                    <svg width={W} height={H} style={{overflow:'visible'}}>
                      {[0,0.25,0.5,0.75,1].map((p,i)=>(
                        <g key={i}>
                          <line x1={padL} y1={yS(maxV*p)} x2={W-padR} y2={yS(maxV*p)} stroke="#F3F4F6" strokeWidth="1"/>
                          <text x={padL-4} y={yS(maxV*p)+4} textAnchor="end" fontSize="9" fill="#9CA3AF">
                            {'$'+Math.round(maxV*p/1000)+'k'}
                          </text>
                        </g>
                      ))}
                      {cols.map((col,ci)=>{
                        const vals=meses.map(h=>fmt(h[col])||0)
                        if(vals.every(v=>v===0))return null
                        return <polyline key={ci} fill="none" stroke={colors[ci]} strokeWidth="1.5" strokeDasharray="4,2" opacity="0.8" points={pts(vals)}/>
                      })}
                      <polyline fill="none" stroke="#1F3864" strokeWidth="2.5" points={pts(totales)}/>
                      {totales.map((v,i)=>(
                        <circle key={i} cx={padL+i*xStep} cy={yS(v)} r="3" fill="#1F3864"/>
                      ))}
                      {meses.map((h,i)=>(
                        <text key={i} x={padL+i*xStep} y={H-2} textAnchor="middle" fontSize="8" fill="#9CA3AF">
                          {(h.mes||'').split(' ')[0].slice(0,3)}
                        </text>
                      ))}
                    </svg>
                    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:6}}>
                      {[...labels.map((l,i)=>({label:l,color:colors[i]})),{label:'Total',color:'#1F3864'}].map((item,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'#6B7280'}}>
                          <div style={{width:16,height:i===4?3:2,background:item.color,borderRadius:1}}/>
                          {item.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Historial GGCC */}
              <div style={{fontSize:11,fontWeight:600,color:'#6B7280',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10}}>
                Historial GGCC
              </div>
              {historial?historial.map((h,i)=>{
                const v=fmt(h.deuda_gastos_comunes)||0
                const max=Math.max(...historial.map(d=>fmt(d.deuda_gastos_comunes)||0),1)
                return (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'0.5px solid #F3F4F6',fontSize:12}}>
                    <span style={{width:110,color:'#6B7280',fontSize:11}}>{h.mes}</span>
                    <div style={{flex:1,height:6,background:'#F3F4F6',borderRadius:3,overflow:'hidden'}}>
                      <div style={{width:`${Math.round(v/max*100)}%`,height:6,background:'#378ADD',borderRadius:3}}/>
                    </div>
                    <span style={{width:80,textAlign:'right',fontWeight:500}}>{fmtPeso(v)}</span>
                  </div>
                )
              }):<div style={{color:'#9CA3AF',fontSize:12}}>Cargando...</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const thS={padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:500,color:'#6B7280',borderBottom:'1px solid #E5E7EB',whiteSpace:'nowrap'}
const tdS={padding:'8px 12px',borderBottom:'0.5px solid #F3F4F6'}