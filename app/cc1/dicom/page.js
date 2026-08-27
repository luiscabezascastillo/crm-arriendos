// VERSION: 2026-08-26 · Añadido "← Volver" (BotonVolver, history.back) — convención de retorno. Hereda versión previa.
// VERSION: v1 · 2026-08-05 · Hoja DICOM (/cc1/dicom): listado consultable de informes DICOM (Equifax)
//   unidos a su pago (JOIN dicom_registro ↔ dicom_pagos). Filtro estilo Excel + búsqueda + orden
//   EN MEMORIA (mismo motor que el LOG/SA) y "Exportar Excel" que vuelca EXACTAMENTE lo filtrado.
//   Solo lectura (fase 1). El alta se hará en fase 2. KPIs: total informes, sin comprobante,
//   pagados por FCR, total $ pagado (deduplicando pagos que cubren 2 informes).
'use client'

import Link from 'next/link'
import BotonVolver from '../../components/ui/BotonVolver'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { supabase } from '../../../lib/supabaseClient'
import { HeaderFilter, filtroActivo, aplicarFiltros } from '../../../lib/filtroExcel'
import TopNav from '../../components/ui/TopNav'

const Ico = {
  download: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  back: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="15 18 9 12 15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  search: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  shield: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
}

function ActionBtn({ label, bg, icon, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 13px', borderRadius: 8, border: 'none', background: bg, color: '#fff',
      fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
      {icon}{label}
    </button>
  )
}

// Indicador de Riesgo Equifax: mayor = mejor comportamiento (999 óptimo, bajo = riesgoso).
function RiesgoBadge({ v }) {
  if (v == null || v === '') return <span style={{ color: 'var(--gray-300)' }}>—</span>
  const n = Number(v)
  const c = n >= 700 ? { bg: '#f0fdf4', color: '#16a34a' }
    : n >= 400 ? { bg: '#fffbeb', color: '#d97706' }
    : { bg: '#fef2f2', color: '#dc2626' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 34, padding: '2px 7px', borderRadius: 6, background: c.bg, color: c.color, fontSize: 11, fontWeight: 600 }}>
      {n}
    </span>
  )
}

const QUIEN_COL = {
  ARRENDATARIO: { bg: '#eff6ff', color: '#1a56db' },
  TERCERO:      { bg: '#fef3c7', color: '#92400e' },
  FCR:          { bg: '#fef2f2', color: '#dc2626' },
  PROPIETARIO:  { bg: '#f0fdf4', color: '#16a34a' },
}
function QuienBadge({ v }) {
  if (!v) return <span style={{ color: 'var(--gray-300)' }}>—</span>
  const c = QUIEN_COL[v] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{ display: 'inline-flex', padding: '2px 7px', borderRadius: 6,
      background: c.bg, color: c.color, fontSize: 11, fontWeight: 600 }}>{v}</span>
  )
}

const fmtFecha = (v) => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? '' : d.toLocaleDateString('es-CL') }
const money = (n) => (n == null || n === '') ? '' : '$' + Number(n).toLocaleString('es-CL')

// Columnas con filtro estilo Excel (mismo motor que el LOG). Operan sobre la fila "aplanada".
const DICOM_COLS = [
  { key: 'fecha_consulta', label: 'Fecha', tipo: 'fecha',
    fkey: r => String(r.fecha_consulta || '').slice(0, 10), flabel: k => (k === '' ? '(vacías)' : fmtFecha(k)) },
  { key: 'nombre', label: 'Nombre', tipo: 'texto',
    fkey: r => r.nombre || '', flabel: k => (k === '' ? '(sin nombre)' : k) },
  { key: 'rut', label: 'RUT', tipo: 'texto',
    fkey: r => r.rut || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'rol_consultado', label: 'Rol', tipo: 'texto',
    fkey: r => r.rol_consultado || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'idadmon', label: 'IDADMON', tipo: 'texto',
    fkey: r => r.idadmon || '', flabel: k => (k === '' ? '(sin contrato)' : k) },
  { key: 'indicador_riesgo', label: 'Riesgo', tipo: 'num',
    fkey: r => (r.indicador_riesgo == null ? '' : String(r.indicador_riesgo)),
    flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'everclean', label: 'Everclean', tipo: 'texto',
    fkey: r => r.everclean === true ? 'SI' : (r.everclean === false ? 'NO' : ''),
    flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'quien_asume', label: 'Quién pagó', tipo: 'texto',
    fkey: r => r.quien_asume || '', flabel: k => (k === '' ? '(sin definir)' : k) },
  { key: 'pago_banco', label: 'Banco', tipo: 'texto',
    fkey: r => r.pago_banco || '', flabel: k => (k === '' ? '(sin pago)' : k) },
]

