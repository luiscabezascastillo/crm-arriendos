// VERSION: v2 · 2026-07-15 · Gate: subir cartola es SOLO Karina + Dirección (EDIT_EMAILS). Quien no
//   esté en la lista se redirige a /procesos/bi/movimientos (que sí puede ver: son cuentas de clientes).
//   No cambia nada de la lógica de carga/preview/guardado.
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import TopNav from '@/app/components/ui/TopNav'

// ── Quién puede SUBIR cartola: Karina + Dirección (misma lista que la edición del BI). ──
// El resto del equipo puede VER movimientos, pero NO subir aquí. Match normalizado
// (minúsculas/sin espacios) para evitar el problema del "email exacto".
const SUBIR_EMAILS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]

// serial de Excel -> dd/mm/aaaa
function serialAFecha(n) {
  const d = new Date(Math.round((n - 25569) * 86400 * 1000))
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}
const fmt = (n) => Number(n || 0).toLocaleString('es-CL')

function parseCartola(aoa) {
  // localizar la fila de cabecera (primera celda 'Fecha')
  let h = -1
  for (let i = 0; i < aoa.length; i++) {
    if (String(aoa[i]?.[0] || '').trim().toLowerCase() === 'fecha') { h = i; break }
  }
  if (h === -1) throw new Error('No se encontró la cabecera "Fecha / Detalle / Nº Documento…". ¿Es la cartola del BI?')
  const movs = []
  for (let i = h + 1; i < aoa.length; i++) {
    const row = aoa[i] || []
    let fecha = row[0]
    if (fecha == null || String(fecha).trim() === '') continue
    if (typeof fecha === 'number') fecha = serialAFecha(fecha)
    const ndoc = row[2]
    if (ndoc == null || String(ndoc).trim() === '') continue
    movs.push({
      fecha: String(fecha).trim(),
      detalle: String(row[1] || '').trim(),
      ndoc: Number(ndoc),
      cargo: Number(row[3] || 0),
      abono: Number(row[4] || 0),
      saldo: Number(row[5] || 0),
    })
  }
  return movs
}

function Chip({ label, valor, color }) {
  return (
    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: color?.bg || '#F1EFE8', color: color?.color || '#5F5E5A' }}>
      {label}: <b>{valor}</b>
    </span>
  )
}

