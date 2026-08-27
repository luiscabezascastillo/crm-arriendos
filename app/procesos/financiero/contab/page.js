// VERSION: 2026-08-26 · Añadido "← Volver" (BotonVolver, history.back) — convención de retorno. Hereda versión previa.
// VERSION: v14 · 2026-08-26 · Ayuda desplegable "Como funciona esto" (proceso, orden, idempotencia, revision, ojo con el anio). Hereda v13.
// VERSION: v13 · 2026-08-26 · Ficha "Cobro por mandato" (origen mandato, nivel 2) + nota explicativa. Hereda v12.
// VERSION: v12 · 2026-08-20 · Export Nubox: (a) celdas vacias como null (no string '') -> SheetJS escribia '' como celda presente en L-Q y Nubox lo leia como campo invalido (Monto/Fecha/RUT/Folio () + 'columnas L a Q requeridas'), rechazando toda la carga; (b) columna Centro Costo SIEMPRE vacia (el CC viaja en las cuentas 4301-XX, no en columna Nubox); (c) cuenta = cuenta_nubox (3er nivel analitico truncado al padre imputable). Hereda v11.
// VERSION: v11 · 2026-08-19 · Numeración correlativa con Nº de inicio configurable y continua entre bloques. Hereda v10.
// VERSION: v10 · 2026-08-19 · Export Nubox en .xls (SheetJS, cabecera plantilla, Fecha DD/MM/AAAA, K-Q vacías), elección de numeración (0 auto / 1,2,3…), nombre cargaNubox-yyyymmdd-N. Hereda v9.
// VERSION: v9 · 2026-08-19 · Modal Previsualización Nubox z-index 1000 (tapaba el TopNav z100 / menús z200). Hereda v8.
// VERSION: v8 · 2026-08-19 · Caja SII con boton "Conciliar F29<->SA" (accion -> /contab/f29-sa) en vez de pronto. Hereda v7.
// VERSION: v7 · 2026-08-19 · Caja Chica activa (botón Regenerar). Hereda v6.
// VERSION: v6 · 2026-08-19 · Rejilla 2 columnas + fondo propio, 4 cajas nuevas (SII/Tarjeta/Facturas Int/Alberto) en pronto, y boton "Pendiente de clasificar" -> /contab/pendiente. Hereda v5.
// VERSION: v5 · 2026-08-19 · Honorarios activo (botón Regenerar). Hereda v4.
// VERSION: v4 · 2026-08-19 · B. Santander activo (botón Regenerar de SA). Hereda v3.
// VERSION: v3 · 2026-07-25 · Pantalla CONTAB (comprobantes contables).
//   · Selector de AÑO + alcance Mes / Todo el año.
//   · Fila por ORIGEN (Ventas activo) con Generar (idempotente) y estado de cuadre.
//   · Previsualización consolidada estilo Nubox (A-K, morado/verde, desc. cuenta),
//     ordenada por fecha (asientos enteros), con FILTROS por columna para seleccionar
//     por asiento/origen/CCB/cuenta. Columna Número estrecha.
//   · Exporta a Nubox desde la previsualización, en bloques <5000 sin partir asientos.
'use client'

import { useSession } from 'next-auth/react'
import BotonVolver from '../../../components/ui/BotonVolver'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import TopNav from '@/app/components/ui/TopNav'
import FinancieroNav from '@/app/components/ui/FinancieroNav'
import * as XLSX from 'xlsx'

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

const VERDE = '#085041'
const VERDE_CLARO = '#E1F5EE'
const BORDE = '#E5E4DF'
const TENUE = '#888780'
const ROJO_BG = '#FBE9E7'
const ROJO = '#B23A3A'

const clp = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('es-CL'))

// Cabecera EXACTA de la plantilla de Carga Masiva de Comprobantes de Nubox (17 columnas).
// La primera fila del .xls debe ser idéntica a esto o Nubox rechaza el archivo. K-Q van vacías.
const HEADERS_NUBOX = ['Número', 'Tipo', 'Fecha', 'Glosa', 'Cuenta Detalle', 'Glosa Detalle', 'Centro Costo', 'Sucursal', 'Debe', 'Haber', 'Tipo Auxiliar', 'A: Rut Cliente-Proveedor/H: Rut Prestador', 'A: Razon Social/B: Descripción Movimiento Bancario/ H: Nombre Prestador', 'A: Tipo De Documento/H: Tipo De Boleta Honorario', 'A: Folio /B: Numero Documento/H: Folio Boleta', 'A/B/H: Monto', 'A: Fecha Vencimiento /B: Fecha /H: Fecha Emisión  (DD/MM/AAAA)']

