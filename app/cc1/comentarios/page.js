// VERSION: v4 · 2026-08-10 · FIX permisos de Dirección: la detección usaba rol === 'admin' (código muerto), por lo que
//   Dirección NUNCA podía editar/borrar comentarios de otros. Ahora Dirección se reconoce por rol 'direccion' o por ser
//   uno de los correos de Dirección (Alberto/Luis/Karina) → puede editar/borrar CUALQUIER comentario. Hereda v3.
// VERSION: v3 · 2026-07-28 · "Reutilizar" comentarios de meses anteriores: por contrato, un
//   desplegable "Ver comentarios anteriores" carga bajo demanda su historial (otros meses) y
//   junto a cada uno un botón que copia el texto al campo de añadir (editable antes de guardar).
// VERSION: v2 · 2026-07-28 · El bloqueo NO depende del calendario, sino de si la liquidación de
//   ese mes está CONGELADA (liquidacion_idprop: todas las filas del mes con cerrado=true).
//   Se puede comentar cualquier mes no congelado —el actual y los futuros— hasta el momento en
//   que se congela. Los comentarios de un mes futuro se aplican solos cuando llega su liquidación.
//   Reglas de edición: ver y añadir, todos; editar/borrar, cada uno lo suyo; Dirección, todo.
//   La columna mes es NOT NULL: aquí siempre se envía, nunca vacío.
// v1 · Comentarios por contrato, con regla del día 23 (sustituida por la de congelado).
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import TopNav from '../../components/ui/TopNav'

// Dirección puede editar/borrar CUALQUIER comentario; el resto solo los suyos.
// OJO: 'admin' NO existe como rol (código muerto). Dirección se reconoce por el rol real
// 'direccion' o por ser uno de los correos de Dirección (Alberto y Luis).
// (Si más adelante Karina también debe editar todo, añadir su correo aquí.)
const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']

const aAAMM = (d) => String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0')
const MES_LARGO = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const etiquetaMes = (d) => `${MES_LARGO[d.getMonth()]} ${d.getFullYear()}`
const desdeAAMM = (aamm) => new Date(2000 + Number(aamm.slice(0, 2)), Number(aamm.slice(2)) - 1, 1)

const HORIZONTE = 12   // cuántos meses hacia delante se ofrecen en el selector

// Meses seleccionables = los NO congelados, desde el primer mes abierto en adelante.
// 'congelados' es un Set de AAMM ya cerrados (viene de liquidacion_idprop).
function mesesDisponibles(congelados) {
  // Punto de partida: el mes natural de hoy (por AAMM), pero saltando los que estén congelados.
  const hoy = new Date()
  const out = []
  let d = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  for (let i = 0; out.length < 6 && i < HORIZONTE + 6; i++) {
    const aamm = aAAMM(d)
    if (!congelados.has(aamm)) out.push({ aamm, label: etiquetaMes(d) })
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  }
  return out
}

