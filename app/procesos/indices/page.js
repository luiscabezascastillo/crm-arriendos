'use client'
// VERSION: v4 · 2026-07-23 · bloque IPC con fondo verde claro (como el Excel), separado del bloque de % ajuste por UF
// VERSION: v3 · 2026-07-23 · redondeo al guardar igual que el Excel (ipc 6 dec, uf_3m/6m 5 dec, uf_12m 4 dec)
// VERSION: v2 · 2026-07-23 · simbolo % junto a los campos de IPC y sin placeholders que parezcan valores
// VERSION: v1 · 2026-07-23 · Indices mensuales (UF + IPC) en formato Excel.
//   Se teclean solo VALOR UF, IPC 3M, IPC 6M e IPC ANO. El resto se calcula:
//   - % AJUSTE 3/6/12 M  = valor_uf(mes) / valor_uf(mes-N) - 1   -> columnas uf_3m/uf_6m/uf_12m
//   - PERIODO IPC 3/6/12 = (M-5 a M-2) / (M-8 a M-2) / (M-14 a M-2)  (solo ayuda visual)
//   Editable desde el mes de liquidacion en curso (regla: dia >= 23 -> mes siguiente).
//   Meses anteriores: SOLO LECTURA. Filas hasta diciembre 2027.
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const EDITA_EMAILS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const MESES_CAP = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const NUM_FONT = { fontFamily: '"DM Mono", "Roboto Mono", ui-monospace, Consolas, Menlo, monospace', fontVariantNumeric: 'tabular-nums' }

const HASTA = '2027-12-01'   // ultima fila que se muestra
const DESDE_DEFECTO = 2025   // primer ano visible por defecto

// Bloque IPC: fondo verde claro, como en el Excel. Marca las columnas que se
// teclean desde el INE y las distingue del bloque de % de ajuste por UF, que
// calcula el sistema. Son dos criterios distintos segun lo que diga el contrato.
const IPC_HEAD = '#D3EFDD'
const IPC_CELDA = '#EDF9F1'

