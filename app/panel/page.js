'use client'
// VERSION: v2 · 2026-08-13 · Zona inferior del panel reconstruida con DATOS REALES (Supabase): cuadro de LOGROS
//   + 4 columnas (Términos pendientes ×2, Morosos cartola+servicios, Disponibles SQ/P). Lee las vistas
//   vw_panel_terminos / vw_panel_morosos / vw_panel_disponibles. Se quitan "Actividad reciente" y "Tareas
//   pendientes" (eran demo). La barra KPI de arriba y las 3 tarjetas CC siguen siendo demo (pendiente). Hereda v1.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import TopNav from '../components/ui/TopNav'
import { supabase } from '../../lib/supabaseClient'

const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL')

const palette = {
  blue:   { header: '#1a56db' },
  amber:  { header: '#d97706' },
  red:    { header: '#dc2626' },
  green:  { header: '#16a34a' },
  orange: { header: '#c2410c' },
}

function GridDots() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,5px)', gap: '3px', marginLeft: 'auto' }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ width: 5, height: 5, borderRadius: 1, background: 'rgba(255,255,255,0.35)' }} />
      ))}
    </div>
  )
}

function AreaCard({ color, icon, title, rows, alert, href, actionLabel }) {
  const { header } = palette[color]
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ background: header, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#fff', opacity: 0.9, display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1 }}>{title}</span>
        <GridDots />
      </div>
      <div style={{ padding: '0 16px' }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            {row.labelHref ? (
              <a href={row.labelHref} style={{ fontSize: 12, color: 'var(--gray-500)', textDecoration: 'none', cursor: 'pointer', borderBottom: '1px dashed var(--gray-400)' }}>{row.label}</a>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{row.label}</span>
            )}
            <span style={{ fontSize: 13, fontWeight: 500, color: row.highlight === 'danger' ? 'var(--danger-600)' : row.highlight === 'warning' ? 'var(--warning-600)' : 'var(--gray-800)' }}>{row.value}</span>
          </div>
        ))}
      </div>
      {alert && (
        <div style={{ margin: '0 16px 12px', padding: '6px 10px', borderRadius: 7, background: alert.type === 'danger' ? 'var(--danger-50)' : 'var(--warning-50)', border: `1px solid ${alert.type === 'danger' ? '#fca5a5' : '#fcd34d'}`, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, color: alert.type === 'danger' ? 'var(--danger-700)' : 'var(--warning-700)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2.5"/></svg>
          {alert.text}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px' }}>
        <Link href={href} style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: header, color: '#fff', textAlign: 'center', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>Ver detalle</Link>
        <button style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 12, color: 'var(--gray-600)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{actionLabel}</button>
      </div>
    </div>
  )
}

const IcoHome = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoKey  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="7.5" cy="15.5" r="5.5" stroke="currentColor" strokeWidth="2"/><path d="M21 2l-9.6 9.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M15.5 7.5L17 9l2.5-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoWrench = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2"/></svg>

// ── Tarjeta de LOGRO ─────────────────────────────────────────────
function Logro({ valor, label, color, sub }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `3px solid ${color}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--gray-400)', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

// ── Caja de columna con scroll ───────────────────────────────────
function ColBox({ title, subtitle, children, span }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gray-800)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10.5, color: 'var(--gray-400)', marginTop: 1 }}>{subtitle}</div>}
      </div>
      <div style={{ overflow: 'auto', maxHeight: 360 }}>{children}</div>
    </div>
  )
}

const th = { position: 'sticky', top: 0, background: '#F1EFE8', zIndex: 1, padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#5F5E5A', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }
const td = { padding: '5px 8px', fontSize: 11, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }
const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s }

function ChipGar({ q }) {
  const map = { FCR: ['#F6C6BD', '#9C2A1A'], 'DUEÑO': ['#D7E6F5', '#1F4E79'] }
  const [bg, fg] = map[q] || ['#EAD9F2', '#6B21A8']
  return <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: bg, color: fg }}>{q || 'NOHAY'}</span>
}

export default function PanelPage() {
  const [terminos, setTerminos] = useState([])
  const [morosos, setMorosos]   = useState([])
  const [dispon, setDispon]     = useState([])
  const [logros, setLogros]     = useState({ auditados: 0, reclamaciones: 0, depuradas: 0, activos: 0, disponibles: 0 })
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    const cnt = async (tabla, filtros = [], mods) => {
      let q = supabase.from(tabla).select('*', { count: 'exact', head: true })
      for (const [k, v] of filtros) q = q.eq(k, v)
      if (mods) q = mods(q)
      const { count } = await q
      return count || 0
    }
    ;(async () => {
      try {
        const [t, m, d] = await Promise.all([
          supabase.from('vw_panel_terminos').select('*').order('resultado', { ascending: true }).limit(60),
          supabase.from('vw_panel_morosos').select('*').order('deuda_total', { ascending: false }).limit(60),
          supabase.from('vw_panel_disponibles').select('*').order('dias', { ascending: false, nullsFirst: false }).limit(60),
        ])
        const [auditados, depuradas, activos, disponibles] = await Promise.all([
          cnt('datos_arriendos', [['estado', 'Q-Auditado']]),
          cnt('cuentas', [['concepto', 'COBRO DIRECTO PROPIETARIA']]),
          cnt('datos_arriendos', [['estado', 'S']]),
          cnt('datos_arriendos', [], q => q.in('estado', ['SQ', 'P'])),
        ])
        let reclamaciones = 0
        try { const { count } = await supabase.from('cobranza_gestiones').select('*', { count: 'exact', head: true }); reclamaciones = count || 0 } catch { /* tabla vacía o inexistente */ }
        if (!vivo) return
        setTerminos(t.data || []); setMorosos(m.data || []); setDispon(d.data || [])
        setLogros({ auditados, reclamaciones, depuradas, activos, disponibles })
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [])

  const nivelColor = n => n >= 3 ? 'var(--danger-600)' : n === 2 ? 'var(--warning-600)' : 'var(--success-600)'
  const nivelBg    = n => n >= 3 ? '#dc2626' : n === 2 ? '#d97706' : '#16a34a'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <TopNav />

      {/* KPI bar global (demo — pendiente de cablear) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'Ingresos totales', value: '$120.500', color: 'var(--success-600)' },
          { label: 'Costes totales',   value: '$84.300',  color: 'var(--warning-600)' },
          { label: 'Resultado neto',   value: '$36.200',  color: 'var(--success-600)' },
          { label: 'Propiedades',      value: '152',       color: 'var(--gray-800)'    },
          { label: 'Alertas activas',  value: '4',         color: 'var(--danger-600)'  },
        ].map((k, i) => (
          <div key={i} style={{ padding: '11px 20px', borderRight: i < 4 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* OPERACIÓN (demo — pendiente de cablear) */}
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Operación</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          <AreaCard color="blue"  icon={<IcoHome />}   title="CC1 Administración"   href="/cc1"  actionLabel="+ Nueva propiedad"
            rows={[{ label: 'Propiedades', value: '95' }, { label: 'Ingresos', value: '$78.200' }, { label: 'Costes', value: '$45.000' }, { label: 'Morosos', value: '8 (8,4%)', highlight: 'danger', labelHref: '/op/morosidad' }]}
            alert={{ type: 'danger', text: 'Aviso por morosidad' }} />
          <AreaCard color="amber" icon={<IcoKey />}    title="CC2 Arriendos Admon"  href="/cc2"  actionLabel="+ Nuevo arriendo"
            rows={[{ label: 'Cerrados', value: '18' }, { label: 'Ingresos', value: '$10.500' }, { label: 'Conversión', value: '45%' }, { label: 'Prop. vacías', value: '6 (6,3%)', highlight: 'warning' }]}
            alert={{ type: 'warning', text: 'Pendientes de firma' }} />
          <AreaCard color="red"   icon={<IcoWrench />} title="CC3 Mantenimiento"    href="/cc3"  actionLabel="+ Nueva incidencia"
            rows={[{ label: 'Abiertas', value: '12' }, { label: 'Facturación', value: '$6.800' }, { label: 'Coste', value: '$10.200' }, { label: 'Margen', value: '12%', highlight: 'warning' }]}
            alert={{ type: 'danger', text: '3 urgencias pendientes' }} />
        </div>

        {/* ── LOGROS (datos reales) ─────────────────────────────── */}
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Logros · lo que estamos consiguiendo</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
          <Logro valor={logros.auditados}    label="Términos auditados"  color="#0F6E56" sub="pasados a Q-Auditado" />
          <Logro valor={logros.reclamaciones} label="Reclamaciones"       color="#1a56db" sub="gestiones de cobranza" />
          <Logro valor={logros.depuradas}    label="Cartolas depuradas"  color="#7c3aed" sub="cobro directo marcado" />
          <Logro valor={logros.activos}      label="Contratos activos"   color="#0C447C" sub="en administración" />
          <Logro valor={logros.disponibles}  label="En búsqueda"         color="#c2410c" sub="SQ + P por arrendar" />
        </div>

        {/* ── SEGUIMIENTO: 4 columnas (datos reales) ────────────── */}
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          Seguimiento {cargando && <span style={{ color: 'var(--gray-400)', fontWeight: 400, textTransform: 'none' }}>· cargando…</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>

          {/* Col 1-2: TÉRMINOS pendientes */}
          <ColBox span={2} title={`Términos pendientes (${terminos.length})`} subtitle="por resultado, del más negativo · rojo = déficit">
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 560 }}>
              <thead><tr>
                <th style={th}>IDADMON</th><th style={th}>Est</th><th style={{ ...th, textAlign: 'right' }}>Resultado</th>
                <th style={th}>Garantía</th><th style={th}>Dueño</th><th style={{ ...th, textAlign: 'right' }}>Días</th>
              </tr></thead>
              <tbody>
                {terminos.map((r, i) => {
                  const neg = Number(r.resultado) < 0
                  return (
                    <tr key={i} style={{ background: neg ? '#FDECEA' : 'transparent' }}>
                      <td style={{ ...td, fontWeight: 700, color: '#0C447C' }}>{r.idadmon}</td>
                      <td style={td}>{r.estado}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: neg ? '#C0392B' : '#1E7B45', fontVariantNumeric: 'tabular-nums' }}>{money(r.resultado)}</td>
                      <td style={td}><ChipGar q={r.quien_tiene_garantia} /></td>
                      <td style={td} title={r.propietario}>{trunc(r.propietario, 16)}</td>
                      <td style={{ ...td, textAlign: 'right', color: r.dias >= 365 ? '#C0392B' : r.dias >= 180 ? '#B45309' : 'var(--gray-600)', fontWeight: r.dias >= 180 ? 700 : 400 }}>{r.dias ?? '—'}</td>
                    </tr>
                  )
                })}
                {!cargando && terminos.length === 0 && <tr><td style={td} colSpan={6}>Sin términos pendientes.</td></tr>}
              </tbody>
            </table>
          </ColBox>

          {/* Col 3: MOROSOS (cartola + servicios) */}
          <ColBox title={`Morosos (${morosos.length})`} subtitle="arriendo + servicios · más peligroso arriba">
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
              <thead><tr>
                <th style={th}>IDADMON</th><th style={th}>Arrendatario</th><th style={{ ...th, textAlign: 'right' }}>Deuda</th>
              </tr></thead>
              <tbody>
                {morosos.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td, borderLeft: `3px solid ${nivelBg(r.nivel)}`, fontWeight: 700, color: '#0C447C' }}>{r.idadmon}</td>
                    <td style={td} title={`${r.arrendatario} · ${r.inmueble}`}>{trunc(r.arrendatario, 18)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: nivelColor(r.nivel), fontVariantNumeric: 'tabular-nums' }}>{money(r.deuda_total)}</td>
                  </tr>
                ))}
                {!cargando && morosos.length === 0 && <tr><td style={td} colSpan={3}>Sin morosos activos.</td></tr>}
              </tbody>
            </table>
          </ColBox>

          {/* Col 4: DISPONIBLES para arrendar */}
          <ColBox title={`Disponibles (${dispon.length})`} subtitle="SQ y P · más antiguos en búsqueda arriba">
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
              <thead><tr>
                <th style={th}>IDADMON</th><th style={th}>Est</th><th style={th}>Inmueble</th><th style={{ ...th, textAlign: 'right' }}>Días</th>
              </tr></thead>
              <tbody>
                {dispon.map((r, i) => {
                  const dias = r.dias == null ? null : Math.max(0, r.dias)
                  return (
                    <tr key={i}>
                      <td style={{ ...td, fontWeight: 700, color: '#0C447C' }}>{r.idadmon}</td>
                      <td style={td}>{r.estado}</td>
                      <td style={td} title={`${r.inmueble} · ${r.propietario}`}>{trunc(r.inmueble, 20)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: dias >= 60 ? 700 : 400, color: dias >= 90 ? '#C0392B' : dias >= 45 ? '#B45309' : 'var(--gray-600)' }}>{dias ?? '—'}</td>
                    </tr>
                  )
                })}
                {!cargando && dispon.length === 0 && <tr><td style={td} colSpan={4}>Sin inmuebles en búsqueda.</td></tr>}
              </tbody>
            </table>
          </ColBox>

        </div>
      </div>
    </div>
  )
}