const fmtFecha = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function ComentariosPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const email = session?.user?.email || ''
  const rol = session?.user?.role || ''
  const persona = (session?.user?.name || email.split('@')[0] || '').trim()
  const esDireccion = rol === 'direccion' || DIRECCION_EMAILS.includes(email)

  const [congelados, setCongelados] = useState(new Set())
  const meses = useMemo(() => mesesDisponibles(congelados), [congelados])
  const [mesSel, setMesSel] = useState('')
  const mesLabel = meses.find((m) => m.aamm === mesSel)?.label || (mesSel ? etiquetaMes(desdeAAMM(mesSel)) : '')

  const [contratos, setContratos] = useState([])       // contratos activos del LOG (S/SQ/P)
  const [comentarios, setComentarios] = useState([])   // los del mes seleccionado
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [busca, setBusca] = useState('')
  const [borrador, setBorrador] = useState({})         // texto en curso por idadmon
  const [histAbierto, setHistAbierto] = useState({})   // idadmon -> bool (desplegable abierto)
  const [histDatos, setHistDatos] = useState({})       // idadmon -> array de comentarios de otros meses
  const [histCargando, setHistCargando] = useState({})
  const [editando, setEditando] = useState(null)       // id del hecho en edición
  const [editTexto, setEditTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  // ── Qué meses están congelados: un mes lo está si TODAS sus filas de liquidacion_idprop
  //    tienen cerrado=true. Se lee una vez al entrar. ──
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('liquidacion_idprop')
        .select('mes, cerrado')
      if (error) return
      const porMes = {}
      for (const r of (data || [])) {
        const m = porMes[r.mes] || { total: 0, cerradas: 0 }
        m.total++; if (r.cerrado) m.cerradas++
        porMes[r.mes] = m
      }
      const set = new Set(Object.entries(porMes).filter(([, v]) => v.total > 0 && v.cerradas === v.total).map(([k]) => k))
      setCongelados(set)
    })()
  }, [])

  // Cuando ya sabemos los meses disponibles, seleccionar el primero (el mes abierto más próximo).
  useEffect(() => {
    if (!mesSel && meses.length) setMesSel(meses[0].aamm)
  }, [meses, mesSel])

  // ── Carga: contratos activos + comentarios del mes ──
  const cargar = async (mes = mesSel) => {
    setCargando(true); setError(null)
    try {
      const [rc, rk] = await Promise.all([
        supabase
          .from('datos_arriendos')
          .select('idadmon, propietario, inmueble, estado, idprop')
          .in('estado', ['S', 'SQ', 'P'])
          .order('idadmon'),
        supabase
          .from('comentarios_liquidacion')
          .select('id, idadmon, comentario, persona, created_at, mes')
          .eq('mes', mes)
          .order('created_at'),
      ])
      if (rc.error) throw new Error('contratos: ' + rc.error.message)
      if (rk.error) throw new Error('comentarios: ' + rk.error.message)
      setContratos(rc.data || [])
      setComentarios(rk.data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { if (mesSel) cargar(mesSel) /* eslint-disable-next-line */ }, [mesSel])

  // Hechos agrupados por contrato
  const porContrato = useMemo(() => {
    const m = {}
    for (const c of comentarios) (m[c.idadmon] = m[c.idadmon] || []).push(c)
    return m
  }, [comentarios])

  // Filtro por búsqueda; si no hay búsqueda, se muestran solo los que ya tienen algún hecho,
  // más el buscador para añadir a cualquiera. Con 200+ contratos, no se vuelca todo de golpe.
  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (q) {
      return contratos.filter((c) =>
        [c.idadmon, c.propietario, c.inmueble].some((x) => String(x || '').toLowerCase().includes(q))
      ).slice(0, 100)
    }
    // Sin búsqueda: los que tienen comentario este mes (para repasarlos), ordenados por idadmon.
    return contratos.filter((c) => porContrato[c.idadmon]?.length)
  }, [contratos, busca, porContrato])

  const puedeTocar = (c) => esDireccion || (c.persona || '') === persona

  // ── Añadir un hecho ──
  // Carga (una vez) los comentarios de OTROS meses de este contrato, para reutilizarlos.
  const abrirHistorial = async (idadmon) => {
    const abierto = !histAbierto[idadmon]
    setHistAbierto((h) => ({ ...h, [idadmon]: abierto }))
    if (!abierto || histDatos[idadmon]) return   // ya cargado o cerrando
    setHistCargando((h) => ({ ...h, [idadmon]: true }))
    const { data } = await supabase
      .from('comentarios_liquidacion')
      .select('id, comentario, persona, mes, para_mes_txt, created_at')
      .eq('idadmon', idadmon)
      .neq('mes', mesSel)                    // todo lo que NO sea el mes en curso
      .neq('mes', '------')                  // fuera la papelera
      .order('created_at', { ascending: false })
    setHistDatos((h) => ({ ...h, [idadmon]: data || [] }))
    setHistCargando((h) => ({ ...h, [idadmon]: false }))
  }

  // Reutilizar: copia el texto al campo de añadir de ese contrato (NO guarda; editable).
  const reutilizar = (idadmon, texto) => {
    if (congelados.has(mesSel)) { setError('La liquidación de ' + mesLabel + ' está cerrada: no admite comentarios.'); return }
    // Copia al campo de añadir; queda editable. Si ya había texto, lo reemplaza.
    setBorrador((b) => ({ ...b, [idadmon]: texto }))
  }

  const añadir = async (idadmon) => {
    const texto = (borrador[idadmon] || '').trim()
    if (!texto || guardando) return
    if (congelados.has(mesSel)) { setError('La liquidación de ' + mesLabel + ' ya está cerrada: no admite comentarios.'); return }
    const contrato = contratos.find((c) => c.idadmon === idadmon)
    setGuardando(true); setError(null)
    try {
      const fila = {
        idadmon,
        mes: mesSel,                       // NOT NULL garantizado: siempre hay mes seleccionado
        para_mes_txt: mesLabel,
        comentario: texto,
        persona,
        fecha: new Date().toISOString().slice(0, 10),
        estado: contrato?.estado || null,
        propietario: contrato?.propietario || null,
        idprop: contrato?.idprop || null,
        inmueble: contrato?.inmueble || null,
      }
      const { data, error } = await supabase.from('comentarios_liquidacion').insert(fila).select().single()
      if (error) throw new Error(error.message)
      setComentarios((cs) => [...cs, data])
      setBorrador((b) => ({ ...b, [idadmon]: '' }))
    } catch (e) {
      setError('No se pudo guardar: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  // ── Editar un hecho ──
  const guardarEdicion = async (hecho) => {
    const texto = editTexto.trim()
    if (!texto) return
    setGuardando(true); setError(null)
    try {
      const { error } = await supabase.from('comentarios_liquidacion').update({ comentario: texto }).eq('id', hecho.id)
      if (error) throw new Error(error.message)
      setComentarios((cs) => cs.map((c) => (c.id === hecho.id ? { ...c, comentario: texto } : c)))
      setEditando(null); setEditTexto('')
    } catch (e) {
      setError('No se pudo editar: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  // ── Borrar un hecho ──
  const borrar = async (hecho) => {
    if (!confirm('¿Borrar este comentario?')) return
    setGuardando(true); setError(null)
    try {
      const { error } = await supabase.from('comentarios_liquidacion').delete().eq('id', hecho.id)
      if (error) throw new Error(error.message)
      setComentarios((cs) => cs.filter((c) => c.id !== hecho.id))
    } catch (e) {
      setError('No se pudo borrar: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  const totalHechos = comentarios.length
  const contratosConComentario = Object.keys(porContrato).length

  return (
    <>
      <TopNav />
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border, #E5E3DC)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/cc1')}
          style={{ fontSize: 13, color: 'var(--gray-500, #888)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>‹ Volver al LOG</button>
        <span style={{ color: 'var(--gray-300, #ccc)' }}>|</span>
        <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--gray-900, #2C2C2A)' }}>Comentarios de liquidación</h1>
      </div>

      <div style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>

        {/* Barra: mes + buscador */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, color: 'var(--gray-600, #666)' }}>Mes de liquidación</label>
          <select value={mesSel} onChange={(e) => setMesSel(e.target.value)}
            style={{ fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border, #D3D1C7)', fontFamily: 'inherit', color: 'var(--gray-800, #333)' }}>
            {meses.map((m, i) => (
              <option key={m.aamm} value={m.aamm}>{m.label}{i === 0 ? ' · próximo a liquidar' : ''}</option>
            ))}
          </select>
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar contrato: IDADMON, propietario o inmueble…"
            style={{ flex: '1 1 320px', fontSize: 13, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border, #D3D1C7)', fontFamily: 'inherit' }} />
        </div>

        <div style={{ fontSize: 12, color: 'var(--gray-400, #999)', marginBottom: 16 }}>
          {mesLabel} · {contratosConComentario} contrato(s) con comentario · {totalHechos} hecho(s) en total.
          {' '}Se puede comentar cualquier mes cuya liquidación no esté cerrada; deja de admitir cambios al congelarse.
        </div>

        {error && (
          <div style={{ background: '#FDECEC', border: '1px solid #F1B0B0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#9B1C1C', marginBottom: 16 }}>{error}</div>
        )}

        {cargando ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400, #999)', fontSize: 14 }}>Cargando…</div>
        ) : (
          <>
            {!busca && contratosConComentario === 0 && (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--gray-500, #888)', fontSize: 14, background: 'var(--gray-50, #FAFAF7)', borderRadius: 10 }}>
                Aún no hay comentarios para {mesLabel}. Busca un contrato arriba para empezar a añadir.
              </div>
            )}

            {visibles.map((c) => {
              const hechos = porContrato[c.idadmon] || []
              return (
                <div key={c.idadmon} style={{ border: '1px solid var(--border, #E5E3DC)', borderRadius: 12, padding: '14px 16px', marginBottom: 12, background: '#fff' }}>
                  {/* cabecera del contrato */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: hechos.length ? 10 : 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#7c3aed' }}>{c.idadmon}</span>
                    <span style={{ fontSize: 13, color: 'var(--gray-700, #444)' }}>{c.propietario}</span>
                    <span style={{ fontSize: 12, color: 'var(--gray-400, #999)' }}>{c.inmueble}</span>
                    {c.estado && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 5, background: '#F1EFE8', color: '#666' }}>{c.estado}</span>}
                  </div>

                  {/* hechos como puntos */}
                  {hechos.map((h) => (
                    <div key={h.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0', fontSize: 13, color: 'var(--gray-800, #333)' }}>
                      <span style={{ color: '#7c3aed', flexShrink: 0, lineHeight: 1.5 }}>•</span>
                      {editando === h.id ? (
                        <div style={{ flex: 1 }}>
                          <textarea value={editTexto} onChange={(e) => setEditTexto(e.target.value)} rows={2}
                            style={{ width: '100%', fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '1px solid #D3D1C7', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            <button onClick={() => guardarEdicion(h)} disabled={guardando}
                              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>Guardar</button>
                            <button onClick={() => { setEditando(null); setEditTexto('') }}
                              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #D3D1C7', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ lineHeight: 1.5 }}>
                            {h.comentario}
                            <span style={{ fontSize: 11, color: 'var(--gray-400, #aaa)', marginLeft: 8 }}>— {h.persona || '?'}, {fmtFecha(h.created_at)}</span>
                          </span>
                          {puedeTocar(h) && (
                            <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                              <button onClick={() => { setEditando(h.id); setEditTexto(h.comentario) }} title="Editar"
                                style={{ fontSize: 11, background: 'none', border: 'none', color: '#0C447C', cursor: 'pointer' }}>editar</button>
                              <button onClick={() => borrar(h)} title="Borrar"
                                style={{ fontSize: 11, background: 'none', border: 'none', color: '#B23A3A', cursor: 'pointer' }}>borrar</button>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Comentarios anteriores (otros meses) para reutilizar */}
                  <div style={{ marginTop: hechos.length ? 8 : 4 }}>
                    <button onClick={() => abrirHistorial(c.idadmon)}
                      style={{ fontSize: 11, background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                      {histAbierto[c.idadmon] ? '▾' : '▸'} Ver comentarios anteriores
                    </button>
                    {histAbierto[c.idadmon] && (
                      <div style={{ marginTop: 6, paddingLeft: 8, borderLeft: '2px solid #EEE9F7' }}>
                        {histCargando[c.idadmon] ? (
                          <div style={{ fontSize: 12, color: 'var(--gray-400, #999)', padding: '4px 0' }}>Cargando…</div>
                        ) : (histDatos[c.idadmon] || []).length === 0 ? (
                          <div style={{ fontSize: 12, color: 'var(--gray-400, #999)', padding: '4px 0' }}>Este contrato no tiene comentarios en otros meses.</div>
                        ) : (
                          (histDatos[c.idadmon] || []).map((h) => (
                            <div key={h.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0', fontSize: 12, color: 'var(--gray-600, #666)' }}>
                              <span style={{ flex: 1, lineHeight: 1.5 }}>
                                {h.comentario}
                                <span style={{ fontSize: 10, color: 'var(--gray-400, #aaa)', marginLeft: 6 }}>— {h.para_mes_txt || h.mes}{h.persona ? ' · ' + h.persona : ''}</span>
                              </span>
                              <button onClick={() => reutilizar(c.idadmon, h.comentario)} title="Copiar al campo de abajo para reutilizarlo"
                                style={{ fontSize: 11, background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>↻ reutilizar</button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* añadir un hecho nuevo */}
                  <div style={{ display: 'flex', gap: 8, marginTop: hechos.length ? 10 : 0 }}>
                    <input
                      value={borrador[c.idadmon] || ''}
                      onChange={(e) => setBorrador((b) => ({ ...b, [c.idadmon]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') añadir(c.idadmon) }}
                      placeholder="Añadir un hecho de este mes…"
                      style={{ flex: 1, fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border, #D3D1C7)', fontFamily: 'inherit' }} />
                    <button onClick={() => añadir(c.idadmon)} disabled={guardando || !(borrador[c.idadmon] || '').trim()}
                      style={{ fontSize: 13, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none',
                        background: (borrador[c.idadmon] || '').trim() ? '#7c3aed' : '#C9C7BF', color: '#fff',
                        cursor: (borrador[c.idadmon] || '').trim() ? 'pointer' : 'default' }}>+ Añadir</button>
                  </div>
                </div>
              )
            })}

            {busca && visibles.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400, #999)', fontSize: 13 }}>
                Ningún contrato coincide con «{busca}».
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
