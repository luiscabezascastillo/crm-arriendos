'use client'
// VERSION: 2026-08-26 · Añadido "← Volver" (BotonVolver, history.back) — convención de retorno. Hereda versión previa.
// VERSION: v5 · 2026-08-24 · Añade botón "🗂️ Gestionar correspondencias" (→ /op/comunidad-feliz/correspondencias)
//   en el bloque de acceso, junto a "No asociados". Hereda v4.
// VERSION: v4 · 2026-08-17 · (1) Pantalla CERRADA POR ROL: solo Administración (Adalis/Fabiola), Karina y
//   Dirección (Luis/Alberto); el resto se redirige. (2) Dos botones en el bloque de acceso: "No asociados"
//   (los "Nuevos" del análisis + visor/edición de cf_correspondencias) y "Ver GGCC cargado" (modal con
//   ggcc_agua_luz del mes). Nuevos GET: /api/comunidad-feliz/correspondencia (lista) y /api/comunidad-feliz/ggcc.
//   Hereda v3.
// VERSION: v3 · 2026-08-17 · (1) Bloque "Acceso a Comunidad Feliz": enlaces al portal residentes y app admin,
//   credenciales tras toggle "Mostrar" con botón copiar, y guía de extracción (paginar de 50 en 50). Solo
//   recordatorio para personal autorizado; OJO: la pantalla no está cerrada por rol y la contraseña viaja en
//   el bundle JS y en git. (2) Las filas "Nuevo" son clicables → modal para dar de alta la correspondencia
//   (cf_correspondencias: idadmon/idinmue/estado/propietario) vía /api/comunidad-feliz/correspondencia.
//   Hereda v2.
// VERSION: v2 · 2026-07-18 · Añade "Pegar del portal": cargar GGCC pegando el texto de Comunidad
//   Feliz (bloques de 3, con dedup y validación anti-desalineo) sin pasar por xlsx ni Drive.
//   Reutiliza el previo/tabla/guardar existentes. La vía de Drive se mantiene intacta.
import { useState, useEffect } from 'react'
import BotonVolver from '../../components/ui/BotonVolver'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
const FOLDER_ID = '1qE47HbwpDg32hkMUJIxRuWTRNA6Uhj47'

// Acceso: Administración (Adalis/Fabiola) + Karina + Dirección (Luis/Alberto). Alias de roles como en TopNav/alertas.
const ROL_ALIAS = { admin: 'direccion', operaciones: 'administracion', tecnico: 'mantencion' }
const normRol = (r) => ROL_ALIAS[String(r || '').toLowerCase()] || String(r || '').toLowerCase()
const ROLES_OK = ['administracion', 'direccion']
const EMAILS_OK = ['karina.morales@fondocapital.com']  // Karina, aunque su rol no sea administración

function fmtPeso(n) {
  if (n === null || n === undefined || n === '') return '—'
  return '$' + Number(n).toLocaleString('es-CL')
}

function getMesLabel(date) {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return meses[date.getMonth()] + ' ' + date.getFullYear()
}

