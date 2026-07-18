'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Meses del desplegable: se generan solos (mes en curso + 12 hacia atrás). Ya no hay que
// editar el código cada mes. Formato "MES AAAA" en mayúsculas, igual que antes.
const NOMBRES_MES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
function generarMeses(nAtras = 12) {
  const hoy = new Date()
  const lista = []
  for (let i = 0; i <= nAtras; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    lista.push(`${NOMBRES_MES[d.getMonth()]} ${d.getFullYear()}`)
  }
  return lista
}
const MESES_DISPONIBLES = generarMeses(12)

// VERSION: v3 · 2026-07-18 · Los meses del desplegable se generan solos (mes en curso + 12 atrás);
//   ya no hay lista fija que editar cada mes. Incluye lo de v2 (ID de extensión editable/guardado).
// VERSION: v2 · 2026-07-18 · El ID de la extensión CRM Bridge deja de estar fijo: ahora es un campo
//   editable que se guarda por navegador (localStorage). Así funciona en cualquier PC, como la de Agua.
// Extensión CRM Bridge (consulta ENEL vía Sencillito desde el navegador real)
const EXTENSION_ID_DEFAULT = 'jnhdggkodeajhgjgpchdjmmmdgnndgdd'
const EXT_ID_STORAGE_KEY = 'crm_bridge_extension_id'
const SENCILLITO_URL = 'https://sencillito.com/pagos-de-la-factura?industriaId=13&convenioId=6001'

