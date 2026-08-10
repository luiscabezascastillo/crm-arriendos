'use client'
// VERSION: v4 · 2026-08-10 · Cobranza + CONSTANCIA. Cada moroso gana "Gestionar": panel para registrar
//   la gestion (arrendatario/aval/propietario) con plantilla + acuse, guardada en cobranza_gestiones
//   (append-only). Avisos obligatorios: aval y propietario pendientes. Pestaña Bitacora = registro global.
//   Reusa /api/cobranza (deteccion de mora) y /api/cobranza/gestion (constancia). Hereda v3.
// VERSION: v3 · 2026-07-21 · Cartolas operativa y por defecto (endpoint unificado /api/cobranza?tipo=).
//   Cabecera "Cobranza de {tipo} · situación al {fecha, hora}". Columna "Último abono". Toggles vigente/término,
//   sin_cobrador resaltado. Inicios sigue disponible como sub-vista. Servicios enlaza a /op/deudas.

import { useState, useEffect } from 'react'
import Link from 'next/link'

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const money = (v) => { const n = num(v); return (n ? '$' + n.toLocaleString('es-CL') : '$0') }

const C = {
  txt: '#2C2C2A', sub: '#888780', line: '#D3D1C7', panel: '#F1EFE8',
  rojo: '#9B1C1C', rojoBg: '#FBEDEC', verde: '#085041', verdeBg: '#E9F4E4',
  ambar: '#B8860B', ambarBg: '#FBF7EC', acento: '#1D9E75',
}

function fechaHoraLocal(iso) {
  const d = iso ? new Date(iso) : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ', ' + p(d.getHours()) + ':' + p(d.getMinutes())
}

const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
function mesActualTxt() { const d = new Date(); return MESES_TXT[d.getMonth()] + ' ' + d.getFullYear() }

const CANALES = ['email', 'whatsapp', 'llamada', 'carta_certificada', 'notarial', 'presencial']
const DEST_LBL = { arrendatario: 'Arrendatario', aval: 'Aval', propietario: 'Propietario' }

const TABS = [
  { k: 'cartolas', label: 'Cartolas' },
  { k: 'servicios', label: 'Servicios', href: '/op/deudas' },
  { k: 'inicios', label: 'Inicios' },
  { k: 'bitacora', label: 'Bitácora' },
]
const TITULO_TIPO = { cartolas: 'Cobranza de Cartolas', inicios: 'Cobranza de Inicios' }

export default function Cobranza() {
  const [tab, setTab] = useState('cartolas')

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 20px', fontFamily: 'system-ui, -apple-system, sans-serif', color: C.txt }}>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>
        <Link href="/procesos" style={{ color: C.sub, textDecoration: 'none' }}>← Procesos</Link> / Cobranza
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 2px' }}>Cobranza</h1>
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>Impago → gestión con constancia → pago o acción legal</div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid ' + C.line, marginBottom: 18 }}>
        {TABS.map(t => {
          const active = tab === t.k
          const base = {
            fontSize: 13, fontWeight: 600, padding: '9px 16px', cursor: 'pointer',
            border: 'none', background: 'none', borderBottom: active ? '2px solid ' + C.acento : '2px solid transparent',
            color: active ? C.txt : C.sub, position: 'relative', top: 1,
          }
          if (t.href) return <Link key={t.k} href={t.href} style={{ ...base, textDecoration: 'none' }}>{t.label}</Link>
          return <button key={t.k} onClick={() => setTab(t.k)} style={base}>{t.label}</button>
        })}
      </div>

      {(tab === 'cartolas' || tab === 'inicios') && <VistaCobranza tipo={tab} />}
      {tab === 'bitacora' && <Bitacora />}
    </div>
  )
}