function getMesClave(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function getAAMM(date) {
  const y = String(date.getFullYear()).slice(2)
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return y + m
}

export default function ComunidadFeliz() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email || ''
  const rol = normRol(session?.user?.role)
  const puedeVer = ROLES_OK.includes(rol) || EMAILS_OK.includes(email)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.replace('/panel'); return }
    if (!puedeVer) { router.replace('/procesos/mi-portal') }
  }, [status, session, puedeVer]) // eslint-disable-line

  const hoy = new Date()
  const [fecha, setFecha] = useState(hoy)
  const [archivoCF, setArchivoCF] = useState(null)
  const [archivoCorr, setArchivoCorr] = useState(null)
  const [estado, setEstado] = useState('idle') // idle | buscando | procesando | listo | guardando | guardado
  const [resultado, setResultado] = useState([]) // filas procesadas
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [modoCorr, setModoCorr] = useState('supabase') // supabase | archivo
  const [modoCarga, setModoCarga] = useState('texto')  // texto (pegar del portal) | drive
  const [textoPegado, setTextoPegado] = useState('')
  const [avisoParse, setAvisoParse] = useState(null)   // { propiedades, duplicados }
  const [filtroBuscar, setFiltroBuscar] = useState('')
  const [tabActiva, setTabActiva] = useState('todos') // todos | match | sinmatch | nuevos

  // v3 — acceso a Comunidad Feliz (recordatorio) + alta de correspondencia desde "Nuevo"
  const [verCreds, setVerCreds] = useState(false)
  const [copiado, setCopiado] = useState('')
  const [nuevoRow, setNuevoRow] = useState(null)        // fila "Nuevo" en edición (o null)
  const [nuevoForm, setNuevoForm] = useState({ idadmon: '', idinmue: '', estado: 'S', propietario: '' })
  const [guardandoCorr, setGuardandoCorr] = useState(false)
  const [corrMsg, setCorrMsg] = useState('')

  async function copiar(texto, clave) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(clave)
      setTimeout(() => setCopiado(''), 1500)
    } catch { /* clipboard no disponible: se ignora */ }
  }

  function abrirNuevo(f) {
    setCorrMsg('')
    setNuevoForm({ idadmon: '', idinmue: '', estado: 'S', propietario: '' })
    setNuevoRow(f)
  }

  async function guardarCorrespondencia() {
    if (!nuevoRow) return
    const idadmon = nuevoForm.idadmon.trim().toUpperCase()
    if (!idadmon) { setCorrMsg('El IDADMON es obligatorio.'); return }
    setGuardandoCorr(true); setCorrMsg('')
    try {
      const res = await fetch('/api/comunidad-feliz/correspondencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comunidad_cf: nuevoRow.comunidad_cf,
          inmueble_cf: nuevoRow.inmueble_cf,
          idadmon,
          idinmue: nuevoForm.idinmue.trim(),
          estado: nuevoForm.estado,
          propietario: nuevoForm.propietario.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error guardando la correspondencia')
      // Reflejar el alta en la tabla del previo (sin re-analizar): la fila deja de ser "Nuevo".
      setResultado(prev => prev.map(r => (r === nuevoRow ? {
        ...r, idadmon, idinmue: nuevoForm.idinmue.trim(), estado: nuevoForm.estado,
        propietario: nuevoForm.propietario.trim(), match: true, nuevo: false,
        observacion: 'Correspondencia creada · vuelve a Analizar para incluir la deuda',
      } : r)))
      setNuevoRow(null)
      if (corrList.length) cargarCorrespondencias()   // refresca el visor si estaba cargado
    } catch (e) {
      setCorrMsg(e.message)
    } finally {
      setGuardandoCorr(false)
    }
  }

  const mesLabel = getMesLabel(fecha)
  const mesClave = getMesClave(fecha)
  const aamm = getAAMM(fecha)

  // v4 — visor "No asociados" (nuevos del análisis + correspondencias) y visor de ggcc_agua_luz
  const [verNoAsoc, setVerNoAsoc] = useState(false)
  const [corrList, setCorrList] = useState([])
  const [corrCargando, setCorrCargando] = useState(false)
  const [corrError, setCorrError] = useState('')
  const [corrBuscar, setCorrBuscar] = useState('')
  const [verGgcc, setVerGgcc] = useState(false)
  const [ggccList, setGgccList] = useState([])
  const [ggccCargando, setGgccCargando] = useState(false)
  const [ggccError, setGgccError] = useState('')

  async function cargarCorrespondencias() {
    setCorrCargando(true); setCorrError('')
    try {
      const res = await fetch('/api/comunidad-feliz/correspondencia')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error cargando correspondencias')
      setCorrList(data.correspondencias || [])
    } catch (e) { setCorrError(e.message) } finally { setCorrCargando(false) }
  }

  function abrirNoAsoc() { setVerNoAsoc(true); if (!corrList.length) cargarCorrespondencias() }

  // Editar una correspondencia existente reutilizando el modal de alta (upsert por comunidad+inmueble).
  function abrirEditar(c) {
    setCorrMsg('')
    setNuevoForm({ idadmon: c.idadmon || '', idinmue: c.idinmue || '', estado: ['S','P'].includes(c.estado) ? c.estado : 'S', propietario: c.propietario || '' })
    setNuevoRow({ comunidad_cf: c.comunidad_cf, inmueble_cf: c.inmueble_cf, deuda: null, _editando: true })
    setVerNoAsoc(false)
  }

  async function abrirGgcc() {
    setVerGgcc(true); setGgccCargando(true); setGgccError(''); setGgccList([])
    try {
      const res = await fetch(`/api/comunidad-feliz/ggcc?aamm=${aamm}&mes=${mesClave}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error cargando ggcc_agua_luz')
      setGgccList(data.filas || [])
    } catch (e) { setGgccError(e.message) } finally { setGgccCargando(false) }
  }

  const corrFiltradas = corrList.filter(c => {
    if (!corrBuscar) return true
    const q = corrBuscar.toLowerCase()
    return (c.comunidad_cf||'').toLowerCase().includes(q) || (c.inmueble_cf||'').toLowerCase().includes(q) ||
           (c.idadmon||'').toLowerCase().includes(q) || (c.idinmue||'').toLowerCase().includes(q) ||
           (c.propietario||'').toLowerCase().includes(q)
  })
  const nuevosDelAnalisis = resultado.filter(f => f.nuevo)

  // Buscar archivos en Drive
  async function buscarArchivesDrive() {
    setEstado('buscando')
    setError('')
    try {
      const res = await fetch('/api/comunidad-feliz/buscar-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: FOLDER_ID, aamm })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error buscando archivos')
      if (data.archivoCF) setArchivoCF(data.archivoCF)
      if (data.archivoCorr) setArchivoCorr(data.archivoCorr)
      setEstado('idle')
    } catch (e) {
      setError(e.message)
      setEstado('idle')
    }
  }

  // Procesar
  async function procesar() {
    if (!archivoCF) return setError('Falta archivo CF')
    setEstado('procesando')
    setError('')
    setResultado([])
    try {
      const res = await fetch('/api/comunidad-feliz/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archivoCFId: archivoCF.id,
          archivoCorId: archivoCorr?.id || null,
          mesClave,
          aamm,
          mesLabel
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error procesando')
      setResultado(data.filas)
      setStats(data.stats)
      setEstado('listo')
    } catch (e) {
      setError(e.message)
      setEstado('idle')
    }
  }

  // Analizar el TEXTO pegado del portal (alternativa a Drive). Produce el mismo previo.
  async function analizarTexto() {
    if (!textoPegado.trim()) return setError('Pega primero el texto del portal.')
    setEstado('procesando'); setError(''); setResultado([]); setAvisoParse(null)
    try {
      const res = await fetch('/api/comunidad-feliz/parsear-texto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoPegado, mesClave, aamm }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Error de estructura (desalineo): mostrar detalles y NO seguir
        const det = data.detalles ? '\n· ' + data.detalles.join('\n· ') : ''
        throw new Error((data.error || 'Error analizando el texto') + det)
      }
      setResultado(data.filas)
      setStats(data.stats)
      setAvisoParse({
        propiedades: data.stats.propiedadesPegadas,
        duplicados: data.stats.duplicadosIgnorados,
      })
      setEstado('listo')
    } catch (e) {
      setError(e.message)
      setEstado('idle')
    }
  }

  // Guardar en Supabase
  async function guardar() {
    setEstado('guardando')
    setError('')
    try {
      const res = await fetch('/api/comunidad-feliz/guardar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas: resultado, mesClave, aamm })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error guardando')
      setEstado('guardado')
    } catch (e) {
      setError(e.message)
      setEstado('listo')
    }
  }

  const filasFiltradas = resultado.filter(f => {
    if (tabActiva === 'match') return f.match === true && !f.nuevo
    if (tabActiva === 'sinmatch') return f.match === false
    if (tabActiva === 'nuevos') return f.nuevo === true
    return true
  }).filter(f => {
    if (!filtroBuscar) return true
    const q = filtroBuscar.toLowerCase()
    return (f.idadmon||'').toLowerCase().includes(q) ||
           (f.propietario||'').toLowerCase().includes(q) ||
           (f.comunidad_cf||'').toLowerCase().includes(q)
  })

  const confianzaColor = {
    'alta':     { bg: '#EAF3DE', color: '#3B6D11', label: 'Alta' },
    'media':    { bg: '#FAEEDA', color: '#854F0B', label: 'Media' },
    'sinmatch': { bg: '#FCEBEB', color: '#A32D2D', label: 'Sin match' },
    'nuevo':    { bg: '#E6F1FB', color: '#185FA5', label: 'Nuevo' },
  }

  if (status === 'loading' || !session || !puedeVer) {
    return (
      <div style={{ padding: '48px 32px', maxWidth: 1200, margin: '0 auto', color: '#6B7280', fontSize: 14 }}>
        {status === 'loading' ? 'Comprobando acceso…' : 'Acceso restringido — esta pantalla es solo para Administración, Karina y Dirección.'}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <BotonVolver />

      {/* Cabecera */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>
          Actualización mensual — Comunidad Feliz
        </h1>
        <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
          Actualiza la tabla <code>ggcc_agua_luz</code> con los datos de gastos comunes del mes
        </p>
      </div>

      {/* Paso 1 — Seleccionar mes */}
      <div style={cardStyle}>
        <div style={stepLabel}>1. Selecciona el mes a procesar</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
          <input
            type="month"
            value={`${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}`}
            onChange={e => {
              const [y,m] = e.target.value.split('-')
              setFecha(new Date(+y, +m-1, 1))
              setArchivoCF(null)
              setArchivoCorr(null)
              setResultado([])
              setEstado('idle')
            }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 14 }}
          />
          <span style={{ fontSize: 15, fontWeight: 500 }}>{mesLabel} {getAAMM(fecha)}</span>
        </div>
      </div>

      {/* Acceso a Comunidad Feliz — recordatorio para personal autorizado */}
      <div style={{ ...cardStyle, background: '#F8FAFC', borderColor: '#DBE3EC' }}>
        <div style={stepLabel}>Acceso a Comunidad Feliz</div>
        <p style={{ fontSize: 12, color: '#6B7280', margin: '8px 0 12px' }}>
          Recordatorio de acceso — solo para personal autorizado.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <a href="https://residents.comunidadfeliz.com/informacion/propiedades" target="_blank" rel="noopener noreferrer"
             style={linkBtn}>🔗 Portal residentes — Propiedades ↗</a>
          <a href="https://app2.comunidadfeliz.com/" target="_blank" rel="noopener noreferrer"
             style={linkBtn}>🔗 App administración ↗</a>
          <button onClick={abrirNoAsoc} style={accionBtn}>🧩 No asociados</button>
          <button onClick={() => router.push('/op/comunidad-feliz/correspondencias')} style={accionBtn}>🗂️ Gestionar correspondencias</button>
          <button onClick={abrirGgcc} style={accionBtn}>📄 Ver GGCC cargado</button>
        </div>

        <div style={{ marginBottom: 4 }}>
          <button onClick={() => setVerCreds(v => !v)} style={credToggle}>
            {verCreds ? '🙈 Ocultar credenciales' : '🔑 Mostrar credenciales'}
          </button>
        </div>
        {verCreds && (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '6px 10px', alignItems: 'center',
                        background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', maxWidth: 460, marginTop: 6 }}>
            <span style={credKey}>Usuario</span>
            <code style={credVal}>administracion@fondocapital.com</code>
            <button onClick={() => copiar('administracion@fondocapital.com', 'user')} style={copyBtn}>
              {copiado === 'user' ? '✓' : 'Copiar'}
            </button>
            <span style={credKey}>Contraseña</span>
            <code style={credVal}>Adm0npara2024y.,</code>
            <button onClick={() => copiar('Adm0npara2024y.,', 'pass')} style={copyBtn}>
              {copiado === 'pass' ? '✓' : 'Copiar'}
            </button>
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 12, color: '#374151' }}>
          <b style={{ color: '#111827' }}>Cómo extraer los datos:</b>
          <ol style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
            <li>Entra al portal y abre <b>"Todas las propiedades"</b>.</li>
            <li>Abajo, ve pasando las páginas de <b>50 en 50</b>.</li>
            <li>En cada página, selecciona y copia las <b>3 columnas</b> (Comunidad / Propiedad / Deuda).</li>
            <li>Pégalas en la caja de abajo. Puedes pegar <b>tanda tras tanda</b>; los duplicados se ignoran solos.</li>
          </ol>
        </div>
      </div>

      {/* Paso 2 — Origen de los datos */}
      <div style={cardStyle}>
        <div style={stepLabel}>2. Origen de los datos</div>

        {/* Toggle Pegar del portal / Drive */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[
            { k: 'texto', label: '📋 Pegar del portal' },
            { k: 'drive', label: '📁 Buscar en Drive' },
          ].map(m => (
            <button key={m.k} onClick={() => { setModoCarga(m.k); setError(''); setResultado([]); setEstado('idle'); setAvisoParse(null) }}
              style={{ ...tabBtn, ...(modoCarga === m.k ? tabBtnActive : {}) }}>
              {m.label}
            </button>
          ))}
        </div>

        {modoCarga === 'texto' ? (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 8px' }}>
              En Comunidad Feliz → "Todas las propiedades" (50 filas por página), selecciona y copia
              las 3 columnas (Comunidad / Propiedad / Deuda) y pégalas aquí. Puedes pegar las tandas
              de 50 <b>una tras otra</b> en esta misma caja; los duplicados se ignoran solos.
            </p>
            <textarea
              value={textoPegado}
              onChange={e => { setTextoPegado(e.target.value); setAvisoParse(null) }}
              placeholder={'Comunidad Alto Las Rejas II\n705\n$ 117.608\n...'}
              rows={8}
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: 12,
                       padding: 10, border: '1px solid #D1D5DB', borderRadius: 8, resize: 'vertical' }}
            />
            {avisoParse && (
              <div style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>
                Detectadas <b>{avisoParse.propiedades}</b> propiedades
                {avisoParse.duplicados > 0 && <span> · {avisoParse.duplicados} duplicado(s) ignorado(s)</span>}.
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ArchivoBox titulo="Archivo CF" esperado={`${aamm}_CF.xlsx`} archivo={archivoCF} />
              <ArchivoBox titulo="Correspondencias" esperado={`${aamm}_CF_correspondencias.xlsx`}
                archivo={archivoCorr} opcional={true} nota="Opcional — se usa la tabla Supabase si no hay archivo" />
            </div>
            <button onClick={buscarArchivesDrive} disabled={estado === 'buscando'} style={btnSecondary}>
              {estado === 'buscando' ? '🔍 Buscando...' : '🔍 Buscar en Drive'}
            </button>
          </div>
        )}
      </div>

      {/* Paso 3 — Procesar */}
      <div style={cardStyle}>
        <div style={stepLabel}>3. Procesar</div>
        <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {modoCarga === 'texto' ? (
            <button onClick={analizarTexto} disabled={!textoPegado.trim() || estado === 'procesando'} style={btnPrimary}>
              {estado === 'procesando' ? '⚡ Analizando...' : '⚡ Analizar y previsualizar'}
            </button>
          ) : (
            <button onClick={procesar} disabled={!archivoCF || estado === 'procesando'} style={btnPrimary}>
              {estado === 'procesando' ? '⚡ Procesando...' : '⚡ Procesar GGCC'}
            </button>
          )}
          {estado === 'listo' && (
            <button onClick={guardar} style={btnGuardar}>
              💾 Guardar en Supabase
            </button>
          )}
          {estado === 'guardando' && (
            <span style={{ color: '#6B7280', fontSize: 14, alignSelf: 'center' }}>Guardando…</span>
          )}
          {estado === 'guardado' && (
            <span style={{ color: '#3B6D11', fontWeight: 500, fontSize: 14, alignSelf: 'center' }}>
              ✅ Guardado correctamente
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: '#6B7280', margin: '10px 0 0' }}>
          "Analizar" solo <b>previsualiza</b> (no escribe nada). Revisa los números y la tabla de abajo,
          y solo entonces pulsa <b>Guardar en Supabase</b>.
        </p>
        {error && (
          <div style={{ marginTop: 10, color: '#A32D2D', fontSize: 13, whiteSpace: 'pre-wrap' }}>✗ {error}</div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Total procesados', val: stats.total, color: '#185FA5' },
            { label: 'Con match', val: stats.conMatch, color: '#3B6D11' },
            { label: 'Sin match', val: stats.sinMatch, color: '#A32D2D' },
            { label: 'Nuevos en CF', val: stats.nuevos, color: '#854F0B' },
          ].map(s => (
            <div key={s.label} style={{ background: '#F9FAFB', borderRadius: 8, padding: '12px 16px', border: '0.5px solid #E5E7EB' }}>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabla resultado */}
      {resultado.length > 0 && (
        <div style={cardStyle}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { k: 'todos', label: `Todos (${resultado.length})` },
              { k: 'match', label: `Con match (${resultado.filter(f=>f.match&&!f.nuevo).length})` },
              { k: 'sinmatch', label: `Sin match (${resultado.filter(f=>!f.match).length})` },
              { k: 'nuevos', label: `Nuevos (${resultado.filter(f=>f.nuevo).length})` },
            ].map(t => (
              <button key={t.k} onClick={() => setTabActiva(t.k)}
                style={{ ...tabBtn, ...(tabActiva===t.k ? tabBtnActive : {}) }}>
                {t.label}
              </button>
            ))}
            <input
              placeholder="Buscar IDADMON, propietario..."
              value={filtroBuscar}
              onChange={e => setFiltroBuscar(e.target.value)}
              style={{ marginLeft: 'auto', padding: '5px 10px', borderRadius: 6,
                       border: '1px solid #D1D5DB', fontSize: 13, width: 220 }}
            />
          </div>

          {/* Tabla */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F3F4F6' }}>
                  {['IDADMON','Estado','IDINMUE','Propietario','Comunidad CF','Inmueble CF','Deuda GGCC','Fecha','Confianza','Observación'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.map((f, i) => {
                  const conf = f.nuevo ? 'nuevo' : f.match ? 'alta' : 'sinmatch'
                  const c = confianzaColor[conf]
                  return (
                    <tr key={i} style={{ background: i%2===0 ? '#fff' : '#F9FAFB' }}>
                      <td style={tdStyle}><b>{f.idadmon}</b></td>
                      <td style={tdStyle}>{f.estado}</td>
                      <td style={tdStyle}>{f.idinmue}</td>
                      <td style={tdStyle}>{f.propietario}</td>
                      <td style={{ ...tdStyle, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.comunidad_cf}</td>
                      <td style={tdStyle}>{f.inmueble_cf}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>
                        {f.deuda !== null ? fmtPeso(f.deuda) : '—'}
                      </td>
                      <td style={tdStyle}>{f.fecha || '—'}</td>
                      <td style={tdStyle}>
                        {f.nuevo ? (
                          <button onClick={() => abrirNuevo(f)} title="Dar de alta la correspondencia de este GGCC"
                            style={{ background: c.bg, color: c.color, padding: '3px 10px', borderRadius: 10,
                                     fontSize: 11, fontWeight: 600, border: `1px solid ${c.color}33`, cursor: 'pointer' }}>
                            ＋ {c.label}
                          </button>
                        ) : (
                          <span style={{ background: c.bg, color: c.color, padding: '2px 8px',
                                         borderRadius: 10, fontSize: 11, fontWeight: 500 }}>
                            {c.label}
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: '#6B7280', fontSize: 12 }}>{f.observacion || ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal — alta de correspondencia desde una fila "Nuevo" */}
      {nuevoRow && (
        <div onClick={() => !guardandoCorr && setNuevoRow(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex',
                   alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', width: 460, maxWidth: '100%',
                     boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Alta de correspondencia</div>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 14px' }}>
              Enlaza esta propiedad de Comunidad Feliz con un IDADMON del CRM. Se guarda en <code>cf_correspondencias</code>.
            </p>

            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#6B7280' }}>Comunidad CF</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{nuevoRow.comunidad_cf}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>Inmueble CF</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{nuevoRow.inmueble_cf}</div>
              {nuevoRow.deuda != null && (
                <div style={{ fontSize: 12, color: '#854F0B', marginTop: 6 }}>Deuda GGCC: {fmtPeso(nuevoRow.deuda)}</div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={campoLabel}>IDADMON *
                <input value={nuevoForm.idadmon} autoFocus
                  onChange={e => setNuevoForm(s => ({ ...s, idadmon: e.target.value }))}
                  placeholder="A00123" style={campoInput} />
              </label>
              <label style={campoLabel}>IDINMUE
                <input value={nuevoForm.idinmue}
                  onChange={e => setNuevoForm(s => ({ ...s, idinmue: e.target.value }))}
                  placeholder="opcional" style={campoInput} />
              </label>
              <label style={campoLabel}>Estado
                <select value={nuevoForm.estado}
                  onChange={e => setNuevoForm(s => ({ ...s, estado: e.target.value }))} style={campoInput}>
                  <option value="S">S — con seguro</option>
                  <option value="P">P — propietario</option>
                </select>
              </label>
              <label style={campoLabel}>Propietario
                <input value={nuevoForm.propietario}
                  onChange={e => setNuevoForm(s => ({ ...s, propietario: e.target.value }))}
                  placeholder="opcional" style={campoInput} />
              </label>
            </div>

            {corrMsg && <div style={{ marginTop: 10, color: '#A32D2D', fontSize: 13 }}>✗ {corrMsg}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setNuevoRow(null)} disabled={guardandoCorr} style={btnSecondaryModal}>Cancelar</button>
              <button onClick={guardarCorrespondencia} disabled={guardandoCorr} style={btnGuardar}>
                {guardandoCorr ? 'Guardando…' : '💾 Crear correspondencia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — No asociados: nuevos del análisis + visor/edición de cf_correspondencias */}
      {verNoAsoc && (
        <div onClick={() => setVerNoAsoc(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex',
                   alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', width: 820, maxWidth: '100%',
                     maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Datos no asociados</div>
              <button onClick={() => setVerNoAsoc(false)} style={{ ...btnSecondaryModal, padding: '5px 12px' }}>Cerrar</button>
            </div>

            {/* Sección 1 — nuevos del análisis actual */}
            <div style={{ fontSize: 12, fontWeight: 600, color: '#854F0B', marginTop: 8 }}>
              En CF sin correspondencia (análisis actual): {nuevosDelAnalisis.length}
            </div>
            {nuevosDelAnalisis.length === 0 ? (
              <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 0' }}>
                Ninguno ahora. Pega el texto del portal y pulsa "Analizar" para detectar los nuevos del mes.
              </p>
            ) : (
              <div style={{ marginTop: 6, border: '1px solid #F1E6D2', borderRadius: 8, overflow: 'hidden' }}>
                {nuevosDelAnalisis.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                                        background: i % 2 ? '#FFFDF8' : '#fff', fontSize: 12 }}>
                    <div style={{ flex: 1 }}><b>{f.comunidad_cf}</b> · {f.inmueble_cf}</div>
                    <div style={{ color: '#854F0B' }}>{f.deuda != null ? fmtPeso(f.deuda) : '—'}</div>
                    <button onClick={() => abrirNuevo(f)} style={{ ...copyBtn, padding: '4px 10px' }}>Asociar</button>
                  </div>
                ))}
              </div>
            )}

            {/* Sección 2 — correspondencias existentes */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                Correspondencias existentes{corrList.length ? ` (${corrList.length})` : ''}
              </div>
              <input placeholder="Buscar comunidad, IDADMON, propietario…" value={corrBuscar}
                onChange={e => setCorrBuscar(e.target.value)}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, width: 260 }} />
            </div>
            {corrCargando ? (
              <p style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>Cargando…</p>
            ) : corrError ? (
              <p style={{ fontSize: 12, color: '#A32D2D', marginTop: 8 }}>✗ {corrError}</p>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F3F4F6' }}>
                      {['Comunidad CF','Inmueble CF','IDADMON','IDINMUE','Estado','Propietario',''].map(h => (
                        <th key={h} style={{ ...thStyle, padding: '6px 10px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {corrFiltradas.slice(0, 400).map((c, i) => {
                      const falta = !c.idadmon
                      return (
                        <tr key={c.id ?? i} style={{ background: falta ? '#FCEBEB' : (i % 2 ? '#F9FAFB' : '#fff') }}>
                          <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.comunidad_cf}</td>
                          <td style={tdStyle}>{c.inmueble_cf}</td>
                          <td style={tdStyle}><b>{c.idadmon || '—'}</b></td>
                          <td style={tdStyle}>{c.idinmue || '—'}</td>
                          <td style={tdStyle}>{c.estado || '—'}</td>
                          <td style={{ ...tdStyle, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.propietario || '—'}</td>
                          <td style={tdStyle}><button onClick={() => abrirEditar(c)} style={{ ...copyBtn, padding: '4px 10px' }}>Editar</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {corrFiltradas.length > 400 && (
                  <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>Mostrando 400 de {corrFiltradas.length}. Filtra con el buscador.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal — ggcc_agua_luz cargado del mes */}
      {verGgcc && (
        <div onClick={() => setVerGgcc(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex',
                   alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', width: 760, maxWidth: '100%',
                     maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>ggcc_agua_luz — {mesLabel}</div>
              <button onClick={() => setVerGgcc(false)} style={{ ...btnSecondaryModal, padding: '5px 12px' }}>Cerrar</button>
            </div>
            {ggccCargando ? (
              <p style={{ fontSize: 12, color: '#6B7280' }}>Cargando…</p>
            ) : ggccError ? (
              <p style={{ fontSize: 12, color: '#A32D2D' }}>✗ {ggccError}</p>
            ) : ggccList.length === 0 ? (
              <p style={{ fontSize: 12, color: '#6B7280' }}>No hay filas cargadas para {mesLabel}.</p>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>{ggccList.length} filas cargadas.</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F3F4F6' }}>
                        {['IDADMON','IDINMUE','Estado','Deuda GGCC','Fecha'].map(h => (
                          <th key={h} style={{ ...thStyle, padding: '6px 10px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ggccList.map((g, i) => (
                        <tr key={i} style={{ background: i % 2 ? '#F9FAFB' : '#fff' }}>
                          <td style={tdStyle}><b>{g.idadmon}</b></td>
                          <td style={tdStyle}>{g.idinmue || '—'}</td>
                          <td style={tdStyle}>{g.estado || '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            {g.deuda_gastos_comunes != null && g.deuda_gastos_comunes !== '' ? fmtPeso(g.deuda_gastos_comunes) : '—'}
                          </td>
                          <td style={tdStyle}>{g.fecha_hecho_ggcc || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ArchivoBox({ titulo, esperado, archivo, opcional, nota }) {
  return (
    <div style={{
      border: `1px solid ${archivo ? '#86EFAC' : '#E5E7EB'}`,
      borderRadius: 8, padding: '12px 16px',
      background: archivo ? '#F0FDF4' : '#F9FAFB'
    }}>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
        📊 {titulo} {opcional && <span style={{ color: '#9CA3AF' }}>(opcional)</span>}
      </div>
      {archivo ? (
        <div style={{ color: '#16A34A', fontSize: 13, fontWeight: 500 }}>✓ {archivo.name}</div>
      ) : (
        <div style={{ color: '#9CA3AF', fontSize: 12 }}>Esperado: {esperado}</div>
      )}
      {nota && !archivo && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{nota}</div>}
    </div>
  )
}

const cardStyle = {
  background: '#fff', border: '0.5px solid #E5E7EB',
  borderRadius: 10, padding: '16px 20px', marginBottom: 16
}
const stepLabel = { fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }
const btnPrimary = {
  background: '#DC2626', color: '#fff', border: 'none',
  borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 500,
  cursor: 'pointer'
}
const btnSecondary = {
  marginTop: 12, background: '#fff', color: '#374151',
  border: '1px solid #D1D5DB', borderRadius: 8,
  padding: '7px 16px', fontSize: 13, cursor: 'pointer'
}
const btnGuardar = {
  background: '#2563EB', color: '#fff', border: 'none',
  borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 500,
  cursor: 'pointer'
}
const tabBtn = {
  padding: '5px 14px', borderRadius: 6, border: '1px solid #E5E7EB',
  background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151'
}
const tabBtnActive = {
  background: '#EFF6FF', borderColor: '#BFDBFE', color: '#1D4ED8'
}
const thStyle = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11,
  fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB',
  whiteSpace: 'nowrap'
}
const tdStyle = { padding: '7px 12px', borderBottom: '0.5px solid #F3F4F6' }
const linkBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
  background: '#fff', border: '1px solid #C7D2FE', color: '#1D4ED8',
  borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 500
}
const credToggle = {
  background: '#fff', border: '1px solid #D1D5DB', color: '#374151',
  borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer'
}
const accionBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: '#F0FDF4', border: '1px solid #A7F3D0', color: '#047857',
  borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer'
}
const credKey = { fontSize: 12, color: '#6B7280', fontWeight: 500 }
const credVal = { fontSize: 13, color: '#111827', wordBreak: 'break-all' }
const copyBtn = {
  background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8',
  borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap'
}
const campoLabel = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6B7280' }
const campoInput = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, color: '#111827'
}
const btnSecondaryModal = {
  background: '#fff', color: '#374151', border: '1px solid #D1D5DB',
  borderRadius: 8, padding: '9px 18px', fontSize: 14, cursor: 'pointer'
}
