// VERSION: v1 · 2026-08-27 · Registro rápido de gestión (constancia SIN email): llamada / WhatsApp / presencial → Bitácora
//   vía /api/cobranza/gestion (enviar:false). Reutilizable en Diferencias, Multas y Servicios. Todo queda en la Bitácora.
// Ruta real: app/components/ui/RegistroGestion.js
'use client'
import { useState } from 'react'

const DEST_LBL = { arrendatario: 'Arrendatario', aval: 'Aval', propietario: 'Propietario' }
const C = { txt: '#2C2C2A', sub: '#888780', line: '#D3D1C7', verde: '#085041', rojo: '#9B1C1C' }

export default function RegistroGestion({ idadmon, arrendatario, propietario, inmueble, rut, aval, rut_avalista, deuda = null, tipo = 'vigente', departamento = 'cobranza', onDone }) {
  const [party, setParty] = useState('arrendatario')
  const [nota, setNota] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const inp = { padding: '8px 10px', border: '1px solid ' + C.line, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
  const btn = { fontSize: 12.5, fontWeight: 700, padding: '7px 12px', borderRadius: 7, border: '1px solid ' + C.line, background: '#fff', color: C.txt, cursor: 'pointer' }

  async function registrar(canal) {
    if (!idadmon) { setMsg('Falta idadmon'); return }
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/cobranza/gestion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idadmon, tipo, departamento, canal,
          destinos: [{ party, email: null }],
          contenido: nota.trim() || ('Contacto por ' + canal),
          resultado: 'registrado',
          monto_adeudado: deuda ?? null, dias_mora: null,
          contrato: { propietario: propietario || null, inmueble: inmueble || null, arrendatario: arrendatario || null, rut: rut || null, avalista: aval || null, rut_avalista: rut_avalista || null },
          enviar: false,
        }),
      })
      const j = await r.json()
      if (j.error) { setMsg('⚠ ' + j.error); setBusy(false); return }
      setMsg('✓ ' + canal + ' registrada en la Bitácora'); setNota(''); setBusy(false)
      if (onDone) onDone()
    } catch (e) { setMsg('⚠ ' + String(e)); setBusy(false) }
  }

  return (
    <div style={{ background: '#FBFBF9', border: '1px solid ' + C.line, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 8 }}>Registrar gestión (constancia, sin email)</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <select value={party} onChange={e => setParty(e.target.value)} style={{ ...inp, width: 140 }}>
          {['arrendatario', 'aval', 'propietario'].map(d => <option key={d} value={d}>{DEST_LBL[d]}</option>)}
        </select>
        <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota (ej: llamé, no contesta / paga el viernes)" style={{ ...inp, flex: 1, minWidth: 160 }} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => registrar('llamada')} disabled={busy} style={btn}>☎ Llamada</button>
        <button onClick={() => registrar('whatsapp')} disabled={busy} style={btn}>WhatsApp</button>
        <button onClick={() => registrar('presencial')} disabled={busy} style={btn}>Presencial</button>
      </div>
      {msg && <div style={{ fontSize: 12.5, marginTop: 8, color: msg[0] === '✓' ? C.verde : C.rojo }}>{msg}</div>}
    </div>
  )
}
