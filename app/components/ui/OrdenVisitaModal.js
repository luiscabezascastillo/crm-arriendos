'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useSession } from 'next-auth/react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const CLAUSULA = `"Fondo Capital Rent SpA", denominado el CORREDOR, autoriza al CLIENTE indicado a visitar las propiedades señaladas. La información entregada es confidencial y de uso exclusivo para continuar el negocio por intermediación de este corredor. El CLIENTE se obliga a efectuar toda transacción de las propiedades ofrecidas por intermedio de Fondo Capital Rent SpA, pagando la comisión correspondiente: a) Compraventa: 2% + IVA del valor de transacción. b) Arriendo: 50% + IVA de la primera renta mensual. c) Si el negocio se efectúa directamente con el propietario, el CLIENTE pagará a título de multa el doble de la comisión normal más impuestos y costas. El CLIENTE declara haber recibido esta orden en las oficinas de Fondo Capital Rent SpA, Ebro 2791 Oficina 1B y C, Las Condes.`

export default function OrdenVisitaModal({ contacto, propiedadesIniciales = [], onClose, onCreated }) {
  const { data: session } = useSession()
  const [step, setStep] = useState(1) // 1: seleccionar props, 2: preview, 3: enviado
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState(propiedadesIniciales)
  const [contactoBuscado, setContactoBuscado] = useState(contacto || null)
  const [busqContacto, setBusqContacto] = useState('')
  const [resContactos, setResContactos] = useState([])
  const [creando, setCreando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [ovCreada, setOvCreada] = useState(null)
  const [error, setError] = useState(null)
  const [notas, setNotas] = useState('')

  // Si no hay contacto inicial, mostrar búsqueda de contacto primero
  const needsContacto = !contacto

  useEffect(() => {
    if (!busqueda.trim()) { setResultados([]); return }
    setBuscando(true)
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('publicaciones')
        .select('id, codigo, direccion, comuna, objetivo, tipo, valor, tipo_moneda, dormitorios, banos, imagen1')
        .eq('activo', 'active')
        .or(`direccion.ilike.%${busqueda}%,codigo.ilike.%${busqueda}%,comuna.ilike.%${busqueda}%`)
        .limit(8)
      setResultados(data || [])
      setBuscando(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [busqueda])

  useEffect(() => {
    if (!busqContacto.trim() || contacto) { setResContactos([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('contactos')
        .select('id, nombre, apellido, numero_doc, email, telefono')
        .eq('activo', true)
        .or(`nombre.ilike.%${busqContacto}%,apellido.ilike.%${busqContacto}%,numero_doc.ilike.%${busqContacto}%`)
        .limit(6)
      setResContactos(data || [])
    }, 400)
    return () => clearTimeout(timer)
  }, [busqContacto])

  function toggleProp(p) {
    setSeleccionadas(s => s.find(x => x.id === p.id) ? s.filter(x => x.id !== p.id) : [...s, p])
  }

  function formatPrecio(p) {
    return p.tipo_moneda === 'UF'
      ? 'UF ' + Number(p.valor).toLocaleString('es-CL')
      : '$' + Number(p.valor).toLocaleString('es-CL')
  }

  function formatCaract(p) {
    const parts = []
    if (p.dormitorios) parts.push(p.dormitorios + ' dorm.')
    if (p.banos) parts.push(p.banos + ' baños')
    return parts.join(', ') || p.tipo || ''
  }

  async function crearOV() {
    if (!contactoBuscado) { setError('Selecciona un contacto'); return }
    if (seleccionadas.length === 0) { setError('Selecciona al menos una propiedad'); return }
    setCreando(true); setError(null)

    const res = await fetch('/api/ordenes-visita/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contacto_id: contactoBuscado.id,
        contacto_nombre: contactoBuscado.nombre + ' ' + (contactoBuscado.apellido || ''),
        contacto_rut: contactoBuscado.numero_doc,
        contacto_email: contactoBuscado.email,
        contacto_tel: contactoBuscado.telefono,
        propiedades: seleccionadas.map(p => ({
          id: p.id, codigo: p.codigo, direccion: p.direccion,
          comuna: p.comuna, objetivo: p.objetivo, tipo: p.tipo,
          valor: p.valor, tipo_moneda: p.tipo_moneda,
          dormitorios: p.dormitorios, banos: p.banos,
        })),
        comercial: session?.user?.name || session?.user?.email?.split('@')[0] || 'Ejecutivo',
        comercial_email: session?.user?.email,
        notas,
      }),
    })
    const data = await res.json()
    if (data.error) { setError(data.error); setCreando(false); return }
    setOvCreada(data.ov)
    setStep(2)
    setCreando(false)
  }

  async function generarYEnviarPDF() {
    setEnviando(true); setError(null)
    try {
      // Generar PDF en el cliente con jsPDF
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const numeroOV = 'OV-' + String(ovCreada.numero).padStart(4, '0')
      const W = 210, margin = 18

      // Header
      doc.setFillColor(26, 26, 46)
      doc.rect(0, 0, W, 28, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('FONDO CAPITAL RENT SpA', margin, 12)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Corredor de Propiedades · Ebro 2791 Of. 1B y C, Las Condes', margin, 20)
      doc.text(numeroOV, W - margin, 12, { align: 'right' })
      doc.text(new Date().toLocaleDateString('es-CL'), W - margin, 20, { align: 'right' })

      // Título
      doc.setTextColor(26, 26, 46)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('ORDEN DE VISITA', W / 2, 38, { align: 'center' })

      // Datos cliente
      doc.setFillColor(240, 238, 232)
      doc.rect(margin, 43, W - margin * 2, 26, 'F')
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 100, 100)
      doc.text('DATOS DEL CLIENTE', margin + 3, 50)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(26, 26, 46)
      doc.setFontSize(10)
      doc.text('Nombre: ' + ovCreada.contacto_nombre, margin + 3, 57)
      doc.text('RUT: ' + (ovCreada.contacto_rut || '—'), margin + 3, 63)
      doc.text('Email: ' + (ovCreada.contacto_email || '—'), W / 2, 57)
      doc.text('Teléfono: ' + (ovCreada.contacto_tel || '—'), W / 2, 63)

      // Tabla propiedades
      let y = 78
      doc.setFillColor(26, 26, 46)
      doc.rect(margin, y - 5, W - margin * 2, 7, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('TIPO', margin + 2, y)
      doc.text('DIRECCIÓN / COMUNA', margin + 22, y)
      doc.text('CARACTERÍSTICAS', margin + 110, y)
      doc.text('PRECIO', W - margin - 2, y, { align: 'right' })

      y += 5
      doc.setTextColor(26, 26, 46)
      doc.setFont('helvetica', 'normal')
      ovCreada.propiedades.forEach((p, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(248, 247, 244)
          doc.rect(margin, y - 4, W - margin * 2, 10, 'F')
        }
        doc.setFontSize(9)
        doc.text((p.objetivo || p.tipo || '').substring(0, 10), margin + 2, y + 2)
        doc.text((p.direccion || '').substring(0, 40), margin + 22, y)
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.text((p.comuna || ''), margin + 22, y + 5)
        doc.setTextColor(26, 26, 46)
        doc.setFontSize(9)
        const caract = formatCaract(p)
        doc.text(caract.substring(0, 28), margin + 110, y + 2)
        doc.text(formatPrecio(p), W - margin - 2, y + 2, { align: 'right' })
        y += 11
      })

      // Cláusula
      y += 6
      doc.setFillColor(240, 238, 232)
      doc.rect(margin, y, W - margin * 2, 3, 'F')
      y += 7
      doc.setFontSize(7.5)
      doc.setTextColor(80, 80, 80)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(CLAUSULA, W - margin * 2)
      doc.text(lines, margin, y)
      y += lines.length * 3.5 + 10

      // Firmas
      if (y > 240) y = 240
      doc.setDrawColor(180, 180, 180)
      doc.line(margin, y, margin + 60, y)
      doc.line(W - margin - 60, y, W - margin, y)
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text('Firma Cliente', margin + 30, y + 5, { align: 'center' })
      doc.text('Firma Corredor', W - margin - 30, y + 5, { align: 'center' })
      doc.text(ovCreada.contacto_nombre || '', margin + 30, y + 10, { align: 'center' })
      doc.text(ovCreada.comercial || 'Ejecutivo', W - margin - 30, y + 10, { align: 'center' })

      // Footer
      doc.setFillColor(26, 26, 46)
      doc.rect(0, 285, W, 12, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(8)
      doc.text('Fondo Capital Rent SpA · www.fondocapital.com · info@fondocapital.com', W / 2, 292, { align: 'center' })

      const pdfBase64 = doc.output('datauristring').split(',')[1]

      // Enviar email
      const emailRes = await fetch('/api/ordenes-visita/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ov_id: ovCreada.id, pdf_base64: pdfBase64 }),
      })
      const emailData = await emailRes.json()
      if (emailData.error) {
        setError('PDF generado pero error al enviar: ' + emailData.error)
        setEnviando(false)
        // Igual mostrar el PDF para descarga
        doc.save(numeroOV + '.pdf')
        return
      }

      // Descargar PDF también
      doc.save(numeroOV + '.pdf')
      setStep(3)
    } catch (err) {
      setError('Error: ' + err.message)
    }
    setEnviando(false)
  }

  async function soloDescargarPDF() {
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const numeroOV = 'OV-' + String(ovCreada.numero).padStart(4, '0')
      const W = 210, margin = 18

      doc.setFillColor(26, 26, 46)
      doc.rect(0, 0, W, 28, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('FONDO CAPITAL RENT SpA', margin, 12)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Corredor de Propiedades · Ebro 2791 Of. 1B y C, Las Condes', margin, 20)
      doc.text(numeroOV, W - margin, 12, { align: 'right' })
      doc.text(new Date().toLocaleDateString('es-CL'), W - margin, 20, { align: 'right' })

      doc.setTextColor(26, 26, 46)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('ORDEN DE VISITA', W / 2, 38, { align: 'center' })

      doc.setFillColor(240, 238, 232)
      doc.rect(margin, 43, W - margin * 2, 26, 'F')
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 100, 100)
      doc.text('DATOS DEL CLIENTE', margin + 3, 50)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(26, 26, 46)
      doc.setFontSize(10)
      doc.text('Nombre: ' + ovCreada.contacto_nombre, margin + 3, 57)
      doc.text('RUT: ' + (ovCreada.contacto_rut || '—'), margin + 3, 63)
      doc.text('Email: ' + (ovCreada.contacto_email || '—'), W / 2, 57)
      doc.text('Teléfono: ' + (ovCreada.contacto_tel || '—'), W / 2, 63)

      let y = 78
      doc.setFillColor(26, 26, 46)
      doc.rect(margin, y - 5, W - margin * 2, 7, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('TIPO', margin + 2, y)
      doc.text('DIRECCIÓN / COMUNA', margin + 22, y)
      doc.text('CARACTERÍSTICAS', margin + 110, y)
      doc.text('PRECIO', W - margin - 2, y, { align: 'right' })

      y += 5
      doc.setTextColor(26, 26, 46)
      doc.setFont('helvetica', 'normal')
      ovCreada.propiedades.forEach((p, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(248, 247, 244)
          doc.rect(margin, y - 4, W - margin * 2, 10, 'F')
        }
        doc.setFontSize(9)
        doc.text((p.objetivo || p.tipo || '').substring(0, 10), margin + 2, y + 2)
        doc.text((p.direccion || '').substring(0, 40), margin + 22, y)
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.text((p.comuna || ''), margin + 22, y + 5)
        doc.setTextColor(26, 26, 46)
        doc.setFontSize(9)
        const caract = formatCaract(p)
        doc.text(caract.substring(0, 28), margin + 110, y + 2)
        doc.text(formatPrecio(p), W - margin - 2, y + 2, { align: 'right' })
        y += 11
      })

      y += 6
      doc.setFillColor(240, 238, 232)
      doc.rect(margin, y, W - margin * 2, 3, 'F')
      y += 7
      doc.setFontSize(7.5)
      doc.setTextColor(80, 80, 80)
      const lines = doc.splitTextToSize(CLAUSULA, W - margin * 2)
      doc.text(lines, margin, y)
      y += lines.length * 3.5 + 10

      if (y > 240) y = 240
      doc.setDrawColor(180, 180, 180)
      doc.line(margin, y, margin + 60, y)
      doc.line(W - margin - 60, y, W - margin, y)
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text('Firma Cliente', margin + 30, y + 5, { align: 'center' })
      doc.text('Firma Corredor', W - margin - 30, y + 5, { align: 'center' })
      doc.text(ovCreada.contacto_nombre || '', margin + 30, y + 10, { align: 'center' })
      doc.text(ovCreada.comercial || 'Ejecutivo', W - margin - 30, y + 10, { align: 'center' })

      doc.setFillColor(26, 26, 46)
      doc.rect(0, 285, W, 12, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(8)
      doc.text('Fondo Capital Rent SpA · www.fondocapital.com · info@fondocapital.com', W / 2, 292, { align: 'center' })

      doc.save(numeroOV + '.pdf')
    } catch (err) {
      setError('Error generando PDF: ' + err.message)
    }
  }

  const inp = { width: '100%', padding: '7px 10px', border: '1px solid #E0DDD8', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, width: 700, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', fontFamily: '"DM Sans","Segoe UI",sans-serif' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0EEE8', background: '#1a1a2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '12px 12px 0 0' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Nueva Orden de Visita</div>
            {ovCreada && <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>OV-{String(ovCreada.numero).padStart(4, '0')}</div>}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa' }}>×</button>
        </div>

        <div style={{ padding: '20px 24px' }}>

          {/* STEP 1: Configurar OV */}
          {step === 1 && (
            <>
              {/* Contacto */}
              {needsContacto ? (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Cliente</div>
                  {contactoBuscado ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#E6F1FB', borderRadius: 8, border: '1px solid #B5D4F4' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{contactoBuscado.nombre} {contactoBuscado.apellido || ''}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{contactoBuscado.numero_doc} · {contactoBuscado.email}</div>
                      </div>
                      <button onClick={() => setContactoBuscado(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#aaa', fontSize: 18 }}>×</button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input style={inp} value={busqContacto} onChange={e => setBusqContacto(e.target.value)} placeholder="Buscar contacto por nombre o RUT..." />
                      {resContactos.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E0DDD8', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, marginTop: 4 }}>
                          {resContactos.map(c => (
                            <div key={c.id} onClick={() => { setContactoBuscado(c); setBusqContacto(''); setResContactos([]) }}
                              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F5F3EF', fontSize: 13 }}
                              onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                              onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                              <div style={{ fontWeight: 600 }}>{c.nombre} {c.apellido || ''}</div>
                              <div style={{ fontSize: 11, color: '#aaa' }}>{c.numero_doc} · {c.email}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#E6F1FB', borderRadius: 8, border: '1px solid #B5D4F4' }}>
                  <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{contacto.nombre} {contacto.apellido || ''}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{contacto.numero_doc} · {contacto.email}</div>
                </div>
              )}

              {/* Búsqueda propiedades */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Agregar propiedades</div>
                <input style={inp} value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por dirección, código, comuna..." />
              </div>

              {/* Resultados búsqueda */}
              {buscando && <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>Buscando...</div>}
              {resultados.length > 0 && (
                <div style={{ border: '1px solid #E0DDD8', borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
                  {resultados.map(p => {
                    const sel = seleccionadas.find(x => x.id === p.id)
                    return (
                      <div key={p.id} onClick={() => toggleProp(p)} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        cursor: 'pointer', borderBottom: '1px solid #F5F3EF',
                        background: sel ? '#E6F1FB' : '#fff',
                      }}
                        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = '#FAFAF8' }}
                        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = '#fff' }}>
                        <input type="checkbox" readOnly checked={!!sel} style={{ margin: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{p.codigo} · {p.direccion}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>{p.comuna} · {p.objetivo} · {formatPrecio(p)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Propiedades seleccionadas */}
              {seleccionadas.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                    Propiedades seleccionadas ({seleccionadas.length})
                  </div>
                  {seleccionadas.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#FAFAF8', borderRadius: 6, marginBottom: 4, border: '1px solid #E8E6E0' }}>
                      <span style={{ fontSize: 11, color: '#888', minWidth: 20 }}>{i + 1}.</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{p.codigo} · {p.direccion}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>{p.objetivo} · {formatPrecio(p)} · {formatCaract(p)}</div>
                      </div>
                      <button onClick={() => toggleProp(p)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#E8593C', fontSize: 16 }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Notas internas (opcional)</div>
                <textarea style={{ ...inp, height: 52, resize: 'none' }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones sobre esta visita..." />
              </div>

              {error && <div style={{ color: '#E8593C', fontSize: 12, marginBottom: 12 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #E0DDD8', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#666' }}>Cancelar</button>
                <button onClick={crearOV} disabled={creando || seleccionadas.length === 0} style={{
                  padding: '9px 24px', borderRadius: 8, border: 'none',
                  background: creando || seleccionadas.length === 0 ? '#9ca3af' : '#1a1a2e',
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: seleccionadas.length === 0 ? 'not-allowed' : 'pointer'
                }}>
                  {creando ? 'Creando...' : 'Crear Orden de Visita →'}
                </button>
              </div>
            </>
          )}

          {/* STEP 2: PDF y envío */}
          {step === 2 && ovCreada && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>
                OV-{String(ovCreada.numero).padStart(4, '0')} creada
              </div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
                {seleccionadas.length} propiedad(es) para {ovCreada.contacto_nombre}
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={soloDescargarPDF} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #185FA5', background: '#E6F1FB', color: '#185FA5', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ⬇ Descargar PDF
                </button>
                {ovCreada.contacto_email ? (
                  <button onClick={generarYEnviarPDF} disabled={enviando} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: enviando ? '#9ca3af' : '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600, cursor: enviando ? 'not-allowed' : 'pointer' }}>
                    {enviando ? 'Enviando...' : '✉️ Enviar por email a ' + ovCreada.contacto_email}
                  </button>
                ) : (
                  <div style={{ fontSize: 12, color: '#aaa', padding: '10px' }}>El contacto no tiene email — solo descarga disponible</div>
                )}
              </div>

              {error && <div style={{ color: '#E8593C', fontSize: 12, marginTop: 12 }}>{error}</div>}

              <button onClick={() => { onCreated && onCreated(ovCreada); onClose() }} style={{ marginTop: 20, border: 'none', background: 'none', cursor: 'pointer', color: '#888', fontSize: 13, textDecoration: 'underline' }}>
                Cerrar
              </button>
            </div>
          )}

          {/* STEP 3: Enviado */}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0F6E56', marginBottom: 8 }}>¡Orden de Visita enviada!</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
                PDF enviado a {ovCreada.contacto_email} y descargado en tu equipo
              </div>
              <button onClick={() => { onCreated && onCreated(ovCreada); onClose() }} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
