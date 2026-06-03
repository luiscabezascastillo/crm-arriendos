'use client'
import { useState, useEffect } from 'react'
import TopNav from '@/app/components/ui/TopNav'

export default function EmailDeudoresPage() {
  const [umbral, setUmbral] = useState(180000)
  const [mes, setMes] = useState('MAYO 2026')
  const [deudores, setDeudores] = useState([])
  const [loading, setLoading] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [seleccionados, setSeleccionados] = useState([])
  const [resultado, setResultado] = useState(null)
  const [preview, setPreview] = useState(false)
  const [editAsunto, setEditAsunto] = useState('')
  const [editEmailDest, setEditEmailDest] = useState('')
  const [editIntro, setEditIntro] = useState('')
  const [editCierre, setEditCierre] = useState('')

  const MESES = ['OCTUBRE 2025','NOVIEMBRE 2025','DICIEMBRE 2025','ENERO 2026','FEBRERO 2026','MARZO 2026','ABRIL 2026','MAYO 2026']

  const textoIntroDefault = (d) => `Le informamos que registra una deuda pendiente en servicios basicos correspondiente al periodo ${mes}${d?.inmueble ? ` en la propiedad ${d.inmueble}` : ''}.`
  const textoCierreDefault = 'Le solicitamos regularizar esta situacion a la brevedad para evitar cobros adicionales o cortes de servicio. Para consultas puede responder este correo o comunicarse con nuestra oficina.'

  async function buscarDeudores() {
    setLoading(true)
    setDeudores([])
    setSeleccionados([])
    setResultado(null)
    setPreview(false)
    try {
      const res = await fetch(`/api/email-deudores/buscar?mes=${encodeURIComponent(mes)}&umbral=${umbral}`)
      const data = await res.json()
      setDeudores(data.deudores || [])
    } catch {
      alert('Error al buscar deudores')
    } finally {
      setLoading(false)
    }
  }

  function toggleSeleccion(idadmon) {
    setSeleccionados(prev =>
      prev.includes(idadmon) ? prev.filter(x => x !== idadmon) : [...prev, idadmon]
    )
  }

  function seleccionarTodos() {
    const conEmail = deudores.filter(d => d.mail_arrendatario).map(d => d.idadmon)
    setSeleccionados(seleccionados.length === conEmail.length ? [] : conEmail)
  }

  const deudoresSeleccionados = deudores.filter(d => seleccionados.includes(d.idadmon))
  const ej = deudoresSeleccionados[0]

  function abrirPreview() {
    setEditAsunto(`Aviso deuda servicios ${mes} — Fondo Capital`)
    setEditEmailDest(ej?.mail_arrendatario || '')
    setEditIntro(textoIntroDefault(ej))
    setEditCierre(textoCierreDefault)
    setPreview(true)
  }

  async function enviarEmails() {
    setEnviando(true)
    setPreview(false)
    setResultado(null)
    try {
      const res = await fetch('/api/email-deudores/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mes,
          asunto: editAsunto,
          textoCierre: editCierre,
          textoIntro: editIntro,
          emailOverride: seleccionados.length === 1 ? editEmailDest : null,
          deudores: deudoresSeleccionados
        })
      })
      const data = await res.json()
      setResultado(data)
    } catch {
      alert('Error al enviar emails')
    } finally {
      setEnviando(false)
    }
  }

  const conEmail = deudores.filter(d => d.mail_arrendatario)
  const sinEmail = deudores.filter(d => !d.mail_arrendatario)

  const DetalleServicios = ({ d }) => (
    <div style={{ borderTop: '1px solid #FCA5A5', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {d.ggcc > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}><span>🏢 Gastos comunes</span><span style={{ fontWeight: 600 }}>${Number(d.ggcc).toLocaleString('es-CL')}</span></div>}
      {d.luz  > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}><span>⚡ Electricidad</span><span style={{ fontWeight: 600 }}>${Number(d.luz).toLocaleString('es-CL')}</span></div>}
      {d.agua > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}><span>💧 Agua</span><span style={{ fontWeight: 600 }}>${Number(d.agua).toLocaleString('es-CL')}</span></div>}
      {d.gas  > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}><span>🔥 Gas</span><span style={{ fontWeight: 600 }}>${Number(d.gas).toLocaleString('es-CL')}</span></div>}
    </div>
  )

  const inputStyle = { width: '100%', border: '1px solid #BFDBFE', borderRadius: 6, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#EFF6FF', boxSizing: 'border-box' }
  const taStyle = { ...inputStyle, resize: 'vertical', minHeight: 70 }
  const labelStyle = { fontSize: 11, fontWeight: 600, color: '#1D4ED8', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <TopNav />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Operaciones</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Email grandes deudores</h1>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Notifica a arrendatarios cuya deuda total de servicios supera el umbral definido</div>
        </div>

        {/* Filtros */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 5 }}>Mes</label>
            <select value={mes} onChange={e => setMes(e.target.value)}
              style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
              {MESES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 5 }}>Umbral deuda (CLP)</label>
            <input type="number" value={umbral} onChange={e => setUmbral(Number(e.target.value))}
              style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', fontSize: 13, width: 150, fontFamily: 'inherit', outline: 'none' }}/>
          </div>
          <button onClick={buscarDeudores} disabled={loading}
            style={{ background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Buscando...' : 'Buscar deudores'}
          </button>
        </div>

        {/* Tabla */}
        {deudores.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>
                {deudores.length} deudores — {conEmail.length} con email, {sinEmail.length} sin email
              </div>
              <button onClick={seleccionarTodos}
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer', fontFamily: 'inherit' }}>
                {seleccionados.length === conEmail.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B7280', textAlign: 'left', width: 40 }}></th>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B7280', textAlign: 'left' }}>IDADMON</th>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B7280', textAlign: 'left' }}>Arrendatario</th>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B7280', textAlign: 'left' }}>Email</th>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6B7280', textAlign: 'right' }}>Deuda total</th>
                </tr>
              </thead>
              <tbody>
                {deudores.map((d) => (
                  <tr key={d.idadmon} style={{ borderTop: '1px solid #F3F4F6', background: seleccionados.includes(d.idadmon) ? '#EFF6FF' : 'transparent' }}>
                    <td style={{ padding: '10px 16px' }}>
                      {d.mail_arrendatario
                        ? <input type="checkbox" checked={seleccionados.includes(d.idadmon)} onChange={() => toggleSeleccion(d.idadmon)}/>
                        : <span style={{ fontSize: 12 }}>⚠️</span>}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#6B7280' }}>{d.idadmon}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#111827' }}>{d.arrendatario}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: d.mail_arrendatario ? '#1a56db' : '#D1D5DB' }}>
                      {d.mail_arrendatario || 'Sin email'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#DC2626', textAlign: 'right' }}>
                      ${Number(d.total).toLocaleString('es-CL')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Boton previsualizar */}
        {seleccionados.length > 0 && !preview && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, color: '#374151' }}><strong>{seleccionados.length}</strong> emails seleccionados</div>
            <button onClick={abrirPreview}
              style={{ background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              👁 Previsualizar email
            </button>
          </div>
        )}

        {/* Previsualizacion editable */}
        {preview && ej && (
          <div style={{ background: '#fff', border: '2px solid #1a56db', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EFF6FF' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>Vista previa — editable</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Los campos en azul son editables. Ejemplo: {ej.arrendatario}</div>
              </div>
              <button onClick={() => setPreview(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>x</button>
            </div>

            <div style={{ padding: 24 }}>

              {/* Campos editables encima */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, background: '#F0F7FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 16 }}>
                <div>
                  <label style={labelStyle}>Asunto</label>
                  <input value={editAsunto} onChange={e => setEditAsunto(e.target.value)} style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Email destino {seleccionados.length > 1 && <span style={{ fontWeight: 400, color: '#94A3B8' }}>(solo editable con 1 seleccionado)</span>}</label>
                  <input value={editEmailDest} onChange={e => setEditEmailDest(e.target.value)} disabled={seleccionados.length > 1}
                    style={{ ...inputStyle, opacity: seleccionados.length > 1 ? 0.5 : 1 }}/>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Texto introductorio</label>
                  <textarea value={editIntro} onChange={e => setEditIntro(e.target.value)} style={taStyle}/>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Texto de cierre</label>
                  <textarea value={editCierre} onChange={e => setEditCierre(e.target.value)} style={taStyle}/>
                </div>
              </div>

              {/* Preview email */}
              <div style={{ fontFamily: 'Arial, sans-serif', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#1a56db', padding: 24, textAlign: 'center' }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>FONDO CAPITAL</div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 }}>Administracion de Propiedades</div>
                </div>
                <div style={{ padding: 24, background: '#fff' }}>
                  <p style={{ fontSize: 15, color: '#111827' }}>Estimado/a <strong>{ej.arrendatario}</strong>,</p>
                  <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{editIntro}</p>
                  <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '16px 20px', margin: '20px 0' }}>
                    <div style={{ textAlign: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>DEUDA TOTAL SERVICIOS</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: '#DC2626' }}>${Number(ej.total).toLocaleString('es-CL')}</div>
                    </div>
                    <DetalleServicios d={ej} />
                  </div>
                  <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{editCierre}</p>
                  <p style={{ fontSize: 14, color: '#374151' }}>
                    Atentamente,<br/>
                    <strong>Fondo Capital — Area de Administracion</strong>
                  </p>
                </div>
                <div style={{ background: '#F9FAFB', padding: '16px 24px', textAlign: 'center', fontSize: 11, color: '#9CA3AF' }}>
                  Este es un mensaje automatico generado por el sistema CRM de Fondo Capital.
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setPreview(false)}
                style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Modificar seleccion
              </button>
              <button onClick={enviarEmails} disabled={enviando}
                style={{ background: enviando ? '#93C5FD' : '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 24px', fontSize: 13, fontWeight: 600, cursor: enviando ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {enviando ? 'Enviando...' : `Confirmar y enviar ${seleccionados.length} emails`}
              </button>
            </div>
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div style={{ background: resultado.errores > 0 ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${resultado.errores > 0 ? '#FCA5A5' : '#86EFAC'}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: resultado.errores > 0 ? '#DC2626' : '#16A34A', marginBottom: 8 }}>
              {resultado.enviados} emails enviados {resultado.errores > 0 ? `· ${resultado.errores} con error` : '✓'}
            </div>
            {resultado.detalle?.map((r, i) => (
              <div key={i} style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>
                {r.ok ? '✓' : '✗'} {r.email} — {r.nombre}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}