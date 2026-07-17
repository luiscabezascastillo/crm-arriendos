// VERSION: v1 · 2026-07-15 · app/direccion/reparar-inicios/page.js
//
// Herramienta de Dirección: reparar los inicios de un contrato que YA está en S y que se
// activó sin escribir cargos de inicio / sin enviar facturación. Dos pasos:
//   1) "Ver previo": muestra qué cargos escribiría, sin tocar nada.
//   2) "Confirmar y reparar": escribe los inicios y (opcional) reenvía el correo a Karina.
//
// El control de acceso REAL lo hace el endpoint (/api/cc1/reparar-inicios, allowlist de
// Dirección). Si un no-Dirección abre esta página, cada acción devuelve 403 y se muestra
// el aviso. Recomendación: enlazar esta ruta solo desde el panel /direccion.

'use client'

import { useState } from 'react'

const API = '/api/cc1/reparar-inicios'

const box = { maxWidth: 720, margin: '32px auto', padding: '0 16px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#222' }
const card = { border: '1px solid #d7d7d7', borderRadius: 8, padding: 16, marginTop: 16, background: '#fff' }
const label = { display: 'block', fontSize: 13, fontWeight: 600, margin: '10px 0 4px' }
const input = { padding: '8px 10px', fontSize: 14, border: '1px solid #bbb', borderRadius: 6, width: '100%', boxSizing: 'border-box' }
const btn = { padding: '9px 16px', fontSize: 14, fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer' }
const btnPrimary = { ...btn, background: '#2f6b33', color: '#fff' }
const btnGhost = { ...btn, background: '#eee', color: '#333' }
const money = (n) => (Number(n) || 0).toLocaleString('es-CL')

export default function RepararIniciosPage() {
  const [idadmon, setIdadmon] = useState('')
  const [tieneDicom, setTieneDicom] = useState(false)
  const [dicomMonto, setDicomMonto] = useState('')
  const [reenviar, setReenviar] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [previo, setPrevio] = useState(null)
  const [result, setResult] = useState(null)

  const dicomObj = { tiene: tieneDicom, monto: tieneDicom ? (Number(dicomMonto) || 0) : 0 }

  async function llamar(fase) {
    setLoading(true); setError(null)
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon: idadmon.trim(), fase, dicom: dicomObj, reenviarCorreo: reenviar }),
      })
      const j = await r.json()
      if (!r.ok) { setError(j.error || j.mensaje || `Error ${r.status}`); return null }
      return j
    } catch (e) {
      setError(String(e?.message || e)); return null
    } finally {
      setLoading(false)
    }
  }

  async function verPrevio() {
    setResult(null); setPrevio(null)
    if (!idadmon.trim()) { setError('Escribe un IDADMON.'); return }
    const j = await llamar('previo')
    if (j) setPrevio(j)
  }

  async function ejecutar() {
    const j = await llamar('ejecutar')
    if (j) { setResult(j); setPrevio(null) }
  }

  function reset() {
    setPrevio(null); setResult(null); setError(null)
  }

  return (
    <div style={box}>
      <h1 style={{ fontSize: 20, margin: 0 }}>Reparar inicios (Dirección)</h1>
      <p style={{ fontSize: 13, color: '#555', marginTop: 6 }}>
        Para contratos que ya están en <b>S</b> pero que se activaron sin escribir los cargos de
        inicio ni enviar la facturación. No cambia el estado. Si el contrato aún está en P, usa
        el flujo normal (CERRAR Y FACTURAR).
      </p>

      <div style={card}>
        <label style={label}>IDADMON (contrato en S)</label>
        <input style={input} value={idadmon} placeholder="A00832"
          onChange={e => { setIdadmon(e.target.value); reset() }} />

        <label style={{ ...label, marginTop: 14 }}>
          <input type="checkbox" checked={tieneDicom} onChange={e => { setTieneDicom(e.target.checked); reset() }} />
          {' '}El contrato lleva DICOM
        </label>
        {tieneDicom && (
          <input style={input} type="number" value={dicomMonto} placeholder="Monto DICOM (pesos)"
            onChange={e => { setDicomMonto(e.target.value); reset() }} />
        )}

        <label style={{ ...label, marginTop: 14 }}>
          <input type="checkbox" checked={reenviar} onChange={e => { setReenviar(e.target.checked); reset() }} />
          {' '}Reenviar el correo de facturación a Karina (Anthony en copia)
        </label>
        <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>
          Desmárcalo si este contrato ya recibió el correo en su día (para no duplicar).
        </p>

        <div style={{ marginTop: 16 }}>
          <button style={btnPrimary} disabled={loading} onClick={verPrevio}>
            {loading ? 'Cargando…' : 'Ver previo'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ ...card, borderColor: '#d99', background: '#fdeaea', color: '#a11' }}>
          <b>No se puede continuar:</b> {error}
        </div>
      )}

      {previo && (
        <div style={{ ...card, borderColor: '#9ec79f', background: '#f2f9f2' }}>
          <b>Previo — {previo.idadmon} (nada escrito todavía)</b>
          {previo.nLineas > 0 ? (
            <table style={{ borderCollapse: 'collapse', marginTop: 10, width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #cbe0cb' }}>Fecha</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #cbe0cb' }}>Concepto</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid #cbe0cb' }}>Cargo</th>
                </tr>
              </thead>
              <tbody>
                {previo.previo.map((f, i) => (
                  <tr key={i}>
                    <td style={{ padding: '3px 8px' }}>{f.fecha}</td>
                    <td style={{ padding: '3px 8px' }}>{f.concepto}</td>
                    <td style={{ padding: '3px 8px', textAlign: 'right' }}>{money(f.cargo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#a11', marginTop: 8 }}>{previo.mensaje}</p>
          )}

          <p style={{ fontSize: 13, marginTop: 12 }}>
            {previo.yaHayRentaDelMesInicio
              ? '· Ya hay renta del mes de inicio → no se cargará proporcional (correcto para un contrato ya activo).'
              : '· No se detectó renta del mes de inicio → se incluye el proporcional.'}
            <br />
            {previo.reenviaraCorreo
              ? `· Se reenviará el correo de facturación a ${previo.correoA} (CC ${previo.correoCC}).`
              : '· NO se reenviará correo de facturación.'}
            {previo.comision > 0
              ? ` Comisión a facturar: ${money(previo.comision)}.`
              : ' Este contrato es SIN comisión (el correo saldría con los importes de comisión en blanco).'}
          </p>

          {previo.nLineas > 0 && (
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button style={btnPrimary} disabled={loading} onClick={ejecutar}>
                {loading ? 'Reparando…' : 'Confirmar y reparar'}
              </button>
              <button style={btnGhost} disabled={loading} onClick={reset}>Cancelar</button>
            </div>
          )}
        </div>
      )}

      {result && (
        <div style={{ ...card, borderColor: '#9ec79f', background: '#eef7ee' }}>
          <b>Hecho — {result.idadmon}</b>
          <p style={{ fontSize: 13, marginTop: 8 }}>
            {Array.isArray(result.inicios)
              ? `Se escribieron ${result.inicios.length} línea(s) de inicio en cuentas.`
              : `⚠ No se pudieron escribir los inicios: ${result.inicios?.error || 'error desconocido'}`}
          </p>
          {result.correo?.intentado && (
            <p style={{ fontSize: 13, margin: 0, color: result.correo.ok ? '#1f5023' : '#a11' }}>
              {result.correo.ok
                ? `Correo de facturación reenviado a ${result.correo.to}. ✅`
                : `⚠ El correo NO se pudo enviar: ${result.correo.error || 'error desconocido'}. Queda registrado en el histórico.`}
            </p>
          )}
          {!result.correo?.intentado && (
            <p style={{ fontSize: 13, margin: 0, color: '#555' }}>No se reenvió correo (desmarcado).</p>
          )}
          <div style={{ marginTop: 14 }}>
            <button style={btnGhost} onClick={() => { setIdadmon(''); setTieneDicom(false); setDicomMonto(''); reset() }}>
              Reparar otro
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
