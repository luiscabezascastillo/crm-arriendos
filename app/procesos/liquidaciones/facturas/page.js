'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'

// Acceso: Dirección (Alberto, Luis) + Karina (Finanzas)
const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const aammToTxt = aamm => { if (!aamm || String(aamm).length !== 4) return aamm; const a = String(aamm).slice(0, 2), m = parseInt(String(aamm).slice(2), 10); return `${MESES_TXT[m - 1] || '?'} 20${a}` }
function mesEnCurso() {
  const d = new Date()
  const a = String(d.getFullYear()).slice(2)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${a}${m}`
}
// Lista de meses para el selector (12 hacia atrás desde el actual)
function listaMeses() {
  const out = []
  const d = new Date()
  for (let i = 0; i < 14; i++) {
    const a = String(d.getFullYear()).slice(2)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    out.push(`${a}${m}`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

const fmtPesos = n => (n == null || n === '') ? '—' : Number(n).toLocaleString('es-CL')

// Etiqueta legible del tipo de documento SimpleFactura
const TIPO_DOC = { '33': 'Factura', '39': 'Boleta', '41': 'Boleta exenta' }
const tipoColor = t => t === '33' ? { bg: '#EEF2FF', fg: '#3730A3' }      // factura -> índigo
  : t === '39' ? { bg: '#ECFDF5', fg: '#065F46' }                          // boleta -> verde
  : t === '41' ? { bg: '#FEF9C3', fg: '#854D0E' }                          // exenta -> ámbar
  : { bg: '#F3F4F6', fg: '#6B7280' }                                       // desconocido -> gris

export default function FacturasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email || ''
  const rol = session?.user?.role || ''

  const [accesoOk, setAccesoOk] = useState(null)
  const [mes, setMes] = useState(mesEnCurso())
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [filas, setFilas] = useState([])          // filas ordenadas Propietario -> Inmueble
  const [actualizado, setActualizado] = useState(null)
  const [buscar, setBuscar] = useState('')

  // control de acceso
  useEffect(() => {
    if (status !== 'authenticated' || !email) return
    if (rol === 'admin' || DIRECCION_EMAILS.includes(email)) { setAccesoOk(true); return }
    supabase.from('proceso_permisos').select('proceso').eq('email', email).eq('activo', true)
      .then(({ data }) => setAccesoOk(!!(data || []).some(p => (p.proceso || '').toLowerCase().includes('liquidac'))))
  }, [status, email, rol])
  useEffect(() => { if (accesoOk === false) router.replace('/') }, [accesoOk, router])
  useEffect(() => { if (accesoOk === true) cargar(mes) }, [accesoOk])

  async function cargar(m) {
    setCargando(true); setError(null); setFilas([])
    try {
      // 1) Motor de liquidación del mes (mismos datos que TRANSFER/CARTAS)
      const { data: liq, error: e1 } = await supabase.rpc('calcular_liquidacion', { p_mes: m })
      if (e1) { setError(e1.message); setCargando(false); return }
      const rows = (liq || []).filter(r => !String(r.inmueble || '').startsWith('[proporcional')) // el proporcional no factura como línea aparte
      if (rows.length === 0) { setFilas([]); setActualizado(new Date()); setCargando(false); return }

      const ids = [...new Set(rows.map(r => r.idadmon))]
      const idprops = [...new Set(rows.map(r => r.idprop))]

      // 2) datos_arriendos (para estado) y propietarios (tipo_factura, rut, direccion, comuna, mail)
      const [rArr, rProps] = await Promise.all([
        supabase.from('datos_arriendos').select('idadmon, estado').in('idadmon', ids),
        supabase.from('propietarios').select('idprop, propietario, tipo_factura, rut, direccion, comuna, mail1, email_2').in('idprop', idprops),
      ])
      const estadoDe = {}
      for (const d of rArr.data || []) estadoDe[d.idadmon] = (d.estado || '').toUpperCase()
      const propDe = {}
      for (const p of rProps.data || []) propDe[p.idprop] = p

      // 3) construir filas: una por línea de liquidación (idadmon)
      const out = rows.map(r => {
        const p = propDe[r.idprop] || {}
        return {
          idadmon: r.idadmon,
          idprop: r.idprop,
          propietario: r.propietario || p.propietario || '',
          inmueble: r.inmueble || '',
          estado: estadoDe[r.idadmon] || '',
          a_cobrar: r.base,
          admon: r.comision,
          iva: r.iva_comision,
          tipo_factura: (p.tipo_factura || '').toString().trim(),
          rut: p.rut || '',
          direccion: p.direccion || '',
          comuna: p.comuna || '',
          mail: p.mail1 || p.email_2 || '',
        }
      })

      // 4) ORDEN: por Propietario, y dentro por Inmueble (como el Excel)
      out.sort((a, b) => {
        const pa = (a.propietario || '').localeCompare(b.propietario || '', 'es', { sensitivity: 'base' })
        if (pa !== 0) return pa
        return (a.inmueble || '').localeCompare(b.inmueble || '', 'es', { sensitivity: 'base' })
      })

      setFilas(out)
      setActualizado(new Date())
    } catch (err) {
      setError(String(err?.message || err))
    }
    setCargando(false)
  }

  if (accesoOk === null || status === 'loading') {
    return <div style={{ padding: 40, fontSize: 14, color: '#666' }}>Comprobando acceso…</div>
  }
  if (accesoOk === false) return null

  // Filtro de búsqueda (propietario / inmueble / idadmon)
  const q = buscar.trim().toLowerCase()
  const visibles = q
    ? filas.filter(f => (f.propietario + ' ' + f.inmueble + ' ' + f.idadmon + ' ' + f.idprop).toLowerCase().includes(q))
    : filas

  // Totales para las tarjetas
  const totAdmon = visibles.reduce((s, f) => s + (Number(f.admon) || 0), 0)
  const totIva = visibles.reduce((s, f) => s + (Number(f.iva) || 0), 0)
  const nFactura = visibles.filter(f => f.tipo_factura === '33').length
  const nBoleta = visibles.filter(f => f.tipo_factura === '39' || f.tipo_factura === '41').length

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px 60px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Barra de navegación entre vistas (mismo estilo que las otras) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <button onClick={() => router.push('/procesos/liquidaciones')}
          style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#2C2C2A', cursor: 'pointer' }}>
          ← TRANSFER
        </button>
        <button onClick={() => router.push('/procesos/liquidaciones/cartas')}
          style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#3730A3', cursor: 'pointer' }}>
          📄 CARTAS
        </button>
        <button onClick={() => router.push('/procesos/liquidaciones/faltan')}
          style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer' }}>
          ⚠ FALTAN
        </button>
        <button onClick={() => router.push('/procesos/liquidaciones/emails')}
          style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#065F46', cursor: 'pointer' }}>
          ✉ EMAILS
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>🧾 FACTURAS · preparación SimpleFactura</h1>
      </div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
        Preparación de la facturación de <b>{aammToTxt(mes)}</b> por propietario e inmueble (comisión de administración).
        {actualizado && <> Actualizado el <b>{actualizado.toLocaleString('es-CL')}</b>.</>}
      </div>

      {/* Controles: mes + recalcular + buscar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ fontSize: 14, color: '#444' }}>Mes:</label>
        <select value={mes} onChange={e => setMes(e.target.value)}
          style={{ fontSize: 14, padding: '7px 10px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff' }}>
          {listaMeses().map(m => <option key={m} value={m}>{aammToTxt(m)}</option>)}
        </select>
        <button onClick={() => cargar(mes)} disabled={cargando}
          style={{ fontSize: 14, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: cargando ? 'default' : 'pointer', opacity: cargando ? 0.6 : 1 }}>
          {cargando ? '⏳ Cargando…' : '🔄 Recalcular'}
        </button>
        <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar propietario, inmueble, IDADMON…"
          style={{ fontSize: 14, padding: '8px 12px', borderRadius: 8, border: '1px solid #D3D1C7', minWidth: 260, flex: '0 1 320px' }} />
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>Error: {error}</div>}

      {/* Tarjetas resumen */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: '1 1 160px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 13, color: '#6D28D9' }}>Líneas a facturar</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#5B21B6' }}>{visibles.length}</div>
        </div>
        <div style={{ flex: '1 1 160px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 13, color: '#3730A3' }}>Facturas (33)</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#3730A3' }}>{nFactura}</div>
        </div>
        <div style={{ flex: '1 1 160px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 13, color: '#065F46' }}>Boletas (39/41)</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#065F46' }}>{nBoleta}</div>
        </div>
        <div style={{ flex: '1 1 160px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 13, color: '#6B7280' }}>Admon (comisión)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>${fmtPesos(totAdmon)}</div>
        </div>
        <div style={{ flex: '1 1 160px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 13, color: '#6B7280' }}>IVA</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>${fmtPesos(totIva)}</div>
        </div>
      </div>

      {/* Tabla, ordenada por Propietario -> Inmueble */}
      <div style={{ overflowX: 'auto', border: '1px solid #ECEAE3', borderRadius: 12 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, minWidth: 1100 }}>
          <thead>
            <tr style={{ background: '#1a1a2e', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', fontWeight: 600 }}>IdAdmon</th>
              <th style={{ padding: '10px 12px', fontWeight: 600 }}>IdProp</th>
              <th style={{ padding: '10px 12px', fontWeight: 600 }}>Propietario</th>
              <th style={{ padding: '10px 12px', fontWeight: 600 }}>Inmueble</th>
              <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>A cobrar</th>
              <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Admon</th>
              <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>IVA</th>
              <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>Tipo doc.</th>
              <th style={{ padding: '10px 12px', fontWeight: 600 }}>RUT</th>
              <th style={{ padding: '10px 12px', fontWeight: 600 }}>Comuna</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && !cargando && (
              <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Sin datos para {aammToTxt(mes)}.</td></tr>
            )}
            {visibles.map((f, i) => {
              const prev = visibles[i - 1]
              const nuevoProp = !prev || prev.idprop !== f.idprop   // primera fila de cada propietario
              const tc = tipoColor(f.tipo_factura)
              return (
                <tr key={f.idadmon + '_' + i} style={{
                  borderTop: nuevoProp ? '2px solid #DDD6FE' : '1px solid #F0EEE8',
                  background: nuevoProp ? '#FBFAFF' : '#fff'
                }}>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1a1a2e' }}>{f.idadmon}</td>
                  <td style={{ padding: '9px 12px', color: '#666' }}>{f.idprop}</td>
                  <td style={{ padding: '9px 12px', fontWeight: nuevoProp ? 600 : 400, color: '#1a1a2e' }}>{f.propietario}</td>
                  <td style={{ padding: '9px 12px', color: '#444' }}>{f.inmueble}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#666' }}>{fmtPesos(f.a_cobrar)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600 }}>{fmtPesos(f.admon)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#666' }}>{fmtPesos(f.iva)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: tc.bg, color: tc.fg, whiteSpace: 'nowrap' }}>
                      {f.tipo_factura || '?'}{TIPO_DOC[f.tipo_factura] ? ' · ' + TIPO_DOC[f.tipo_factura] : ''}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', color: '#666' }}>{f.rut || '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#666' }}>{f.comuna || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 12 }}>
        Vista de preparación. La generación del CSV para SimpleFactura (correlativos, IVA de boletas, marca de facturado) se añadirá en la siguiente fase.
      </div>
    </div>
  )
}
