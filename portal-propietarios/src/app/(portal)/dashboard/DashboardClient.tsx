'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function fmtPeso(v: number): string {
  if (!v || v === 0) return '$0'
  return '$' + Math.abs(v).toLocaleString('es-CL')
}

function mesToLabel(m: string) {
  const [y, mo] = m.split('-')
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return meses[parseInt(mo) - 1] + ' ' + y.substring(2)
}

type GraficoPoint = { mes: string; ingresos: number; ggcc: number }
type AlertaMoroso  = { idadmon: string; inmueble: string; saldo: number }
type AlertaVenc    = { idadmon: string; inmueble: string; termino: string }

interface Props {
  nombreCorto: string; tratamiento: string; idprop: string
  totalS: number; totalSQ: number; totalQ: number; totalP: number
  ingresoMensual: number; totalMorosidad: number
  totalGGCC: number; totalLuz: number; totalAgua: number
  morososCount: number
  graficoData: GraficoPoint[]
  alertasMorosos: AlertaMoroso[]
  alertasVencimiento: AlertaVenc[]
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: {value:number;name:string;color:string}[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'10px 14px', fontSize:12 }}>
      <div style={{ fontWeight:600, color:'#111827', marginBottom:6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color:p.color, marginBottom:2 }}>
          {p.name === 'ingresos' ? 'Ingresos' : 'Gastos comunes'}: {fmtPeso(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function DashboardClient({
  nombreCorto, tratamiento, idprop,
  totalS, totalSQ, totalQ, totalP,
  ingresoMensual, totalMorosidad,
  totalGGCC, totalLuz, totalAgua,
  morososCount, graficoData,
  alertasMorosos, alertasVencimiento,
}: Props) {

  const dataConLabel = graficoData.map(d => ({ ...d, label: mesToLabel(d.mes) }))
  const hayAlertas = alertasMorosos.length > 0 || alertasVencimiento.length > 0

  return (
    <div className="dash-wrap">
      <div style={{ marginBottom:'1.5rem' }}>
        <div style={{ fontSize:22, fontWeight:600, color:'#111827' }}>{tratamiento}, {nombreCorto}</div>
        <div style={{ fontSize:13, color:'#6B7280', marginTop:3 }}>
          {idprop} · {new Date().toLocaleDateString('es-CL', { month:'long', year:'numeric' })}
        </div>
      </div>

      {/* KPIs estados */}
      <div className="kpi-grid" style={{ marginBottom:'1rem' }}>
        {[
          { label:'Arrendados al día',  value:totalS,  color:'#059669' },
          { label:'Aviso de término',   value:totalSQ, color:'#D97706' },
          { label:'En proceso término', value:totalQ,  color:'#EA580C' },
          { label:'Vacantes',           value:totalP,  color:'#DC2626' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* KPIs financieros */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:'1.5rem' }}>
        <div style={{ background:'#0F1923', borderRadius:10, padding:'16px 20px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6 }}>Ingreso mensual estimado</div>
          <div style={{ fontSize:22, fontWeight:600, color:'#fff', fontFamily:'DM Mono, monospace' }}>{fmtPeso(ingresoMensual)}</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:4 }}>{totalS + totalSQ} contratos activos</div>
        </div>
        <div style={{ background:morososCount > 0 ? '#FEF2F2' : '#ECFDF5', border:`1px solid ${morososCount > 0 ? '#FCA5A5' : '#6EE7B7'}`, borderRadius:10, padding:'16px 20px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:morososCount > 0 ? '#DC2626' : '#059669', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6 }}>
            {morososCount > 0 ? 'Morosidad detectada' : 'Sin morosidad'}
          </div>
          <div style={{ fontSize:22, fontWeight:600, color:morososCount > 0 ? '#DC2626' : '#059669', fontFamily:'DM Mono, monospace' }}>{fmtPeso(totalMorosidad)}</div>
          <div style={{ fontSize:11, color:morososCount > 0 ? '#EF4444' : '#059669', marginTop:4 }}>
            {morososCount > 0 ? `${morososCount} contratos con deuda` : 'Todos al día'}
          </div>
        </div>
        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:'16px 20px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>Servicios pendientes</div>
          {[
            { l:'GGCC', v:totalGGCC },
            { l:'Luz',  v:totalLuz  },
            { l:'Agua', v:totalAgua },
          ].map(s => (
            <div key={s.l} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
              <span style={{ color:'#6B7280' }}>{s.l}</span>
              <span style={{ fontFamily:'DM Mono, monospace', color:s.v > 0 ? '#D97706' : '#9CA3AF', fontWeight:s.v > 0 ? 600 : 400 }}>
                {s.v > 0 ? fmtPeso(s.v) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Gráfico */}
      <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, padding:'1.2rem 1.5rem', marginBottom:'1.5rem' }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:'1.2rem' }}>
          Evolución mensual — Ingresos recibidos y Gastos Comunes
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={dataConLabel} margin={{ top:10, right:20, left:10, bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="label"
              tick={{ fontSize:11, fill:'#9CA3AF' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize:11, fill:'#9CA3AF' }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              tickFormatter={v => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'K' : String(v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize:12, paddingTop:12 }}
              formatter={value => value === 'ingresos' ? 'Ingresos recibidos' : 'Gastos comunes'}
            />
            <Line
              type="monotone"
              dataKey="ingresos"
              stroke="#2B6CB8"
              strokeWidth={2}
              dot={{ r:3, fill:'#2B6CB8' }}
              activeDot={{ r:5 }}
              name="ingresos"
            />
            <Line
              type="monotone"
              dataKey="ggcc"
              stroke="#D97706"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r:3, fill:'#D97706' }}
              activeDot={{ r:5 }}
              name="ggcc"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Alertas */}
      {hayAlertas && (
        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, padding:'1.2rem 1.5rem' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:'1rem' }}>Alertas</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {alertasMorosos.slice(0, 5).map(a => (
              <div key={a.idadmon} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#FEF2F2', borderRadius:8, border:'1px solid #FCA5A5' }}>
                <span style={{ fontSize:16 }}>🔴</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#991B1B' }}>
                    {a.inmueble}
                    <span style={{ fontWeight:400, color:'#EF4444', marginLeft:6 }}>· {a.idadmon}</span>
                  </div>
                  <div style={{ fontSize:11, color:'#EF4444', marginTop:1 }}>Deuda pendiente: {fmtPeso(a.saldo)}</div>
                </div>
              </div>
            ))}
            {alertasMorosos.length > 5 && (
              <div style={{ fontSize:12, color:'#DC2626', textAlign:'center', padding:'4px 0' }}>
                + {alertasMorosos.length - 5} contratos más con deuda
              </div>
            )}
            {alertasVencimiento.map(a => (
              <div key={a.idadmon} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#FFFBEB', borderRadius:8, border:'1px solid #FCD34D' }}>
                <span style={{ fontSize:16 }}>⚠️</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#92400E' }}>
                    {a.inmueble}
                    <span style={{ fontWeight:400, color:'#D97706', marginLeft:6 }}>· {a.idadmon}</span>
                  </div>
                  <div style={{ fontSize:11, color:'#D97706', marginTop:1 }}>
                    Contrato vence: {new Date(a.termino).toLocaleDateString('es-CL')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