export default function ServiciosLuzPage() {
  const router = useRouter()
  const [mes, setMes] = useState(MESES_DISPONIBLES[0])
  const [soloPendientes, setSoloPendientes] = useState(false)
  const [codigos, setCodigos] = useState([])
  const [totalCodigos, setTotalCodigos] = useState(0)
  const [totalPendientes, setTotalPendientes] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [fase, setFase] = useState('idle')
  const [progreso, setProgreso] = useState({ procesados: 0, exitosos: 0, fallidos: 0 })
  const [log, setLog] = useState([])
  const [resultados, setResultados] = useState([])
  const [extOk, setExtOk] = useState(null)
  const [extVer, setExtVer] = useState('')
  const [extensionId, setExtensionId] = useState(EXTENSION_ID_DEFAULT)

  // Cargar el ID de la extensión guardado en ESTE navegador (si lo hay).
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(EXT_ID_STORAGE_KEY)
      if (guardado && guardado.trim()) setExtensionId(guardado.trim())
    } catch {}
  }, [])

  // Guardar el ID por navegador cada vez que cambie (para no reescribirlo).
  function actualizarExtensionId(v) {
    const val = v.trim()
    setExtensionId(val)
    setExtOk(null)   // al cambiar el ID, hay que volver a verificar
    try { if (val) localStorage.setItem(EXT_ID_STORAGE_KEY, val) } catch {}
  }
  const procesandoRef = useRef(false)
  const cancelarRef = useRef(false)
  const logRef = useRef(null)

  useEffect(() => { cargarCodigos() }, [mes, soloPendientes])
  useEffect(() => { cargarContPendientes() }, [mes])
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  async function cargarCodigos() {
    setCargando(true); setCodigos([]); setTotalCodigos(0)
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
    } catch (e) {}
  }

  function addLog(tipo, mensaje) {
    setLog(prev => [...prev, { tipo, mensaje, ts: new Date().toLocaleTimeString('es-CL') }])
  }

  // ── Comunicación con la extensión CRM Bridge ──
  function extDisponible() {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage
  }

  function enviarAExtension(mensaje) {
    return new Promise((resolve, reject) => {
      if (!extDisponible()) { reject(new Error('Chrome extension API no disponible (usa Chrome con la extensión instalada)')); return }
      if (!extensionId || !extensionId.trim()) { reject(new Error('Falta el ID de la extensión CRM Bridge (escríbelo arriba).')); return }
      try {
        chrome.runtime.sendMessage(extensionId.trim(), mensaje, (resp) => {
          const err = chrome.runtime.lastError
          if (err) { reject(new Error(err.message || 'La extensión no respondió (¿instalada y activa?)')); return }
          resolve(resp)
        })
      } catch (e) { reject(e) }
    })
  }

  async function verificarExtension() {
    try {
      const r = await enviarAExtension({ type: 'PING' })
      if (r && r.ok) { setExtOk(true); setExtVer(r.version || ''); addLog('ok', `Extensión conectada (${r.version || '?'})`) }
      else { setExtOk(false); addLog('error', 'La extensión respondió pero sin OK') }
    } catch (e) {
      setExtOk(false); addLog('error', `Extensión no disponible: ${e.message}`)
    }
  }

  async function iniciarConsulta() {
    if (codigos.length === 0 || procesandoRef.current) return

    // Verificar extensión antes de empezar
    try {
      const ping = await enviarAExtension({ type: 'PING' })
      if (!ping || !ping.ok) { addLog('error', 'La extensión no respondió al PING. Instálala/actívala y recarga.'); setExtOk(false); return }
      setExtOk(true); setExtVer(ping.version || '')
    } catch (e) {
      addLog('error', `No se pudo contactar la extensión: ${e.message}`); setExtOk(false); return
    }

    procesandoRef.current = true
    cancelarRef.current = false
    setFase('procesando')
    setProgreso({ procesados: 0, exitosos: 0, fallidos: 0 })
    setResultados([])

    const modo = soloPendientes ? 'SOLO PENDIENTES' : 'TODOS'
    addLog('info', `Iniciando consulta ${modo} — ${codigos.length} códigos`)

    let procesados = 0, exitosos = 0, fallidos = 0
    const todosResultados = []

    // Pausa entre consultas para no saturar Sencillito (evita HTTP 429).
    // Sencillito es estricto: 4s de separacion es lo que tolera de forma fiable.
    const PAUSA_MS = 4000
    const espera = (ms) => new Promise(r => setTimeout(r, ms))

    for (let i = 0; i < codigos.length; i++) {
      if (cancelarRef.current) { addLog('warn', 'Proceso detenido por el usuario'); break }
      const { idadmon, idinmue, codigo_ele } = codigos[i]
      if (i % 10 === 0) addLog('info', `Consultando ${i + 1}/${codigos.length}…`)

      // Reintento ante HTTP 429 con backoff largo (el castigo de Sencillito dura).
      // Hasta 4 intentos: espera 15s, 30s, 45s entre ellos.
      let resp = null
      for (let intento = 0; intento < 4; intento++) {
        try {
          resp = await enviarAExtension({ type: 'CONSULTAR_ENEL', codigo: codigo_ele })
        } catch (e) {
          resp = { ok: false, error: e.message }
        }
        const es429 = resp && !resp.ok && /(^|\D)429(\D|$)/.test(String(resp.error || ''))
        if (!es429) break
        if (intento < 3) {
          const seg = 15 * (intento + 1)
          addLog('warn', `429 en ${codigo_ele}, esperando ${seg}s…`)
          await espera(seg * 1000)
        }
      }

      try {
        if (!resp || !resp.ok) {
          todosResultados.push({ idadmon, codigo_ele, status: 'error', mensaje: (resp && resp.error) || 'sin respuesta de la extensión' })
          fallidos++
        } else {
          // Guardar en el servidor (Supabase no tiene anti-bot)
          const hoy = new Date().toISOString().split('T')[0]
          const fecha = resp.fecha || hoy
          const g = await fetch('/api/servicios/luz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'guardar', mes, idadmon, idinmue, deuda: resp.deuda, fecha }),
          })
          const gd = await g.json()
          if (gd.error) {
            todosResultados.push({ idadmon, codigo_ele, status: 'error', mensaje: 'guardar: ' + gd.error })
            fallidos++
          } else {
            todosResultados.push({ idadmon, codigo_ele, status: 'ok', deuda: resp.deuda })
            exitosos++
            if (exitosos % 10 === 0) addLog('ok', `${exitosos} guardados`)
          }
        }
      } catch (e) {
        todosResultados.push({ idadmon, codigo_ele, status: 'error', mensaje: e.message })
        fallidos++
      }

      procesados++
      setProgreso({ procesados, exitosos, fallidos })
      setResultados([...todosResultados])

      // Pausa antes del siguiente (salvo el último)
      if (i < codigos.length - 1) await espera(PAUSA_MS)
    }

    addLog('ok', `✓ Completado: ${exitosos} exitosos, ${fallidos} fallidos de ${procesados}`)
    setFase('completado')
    procesandoRef.current = false
    cargarContPendientes()
  }

  function detener() { cancelarRef.current = true }

  const s = {
    page: { minHeight: '100vh', background: '#0f1117', color: '#e2e8f0', fontFamily: "'DM Mono', 'Courier New', monospace" },
    header: { background: '#1a1d27', borderBottom: '1px solid #2d3149', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
    backBtn: { background: 'none', border: '1px solid #3d4266', color: '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' },
    title: { fontSize: '15px', fontWeight: '600', color: '#f1f5f9', margin: 0, letterSpacing: '0.05em' },
    body: { maxWidth: '700px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
    section: { background: '#1a1d27', border: '1px solid #2d3149', borderRadius: '8px', padding: '16px' },
    sectionTitle: { fontSize: '11px', fontWeight: '600', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' },
    select: { width: '100%', background: '#0f1117', border: '1px solid #3d4266', color: '#e2e8f0', padding: '8px 10px', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit' },
    kpiRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '10px' },
    kpi: { background: '#0f1117', border: '1px solid #2d3149', borderRadius: '6px', padding: '10px', textAlign: 'center' },
    kpiVal: { fontSize: '20px', fontWeight: '700', color: '#f1f5f9', lineHeight: 1 },
    kpiLabel: { fontSize: '10px', color: '#64748b', marginTop: '4px', letterSpacing: '0.05em' },
    btn: (color, disabled) => ({ width: '100%', padding: '12px', background: disabled ? '#1e2235' : color, color: disabled ? '#475569' : '#fff', border: 'none', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' }),
    toggleRow: { display: 'flex', gap: '8px' },
    toggleBtn: (activo) => ({ flex: 1, padding: '8px', background: activo ? '#1e3a5f' : '#0f1117', border: activo ? '1px solid #3b82f6' : '1px solid #2d3149', color: activo ? '#60a5fa' : '#64748b', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: activo ? '600' : '400', fontFamily: 'inherit' }),
    progressBar: { background: '#0f1117', borderRadius: '4px', height: '6px', overflow: 'hidden' },
    progressFill: (pct) => ({ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #3b82f6, #06b6d4)', transition: 'width 0.3s', borderRadius: '4px' }),
    log: { background: '#0a0c14', border: '1px solid #2d3149', borderRadius: '6px', padding: '10px', maxHeight: '220px', overflowY: 'auto', fontSize: '11px', lineHeight: '1.7' },
    logLine: (tipo) => ({ color: tipo === 'error' ? '#f87171' : tipo === 'ok' ? '#4ade80' : tipo === 'warn' ? '#fbbf24' : '#94a3b8' }),
  }

  const pct = totalCodigos > 0 ? Math.round((progreso.procesados / totalCodigos) * 100) : 0
  const tiempoEstimado = Math.max(1, Math.round(totalCodigos * 4.5 / 60))

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => router.push('/op/deudas')}>← Volver a Deudas</button>
        <h1 style={s.title}>⚡ Cargar Luz (ENEL)</h1>
      </div>

      <div style={s.body}>
        {/* Configuración */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Mes a procesar</div>
          <select style={s.select} value={mes} onChange={e => setMes(e.target.value)} disabled={fase === 'procesando'}>
            {MESES_DISPONIBLES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div style={{ ...s.toggleRow, marginTop: '10px' }}>
            <button style={s.toggleBtn(!soloPendientes)} onClick={() => setSoloPendientes(false)} disabled={fase === 'procesando'}>Todos los códigos</button>
            <button style={s.toggleBtn(soloPendientes)} onClick={() => setSoloPendientes(true)} disabled={fase === 'procesando'}>Solo pendientes</button>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px' }}>
            {cargando ? 'Cargando…' : `${totalPendientes ?? '...'} códigos sin consultar en ${mes}`}
          </div>
        </div>

        {/* Conexión con Sencillito (extensión) */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Conexión con Sencillito (extensión)</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.6, marginBottom: 10 }}>
            La consulta se hace desde tu navegador con la extensión <strong style={{ color: '#e2e8f0' }}>CRM Bridge</strong>.
            Necesitas: (1) la extensión instalada y activa, y (2) una pestaña de Sencillito abierta <strong style={{ color: '#e2e8f0' }}>e iniciada sesión</strong>.
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
              ID de la extensión CRM Bridge (en chrome://extensions)
            </label>
            <input
              value={extensionId}
              onChange={e => actualizarExtensionId(e.target.value)}
              placeholder="p. ej. jnhdggkodeajhgjgpchdjmmmdgnndgdd"
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '12px',
                       padding: '7px 10px', borderRadius: 6, border: '1px solid #334155',
                       background: '#0f172a', color: '#e2e8f0' }}
            />
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: 4 }}>
              Se guarda en este navegador. Cada PC lo escribe una vez; el ID sale en chrome://extensions (bajo "CRM Bridge").
            </div>
          </div>
          <div style={s.toggleRow}>
            <button style={{ ...s.btn('#3b82f6', false), flex: 1 }} onClick={verificarExtension}>
              {extOk === null ? '🔌 Verificar extensión' : extOk ? `✓ Conectada ${extVer}` : '✗ Reintentar conexión'}
            </button>
            <button style={{ ...s.btn('#6366f1', false), flex: 1 }} onClick={() => window.open(SENCILLITO_URL, '_blank')}>
              ↗ Abrir Sencillito
            </button>
          </div>
          {extOk === false && (
            <div style={{ fontSize: '11px', color: '#f87171', marginTop: 8, lineHeight: 1.5 }}>
              No se pudo contactar la extensión. Abre chrome://extensions, comprueba que CRM Bridge está activa
              (versión 2.2) y que su ID coincide. Luego recarga esta página.
            </div>
          )}
          {extOk === true && (
            <div style={{ fontSize: '11px', color: '#4ade80', marginTop: 8 }}>
              Extensión lista. Abre Sencillito (botón de arriba), inicia sesión y deja esa pestaña abierta mientras consultas.
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

        {/* Acción */}
        {fase !== 'procesando' && totalCodigos > 0 && (
          <div style={s.section}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px', lineHeight: '1.6' }}>
              <strong style={{ color: '#e2e8f0' }}>
                {soloPendientes ? `Reintentando ${totalCodigos} pendientes` : `Procesando ${totalCodigos} códigos`}
              </strong><br />
              Tiempo estimado: <strong style={{ color: '#fbbf24' }}>~{tiempoEstimado} min</strong>
            </div>
            <button style={s.btn('#22c55e', false)} onClick={iniciarConsulta}>
              ▶ {soloPendientes ? `Reintentar pendientes (${totalCodigos})` : `Iniciar consulta (${totalCodigos})`}
            </button>
          </div>
        )}

        {fase !== 'procesando' && totalCodigos === 0 && soloPendientes && (
          <div style={s.section}>
            <div style={{ fontSize: '12px', color: '#4ade80' }}>✓ Sin pendientes — todos los códigos de {mes} están consultados.</div>
          </div>
        )}

        {fase === 'procesando' && (
          <div style={s.section}>
            <div style={{ fontSize: '12px', color: '#3b82f6', lineHeight: '1.6', marginBottom: '12px' }}>
              ⏳ Consultando ENEL vía Sencillito… deja abierta la pestaña de Sencillito (con sesión iniciada).
            </div>
            <button style={s.btn('#ef4444', false)} onClick={detener}>■ Detener</button>
          </div>
        )}

        {fase === 'completado' && (
          <div style={s.section}>
            <div style={{ fontSize: '12px', color: '#4ade80', marginBottom: '12px' }}>
              ✓ {progreso.exitosos} registros actualizados.
              {totalPendientes > 0 && <span style={{ color: '#fbbf24' }}> Aún quedan {totalPendientes} pendientes.</span>}
            </div>
            <div style={s.toggleRow}>
              {totalPendientes > 0 && (
                <button style={{ ...s.btn('#f59e0b', false), flex: 1 }}
                  onClick={() => { setSoloPendientes(true); setFase('idle'); setProgreso({ procesados: 0, exitosos: 0, fallidos: 0 }); setResultados([]) }}>
                  🔄 Reintentar pendientes ({totalPendientes})
                </button>
              )}
              <button style={{ ...s.btn('#6366f1', false), flex: 1 }} onClick={() => router.push('/op/deudas')}>→ Ver en Deudas</button>
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
        {resultados.filter(r => r.status === 'error').length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Fallidos ({resultados.filter(r => r.status === 'error').length})</div>
            <div style={{ ...s.log, maxHeight: '120px' }}>
              {resultados.filter(r => r.status === 'error').map((r, i) => (
                <div key={i} style={{ color: '#f87171', fontSize: '11px', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{r.idadmon} / {r.codigo_ele} — {r.mensaje}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}