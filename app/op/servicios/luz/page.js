'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const MESES_DISPONIBLES = [
  'MAYO 2026', 'ABRIL 2026', 'MARZO 2026', 'FEBRERO 2026',
  'ENERO 2026', 'DICIEMBRE 2025', 'NOVIEMBRE 2025', 'OCTUBRE 2025'
]

async function obtenerToken() {
  const res = await fetch('/api/servicios/luz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_token' }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.token
}

function consultarENELviaExtension(extensionId, codigo, token) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout extensión')), 15000)
    window.chrome.runtime.sendMessage(
      extensionId,
      { type: 'CONSULTAR_ENEL', codigo, token },
      (response) => {
        clearTimeout(timeout)
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
        else resolve(response)
      }
    )
  })
}

async function guardarResultado(mes, idadmon, idinmue, deuda, fecha) {
  const res = await fetch('/api/servicios/luz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'guardar', mes, idadmon, idinmue, deuda, fecha }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || 'Error guardando')
}

function interpretarRespuestaENEL(data) {
  if (data.result !== 'OK') return { ok: false, motivo: data.result || 'KO' }
  if (data.beResultCode === '005') return { ok: true, deuda: 0, fecha: new Date().toISOString().split('T')[0] }
  if (data.debtAmount !== undefined) {
    const deuda = parseFloat(String(data.debtAmount).replace(/[^0-9.]/g, '')) || 0
    return { ok: true, deuda, fecha: data.dueDate || new Date().toISOString().split('T')[0] }
  }
  return { ok: true, deuda: 0, fecha: new Date().toISOString().split('T')[0] }
}

export default function ServiciosLuzPage() {
  const router = useRouter()
  const [mes, setMes] = useState('MAYO 2026')
  const [soloPendientes, setSoloPendientes] = useState(false)
  const [codigos, setCodigos] = useState([])
  const [totalCodigos, setTotalCodigos] = useState(0)
  const [totalPendientes, setTotalPendientes] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [extensionId, setExtensionId] = useState('')
  const [extensionOk, setExtensionOk] = useState(false)
  const [fase, setFase] = useState('idle')
  const [progreso, setProgreso] = useState({ procesados: 0, exitosos: 0, fallidos: 0 })
  const [log, setLog] = useState([])
  const [resultados, setResultados] = useState([])
  const procesandoRef = useRef(false)
  const logRef = useRef(null)

  useEffect(() => { cargarCodigos() }, [mes, soloPendientes])
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  // Al cambiar mes, cargar también el conteo de pendientes
  useEffect(() => {
    cargarContPendientes()
  }, [mes])

  async function cargarCodigos() {
    setCargando(true)
    setCodigos([])
    setTotalCodigos(0)
    try {
      const url = `/api/servicios/luz?mes=${encodeURIComponent(mes)}&solo_pendientes=${soloPendientes}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.codigos) { setCodigos(data.codigos); setTotalCodigos(data.total) }
    } catch (e) { addLog('error', `Error cargando: ${e.message}`) }
    setCargando(false)
  }

  async function cargarContPendientes() {
    try {
      const res = await fetch(`/api/servicios/luz?mes=${encodeURIComponent(mes)}&solo_pendientes=true`)
      const data = await res.json()
      setTotalPendientes(data.total || 0)
    } catch (e) { }
  }

  function addLog(tipo, mensaje) {
    setLog(prev => [...prev, { tipo, mensaje, ts: new Date().toLocaleTimeString('es-CL') }])
  }

  async function verificarExtension() {
    if (!extensionId.trim()) { addLog('error', 'Ingresa el ID de la extensión'); return }
    try {
      addLog('info', 'Verificando extensión...')
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Sin respuesta')), 5000)
        window.chrome.runtime.sendMessage(extensionId.trim(), { type: 'PING' }, (response) => {
          clearTimeout(timeout)
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
          else resolve(response)
        })
      })
      setExtensionOk(true)
      addLog('ok', '✓ Extensión conectada')
    } catch (e) {
      setExtensionOk(false)
      addLog('error', `Error: ${e.message}`)
    }
  }

  async function iniciarConsulta() {
    if (!extensionOk || codigos.length === 0 || procesandoRef.current) return
    procesandoRef.current = true
    setFase('procesando')
    setProgreso({ procesados: 0, exitosos: 0, fallidos: 0 })
    setResultados([])

    const modo = soloPendientes ? 'SOLO PENDIENTES' : 'TODOS'
    addLog('info', `Iniciando consulta ${modo} — ${codigos.length} códigos`)

    let procesados = 0, exitosos = 0, fallidos = 0
    const todosResultados = []

    for (let i = 0; i < codigos.length; i++) {
      const { idadmon, idinmue, codigo_ele } = codigos[i]

      if (i % 5 === 0) addLog('info', `Consultando ${i + 1}/${codigos.length} — obteniendo token...`)

      try {
        const token = await obtenerToken()
        const result = await consultarENELviaExtension(extensionId.trim(), codigo_ele, token)

        if (!result?.ok) {
          todosResultados.push({ idadmon, codigo_ele, status: 'error', mensaje: result?.error || 'sin respuesta' })
          fallidos++
        } else {
          const interpretado = interpretarRespuestaENEL(result.data)
          if (!interpretado.ok) {
            todosResultados.push({ idadmon, codigo_ele, status: 'error', mensaje: `ENEL KO: ${interpretado.motivo}` })
            fallidos++
          } else {
            await guardarResultado(mes, idadmon, idinmue, interpretado.deuda, interpretado.fecha)
            todosResultados.push({ idadmon, codigo_ele, status: 'ok', deuda: interpretado.deuda })
            exitosos++
            if (exitosos % 5 === 0) addLog('ok', `${exitosos} registros guardados en Supabase`)
          }
        }
      } catch (e) {
        todosResultados.push({ idadmon, codigo_ele, status: 'error', mensaje: e.message })
        fallidos++
      }

      procesados++
      setProgreso({ procesados, exitosos, fallidos })
      setResultados([...todosResultados])
      await new Promise(r => setTimeout(r, 200))
    }

    addLog('ok', `✓ Completado: ${exitosos} exitosos, ${fallidos} fallidos de ${procesados} total`)
    setFase('completado')
    procesandoRef.current = false
    cargarContPendientes() // Actualizar conteo de pendientes al terminar
  }

  const s = {
    page: { minHeight: '100vh', background: '#0f1117', color: '#e2e8f0', fontFamily: "'DM Mono', 'Courier New', monospace" },
    header: { background: '#1a1d27', borderBottom: '1px solid #2d3149', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
    backBtn: { background: 'none', border: '1px solid #3d4266', color: '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' },
    title: { fontSize: '15px', fontWeight: '600', color: '#f1f5f9', margin: 0, letterSpacing: '0.05em' },
    badge: (color) => ({ background: color, color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }),
    body: { maxWidth: '700px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
    section: { background: '#1a1d27', border: '1px solid #2d3149', borderRadius: '8px', padding: '16px' },
    sectionTitle: { fontSize: '11px', fontWeight: '600', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' },
    select: { width: '100%', background: '#0f1117', border: '1px solid #3d4266', color: '#e2e8f0', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit' },
    kpiRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '10px' },
    kpi: { background: '#0f1117', border: '1px solid #2d3149', borderRadius: '6px', padding: '10px', textAlign: 'center' },
    kpiVal: { fontSize: '20px', fontWeight: '700', color: '#f1f5f9', lineHeight: 1 },
    kpiLabel: { fontSize: '10px', color: '#64748b', marginTop: '4px', letterSpacing: '0.05em' },
    btn: (color, disabled) => ({ width: '100%', padding: '12px', background: disabled ? '#1e2235' : color, color: disabled ? '#475569' : '#fff', border: 'none', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' }),
    toggleRow: { display: 'flex', gap: '8px', marginBottom: '0' },
    toggleBtn: (activo) => ({ flex: 1, padding: '8px', background: activo ? '#1e3a5f' : '#0f1117', border: activo ? '1px solid #3b82f6' : '1px solid #2d3149', color: activo ? '#60a5fa' : '#64748b', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: activo ? '600' : '400', fontFamily: 'inherit', transition: 'all 0.15s' }),
    progressBar: { background: '#0f1117', borderRadius: '4px', height: '6px', overflow: 'hidden' },
    progressFill: (pct) => ({ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #3b82f6, #06b6d4)', transition: 'width 0.3s', borderRadius: '4px' }),
    log: { background: '#0a0c14', border: '1px solid #2d3149', borderRadius: '6px', padding: '10px', maxHeight: '220px', overflowY: 'auto', fontSize: '11px', lineHeight: '1.7' },
    logLine: (tipo) => ({ color: tipo === 'error' ? '#f87171' : tipo === 'ok' ? '#4ade80' : tipo === 'warn' ? '#fbbf24' : '#94a3b8' }),
    row: { display: 'flex', gap: '8px' },
    input: { flex: 1, background: '#0f1117', border: '1px solid #3d4266', color: '#e2e8f0', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit' },
  }

  const pct = totalCodigos > 0 ? Math.round((progreso.procesados / totalCodigos) * 100) : 0
  const tiempoEstimado = Math.round(totalCodigos * 22 / 60)

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => router.push('/op/deudas')}>← Deudas</button>
        <h1 style={s.title}>⚡ CONSULTA MASIVA LUZ — ENEL</h1>
        <span style={s.badge('#6366f1')}>2CAPTCHA + EXTENSIÓN</span>
        {extensionOk && <span style={s.badge('#22c55e')}>EXTENSIÓN ✓</span>}
        {fase === 'procesando' && <span style={s.badge('#3b82f6')}>EN PROCESO</span>}
        {fase === 'completado' && <span style={s.badge('#22c55e')}>COMPLETADO</span>}
      </div>

      <div style={s.body}>

        {/* Mes */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Mes a procesar</div>
          <select style={s.select} value={mes}
            onChange={e => { setMes(e.target.value); setFase('idle'); setProgreso({ procesados: 0, exitosos: 0, fallidos: 0 }) }}
            disabled={fase === 'procesando'}>
            {MESES_DISPONIBLES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Modo vuelta */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Modo de consulta</div>
          <div style={s.toggleRow}>
            <button style={s.toggleBtn(!soloPendientes)}
              onClick={() => { if (fase !== 'procesando') setSoloPendientes(false) }}>
              📋 Todos los códigos ({totalCodigos > 0 && !soloPendientes ? totalCodigos : '...'})
            </button>
            <button style={s.toggleBtn(soloPendientes)}
              onClick={() => { if (fase !== 'procesando') setSoloPendientes(true) }}>
              🔄 Solo pendientes {totalPendientes !== null ? `(${totalPendientes})` : '(...)'}
            </button>
          </div>
          {soloPendientes && totalPendientes === 0 && (
            <div style={{ fontSize: '12px', color: '#4ade80', marginTop: '10px' }}>
              ✓ No hay pendientes — todos los códigos tienen fecha_hecho_luz registrada.
            </div>
          )}
          {soloPendientes && totalPendientes > 0 && (
            <div style={{ fontSize: '12px', color: '#fbbf24', marginTop: '10px' }}>
              ⚠️ {totalPendientes} códigos sin consultar en {mes}
            </div>
          )}
        </div>

        {/* Progreso */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Progreso</div>
          <div style={s.kpiRow}>
            <div style={s.kpi}><div style={s.kpiVal}>{cargando ? '...' : totalCodigos}</div><div style={s.kpiLabel}>A PROCESAR</div></div>
            <div style={s.kpi}><div style={{ ...s.kpiVal, color: '#4ade80' }}>{progreso.exitosos}</div><div style={s.kpiLabel}>EXITOSOS</div></div>
            <div style={s.kpi}><div style={{ ...s.kpiVal, color: '#f87171' }}>{progreso.fallidos}</div><div style={s.kpiLabel}>FALLIDOS</div></div>
            <div style={s.kpi}><div style={{ ...s.kpiVal, color: '#64748b' }}>{totalPendientes ?? '...'}</div><div style={s.kpiLabel}>PENDIENTES</div></div>
          </div>
          <div style={s.progressBar}><div style={s.progressFill(pct)} /></div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', textAlign: 'right' }}>
            {progreso.procesados} / {totalCodigos} ({pct}%)
          </div>
        </div>

        {/* Extensión */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Extensión Chrome</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '10px' }}>
            Mantén una pestaña de ENEL abierta en Chrome.
          </div>
          <div style={s.row}>
            <input style={s.input} placeholder="ID de la extensión ENEL Bridge"
              value={extensionId} onChange={e => { setExtensionId(e.target.value); setExtensionOk(false) }} />
            <button style={{ ...s.btn('#3b82f6', false), width: 'auto', padding: '8px 16px' }} onClick={verificarExtension}>
              Verificar
            </button>
          </div>
          {extensionOk && <div style={{ fontSize: '12px', color: '#4ade80', marginTop: '8px' }}>✓ Extensión conectada</div>}
        </div>

        {/* Acción */}
        {fase === 'idle' && extensionOk && totalCodigos > 0 && (
          <div style={s.section}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px', lineHeight: '1.6' }}>
              <strong style={{ color: '#e2e8f0' }}>
                {soloPendientes ? `Reintentando ${totalCodigos} códigos pendientes` : `Procesando ${totalCodigos} códigos`}
              </strong><br />
              Tiempo estimado: <strong style={{ color: '#fbbf24' }}>~{tiempoEstimado} minutos</strong>
            </div>
            <button style={s.btn('#22c55e', false)} onClick={iniciarConsulta}>
              ▶ {soloPendientes ? `Reintentar pendientes (${totalCodigos})` : `Iniciar consulta completa (${totalCodigos})`}
            </button>
          </div>
        )}

        {fase === 'idle' && extensionOk && totalCodigos === 0 && soloPendientes && (
          <div style={s.section}>
            <div style={{ fontSize: '12px', color: '#4ade80' }}>
              ✓ Sin pendientes — todos los códigos de {mes} están consultados.
            </div>
          </div>
        )}

        {fase === 'idle' && !extensionOk && (
          <div style={s.section}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Conecta la extensión para iniciar.</div>
          </div>
        )}

        {fase === 'procesando' && (
          <div style={s.section}>
            <div style={{ fontSize: '12px', color: '#3b82f6', lineHeight: '1.6' }}>
              ⏳ Procesando automáticamente...<br />
              No cierres esta pestaña ni la pestaña de ENEL.
            </div>
          </div>
        )}

        {fase === 'completado' && (
          <div style={s.section}>
            <div style={{ fontSize: '12px', color: '#4ade80', marginBottom: '12px' }}>
              ✓ {progreso.exitosos} registros actualizados.
              {totalPendientes > 0 && (
                <span style={{ color: '#fbbf24' }}> Aún quedan {totalPendientes} pendientes.</span>
              )}
            </div>
            <div style={s.row}>
              {totalPendientes > 0 && (
                <button style={{ ...s.btn('#f59e0b', false), flex: 1 }}
                  onClick={() => { setSoloPendientes(true); setFase('idle'); setProgreso({ procesados: 0, exitosos: 0, fallidos: 0 }); setResultados([]) }}>
                  🔄 Reintentar pendientes ({totalPendientes})
                </button>
              )}
              <button style={{ ...s.btn('#3b82f6', false), flex: 1 }}
                onClick={() => { setFase('idle'); setProgreso({ procesados: 0, exitosos: 0, fallidos: 0 }); setResultados([]) }}>
                Nueva consulta
              </button>
              <button style={{ ...s.btn('#6366f1', false), flex: 1 }} onClick={() => router.push('/op/deudas')}>
                → Ver en Deudas
              </button>
            </div>
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Log</div>
            <div style={s.log} ref={logRef}>
              {log.map((l, i) => (
                <div key={i} style={s.logLine(l.tipo)}>
                  <span style={{ color: '#475569' }}>{l.ts} </span>{l.mensaje}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fallidos */}
        {resultados.filter(r => r.status !== 'ok').length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Fallidos ({resultados.filter(r => r.status !== 'ok').length})</div>
            <div style={{ ...s.log, maxHeight: '120px' }}>
              {resultados.filter(r => r.status !== 'ok').map((r, i) => (
                <div key={i} style={{ color: '#f87171', fontSize: '11px' }}>{r.idadmon} / {r.codigo_ele} — {r.mensaje}</div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