export default function BancoInternacionalPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  // ¿Puede subir cartola? (Karina + Dirección). Normalizado.
  const emailSesion = (session?.user?.email || '').trim().toLowerCase()
  const puedeSubir = SUBIR_EMAILS.includes(emailSesion)
  const [isMobile, setIsMobile] = useState(false)
  const [movs, setMovs] = useState([])
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [preview, setPreview] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [guardadoOk, setGuardadoOk] = useState(null)
  const [cargas, setCargas] = useState([])   // historial de últimas cargas

  const cargarHistorial = async () => {
    try {
      const r = await fetch('/api/bi/cargas')
      const d = await r.json()
      setCargas(d.cargas || [])
    } catch {}
  }
  useEffect(() => { cargarHistorial() }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])
  // Gate: si la sesión está lista y NO puede subir, lo mandamos a movimientos (que sí puede ver).
  useEffect(() => {
    if (status === 'authenticated' && !puedeSubir) router.replace('/procesos/bi/movimientos')
  }, [status, puedeSubir, router])

  const llamar = async (movimientos, guardar) => {
    const r = await fetch('/api/bi/cartola', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movimientos, guardar }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error || 'Error en el servidor')
    return d
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setGuardadoOk(null); setPreview(null); setMovs([]); setNombreArchivo(file.name); setCargando(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
      const parsed = parseCartola(aoa)
      if (parsed.length === 0) throw new Error('No se encontraron movimientos en el archivo.')
      setMovs(parsed)
      const d = await llamar(parsed, false)   // previsualizar
      setPreview(d)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
      e.target.value = ''  // permitir recargar el mismo archivo
    }
  }

  const guardar = async () => {
    if (!movs.length) return
    setCargando(true); setError(null)
    try {
      const d = await llamar(movs, true)
      setPreview(d)
      setGuardadoOk(`${d.guardados} movimiento(s) guardado(s) en bi_movimientos.`)
      // registrar la carga en el historial (no bloquea si falla)
      try {
        await fetch('/api/bi/cargas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guardados: d.guardados, total: movs.length, archivo: nombreArchivo }),
        })
        cargarHistorial()
      } catch {}
    } catch (err) {
      setError(err.message)
    } finally { setCargando(false) }
  }

  if (status === 'loading' || !puedeSubir) {
    return (<><TopNav /><div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>{status === 'loading' ? 'Cargando…' : 'Redirigiendo…'}</div></>)
  }

  const r = preview?.resumen
  const integridad = preview?.integridad

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: isMobile ? '16px 14px 40px' : '20px 24px 40px' }}>

        {/* CABECERA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 600, margin: '0 0 2px', color: '#2C2C2A' }}>BI · Banco Internacional</h1>
            <div style={{ fontSize: 12, color: '#888780' }}>Cargar cartola, deduplicar por Nº Documento y sugerir IDADMON</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => router.push('/procesos/bi/movimientos')}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>
              Ver BI guardado →
            </button>
            <button onClick={() => router.push('/procesos')}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>
              ← Procesos
            </button>
          </div>
        </div>

        {/* ZONA DE CARGA */}
        <div style={{ border: '1px dashed #B4B2A9', borderRadius: 10, padding: isMobile ? 16 : 22, background: '#fff', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#5F5E5A', marginBottom: 10 }}>
            Sube la cartola descargada del Banco Internacional (.xls / .xlsx)
          </div>
          <label style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
            Seleccionar archivo
            <input type="file" accept=".xls,.xlsx" onChange={onFile} style={{ display: 'none' }} />
          </label>
          {nombreArchivo && <div style={{ fontSize: 12, color: '#888780', marginTop: 8 }}>{nombreArchivo}</div>}
        </div>

        {/* ÚLTIMAS CARGAS (historial) */}
        {cargas.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#5F5E5A', marginBottom: 6 }}>Últimas cargas al BI</div>
            <div style={{ border: '0.5px solid #E3E1DA', borderRadius: 8, overflow: 'hidden' }}>
              {cargas.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 12px', fontSize: 12, borderTop: i ? '0.5px solid #F0EEE8' : 'none', background: i % 2 ? '#FCFCFB' : '#fff' }}>
                  <span style={{ color: '#5F5E5A', minWidth: 148, fontVariantNumeric: 'tabular-nums' }}>{new Date(c.creado).toLocaleString('es-CL')}</span>
                  <span style={{ color: c.guardados > 0 ? '#085041' : '#888780', fontWeight: 600, minWidth: 78, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.guardados} nuevo(s)</span>
                  <span style={{ color: '#888780' }}>de {c.total}</span>
                  <span style={{ color: '#888780', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.archivo || ''}>{c.archivo || '—'}</span>
                  <span style={{ color: '#888780', whiteSpace: 'nowrap' }}>{(c.usuario || '').split('@')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {cargando && <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>Procesando…</div>}

        {error && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: '#FDECEC', border: '0.5px solid #F1B0B0', color: '#9B1C1C', fontSize: 13 }}>
            {error}
          </div>
        )}

        {guardadoOk && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: '#E1F5EE', border: '0.5px solid #9BD7C2', color: '#085041', fontSize: 13 }}>
            ✓ {guardadoOk}
          </div>
        )}

        {/* RESUMEN + PREVIEW */}
        {preview && (
          <div style={{ marginTop: 16 }}>
            {/* integridad */}
            <div style={{ marginBottom: 10, padding: '8px 14px', borderRadius: 8, fontSize: 13,
              background: integridad?.intacta ? '#E1F5EE' : '#FDECEC',
              border: `0.5px solid ${integridad?.intacta ? '#9BD7C2' : '#F1B0B0'}`,
              color: integridad?.intacta ? '#085041' : '#9B1C1C' }}>
              {integridad?.intacta
                ? '✓ Integridad OK — la cadena de saldos cuadra, no faltan líneas.'
                : `⚠ Cadena de saldos con ${integridad?.roturas?.length} rotura(s): revisar el archivo antes de guardar.`}
            </div>

            {/* chips resumen */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <Chip label="Recibidos" valor={r.recibidos} />
              <Chip label="Nuevos" valor={r.nuevos} color={{ bg: '#E1F5EE', color: '#085041' }} />
              <Chip label="Duplicados" valor={r.duplicados} />
              <Chip label="Sugeridos" valor={r.sugeridos} color={{ bg: '#E6F1FB', color: '#0C447C' }} />
              <Chip label="Ambiguos" valor={r.ambiguos} color={{ bg: '#FAEEDA', color: '#633806' }} />
              <Chip label="Sin match" valor={r.sin_match} color={{ bg: '#FDECEC', color: '#9B1C1C' }} />
            </div>

            {/* botón guardar */}
            {!preview.guardado && r.nuevos > 0 && (
              <button onClick={guardar} disabled={cargando}
                style={{ fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer', marginBottom: 14 }}>
                Guardar {r.nuevos} movimiento(s) nuevo(s)
              </button>
            )}
            {r.nuevos === 0 && (
              <div style={{ fontSize: 13, color: '#888780', marginBottom: 14 }}>No hay movimientos nuevos (todos ya estaban cargados).</div>
            )}

            {/* tabla */}
            {r.nuevos > 0 && (
              <div style={{ overflowX: 'auto', border: '0.5px solid #D3D1C7', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr style={{ background: '#F1EFE8', color: '#5F5E5A', textAlign: 'left' }}>
                      <th style={{ padding: '7px 9px' }}>Fecha</th>
                      <th style={{ padding: '7px 9px' }}>Detalle</th>
                      <th style={{ padding: '7px 9px', textAlign: 'right' }}>Cargo</th>
                      <th style={{ padding: '7px 9px', textAlign: 'right' }}>Abono</th>
                      <th style={{ padding: '7px 9px' }}>RUT</th>
                      <th style={{ padding: '7px 9px' }}>Sugerido (UNIQUE CONCEPT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.movimientos.map((m, i) => (
                      <tr key={i} style={{ borderTop: '0.5px solid #F0EEE8' }}>
                        <td style={{ padding: '6px 9px', whiteSpace: 'nowrap' }}>{m.fecha}</td>
                        <td style={{ padding: '6px 9px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.detalle}</td>
                        <td style={{ padding: '6px 9px', textAlign: 'right', color: m.cargo ? '#9B1C1C' : '#D3D1C7' }}>{m.cargo ? fmt(m.cargo) : '—'}</td>
                        <td style={{ padding: '6px 9px', textAlign: 'right', color: m.abono ? '#085041' : '#D3D1C7' }}>{m.abono ? fmt(m.abono) : '—'}</td>
                        <td style={{ padding: '6px 9px', whiteSpace: 'nowrap' }}>{m.rut || '—'}</td>
                        <td style={{ padding: '6px 9px' }}>
                          {m.idadmon_sugerido
                            ? <span style={{ fontWeight: 600, color: m.ambiguo ? '#633806' : '#085041' }}>
                                {m.idadmon_sugerido}{m.ambiguo && m.candidatos ? ` · (${m.candidatos.replace(/\|/g, ', ')})` : ''}
                              </span>
                            : <span style={{ color: '#B4B2A9' }}>{m.tipo === 'cargo' ? '(cargo)' : (m.nota || '—')}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  )
}