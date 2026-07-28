// VERSION: v5 · 2026-07-27 · Remuneraciones: carga del Libro en PDF (arrastrar o botón).
//   El PDF de Nubox se lee EN EL NAVEGADOR (lib/parseRemuneraciones) y se manda ya en
//   JSON, igual que hacen Ventas y Compras con el Excel.
//   Antes de guardar se cuadra lo leido contra el TOTAL GENERAL del propio PDF: si no
//   coincide, se avisa y no se carga. Mejor no cargar que cargar mal.
//   OJO: validado con el libro de Nubox (ene-2026 y todo 2025). De feb-2026 cambio el
//   proveedor de remuneraciones y ese formato aun no se ha visto.
// VERSION: v4 · 2026-07-26 · Remuneraciones: los años salen del CALENDARIO, no de los datos.
//   La v3 sacaba la lista de años de las cargas existentes, asi que 2026 no aparecia
//   por no tener ningun libro: justo el año que interesa y justo donde el aviso de
//   "meses sin cargar" tiene sentido. Ahora van del primer año con datos hasta el
//   año en curso, haya o no libros, y un año entero vacio se ve como tal.
// VERSION: v3 · 2026-07-26 · Remuneraciones: selector de periodo compacto.
//   Antes: una tira con un boton por mes cargado (13 con 2025) mas un candado repetido
//   en cada uno. No escalaba (con 2026 serian 25), los meses cambiaban de sitio segun
//   que hubiera cargado, y ocupaba una banda entera para algo que se usa UNA vez por
//   sesion: eliges mes y trabajas dentro media hora.
//   Ahora: una sola linea  ‹ Junio 2026 ›  con flechas para el salto habitual (mes
//   anterior / siguiente) y un desplegable con la rejilla de 12 posiciones FIJAS por
//   año, que solo ocupa sitio cuando se abre. El candado sube al año.
//   "Que meses faltan" deja de ser navegacion y pasa a ser un aviso: chip ambar.
//   Arranca en el ultimo mes con datos.
//   NOTA: el estado "faltan aportes" solo se conoce del mes cargado (llega por linea
//   en falta_previred). Para pintarlo en la rejilla de todos los meses, el endpoint
//   tendria que devolver ese resumen junto a las cargas.
// VERSION: v2 · 2026-07-26 · Remuneraciones: barra FinancieroNav bajo el TopNav.
// VERSION: v1 · 2026-07-23 · Pantalla de Remuneraciones (financiero).
//   · Selector de meses + vista continua de todo el año.
//   · Totales del periodo y resumen por CCB.
//   · Desglose por centro editable, con herencia del reparto por defecto.
//   · Respeta rem_cargas.congelado: si el mes está cerrado, se ve pero no se toca.
//   · Avisa cuando falta Previred, porque sin los aportes patronales el coste
//     empresa es sólo los haberes y el reparto quedaría incompleto.
//
// Deliberadamente SIN el filtrado estilo Excel del módulo SA: allí son 700+
// movimientos y nació de necesidades concretas; aquí son 107 líneas y 9 personas.
// Si hace falta, se añade cuando se pida.
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo, useRef, Fragment } from 'react'
import TopNav from '@/app/components/ui/TopNav'
import FinancieroNav from '@/app/components/ui/FinancieroNav'
import { parseLibroRemuneracionesPDF } from '@/app/lib/parseRemuneraciones'

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const CCB_SUGERIDOS = ['CC1', 'CC2', 'CC3', 'BB1', 'BB2', 'GG']
const MES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const ESTADO = {
  CUADRADO:       { bg: '#E1F5EE', color: '#085041', label: 'Cuadrado' },
  SIN_CLASIFICAR: { bg: '#F0EFEA', color: '#888780', label: 'Sin clasificar' },
  DESCUADRADO:    { bg: '#FBE9E7', color: '#B23A3A', label: 'Descuadrado' },
}

const VERDE = '#085041'
const VERDE_CLARO = '#E1F5EE'
const BORDE = '#E5E4DF'
const TENUE = '#888780'

const clp = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL'))
const mesLabel = (iso) => {
  if (!iso) return ''
  const [y, m] = String(iso).slice(0, 10).split('-')
  return `${MES_LARGO[Number(m) - 1]} ${y}`
}
const mesCorto = (iso) => {
  if (!iso) return ''
  const [y, m] = String(iso).slice(0, 10).split('-')
  return `${MES_LARGO[Number(m) - 1].slice(0, 3)} ${y.slice(2)}`
}

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const anioDe = (periodo) => Number(String(periodo).slice(0, 4))
const mesDe = (periodo) => Number(String(periodo).slice(5, 7))

