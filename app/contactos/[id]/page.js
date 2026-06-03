'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams, useRouter } from 'next/navigation'
import TopNav from '../../components/ui/TopNav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const ROL_COLORS = {
  propietario:  { bg: '#EAF3DE', color: '#3B6D11' },
  cliente:      { bg: '#E6F1FB', color: '#185FA5' },
  arrendatario: { bg: '#FAEEDA', color: '#854F0B' },
  proveedor:    { bg: '#F3E8FF', color: '#7C3AED' },
  otro:         { bg: '#F1EFE8', color: '#888' },
}

const TIPO_ICON = { nota: '📝', visita: '🏠', email: '✉️', llamada: '📞', contrato: '📄', pago: '💰', reunion: '🤝' }
const TIPO_COLOR = {
  nota:     { bg: '#F8F7F4', border: '#E8E6E0', color: '#555' },
  visita:   { bg: '#E6F1FB', border: '#B5D4F4', color: '#185FA5' },
  email:    { bg: '#EAF3DE', border: '#B8DFA5', color: '#3B6D11' },
  llamada:  { bg: '#FAEEDA', border: '#F5C97A', color: '#854F0B' },
  contrato: { bg: '#FDF1EE', border: '#F5C4B3', color: '#E8593C' },
  reunion:  { bg: '#F3E8FF', border: '#D8B4FE', color: '#7C3AED' },
  pago:     { bg: '#EAF3DE', border: '#B8DFA5', color: '#0F6E56' },
}

const ROLES = ['propietario', 'cliente', 'arrendatario', 'proveedor', 'otro']
const TIPOS_DOC = ['RUT', 'PASAPORTE', 'RUN_EXT', 'EN_TRAMITE']
const ORIGENES = ['Portal', 'Referido', 'Directo', 'Redes sociales', 'Llamada', 'Otro']
const TABS = ['Resumen', 'Historial', 'Propiedades', 'Documentos']

function RolBadge({ rol }) {
  const c = ROL_COLORS[rol] || ROL_COLORS.otro
  return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: c.bg, color: c.color, marginRight: 4 }}>{rol}</span>
}

function Avatar({ nombre, size = 48 }) {
  const inicial = (nombre || '?')[0].toUpperCase()
  const colores = ['#185FA5', '#3B6D11', '#854F0B', '#7C3AED', '#E8593C', '#0F6E56']
  const color = colores[(nombre || '').charCodeAt(0) % colores.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>
      {inicial}
    </div>
  )
}

