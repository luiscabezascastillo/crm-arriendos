'use client'
// VERSION: v14 · 2026-08-27 · Resumen: el Resultado pasa a PROTAGONISTA con eje propio a la IZQUIERDA (numeracion
//   azul=beneficio/rojo=perdida, con signo), linea solida gruesa y puntos por signo; Ventas/Costes difuminadas al eje DERECHO. Hereda v13.
// VERSION: v13 · 2026-08-27 · Resumen CC1+CC2+CC3: el ÚLTIMO mes (en curso, datos aún incompletos) se traza
//   PUNTEADO en las tres curvas y con el punto hueco, para distinguir lo provisional de lo cerrado. Hereda v12.
// VERSION: v12 · 2026-08-27 · Panel: se SUPRIME la barra superior de KPIs demo (Ingresos/Costes/Resultado/
//   Propiedades/Alertas, cifras inventadas). En su lugar, RESUMEN CC1+CC2+CC3 con 3 curvas: Ventas total
//   (admon_fcr+ingresos+facturación), Costes total y Resultado (Ventas−Costes, línea gruesa) en EJE
//   PROPIO (doble escala) para que se lea. Solo pinta meses con CC1 (congelados + mes en curso). Hereda v11.
// VERSION: v11 · 2026-08-26 · Widget "Salud del cobro" (4 KPIs renta+servicios) arriba del contenido, reutilizado de Cobranza. Hereda v10.
// VERSION: v10 · 2026-08-16 · (1) Los importes de las tarjetas CC dejan de ir en compacto ($76,7M) y se muestran en
//   NÚMERO COMPLETO con separador de miles y sin símbolo (76.700.000). (2) Cada tarjeta lleva debajo, dentro del
//   cuadro, un mini-gráfico de líneas con la EVOLUCIÓN del año (paleta validada, con leyenda). Hereda v9.
// VERSION: v9 · 2026-08-16 · OPERACIÓN a lo ancho: CC1/CC2/CC3 dejan de ir en tres columnas y se APILAN, cada una
//   ocupando el ancho de la página, para mostrar un AÑO completo. La ventana de meses pasa de 3 a 12 (rodante:
//   avanza sola el día 23). Fix CC1: los meses viejos sin liquidación congelada ya no heredan el estimado "en vivo"
//   del mes actual (solo el mes en curso lleva el asterisco). Hereda v8.
// VERSION: v8 · 2026-08-13 · Fila de LOGROS compacta a una sola línea (tarjetas horizontales: número + texto al
//   lado), en vez de las cajas altas. Hereda v7.
// VERSION: v7 · 2026-08-13 · Aviso "DATOS NO VERIFICADOS · PANEL EN FASE DE CONSTRUCCIÓN" en la franja de Operación.
//   Fix: la espera media de las P acota los días a >=0 (había P con fecha futura → media negativa). Hereda v6.
// VERSION: v6 · 2026-08-13 · CC3 Mantenimiento pasa a DATOS REALES (3 meses): Facturación (ventas ccb='CC3', neto),
//   Compras CC3 (compras ccb='CC3', neto, sin RECHAZADA) y Otros costes CC3 (Cristhian [rem] del mes anterior +
//   honorarios VIGENTE de todos menos Luis/Tirza/Ángela/Lorena + $527.067 fijo de Alberto) + línea Resultado. Se
//   quitan los botones de CC2. Vistas nuevas: vw_panel_cc3_fact / _compras / _otros. Hereda v5.
// VERSION: v5 · 2026-08-13 · CC2 Arriendos Admon pasa a DATOS REALES (mini-tabla 3 meses como CC1): Cerrados
//   (datos_arriendos por fecha_inicio, mes en curso con *), Ingresos (comision_base + comision_a_base) y Costes a
//   verificar (Neika [rem_lineas] + honorarios de Ángela + $1M fijo de Alberto, del mes cerrado anterior). Línea de
//   "No arrendados" P/(S+SQ+P) en vivo, y caja con espera máx./media de las P (reemplaza "Pendientes de firma").
//   Vistas nuevas: vw_panel_cc2 y vw_panel_cc2_costes. Hereda v4.
// VERSION: v4 · 2026-08-13 · CC1: fila "Costes a verificar" cableada (vw_panel_cc1_costes): nóminas de
//   Karina/Adalis/Anthony (rem_lineas) + honorarios de Luis/Tirza, del MES CERRADO anterior (AGO usa JUL).
//   Parcial: falta Fabiola y aportes patronales. También: morosos ahora incluyen estado S y SQ. Hereda v3.
// VERSION: v3 · 2026-08-13 · CC1 Administración pasa a DATOS REALES: mini-tabla de los 3 últimos meses de
//   liquidación (ventana móvil que avanza el día 23) con Propiedades arrendadas · Total Dueños · Admon de FCR
//   (comisión neta sin IVA, excluyendo a Paola + $210.000 fijos). Mes CONGELADO → vw_panel_cc1_idadmon; mes EN
//   CURSO (no congelado) → vw_panel_cc1_vivo (estimado en vivo desde datos_arriendos: renta UF×valor_uf o cuota,
//   comisión = renta×pct_adm). Cambia solo al congelarse. Costes "por definir", morosidad "próx.". CC2/CC3 demo. Hereda v2.
// VERSION: v2 · 2026-08-13 · Zona inferior del panel reconstruida con DATOS REALES (Supabase): cuadro de LOGROS
//   + 4 columnas (Términos pendientes ×2, Morosos cartola+servicios, Disponibles SQ/P). Lee las vistas
//   vw_panel_terminos / vw_panel_morosos / vw_panel_disponibles. Se quitan "Actividad reciente" y "Tareas
//   pendientes" (eran demo). La barra KPI de arriba y las 3 tarjetas CC siguen siendo demo (pendiente). Hereda v1.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import TopNav from '../components/ui/TopNav'
import AvisoPagos from '../components/ui/AvisoPagos'
import AvisoRecordatorios from '../components/ui/AvisoRecordatorios'
import { supabase } from '../../lib/supabaseClient'
import KpisResumen from '../op/cobranza/KpisResumen'

