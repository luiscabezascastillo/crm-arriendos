import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { redirect } from 'next/navigation'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ESTADOS: Record<string, { label: string; color: string; bg: string }> = {
  S:  { label: 'Arrendado al día',      color: '#059669', bg: '#ECFDF5' },
  SQ: { label: 'Aviso de término',      color: '#D97706', bg: '#FFFBEB' },
  Q:  { label: 'En proceso de término', color: '#EA580C', bg: '#FFF7ED' },
  P:  { label: 'Vacante',               color: '#DC2626', bg: '#FEF2F2' },
}

function calcularPrecio(c: Record<string, unknown>): number {
  const cuota = parseFloat(String(c.cuota ?? 0)) || 0
  const unid = String(c.unid ?? '').trim().toUpperCase()
  if (unid === 'UF') return Math.round(cuota * (parseFloat(String(c.uf_peso_factor ?? 1)) || 1))
  const reajustes = [
    c.cantidad_reajuste1, c.cantidad_reajuste2, c.cantidad_reajuste3,
    c.cantidad_reajuste4, c.cantidad_reajuste5, c.cantidad_reajuste6,
  ].reduce((s: number, r) => s + (parseFloat(String(r ?? 0)) || 0), 0)
  return Math.round(cuota + reajustes)
}

function fmtPeso(v: number): string {
  if (!v || v === 0) return '—'
  return '$' + Math.abs(v).toLocaleString('es-CL')
}

