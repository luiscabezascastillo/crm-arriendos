'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

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

function total(f) {
  return (fmt(f.deuda_gastos_comunes)||0) + (fmt(f.deuda_vigente_electricidad)||0) +
         (fmt(f.deuda_vigente_agua)||0) + (fmt(f.deuda_vigente_gas)||0)
}

const MESES = ['MAYO 2026','ABRIL 2026','MARZO 2026','FEBRERO 2026','ENERO 2026','DICIEMBRE 2025','NOVIEMBRE 2025','OCTUBRE 2025']

export default function Deudas() {
  const [mes, setMes] = useState('ABRIL 2026')
  const [filas, setFilas] = useState([])
  const [contratos, setContratos] = useState({})
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(null)
  const [historial, setHistorial] = useState(null)

  useEffect(() => {
    supabase.from('datos_arriendos')
      .select('idadmon,propietario,inmueble')
      .in('estado', ['S','P'])
      .then(({ data }) => {
        const map = {}
        if (data) data.forEach(c => { map[c.idadmon] = c })
        setContratos(map)
      })
  }, [])

  useEffect(() => {
    setLoading(true)
    setFilas([])
    supabase.from('ggcc_agua_luz')
      .select('idadmon,idinmue,estado,aamm,deuda_gastos_comunes,deuda_vigente_electricidad,deuda_vigente_agua,deuda_vigente_gas,fecha_hecho_ggcc,codigo_ele,codigo_agua,codigo_gas')
      .eq('mes', mes)
      .limit(500)
      .then(({ data }) => {
        setFilas((data || []).filter(f => f.idadmon && !f.idadmon.startsWith('.')))
        setLoading(false)
      })
  }, [mes])

  function abrirDrawer(f) {
    setDrawer(f)
    setHistorial(null)
    supabase.from('ggcc_agua_luz')
      .select('mes,aamm,deuda_gastos_comunes,deuda_vigente_electricidad,deuda_vigente_agua,deuda_vigente_gas')
      .eq('idadmon', f.idadmon)
      .order('aamm', { ascending: false })
      .limit(6)
      .then(({ data }) => setHistorial(data || []))
  }

  const conDeuda = filas.filter(f => total(f) > 0).length
  const sinDeuda = filas.filter(f => total(f) === 0).length
  const totDeuda = filas.reduce((s,f) => s+total(f), 0)

  return (
    <div style={{ padding:'24px 32px', maxWidth:1300, margin:'0 auto', fontFamily:'var(--font-sans,sans-serif)' }}>
      {/* Breadcrumb */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, fontSize:13 }}>
        <Link href="/cc1"
          style={{ background:'none', border:'none', cursor:'pointer', color:'#6B7280', padding:'4px 8px',
                   borderRadius:6, display:'flex', alignItems:'center', gap:4, fontSize:13, textDecoration:'none' }}>
          ← Volver a CC1
        </Link>
        <span style={{ color:'#D1D5DB' }}>/</span>
        <span style={{ color:'#6B7280' }}>Deudas de servicios</span>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:500, margin:0 }}>Deudas de servicios</h1>
          <p style={{ color:'#6B7280', fontSize:13, marginTop:4 }}>GGCC · Luz · Agua · Gas</p>
        </div>
        <select value={mes} onChange={e => setMes(e.target.value)}
          style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #D1D5DB', fontSize:14 }}>
          {MESES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
        {[
          { label:'Contratos', val:filas.length, color:'#185FA5' },
          { label:'Con deuda', val:conDeuda, color:'#A32D2D' },
          { label:'Sin deuda', val:sinDeuda, color:'#3B6D11' },
          { label:'Deuda total', val:'$'+Math.round(totDeuda/1000)+'k', color:'#A32D2D' },
        ].map(k => (
          <div key={k.label} style={{ background:'#F9FAFB', borderRadius:8, padding:'12px 16px', border:'0.5px solid #E5E7EB' }}>
            <div style={{ fontSize:11, color:'#6B7280', marginBottom:4 }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:500, color:k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      <div style={{ background:'#fff', border:'0.5px solid #E5E7EB', borderRadius:10, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:'2rem', textAlign:'center', color:'#9CA3AF' }}>Cargando...</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#F9FAFB' }}>
                  {['IDADMON','Propietario / Inmueble','Est.','Servicios','GGCC','Luz','Agua','Gas','Total'].map((h,i) => (
                    <th key={i} style={{ padding:'8px 12px', textAlign:i>=4?'right':'left', fontSize:11,
                                         fontWeight:500, color:'#6B7280', borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f,i) => {
                  const c = contratos[f.idadmon] || {}
                  const tot = total(f)
                  return (
                    <tr key={f.idadmon+i} onClick={() => abrirDrawer(f)}
                      style={{ background:drawer?.idadmon===f.idadmon?'#EFF6FF':i%2===0?'#fff':'#FAFAFA', cursor:'pointer' }}>
                      <td style={{ padding:'8px 12px', borderBottom:'0.5px solid #F3F4F6', fontWeight:500 }}>{f.idadmon}</td>
                      <td style={{ padding:'8px 12px', borderBottom:'0.5px solid #F3F4F6' }}>
                        <div>{c.propietario||'—'}</div>
                        <div style={{ fontSize:11, color:'#6B7280' }}>{c.inmueble||f.idinmue}</div>
                      </td>
                      <td style={{ padding:'8px 12px', borderBottom:'0.5px solid #F3F4F6' }}>
                        <span style={{ fontSize:10, padding:'2px 7px', borderRadius:8, fontWeight:500,
                                       background:f.estado==='S'?'#EAF3DE':'#FAEEDA', color:f.estado==='S'?'#3B6D11':'#854F0B' }}>
                          {f.estado}
                        </span>
                      </td>
                      <td style={{ padding:'8px 12px', borderBottom:'0.5px solid #F3F4F6' }}>
                        <div style={{ display:'flex', gap:4 }}>
                          <Dot val={f.deuda_gastos_comunes} />
                          <Dot val={f.deuda_vigente_electricidad} />
                          <Dot val={f.deuda_vigente_agua} />
                          <Dot val={f.deuda_vigente_gas} />
                        </div>
                      </td>
                      {[f.deuda_gastos_comunes,f.deuda_vigente_electricidad,f.deuda_vigente_agua,f.deuda_vigente_gas].map((v,vi) => (
                        <td key={vi} style={{ padding:'8px 12px', borderBottom:'0.5px solid #F3F4F6', textAlign:'right',
                                              fontWeight:500, color:fmt(v)>0?'#A32D2D':fmt(v)===0?'#3B6D11':'#9CA3AF' }}>
                          {v===null?'—':fmtPeso(fmt(v))}
                        </td>
                      ))}
                      <td style={{ padding:'8px 12px', borderBottom:'0.5px solid #F3F4F6', textAlign:'right',
                                   fontWeight:600, color:tot>0?'#A32D2D':'#3B6D11' }}>
                        {fmtPeso(tot)}
                      </td>
                    </tr>
                  )
                })}
                <tr style={{ background:'#F3F4F6' }}>
                  <td colSpan={4} style={{ padding:'8px 12px', fontSize:12, color:'#6B7280', fontWeight:500 }}>{filas.length} contratos</td>
                  {['deuda_gastos_comunes','deuda_vigente_electricidad','deuda_vigente_agua','deuda_vigente_gas'].map((col,i) => (
                    <td key={i} style={{ padding:'8px 12px', textAlign:'right', fontWeight:600, fontSize:12, color:'#A32D2D' }}>
                      {fmtPeso(filas.reduce((s,f) => s+(fmt(f[col])||0), 0))}
                    </td>
                  ))}
                  <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontSize:13, color:'#A32D2D' }}>
                    {fmtPeso(filas.reduce((s,f) => s+total(f), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {drawer && (
        <>
          <div onClick={() => { setDrawer(null); setHistorial(null) }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.2)', zIndex:40 }} />
          <div style={{ position:'fixed', top:0, right:0, bottom:0, width:420, background:'#fff',
                        zIndex:50, boxShadow:'-4px 0 24px rgba(0,0,0,0.1)', overflowY:'auto' }}>
            <div style={{ padding:'20px 24px', borderBottom:'0.5px solid #E5E7EB', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:'#EFF6FF', display:'flex',
                            alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:500, color:'#185FA5' }}>
                {(contratos[drawer.idadmon]?.propietario||'??').split(' ').map(w=>w[0]).slice(0,2).join('')}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500, fontSize:16 }}>{drawer.idadmon}</div>
                <div style={{ fontSize:12, color:'#6B7280' }}>{contratos[drawer.idadmon]?.propietario||'—'}</div>
              </div>
              <button onClick={() => { setDrawer(null); setHistorial(null) }}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#9CA3AF' }}>✕</button>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>
                {contratos[drawer.idadmon]?.inmueble || drawer.idinmue}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
                {[
                  { label:'G. Comunes', val:drawer.deuda_gastos_comunes, meta:drawer.fecha_hecho_ggcc },
                  { label:'Electricidad', val:drawer.deuda_vigente_electricidad, meta:drawer.codigo_ele },
                  { label:'Agua', val:drawer.deuda_vigente_agua, meta:drawer.codigo_agua },
                  { label:'Gas', val:drawer.deuda_vigente_gas, meta:null },
                ].map((s,i) => {
                  const v = fmt(s.val)
                  return (
                    <div key={i} style={{ background:'#F9FAFB', borderRadius:8, padding:'12px 14px', border:'0.5px solid #E5E7EB' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                        <Dot val={s.val} />
                        <span style={{ fontSize:11, color:'#6B7280', fontWeight:500 }}>{s.label}</span>
                      </div>
                      <div style={{ fontSize:18, fontWeight:500, color:v===null?'#9CA3AF':v===0?'#3B6D11':'#A32D2D' }}>
                        {v===null?'Sin datos':v===0?'Sin deuda':fmtPeso(v)}
                      </div>
                      {s.meta && s.meta !== 'estacionamiento' && s.meta !== 'bodega' &&
                        <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>{s.meta}</div>}
                    </div>
                  )
                })}
              </div>
              <div style={{ background:total(drawer)>0?'#FCEBEB':'#EAF3DE', borderRadius:8, padding:'12px 16px',
                            marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:500, color:total(drawer)>0?'#A32D2D':'#3B6D11' }}>Total deuda</span>
                <span style={{ fontSize:20, fontWeight:600, color:total(drawer)>0?'#A32D2D':'#3B6D11' }}>{fmtPeso(total(drawer))}</span>
              </div>

              {historial && historial.length > 0 && (() => {
                const meses = [...historial].reverse()
                const cols = ['deuda_gastos_comunes','deuda_vigente_electricidad','deuda_vigente_agua','deuda_vigente_gas']
                const labels = ['GGCC','Luz','Agua','Gas']
                const colors = ['#378ADD','#F59E0B','#10B981','#8B5CF6']
                const totales = meses.map(h => cols.reduce((s,c) => s+(fmt(h[c])||0), 0))
                const allVals = [...cols.flatMap(c => meses.map(h => fmt(h[c])||0)), ...totales]
                const maxV = Math.max(...allVals, 1)
                const W = 360, H = 160, padL = 50, padR = 10, padT = 10, padB = 30
                const xStep = (W - padL - padR) / Math.max(meses.length - 1, 1)
                const yScale = v => padT + (H - padT - padB) * (1 - v / maxV)
                const pts = (vals) => vals.map((v,i) => `${padL + i*xStep},${yScale(v)}`).join(' ')
                return (
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>
                      Evolución de deudas
                    </div>
                    <svg width={W} height={H} style={{ overflow:'visible' }}>
                      {/* Grid lines */}
                      {[0,0.25,0.5,0.75,1].map((p,i) => (
                        <g key={i}>
                          <line x1={padL} y1={yScale(maxV*p)} x2={W-padR} y2={yScale(maxV*p)}
                            stroke="#F3F4F6" strokeWidth="1" />
                          <text x={padL-4} y={yScale(maxV*p)+4} textAnchor="end" fontSize="9" fill="#9CA3AF">
                            {'$'+Math.round(maxV*p/1000)+'k'}
                          </text>
                        </g>
                      ))}
                      {/* Líneas por servicio */}
                      {cols.map((col,ci) => {
                        const vals = meses.map(h => fmt(h[col])||0)
                        if (vals.every(v => v === 0)) return null
                        return (
                          <polyline key={ci} fill="none" stroke={colors[ci]} strokeWidth="1.5"
                            strokeDasharray="4,2" opacity="0.8"
                            points={pts(vals)} />
                        )
                      })}
                      {/* Línea total — más gruesa */}
                      <polyline fill="none" stroke="#1F3864" strokeWidth="2.5"
                        points={pts(totales)} />
                      {/* Puntos en total */}
                      {totales.map((v,i) => (
                        <circle key={i} cx={padL+i*xStep} cy={yScale(v)} r="3" fill="#1F3864" />
                      ))}
                      {/* Etiquetas eje X */}
                      {meses.map((h,i) => (
                        <text key={i} x={padL+i*xStep} y={H-2} textAnchor="middle" fontSize="8" fill="#9CA3AF">
                          {(h.mes||'').split(' ')[0].slice(0,3)}
                        </text>
                      ))}
                    </svg>
                    {/* Leyenda */}
                    <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:6 }}>
                      {[...labels.map((l,i) => ({ label:l, color:colors[i] })), { label:'Total', color:'#1F3864' }].map((item,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'#6B7280' }}>
                          <div style={{ width:16, height:i===4?3:2, background:item.color, borderRadius:1 }} />
                          {item.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
              {historial ? historial.map((h,i) => {
                const v = fmt(h.deuda_gastos_comunes)||0
                const max = Math.max(...historial.map(d => fmt(d.deuda_gastos_comunes)||0), 1)
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom:'0.5px solid #F3F4F6', fontSize:12 }}>
                    <span style={{ width:110, color:'#6B7280', fontSize:11 }}>{h.mes}</span>
                    <div style={{ flex:1, height:6, background:'#F3F4F6', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ width:`${Math.round(v/max*100)}%`, height:6, background:'#378ADD', borderRadius:3 }} />
                    </div>
                    <span style={{ width:80, textAlign:'right', fontWeight:500 }}>{fmtPeso(v)}</span>
                  </div>
                )
              }) : <div style={{ color:'#9CA3AF', fontSize:12 }}>Cargando...</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}