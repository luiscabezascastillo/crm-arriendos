'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import TopNav from '../components/ui/TopNav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const ROLES = ['propietario', 'cliente', 'arrendatario', 'inversor', 'maestro', 'conserje', 'proveedor']
const TIPOS_DOC = ['RUT', 'PASAPORTE', 'RUN_EXT', 'EN_TRAMITE']
const ORIGENES = ['Portal', 'Referido', 'Directo', 'Redes sociales', 'Llamada', 'Otro']
const emptyF = { selected: [], sort: null }

const ROL_COLORS = {
  propietario:  { bg: '#EAF3DE', color: '#3B6D11' },
  cliente:      { bg: '#E6F1FB', color: '#185FA5' },
  arrendatario: { bg: '#FAEEDA', color: '#854F0B' },
  inversor:     { bg: '#FDF1EE', color: '#E8593C' },
  maestro:      { bg: '#F3E8FF', color: '#7C3AED' },
  conserje:     { bg: '#E1F5EE', color: '#0F6E56' },
  proveedor:    { bg: '#F1EFE8', color: '#888' },
}

// ── Validaciones ─────────────────────────────────────────────────────────────
function validarRUT(rut) {
  if (!rut) return false
  const limpio = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim()
  if (limpio.length < 2) return false
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  if (!/^\d+$/.test(cuerpo)) return false
  let suma = 0, mul = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const dvCalc = 11 - (suma % 11)
  const dvEsp = dvCalc === 11 ? '0' : dvCalc === 10 ? 'K' : String(dvCalc)
  return dv === dvEsp
}

function validarEmail(email) {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

function validarTelChile(tel) {
  if (!tel) return true
  const limpio = tel.replace(/[s-().+]/g, '')
  // Acepta: 56912345678, 912345678, +56912345678
  return /^(56)?[2-9]d{8}$/.test(limpio)
}

function validarTelIntl(tel) {
  if (!tel) return true
  const limpio = tel.replace(/[s-().+]/g, '')
  return /^d{7,15}$/.test(limpio)
}

function formatTelChile(tel) {
  const limpio = tel.replace(/[s-().]/g, '').replace(/^+?56/, '')
  if (limpio.length === 0) return tel
  if (limpio.length <= 9) {
    // Móvil: 9 XXXX XXXX
    if (limpio.startsWith('9') && limpio.length === 9)
      return '+56 ' + limpio[0] + ' ' + limpio.slice(1,5) + ' ' + limpio.slice(5)
  }
  return tel
}

function formatRUT(valor) {
  const limpio = valor.replace(/\./g, '').replace(/-/g, '').replace(/[^0-9kK]/g, '')
  if (limpio.length <= 1) return limpio
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1).toUpperCase()
  const conPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return conPuntos + '-' + dv
}

// ── Componentes auxiliares ────────────────────────────────────────────────────
function RolBadge({ rol }) {
  const c = ROL_COLORS[rol] || { bg: '#F1EFE8', color: '#888' }
  return (
    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600, background: c.bg, color: c.color, marginRight: 3, whiteSpace: 'nowrap' }}>
      {rol}
    </span>
  )
}