// ── Helpers de mes ('YYYY-MM-01') ─────────────────────────────────────────
const mesKey = (y, m) => `${y}-${String(m).padStart(2, '0')}-01`
function addM(k, n) {
  const [y, m] = k.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return mesKey(Math.floor(t / 12), (t % 12) + 1)
}
const txtMes = k => { const [y, m] = k.split('-').map(Number); return `${MESES[m - 1]} ${y}` }
const txtMesCap = k => { const [y, m] = k.split('-').map(Number); return `${MESES_CAP[m - 1]} ${y}` }
const primerDia = k => { const [y, m] = k.split('-').map(Number); return `01/${String(m).padStart(2, '0')}/${y}` }
const ultimoDia = k => {
  const [y, m] = k.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

// Mes de liquidacion en curso: el ciclo abre el dia 23 del mes anterior.
// Ej.: 23-jul-2026 .. 22-ago-2026  ->  AGOSTO 2026
function mesLiquidacion(hoy = new Date()) {
  const k = mesKey(hoy.getFullYear(), hoy.getMonth() + 1)
  return hoy.getDate() >= 23 ? addM(k, 1) : k
}
// Rango de fechas del ciclo de un mes de liquidacion (para mostrarlo)
function rangoCiclo(k) {
  const ini = addM(k, -1)
  const [yi, mi] = ini.split('-').map(Number)
  const [yf, mf] = k.split('-').map(Number)
  return `23/${String(mi).padStart(2, '0')}/${yi} – 22/${String(mf).padStart(2, '0')}/${yf}`
}
// Periodo del IPC a consultar: N meses terminando 2 meses antes del mes del proceso
const periodoIpc = (k, n) => `${txtMesCap(addM(k, -(n + 2)))} a ${txtMesCap(addM(k, -2))}`

// ── Numeros ───────────────────────────────────────────────────────────────
function parseNum(s) {
  if (s === '' || s == null) return null
  let t = String(s).trim().replace(/\s/g, '')
  if (t === '') return null
  const coma = t.includes(','), punto = t.includes('.')
  if (coma && punto) t = t.replace(/\./g, '').replace(',', '.')
  else if (coma) t = t.replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
const fmtUf = v => v == null || v === '' ? '—' : Number(v).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (v, dec) => v == null || v === '' ? '—' : (Number(v) * 100).toFixed(dec).replace('.', ',') + ' %'
const pctInput = v => v == null || v === '' ? '' : String(Number((Number(v) * 100).toFixed(4))).replace('.', ',')

export default function IndicesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role
  const puedeEditar = rol === 'admin' || rol === 'direccion' || rol === 'finanzas' || EDITA_EMAILS.includes(email)

  const [filas, setFilas] = useState([])
  const [edits, setEdits] = useState({})       // { 'YYYY-MM-01': {valor_uf, ipc_3m, ipc_6m, ipc_12m} } tal cual se teclea
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [desdeAnio, setDesdeAnio] = useState(DESDE_DEFECTO)

  const mesActual = useMemo(() => mesLiquidacion(), [])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true); setAviso(null)
    const { data, error } = await supabase
      .from('indices_mensuales')
      .select('mes, valor_uf, ipc_3m, ipc_6m, ipc_12m, uf_3m, uf_6m, uf_12m')
      .order('mes')
    if (error) { setAviso('⚠ Error al cargar: ' + error.message); setCargando(false); return }
    setFilas((data || []).map(r => ({ ...r, mes: String(r.mes).slice(0, 10) })))
    setEdits({})
    setCargando(false)
  }

  // Mapa mes -> valor UF, incluyendo lo que se esta tecleando ahora
  const ufMap = useMemo(() => {
    const m = {}
    for (const f of filas) if (f.valor_uf != null) m[f.mes] = Number(f.valor_uf)
    for (const [k, e] of Object.entries(edits)) {
      if (e.valor_uf !== undefined) {
        const n = parseNum(e.valor_uf)
        if (n != null) m[k] = n; else delete m[k]
      }
    }
    return m
  }, [filas, edits])

  // % de ajuste de la UF: mes / (mes - n) - 1
  const ajusteUf = (k, n) => {
    const a = ufMap[k], b = ufMap[addM(k, -n)]
    if (!a || !b) return null
    return a / b - 1
  }

  // Lista de meses a mostrar
  const listaMeses = useMemo(() => {
    const out = []
    let k = mesKey(desdeAnio, 1)
    while (k <= HASTA) { out.push(k); k = addM(k, 1) }
    return out
  }, [desdeAnio])

  const porMes = useMemo(() => {
    const m = {}
    for (const f of filas) m[f.mes] = f
    return m
  }, [filas])

  const anios = useMemo(() => {
    const min = filas.length ? Number(filas[0].mes.slice(0, 4)) : DESDE_DEFECTO
    const out = []
    for (let a = min; a <= 2027; a++) out.push(a)
    return out
  }, [filas])

  // Valor de una celda: lo tecleado si existe, si no lo guardado
  const valCelda = (k, campo) => {
    const e = edits[k]
    if (e && e[campo] !== undefined) return e[campo]
    const f = porMes[k]
    if (!f || f[campo] == null) return ''
    return campo === 'valor_uf' ? String(f.valor_uf).replace('.', ',') : pctInput(f[campo])
  }
  const setCelda = (k, campo, valor) => {
    setEdits(prev => ({ ...prev, [k]: { ...(prev[k] || {}), [campo]: valor } }))
    setAviso(null)
  }

  const hayCambios = Object.keys(edits).length > 0
  const editable = k => puedeEditar && k >= mesActual

  // ¿El mes en curso tiene ya su UF cargada?
  const faltaMesActual = !ufMap[mesActual]

  // Redondeo con la misma precision que el Excel historico:
  //   ipc_*  -> 6 decimales (basta para cualquier valor del INE y limpia el ruido binario)
  //   uf_3m / uf_6m -> 5 decimales (3 decimales vistos como %)
  //   uf_12m -> 4 decimales (2 decimales vistos como %)
  const red = (v, dec) => v == null ? null : Number(Number(v).toFixed(dec))

  async function guardar() {
    setGuardando(true); setAviso(null)
    const payload = []
    const sospechosos = []
    for (const k of Object.keys(edits)) {
      const base = porMes[k] || {}
      const e = edits[k]
      const pc = s => { const n = parseNum(s); return n == null ? null : red(n / 100, 6) }
      const valor_uf = e.valor_uf !== undefined ? parseNum(e.valor_uf) : (base.valor_uf ?? null)
      const ipc_3m = e.ipc_3m !== undefined ? pc(e.ipc_3m) : (base.ipc_3m ?? null)
      const ipc_6m = e.ipc_6m !== undefined ? pc(e.ipc_6m) : (base.ipc_6m ?? null)
      const ipc_12m = e.ipc_12m !== undefined ? pc(e.ipc_12m) : (base.ipc_12m ?? null)
      if (valor_uf == null && ipc_3m == null && ipc_6m == null && ipc_12m == null) continue
      if (valor_uf != null && valor_uf < 1000) sospechosos.push(txtMes(k))
      payload.push({
        mes: k, valor_uf, ipc_3m, ipc_6m, ipc_12m,
        uf_3m: red(ajusteUf(k, 3), 5), uf_6m: red(ajusteUf(k, 6), 5), uf_12m: red(ajusteUf(k, 12), 4),
      })
    }
    if (!payload.length) { setAviso('No hay nada que guardar.'); setGuardando(false); return }
    if (sospechosos.length) {
      setAviso('⚠ Revisa el VALOR UF de: ' + sospechosos.join(', ') + '. Parece demasiado bajo (la UF ronda los 40.000). No se ha guardado nada.')
      setGuardando(false); return
    }
    const { error } = await supabase.from('indices_mensuales').upsert(payload, { onConflict: 'mes' })
    if (error) { setAviso('⚠ Error al guardar: ' + error.message); setGuardando(false); return }
    setAviso('✅ Guardado: ' + payload.map(p => txtMes(p.mes)).join(', '))
    setGuardando(false)
    await cargar()
  }

  if (status === 'loading') return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)

  const th = { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#334155', background: '#F1F5F9', borderBottom: '2px solid #CBD5E1', whiteSpace: 'nowrap', textAlign: 'center' }
  const td = { padding: '5px 10px', fontSize: 12, borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }
  const inp = ok => ({ width: 92, padding: '4px 7px', fontSize: 12, textAlign: 'right', borderRadius: 5, border: '1px solid ' + (ok ? '#93C5FD' : '#E2E8F0'), background: ok ? '#fff' : '#F8FAFC', fontFamily: NUM_FONT.fontFamily })

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1500, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <button onClick={() => router.push('/procesos/notificaciones')}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}>
            ‹ Notificaciones
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Índices mensuales · UF e IPC</h1>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
          Solo se teclean <b>VALOR UF</b> y los tres <b>IPC</b>. Los periodos a consultar y los % de ajuste por UF los calcula el sistema.
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16, fontSize: 12, color: '#475569' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: '#fff', border: '1px solid #CBD5E1', display: 'inline-block' }} />
            <b>% ajuste por UF</b> — lo calcula el sistema dividiendo valores de UF
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: IPC_HEAD, border: '1px solid #A7D7BC', display: 'inline-block' }} />
            <b>% ajuste por IPC</b> — dato del INE, se teclea tal cual
          </span>
          <span style={{ color: '#94A3B8' }}>Cada contrato usa uno u otro según su campo <b>revisión</b>.</span>
        </div>

        {/* Estado del mes en curso */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 16, padding: '12px 16px', borderRadius: 10,
          background: faltaMesActual ? '#FFFBEB' : '#F0FDF4',
          border: '1px solid ' + (faltaMesActual ? '#FDE68A' : '#BBF7D0'),
        }}>
          <div style={{ fontSize: 13, color: '#334155' }}>
            Mes de liquidación en curso: <b>{txtMes(mesActual)}</b>
            <span style={{ color: '#94A3B8' }}> · ciclo {rangoCiclo(mesActual)}</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: faltaMesActual ? '#FEF3C7' : '#DCFCE7', color: faltaMesActual ? '#92400E' : '#166534' }}>
            {faltaMesActual ? '⚠ FALTA CARGAR LA UF' : '✓ datos cargados'}
          </div>
          {faltaMesActual && (
            <div style={{ fontSize: 12, color: '#92400E' }}>
              Sin la UF del mes, las rentas en UF se calcularían con un valor antiguo <b>sin avisar</b>.
            </div>
          )}
        </div>

        {/* Controles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, color: '#475569' }}>Desde:&nbsp;
            <select value={desdeAnio} onChange={e => setDesdeAnio(Number(e.target.value))}
              style={{ fontSize: 13, padding: '6px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontFamily: 'inherit' }}>
              {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          {puedeEditar && (
            <button onClick={guardar} disabled={!hayCambios || guardando}
              style={{
                fontSize: 12, fontWeight: 700, padding: '8px 18px', borderRadius: 7, border: 'none',
                background: hayCambios ? '#1D9E75' : '#E2E8F0', color: hayCambios ? '#fff' : '#94A3B8',
                cursor: hayCambios ? 'pointer' : 'default', fontFamily: 'inherit',
              }}>
              {guardando ? 'Guardando…' : '💾 Guardar cambios'}
            </button>
          )}
          {hayCambios && !guardando && (
            <button onClick={() => { setEdits({}); setAviso(null) }}
              style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', cursor: 'pointer', fontFamily: 'inherit' }}>
              Descartar
            </button>
          )}
          {!puedeEditar && (
            <span style={{ fontSize: 12, color: '#94A3B8' }}>Solo lectura · la carga la hacen Dirección y Finanzas.</span>
          )}
        </div>

        {aviso && (
          <div style={{
            marginBottom: 14, fontSize: 13, fontWeight: 600, padding: '10px 14px', borderRadius: 8,
            background: aviso.startsWith('⚠') ? '#FEF2F2' : '#F0FDF4',
            color: aviso.startsWith('⚠') ? '#B91C1C' : '#166534',
            border: '1px solid ' + (aviso.startsWith('⚠') ? '#FECACA' : '#BBF7D0'),
          }}>{aviso}</div>
        )}

        {cargando ? <div style={{ padding: 30, color: '#94A3B8' }}>Cargando índices…</div> : (
          <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1400 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>MES DEL PROCESO</th>
                  <th style={{ ...th, background: '#DBEAFE' }}>VALOR UF</th>
                  <th style={th}>INICIO</th>
                  <th style={th}>FIN</th>
                  <th style={{ ...th, textAlign: 'left' }}>MES ANTERIOR</th>
                  <th style={th}>% AJUSTE<br />3 MESES</th>
                  <th style={th}>% AJUSTE<br />6 MESES</th>
                  <th style={th}>% AJUSTE<br />12 MESES</th>
                  <th style={{ ...th, background: IPC_HEAD }}>IPC<br />3 MESES</th>
                  <th style={{ ...th, background: IPC_HEAD }}>IPC<br />6 MESES</th>
                  <th style={{ ...th, background: IPC_HEAD }}>IPC<br />AÑO</th>
                  <th style={{ ...th, textAlign: 'left' }}>PERIODO IPC 3 MESES</th>
                  <th style={{ ...th, textAlign: 'left' }}>PERIODO IPC 6 MESES</th>
                  <th style={{ ...th, textAlign: 'left' }}>PERIODO IPC 12 MESES</th>
                </tr>
              </thead>
              <tbody>
                {listaMeses.map(k => {
                  const f = porMes[k] || {}
                  const esActual = k === mesActual
                  const edit = editable(k)
                  const tocado = !!edits[k]
                  const bg = esActual ? '#FFFBEB' : (tocado ? '#EFF6FF' : (edit ? '#FCFDFF' : '#fff'))
                  return (
                    <tr key={k} style={{ background: bg }}>
                      <td style={{ ...td, fontWeight: esActual ? 700 : 600, color: esActual ? '#92400E' : '#334155' }}>
                        {txtMes(k)}
                        {esActual && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#FEF3C7', color: '#92400E' }}>PRESENTE</span>}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {edit
                          ? <input value={valCelda(k, 'valor_uf')} onChange={e => setCelda(k, 'valor_uf', e.target.value)} placeholder="—" style={inp(true)} />
                          : <span style={NUM_FONT}>{fmtUf(f.valor_uf)}</span>}
                      </td>
                      <td style={{ ...td, textAlign: 'center', color: '#64748B' }}>{primerDia(k)}</td>
                      <td style={{ ...td, textAlign: 'center', color: '#64748B' }}>{ultimoDia(k)}</td>
                      <td style={{ ...td, color: '#64748B' }}>{txtMes(addM(k, -1))}</td>
                      <td style={{ ...td, textAlign: 'right', ...NUM_FONT, color: '#475569' }}>{fmtPct(ajusteUf(k, 3), 3)}</td>
                      <td style={{ ...td, textAlign: 'right', ...NUM_FONT, color: '#475569' }}>{fmtPct(ajusteUf(k, 6), 3)}</td>
                      <td style={{ ...td, textAlign: 'right', ...NUM_FONT, color: '#475569' }}>{fmtPct(ajusteUf(k, 12), 2)}</td>
                      {['ipc_3m', 'ipc_6m', 'ipc_12m'].map(campo => (
                        <td key={campo} style={{ ...td, textAlign: 'right', background: IPC_CELDA }}>
                          {edit
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <input value={valCelda(k, campo)} onChange={e => setCelda(k, campo, e.target.value)} placeholder="—" style={{ ...inp(true), width: 64 }} />
                                <span style={{ fontSize: 11, color: '#64748B' }}>%</span>
                              </span>
                            : <span style={NUM_FONT}>{fmtPct(f[campo], 2)}</span>}
                        </td>
                      ))}
                      <td style={{ ...td, color: '#64748B', fontSize: 11 }}>{periodoIpc(k, 3)}</td>
                      <td style={{ ...td, color: '#64748B', fontSize: 11 }}>{periodoIpc(k, 6)}</td>
                      <td style={{ ...td, color: '#64748B', fontSize: 11 }}>{periodoIpc(k, 12)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 12, color: '#94A3B8', lineHeight: 1.6 }}>
          Los porcentajes se escriben tal como los publica el INE: <b>1,4</b> para un 1,40 % (se guarda como 0,014).<br />
          En las filas editables los valores aparecen sin formato porque son campos de entrada; en las filas ya cerradas se ven como texto con su símbolo.<br />
          Las columnas <b>PERIODO IPC</b> indican qué variación hay que consultar en el INE para ese mes; son solo una ayuda, no se guardan.<br />
          Los meses anteriores al mes en curso son de solo lectura.
        </div>
      </div>
    </>
  )
}