function VistaCobranza({ tipo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [verVigente, setVerVigente] = useState(true)
  const [verTermino, setVerTermino] = useState(true)
  const [gestionar, setGestionar] = useState(null)   // fila seleccionada para el panel

  useEffect(() => {
    let vivo = true
    setLoading(true); setError(null); setData(null)
    fetch('/api/cobranza?tipo=' + tipo)
      .then(r => r.json())
      .then(j => { if (!vivo) return; if (j.error) setError(j.error); else setData(j); setLoading(false) })
      .catch(e => { if (!vivo) return; setError(String(e)); setLoading(false) })
    return () => { vivo = false }
  }, [tipo])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{TITULO_TIPO[tipo]}</span>
        <span style={{ fontSize: 12, color: C.sub }}>· situación al {fechaHoraLocal(data?.generado)}</span>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: C.sub }}>Calculando saldos…</div>}
      {error && <div style={{ padding: 20, color: C.rojo, fontSize: 13 }}>Error: {error}</div>}

      {data && (() => {
        const filas = data.filas || []
        const rv = data.resumen?.vigente || {}
        const rt = data.resumen?.termino || {}
        const grupos = []
        if (verVigente) grupos.push({ g: 'vigente', titulo: 'Vigentes (S / SQ)', r: rv })
        if (verTermino) grupos.push({ g: 'termino', titulo: 'En término (Q)', r: rt })
        return (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 13 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={verVigente} onChange={e => setVerVigente(e.target.checked)} />
                Vigentes (S/SQ) · {rv.con_deuda || 0} con deuda
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={verTermino} onChange={e => setVerTermino(e.target.checked)} />
                En término (Q) · {rt.con_deuda || 0} con deuda
              </label>
            </div>

            {grupos.map(({ g, titulo, r }) => (
              <div key={g} style={{ marginBottom: 26 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{titulo}</h2>
                  <span style={{ fontSize: 12, color: C.sub }}>
                    {r.con_deuda || 0} con deuda · {r.al_dia || 0} al día · {r.sobrepago || 0} a revisar · deuda total {money(r.total_deuda)}
                  </span>
                </div>
                <Tabla filas={filas.filter(f => f.grupo === g)} tipo={tipo} onGestionar={setGestionar} />
              </div>
            ))}

            <div style={{ fontSize: 11, color: C.sub, marginTop: 8 }}>
              Umbral deuda: {money(data.parametros?.umbral)} · sobrepago a revisar: &gt; {money(data.parametros?.sobrepago)} a favor.
              Saldo corrido a la fecha de hoy (mismo cálculo que la Cartola).
            </div>
          </>
        )
      })()}

      {gestionar && <CobranzaDrawer fila={gestionar} onClose={() => setGestionar(null)} />}
    </div>
  )
}