export default function DicomPage() {
  const router = useRouter()
  const { data: session } = useSession()

  const [todas, setTodas] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [openFilter, setOpenFilter] = useState(null)
  const [orden, setOrden] = useState(null)

  useEffect(() => { loadTodas() }, [])

  // Carga única: informes + su pago embebido (FK pago_id → dicom_pagos). Se aplana para filtrar en memoria.
  async function loadTodas() {
    setLoading(true)
    let desde = 0, acc = [], hay = true
    const cols = 'id, pago_id, idadmon, rol_consultado, rut, nombre, fecha_consulta, indicador_riesgo, monto_impagos, docs_impagos, everclean, info_patrimonial, fallecida, ise, report_id, observaciones, pago:dicom_pagos ( fecha, monto, banco, pagador_nombre, cuenta_origen, referencia, glosa, quien_asume )'
    while (hay) {
      const { data, error } = await supabase.from('dicom_registro').select(cols)
        .order('fecha_consulta', { ascending: false })
        .range(desde, desde + 999)
      if (error) break
      acc = acc.concat(data || [])
      hay = (data || []).length === 1000
      desde += 1000
    }
    const flat = acc.map(r => ({
      ...r,
      quien_asume: r.pago?.quien_asume || '',
      pago_banco: r.pago?.banco || '',
      pago_monto: r.pago?.monto ?? null,
      pago_fecha: r.pago?.fecha || '',
      pagador_nombre: r.pago?.pagador_nombre || '',
      pago_ref: r.pago?.referencia || '',
      glosa: r.pago?.glosa || '',
    }))
    setTodas(flat)
    setLoading(false)
  }

  function limpiarTodo() { setSearch(''); setFilters({}); setOrden(null) }
  const setFiltroCol = (key, val) => setFilters(f => { const n = { ...f }; if (val == null) delete n[key]; else n[key] = val; return n })
  const hayAlgunFiltro = DICOM_COLS.some(c => filtroActivo(filters[c.key]))

  const filtradas = useMemo(() => {
    let base = todas
    const q = search.trim().toLowerCase()
    if (q) base = base.filter(r => ['nombre', 'rut', 'idadmon', 'pagador_nombre', 'report_id']
      .some(k => String(r[k] || '').toLowerCase().includes(q)))
    let out = aplicarFiltros(base, DICOM_COLS, filters, orden)
    if (!orden?.key) {
      out = [...out].sort((a, b) => String(b.fecha_consulta || '').localeCompare(String(a.fecha_consulta || '')))
    }
    return out
  }, [todas, search, filters, orden])

  const total = filtradas.length
  const hayFiltros = search || hayAlgunFiltro || orden?.key

  // KPIs (sobre todo el conjunto cargado).
  const kpis = useMemo(() => {
    const sinComp = todas.filter(r => !r.pago_id).length
    const fcr = todas.filter(r => r.quien_asume === 'FCR').length
    const pagoIds = {}
    todas.forEach(r => { if (r.pago_id != null && r.pago_monto != null) pagoIds[r.pago_id] = r.pago_monto })
    const totalPagado = Object.values(pagoIds).reduce((a, b) => a + Number(b || 0), 0)
    return { total: todas.length, sinComp, fcr, totalPagado }
  }, [todas])

  async function exportarExcel() {
    const XLSX = await import('xlsx')
    const salida = filtradas.map(r => ({
      'Fecha consulta': r.fecha_consulta ? String(r.fecha_consulta).slice(0, 10) : '',
      Nombre: r.nombre || '',
      RUT: r.rut || '',
      Rol: r.rol_consultado || '',
      IDADMON: r.idadmon || '',
      Riesgo: r.indicador_riesgo ?? '',
      'Impagos $': (r.monto_impagos == null) ? '' : Number(r.monto_impagos),
      'Impagos N°': r.docs_impagos ?? '',
      Everclean: r.everclean === true ? 'SÍ' : (r.everclean === false ? 'NO' : ''),
      Patrimonial: r.info_patrimonial === true ? 'SÍ' : (r.info_patrimonial === false ? 'NO' : ''),
      'Quién pagó': r.quien_asume || '',
      Pagador: r.pagador_nombre || '',
      'Monto pago': (r.pago_monto == null) ? '' : Number(r.pago_monto),
      Banco: r.pago_banco || '',
      'Fecha pago': r.pago_fecha ? String(r.pago_fecha).slice(0, 10) : '',
      Referencia: r.pago_ref || '',
      ReportId: r.report_id || '',
      Notas: r.observaciones || '',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(salida)
    XLSX.utils.book_append_sheet(wb, ws, 'DICOM')
    const hoy = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `DICOM_${hoy}.xlsx`)
  }

  const thBase = { padding: '9px 12px', textAlign: 'left', position: 'sticky', top: 52, zIndex: 20, background: 'var(--gray-50)', borderBottom: '1px solid var(--border)' }
  const lblStyle = { fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }
  const tdBase = { padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)' }

  const ColHead = ({ col }) => (
    <th style={thBase}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={lblStyle}>{col.label}</span>
        <HeaderFilter col={col} movs={todas} state={filters[col.key]} setState={v => setFiltroCol(col.key, v)}
          open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden}
          limpiarTodo={limpiarTodo} hayAlguno={hayFiltros} />
      </span>
    </th>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <TopNav />
      <BotonVolver />

      <div style={{ padding: '10px 24px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/cc1" style={{ fontSize: 12, color: 'var(--gray-400)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          {Ico.back} Volver al LOG
        </Link>
        <span style={{ color: 'var(--border)', fontSize: 14 }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, background: '#7c3aed', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {Ico.shield}
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--gray-900)', margin: 0, letterSpacing: '-0.3px' }}>DICOM</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'Total informes', value: kpis.total, color: 'var(--gray-800)' },
          { label: 'Sin comprobante', value: kpis.sinComp, color: '#dc2626' },
          { label: 'Pagados por FCR', value: kpis.fcr, color: '#d97706' },
          { label: 'Total $ pagado', value: money(kpis.totalPagado), color: '#16a34a' },
        ].map((k, i) => (
          <div key={i} style={{ padding: '10px 20px', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ position: 'relative', flex: '0 0 auto' }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', display: 'flex' }}>{Ico.search}</span>
          <input type="text" placeholder="Nombre, RUT, IDADMON, pagador…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7, borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--gray-50)', fontSize: 12,
              color: 'var(--gray-700)', fontFamily: 'inherit', width: 260, outline: 'none' }} />
        </div>
        {hayFiltros && (
          <button onClick={limpiarTodo} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: '#FEF3C7', fontSize: 12, color: '#92400E', cursor: 'pointer', fontFamily: 'inherit' }}>
            ✕ Limpiar filtros
          </button>
        )}
        <div style={{ flex: 1 }} />
        <ActionBtn label={`Exportar Excel (${filtradas.length})`} bg="#1c7d3f" icon={Ico.download} onClick={exportarExcel} />
      </div>

      <div style={{ padding: '16px 24px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-800)', margin: '0 0 12px' }}>
          Consultas DICOM
          <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 400, marginLeft: 8 }}>
            ({total} registro{total === 1 ? '' : 's'})
          </span>
        </h2>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
            <thead>
              <tr style={{ background: 'var(--gray-50)' }}>
                {DICOM_COLS.map(c => <ColHead key={c.key} col={c} />)}
                <th style={{ ...thBase, ...lblStyle }}>Impagos</th>
                <th style={{ ...thBase, ...lblStyle }}>Pagador</th>
                <th style={{ ...thBase, ...lblStyle }}>Monto</th>
                <th style={{ ...thBase, ...lblStyle }}>Notas</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>Cargando datos...</td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={13} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>No se encontraron registros</td></tr>
              ) : filtradas.map((r, i) => (
                <tr key={r.id ?? i}>
                  <td style={tdBase}>{fmtFecha(r.fecha_consulta) || '—'}</td>
                  <td style={{ ...tdBase, fontWeight: 600, color: 'var(--gray-800)' }}>{r.nombre || '—'}</td>
                  <td style={{ ...tdBase, fontFamily: 'monospace' }}>{r.rut || '—'}</td>
                  <td style={tdBase}>{r.rol_consultado || '—'}</td>
                  <td style={{ ...tdBase, fontFamily: 'monospace' }}>{r.idadmon || '—'}</td>
                  <td style={tdBase}><RiesgoBadge v={r.indicador_riesgo} /></td>
                  <td style={tdBase}>{r.everclean === true ? 'SÍ' : (r.everclean === false ? 'NO' : '—')}</td>
                  <td style={tdBase}><QuienBadge v={r.quien_asume} /></td>
                  <td style={tdBase}>{r.pago_banco || '—'}</td>
                  <td style={tdBase}>
                    {(r.monto_impagos ? money(r.monto_impagos) : '$0')}
                    {r.docs_impagos != null && <span style={{ color: 'var(--gray-400)' }}> · {r.docs_impagos}</span>}
                  </td>
                  <td title={r.pagador_nombre || ''} style={{ ...tdBase, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pagador_nombre || '—'}</td>
                  <td style={tdBase}>{r.pago_monto != null ? money(r.pago_monto) : '—'}</td>
                  <td title={r.observaciones || ''} style={{ ...tdBase, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--gray-500)' }}>{r.observaciones || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