function fmtFecha(f: unknown): string {
  if (!f) return '—'
  const d = new Date(String(f))
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function PropiedadesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')
  const session = verifyToken(token)
  if (!session) redirect('/login')

  const { data: contratos } = await supabaseAdmin
    .from('datos_arriendos')
    .select('idadmon, estado, inmueble, cuota, unid, uf_peso_factor, cantidad_reajuste1, cantidad_reajuste2, cantidad_reajuste3, cantidad_reajuste4, cantidad_reajuste5, cantidad_reajuste6, fecha_inicio, termino_actual, garantia_pedida, quien_tiene_garantia, arrendatario')
    .eq('idprop', session.idprop)
    .in('estado', ['S', 'SQ', 'Q', 'P'])
    .order('inmueble')

  const todos = (contratos || []) as Record<string, unknown>[]
  const idadmons = todos.map(c => c.idadmon as string)

  const [{ data: saldos }, { data: servicios }] = await Promise.all([
    supabaseAdmin.from('cuentas').select('idadmon, cargo, abono').in('idadmon', idadmons),
    supabaseAdmin.from('ggcc_agua_luz')
      .select('idadmon, aamm, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua, deuda_vigente')
      .in('idadmon', idadmons)
      .order('aamm', { ascending: false }),
  ])

  const saldoMap = new Map<string, number>()
  for (const m of (saldos || [])) {
    const id = m.idadmon as string
    saldoMap.set(id, (saldoMap.get(id) || 0) + (parseFloat(String(m.cargo ?? 0)) || 0) - (parseFloat(String(m.abono ?? 0)) || 0))
  }

  const svcMap = new Map<string, Record<string, unknown>>()
  for (const s of (servicios || [])) {
    if (!svcMap.has(s.idadmon as string)) svcMap.set(s.idadmon as string, s as Record<string, unknown>)
  }

  const activos  = todos.filter(c => ['S', 'SQ'].includes(c.estado as string))
  const terminos = todos.filter(c => ['Q', 'P'].includes(c.estado as string))

  const ingresoActivos   = activos.reduce((s, c) => s + calcularPrecio(c), 0)
  const ingresoTerminos  = terminos.reduce((s, c) => s + calcularPrecio(c), 0)
  const garantiaActivos  = activos.reduce((s, c) => s + (parseFloat(String(c.garantia_pedida ?? 0)) || 0), 0)
  const garantiaTerminos = terminos.reduce((s, c) => s + (parseFloat(String(c.garantia_pedida ?? 0)) || 0), 0)

  const thStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase',
    letterSpacing: '.5px', padding: '10px 12px', textAlign: 'left',
    background: '#FAFAFA', whiteSpace: 'nowrap', position: 'sticky', top: 0,
    borderBottom: '1px solid #E5E7EB',
  }
  const tdBase: React.CSSProperties = { fontSize: 12, color: '#111827', padding: '10px 12px', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' }
  const tdMono: React.CSSProperties = { ...tdBase, fontFamily: 'DM Mono, monospace', textAlign: 'right' }

  const TablaContratos = ({ lista, titulo, totalRenta, totalGarantia, colorTotal }: {
    lista: Record<string, unknown>[]
    titulo: string
    totalRenta: number
    totalGarantia: number
    colorTotal: string
  }) => (
    <div className="tabla-wrap" style={{ marginBottom: '1.5rem' }}>
      <div className="tabla-head">
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{titulo}</span>
        <span style={{ fontSize: 12, color: '#6B7280' }}>{lista.length} contratos</span>
      </div>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th style={thStyle}>Inmueble</th>
              <th style={thStyle}>Arrendatario</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Renta mensual</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Pago</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Saldo</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>GGCC</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Luz</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Agua</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Gas</th>
              <th style={thStyle}>Inicio</th>
              <th style={thStyle}>Término</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Garantía</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Garantía en</th>
            </tr>
          </thead>
          <tbody>
            {lista.map(c => {
              const est = ESTADOS[c.estado as string] || { label: String(c.estado), color: '#6B7280', bg: '#F3F4F6' }
              const precio = calcularPrecio(c)
              const saldo = saldoMap.get(c.idadmon as string) || 0
              const moroso = saldo > 0
              const svc = svcMap.get(c.idadmon as string)
              const ggcc = parseFloat(String(svc?.deuda_gastos_comunes ?? 0)) || 0
              const luz  = parseFloat(String(svc?.deuda_vigente_electricidad ?? 0)) || 0
              const agua = parseFloat(String(svc?.deuda_vigente_agua ?? 0)) || 0
              const gas  = parseFloat(String(svc?.deuda_vigente ?? 0)) || 0
              const garantia = parseFloat(String(c.garantia_pedida ?? 0)) || 0
              return (
                <tr key={c.idadmon as string}>
                  <td style={tdBase}>
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{c.inmueble as string}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{c.idadmon as string}</div>
                  </td>
                  <td style={{ ...tdBase, fontSize: 11, color: '#6B7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(c.arrendatario as string) || '—'}
                  </td>
                  <td style={{ ...tdBase, textAlign: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: est.bg, color: est.color }}>{est.label}</span>
                  </td>
                  <td style={tdMono}>{precio > 0 ? fmtPeso(precio) : '—'}</td>
                  <td style={{ ...tdBase, textAlign: 'center' }}>
                    <span style={{ fontSize: 16 }}>{moroso ? '🔴' : '🟢'}</span>
                  </td>
                  <td style={{ ...tdMono, color: moroso ? '#DC2626' : '#059669', fontWeight: moroso ? 700 : 400 }}>
                    {saldo !== 0 ? fmtPeso(saldo) : '—'}
                  </td>
                  <td style={{ ...tdMono, color: ggcc > 0 ? '#D97706' : '#6B7280' }}>{ggcc > 0 ? fmtPeso(ggcc) : '—'}</td>
                  <td style={{ ...tdMono, color: luz  > 0 ? '#D97706' : '#6B7280' }}>{luz  > 0 ? fmtPeso(luz)  : '—'}</td>
                  <td style={{ ...tdMono, color: agua > 0 ? '#D97706' : '#6B7280' }}>{agua > 0 ? fmtPeso(agua) : '—'}</td>
                  <td style={{ ...tdMono, color: gas  > 0 ? '#D97706' : '#6B7280' }}>{gas  > 0 ? fmtPeso(gas)  : '—'}</td>
                  <td style={{ ...tdBase, fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtFecha(c.fecha_inicio)}</td>
                  <td style={{ ...tdBase, fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtFecha(c.termino_actual)}</td>
                  <td style={tdMono}>{garantia > 0 ? fmtPeso(garantia) : '—'}</td>
                  <td style={{ ...tdBase, fontSize: 11, color: '#6B7280', textAlign: 'center' }}>{String(c.quien_tiene_garantia ?? '—')}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#F9FAFB' }}>
              <td colSpan={3} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#111827', borderTop: '2px solid #E5E7EB' }}>Total</td>
              <td style={{ ...tdMono, fontWeight: 700, color: colorTotal, borderTop: '2px solid #E5E7EB' }}>{fmtPeso(totalRenta)}</td>
              <td colSpan={8} style={{ borderTop: '2px solid #E5E7EB' }}/>
              <td style={{ ...tdMono, fontWeight: 700, color: '#111827', borderTop: '2px solid #E5E7EB' }}>{fmtPeso(totalGarantia)}</td>
              <td style={{ borderTop: '2px solid #E5E7EB' }}/>
            </tr>
          </tfoot>
        </table>

        <div className="cards-mobile">
          {lista.map(c => {
            const est = ESTADOS[c.estado as string] || { label: String(c.estado), color: '#6B7280', bg: '#F3F4F6' }
            const precio = calcularPrecio(c)
            const saldo = saldoMap.get(c.idadmon as string) || 0
            const moroso = saldo > 0
            const svc = svcMap.get(c.idadmon as string)
            const ggcc = parseFloat(String(svc?.deuda_gastos_comunes ?? 0)) || 0
            return (
              <div key={c.idadmon as string} className="card-contrato">
                <div className="card-row">
                  <div>
                    <div className="card-val" style={{ fontWeight: 600 }}>{c.inmueble as string}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{c.idadmon as string}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: est.bg, color: est.color }}>{est.label}</span>
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>{(c.arrendatario as string) || '—'}</div>
                <div className="card-row">
                  <div><div className="card-label">Renta</div><div className="card-val mono">{fmtPeso(precio)}</div></div>
                  <div><div className="card-label">Pago</div><div style={{ fontSize: 18 }}>{moroso ? '🔴' : '🟢'}</div></div>
                  <div><div className="card-label">Saldo</div><div className="card-val mono" style={{ color: moroso ? '#DC2626' : '#059669' }}>{fmtPeso(Math.abs(saldo))}</div></div>
                </div>
                {ggcc > 0 && <div style={{ marginTop: 6, fontSize: 11, color: '#D97706' }}>GGCC pendiente: {fmtPeso(ggcc)}</div>}
                <div className="card-row" style={{ marginTop: 6 }}>
                  <div><div className="card-label">Inicio</div><div className="card-val">{fmtFecha(c.fecha_inicio)}</div></div>
                  <div><div className="card-label">Término</div><div className="card-val">{fmtFecha(c.termino_actual)}</div></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <div className="dash-wrap">
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#111827' }}>Mis propiedades</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{session.idprop} · {todos.length} contratos activos</div>
      </div>
      <TablaContratos lista={activos} titulo="Contratos activos" totalRenta={ingresoActivos} totalGarantia={garantiaActivos} colorTotal="#059669" />
      {terminos.length > 0 && (
        <TablaContratos lista={terminos} titulo="En proceso de término" totalRenta={ingresoTerminos} totalGarantia={garantiaTerminos} colorTotal="#EA580C" />
      )}
    </div>
  )
}