function Tabla({ filas, tipo, onGestionar }) {
  if (!filas.length) return <div style={{ padding: 16, color: C.sub, fontSize: 13 }}>Sin registros en este grupo.</div>

  const th = { fontSize: 11, fontWeight: 600, color: C.sub, textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid ' + C.line, whiteSpace: 'nowrap' }
  const td = { fontSize: 12, padding: '8px 10px', borderBottom: '0.5px solid ' + C.line, verticalAlign: 'top' }
  const esInicios = tipo === 'inicios'

  return (
    <div style={{ overflowX: 'auto', border: '0.5px solid ' + C.line, borderRadius: 8 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
        <thead>
          <tr>
            <th style={th}>IDADMON</th>
            <th style={th}>Propietario / Inmueble</th>
            <th style={th}>Arrendatario</th>
            <th style={{ ...th, textAlign: 'center' }}>Est.</th>
            <th style={{ ...th, textAlign: 'right' }}>Último abono</th>
            {esInicios && <th style={{ ...th, textAlign: 'right' }}>Últ. inicio</th>}
            <th style={{ ...th, textAlign: 'right' }}>Deuda</th>
            <th style={th}>Situación</th>
            <th style={{ ...th, textAlign: 'center' }}>Gestión</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(f => {
            const esMoroso = f.clase === 'moroso'
            const esSobre = f.clase === 'sobrepago'
            const bg = f.clase === 'al_dia' ? C.verdeBg : (esSobre ? C.ambarBg : '#fff')
            const aviso = f.sin_cobrador
            return (
              <tr key={f.idadmon} style={{ background: bg, boxShadow: aviso ? 'inset 3px 0 0 ' + C.ambar : 'none' }}>
                <td style={{ ...td, fontWeight: 600 }}>{f.idadmon}</td>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{f.propietario || '—'}</div>
                  <div style={{ color: C.sub, fontSize: 11 }}>{f.inmueble || ''}</div>
                </td>
                <td style={{ ...td, color: C.sub }}>{f.arrendatario || '—'}</td>
                <td style={{ ...td, textAlign: 'center' }}>{f.estado || '—'}</td>
                <td style={{ ...td, textAlign: 'right', color: C.sub, fontVariantNumeric: 'tabular-nums' }}>{f.ultimo_abono || '—'}</td>
                {esInicios && <td style={{ ...td, textAlign: 'right', color: C.sub, fontVariantNumeric: 'tabular-nums' }}>{f.fecha_ultimo_inicio || '—'}</td>}
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: esSobre ? 700 : 600,
                  color: esMoroso ? C.rojo : (f.clase === 'al_dia' ? C.verde : C.ambar) }}>
                  {money(f.deuda)}
                </td>
                <td style={td}>
                  {esMoroso && <span style={{ color: C.rojo, fontWeight: 600 }}>Moroso</span>}
                  {f.clase === 'al_dia' && <span style={{ color: C.verde }}>Al día</span>}
                  {esSobre && <span style={{ color: C.ambar, fontWeight: 700 }}>Revisar · posible mala asignación</span>}
                  {aviso && <div style={{ color: C.ambar, fontSize: 11, fontWeight: 600, marginTop: 2 }}>⚠ Falta «quién cobra» en el LOG</div>}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <button onClick={() => onGestionar(f)} style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid ' + C.acento,
                    background: '#fff', color: C.acento, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                  }}>Gestionar</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Panel de gestión (constancia) ──────────────────────────────────────────
function CobranzaDrawer({ fila, onClose }) {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dest, setDest] = useState('arrendatario')
  const [canal, setCanal] = useState('email')
  const [plantillaId, setPlantillaId] = useState('')
  const [asunto, setAsunto] = useState('')
  const [contenido, setContenido] = useState('')
  const [acuse, setAcuse] = useState('')
  const [resultado, setResultado] = useState('enviado')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  const tipo = fila.grupo === 'termino' ? 'termino' : 'vigente'
  const deuda = num(fila.deuda)

  function cargar() {
    setLoading(true)
    fetch('/api/cobranza/gestion?idadmon=' + encodeURIComponent(fila.idadmon))
      .then(r => r.json())
      .then(j => { setInfo(j); setLoading(false) })
      .catch(e => { setMsg('Error: ' + e); setLoading(false) })
  }
  useEffect(() => { cargar() }, [fila.idadmon])

  const contrato = info?.contrato || {}
  const gestiones = info?.gestiones || []
  const plantillas = info?.plantillas || []

  // avisos obligatorios
  const yaAval = gestiones.some(g => g.destinatario === 'aval')
  const yaProp = gestiones.some(g => g.destinatario === 'propietario')
  const avalPendiente = deuda > 0 && !yaAval
  const propPendiente = deuda > 0 && !yaProp

  function valores() {
    return {
      '{{arrendatario}}': contrato.arrendatario || fila.arrendatario || '',
      '{{aval}}': contrato.avalista || '',
      '{{propietario}}': contrato.propietario || fila.propietario || '',
      '{{propiedad}}': contrato.inmueble || fila.inmueble || '',
      '{{monto}}': num(deuda).toLocaleString('es-CL'),
      '{{dias_mora}}': String(fila.dias_mora ?? ''),
      '{{mes}}': mesActualTxt(),
    }
  }
  function render(t) { let s = String(t || ''); const v = valores(); for (const k in v) s = s.split(k).join(v[k]); return s }

  function elegirPlantilla(id) {
    setPlantillaId(id)
    const p = plantillas.find(x => String(x.id) === String(id))
    if (p) {
      if (p.destinatario) setDest(p.destinatario)
      if (p.canal) setCanal(p.canal)
      setAsunto(render(p.asunto))
      setContenido(render(p.cuerpo))
    }
  }

  const plantillasDest = plantillas.filter(p => p.destinatario === dest)

  async function guardar() {
    if (!contenido.trim()) { setMsg('Escribe o elige el contenido de la gestión.'); return }
    setGuardando(true); setMsg(null)
    const destNombre = dest === 'aval' ? contrato.avalista : dest === 'propietario' ? contrato.propietario : contrato.arrendatario
    const destRut = dest === 'aval' ? contrato.rut_avalista : dest === 'propietario' ? null : contrato.rut
    const p = plantillas.find(x => String(x.id) === String(plantillaId))
    const res = await fetch('/api/cobranza/gestion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idadmon: fila.idadmon, tipo, destinatario: dest, canal,
        etapa: p?.etapa || null, asunto, contenido, resultado, acuse,
        plantilla_id: plantillaId || null,
        destinatario_nombre: destNombre || null, destinatario_rut: destRut || null,
        monto_adeudado: deuda, dias_mora: fila.dias_mora ?? null,
        contrato: { propietario: contrato.propietario || fila.propietario, inmueble: contrato.inmueble || fila.inmueble,
          arrendatario: contrato.arrendatario || fila.arrendatario, rut: contrato.rut, avalista: contrato.avalista, rut_avalista: contrato.rut_avalista },
      }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }))
    setGuardando(false)
    if (res.error) { setMsg('Error: ' + res.error); return }
    setMsg('✓ Gestión registrada'); setContenido(''); setAsunto(''); setPlantillaId('')
    cargar()
  }

  const s = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300, display: 'flex', justifyContent: 'flex-end' },
    panel: { width: 560, maxWidth: '96vw', background: '#fff', height: '100vh', overflowY: 'auto', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)' },
    section: { padding: '14px 22px', borderBottom: '1px solid #F0EEE8' },
    lbl: { fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
    inp: { width: '100%', padding: '8px 10px', border: '1px solid #E0DDD8', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' },
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.panel}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #F0EEE8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#FAFAF8' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{fila.idadmon}</span>
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: C.rojoBg, color: C.rojo, fontWeight: 700 }}>{money(deuda)}</span>
              <span style={{ fontSize: 11, color: C.sub }}>{tipo === 'termino' ? 'término' : 'vigente'}{fila.dias_mora != null ? ' · ' + fila.dias_mora + 'd' : ''}</span>
            </div>
            <div style={{ fontSize: 13, color: '#555', marginTop: 3 }}>{fila.arrendatario || '—'}</div>
            <div style={{ fontSize: 11, color: '#999' }}>{fila.propietario || '—'} · {fila.inmueble || '—'}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#bbb' }}>×</button>
        </div>

        {/* Avisos obligatorios */}
        <div style={{ ...s.section, background: '#FFFDF6' }}>
          <div style={s.lbl}>Acciones que exige el sistema</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <AvisoRow ok={yaAval} pend={avalPendiente} txtPend="⚠ Reclamación al AVAL pendiente" txtOk="✓ Ya se reclamó al aval" />
            <AvisoRow ok={yaProp} pend={propPendiente} txtPend="⚠ Aviso al PROPIETARIO pendiente" txtOk="✓ Propietario ya avisado" />
          </div>
        </div>

        {/* Datos de contacto */}
        <div style={s.section}>
          <div style={s.lbl}>Contactos</div>
          {loading ? <div style={{ color: '#bbb', fontSize: 12 }}>Cargando…</div> : (
            <div style={{ fontSize: 12, color: '#444', lineHeight: 1.7 }}>
              <div><b>Arrendatario:</b> {contrato.arrendatario || '—'} · {contrato.rut || '—'} · {contrato.mail_arrendatario || 's/mail'} · {contrato.movil || ''}</div>
              <div><b>Aval:</b> {contrato.avalista || '—'} · {contrato.rut_avalista || '—'} · {contrato.mail_avalista || 's/mail'} · {contrato.telefono_avalista || ''}</div>
              <div><b>Propietario:</b> {contrato.propietario || fila.propietario || '—'}</div>
            </div>
          )}
        </div>

        {/* Registrar gestión */}
        <div style={s.section}>
          <div style={s.lbl}>Registrar gestión</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Destinatario</div>
              <select style={s.inp} value={dest} onChange={e => { setDest(e.target.value); setPlantillaId('') }}>
                {['arrendatario', 'aval', 'propietario'].map(d => <option key={d} value={d}>{DEST_LBL[d]}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Canal</div>
              <select style={s.inp} value={canal} onChange={e => setCanal(e.target.value)}>
                {CANALES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Plantilla</div>
            <select style={s.inp} value={plantillaId} onChange={e => elegirPlantilla(e.target.value)}>
              <option value="">— elegir plantilla —</option>
              {plantillasDest.map(p => <option key={p.id} value={p.id}>{p.etapa}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Asunto</div>
            <input style={s.inp} value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Asunto" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Contenido (queda como constancia exacta)</div>
            <textarea style={{ ...s.inp, height: 120, resize: 'vertical' }} value={contenido} onChange={e => setContenido(e.target.value)} placeholder="Texto de la gestión…" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Resultado</div>
              <select style={s.inp} value={resultado} onChange={e => setResultado(e.target.value)}>
                {['enviado', 'entregado', 'leido', 'compromiso', 'sin_respuesta', 'rechazado'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Acuse / referencia</div>
              <input style={s.inp} value={acuse} onChange={e => setAcuse(e.target.value)} placeholder="nº carta, captura, etc." />
            </div>
          </div>
          {msg && <div style={{ fontSize: 12, marginBottom: 8, color: msg.startsWith('✓') ? C.verde : C.rojo }}>{msg}</div>}
          <button onClick={guardar} disabled={guardando} style={{
            width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
            background: guardando ? '#ccc' : C.acento, color: '#fff', fontSize: 14, fontWeight: 700, cursor: guardando ? 'default' : 'pointer',
          }}>{guardando ? 'Guardando…' : 'Registrar gestión (constancia)'}</button>
        </div>

        {/* Historial */}
        <div style={s.section}>
          <div style={s.lbl}>Historial de gestiones ({gestiones.length})</div>
          {gestiones.length === 0 ? <div style={{ fontSize: 12, color: '#bbb' }}>Aún sin gestiones registradas.</div> : gestiones.map(g => (
            <div key={g.id} style={{ padding: '9px 0', borderBottom: '1px solid #F5F3EF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{DEST_LBL[g.destinatario] || g.destinatario} · {g.canal}</span>
                <span style={{ fontSize: 11, color: C.sub }}>{fechaHoraLocal(g.fecha)}</span>
              </div>
              {g.asunto && <div style={{ fontSize: 12, color: '#444', marginTop: 2 }}>{g.asunto}</div>}
              <div style={{ fontSize: 11, color: '#777', marginTop: 2, whiteSpace: 'pre-wrap' }}>{g.contenido_snapshot}</div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>{g.etapa || ''} · {g.resultado || ''} · {g.usuario}{g.acuse ? ' · acuse: ' + g.acuse : ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AvisoRow({ ok, pend, txtPend, txtOk }) {
  if (ok) return <div style={{ fontSize: 12, color: C.verde, fontWeight: 600 }}>{txtOk}</div>
  if (pend) return <div style={{ fontSize: 12, color: C.rojo, fontWeight: 700 }}>{txtPend}</div>
  return <div style={{ fontSize: 12, color: C.sub }}>—</div>
}

// ─── Bitácora global ────────────────────────────────────────────────────────
function Bitacora() {
  const [gestiones, setGestiones] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/cobranza/gestion?log=1').then(r => r.json())
      .then(j => { if (j.error) setError(j.error); else setGestiones(j.gestiones || []) })
      .catch(e => setError(String(e)))
  }, [])

  if (error) return <div style={{ padding: 20, color: C.rojo, fontSize: 13 }}>Error: {error}</div>
  if (!gestiones) return <div style={{ padding: 40, textAlign: 'center', color: C.sub }}>Cargando bitácora…</div>
  if (!gestiones.length) return <div style={{ padding: 24, color: C.sub, fontSize: 13 }}>Aún no hay gestiones registradas.</div>

  const th = { fontSize: 11, fontWeight: 600, color: C.sub, textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid ' + C.line, whiteSpace: 'nowrap' }
  const td = { fontSize: 12, padding: '8px 10px', borderBottom: '0.5px solid ' + C.line, verticalAlign: 'top' }

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Bitácora de gestiones · {gestiones.length}</div>
      <div style={{ overflowX: 'auto', border: '0.5px solid ' + C.line, borderRadius: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}>
          <thead><tr>
            <th style={th}>Fecha</th><th style={th}>IDADMON</th><th style={th}>Destinatario</th>
            <th style={th}>Canal</th><th style={th}>Etapa</th><th style={th}>Asunto</th>
            <th style={th}>Resultado</th><th style={th}>Usuario</th>
          </tr></thead>
          <tbody>
            {gestiones.map(g => (
              <tr key={g.id}>
                <td style={{ ...td, whiteSpace: 'nowrap', color: C.sub }}>{fechaHoraLocal(g.fecha)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{g.idadmon}</td>
                <td style={td}>{DEST_LBL[g.destinatario] || g.destinatario}</td>
                <td style={td}>{g.canal}</td>
                <td style={td}>{g.etapa || '—'}</td>
                <td style={{ ...td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.asunto || '—'}</td>
                <td style={td}>{g.resultado || '—'}</td>
                <td style={{ ...td, color: C.sub }}>{g.usuario}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