const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL')

// Formato compacto para la mini-tabla de CC1 ($76,7M · $5,1M · $298K)
const compact = n => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1).replace('.', ',') + 'M'
  if (Math.abs(v) >= 1e3) return '$' + Math.round(v / 1e3) + 'K'
  return '$' + Math.round(v)
}

// Número completo con separador de miles, sin símbolo (76.700.000 · -2.600.000).
const miles = n => Math.round(Number(n) || 0).toLocaleString('es-CL')

// Mini-gráfico de líneas: evolución del año dentro de cada tarjeta. Paleta categórica validada
// (blue/orange/aqua/yellow), 2px, con leyenda y etiquetas de eje (secondary encoding). Ignora meses sin dato.
function MiniChart({ series, labels }) {
  const VW = 900, VH = 148, PL = 92, PR = 14, PT = 10, PB = 22
  const pw = VW - PL - PR, ph = VH - PT - PB, n = labels.length
  const nums = series.flatMap(s => s.data).filter(v => v != null && Number.isFinite(v))
  if (!nums.length) return null
  let lo = Math.min(...nums), hi = Math.max(...nums)
  const hasNeg = lo < 0
  if (hasNeg) { lo = Math.min(lo, 0); hi = Math.max(hi, 0) }
  if (lo === hi) hi = lo + Math.max(1, Math.abs(lo) * 0.1)
  const pad = (hi - lo) * 0.12, yLo = lo - pad, yHi = hi + pad
  const X = i => PL + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw)
  const Y = v => PT + (1 - (v - yLo) / (yHi - yLo)) * ph
  const ticks = [yLo, (yLo + yHi) / 2, yHi]
  const path = data => {
    let d = '', pen = false
    data.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) { pen = false; return }
      d += (pen ? ' L ' : ' M ') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true
    })
    return d
  }
  const AX = '#e6e4dc', TXT = '#8a8880'
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '2px 2px 4px' }}>
        {series.map(s => (
          <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--gray-600)' }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: s.color }} />{s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
        {ticks.map((t, i) => (
          <g key={'t' + i}>
            <line x1={PL} y1={Y(t)} x2={VW - PR} y2={Y(t)} stroke={AX} strokeWidth="1" />
            <text x={PL - 6} y={Y(t) + 3} textAnchor="end" fontSize="9" fill={TXT}>{miles(t)}</text>
          </g>
        ))}
        {hasNeg && <line x1={PL} y1={Y(0)} x2={VW - PR} y2={Y(0)} stroke="#c9c6bd" strokeWidth="1.2" />}
        {labels.map((l, i) => (i % 2 === 0) ? <text key={'x' + i} x={X(i)} y={VH - 6} textAnchor="middle" fontSize="9" fill={TXT}>{String(l).slice(0, 3)}</text> : null)}
        {series.map(s => (
          <g key={s.label}>
            <path d={path(s.data)} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            {s.data.map((v, i) => (v != null && Number.isFinite(v)) ? <circle key={i} cx={X(i)} cy={Y(v)} r="2.4" fill={s.color} /> : null)}
          </g>
        ))}
      </svg>
    </div>
  )
}

