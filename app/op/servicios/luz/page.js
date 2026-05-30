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

const AAMM_MAP = {
  'MAYO 2026': '2605', 'ABRIL 2026': '2604', 'MARZO 2026': '2603',
  'FEBRERO 2026': '2602', 'ENERO 2026': '2601', 'DICIEMBRE 2025': '2512',
  'NOVIEMBRE 2025': '2511', 'OCTUBRE 2025': '2510'
}

// Consulta ENEL via extensión Chrome (evita CORS y Akamai)
function consultarENELviaExtension(extensionId, codigo, token) {
  return new Promise((resolve, reject) => {
    if (!window.chrome?.runtime?.sendMessage) {
      reject(new Error('API de extensión no disponible'))
      return
    }
    const timeout = setTimeout(() => reject(new Error('Timeout — extensión no respondió')), 15000)
    window.chrome.runtime.sendMessage(
      extensionId,
      { type: 'CONSULTAR_ENEL', codigo, token },
      (response) => {
        clearTimeout(timeout)
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve(response)
        }
      }
    )
  })
}

function interpretarRespuestaENEL(data) {
  if (data.result !== 'OK') return { ok: false, motivo: 'result_ko' }
  if (data.beResultCode === '005') {
    return { ok: true, deuda: 0, fecha: new Date().toISOString().split('T')[0] }
  }
  if (data.debtAmount !== undefined) {
    const deuda = parseFloat(String(data.debtAmount).replace(/[^0-9.]/g, '')) || 0
    const fecha = data.dueDate || new Date().toISOString().split('T')[0]
    return { ok: true, deuda, fecha }
  }
  return { ok: true, deuda: 0, fecha: new Date().toISOString().split('T')[0], raw: JSON.stringify(data) }
}

async function guardarEnSupabase(supabase, mes, idadmon, idinmue, deuda, fecha) {
  const { error } = await supabase
    .from('ggcc_agua_luz')
    .update({
      deuda_vigente_electricidad: deuda,
      fecha_hecho_luz: fecha,
      updated_at: new Date().toISOString(),
    })
    .eq('mes', mes)
    .eq('idadmon', idadmon)
    .eq('idinmue', idinmue)
  if (error) throw new Error(error.message)
}

