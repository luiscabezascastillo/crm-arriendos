// VERSION: v1 · 2026-08-27 · Recordatorio de servicios (GGCC/luz/agua/gas): email suave con ventana de confirmación,
//   CC (aval u otros), copia a administración y prueba a mí. Registra en Bitácora vía /api/cobranza/servicios.
// Ruta real: app/components/ui/RecordatorioServicios.js
'use client'
import { useState } from 'react'

const C = { txt: '#2C2C2A', sub: '#888780', line: '#D3D1C7', verde: '#085041', rojo: '#9B1C1C', acento: '#1D9E75', azul: '#1D4ED8', azulBg: '#EEF4FF' }
const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const P = (n) => '$' + Math.round(num(n)).toLocaleString('es-CL')

export default function RecordatorioServicios({ idadmon, propietario, inmueble, ggcc, luz, agua, gas }) {
  const [st, setSt] = useState(null)
  const total = num(ggcc) + num(luz) + num(agua) + num(gas)
  if (total <= 0) return null

  function plantilla(nombre, propiedad) {
    const partes = []
    if (num(ggcc) > 0) partes.push('gastos comunes ' + P(ggcc))
    if (num(luz) > 0) partes.push('electricidad ' + P(luz))
    if (num(agua) > 0) partes.push('agua ' + P(agua))
    if (num(gas) > 0) partes.push('gas ' + P(gas))
    const listado = partes.length ? partes.join(', ') : 'servicios'
    return {
      asunto: 'Servicios pendientes — ' + (propiedad || idadmon),
      cuerpo: 'Estimado/a ' + (nombre || '') + ':\n\n'
        + 'Le escribimos de Fondo Capital en relación con los servicios de ' + (propiedad || '') + '. '
        + 'Según nuestros registros hay saldos pendientes de pago: ' + listado + ' (total ' + P(total) + ').\n\n'
        + 'Le agradeceríamos ponerse al día con estos pagos lo antes posible. Mantener los servicios al día evita cortes y protege su garantía.\n\n'
        + 'Si ya realizó el pago o cree que hay un error, respóndanos a este correo y lo revisamos enseguida.\n\n'
        + 'Un cordial saludo,\nFondo Capital · Cobranzas',
    }
  }

  async function abrir() {
    setSt({ fase: 'cargando', busy: true, msg: '' })
    try {
      const r = await fetch('/api/cobranza/servicios?idadmon=' + encodeURIComponent(idadmon), { cache: 'no-store' })
      const j = await r.json()
      if (j.error) { setSt({ fase: 'error', msg: j.error }); return }
      const nombre = j.arrendatario || ''
      const propiedad = inmueble || j.inmueble || ''
      const pl = plantilla(nombre, propiedad)
      setSt({ fase: 'compose', email: j.mail_arrendatario || '', arrendatario: nombre, aval: j.avalista || '', aval_mail: j.mail_avalista || '', asunto: pl.asunto, cuerpo: pl.cuerpo, cc: '', busy: false, msg: '' })
    } catch (e) { setSt({ fase: 'error', msg: String(e) }) }
  }

  async function enviar(test) {
    const s = st; setSt({ ...s, busy: true, msg: '' })
    try {
      const r = await fetch('/api/cobranza/servicios', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accion: 'enviar', idadmon, asunto: s.asunto, contenido: s.cuerpo, destino_email: s.email, cc: s.cc || '', monto: total, test }) })
      const j = await r.json()
      if (j.error) { setSt({ ...s, busy: false, msg: '⚠ ' + j.error }); return }
      if (test) { setSt({ ...s, busy: false, msg: '✓ Prueba enviada a ti.' }); return }
      setSt({ ...s, busy: false, fase: 'ok', msg: '✓ Recordatorio enviado y registrado en la Bitácora.' })
    } catch (e) { setSt({ ...s, busy: false, msg: '⚠ ' + String(e) }) }
  }

  const inp = { width: '100%', padding: '8px 10px', border: '1px solid ' + C.line, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
  const cerrar = () => setSt(null)

  return (
    <>
      <button onClick={abrir} style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid ' + C.acento, background: '#E9F4E4', color: C.verde, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>✉ Enviar recordatorio de servicios…</button>

      {st && st.fase !== 'ok' && st.fase !== 'error' && (
        <div onClick={() => !st.busy && cerrar()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,0.3)', width: 'min(600px,96vw)', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            {st.fase === 'cargando' ? <div style={{ color: C.sub, fontSize: 13, padding: 20 }}>Cargando datos del contrato…</div> : st.fase === 'compose' ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>Recordatorio de servicios · {idadmon}</div>
                <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 14 }}>{st.arrendatario} · deuda de servicios {P(total)}</div>
                <div style={{ marginBottom: 8 }}><div style={{ fontSize: 11.5, color: C.sub, marginBottom: 3 }}>Email del arrendatario</div><input value={st.email} onChange={e => setSt({ ...st, email: e.target.value })} style={inp} /></div>
                <div style={{ marginBottom: 8 }}><div style={{ fontSize: 11.5, color: C.sub, marginBottom: 3 }}>Asunto</div><input value={st.asunto} onChange={e => setSt({ ...st, asunto: e.target.value })} style={inp} /></div>
                <div style={{ marginBottom: 8 }}><div style={{ fontSize: 11.5, color: C.sub, marginBottom: 3 }}>Cuerpo</div><textarea value={st.cuerpo} onChange={e => setSt({ ...st, cuerpo: e.target.value })} rows={10} style={{ ...inp, lineHeight: 1.5, resize: 'vertical' }} /></div>
                {st.msg && <div style={{ fontSize: 12.5, color: st.msg[0] === '✓' ? C.verde : C.rojo, marginBottom: 8 }}>{st.msg}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 6 }}>
                  <button disabled={st.busy} onClick={cerrar} style={{ fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 8, border: '1px solid ' + C.line, background: '#fff', color: C.sub, cursor: 'pointer' }}>Cancelar</button>
                  <button disabled={st.busy} onClick={() => setSt({ ...st, fase: 'confirm', msg: '' })} style={{ fontSize: 12.5, fontWeight: 800, padding: '8px 16px', borderRadius: 8, border: 'none', background: C.acento, color: '#fff', cursor: 'pointer' }}>Revisar y enviar…</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>Revisa antes de enviar</div>
                <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 14 }}>Este correo va a salir de verdad al arrendatario. Compruébalo, añade copias si quieres, y confirma.</div>
                <div style={{ display: 'grid', gap: 8, fontSize: 12.5 }}>
                  <div><span style={{ color: C.sub }}>Para:</span> <b>{st.email || '—'}</b></div>
                  <div><div style={{ color: C.sub, marginBottom: 3 }}>Con copia (CC · opcional — aval u otros, separa por comas)</div>
                    <input value={st.cc} onChange={e => setSt({ ...st, cc: e.target.value })} placeholder={st.aval ? ('aval: ' + (st.aval_mail || st.aval)) : 'correo@ejemplo.com, otro@ejemplo.com'} style={inp} /></div>
                  <div><span style={{ color: C.sub }}>Asunto:</span> <b>{st.asunto}</b></div>
                  <div><div style={{ color: C.sub, marginBottom: 3 }}>Cuerpo</div>
                    <div style={{ background: '#F7F6F1', border: '1px solid ' + C.line, borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 220, overflowY: 'auto' }}>{st.cuerpo}</div></div>
                  <div style={{ fontSize: 11.5, color: C.sub }}>Se envía una copia oculta a administración@fondocapital.com.</div>
                </div>
                {st.msg && <div style={{ fontSize: 12.5, color: st.msg[0] === '✓' ? C.verde : C.rojo, marginTop: 10 }}>{st.msg}</div>}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}>
                  <button disabled={st.busy} onClick={() => setSt({ ...st, fase: 'compose', msg: '' })} style={{ fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 8, border: '1px solid ' + C.line, background: '#fff', color: C.sub, cursor: 'pointer', marginRight: 'auto' }}>Volver a editar</button>
                  <button disabled={st.busy} onClick={() => enviar(true)} style={{ fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 8, border: '1px solid #CFE0FF', background: C.azulBg, color: C.azul, cursor: 'pointer' }}>{st.busy ? 'Enviando…' : 'Enviar prueba a mí'}</button>
                  <button disabled={st.busy} onClick={() => enviar(false)} style={{ fontSize: 12.5, fontWeight: 800, padding: '8px 16px', borderRadius: 8, border: 'none', background: C.acento, color: '#fff', cursor: 'pointer' }}>{st.busy ? 'Enviando…' : 'Confirmar y enviar'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {st && (st.fase === 'ok' || st.fase === 'error') && (
        <div onClick={cerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,0.3)', width: 'min(420px,92vw)', padding: 22, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: st.fase === 'ok' ? C.verde : C.rojo, marginBottom: 14 }}>{st.msg || (st.fase === 'ok' ? 'Enviado.' : 'Error.')}</div>
            <button onClick={cerrar} style={{ fontSize: 12.5, fontWeight: 800, padding: '8px 18px', borderRadius: 8, border: 'none', background: C.acento, color: '#fff', cursor: 'pointer' }}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  )
}
