'use client'
// VERSION: v2 · 2026-07-18 · Añade "Pegar del portal": cargar GGCC pegando el texto de Comunidad
//   Feliz (bloques de 3, con dedup y validación anti-desalineo) sin pasar por xlsx ni Drive.
//   Reutiliza el previo/tabla/guardar existentes. La vía de Drive se mantiene intacta.
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
const FOLDER_ID = '1qE47HbwpDg32hkMUJIxRuWTRNA6Uhj47'

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

  const mesLabel = getMesLabel(fecha)
  const mesClave = getMesClave(fecha)
  const aamm = getAAMM(fecha)

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

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>

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
                        <span style={{ background: c.bg, color: c.color, padding: '2px 8px',
                                       borderRadius: 10, fontSize: 11, fontWeight: 500 }}>
                          {c.label}
                        </span>
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