// Resumen CC1+CC2+CC3. PROTAGONISTA: el Resultado (Ventas-Costes), con su eje propio a la IZQUIERDA, linea
// solida y gruesa, puntos AZUL (beneficio) / ROJO (perdida) y la numeracion del eje en ese mismo color (las
// perdidas con signo negativo). Ventas y Costes van de apoyo, DIFUMINADAS, en el eje DERECHO. Solo pinta los
// meses con dato de CC1 (congelados + mes en curso); el ultimo mes va punteado (datos aun incompletos).
function ResumenChart({ labels, ventas, costes, pl }) {
  const VW = 1160, VH = 262, PL = 96, PR = 96, PT = 30, PB = 26
  const pw = VW - PL - PR, ph = VH - PT - PB, n = labels.length
  const vcNums = [...ventas, ...costes].filter(v => v != null && Number.isFinite(v))
  const plNums = pl.filter(v => v != null && Number.isFinite(v))
  if (!plNums.length) return (
    <div style={{ height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--gray-400)' }}>
      Sin meses congelados en la ventana todavía.
    </div>
  )
  // Eje DERECHO: Ventas + Costes (apoyo), anclado en 0
  let V0 = Math.min(0, ...vcNums), V1 = Math.max(1, ...vcNums)
  if (V0 === V1) V1 = V0 + 1
  V1 += (V1 - V0) * 0.10
  // Eje IZQUIERDO: Resultado (lo que interesa), escala propia, incluye el 0
  let R0 = Math.min(0, ...plNums), R1 = Math.max(0, ...plNums)
  if (R0 === R1) R1 = R0 + 1
  const rp = (R1 - R0) * 0.16; R0 -= rp; R1 += rp
  const X = i => PL + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw)
  const Yr = v => PT + (1 - (v - R0) / (R1 - R0)) * ph    // Resultado (eje izq)
  const Yvc = v => PT + (1 - (v - V0) / (V1 - V0)) * ph   // Ventas/Costes (eje der)
  const mk = (data, Y) => {
    let d = '', pen = false
    data.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) { pen = false; return }
      d += (pen ? ' L ' : ' M ') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true
    })
    return d
  }
  // Indices validos + si el ultimo es el mes en curso (para puntear ese tramo).
  const lastSeg = d => {
    const vi = []; d.forEach((v, i) => { if (v != null && Number.isFinite(v)) vi.push(i) })
    const li = vi.length ? vi[vi.length - 1] : -1
    const en = li === d.length - 1 && vi.length >= 2
    return { li, en, pi: en ? vi[vi.length - 2] : -1 }
  }
  const TXT = '#8a8880', AX = '#e6e4dc'
  const C_V = '#1baf7a', C_C = '#eb6834'
  const AZUL = '#1d4ed8', ROJO = '#dc2626'
  const colorPt = v => (v >= 0 ? AZUL : ROJO)
  const rt = [R1, (R0 + R1) / 2, 0, R0].filter((x, i, a) => a.indexOf(x) === i)   // ticks eje izq (incluye 0)
  const vt = [V1, (V0 + V1) / 2, V0]                                              // ticks eje der
  const faded = [{ d: ventas, c: C_V }, { d: costes, c: C_C }]
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '0 4px 8px', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--gray-800)', fontWeight: 800 }}>
          <span style={{ width: 22, height: 5, borderRadius: 2, background: AZUL }} />Resultado (Ventas − Costes)
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--gray-400)', fontWeight: 500 }}>
          <span style={{ width: 15, height: 3, borderRadius: 2, background: C_V, opacity: 0.45 }} />Ventas
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--gray-400)', fontWeight: 500 }}>
          <span style={{ width: 15, height: 3, borderRadius: 2, background: C_C, opacity: 0.45 }} />Costes
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--gray-400)', fontStyle: 'italic', marginLeft: 'auto' }}>eje izq: Resultado (azul=beneficio · rojo=pérdida) · eje der: ventas y costes (apoyo)</span>
      </div>
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
        {/* rejilla segun el eje IZQ (Resultado) */}
        {rt.map((t, i) => <line key={'g' + i} x1={PL} y1={Yr(t)} x2={VW - PR} y2={Yr(t)} stroke={AX} strokeWidth="1" />)}
        {/* linea 0: frontera beneficio / perdida */}
        <line x1={PL} y1={Yr(0)} x2={VW - PR} y2={Yr(0)} stroke="#b9b6ad" strokeWidth="1.4" />
        {/* etiquetas eje IZQ (Resultado) coloreadas por signo, negativas con su signo */}
        {rt.map((t, i) => <text key={'lt' + i} x={PL - 10} y={Yr(t) + 3.5} textAnchor="end" fontSize="11.5" fontWeight="700" fill={t >= 0 ? AZUL : ROJO}>{miles(t)}</text>)}
        {/* etiquetas eje DER (Ventas/Costes), neutras */}
        {vt.map((t, i) => <text key={'vt' + i} x={VW - PR + 10} y={Yvc(t) + 3.5} textAnchor="start" fontSize="10" fill={TXT}>{miles(t)}</text>)}
        {labels.map((l, i) => <text key={'x' + i} x={X(i)} y={VH - 6} textAnchor="middle" fontSize="9.5" fill={TXT}>{String(l).slice(0, 3)}</text>)}

        {/* Ventas y Costes: APOYO, difuminadas (eje der) */}
        {faded.map((sr, si) => {
          const { li, en, pi } = lastSeg(sr.d)
          const firme = en ? sr.d.map((v, i) => i === li ? null : v) : sr.d
          return (
            <g key={'f' + si} opacity="0.3">
              <path d={mk(firme, Yvc)} fill="none" stroke={sr.c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              {en && <line x1={X(pi)} y1={Yvc(sr.d[pi])} x2={X(li)} y2={Yvc(sr.d[li])} stroke={sr.c} strokeWidth="1.8" strokeDasharray="2 4" strokeLinecap="round" />}
              {sr.d.map((v, i) => (v != null && Number.isFinite(v)) ? <circle key={i} cx={X(i)} cy={Yvc(v)} r="1.8" fill={sr.c} /> : null)}
            </g>
          )
        })}

        {/* RESULTADO: protagonista, solido y grueso (eje izq). Puntos AZUL beneficio / ROJO perdida. */}
        {(() => {
          const { li, en, pi } = lastSeg(pl)
          const firme = en ? pl.map((v, i) => i === li ? null : v) : pl
          return (
            <g>
              <path d={mk(firme, Yr)} fill="none" stroke={AZUL} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
              {en && <line x1={X(pi)} y1={Yr(pl[pi])} x2={X(li)} y2={Yr(pl[li])} stroke={colorPt(pl[li])} strokeWidth="4.2" strokeLinecap="round" strokeDasharray="3 5" />}
              {pl.map((v, i) => (v != null && Number.isFinite(v))
                ? (i === li && en
                    ? <circle key={i} cx={X(i)} cy={Yr(v)} r="4.6" fill="#fff" stroke={colorPt(v)} strokeWidth="2.2" />
                    : <circle key={i} cx={X(i)} cy={Yr(v)} r="4.2" fill={colorPt(v)} />)
                : null)}
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

// Ventana móvil de 12 meses de liquidación (un año). Avanza uno el día 23 (cuando se cierra el mes),
// de modo que el año se va corriendo solo mes a mes.
const MABR = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const N_MESES = 12
function mesesVentana() {
  const now = new Date()
  let y = now.getFullYear(), m = now.getMonth()
  if (now.getDate() >= 23) { m += 1; if (m > 11) { m = 0; y += 1 } }
  const out = []
  for (let k = N_MESES - 1; k >= 0; k--) {
    let mm = m - k, yy = y
    while (mm < 0) { mm += 12; yy -= 1 }
    out.push({ aamm: String(yy % 100).padStart(2, '0') + String(mm + 1).padStart(2, '0'), lbl: MABR[mm] + ' ' + String(yy % 100).padStart(2, '0') })
  }
  return out
}

// AAMM del mes anterior (para el coste del mes ya cerrado: AGO usa JUL, etc.)
function prevAamm(aamm) {
  let yy = +aamm.slice(0, 2), mm = +aamm.slice(2)
  mm -= 1; if (mm < 1) { mm = 12; yy -= 1 }
  return String(yy).padStart(2, '0') + String(mm).padStart(2, '0')
}

function CC1Row({ label, vals, strong, color }) {
  return (
    <tr>
      <td style={{ textAlign: 'left', fontSize: 11.5, color: 'var(--gray-600)', padding: '5px 4px', whiteSpace: 'nowrap' }}>{label}</td>
      {vals.map((v, i) => (
        <td key={i} style={{ textAlign: 'right', fontSize: 11, fontWeight: strong ? 700 : 500, color: color || 'var(--gray-800)', padding: '4px 5px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v}</td>
      ))}
    </tr>
  )
}

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `3px solid ${color}`, borderRadius: 10, padding: '8px 12px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1, flexShrink: 0 }}>{valor}</div>
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--gray-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--gray-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
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
  const [meses]                 = useState(mesesVentana)
  const [cc1, setCc1]           = useState([])
  const [cc2, setCc2]           = useState([])
  const [cc3, setCc3]           = useState([])
  const [noArr, setNoArr]       = useState(null)                 // % no arrendados (en vivo)
  const [espera, setEspera]     = useState({ max: null, med: null })
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
        const aamm = meses.map(x => x.aamm)
        const prevs = meses.map(x => prevAamm(x.aamm))   // costes = mes cerrado anterior
        const [cad, cvivo, ccos] = await Promise.all([
          supabase.from('vw_panel_cc1_idadmon').select('*').in('mes', aamm),   // meses congelados
          supabase.from('vw_panel_cc1_vivo').select('*').limit(1),             // mes en curso (estimado)
          supabase.from('vw_panel_cc1_costes').select('*').in('aamm', prevs),  // costes del mes cerrado
        ])
        const byMes = {}
        for (const r of cad.data || []) byMes[r.mes] = { ...r, vivo: false }
        const vivo = (cvivo.data && cvivo.data[0]) || null
        const costesMap = {}
        for (const r of ccos.data || []) costesMap[r.aamm] = r.costes
        // Mes congelado → idadmon. Solo el mes EN CURSO (el último de la ventana, aún no congelado) usa el
        // estimado en vivo. Los meses viejos sin dato congelado quedan en blanco (no heredan el estimado actual).
        const enCurso = meses[meses.length - 1].aamm
        const cc1data = meses.map(x => {
          const base = byMes[x.aamm]
            ? { ...x, ...byMes[x.aamm], vivo: false }
            : (x.aamm === enCurso ? { ...x, ...(vivo || {}), vivo: true } : { ...x, vivo: false })
          base.costes = costesMap[prevAamm(x.aamm)]
          return base
        })
        // ── CC2 (Arriendos Admon): cerrados + ingresos por mes + costes (Neika + Ángela + $1M Alberto) ──
        const [c2, c2cos] = await Promise.all([
          supabase.from('vw_panel_cc2').select('*').in('aamm', aamm),
          supabase.from('vw_panel_cc2_costes').select('*').in('aamm', prevs),
        ])
        const c2Mes = {}; for (const r of c2.data || []) c2Mes[r.aamm] = r
        const c2Cos = {}; for (const r of c2cos.data || []) c2Cos[r.aamm] = r.costes
        const cc2data = meses.map(x => ({
          ...x,
          cerrados: c2Mes[x.aamm]?.cerrados ?? 0,
          ingresos: c2Mes[x.aamm]?.ingresos ?? 0,
          costes: Math.round(Number(c2Cos[prevAamm(x.aamm)] ?? 0)) + 1000000,   // + Alberto $1M fijo
        }))
        // % no arrendados (en vivo): P / (S + SQ + P)
        const [nP, nS, nSQ] = await Promise.all([
          cnt('datos_arriendos', [['estado', 'P']]),
          cnt('datos_arriendos', [['estado', 'S']]),
          cnt('datos_arriendos', [['estado', 'SQ']]),
        ])
        const denom = nP + nS + nSQ
        const noArrVivo = denom ? Math.round((nP / denom) * 1000) / 10 : null
        // Espera de las P (desde la vista de disponibles ya leída): máx y media de días en búsqueda
        const pDias = (d.data || []).filter(r => r.estado === 'P' && r.dias != null).map(r => Math.max(0, Number(r.dias) || 0))
        const eMax = pDias.length ? Math.max(...pDias) : null
        const eMed = pDias.length ? Math.round(pDias.reduce((a, x) => a + x, 0) / pDias.length) : null

        // ── CC3 (Mantenimiento): facturación (ventas CC3) + compras CC3 + otros costes (Cristhian + honorarios + $527.067 Alberto) ──
        const [c3f, c3c, c3o] = await Promise.all([
          supabase.from('vw_panel_cc3_fact').select('*').in('aamm', aamm),
          supabase.from('vw_panel_cc3_compras').select('*').in('aamm', aamm),
          supabase.from('vw_panel_cc3_otros').select('*').in('aamm', prevs),
        ])
        const c3fMes = {}; for (const r of c3f.data || []) c3fMes[r.aamm] = r.facturacion
        const c3cMes = {}; for (const r of c3c.data || []) c3cMes[r.aamm] = r.compras
        const c3oMes = {}; for (const r of c3o.data || []) c3oMes[r.aamm] = r.otros
        const cc3data = meses.map(x => {
          const facturacion = Math.round(Number(c3fMes[x.aamm] ?? 0))
          const compras = Math.round(Number(c3cMes[x.aamm] ?? 0))
          const otros = Math.round(Number(c3oMes[prevAamm(x.aamm)] ?? 0)) + 527067   // + Alberto $527.067 fijo
          return { ...x, facturacion, compras, otros, resultado: facturacion - compras - otros }
        })

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
        setCc1(cc1data)
        setCc2(cc2data); setCc3(cc3data); setNoArr(noArrVivo); setEspera({ max: eMax, med: eMed })
        setLogros({ auditados, reclamaciones, depuradas, activos, disponibles })
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [])

  // Mes en curso (para el * de Cerrados/Ingresos de CC2): AAMM del mes real de hoy.
  const nowAamm = (() => { const n = new Date(); return String(n.getFullYear() % 100).padStart(2, '0') + String(n.getMonth() + 1).padStart(2, '0') })()

  // Resumen CC1+CC2+CC3 por mes: solo se pinta el mes si CC1 tiene dato (congelado o en curso).
  // Ventas = admon_fcr + ingresos + facturación · Costes = costes CC1 + costes CC2 + (compras+otros) CC3.
  const resumen = meses.map((x, i) => {
    const a = cc1[i], b = cc2[i], c = cc3[i]
    const v1 = a && a.admon_fcr != null ? Number(a.admon_fcr) : null
    if (v1 == null) return { v: null, c: null, p: null }
    const ventas = v1 + Number(b?.ingresos || 0) + Number(c?.facturacion || 0)
    const costes = Number(a.costes || 0) + Number(b?.costes || 0) + Number(c?.compras || 0) + Number(c?.otros || 0)
    return { v: ventas, c: costes, p: ventas - costes }
  })

  const nivelColor = n => n >= 3 ? 'var(--danger-600)' : n === 2 ? 'var(--warning-600)' : 'var(--success-600)'
  const nivelBg    = n => n >= 3 ? '#dc2626' : n === 2 ? '#d97706' : '#16a34a'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <TopNav />
      <AvisoPagos />
      <AvisoRecordatorios />

      {/* Resumen CC1+CC2+CC3 — Ventas, Costes y Resultado (doble escala). Sustituye la barra de KPIs demo. */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 24px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--gray-700)', letterSpacing: '.04em' }}>RESUMEN CC1 + CC2 + CC3</span>
          <span style={{ fontSize: 10.5, color: 'var(--gray-400)' }}>Ventas y costes de las tres áreas juntas · Resultado (Ventas−Costes) en escala propia · año rodante</span>
        </div>
        <ResumenChart
          labels={meses.map(m => m.lbl)}
          ventas={resumen.map(r => r.v)}
          costes={resumen.map(r => r.c)}
          pl={resumen.map(r => r.p)}
        />
        <div style={{ fontSize: 9.5, color: 'var(--gray-400)', marginTop: 4, fontStyle: 'italic' }}>Ventas = Admon FCR (CC1) + Ingresos arriendos (CC2) + Facturación (CC3). Costes parciales (mes cerrado anterior). Solo meses con liquidación CC1 (congelados + mes en curso). El último mes va PUNTEADO: aún no están cargados todos sus datos.</div>
      </div>

      <div style={{ padding: '20px 24px' }}>

        <KpisResumen />

        {/* OPERACIÓN */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Operación</span>
          <span style={{ flex: 1, padding: '6px 12px', borderRadius: 8, background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textAlign: 'center' }}>⚠ DATOS NO VERIFICADOS · PANEL EN FASE DE CONSTRUCCIÓN</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {/* CC1 — DATOS REALES (liquidaciones, año rodante) */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: '#1a56db', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#fff', opacity: 0.9, display: 'flex' }}><IcoHome /></span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1 }}>CC1 Administración</span>
              <GridDots />
            </div>
            <div style={{ padding: '8px 14px 4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}></th>
                  {meses.map((mm, i) => <th key={mm.aamm} style={{ textAlign: 'right', fontSize: 10, color: cc1[i]?.vivo ? '#c2410c' : 'var(--gray-500)', fontWeight: 700, padding: '2px 4px', letterSpacing: '.02em' }}>{mm.lbl}{cc1[i]?.vivo ? ' *' : ''}</th>)}
                </tr></thead>
                <tbody>
                  <CC1Row label="Propiedades arrendadas" vals={cc1.map(c => c.arrendadas != null ? c.arrendadas : '—')} />
                  <CC1Row label="Total Dueños"           vals={cc1.map(c => c.total_duenos != null ? miles(c.total_duenos) : '—')} strong />
                  <CC1Row label="Admon de FCR"           vals={cc1.map(c => c.admon_fcr != null ? miles(c.admon_fcr) : '—')} strong color="#0F6E56" />
                  <CC1Row label="Costes a verificar"     vals={cc1.map(c => c.costes != null ? miles(c.costes) : '—')} color="#B45309" />
                </tbody>
              </table>
              {cc1.some(c => c.vivo) && (
                <div style={{ fontSize: 9.5, color: '#c2410c', marginTop: 3, fontStyle: 'italic' }}>* mes en curso: estimado en vivo (sin reajuste IPC); se fija al congelar</div>
              )}
              <div style={{ fontSize: 9.5, color: 'var(--gray-400)', marginTop: 2, fontStyle: 'italic' }}>Costes = mes cerrado anterior · parcial (nóminas + honorarios; falta Fabiola y aportes)</div>
            </div>
            <div style={{ padding: '4px 14px 8px', borderTop: '1px solid var(--border-subtle)' }}>
              <MiniChart labels={meses.map(m => m.lbl)} series={[
                { label: 'Admon de FCR', color: '#1baf7a', data: cc1.map(c => c.admon_fcr ?? null) },
                { label: 'Costes',       color: '#eb6834', data: cc1.map(c => c.costes ?? null) },
              ]} />
            </div>
            <div style={{ padding: '2px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Índice de morosidad</span>
                <span style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic' }}>próximamente</span>
              </div>
            </div>
            <div style={{ padding: '10px 16px 16px' }}>
              <Link href="/procesos/liquidaciones" style={{ display: 'block', padding: '7px 0', borderRadius: 8, background: '#1a56db', color: '#fff', textAlign: 'center', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>Ver liquidaciones</Link>
            </div>
          </div>
          {/* CC2 — DATOS REALES (arriendos: cerrados + ingresos + costes, 3 meses) */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: '#d97706', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#fff', opacity: 0.9, display: 'flex' }}><IcoKey /></span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1 }}>CC2 Arriendos Admon</span>
              <GridDots />
            </div>
            <div style={{ padding: '8px 14px 4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}></th>
                  {meses.map(mm => <th key={mm.aamm} style={{ textAlign: 'right', fontSize: 10, color: mm.aamm === nowAamm ? '#c2410c' : 'var(--gray-500)', fontWeight: 700, padding: '2px 4px', letterSpacing: '.02em' }}>{mm.lbl}{mm.aamm === nowAamm ? ' *' : ''}</th>)}
                </tr></thead>
                <tbody>
                  <CC1Row label="Cerrados"           vals={cc2.map(c => c.cerrados != null ? c.cerrados : '—')} strong />
                  <CC1Row label="Ingresos"           vals={cc2.map(c => c.ingresos != null ? miles(c.ingresos) : '—')} strong color="#0F6E56" />
                  <CC1Row label="Costes a verificar" vals={cc2.map(c => c.costes != null ? miles(c.costes) : '—')} color="#B45309" />
                </tbody>
              </table>
              {meses.some(mm => mm.aamm === nowAamm) && (
                <div style={{ fontSize: 9.5, color: '#c2410c', marginTop: 3, fontStyle: 'italic' }}>* mes en curso (aún no cerrado)</div>
              )}
              <div style={{ fontSize: 9.5, color: 'var(--gray-400)', marginTop: 2, fontStyle: 'italic' }}>Costes = mes cerrado anterior · Neika + honorarios Ángela + $1M Alberto</div>
            </div>
            <div style={{ padding: '4px 14px 8px', borderTop: '1px solid var(--border-subtle)' }}>
              <MiniChart labels={meses.map(m => m.lbl)} series={[
                { label: 'Ingresos', color: '#1baf7a', data: cc2.map(c => c.ingresos ?? null) },
                { label: 'Costes',   color: '#eb6834', data: cc2.map(c => c.costes ?? null) },
              ]} />
            </div>
            <div style={{ padding: '2px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>No arrendados (P / S+SQ+P)</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: noArr != null && noArr >= 10 ? 'var(--warning-600)' : 'var(--gray-800)' }}>
                  {noArr != null ? String(noArr).replace('.', ',') + '%' : '—'} <span style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 400 }}>en vivo</span>
                </span>
              </div>
            </div>
            {/* Espera de las P (reemplaza "Pendientes de firma") */}
            <div style={{ margin: '4px 16px 12px', padding: '8px 10px', borderRadius: 7, background: 'var(--warning-50)', border: '1px solid #fcd34d', display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--gray-500)', fontWeight: 600 }}>Espera máx. para arrendar</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#92400e' }}>{espera.max != null ? espera.max + ' d' : '—'}</div>
              </div>
              <div style={{ flex: 1, borderLeft: '1px solid #fcd34d', paddingLeft: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--gray-500)', fontWeight: 600 }}>Media en espera (P)</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#92400e' }}>{espera.med != null ? espera.med + ' d' : '—'}</div>
              </div>
            </div>
          </div>
          {/* CC3 — DATOS REALES (mantenimiento: facturación − compras − otros, 3 meses) */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: '#dc2626', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#fff', opacity: 0.9, display: 'flex' }}><IcoWrench /></span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1 }}>CC3 Mantenimiento</span>
              <GridDots />
            </div>
            <div style={{ padding: '8px 14px 4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}></th>
                  {meses.map(mm => <th key={mm.aamm} style={{ textAlign: 'right', fontSize: 10, color: mm.aamm === nowAamm ? '#c2410c' : 'var(--gray-500)', fontWeight: 700, padding: '2px 4px', letterSpacing: '.02em' }}>{mm.lbl}{mm.aamm === nowAamm ? ' *' : ''}</th>)}
                </tr></thead>
                <tbody>
                  <CC1Row label="Facturación"       vals={cc3.map(c => c.facturacion != null ? miles(c.facturacion) : '—')} strong color="#0F6E56" />
                  <CC1Row label="Compras CC3"        vals={cc3.map(c => c.compras != null ? miles(c.compras) : '—')} color="#B45309" />
                  <CC1Row label="Otros costes CC3"   vals={cc3.map(c => c.otros != null ? miles(c.otros) : '—')} color="#B45309" />
                  <CC1Row label="Resultado"          vals={cc3.map(c => c.resultado != null ? miles(c.resultado) : '—')} strong color="#1a1a2e" />
                </tbody>
              </table>
              {meses.some(mm => mm.aamm === nowAamm) && (
                <div style={{ fontSize: 9.5, color: '#c2410c', marginTop: 3, fontStyle: 'italic' }}>* mes en curso (aún no cerrado)</div>
              )}
              <div style={{ fontSize: 9.5, color: 'var(--gray-400)', marginTop: 2, fontStyle: 'italic' }}>Facturación y compras = mes en curso · Otros = Cristhian (mes anterior) + honorarios + $527.067 Alberto</div>
            </div>
            <div style={{ padding: '4px 14px 12px', borderTop: '1px solid var(--border-subtle)' }}>
              <MiniChart labels={meses.map(m => m.lbl)} series={[
                { label: 'Facturación', color: '#1baf7a', data: cc3.map(c => c.facturacion ?? null) },
                { label: 'Compras',     color: '#eb6834', data: cc3.map(c => c.compras ?? null) },
                { label: 'Otros',       color: '#eda100', data: cc3.map(c => c.otros ?? null) },
                { label: 'Resultado',   color: '#2a78d6', data: cc3.map(c => c.resultado ?? null) },
              ]} />
            </div>
          </div>
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