const ORIGENES = [
  { id: 'ventas',       nombre: 'Ventas',        desc: 'Ingresos por CCB (bruto/neto/IVA)',     activo: true  },
  { id: 'mandato',      nombre: 'Cobro por mandato', desc: 'Nivel 2: 1104-01 → 2107 (comisión del pool)', activo: true  },
  { id: 'compras',      nombre: 'Compras',       desc: 'Gastos por naturaleza + IVA crédito',   activo: true  },
  { id: 'honorarios',   nombre: 'Honorarios',    desc: 'Boletas de honorarios',                 activo: true  },
  { id: 'sa',           nombre: 'B. Santander',  desc: 'Movimientos Santander (propio)',        activo: true  },
  { id: 'sii',          nombre: 'SII',           desc: 'F29 / impuestos SII',                   activo: false, accion: '/procesos/financiero/contab/f29-sa' },
  { id: 'tarjeta',      nombre: 'Tarjeta',       desc: 'Tarjeta de crédito Santander (…2494)',  activo: false },
  { id: 'facturas_int', nombre: 'Facturas Int.', desc: 'Facturas internacionales de servicios', activo: false },
  { id: 'alberto',      nombre: 'Alberto',       desc: 'Cuenta corriente del propietario',      activo: false },
  { id: 'caja_chica',   nombre: 'Caja Chica',    desc: 'Movimientos de caja chica',             activo: true  },
  { id: 'global',       nombre: 'Global 66',     desc: 'Movimientos Global 66',                 activo: false },
]

const MESES_N = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const aniosDisponibles = () => { const y = new Date().getFullYear(); return [y, y - 1, y - 2] }