export default function RemuneracionesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const puedeEditar = EDITORES.includes(email)

  const [cargas, setCargas] = useState([])
  const [cargaSel, setCargaSel] = useState(null)   // id, o 'TODAS'
  const [lineas, setLineas] = useState([])
  const [ccb, setCcb] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [expandida, setExpandida] = useState(null)
  const [editando, setEditando] = useState(null)   // { linea_id, filas: [] }
  const [guardando, setGuardando] = useState(false)
  const [verResumen, setVerResumen] = useState(false)
  const [selAbierto, setSelAbierto] = useState(false)
  const [anioVista, setAnioVista] = useState(null)
  const fileRef = useRef(null)
  const [subiendo, setSubiendo] = useState(false)
  const [msgCarga, setMsgCarga] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  // Lista de meses
  useEffect(() => {
    if (status !== 'authenticated') return
    ;(async () => {
      try {
        const r = await fetch('/api/financiero/remuneraciones')
        const j = await r.json()
        if (j.error) { setError(j.error); return }
        setCargas(j.cargas || [])
        if ((j.cargas || []).length) setCargaSel(j.cargas[0].id)
        else setCargando(false)
      } catch (e) {
        setError('No se pudo conectar con el servidor.')
        setCargando(false)
      }
    })()
  }, [status])

  // Líneas del mes seleccionado
  const recargar = async () => {
    if (!cargaSel) return
    setCargando(true)
    setError(null)
    try {
      const url = cargaSel === 'TODAS'
        ? '/api/financiero/remuneraciones?todas=1'
        : `/api/financiero/remuneraciones?carga=${cargaSel}`
      const r = await fetch(url)
      const j = await r.json()
      if (j.error) { setError(j.error); setLineas([]); setCcb([]) }
      else { setLineas(j.lineas || []); setCcb(j.ccb || []) }
    } catch (e) {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => { recargar() }, [cargaSel])

  const ccbPorLinea = useMemo(() => {
    const m = {}
    for (const c of ccb) (m[c.linea_id] ||= []).push(c)
    return m
  }, [ccb])

  const cargaActual = useMemo(
    () => cargas.find(c => c.id === cargaSel) || null,
    [cargas, cargaSel]
  )
  // Años disponibles y mapa mes -> carga, para la rejilla de 12 posiciones fijas.
  // Los años vienen del calendario: del primero con datos hasta el actual, aunque
  // esten vacios. Si dependieran de las cargas, un año sin libros seria invisible.
  const anios = useMemo(() => {
    const hoy = new Date().getFullYear()
    const conDatos = cargas.map(c => anioDe(c.periodo))
    const desde = conDatos.length ? Math.min(...conDatos, hoy) : hoy
    const out = []
    for (let a = hoy; a >= desde; a--) out.push(a)
    return out
  }, [cargas])

  const anioActivo = anioVista != null ? anioVista
    : (cargaSel !== 'TODAS' && cargaActual ? anioDe(cargaActual.periodo) : (anios[0] || new Date().getFullYear()))
  const anioVacio = cargas.every(c => anioDe(c.periodo) !== anioActivo)

  const porMes = useMemo(() => {
    const m = {}
    for (const c of cargas) if (anioDe(c.periodo) === anioActivo) m[mesDe(c.periodo)] = c
    return m
  }, [cargas, anioActivo])

  const sinCargar = useMemo(() => {
    const hoy = new Date()
    const tope = anioActivo === hoy.getFullYear() ? hoy.getMonth() + 1 : 12
    let n = 0
    for (let i = 1; i <= tope; i++) if (!porMes[i]) n++
    return n
  }, [porMes, anioActivo])

  const anioCerrado = useMemo(() => {
    const ls = cargas.filter(c => anioDe(c.periodo) === anioActivo)
    return ls.length > 0 && ls.every(c => c.congelado)
  }, [cargas, anioActivo])

  // Orden cronologico para las flechas: el salto habitual es mes anterior / siguiente.
  const ordenadas = useMemo(
    () => cargas.slice().sort((a, b) => String(a.periodo).localeCompare(String(b.periodo))),
    [cargas]
  )
  const idx = ordenadas.findIndex(c => c.id === cargaSel)
  const irA = (c) => { if (!c) return; setCargaSel(c.id); setAnioVista(anioDe(c.periodo)); setSelAbierto(false); setExpandida(null); setEditando(null); setAviso(null) }

  const congelado = cargaSel === 'TODAS'
    ? cargas.every(c => c.congelado)
    : !!cargaActual?.congelado

  const totales = useMemo(() => {
    const t = { n: lineas.length, haberes: 0, desc: 0, liquido: 0, coste: 0, sinClasificar: 0, faltaPrevired: 0 }
    for (const l of lineas) {
      t.haberes += Number(l.tot_haberes) || 0
      t.desc += Number(l.tot_desc) || 0
      t.liquido += Number(l.liquido) || 0
      t.coste += Number(l.coste_empresa) || 0
      if (l.estado_clasificacion === 'SIN_CLASIFICAR') t.sinClasificar++
      if (l.falta_previred) t.faltaPrevired++
    }
    return t
  }, [lineas])

  const resumenCCB = useMemo(() => {
    const m = {}
    for (const c of ccb) m[c.ccb || '(sin centro)'] = (m[c.ccb || '(sin centro)'] || 0) + (Number(c.monto) || 0)
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [ccb])

  // ---- acciones ----

  const abrirEditor = (linea) => {
    const filas = (ccbPorLinea[linea.id] || []).map(c => ({
      sub_orden: c.sub_orden, ccb: c.ccb || '', pct: c.pct ?? '', monto: c.monto ?? 0,
      cuenta_1: c.cuenta_1 || '', cuenta_2: c.cuenta_2 || '', concepto: c.concepto || '',
    }))
    if (!filas.length) filas.push({ sub_orden: 1, ccb: '', pct: 100, monto: linea.coste_empresa || 0, cuenta_1: '', cuenta_2: '', concepto: '' })
    setEditando({ linea_id: linea.id, base: linea.coste_empresa || 0, filas })
  }

  const guardar = async () => {
    if (!editando) return
    setGuardando(true)
    setError(null)
    try {
      const r = await fetch('/api/financiero/remuneraciones', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linea_id: editando.linea_id, ccb: editando.filas }),
      })
      const j = await r.json()
      if (j.error) { setError(j.error); return }
      if (!j.cuadra) {
        setAviso(`Guardado, pero el reparto suma ${clp(j.suma)} y el coste empresa es ${clp(j.coste_empresa)}. La línea queda descuadrada.`)
      } else {
        setAviso('Reparto guardado.')
      }
      setEditando(null)
      await recargar()
    } catch (e) {
      setError('No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const cargarLibro = async (file, sobrescribir = false) => {
    if (!file) return
    if (!/\.pdf$/i.test(file.name)) { setMsgCarga({ error: 'De momento solo el PDF del Libro de Remuneraciones.' }); return }
    setSubiendo(true); setMsgCarga(null)
    try {
      const r = await parseLibroRemuneracionesPDF(file)
      if (r.avisos && r.avisos.length) {
        // No cuadra con el TOTAL GENERAL del PDF: no se carga.
        setMsgCarga({ error: 'El libro no cuadra consigo mismo, no lo cargo: ' + r.avisos.join(' · ') })
        return
      }
      const res = await fetch('/api/financiero/remuneraciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'cargar_libro', periodo: r.periodo, mes_texto: r.mes_texto, archivo: r.archivo,
          lineas: r.lineas, totales: r.totales, sobrescribir,
        }),
      })
      const j = await res.json()
      if (j.error === 'mes_ya_cargado') {
        if (window.confirm(j.mensaje + '\n\n¿Recargar de todos modos?')) return cargarLibro(file, true)
        return
      }
      if (j.error) { setMsgCarga({ error: j.mensaje || j.error }); return }
      setMsgCarga({ text: `${r.mes_texto} · ${j.n_lineas} personas cargadas` + (j.empleados_nuevos ? `, ${j.empleados_nuevos} nuevas en el maestro` : '') + '. ' + j.aviso })
      const d = await fetch('/api/financiero/remuneraciones').then(x => x.json()).catch(() => ({}))
      if (d.cargas) { setCargas(d.cargas); const nueva = d.cargas.find(c => String(c.periodo).slice(0, 10) === r.periodo); if (nueva) setCargaSel(nueva.id) }
    } catch (e) {
      setMsgCarga({ error: String(e?.message || e) })
    } finally { setSubiendo(false) }
  }

  useEffect(() => {
    const over = (e) => { e.preventDefault(); if (puedeEditar) setDragOver(true) }
    const leave = (e) => { e.preventDefault(); setDragOver(false) }
    const drop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer?.files?.[0]; if (f && puedeEditar) cargarLibro(f) }
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop)
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop) }
  }) // eslint-disable-line

  const heredar = async (forzar = false) => {
    if (!cargaActual) return
    setGuardando(true)
    setError(null)
    setAviso(null)
    try {
      const r = await fetch('/api/financiero/remuneraciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo: String(cargaActual.periodo).slice(0, 10), forzar }),
      })
      const j = await r.json()
      if (j.error === 'aportes_patronales_pendientes') {
        setAviso(j.mensaje)
        return
      }
      if (j.error) { setError(j.error); return }
      const partes = [`${j.lineas_clasificadas} línea(s) clasificadas`]
      if (j.saltadas_por_tener_ya) partes.push(`${j.saltadas_por_tener_ya} ya tenían reparto`)
      if (j.sin_reparto_definido?.length) partes.push(`${j.sin_reparto_definido.length} sin reparto definido: ${j.sin_reparto_definido.map(p => p.nombre).join(', ')}`)
      setAviso(partes.join(' · '))
      await recargar()
    } catch (e) {
      setError('No se pudo aplicar el reparto.')
    } finally {
      setGuardando(false)
    }
  }

  const exportar = () => {
    const cab = ['Periodo', 'RUT', 'Nombre', 'Dias', 'Sueldo base', 'Total imponible', 'Total no imponible',
      'Total haberes', 'Prevision', 'Salud', 'Imp. unico', 'Seg. cesantia', 'Total descuentos', 'Liquido',
      'Coste empresa', 'CCB', 'Monto CCB', 'Estado']
    const filas = []
    for (const l of lineas) {
      const ds = ccbPorLinea[l.id] || []
      const base = [
        String(l.periodo).slice(0, 7), l.rut, l.nombre, l.dt, l.sueldo_base, l.total_imp, l.tot_no_imp,
        l.tot_haberes, l.prevision, l.salud, l.imp_unico, l.seg_ces, l.tot_desc, l.liquido,
        l.coste_empresa,
      ]
      if (!ds.length) filas.push([...base, '', '', l.estado_clasificacion])
      else ds.forEach(d => filas.push([...base, d.ccb || '', d.monto ?? '', l.estado_clasificacion]))
    }
    const csv = [cab, ...filas]
      .map(f => f.map(v => {
        const s = v == null ? '' : String(v)
        return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }).join(';'))
      .join('\r\n')
    // BOM para que Excel lo abra en UTF-8 sin destrozar los acentos
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `remuneraciones_${cargaSel === 'TODAS' ? 'todas' : String(cargaActual?.periodo).slice(0, 7)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // ---- render ----

  if (status === 'loading') return <div style={{ padding: 40, color: TENUE }}>Cargando…</div>

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <TopNav />
      <FinancieroNav activo="remuneraciones" />
      {dragOver && puedeEditar && (
        <div data-overlay="1" style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(29,158,117,0.10)', border: '3px dashed #1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: '#fff', padding: '14px 22px', borderRadius: 10, fontSize: 15, fontWeight: 600, color: '#085041' }}>⬆ Suelta el PDF del Libro de Remuneraciones</div>
        </div>
      )}

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px 60px' }}>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, color: '#1A1A18' }}>Remuneraciones</h1>
            <p style={{ margin: '4px 0 0', color: TENUE, fontSize: 14 }}>
              Libro de remuneraciones y reparto por Centro de Coste/Beneficio
            </p>
          </div>
        </div>

        {/* Selector de periodo: una linea. La rejilla se despliega solo si hace falta. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingBottom: 12, marginBottom: 14, borderBottom: `1px solid ${BORDE}` }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            <button aria-label="Mes anterior" disabled={idx <= 0}
              onClick={() => irA(ordenadas[idx - 1])}
              style={{ ...pill, padding: '6px 10px', opacity: idx <= 0 ? 0.35 : 1, cursor: idx <= 0 ? 'default' : 'pointer' }}>‹</button>

            <button onClick={() => setSelAbierto(v => !v)}
              style={{ ...pill, padding: '6px 14px', fontWeight: 600, minWidth: 150 }}>
              {cargaSel === 'TODAS'
                ? `Todo ${anioActivo}`
                : (cargaActual ? `${MESES_LARGOS[mesDe(cargaActual.periodo) - 1]} ${anioDe(cargaActual.periodo)}` : 'Sin datos')}
              <span style={{ marginLeft: 8, color: TENUE, fontSize: 11 }}>▾</span>
            </button>

            <button aria-label="Mes siguiente" disabled={idx < 0 || idx >= ordenadas.length - 1}
              onClick={() => irA(ordenadas[idx + 1])}
              style={{ ...pill, padding: '6px 10px', opacity: (idx < 0 || idx >= ordenadas.length - 1) ? 0.35 : 1, cursor: (idx < 0 || idx >= ordenadas.length - 1) ? 'default' : 'pointer' }}>›</button>

            {selAbierto && (<>
              <div onClick={() => setSelAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', top: 40, left: 0, zIndex: 41, background: '#fff', border: `1px solid ${BORDE}`, borderRadius: 10, boxShadow: '0 8px 26px rgba(0,0,0,0.14)', padding: 12, width: 340 }}>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  {anios.map(a => (
                    <button key={a} onClick={() => setAnioVista(a)}
                      style={{ ...pill, padding: '5px 13px', fontWeight: a === anioActivo ? 600 : 400,
                        background: a === anioActivo ? VERDE : '#fff', color: a === anioActivo ? '#fff' : '#3A3A38',
                        borderColor: a === anioActivo ? VERDE : BORDE }}>
                      {a}{anioCerrado && a === anioActivo ? ' 🔒' : ''}
                    </button>
                  ))}
                </div>

                {anioVacio && (
                  <div style={{ fontSize: 11, color: '#9A6E00', background: '#FDF6E3', border: '1px solid #EFE0B8', borderRadius: 8, padding: '6px 9px', marginBottom: 8 }}>
                    Sin ningún libro cargado en {anioActivo}.
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {MESES_CORTOS.map((nombre, i) => {
                    const c = porMes[i + 1]
                    const activo = c && c.id === cargaSel
                    return (
                      <button key={nombre} disabled={!c} onClick={() => irA(c)} title={c ? undefined : 'Sin libro cargado'}
                        style={{ ...pill, padding: '7px 0', textAlign: 'center', fontSize: 12,
                          fontWeight: activo ? 600 : 400,
                          background: activo ? VERDE : (c ? '#fff' : '#F7F6F2'),
                          color: activo ? '#fff' : (c ? '#3A3A38' : '#B4B2A9'),
                          borderColor: activo ? VERDE : BORDE,
                          cursor: c ? 'pointer' : 'default' }}>
                        {nombre}
                      </button>
                    )
                  })}
                </div>

              </div>
            </>)}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {sinCargar > 0 && (
              <button onClick={() => setSelAbierto(true)}
                title="Meses del año sin libro de remuneraciones cargado"
                style={{ ...pill, padding: '5px 12px', fontSize: 12, background: '#FDF6E3', color: '#9A6E00', borderColor: '#EFE0B8' }}>
                ⚠ {sinCargar} {sinCargar === 1 ? 'mes sin cargar' : 'meses sin cargar'}
              </button>
            )}
            {puedeEditar && (
              <button onClick={() => fileRef.current?.click()} disabled={subiendo}
                title="Subir o arrastrar el PDF del Libro de Remuneraciones"
                style={{ ...pill, padding: '6px 14px', fontSize: 13, fontWeight: 600, border: 'none',
                  background: subiendo ? '#B4D8CB' : '#1D9E75', color: '#fff', cursor: subiendo ? 'default' : 'pointer' }}>
                ⬆ {subiendo ? 'Leyendo…' : 'Cargar libro (PDF)'}
              </button>
            )}
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; cargarLibro(f) }} />
            <button onClick={() => { setCargaSel('TODAS'); setExpandida(null); setEditando(null); setAviso(null) }}
              style={{ ...pill, padding: '6px 13px', fontSize: 13,
                background: cargaSel === 'TODAS' ? VERDE : '#fff', color: cargaSel === 'TODAS' ? '#fff' : '#3A3A38',
                borderColor: cargaSel === 'TODAS' ? VERDE : BORDE }}>
              Todo el año
            </button>
          </div>
        </div>

        {msgCarga && (
          <div style={{ marginBottom: 12, fontSize: 13, padding: '9px 12px', borderRadius: 8,
            background: msgCarga.error ? '#FBE9E7' : '#F3FBF8',
            border: `1px solid ${msgCarga.error ? '#F0C9C2' : '#CDEBDF'}`,
            color: msgCarga.error ? '#B23A3A' : '#085041' }}>
            {msgCarga.error || msgCarga.text}
          </div>
        )}
        {error && (
          <div style={{ ...banner, background: '#FBE9E7', color: '#B23A3A', borderColor: '#F0C8C2' }}>
            {error}
          </div>
        )}

        {aviso && (
          <div style={{ ...banner, background: '#FFF8E6', color: '#7A5B12', borderColor: '#EFE0B8', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>{aviso}</span>
            <button onClick={() => setAviso(null)} style={{ ...btnTexto, color: '#7A5B12' }}>Cerrar</button>
          </div>
        )}

        {totales.faltaPrevired > 0 && !cargando && (
          <div style={{ ...banner, background: '#F0EFEA', color: '#5A5954', borderColor: BORDE }}>
            <strong>Faltan los aportes del empleador</strong> en {totales.faltaPrevired} de {totales.n} líneas.
            El coste empresa que se ve es sólo el total de haberes: no incluye SIS, cesantía patronal,
            mutual ni SANNA. Esos datos vienen de la planilla de Previred.
          </div>
        )}

        {congelado && !cargando && lineas.length > 0 && (
          <div style={{ ...banner, background: VERDE_CLARO, color: VERDE, borderColor: '#BFE3D6' }}>
            🔒 {cargaSel === 'TODAS' ? 'Todos los meses están congelados' : `${mesLabel(cargaActual?.periodo)} está congelado`}.
            Se puede consultar y exportar, pero no modificar el reparto.
          </div>
        )}

        {/* Totales */}
        {!cargando && lineas.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
            <Tarjeta label="Personas" valor={totales.n} />
            <Tarjeta label="Total haberes" valor={clp(totales.haberes)} />
            <Tarjeta label="Total descuentos" valor={clp(totales.desc)} />
            <Tarjeta label="Líquido" valor={clp(totales.liquido)} destacado />
            <Tarjeta label="Coste empresa" valor={clp(totales.coste)} nota={totales.faltaPrevired ? 'incompleto' : null} />
            <Tarjeta label="Sin clasificar" valor={totales.sinClasificar} alerta={totales.sinClasificar > 0} />
          </div>
        )}

        {/* Acciones */}
        {!cargando && lineas.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {puedeEditar && !congelado && cargaSel !== 'TODAS' && (
              <button onClick={() => heredar(false)} disabled={guardando} style={btnPrimario}>
                Aplicar reparto al mes
              </button>
            )}
            <button onClick={() => setVerResumen(v => !v)} style={btnSecundario}>
              {verResumen ? 'Ocultar resumen por CCB' : `Resumen por CCB (${resumenCCB.length})`}
            </button>
            <button onClick={exportar} style={btnSecundario}>Exportar a Excel</button>
          </div>
        )}

        {verResumen && (
          <div style={{ ...tarjeta, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600 }}>Reparto por centro</h3>
            {resumenCCB.length === 0 ? (
              <p style={{ margin: 0, color: TENUE, fontSize: 14 }}>
                Todavía no hay ninguna línea repartida. Usa «Aplicar reparto al mes» o edita una persona.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <tbody>
                  {resumenCCB.map(([c, m]) => (
                    <tr key={c} style={{ borderBottom: `1px solid ${BORDE}` }}>
                      <td style={{ padding: '6px 4px', fontWeight: 500 }}>{c}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(m)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ padding: '8px 4px', fontWeight: 600 }}>Total repartido</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {clp(resumenCCB.reduce((s, [, m]) => s + m, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tabla */}
        <div style={{ ...tarjeta, padding: 0, overflowX: 'auto' }}>
          {cargando ? (
            <p style={{ padding: 24, margin: 0, color: TENUE }}>Cargando…</p>
          ) : lineas.length === 0 ? (
            <p style={{ padding: 24, margin: 0, color: TENUE }}>
              No hay líneas en este periodo.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: '#F5F4F0', textAlign: 'left' }}>
                  <th style={th}></th>
                  {cargaSel === 'TODAS' && <th style={th}>Mes</th>}
                  <th style={th}>Nombre</th>
                  <th style={th}>RUT</th>
                  <th style={{ ...th, textAlign: 'right' }}>Días</th>
                  <th style={{ ...th, textAlign: 'right' }}>Haberes</th>
                  <th style={{ ...th, textAlign: 'right' }}>Descuentos</th>
                  <th style={{ ...th, textAlign: 'right' }}>Líquido</th>
                  <th style={{ ...th, textAlign: 'right' }}>Coste empresa</th>
                  <th style={th}>Centros</th>
                  <th style={th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map(l => {
                  const ds = ccbPorLinea[l.id] || []
                  const est = ESTADO[l.estado_clasificacion] || ESTADO.SIN_CLASIFICAR
                  const abierta = expandida === l.id
                  return (
                    <Fragment key={l.id}>
                      <tr
                        onClick={() => setExpandida(abierta ? null : l.id)}
                        style={{ borderBottom: `1px solid ${BORDE}`, cursor: 'pointer', background: abierta ? '#FBFBF9' : '#FFF' }}
                      >
                        <td style={{ ...td, width: 26, color: TENUE }}>{abierta ? '▾' : '▸'}</td>
                        {cargaSel === 'TODAS' && <td style={{ ...td, whiteSpace: 'nowrap' }}>{mesCorto(l.periodo)}</td>}
                        <td style={{ ...td, fontWeight: 500 }}>
                          {l.nombre}
                          {l.dt === 0 && <span style={{ marginLeft: 6, fontSize: 11, color: TENUE }}>sin días</span>}
                        </td>
                        <td style={{ ...td, color: TENUE, whiteSpace: 'nowrap' }}>{l.rut}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{l.dt}</td>
                        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(l.tot_haberes)}</td>
                        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#B23A3A' }}>{clp(l.tot_desc)}</td>
                        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{clp(l.liquido)}</td>
                        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {clp(l.coste_empresa)}
                          {l.falta_previred && <span title="Sin aportes del empleador" style={{ marginLeft: 4, color: '#B8860B' }}>*</span>}
                        </td>
                        <td style={td}>
                          {ds.length === 0 ? <span style={{ color: TENUE }}>—</span>
                            : ds.map(d => (
                              <span key={d.id} style={chip}>{d.ccb}{ds.length > 1 && d.pct != null ? ` ${Number(d.pct)}%` : ''}</span>
                            ))}
                        </td>
                        <td style={td}>
                          <span style={{ ...badge, background: est.bg, color: est.color }}>{est.label}</span>
                        </td>
                      </tr>

                      {abierta && (
                        <tr style={{ background: '#FBFBF9' }}>
                          <td colSpan={cargaSel === 'TODAS' ? 11 : 10} style={{ padding: '4px 16px 18px' }}>
                            <Detalle
                              linea={l}
                              desglose={ds}
                              puedeEditar={puedeEditar && !congelado}
                              editando={editando?.linea_id === l.id ? editando : null}
                              setEditando={setEditando}
                              abrirEditor={() => abrirEditor(l)}
                              guardar={guardar}
                              guardando={guardando}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}

/* ---------- subcomponentes ---------- */

function Tarjeta({ label, valor, destacado, alerta, nota }) {
  return (
    <div style={{
      background: '#FFF', border: `1px solid ${alerta ? '#F0C8C2' : BORDE}`,
      borderRadius: 8, padding: '10px 12px',
    }}>
      <div style={{ fontSize: 11.5, color: TENUE, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}{nota && <span style={{ color: '#B8860B' }}> · {nota}</span>}
      </div>
      <div style={{
        fontSize: 19, fontWeight: 600, marginTop: 2,
        fontVariantNumeric: 'tabular-nums',
        color: alerta ? '#B23A3A' : destacado ? VERDE : '#1A1A18',
      }}>{valor}</div>
    </div>
  )
}

function Detalle({ linea, desglose, puedeEditar, editando, setEditando, abrirEditor, guardar, guardando }) {
  const sumaEdit = editando ? editando.filas.reduce((s, f) => s + (Number(f.monto) || 0), 0) : 0
  const dif = editando ? (Number(editando.base) || 0) - sumaEdit : 0

  const setFila = (i, campo, valor) => {
    const filas = editando.filas.map((f, j) => j === i ? { ...f, [campo]: valor } : f)
    // Si cambia el %, se recalcula el monto sobre la base
    if (campo === 'pct') {
      const pct = Number(valor)
      if (!Number.isNaN(pct)) filas[i].monto = Math.round((Number(editando.base) || 0) * pct / 100)
    }
    setEditando({ ...editando, filas })
  }

  return (
    <div>
      {/* Detalle del libro */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 14 }}>
        <Dato label="Sueldo base" v={linea.sueldo_base} />
        <Dato label="Horas extras" v={linea.horas_extras} />
        <Dato label="Gratificación" v={linea.grat_legal} />
        <Dato label="Total imponible" v={linea.total_imp} />
        <Dato label="Asig. familiar" v={linea.asig_fam} />
        <Dato label="Total no imponible" v={linea.tot_no_imp} />
        <Dato label="Previsión" v={linea.prevision} />
        <Dato label="Salud" v={linea.salud} />
        <Dato label="Impuesto único" v={linea.imp_unico} />
        <Dato label="Seguro cesantía" v={linea.seg_ces} nota="0,6% trabajador" />
        <Dato label="Descuentos varios" v={linea.desc_varios} />
      </div>

      {linea.falta_previred && (
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#7A5B12', background: '#FFF8E6', border: '1px solid #EFE0B8', borderRadius: 6, padding: '6px 10px' }}>
          Los aportes del empleador (SIS, cesantía patronal, mutual, SANNA) no están cargados,
          así que el coste empresa mostrado son sólo los haberes.
        </p>
      )}

      {/* Desglose por centro */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>Reparto por centro</h4>
        {puedeEditar && !editando && (
          <button onClick={abrirEditor} style={btnTexto}>
            {desglose.length ? 'Editar reparto' : 'Añadir reparto'}
          </button>
        )}
      </div>

      {!editando ? (
        desglose.length === 0 ? (
          <p style={{ margin: 0, color: TENUE, fontSize: 13 }}>Sin repartir.</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {desglose.map(d => (
                <tr key={d.id} style={{ borderBottom: `1px solid ${BORDE}` }}>
                  <td style={{ padding: '5px 14px 5px 0', fontWeight: 500 }}>{d.ccb}</td>
                  <td style={{ padding: '5px 14px 5px 0', color: TENUE }}>{d.pct != null ? `${Number(d.pct)}%` : ''}</td>
                  <td style={{ padding: '5px 14px 5px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(d.monto)}</td>
                  <td style={{ padding: '5px 0', color: TENUE, fontSize: 12 }}>{d.origen === 'HEREDADO' ? 'heredado' : 'manual'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : (
        <div>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
            <thead>
              <tr style={{ color: TENUE, fontSize: 11.5, textAlign: 'left' }}>
                <th style={{ padding: '0 10px 4px 0' }}>Centro</th>
                <th style={{ padding: '0 10px 4px 0' }}>%</th>
                <th style={{ padding: '0 10px 4px 0' }}>Monto</th>
                <th style={{ padding: '0 10px 4px 0' }}>Concepto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {editando.filas.map((f, i) => (
                <tr key={i}>
                  <td style={{ padding: '3px 10px 3px 0' }}>
                    <input
                      list="ccb-sugeridos"
                      value={f.ccb}
                      onChange={e => setFila(i, 'ccb', e.target.value.toUpperCase())}
                      style={{ ...input, width: 90 }}
                    />
                  </td>
                  <td style={{ padding: '3px 10px 3px 0' }}>
                    <input type="number" value={f.pct} onChange={e => setFila(i, 'pct', e.target.value)} style={{ ...input, width: 70 }} />
                  </td>
                  <td style={{ padding: '3px 10px 3px 0' }}>
                    <input type="number" value={f.monto} onChange={e => setFila(i, 'monto', e.target.value)} style={{ ...input, width: 120, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '3px 10px 3px 0' }}>
                    <input value={f.concepto} onChange={e => setFila(i, 'concepto', e.target.value)} style={{ ...input, width: 200 }} />
                  </td>
                  <td>
                    <button
                      onClick={() => setEditando({ ...editando, filas: editando.filas.filter((_, j) => j !== i) })}
                      style={{ ...btnTexto, color: '#B23A3A' }}
                    >Quitar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <datalist id="ccb-sugeridos">
            {CCB_SUGERIDOS.map(c => <option key={c} value={c} />)}
          </datalist>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => setEditando({
                ...editando,
                filas: [...editando.filas, { sub_orden: editando.filas.length + 1, ccb: '', pct: '', monto: dif > 0 ? dif : 0, cuenta_1: '', cuenta_2: '', concepto: '' }],
              })}
              style={btnTexto}
            >+ Añadir centro</button>

            <span style={{ fontSize: 12.5, color: dif === 0 ? VERDE : '#B23A3A' }}>
              Reparto {clp(sumaEdit)} · coste empresa {clp(editando.base)}
              {dif !== 0 && ` · faltan ${clp(dif)}`}
            </span>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={() => setEditando(null)} style={btnSecundario}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={btnPrimario}>
                {guardando ? 'Guardando…' : 'Guardar reparto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Dato({ label, v, nota }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: TENUE }}>{label}{nota && <span style={{ opacity: 0.7 }}> · {nota}</span>}</div>
      <div style={{ fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>{clp(v)}</div>
    </div>
  )
}

/* ---------- estilos ---------- */

const tarjeta = { background: '#FFF', border: `1px solid ${BORDE}`, borderRadius: 10, padding: 16 }
const banner = { border: '1px solid', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13.5, lineHeight: 1.5 }
const th = { padding: '9px 10px', fontWeight: 600, fontSize: 12, color: '#5A5954', whiteSpace: 'nowrap' }
const td = { padding: '8px 10px', verticalAlign: 'middle' }
const pill = { padding: '6px 12px', borderRadius: 999, border: '1px solid', fontSize: 13, cursor: 'pointer', fontWeight: 500 }
const badge = { padding: '2px 8px', borderRadius: 999, fontSize: 11.5, fontWeight: 500, whiteSpace: 'nowrap' }
const chip = { display: 'inline-block', padding: '1px 7px', borderRadius: 4, background: '#F0EFEA', color: '#3A3A38', fontSize: 11.5, marginRight: 4 }
const input = { border: `1px solid ${BORDE}`, borderRadius: 5, padding: '4px 7px', fontSize: 13, fontFamily: 'inherit' }
const btnPrimario = { background: VERDE, color: '#FFF', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }
const btnSecundario = { background: '#FFF', color: '#3A3A38', border: `1px solid ${BORDE}`, borderRadius: 7, padding: '8px 14px', fontSize: 13.5, cursor: 'pointer' }
const btnTexto = { background: 'none', border: 'none', color: VERDE, fontSize: 13, cursor: 'pointer', padding: 0, fontWeight: 500 }
