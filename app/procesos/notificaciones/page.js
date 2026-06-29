'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

// ── Helpers ──────────────────────────────────────────────────────────────
const fmtMiles = (n) => {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—'
  return Math.round(Number(n)).toLocaleString('es-CL')
}
const num = (v) => {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

// revision normalizada → rama. "IPC 6 meses" se trata como "IPC semestral".
function esUF(revision) {
  return (revision || '').trim().toUpperCase() === 'UF'
}

// apagar (importe a pagar del mes):
//   UF   → cuota × uf_peso_factor (uf_peso_factor ya es el valor UF del mes)
//   resto→ cuota + suma de los 6 cantidad_reajusteN (los no aplicados son 0)
function calcularApagar(c) {
  if (esUF(c.revision)) {
    return Math.round(num(c.cuota) * num(c.uf_peso_factor))
  }
  const sumaReajustes =
    num(c.cantidad_reajuste1) + num(c.cantidad_reajuste2) + num(c.cantidad_reajuste3) +
    num(c.cantidad_reajuste4) + num(c.cantidad_reajuste5) + num(c.cantidad_reajuste6)
  return Math.round(num(c.cuota) + sumaReajustes)
}

// Etiqueta de la columna UF-Ajuste del formato CartaArrendatarios
function tipoComunicacion(c) {
  if (esUF(c.revision)) return 'UF'
  const r = (c.revision || '').trim().toUpperCase()
  if (r === 'FIJO' || r === '') return 'vacío'
  return 'AJUSTE'
}

// Badge de revisión (estilo del listado CC1)
const revColores = {
  'UF':               { bg: '#eff6ff', color: '#1a56db' },
  'IPC semestral':    { bg: '#f0fdf4', color: '#16a34a' },
  'IPC 6 meses':      { bg: '#f0fdf4', color: '#16a34a' },
  'IPC anual':        { bg: '#fffbeb', color: '#d97706' },
  'IPC trimestral':   { bg: '#fef2f2', color: '#dc2626' },
  'Semestral con UF': { bg: '#ecfeff', color: '#0891b2' },
  'FIJO':             { bg: '#f3f4f6', color: '#6b7280' },
}
function RevBadge({ revision }) {
  const s = revColores[(revision || '').trim()] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px',
      borderRadius: 6, background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {revision || '—'}
    </span>
  )
}