function fechaCL(f) {
  if (!f) return ''
  const d = new Date(f); if (isNaN(d)) return String(f)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export default function ContabPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const puedeEditar = EDITORES.includes(email)

  const [anio, setAnio] = useState(new Date().getFullYear())
  const [alcance, setAlcance] = useState('anio')   // 'mes' | 'anio'
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [comprobantes, setComprobantes] = useState([])
  const [resumen, setResumen] = useState([])
  const [cargando, setCargando] = useState(false)
  const [generando, setGenerando] = useState(null)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [preview, setPreview] = useState(null)
  const [cargandoPreview, setCargandoPreview] = useState(false)

  useEffect(() => { if (status === 'unauthenticated') router.push('/') }, [status, router])

  // query string del alcance actual
  const periodoStr = () => `${anio}-${String(mes).padStart(2, '0')}`
  const qsAlcance = () => alcance === 'mes' ? `periodo=${periodoStr()}` : `anio=${anio}`

  const cargar = async () => {
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/financiero/contab?${qsAlcance()}`)
      const j = await r.json()
      if (j.error) { setError(j.error); setComprobantes([]); setResumen([]); return }
      setComprobantes(j.comprobantes || [])
      setResumen(j.resumen || [])
    } catch (e) { setError('No se pudo cargar.') } finally { setCargando(false) }
  }
  useEffect(() => { if (status === 'authenticated') cargar() }, [anio, alcance, mes, status]) // eslint-disable-line

  // Generar un origen. En alcance 'anio', genera los 12 meses (para) hasta el actual.
  const generar = async (origen) => {
    if (!puedeEditar || generando) return
    setGenerando(origen); setAviso(null); setError(null)
    try {
      let periodos = []
      if (alcance === 'mes') periodos = [periodoStr()]
      else {
        const hasta = (anio === new Date().getFullYear()) ? new Date().getMonth() + 1 : 12
        for (let m = 1; m <= hasta; m++) periodos.push(`${anio}-${String(m).padStart(2, '0')}`)
      }
      let totComp = 0, totCuadran = 0
      for (const p of periodos) {
        const r = await fetch('/api/financiero/contab', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ origen, periodo: p }),
        })
        const j = await r.json()
        if (j.error) { setAviso({ tipo: 'error', txt: `${p}: ${j.error}` }); break }
        totComp += (j.resultado || []).length
        totCuadran += (j.resultado || []).filter(x => x.r_cuadra).length
      }
      setAviso({
        tipo: totComp === totCuadran ? 'ok' : 'error',
        txt: `${origen} · ${alcance === 'mes' ? periodoStr() : anio}: ${totComp} comprobante(s), ${totCuadran} cuadran${totComp === totCuadran ? '.' : ' — revisar.'}`,
      })
      cargar()
    } catch (e) { setAviso({ tipo: 'error', txt: 'No se pudo generar.' }) } finally { setGenerando(null) }
  }

  const previsualizar = async () => {
    setCargandoPreview(true); setAviso(null)
    try {
      const r = await fetch(`/api/financiero/contab?preview=1&${qsAlcance()}`)
      const j = await r.json()
      if (j.error) { setAviso({ tipo: 'error', txt: j.error }); return }
      if (!j.filas?.length) { setAviso({ tipo: 'error', txt: 'No hay comprobantes en el alcance elegido.' }); return }
      setPreview(j)
    } catch (e) { setAviso({ tipo: 'error', txt: 'No se pudo previsualizar.' }) } finally { setCargandoPreview(false) }
  }

  const exportarNubox = async (numeracion = 'auto', numInicio = 1) => {
    try {
      const r = await fetch(`/api/financiero/contab?export=nubox&${qsAlcance()}`)
      const j = await r.json()
      if (j.error) { setAviso({ tipo: 'error', txt: j.error }); return }
      if (!j.bloques?.length) { setAviso({ tipo: 'error', txt: 'No hay comprobantes para exportar.' }); return }
      const HOY = new Date()
      const yyyymmdd = `${HOY.getFullYear()}${String(HOY.getMonth() + 1).padStart(2, '0')}${String(HOY.getDate()).padStart(2, '0')}`
      const serialFecha = (f) => {
        if (!f) return ''
        const d = new Date(f)
        if (isNaN(d)) return ''
        return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000)
      }
      let corr = (Number(numInicio) || 1) - 1
      const nz = (v) => (v === '' || v == null ? null : v)   // celda vacia -> null (Nubox rechaza el string vacio en L-Q)
      j.bloques.forEach((bloque, bi) => {
        const aoa = [HEADERS_NUBOX]
        const dateRows = []
        for (const f of bloque) {
          const cab = f.tipo != null && f.tipo !== ''
          if (cab && numeracion === 'correlativa') corr += 1
          const numero = cab ? (numeracion === 'correlativa' ? corr : 0) : null
          const fs = cab ? serialFecha(f.fecha) : ''
          if (fs !== '') dateRows.push(aoa.length)
          aoa.push([
            numero,                       // A Numero (cabecera: corr o 0 auto; detalle: vacio)
            cab ? f.tipo : null,          // B Tipo
            fs === '' ? null : fs,        // C Fecha (serial; vacio en detalle)
            cab ? nz(f.glosa) : null,     // D Glosa
            nz(f.cuenta_nubox || f.cuenta), // E Cuenta Detalle (analitica de 3er nivel rellenada a 4 digitos para Nubox)
            nz(f.glosa_detalle),          // F Glosa Detalle
            null,                         // G Centro Costo: vacio SIEMPRE (el CC viaja en las cuentas 4301-XX, no en columna Nubox)
            null,                         // H Sucursal
            f.debe || null,               // I Debe (lado 0 -> vacio)
            f.haber || null,              // J Haber
            null, null, null, null, null, null, null  // K-Q vacias REALES (celda ausente, no string)
          ])
        }
        const ws = XLSX.utils.aoa_to_sheet(aoa)
        for (const rr of dateRows) { const ref = XLSX.utils.encode_cell({ r: rr, c: 2 }); if (ws[ref]) { ws[ref].t = 'n'; ws[ref].z = 'dd/mm/yyyy' } }
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Comprobantes')
        const wbout = XLSX.write(wb, { bookType: 'xls', type: 'array' })
        const blob = new Blob([wbout], { type: 'application/vnd.ms-excel' })
        const url = URL.createObjectURL(blob); const a = document.createElement('a')
        a.href = url; a.download = `cargaNubox-${yyyymmdd}-${bi + 1}.xls`; a.click(); URL.revokeObjectURL(url)
      })
      setAviso({ tipo: 'ok', txt: `Exportado ${j.bloques.length} bloque(s) .xls (Nubox) · numeración ${numeracion === 'correlativa' ? '1,2,3…' : 'automática (0)'}.` })
    } catch (e) { setAviso({ tipo: 'error', txt: 'No se pudo exportar: ' + (e?.message || e) }) }
  }

  const totalGeneral = useMemo(() => {
    const debe = comprobantes.reduce((s, c) => s + (Number(c.total_debe) || 0), 0)
    const haber = comprobantes.reduce((s, c) => s + (Number(c.total_haber) || 0), 0)
    const todos = comprobantes.every(c => c.cuadra)
    return { debe, haber, n: comprobantes.length, todos, lineas: comprobantes.reduce((s, c) => s + (Number(c.n_lineas) || 0), 0) }
  }, [comprobantes])

  const resumenPorOrigen = (id) => resumen.find(r => r.origen === id)

  if (status === 'loading') return <div style={{ padding: 40, color: TENUE }}>Cargando…</div>

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <TopNav />
      <BotonVolver />
      <FinancieroNav activo="contab" />
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 20px 80px' }}>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: TENUE, marginBottom: 4 }}>Procesos · Financiero</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1A1A17', margin: 0 }}>CONTAB · Comprobantes contables</h1>
            <div style={{ fontSize: 14, color: TENUE, marginTop: 4 }}>Genera los asientos de cada módulo y los exporta a Nubox en bloques.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: TENUE }}>Año</span>
            <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={selStyle}>
              {aniosDisponibles().map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <div style={{ display: 'flex', border: `1px solid ${BORDE}`, borderRadius: 8, overflow: 'hidden' }}>
              <button onClick={() => setAlcance('mes')} style={togBtn(alcance === 'mes')}>Mes</button>
              <button onClick={() => setAlcance('anio')} style={togBtn(alcance === 'anio')}>Todo el año</button>
            </div>
            {alcance === 'mes' && (
              <select value={mes} onChange={e => setMes(Number(e.target.value))} style={selStyle}>
                {MESES_N.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            )}
          </div>
        </div>

        {error && <div style={{ padding: 14, borderRadius: 10, background: ROJO_BG, color: ROJO, marginBottom: 16 }}>{error}</div>}
        {aviso && <div style={{ padding: 14, borderRadius: 10, marginBottom: 16, background: aviso.tipo === 'ok' ? VERDE_CLARO : ROJO_BG, color: aviso.tipo === 'ok' ? VERDE : ROJO }}>{aviso.txt}</div>}

        {/* Bloque de generadores por módulo: 2 columnas, fondo propio, + acción Pendiente */}
        <div style={{ background: '#F1EEE7', border: `1px solid ${BORDE}`, borderRadius: 14, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A17' }}>Módulos contables</div>
            <button onClick={() => router.push('/procesos/financiero/contab/pendiente')}
              style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#B45309', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Pendiente de clasificar →
            </button>
          </div>
          <details style={{ marginBottom: 12, background: '#fff', border: `1px solid ${BORDE}`, borderRadius: 10 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#0C447C', padding: '9px 12px' }}>ℹ️ Cómo funciona esto — ayuda (pulsa para abrir)</summary>
            <div style={{ fontSize: 12, color: '#3A3A36', lineHeight: 1.65, padding: '2px 14px 14px' }}>
              <div style={{ marginBottom: 8 }}>CONTAB genera los asientos contables de cada módulo y los prepara para Nubox. <b>Nada se envía solo</b>: tú revisas y luego exportas.</div>
              <div style={{ marginBottom: 3 }}><b>Los botones de cada ficha:</b></div>
              <div style={{ marginBottom: 3 }}>• <b>Generar / Regenerar</b>: crea los asientos de ese módulo para el periodo elegido (Ventas: Debe 1104-01 / Haber 5101 + IVA; Compras, Honorarios, etc., cada uno el suyo).</div>
              <div style={{ marginBottom: 9 }}>• <b>Cobro por mandato</b> (nivel 2): rebaja Deudores clientes (1104-01) con la comisión que FCR retiene del arriendo — <b>Debe 2107-02 / Haber 1104-01</b> por CCB (CC1/CC2/CC3). Córrelo <b>al cerrar el mes</b>, después de Ventas.</div>
              <div style={{ marginBottom: 3 }}><b>Orden del mes:</b> 1) cada módulo "cuadra ✓"; 2) "Pendiente de clasificar" a cero; 3) Regenerar los módulos; 4) Cobro por mandato; 5) Previsualizar Nubox y revisar; 6) Exportar.</div>
              <div style={{ marginBottom: 3 }}><b>¿Repetirlo?</b> Es seguro: "Regenerar" borra y rehace ese módulo y ese mes — no duplica.</div>
              <div style={{ marginBottom: 3 }}><b>¿Revisar antes de exportar?</b> Mira la tabla de abajo (Debe / Haber / Cuadre por comprobante) y pulsa "Previsualizar Nubox" para el detalle cuenta a cuenta.</div>
              <div><b>Ojo con el año</b> (selector de arriba): la prueba en Nubox es 2026. Generar para 2025 calcularía de las ventas de ese año si las hay — no lo hagas salvo que quieras rehacer 2025.</div>
            </div>
          </details>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {ORIGENES.map((o) => {
              const res = resumenPorOrigen(o.id)
              const gen = generando === o.id
              return (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: `1px solid ${BORDE}`, background: o.activo ? '#fff' : '#FBFBF9' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: o.activo ? '#1A1A17' : TENUE }}>{o.nombre}</div>
                    <div style={{ fontSize: 11.5, color: TENUE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.desc}</div>
                    {res && (
                      <div style={{ fontSize: 11, marginTop: 3, color: res.todos_cuadran ? VERDE : ROJO }}>
                        {res.n_comp} comp{res.n_meses > 1 ? ` · ${res.n_meses}m` : ''} · {clp(res.debe)} · {res.todos_cuadran ? 'cuadra ✓' : 'descuadre ✗'}
                      </div>
                    )}
                  </div>
                  {o.activo ? (
                    puedeEditar && (
                      <button onClick={() => generar(o.id)} disabled={gen} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: VERDE, color: '#fff', fontSize: 13, fontWeight: 600, cursor: gen ? 'default' : 'pointer', opacity: gen ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                        {gen ? '…' : (res ? 'Regenerar' : 'Generar')}
                      </button>
                    )
                  ) : o.accion ? (
                    <button onClick={() => router.push(o.accion)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #B45309', background: '#fff', color: '#B45309', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Conciliar →</button>
                  ) : (<span style={{ fontSize: 11, color: '#B4B2A9', padding: '4px 8px', whiteSpace: 'nowrap' }}>pronto</span>)}
                </div>
              )
            })}
          </div>
        </div>

        {comprobantes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: '#1A1A17' }}>
              <b>{totalGeneral.n}</b> comprobantes · <b>{totalGeneral.lineas}</b> líneas · debe <b>{clp(totalGeneral.debe)}</b>{' '}
              <span style={{ color: totalGeneral.todos ? VERDE : ROJO }}>{totalGeneral.todos ? 'todos cuadran ✓' : 'hay descuadres ✗'}</span>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={previsualizar} disabled={cargandoPreview} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: VERDE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: cargandoPreview ? 0.6 : 1 }}>
              {cargandoPreview ? 'Preparando…' : 'Previsualizar Nubox'}
            </button>
          </div>
        )}

        {cargando ? (
          <div style={{ padding: 40, color: TENUE }}>Cargando…</div>
        ) : comprobantes.length === 0 ? (
          <div style={{ padding: 40, color: TENUE, textAlign: 'center', border: `1px dashed ${BORDE}`, borderRadius: 12 }}>
            No hay comprobantes generados para {alcance === 'mes' ? `${MESES_N[mes]} ${anio}` : anio}. Pulsa “Generar” en un origen.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: `1px solid ${BORDE}`, borderRadius: 12, background: '#fff' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr>
                <th style={th}>Origen</th><th style={th}>Periodo</th><th style={th}>Fecha</th><th style={th}>Glosa</th>
                <th style={th}>CCB</th><th style={{ ...th, textAlign: 'right' }}>Líneas</th>
                <th style={{ ...th, textAlign: 'right' }}>Debe</th><th style={{ ...th, textAlign: 'right' }}>Haber</th><th style={th}>Cuadre</th>
              </tr></thead>
              <tbody>
                {comprobantes.map(c => (
                  <tr key={c.id}>
                    <td style={td}>{c.origen}</td>
                    <td style={td}>{c.periodo}</td>
                    <td style={td}>{fechaCL(c.fecha)}</td>
                    <td style={td}>{c.glosa}</td>
                    <td style={td}>{c.ccb}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{c.n_lineas}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{clp(c.total_debe)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{clp(c.total_haber)}</td>
                    <td style={td}>{c.cuadra ? <span style={{ color: VERDE }}>✓</span> : <span style={{ color: ROJO }}>✗ {clp(c.descuadre)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {preview && <PreviewNubox preview={preview} onCerrar={() => setPreview(null)} onExportar={exportarNubox} />}
    </div>
  )
}

// ---- Previsualización Nubox consolidada, con filtros por columna ----
function PreviewNubox({ preview, onCerrar, onExportar }) {
  const { filas, total_debe, total_haber, cuadra, n_lineas, alcance } = preview
  const [filtros, setFiltros] = useState({})
  const [ordenFecha, setOrdenFecha] = useState(true)
  const [numeracion, setNumeracion] = useState('auto')
  const [numInicio, setNumInicio] = useState(1)

  // filtros a nivel de ASIENTO: si el filtro casa con alguna línea del asiento, se muestra entero
  const compIdsVisibles = useMemo(() => {
    const activos = Object.entries(filtros).filter(([, v]) => v && v.trim())
    if (!activos.length) return null
    const ok = new Set()
    const porComp = {}
    for (const f of filas) (porComp[f.comp_id] ||= []).push(f)
    for (const [cid, ls] of Object.entries(porComp)) {
      const casa = activos.every(([col, val]) =>
        ls.some(l => String(l[col] ?? '').toLowerCase().includes(val.trim().toLowerCase()))
      )
      if (casa) ok.add(Number(cid))
    }
    return ok
  }, [filas, filtros])

  const filasVis = useMemo(() => {
    let fs = compIdsVisibles ? filas.filter(f => compIdsVisibles.has(f.comp_id)) : filas
    return fs
  }, [filas, compIdsVisibles])

  const setF = (col, val) => setFiltros(f => ({ ...f, [col]: val }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', flexDirection: 'column', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: `1px solid ${BORDE}`, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1A1A17' }}>Previsualización Nubox · {alcance}</div>
            <div style={{ fontSize: 13, color: TENUE }}>
              {filasVis.length}{filasVis.length !== n_lineas ? ` de ${n_lineas}` : ''} líneas · debe {clp(total_debe)} · haber {clp(total_haber)}{' '}
              <span style={{ color: cuadra ? VERDE : ROJO, fontWeight: 600 }}>{cuadra ? 'cuadra ✓' : 'descuadre ✗'}</span>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {Object.values(filtros).some(v => v && v.trim()) && (
            <button onClick={() => setFiltros({})} style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${BORDE}`, background: '#fff', color: VERDE, fontSize: 13, cursor: 'pointer' }}>Quitar filtros</button>
          )}
          <select value={numeracion} onChange={e => setNumeracion(e.target.value)} title="Numeración de la 1ª columna" style={{ padding: '9px 10px', borderRadius: 8, border: `1px solid ${BORDE}`, fontSize: 13, color: VERDE, background: '#fff', fontWeight: 600 }}>
            <option value="auto">Nº automático (0)</option>
            <option value="correlativa">Nº 1, 2, 3…</option>
          </select>
          {numeracion === 'correlativa' && (
            <input type="number" min="1" value={numInicio} onChange={e => setNumInicio(e.target.value)} title="Número de inicio de la numeración"
              style={{ width: 78, padding: '9px 8px', borderRadius: 8, border: `1px solid ${BORDE}`, fontSize: 13, color: VERDE, fontWeight: 600 }} />
          )}
          <button onClick={() => onExportar(numeracion, numInicio)} disabled={!cuadra} title={cuadra ? 'Exportar .xls Nubox' : 'No cuadra'} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: cuadra ? VERDE : '#B4B2A9', color: '#fff', fontSize: 14, fontWeight: 600, cursor: cuadra ? 'pointer' : 'default' }}>Exportar a Nubox (.xls)</button>
          <button onClick={onCerrar} style={{ padding: '9px 16px', borderRadius: 8, border: `1px solid ${BORDE}`, background: '#fff', color: '#1A1A17', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cerrar</button>
        </div>

        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th style={{ ...thN, width: 42 }}>Nº</th>
                <th style={thM}>Tipo<FiltroCol col="tipo" filtros={filtros} set={setF} /></th>
                <th style={thM}>Fecha</th>
                <th style={thM}>Glosa<FiltroCol col="glosa" filtros={filtros} set={setF} /></th>
                <th style={thV}>Cuenta<FiltroCol col="cuenta" filtros={filtros} set={setF} /></th>
                <th style={thV}>Glosa Detalle<FiltroCol col="glosa_detalle" filtros={filtros} set={setF} /></th>
                <th style={thV}>C.Costo<FiltroCol col="centro_costo" filtros={filtros} set={setF} /></th>
                <th style={thV}>Suc.</th>
                <th style={{ ...thV, textAlign: 'right' }}>Debe</th>
                <th style={{ ...thV, textAlign: 'right' }}>Haber</th>
                <th style={thK}>Descripción cuenta<FiltroCol col="desc_cuenta" filtros={filtros} set={setF} /></th>
                <th style={thK}>Origen<FiltroCol col="origen" filtros={filtros} set={setF} /></th>
              </tr>
            </thead>
            <tbody>
              {filasVis.map((f, i) => {
                const esCab = f.numero === 0 || f.numero === '0'
                return (
                  <tr key={i} style={{ borderTop: esCab ? `2px solid #C9C7BE` : 'none' }}>
                    <td style={{ ...tdN, width: 42 }}>{esCab ? 0 : ''}</td>
                    <td style={tdM}>{f.tipo}</td>
                    <td style={tdM}>{f.fecha ? fechaCL(f.fecha) : ''}</td>
                    <td style={{ ...tdM, fontWeight: esCab ? 600 : 400 }}>{f.glosa}</td>
                    <td style={tdV}>{f.cuenta}</td>
                    <td style={tdV}>{f.glosa_detalle}</td>
                    <td style={tdV}>{f.centro_costo}</td>
                    <td style={tdV}>{f.sucursal}</td>
                    <td style={{ ...tdV, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.debe ? clp(f.debe) : ''}</td>
                    <td style={{ ...tdV, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.haber ? clp(f.haber) : ''}</td>
                    <td style={tdK}>{f.desc_cuenta}</td>
                    <td style={tdK}>{f.origen}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function FiltroCol({ col, filtros, set }) {
  return (
    <input value={filtros[col] || ''} onChange={e => set(col, e.target.value)} placeholder="filtrar…"
      style={{ marginTop: 4, width: '100%', boxSizing: 'border-box', padding: '2px 5px', fontSize: 10, border: `1px solid ${BORDE}`, borderRadius: 4, fontWeight: 400 }} />
  )
}

const selStyle = { padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDE}`, fontSize: 15, fontWeight: 600, color: VERDE, background: '#fff' }
const togBtn = (activo) => ({ padding: '8px 14px', border: 'none', background: activo ? VERDE : '#fff', color: activo ? '#fff' : '#2C2C2A', fontSize: 14, fontWeight: 600, cursor: 'pointer' })

const th = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 600, color: TENUE, borderBottom: `1px solid ${BORDE}`, whiteSpace: 'nowrap', background: '#FBFBF9' }
const td = { padding: '9px 12px', fontSize: 13, color: '#1A1A17', borderBottom: `1px solid ${BORDE}`, whiteSpace: 'nowrap' }

const MORADO = '#EEEBF7', MORADO_TH = '#E0DAF0', VERDE_BG = '#E6F4EA', VERDE_TH = '#D3EAD9'
const celdaBase = { padding: '5px 9px', borderBottom: '1px solid #EDEDEA', borderRight: '1px solid #EDEDEA', whiteSpace: 'nowrap', verticalAlign: 'top' }
const thBase = { padding: '6px 9px', fontSize: 11, fontWeight: 700, color: '#2C2C2A', borderBottom: '1px solid #D3D1C7', borderRight: '1px solid #D3D1C7', whiteSpace: 'nowrap', textAlign: 'left', verticalAlign: 'top' }
const thN = { ...thBase, background: MORADO_TH }
const tdN = { ...celdaBase, background: MORADO, color: '#2C2C2A', textAlign: 'right' }
const thM = { ...thBase, background: MORADO_TH }
const tdM = { ...celdaBase, background: MORADO }
const thV = { ...thBase, background: VERDE_TH }
const tdV = { ...celdaBase, background: VERDE_BG }
const thK = { ...thBase, background: '#F0EFEA' }
const tdK = { ...celdaBase, background: '#fff', color: '#555' }
