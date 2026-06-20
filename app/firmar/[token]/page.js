'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
// Valida RUT chileno (formato + dígito verificador, módulo 11).
function validarRut(valor) {
  if (!valor) return false
  const limpio = String(valor).replace(/[.\-\s]/g, '').toUpperCase()
  if (limpio.length < 2) return false
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  if (!/^\d+$/.test(cuerpo)) return false
  let suma = 0, mul = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const resto = 11 - (suma % 11)
  const dvEsperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)
  return dv === dvEsperado
}

export default function FirmarPage() {
  const { token } = useParams()
  const [orden, setOrden] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [nombre, setNombre] = useState('')
  const [rut, setRut] = useState('')
  const [domicilio, setDomicilio] = useState('')
  const [comuna, setComuna] = useState('')
  const [extranjero, setExtranjero] = useState(false)
  const [acepta, setAcepta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(null)   // { pdf_url } cuando queda firmada
  const [error, setError] = useState(null)

  const canvasRef = useRef(null)
  const dibujando = useRef(false)
  const huboTrazo = useRef(false)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('ordenes_visita').select('*').eq('token', token).maybeSingle()
      setOrden(data || null)
      if (data?.cliente_nombre) setNombre(data.cliente_nombre)
      if (data?.estado === 'firmada') setListo({ pdf_url: data.pdf_url })
      setCargando(false)
    })()
  }, [token])

  // configurar canvas
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ratio = window.devicePixelRatio || 1
    const w = c.clientWidth
    const h = 200
    c.width = w * ratio
    c.height = h * ratio
    const ctx = c.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#10183a'
  }, [orden])

  function pos(e) {
    const c = canvasRef.current
    const r = c.getBoundingClientRect()
    const t = e.touches ? e.touches[0] : e
    return { x: t.clientX - r.left, y: t.clientY - r.top }
  }
  function start(e) { e.preventDefault(); dibujando.current = true; const ctx = canvasRef.current.getContext('2d'); const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
  function move(e) { if (!dibujando.current) return; e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); huboTrazo.current = true }
  function end() { dibujando.current = false }
  function limpiar() {
    const c = canvasRef.current; const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height); huboTrazo.current = false
  }

  async function firmar() {
    setError(null)
    if (!nombre.trim() || !rut.trim()) { setError(extranjero ? 'Completa tu nombre y número de documento.' : 'Completa tu nombre y RUT.'); return }
    if (!extranjero && !validarRut(rut)) { setError('El RUT no parece válido. Revísalo, o marca "Firmante extranjero" si usas pasaporte u otro documento.'); return }
    if (!huboTrazo.current) { setError('Dibuja tu firma en el recuadro.'); return }
    if (!acepta) { setError('Debes aceptar las condiciones.'); return }
    setEnviando(true)
    try {
      const firma_png = canvasRef.current.toDataURL('image/png')
      const res = await fetch('/api/ordenes/firmar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, firmante_nombre: nombre.trim(), firmante_rut: rut.trim(), firmante_domicilio: domicilio.trim(), firmante_comuna: comuna.trim(), firmante_doc_tipo: extranjero ? 'extranjero' : 'rut', firma_png }),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error || 'No se pudo firmar.'); setEnviando(false); return }
      setListo({ pdf_url: j.pdf_url })
    } catch (e) {
      setError('Error de conexion: ' + e.message)
    }
    setEnviando(false)
  }

  const wrap = { maxWidth: 640, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", system-ui, sans-serif', color: '#10183a' }
  const card = { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, padding: 20, marginBottom: 16 }
  const input = { padding: '10px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 14, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }
  const label = { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4, display: 'block' }

  if (cargando) return <div style={{ ...wrap, color: '#888' }}>Cargando orden…</div>
  if (!orden) return <div style={wrap}><div style={card}>Enlace inválido o la orden no existe.</div></div>

  if (listo) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>¡Orden firmada!</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 18 }}>Gracias. Tu orden de visita quedó firmada y registrada.</div>
          {listo.pdf_url && <a href={listo.pdf_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 8, background: '#0C447C', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Descargar PDF firmado</a>}
        </div>
      </div>
    )
  }

  const props = orden.propiedades || []
  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 2px' }}>Orden de visita N° {orden.id}</h1>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Fondo Capital Rent Spa · Ebro 2791, of. 1B y 1C, Las Condes</div>

      <div style={card}>
        <div style={{ fontSize: 13, marginBottom: 8 }}><b>Cliente:</b> {orden.cliente_nombre || '—'}{orden.cliente_telefono ? ' · ' + orden.cliente_telefono : ''}</div>
        {orden.fecha && <div style={{ fontSize: 13, marginBottom: 8 }}><b>Visita:</b> {orden.fecha}{orden.hora ? ' ' + String(orden.hora).slice(0, 5) : ''}{orden.comercial ? ' · ' + orden.comercial : ''}</div>}
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10, marginBottom: 4 }}>Propiedades a visitar</div>
        {props.length ? props.map((p, i) => (
          <div key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 2 }}>
            {i + 1}. {[p.operacion, p.tipo].filter(Boolean).join(' · ')} — {p.direccion}{p.comuna ? ', ' + p.comuna : ''}{p.valor ? ' · ' + (p.moneda || '') + ' ' + Number(p.valor).toLocaleString('es-CL') : ''}
          </div>
        )) : <div style={{ fontSize: 13, color: '#9ca3af' }}>—</div>}
        {orden.pdf_url && <div style={{ marginTop: 12 }}><a href={orden.pdf_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#0C447C', fontWeight: 600 }}>Ver documento completo con las condiciones (PDF) →</a></div>}
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Firmar</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
          <div><label style={label}>Nombre completo</label><input style={input} value={nombre} onChange={e => setNombre(e.target.value)} /></div>
          <div>
            <label style={label}>{extranjero ? 'Documento / Pasaporte' : 'RUT'}</label>
            <input style={input} value={rut} onChange={e => setRut(e.target.value)} placeholder={extranjero ? 'Pasaporte / DNI' : '12.345.678-9'} />
            {!extranjero && rut.trim() !== '' && (
              <div style={{ fontSize: 11, marginTop: 4, color: validarRut(rut) ? '#16a34a' : '#dc2626' }}>
                {validarRut(rut) ? '✓ RUT válido' : '✕ RUT no válido (revisa el dígito verificador)'}
              </div>
            )}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#555', marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={extranjero} onChange={e => setExtranjero(e.target.checked)} />
          Firmante extranjero (sin RUT chileno — uso pasaporte u otro documento)
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 12 }}>
          <div><label style={label}>Domicilio</label><input style={input} value={domicilio} onChange={e => setDomicilio(e.target.value)} placeholder="Calle 123, depto 4" /></div>
          <div><label style={label}>Comuna</label><input style={input} value={comuna} onChange={e => setComuna(e.target.value)} placeholder="Las Condes" /></div>
        </div>

        <label style={label}>Tu firma</label>
        <div style={{ position: 'relative', border: '1px dashed #C9C7C0', borderRadius: 10, background: '#FBFBF9', touchAction: 'none' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: 200, display: 'block', borderRadius: 10 }}
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end}
          />
          <button onClick={limpiar} style={{ position: 'absolute', top: 8, right: 8, fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Limpiar</button>
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, marginBottom: 14 }}>Dibuja tu firma con el dedo o el mouse dentro del recuadro.</div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151', marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} style={{ marginTop: 2 }} />
          <span>Declaro haber leído y acepto íntegramente las condiciones de esta orden de visita. Firma electrónica simple (Ley 19.799).</span>
        </label>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button onClick={firmar} disabled={enviando} style={{ width: '100%', padding: '13px', borderRadius: 10, background: '#0C447C', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: enviando ? 0.6 : 1, fontFamily: 'inherit' }}>
          {enviando ? 'Firmando…' : 'Firmar orden de visita'}
        </button>
      </div>
    </div>
  )
}