function Avatar({ nombre }) {
  const inicial = (nombre || '?')[0].toUpperCase()
  const colores = ['#185FA5', '#3B6D11', '#854F0B', '#7C3AED', '#E8593C', '#0F6E56']
  const color = colores[(nombre || '').charCodeAt(0) % colores.length]
  return (
    <div style={{ width: 34, height: 34, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
      {inicial}
    </div>
  )
}

function ExcelFilter({ label, options, value, onApply }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(value.selected || [])
  const [sortDir, setSortDir] = useState(value.sort || null)
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const activo = (value.selected && value.selected.length > 0) || value.sort
  const filteredOpts = options.filter(o => String(o || '').toLowerCase().includes(search.toLowerCase()))
  function toggleAll() { setSelected(selected.length === options.length ? [] : [...options]) }
  function toggle(opt) { setSelected(s => s.includes(opt) ? s.filter(x => x !== opt) : [...s, opt]) }
  function apply() { onApply({ selected, sort: sortDir }); setOpen(false) }
  function clear() { setSelected([]); setSortDir(null); onApply({ selected: [], sort: null }); setOpen(false) }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <button onClick={() => setOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: activo ? '#1D4ED8' : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
        <span style={{ fontSize: 9, color: activo ? '#1D4ED8' : '#9CA3AF' }}>{value.sort === 'asc' ? ' ↑' : value.sort === 'desc' ? ' ↓' : ' ⬇'}</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, zIndex: 300 }}>
          <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #F3F4F6' }}>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Ordenar</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['asc', 'A → Z'], ['desc', 'Z → A']].map(([dir, lbl]) => (
                <button key={dir} onClick={() => setSortDir(d => d === dir ? null : dir)} style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid', fontSize: 11, cursor: 'pointer', background: sortDir === dir ? '#EFF6FF' : '#F9FAFB', borderColor: sortDir === dir ? '#BFDBFE' : '#E5E7EB', color: sortDir === dir ? '#1D4ED8' : '#374151' }}>{lbl}</button>
              ))}
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #F3F4F6' }}>
            <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto', padding: '4px' }}>
            <div onClick={toggleAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
              onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <input type="checkbox" readOnly checked={selected.length === options.length && options.length > 0} style={{ margin: 0 }} />
              <span style={{ fontWeight: 500 }}>Seleccionar todo</span>
            </div>
            {filteredOpts.map(opt => (
              <div key={String(opt)} onClick={() => toggle(opt)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <input type="checkbox" readOnly checked={selected.includes(opt)} style={{ margin: 0 }} />
                <span>{opt || '(vacío)'}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '8px 12px', borderTop: '0.5px solid #F3F4F6', display: 'flex', gap: 6 }}>
            <button onClick={clear} style={{ flex: 1, padding: '5px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#6B7280' }}>Limpiar</button>
            <button onClick={apply} style={{ flex: 1, padding: '5px', borderRadius: 6, border: 'none', background: '#1D4ED8', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 500 }}>Aplicar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal Nuevo/Editar ────────────────────────────────────────────────────────
function ModalContacto({ contacto, onClose, onSaved }) {
  const { data: session } = useSession()
  const esNuevo = !contacto?.id

  const [form, setForm] = useState({
    tipo_doc:            contacto?.tipo_doc || 'RUT',
    numero_doc:          contacto?.numero_doc || '',
    nombre:              contacto?.nombre || '',
    apellido:            contacto?.apellido || '',
    roles:               contacto?.roles || [],
    email:               contacto?.email || '',
    email_2:             contacto?.email_2 || '',
    telefono:            contacto?.telefono || '',
    telefono_2:          contacto?.telefono_2 || '',
    whatsapp:            contacto?.whatsapp || '',
    fecha_nacimiento:    contacto?.fecha_nacimiento || '',
    nacionalidad:        contacto?.nacionalidad || 'Chilena',
    genero:              contacto?.genero || '',
    direccion:           contacto?.direccion || '',
    comuna:              contacto?.comuna || '',
    pais:                contacto?.pais || 'Chile',
    empresa:             contacto?.empresa || '',
    cargo:               contacto?.cargo || '',
    notas:               contacto?.notas || '',
    origen:              contacto?.origen || '',
    comercial_asignado:  contacto?.comercial_asignado || '',
    activo:              contacto?.activo !== false,
  })

  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrores(e => ({ ...e, [k]: null })) }
  function toggleRol(rol) { set('roles', form.roles.includes(rol) ? form.roles.filter(r => r !== rol) : [...form.roles, rol]) }

  function validar() {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio'
    if (form.tipo_doc === 'RUT' && form.numero_doc && !validarRUT(form.numero_doc)) e.numero_doc = 'RUT inválido'
    if (form.email && !validarEmail(form.email)) e.email = 'Email inválido'
    if (form.email_2 && !validarEmail(form.email_2)) e.email_2 = 'Email inválido'
    if (form.telefono && !validarTelChile(form.telefono)) e.telefono = 'Formato inválido — ej: +56 9 1234 5678'
    if (form.whatsapp && !validarTelIntl(form.whatsapp)) e.whatsapp = 'Número inválido (7-15 dígitos)'
    setErrores(e)
    setTimeout(() => {
      const el = document.querySelector('[data-error="true"]')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    return Object.keys(e).length === 0
  }

  async function guardar() {
    if (!validar()) return
    setGuardando(true)
    const userEmail = session?.user?.email || 'desconocido'
    const formLimpio = { ...form }
    if (!formLimpio.fecha_nacimiento) formLimpio.fecha_nacimiento = null
    const payload = {
      ...formLimpio,
      updated_at: new Date().toISOString(),
      modificado_por: userEmail,
      ...(esNuevo ? { creado_por: userEmail } : {}),
    }
    const { error } = esNuevo
      ? await supabase.from('contactos').insert(payload)
      : await supabase.from('contactos').update(payload).eq('id', contacto.id)
    if (error) { setErrores({ general: error.message }); setGuardando(false); return }
    onSaved()
  }

  const inp = (campo) => ({
    width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
    border: errores[campo] ? '1px solid #E8593C' : '1px solid #E0DDD8',
    outline: 'none',
  })
  const lbl = { fontSize: 11, color: '#888', marginBottom: 3, display: 'block' }
  const g2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }
  const sec = { fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, marginTop: 8, paddingTop: 12, borderTop: '1px solid #F5F3EF' }
  const err = (campo) => errores[campo] ? <div style={{ fontSize: 11, color: '#E8593C', marginTop: 3 }}>{errores[campo]}</div> : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, width: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.15)', fontFamily: '"DM Sans","Segoe UI",sans-serif' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F0EEE8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAF8', position: 'sticky', top: 0, zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>{esNuevo ? '+ Nuevo contacto' : 'Editar contacto'}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#bbb' }}>×</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Identificación</div>
          <div style={g2}>
            <div>
              <label style={lbl}>Tipo documento</label>
              <select value={form.tipo_doc} onChange={e => set('tipo_doc', e.target.value)} style={inp('tipo_doc')}>
                {TIPOS_DOC.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Número documento {form.tipo_doc === 'RUT' && <span style={{ color: '#E8593C' }}>*</span>}</label>
              <input
                data-error={!!errores.numero_doc}
                style={inp('numero_doc')}
                value={form.numero_doc}
                onChange={e => {
                  const val = form.tipo_doc === 'RUT' ? formatRUT(e.target.value) : e.target.value
                  set('numero_doc', val)
                }}
                placeholder={form.tipo_doc === 'RUT' ? '12.345.678-9' : 'Número documento'}
              />
              {err('numero_doc')}
            </div>
          </div>
          <div style={g2}>
            <div>
              <label style={lbl}>Nombre <span style={{ color: '#E8593C' }}>*</span></label>
              <input data-error={!!errores.nombre} style={inp('nombre')} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre(s)" />
              {err('nombre')}
            </div>
            <div>
              <label style={lbl}>Apellido(s)</label>
              <input style={inp('apellido')} value={form.apellido} onChange={e => set('apellido', e.target.value)} placeholder="Apellidos" />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Roles</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ROLES.map(rol => (
                <button key={rol} onClick={() => toggleRol(rol)} style={{
                  padding: '4px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid',
                  background: form.roles.includes(rol) ? '#1D4ED8' : '#F9FAFB',
                  borderColor: form.roles.includes(rol) ? '#1D4ED8' : '#E5E7EB',
                  color: form.roles.includes(rol) ? '#fff' : '#374151',
                  fontWeight: form.roles.includes(rol) ? 600 : 400,
                }}>{rol}</button>
              ))}
            </div>
          </div>

          <div style={sec}>Contacto</div>
          <div style={g2}>
            <div>
              <label style={lbl}>Email principal</label>
              <input data-error={!!errores.email} style={inp('email')} value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@ejemplo.com" />
              {err('email')}
            </div>
            <div>
              <label style={lbl}>Email secundario</label>
              <input style={inp('email_2')} value={form.email_2} onChange={e => set('email_2', e.target.value)} />
              {err('email_2')}
            </div>
          </div>
          <div style={g2}>
            <div>
              <label style={lbl}>Teléfono</label>
              <input data-error={!!errores.telefono} style={inp('telefono')} value={form.telefono} onChange={e => set('telefono', e.target.value)} onBlur={e => { const f = formatTelChile(e.target.value); if (f !== e.target.value) set('telefono', f) }} placeholder="+56 9 xxxx xxxx" />
              {errores.telefono && <div style={{fontSize:11,color:'#E8593C',marginTop:3}}>{errores.telefono}</div>}
            </div>
            <div>
              <label style={lbl}>WhatsApp</label>
              <input data-error={!!errores.whatsapp} style={inp('whatsapp')} value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="+56 9 xxxx xxxx" />
              {errores.whatsapp && <div style={{fontSize:11,color:'#E8593C',marginTop:3}}>{errores.whatsapp}</div>}
            </div>
          </div>

          <div style={sec}>Datos personales</div>
          <div style={g2}>
            <div>
              <label style={lbl}>Fecha nacimiento</label>
              <input style={inp('fecha_nacimiento')} type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Nacionalidad</label>
              <input style={inp('nacionalidad')} value={form.nacionalidad} onChange={e => set('nacionalidad', e.target.value)} />
            </div>
          </div>

          <div style={sec}>Domicilio</div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Dirección</label>
            <input style={inp('direccion')} value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Calle, número, depto" />
          </div>
          <div style={g2}>
            <div>
              <label style={lbl}>Comuna</label>
              <input style={inp('comuna')} value={form.comuna} onChange={e => set('comuna', e.target.value)} placeholder="Comuna" />
            </div>
            <div>
              <label style={lbl}>País</label>
              <input style={inp('pais')} value={form.pais} onChange={e => set('pais', e.target.value)} />
            </div>
          </div>

          <div style={sec}>Empresa (opcional)</div>
          <div style={g2}>
            <div>
              <label style={lbl}>Empresa</label>
              <input style={inp('empresa')} value={form.empresa} onChange={e => set('empresa', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Cargo</label>
              <input style={inp('cargo')} value={form.cargo} onChange={e => set('cargo', e.target.value)} />
            </div>
          </div>

          <div style={sec}>CRM</div>
          <div style={g2}>
            <div>
              <label style={lbl}>Origen</label>
              <select value={form.origen} onChange={e => set('origen', e.target.value)} style={inp('origen')}>
                <option value="">— Seleccionar —</option>
                {ORIGENES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Comercial asignado</label>
              <input style={inp('comercial_asignado')} value={form.comercial_asignado} onChange={e => set('comercial_asignado', e.target.value)} placeholder="Nombre ejecutivo" />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Notas</label>
            <textarea style={{ ...inp('notas'), height: 70, resize: 'vertical' }} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Observaciones, preferencias, etc." />
          </div>

          {errores.general && <div style={{ color: '#E8593C', fontSize: 12, marginBottom: 12, padding: '8px 12px', background: '#FDF1EE', borderRadius: 6 }}>{errores.general}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #E0DDD8', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#666' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: guardando ? '#9ca3af' : '#1D4ED8', color: '#fff', fontSize: 13, fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer' }}>
              {guardando ? 'Guardando...' : esNuevo ? 'Crear contacto' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ContactosPage() {
  const router = useRouter()
  const [contactos, setContactos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [fNombre, setFNombre] = useState(emptyF)
  const [fRol, setFRol] = useState(emptyF)
  const [fComuna, setFComuna] = useState(emptyF)
  const [fComercial, setFComercial] = useState(emptyF)
  const [fOrigen, setFOrigen] = useState(emptyF)

  useEffect(() => { cargar() }, [])

  function cargar() {
    setLoading(true)
    supabase.from('contactos').select('*').eq('activo', true).order('nombre')
      .then(({ data }) => { setContactos(data || []); setLoading(false) })
  }

  const unicos = (campo) => [...new Set(contactos.map(c => c[campo]).filter(Boolean))].sort()
  const unicosRoles = [...new Set(contactos.flatMap(c => c.roles || []))].sort()

  function applyFilters(lista) {
    let r = lista.filter(c => {
      if (!search) return true
      const q = search.toLowerCase()
      return [c.nombre, c.apellido, c.numero_doc, c.email, c.telefono, c.empresa].join(' ').toLowerCase().includes(q)
    })
    if (fNombre.selected.length) r = r.filter(c => fNombre.selected.includes(c.nombre))
    if (fRol.selected.length) r = r.filter(c => (c.roles || []).some(r2 => fRol.selected.includes(r2)))
    if (fComuna.selected.length) r = r.filter(c => fComuna.selected.includes(c.comuna))
    if (fComercial.selected.length) r = r.filter(c => fComercial.selected.includes(c.comercial_asignado))
    if (fOrigen.selected.length) r = r.filter(c => fOrigen.selected.includes(c.origen))
    const sorts = [
      { f: fNombre, k: 'nombre' }, { f: fComuna, k: 'comuna' },
      { f: fComercial, k: 'comercial_asignado' }, { f: fOrigen, k: 'origen' },
    ].filter(s => s.f.sort)
    if (sorts.length) {
      const { k, f } = sorts[sorts.length - 1]
      r.sort((a, b) => {
        const av = String(a[k] || ''), bv = String(b[k] || '')
        return f.sort === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
      })
    }
    return r
  }

  const filtrados = applyFilters(contactos)
  const hayFiltros = search || [fNombre, fRol, fComuna, fComercial, fOrigen].some(f => f.selected.length || f.sort)
  function limpiar() { setSearch(''); setFNombre(emptyF); setFRol(emptyF); setFComuna(emptyF); setFComercial(emptyF); setFOrigen(emptyF) }

  const s = {
    page: { minHeight: '100vh', background: '#F8F7F4', fontFamily: '"DM Sans","Segoe UI",sans-serif' },
    container: { maxWidth: 1280, margin: '0 auto', padding: '28px 24px' },
    tabla: { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, overflow: 'hidden' },
    th: { padding: '10px 14px', borderBottom: '1px solid #F0EEE8', background: '#FAFAF8', textAlign: 'left' },
    td: { padding: '11px 14px', fontSize: 13, color: '#333', borderBottom: '1px solid #F5F3EF', verticalAlign: 'middle' },
  }

  return (
    <div style={s.page}>
      <TopNav />
      <div style={s.container}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>Contactos</h1>
          <span style={{ fontSize: 12, color: '#aaa', background: '#F1EFE8', padding: '2px 8px', borderRadius: 4 }}>{contactos.length}</span>
          {hayFiltros && (
            <button onClick={limpiar} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #E8593C', borderRadius: 5, background: '#FDF1EE', color: '#E8593C', cursor: 'pointer' }}>× Limpiar filtros</button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre, RUT, email, teléfono..."
              style={{ padding: '7px 12px', border: '1px solid #E0DDD8', borderRadius: 8, fontSize: 13, width: 280, fontFamily: 'inherit' }} />
            <button onClick={() => { setEditando(null); setModalOpen(true) }} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1D4ED8', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Nuevo contacto
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total', valor: contactos.length, color: '#1a1a2e' },
            { label: 'Propietarios', valor: contactos.filter(c => c.roles?.includes('propietario')).length, color: '#3B6D11' },
            { label: 'Clientes', valor: contactos.filter(c => c.roles?.includes('cliente')).length, color: '#185FA5' },
            { label: 'Arrendatarios', valor: contactos.filter(c => c.roles?.includes('arrendatario')).length, color: '#854F0B' },
            { label: 'Mostrando', valor: filtrados.length, color: '#7C3AED' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{loading ? '...' : k.valor}</div>
            </div>
          ))}
        </div>

        <div style={s.tabla}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Cargando contactos...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={s.th}><ExcelFilter label="Nombre" options={unicos('nombre')} value={fNombre} onApply={setFNombre} /></th>
                  <th style={{ ...s.th, fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Documento</th>
                  <th style={s.th}><ExcelFilter label="Roles" options={unicosRoles} value={fRol} onApply={setFRol} /></th>
                  <th style={{ ...s.th, fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
                  <th style={{ ...s.th, fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teléfono</th>
                  <th style={{ ...s.th, fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>WhatsApp</th>
                  <th style={s.th}><ExcelFilter label="Comuna" options={unicos('comuna')} value={fComuna} onApply={setFComuna} /></th>
                  <th style={s.th}><ExcelFilter label="Comercial" options={unicos('comercial_asignado')} value={fComercial} onApply={setFComercial} /></th>
                  <th style={s.th}><ExcelFilter label="Origen" options={unicos('origen')} value={fOrigen} onApply={setFOrigen} /></th>
                  <th style={{ ...s.th, fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan={10} style={{ ...s.td, textAlign: 'center', color: '#aaa', padding: 48 }}>
                    {contactos.length === 0 ? 'No hay contactos aún — crea el primero con + Nuevo contacto' : 'Sin resultados con los filtros seleccionados'}
                  </td></tr>
                ) : filtrados.map((c, i) => (
                  <tr key={c.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8', cursor: 'pointer' }}
                    onClick={() => router.push('/contactos/' + c.id)}>
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar nombre={c.nombre} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{c.nombre} {c.apellido || ''}</div>
                          {c.empresa && <div style={{ fontSize: 11, color: '#aaa' }}>{c.empresa}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ ...s.td, fontSize: 12 }}>
                      <span style={{ fontSize: 9, background: '#F1EFE8', padding: '1px 5px', borderRadius: 3, marginRight: 4, color: '#666' }}>{c.tipo_doc}</span>
                      {c.numero_doc || '—'}
                    </td>
                    <td style={s.td}>{(c.roles || []).map(r => <RolBadge key={r} rol={r} />)}</td>
                    <td style={{ ...s.td, fontSize: 12, color: '#555' }}>{c.email || '—'}</td>
                    <td style={{ ...s.td, fontSize: 12, color: '#555' }}>{c.telefono || '—'}</td>
                    <td style={{ ...s.td, fontSize: 12, color: '#555' }}>{c.whatsapp || '—'}</td>
                    <td style={{ ...s.td, fontSize: 12, color: '#555' }}>{c.comuna || '—'}</td>
                    <td style={{ ...s.td, fontSize: 12, color: '#555' }}>{c.comercial_asignado || '—'}</td>
                    <td style={{ ...s.td, fontSize: 12, color: '#555' }}>{c.origen || '—'}</td>
                    <td style={{ ...s.td, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button onClick={() => router.push('/contactos/' + c.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid #185FA5', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', fontWeight: 600 }}>Ver</button>
                        <button onClick={() => { setEditando(c); setModalOpen(true) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid #E0DDD8', background: '#fff', color: '#666', cursor: 'pointer' }}>Editar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <ModalContacto
          contacto={editando}
          onClose={() => { setModalOpen(false); setEditando(null) }}
          onSaved={() => { setModalOpen(false); setEditando(null); cargar() }}
        />
      )}
    </div>
  )
}