// ── Página ───────────────────────────────────────────────────────────────
export default function NotificacionesPage() {
  const { status } = useSession()
  const router = useRouter()

  const [contratos, setContratos] = useState([])
  const [indices, setIndices] = useState([])
  const [mesSel, setMesSel] = useState('')     // 'YYYY-MM-01'
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/api/auth/signin')
  }, [status, router])

  // Cargar índices mensuales (para mostrar el valor UF del mes) y contratos en estado S
  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const [{ data: idx }, { data: arr }] = await Promise.all([
        supabase.from('indices_mensuales')
          .select('mes, valor_uf, ipc_3m, ipc_6m, ipc_12m, uf_3m, uf_6m, uf_12m')
          .order('mes', { ascending: false }),
        supabase.from('datos_arriendos')
          .select('idadmon, propietario, inmueble, arrendatario, mail_arrendatario, revision, cuota, uf_peso_factor, cantidad_reajuste1, cantidad_reajuste2, cantidad_reajuste3, cantidad_reajuste4, cantidad_reajuste5, cantidad_reajuste6')
          .eq('estado', 'S'),
      ])
      const idxList = idx || []
      setIndices(idxList)
      // Mes por defecto: el más reciente cargado en indices_mensuales
      if (idxList.length) setMesSel(idxList[0].mes)
      // Orden Propietario → Propiedad
      const arrList = (arr || []).slice().sort((a, b) => {
        const p = (a.propietario || '').localeCompare(b.propietario || '', 'es')
        if (p !== 0) return p
        return (a.inmueble || '').localeCompare(b.inmueble || '', 'es')
      })
      setContratos(arrList)
      setLoading(false)
    }
    cargar()
  }, [])

  const idxMes = useMemo(
    () => indices.find((i) => i.mes === mesSel) || null,
    [indices, mesSel]
  )

  // Filas calculadas + filtro de búsqueda
  const filas = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contratos
      .filter((c) => {
        if (!q) return true
        return (
          (c.idadmon || '').toLowerCase().includes(q) ||
          (c.inmueble || '').toLowerCase().includes(q) ||
          (c.propietario || '').toLowerCase().includes(q) ||
          (c.arrendatario || '').toLowerCase().includes(q)
        )
      })
      .map((c) => ({
        ...c,
        apagar: calcularApagar(c),
        tipoCom: tipoComunicacion(c),
      }))
  }, [contratos, search])

  // KPIs
  const kpis = useMemo(() => {
    const total = filas.length
    const nUF = filas.filter((f) => esUF(f.revision)).length
    const totalCobrar = filas.reduce((s, f) => s + (f.apagar || 0), 0)
    return { total, nUF, conAjuste: total - nUF, totalCobrar }
  }, [filas])

  const mesLabel = (mes) => {
    if (!mes) return ''
    const [y, m] = mes.split('-')
    const nombres = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return `${nombres[parseInt(m, 10)]} ${y}`
  }

  if (status === 'loading' || loading) {
    return (
      <>
        <TopNav />
        <div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando notificaciones…</div>
      </>
    )
  }

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 24px 60px' }}>

        {/* CABECERA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button onClick={() => router.push('/cc1')}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid #D3D1C7',
              background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>
            ‹ Volver al listado
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: '#2C2C2A' }}>
            Notificaciones a arrendatarios
          </h1>
        </div>
        <div style={{ fontSize: 12, color: '#888780', marginBottom: 16 }}>
          Importe a pagar del mes por contrato activo (estado S). Solo lectura · no envía correos.
        </div>

        {/* CONTROLES: mes + valor UF + búsqueda */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>Mes a procesar</label>
            <select value={mesSel} onChange={(e) => setMesSel(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #D3D1C7',
                background: '#fff', fontSize: 13, color: '#2C2C2A', fontFamily: 'inherit', cursor: 'pointer' }}>
              {indices.map((i) => (
                <option key={i.mes} value={i.mes}>{mesLabel(i.mes)}</option>
              ))}
            </select>
          </div>
          {idxMes && (
            <div style={{ fontSize: 12, color: '#085041', background: '#E1F5EE',
              padding: '7px 12px', borderRadius: 8, fontWeight: 600 }}>
              Valor UF {mesLabel(mesSel)}: ${fmtMiles(idxMes.valor_uf)}
            </div>
          )}
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <input type="text" placeholder="IDADMON, inmueble, propietario, arrendatario…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #D3D1C7',
                background: '#F9FAFB', fontSize: 12, color: '#374151', fontFamily: 'inherit',
                width: 320, outline: 'none' }} />
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'Contratos activos (S)', val: kpis.total, color: '#1a56db' },
            { label: 'En UF', val: kpis.nUF, color: '#0891b2' },
            { label: 'Con ajuste ($)', val: kpis.conAjuste, color: '#16a34a' },
            { label: 'Total a cobrar el mes', val: `$${fmtMiles(kpis.totalCobrar)}`, color: '#633806' },
          ].map((k, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* TABLA */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '7%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--gray-50, #F9FAFB)' }}>
                {['IDADMON', 'Propietario', 'Propiedad', 'Arrendatario', 'Revisión', 'A pagar', 'Comunic.', 'email'].map((h, i) => (
                  <th key={i} style={{ padding: '9px 12px', textAlign: i === 5 ? 'right' : 'left',
                    borderBottom: '1px solid #E5E7EB', fontSize: 10, color: '#9CA3AF', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: '#9CA3AF' }}>No hay contratos que mostrar</td></tr>
              ) : filas.map((c, i) => (
                <tr key={c.idadmon} style={{ background: i % 2 ? '#FCFCFB' : '#fff' }}>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 12, fontWeight: 600, color: '#2C2C2A' }}>{c.idadmon}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.propietario || '—'}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.inmueble || '—'}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.arrendatario || '—'}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8' }}><RevBadge revision={c.revision} /></td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 13, fontWeight: 600, color: '#2C2C2A', textAlign: 'right' }}>${fmtMiles(c.apagar)}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 11, color: c.tipoCom === 'UF' ? '#1a56db' : c.tipoCom === 'AJUSTE' ? '#d97706' : '#9CA3AF', fontWeight: 500 }}>{c.tipoCom}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.mail_arrendatario || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 12 }}>
          {filas.length} contrato{filas.length === 1 ? '' : 's'} · ordenados por Propietario → Propiedad.
          El envío de correos y el guardado de notificaciones se construirán en una fase posterior.
        </div>
      </div>
    </>
  )
}