export default function ServiciosLuzPage() {
  const router = useRouter()

  const [mes, setMes] = useState('MAYO 2026')
  const [codigos, setCodigos] = useState([])
  const [totalCodigos, setTotalCodigos] = useState(0)
  const [cargando, setCargando] = useState(false)
  const [extensionId, setExtensionId] = useState('')
  const [extensionOk, setExtensionOk] = useState(false)

  const [fase, setFase] = useState('idle')
  const [tokenCaptcha, setTokenCaptcha] = useState(null)
  const [progreso, setProgreso] = useState({ procesados: 0, exitosos: 0, fallidos: 0 })
  const [resultados, setResultados] = useState([])
  const [log, setLog] = useState([])
  const procesandoRef = useRef(false)
  const logRef = useRef(null)

  useEffect(() => {
    cargarCodigos()
  }, [mes])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  async function cargarCodigos() {
    setCargando(true)
    setCodigos([])
    setTotalCodigos(0)
    try {
      const { data, error } = await supabase
        .from('ggcc_agua_luz')
        .select('idadmon, idinmue, codigo_ele, deuda_vigente_electricidad, fecha_hecho_luz')
        .eq('mes', mes)
        .not('codigo_ele', 'is', null)
        .neq('codigo_ele', '')
        .order('idadmon')
      if (error) throw error
      const filtrado = (data || []).filter(row => !row.idinmue?.startsWith('.'))
      setCodigos(filtrado)
      setTotalCodigos(filtrado.length)
    } catch (e) {
      addLog('error', `Error cargando códigos: ${e.message}`)
    }
    setCargando(false)
  }

  async function verificarExtension() {
    if (!extensionId.trim()) {
      addLog('error', 'Ingresa el ID de la extensión')
      return
    }
    try {
      addLog('info', `Verificando extensión ${extensionId.trim()}...`)
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Sin respuesta — verifica el ID')), 5000)
        window.chrome.runtime.sendMessage(
          extensionId.trim(),
          { type: 'PING' },
          (response) => {
            clearTimeout(timeout)
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
            else resolve(response)
          }
        )
      })
      setExtensionOk(true)
      addLog('ok', '✓ Extensión conectada correctamente')
    } catch (e) {
      setExtensionOk(false)
      addLog('error', `Error: ${e.message}`)
    }
  }

  function addLog(tipo, mensaje) {
    setLog(prev => [...prev, { tipo, mensaje, ts: new Date().toLocaleTimeString('es-CL') }])
  }

  function pegarToken(token) {
    const t = token?.trim()
    if (t && t.length > 100) {
      setTokenCaptcha(t)
      setFase('listo')
      addLog('ok', `Token capturado (${t.substring(0, 20)}...) ✓`)
    } else {
      addLog('error', 'Token inválido — debe tener más de 100 caracteres')
    }
  }

  async function iniciarConsulta() {
    if (!tokenCaptcha || codigos.length === 0 || procesandoRef.current) return
    if (!extensionOk) { addLog('error', 'Conecta la extensión primero'); return }

    procesandoRef.current = true
    setFase('procesando')
    setProgreso({ procesados: 0, exitosos: 0, fallidos: 0 })
    setResultados([])

    let procesados = 0, exitosos = 0, fallidos = 0
    const todosResultados = []

    for (let i = 0; i < codigos.length; i++) {
      const { idadmon, idinmue, codigo_ele } = codigos[i]

      if (i % 5 === 0) {
        addLog('info', `Consultando ${i + 1} / ${codigos.length} — ${codigo_ele}`)
      }

      try {
        // Consultar ENEL via extensión (desde contexto de la pestaña ENEL)
        const result = await consultarENELviaExtension(extensionId.trim(), codigo_ele, tokenCaptcha)

        if (!result?.ok) {
          const msg = result?.error || 'error desconocido'
          if (msg.includes('result_ko') || msg.toLowerCase().includes('ko')) {
            addLog('warn', `⚠️ Token expirado en código ${i + 1}. Proceso detenido.`)
            setFase('token_expirado')
            procesandoRef.current = false
            setProgreso({ procesados: i, exitosos, fallidos })
            setResultados(todosResultados)
            return
          }
          todosResultados.push({ idadmon, codigo_ele, status: 'error', mensaje: msg })
          fallidos++
        } else {
          const interpretado = interpretarRespuestaENEL(result.data)

          if (!interpretado.ok) {
            addLog('warn', `⚠️ Token expirado en código ${i + 1}. Proceso detenido.`)
            setFase('token_expirado')
            procesandoRef.current = false
            setProgreso({ procesados: i, exitosos, fallidos })
            setResultados(todosResultados)
            return
          }

          if (interpretado.raw) {
            addLog('warn', `Respuesta inesperada para ${codigo_ele}: ${interpretado.raw}`)
          }

          await guardarEnSupabase(supabase, mes, idadmon, idinmue, interpretado.deuda, interpretado.fecha)
          todosResultados.push({ idadmon, codigo_ele, status: 'ok', deuda: interpretado.deuda })
          exitosos++
        }
      } catch (e) {
        todosResultados.push({ idadmon, codigo_ele, status: 'error', mensaje: e.message })
        fallidos++
      }

      procesados++
      setProgreso({ procesados, exitosos, fallidos })
      setResultados([...todosResultados])

      await new Promise(r => setTimeout(r, 350))
    }

    addLog('ok', `✓ Completado: ${exitosos} exitosos, ${fallidos} fallidos de ${procesados} total`)
    setFase('completado')
    procesandoRef.current = false
  }

  // ─── Estilos ──────────────────────────────────────────────────────────────

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
    kpiRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' },
    kpi: { background: '#0f1117', border: '1px solid #2d3149', borderRadius: '6px', padding: '10px', textAlign: 'center' },
    kpiVal: { fontSize: '22px', fontWeight: '700', color: '#f1f5f9', lineHeight: 1 },
    kpiLabel: { fontSize: '10px', color: '#64748b', marginTop: '4px', letterSpacing: '0.05em' },
    btn: (color, disabled) => ({ width: '100%', padding: '11px', background: disabled ? '#1e2235' : color, color: disabled ? '#475569' : '#fff', border: 'none', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit', letterSpacing: '0.05em' }),
    progressBar: { background: '#0f1117', borderRadius: '4px', height: '6px', overflow: 'hidden' },
    progressFill: (pct) => ({ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #3b82f6, #06b6d4)', transition: 'width 0.3s', borderRadius: '4px' }),
    log: { background: '#0a0c14', border: '1px solid #2d3149', borderRadius: '6px', padding: '10px', maxHeight: '200px', overflowY: 'auto', fontSize: '11px', lineHeight: '1.7' },
    logLine: (tipo) => ({ color: tipo === 'error' ? '#f87171' : tipo === 'ok' ? '#4ade80' : tipo === 'warn' ? '#fbbf24' : '#94a3b8' }),
    input: { width: '100%', background: '#0f1117', border: '1px solid #3d4266', color: '#e2e8f0', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' },
    tokenInput: { width: '100%', background: '#0f1117', border: '1px solid #3d4266', color: '#e2e8f0', padding: '8px', borderRadius: '6px', fontSize: '11px', fontFamily: 'inherit', resize: 'vertical', minHeight: '60px', boxSizing: 'border-box', marginTop: '6px' },
    code: { background: '#0a0c14', border: '1px solid #2d3149', borderRadius: '4px', padding: '8px 10px', fontSize: '11px', color: '#06b6d4', fontFamily: 'inherit', display: 'block', marginTop: '6px', userSelect: 'all' },
    paso: { background: '#0f1117', border: '1px solid #2d3149', borderRadius: '6px', padding: '10px 12px', marginBottom: '8px' },
    pasoNum: { display: 'inline-block', background: '#3b82f6', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', textAlign: 'center', lineHeight: '18px', fontSize: '10px', fontWeight: '700', marginRight: '8px' },
    row: { display: 'flex', gap: '8px' },
  }

  const pct = totalCodigos > 0 ? Math.round((progreso.procesados / totalCodigos) * 100) : 0

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => router.push('/op/deudas')}>← Deudas</button>
        <h1 style={s.title}>⚡ CONSULTA MASIVA LUZ — ENEL</h1>
        {extensionOk && <span style={s.badge('#22c55e')}>EXTENSIÓN ✓</span>}
        {!extensionOk && <span style={s.badge('#ef4444')}>SIN EXTENSIÓN</span>}
        {fase === 'procesando' && <span style={s.badge('#3b82f6')}>EN PROCESO</span>}
        {fase === 'completado' && <span style={s.badge('#22c55e')}>COMPLETADO</span>}
        {fase === 'token_expirado' && <span style={s.badge('#f59e0b')}>TOKEN EXPIRADO</span>}
      </div>

      <div style={s.body}>

        {/* Mes */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Mes a procesar</div>
          <select style={s.select} value={mes} onChange={e => setMes(e.target.value)} disabled={fase === 'procesando'}>
            {MESES_DISPONIBLES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Progreso */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Progreso</div>
          <div style={s.kpiRow}>
            <div style={s.kpi}><div style={s.kpiVal}>{cargando ? '...' : totalCodigos}</div><div style={s.kpiLabel}>TOTAL</div></div>
            <div style={s.kpi}><div style={{ ...s.kpiVal, color: '#4ade80' }}>{progreso.exitosos}</div><div style={s.kpiLabel}>EXITOSOS</div></div>
            <div style={s.kpi}><div style={{ ...s.kpiVal, color: '#f87171' }}>{progreso.fallidos}</div><div style={s.kpiLabel}>FALLIDOS</div></div>
          </div>
          <div style={s.progressBar}><div style={s.progressFill(pct)} /></div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', textAlign: 'right' }}>{progreso.procesados} / {totalCodigos} ({pct}%)</div>
        </div>

        {/* Paso 0 — Extensión */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Paso 1 — Conectar extensión Chrome</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '10px', lineHeight: '1.6' }}>
            Instala la extensión <strong style={{ color: '#e2e8f0' }}>ENEL Bridge</strong> en Chrome (modo desarrollador).
            Luego copia su ID desde <code style={{ color: '#06b6d4' }}>chrome://extensions</code> y pégalo aquí:
          </div>
          <div style={s.row}>
            <input
              style={{ ...s.input, flex: 1 }}
              placeholder="ID de la extensión (ej: abcdefghijklmnopqrstuvwxyz123456)"
              value={extensionId}
              onChange={e => { setExtensionId(e.target.value); setExtensionOk(false) }}
            />
            <button style={{ ...s.btn('#3b82f6', false), width: 'auto', padding: '8px 16px' }} onClick={verificarExtension}>
              Verificar
            </button>
          </div>
          {extensionOk && <div style={{ fontSize: '12px', color: '#4ade80', marginTop: '8px' }}>✓ Extensión conectada</div>}
        </div>

        {/* Paso 1 — Token */}
        {(fase === 'idle' || fase === 'token_expirado') && extensionOk && (
          <div style={s.section}>
            <div style={s.sectionTitle}>
              {fase === 'token_expirado' ? '⚠️ Token expirado — obtener nuevo' : 'Paso 2 — Obtener token reCAPTCHA'}
            </div>

            <div style={s.paso}>
              <span style={s.pasoNum}>1</span>
              <a href="https://www.enel.cl/es/clientes/servicios-en-linea/pago-de-cuenta.html"
                target="_blank" rel="noreferrer"
                style={{ fontSize: '12px', color: '#3b82f6' }}>
                Abre el portal ENEL ↗
              </a>
            </div>

            <div style={s.paso}>
              <span style={s.pasoNum}>2</span>
              <span style={{ fontSize: '12px', color: '#e2e8f0' }}>Ingresa cualquier código de cliente y resuelve el reCAPTCHA ✓</span>
            </div>

            <div style={s.paso}>
              <span style={s.pasoNum}>3</span>
              <div style={{ fontSize: '12px', color: '#e2e8f0' }}>
                En DevTools → Console (escribe <code style={{ color: '#fbbf24' }}>allow pasting</code> → Enter si es la primera vez), luego:
                <code style={s.code}>copy(document.querySelector('textarea[name="g-recaptcha-response"]').value)</code>
              </div>
            </div>

            <div style={s.paso}>
              <span style={s.pasoNum}>4</span>
              <div style={{ fontSize: '12px', color: '#e2e8f0' }}>
                Pega el token aquí (Ctrl+V):
                <textarea
                  style={s.tokenInput}
                  placeholder="Pega aquí el token reCAPTCHA..."
                  onPaste={e => { setTimeout(() => pegarToken(e.target.value), 100) }}
                  onBlur={e => e.target.value && pegarToken(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Botón iniciar */}
        {fase === 'listo' && (
          <div style={s.section}>
            <div style={{ fontSize: '12px', color: '#4ade80', marginBottom: '12px' }}>
              ✓ Todo listo. La extensión ejecutará los {totalCodigos} fetches desde la pestaña ENEL.
            </div>
            <button style={s.btn('#22c55e', false)} onClick={iniciarConsulta}>
              ▶ Iniciar consulta masiva ({totalCodigos} códigos)
            </button>
          </div>
        )}

        {fase === 'procesando' && (
          <div style={s.section}>
            <div style={{ fontSize: '12px', color: '#3b82f6' }}>
              ⏳ Consultando via extensión... No cierres la pestaña ENEL ni esta pestaña.
            </div>
          </div>
        )}

        {fase === 'completado' && (
          <div style={s.section}>
            <div style={{ fontSize: '12px', color: '#4ade80', marginBottom: '12px' }}>
              ✓ {progreso.exitosos} registros actualizados en Supabase.
            </div>
            <div style={s.row}>
              <button style={{ ...s.btn('#3b82f6', false), flex: 1 }} onClick={() => { setFase('idle'); setTokenCaptcha(null); setProgreso({ procesados: 0, exitosos: 0, fallidos: 0 }); setResultados([]) }}>🔄 Nueva consulta</button>
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