export default function ContactoPage() {
  const { id } = useParams()
  const router = useRouter()
  const [contacto, setContacto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Resumen')
  const [historial, setHistorial] = useState([])
  const [nuevaNota, setNuevaNota] = useState('')
  const [tipoNota, setTipoNota] = useState('nota')
  const [guardandoNota, setGuardandoNota] = useState(false)
  const [propiedades, setPropiedades] = useState([])
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.from('contactos').select('*').eq('id', id).single()
      .then(({ data }) => {
        setContacto(data)
        setForm(data)
        setLoading(false)
      })
    supabase.from('contactos_historial').select('*').eq('contacto_id', id).order('fecha', { ascending: false })
      .then(({ data }) => setHistorial(data || []))
  }, [id])

  useEffect(() => {
    if (!contacto) return
    supabase.from('publicaciones').select('id, codigo, direccion, comuna, objetivo, tipo, valor, tipo_moneda, activo, estado')
      .then(({ data }) => {
        if (data) {
          const nombre = contacto.nombre.toLowerCase()
          setPropiedades(data.filter(p => (p.propietario || '').toLowerCase().includes(nombre)))
        }
      })
  }, [contacto])

  async function agregarNota() {
    if (!nuevaNota.trim()) return
    setGuardandoNota(true)
    await supabase.from('contactos_historial').insert({ contacto_id: Number(id), tipo: tipoNota, descripcion: nuevaNota })
    setNuevaNota('')
    const { data } = await supabase.from('contactos_historial').select('*').eq('contacto_id', id).order('fecha', { ascending: false })
    setHistorial(data || [])
    setGuardandoNota(false)
  }

  async function guardarEdicion() {
    if (!form?.nombre?.trim()) return
    setGuardando(true)
    await supabase.from('contactos').update({ ...form, updated_at: new Date().toISOString() }).eq('id', id)
    setContacto(form)
    setEditando(false)
    setGuardando(false)
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function toggleRol(rol) {
    const roles = form.roles || []
    setF('roles', roles.includes(rol) ? roles.filter(r => r !== rol) : [...roles, rol])
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', fontFamily: '"DM Sans","Segoe UI",sans-serif' }}>
      <TopNav />
      <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Cargando...</div>
    </div>
  )

  if (!contacto) return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', fontFamily: '"DM Sans","Segoe UI",sans-serif' }}>
      <TopNav />
      <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Contacto no encontrado</div>
    </div>
  )

  const cumple = contacto.fecha_nacimiento ? new Date(contacto.fecha_nacimiento) : null
  const hoy = new Date()
  const esCumple = cumple && cumple.getDate() === hoy.getDate() && cumple.getMonth() === hoy.getMonth()

  const inp = { width: '100%', padding: '7px 10px', border: '1px solid #E0DDD8', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl = { fontSize: 11, color: '#888', marginBottom: 3, display: 'block' }
  const g2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }

  const s = {
    page: { minHeight: '100vh', background: '#F8F7F4', fontFamily: '"DM Sans","Segoe UI",sans-serif' },
    container: { maxWidth: 1100, margin: '0 auto', padding: '28px 24px' },
    card: { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, padding: '20px 24px', marginBottom: 16 },
    dato: { display: 'grid', gridTemplateColumns: '140px 1fr', padding: '7px 0', borderBottom: '1px solid #F8F7F4', alignItems: 'start' },
  }

  return (
    <div style={s.page}>
      <TopNav />
      <div style={s.container}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13 }}>
          <button onClick={() => router.push('/contactos')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#185FA5', padding: 0, fontSize: 13 }}>
            ← Contactos
          </button>
          <span style={{ color: '#ccc' }}>/</span>
          <span style={{ color: '#888' }}>{contacto.nombre} {contacto.apellido || ''}</span>
        </div>

        {/* Header */}
        <div style={{ ...s.card, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <Avatar nombre={contacto.nombre} size={64} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>
                {contacto.nombre} {contacto.apellido || ''}
                {esCumple && <span style={{ marginLeft: 8 }} title="¡Hoy es su cumpleaños!">🎂</span>}
              </h1>
              {(contacto.roles || []).map(r => <RolBadge key={r} rol={r} />)}
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 8, flexWrap: 'wrap' }}>
              {contacto.numero_doc && <span style={{ fontSize: 13, color: '#666' }}>🪪 {contacto.tipo_doc}: {contacto.numero_doc}</span>}
              {contacto.email && <a href={'mailto:' + contacto.email} style={{ fontSize: 13, color: '#185FA5', textDecoration: 'none' }}>✉️ {contacto.email}</a>}
              {contacto.telefono && <span style={{ fontSize: 13, color: '#666' }}>📞 {contacto.telefono}</span>}
              {contacto.whatsapp && <a href={'https://wa.me/' + contacto.whatsapp.replace(/\D/g, '')} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#0F6E56', textDecoration: 'none' }}>💬 {contacto.whatsapp}</a>}
              {contacto.empresa && <span style={{ fontSize: 13, color: '#666' }}>🏢 {contacto.empresa}{contacto.cargo ? ' · ' + contacto.cargo : ''}</span>}
            </div>
            {contacto.comercial_asignado && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#aaa' }}>Comercial asignado: <b>{contacto.comercial_asignado}</b></div>
            )}
          </div>
          <button onClick={() => setEditando(true)} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #1D4ED8', background: '#EFF6FF', color: '#1D4ED8', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Editar
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #E8E6E0' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              border: 'none', cursor: 'pointer', padding: '8px 18px', fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#185FA5' : '#888',
              background: 'transparent',
              borderBottom: tab === t ? '2px solid #185FA5' : '2px solid transparent',
              marginBottom: -1, fontFamily: 'inherit',
            }}>{t}</button>
          ))}
        </div>

        {/* TAB: Resumen */}
        {tab === 'Resumen' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={s.card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Datos personales</div>
              {[
                ['Nombre', contacto.nombre + ' ' + (contacto.apellido || '')],
                ['Documento', contacto.tipo_doc + ': ' + (contacto.numero_doc || '—')],
                ['Nacimiento', contacto.fecha_nacimiento ? new Date(contacto.fecha_nacimiento).toLocaleDateString('es-CL') : '—'],
                ['Nacionalidad', contacto.nacionalidad || '—'],
                ['Género', contacto.genero || '—'],
              ].map(([l, v]) => (
                <div key={l} style={s.dato}>
                  <span style={{ fontSize: 11, color: '#aaa' }}>{l}</span>
                  <span style={{ fontSize: 13, color: '#333' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={s.card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Contacto</div>
              {[
                ['Email', contacto.email || '—'],
                ['Email 2', contacto.email_2 || '—'],
                ['Teléfono', contacto.telefono || '—'],
                ['WhatsApp', contacto.whatsapp || '—'],
                ['Dirección', contacto.direccion || '—'],
                ['Comuna', contacto.comuna || '—'],
                ['País', contacto.pais || '—'],
              ].map(([l, v]) => (
                <div key={l} style={s.dato}>
                  <span style={{ fontSize: 11, color: '#aaa' }}>{l}</span>
                  <span style={{ fontSize: 13, color: '#333' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={s.card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>CRM</div>
              {[
                ['Comercial', contacto.comercial_asignado || '—'],
                ['Origen', contacto.origen || '—'],
                ['Empresa', contacto.empresa || '—'],
                ['Cargo', contacto.cargo || '—'],
              ].map(([l, v]) => (
                <div key={l} style={s.dato}>
                  <span style={{ fontSize: 11, color: '#aaa' }}>{l}</span>
                  <span style={{ fontSize: 13, color: '#333' }}>{v}</span>
                </div>
              ))}
            </div>
            {contacto.notas && (
              <div style={s.card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Notas</div>
                <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.6 }}>{contacto.notas}</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: Historial */}
        {tab === 'Historial' && (
          <div>
            <div style={s.card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Registrar actividad</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                {Object.keys(TIPO_ICON).map(t => (
                  <button key={t} onClick={() => setTipoNota(t)} style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid',
                    background: tipoNota === t ? '#1D4ED8' : '#F9FAFB',
                    borderColor: tipoNota === t ? '#1D4ED8' : '#E5E7EB',
                    color: tipoNota === t ? '#fff' : '#374151',
                    fontWeight: tipoNota === t ? 600 : 400,
                  }}>{TIPO_ICON[t]} {t}</button>
                ))}
              </div>
              <textarea value={nuevaNota} onChange={e => setNuevaNota(e.target.value)}
                placeholder={'Describe la ' + tipoNota + '...'}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #E0DDD8', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', height: 80, resize: 'vertical', marginBottom: 10 }} />
              <button onClick={agregarNota} disabled={guardandoNota || !nuevaNota.trim()} style={{
                padding: '7px 18px', borderRadius: 7, border: 'none',
                background: !nuevaNota.trim() ? '#E0DDD8' : '#1D4ED8',
                color: !nuevaNota.trim() ? '#aaa' : '#fff',
                fontSize: 13, fontWeight: 600, cursor: !nuevaNota.trim() ? 'not-allowed' : 'pointer'
              }}>
                {guardandoNota ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
            <div style={{ position: 'relative', paddingLeft: 28 }}>
              <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 2, background: '#E8E6E0' }} />
              {historial.length === 0 ? (
                <div style={{ color: '#aaa', fontSize: 13, padding: '20px 0' }}>Sin actividad registrada aún</div>
              ) : historial.map((h, i) => {
                const tc = TIPO_COLOR[h.tipo] || TIPO_COLOR.nota
                return (
                  <div key={i} style={{ position: 'relative', marginBottom: 16 }}>
                    <div style={{ position: 'absolute', left: -22, top: 14, width: 10, height: 10, borderRadius: '50%', background: tc.border, border: '2px solid #F8F7F4' }} />
                    <div style={{ background: tc.bg, border: '1px solid ' + tc.border, borderRadius: 8, padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: tc.color }}>{TIPO_ICON[h.tipo]} {h.tipo}</span>
                        <span style={{ fontSize: 11, color: '#aaa' }}>
                          {new Date(h.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {h.usuario && ' · ' + h.usuario}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#444', lineHeight: 1.6 }}>{h.descripcion}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB: Propiedades */}
        {tab === 'Propiedades' && (
          <div style={s.card}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>
              Propiedades asociadas ({propiedades.length})
            </div>
            {propiedades.length === 0 ? (
              <div style={{ color: '#aaa', fontSize: 13 }}>No se encontraron propiedades asociadas a este contacto</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#FAFAF8' }}>
                    {['Código', 'Dirección', 'Comuna', 'Tipo', 'Operación', 'Precio', 'Estado'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #F0EEE8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {propiedades.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F5F3EF', cursor: 'pointer', background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}
                      onClick={() => router.push('/publicaciones/' + p.id)}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#185FA5' }}>{p.codigo}</td>
                      <td style={{ padding: '10px 12px', color: '#555' }}>{p.direccion || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#555' }}>{p.comuna || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#555' }}>{p.tipo || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#555' }}>{p.objetivo || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#555' }}>
                        {p.tipo_moneda === 'UF' ? 'UF ' : '$'}{Number(p.valor || 0).toLocaleString('es-CL')}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: p.activo === 'active' ? '#EAF3DE' : '#F1EFE8', color: p.activo === 'active' ? '#3B6D11' : '#888', fontWeight: 600 }}>
                          {p.activo === 'active' ? 'Activa' : p.activo || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB: Documentos */}
        {tab === 'Documentos' && (
          <div style={s.card}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Documentos</div>
            <div style={{ color: '#aaa', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
              📄 Próximamente — Órdenes de visita, contratos y PDFs
            </div>
          </div>
        )}
      </div>

      {/* Modal edición inline */}
      {editando && form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setEditando(false)}>
          <div style={{ background: '#fff', borderRadius: 12, width: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.15)', fontFamily: '"DM Sans","Segoe UI",sans-serif' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F0EEE8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAF8', position: 'sticky', top: 0 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Editar contacto</h2>
              <button onClick={() => setEditando(false)} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#bbb' }}>×</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={g2}>
                <div><label style={lbl}>Tipo documento</label>
                  <select value={form.tipo_doc || 'RUT'} onChange={e => setF('tipo_doc', e.target.value)} style={inp}>
                    {TIPOS_DOC.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Número documento</label>
                  <input style={inp} value={form.numero_doc || ''} onChange={e => setF('numero_doc', e.target.value)} />
                </div>
              </div>
              <div style={g2}>
                <div><label style={lbl}>Nombre *</label>
                  <input style={inp} value={form.nombre || ''} onChange={e => setF('nombre', e.target.value)} />
                </div>
                <div><label style={lbl}>Apellido(s)</label>
                  <input style={inp} value={form.apellido || ''} onChange={e => setF('apellido', e.target.value)} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Roles</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ROLES.map(rol => (
                    <button key={rol} onClick={() => toggleRol(rol)} style={{
                      padding: '4px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid',
                      background: (form.roles || []).includes(rol) ? '#1D4ED8' : '#F9FAFB',
                      borderColor: (form.roles || []).includes(rol) ? '#1D4ED8' : '#E5E7EB',
                      color: (form.roles || []).includes(rol) ? '#fff' : '#374151',
                    }}>{rol}</button>
                  ))}
                </div>
              </div>
              <div style={g2}>
                <div><label style={lbl}>Email</label><input style={inp} type="email" value={form.email || ''} onChange={e => setF('email', e.target.value)} /></div>
                <div><label style={lbl}>Teléfono</label><input style={inp} value={form.telefono || ''} onChange={e => setF('telefono', e.target.value)} /></div>
              </div>
              <div style={g2}>
                <div><label style={lbl}>WhatsApp</label><input style={inp} value={form.whatsapp || ''} onChange={e => setF('whatsapp', e.target.value)} /></div>
                <div><label style={lbl}>Fecha nacimiento</label><input style={inp} type="date" value={form.fecha_nacimiento || ''} onChange={e => setF('fecha_nacimiento', e.target.value)} /></div>
              </div>
              <div style={g2}>
                <div><label style={lbl}>Dirección</label><input style={inp} value={form.direccion || ''} onChange={e => setF('direccion', e.target.value)} /></div>
                <div><label style={lbl}>Comuna</label><input style={inp} value={form.comuna || ''} onChange={e => setF('comuna', e.target.value)} /></div>
              </div>
              <div style={g2}>
                <div><label style={lbl}>Empresa</label><input style={inp} value={form.empresa || ''} onChange={e => setF('empresa', e.target.value)} /></div>
                <div><label style={lbl}>Comercial asignado</label><input style={inp} value={form.comercial_asignado || ''} onChange={e => setF('comercial_asignado', e.target.value)} /></div>
              </div>
              <div style={g2}>
                <div><label style={lbl}>Origen</label>
                  <select value={form.origen || ''} onChange={e => setF('origen', e.target.value)} style={inp}>
                    <option value="">— Seleccionar —</option>
                    {ORIGENES.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Nacionalidad</label><input style={inp} value={form.nacionalidad || ''} onChange={e => setF('nacionalidad', e.target.value)} /></div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Notas</label>
                <textarea style={{ ...inp, height: 70, resize: 'vertical' }} value={form.notas || ''} onChange={e => setF('notas', e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditando(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #E0DDD8', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#666' }}>Cancelar</button>
                <button onClick={guardarEdicion} disabled={guardando} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: guardando ? '#9ca3af' : '#1D4ED8', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
