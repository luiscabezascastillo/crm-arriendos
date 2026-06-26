'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import TopNav from '../components/ui/TopNav'

// Formatea precio con su moneda
function fmtPrecio(p) {
  if (!p.valor) return '—'
  const n = Number(p.valor)
  const num = isNaN(n) ? p.valor : n.toLocaleString('es-CL')
  return (p.tipo_moneda === 'UF' ? 'UF ' : '$') + num
}

// Primera foto del array jsonb (puede venir como array o como string)
function primeraFoto(fotos) {
  try {
    const arr = Array.isArray(fotos) ? fotos : JSON.parse(fotos || '[]')
    return arr.length ? arr[0] : null
  } catch { return null }
}

function Miniatura({ url, titulo }) {
  const [error, setError] = useState(false)
  if (!url || error) {
    return (
      <div style={{ width:'100%', height:160, background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontSize:12, borderRadius:'8px 8px 0 0' }}>
        Sin foto
      </div>
    )
  }
  return (
    <img src={url} alt={titulo||''} onError={() => setError(true)}
      style={{ width:'100%', height:160, objectFit:'cover', borderRadius:'8px 8px 0 0' }} />
  )
}

export default function CanjePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [props, setProps] = useState([])
  const [cargando, setCargando] = useState(true)
  const [importando, setImportando] = useState(false)
  const [msg, setMsg] = useState(null)

  async function cargar() {
    setCargando(true)
    const { data, error } = await supabase
      .from('propiedades_canje')
      .select('*')
      .eq('activa', true)
      .order('updated_at', { ascending: false })
    if (!error && data) setProps(data)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  async function importar() {
    setImportando(true)
    setMsg(null)
    try {
      const res = await fetch('/api/canje/importar-asia')
      const data = await res.json()
      if (data.ok) {
        setMsg(`✓ ${data.importadas} propiedades importadas/actualizadas de ${data.corredor}`)
        await cargar()
      } else {
        setMsg('✗ Error: ' + (data.error || 'no se pudo importar'))
      }
    } catch (e) {
      setMsg('✗ Error de red: ' + e.message)
    }
    setImportando(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'system-ui, sans-serif' }}>
      <TopNav />
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'24px 20px' }}>

        {/* Cabecera */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:700, color:'#0f172a', margin:0 }}>Propiedades en Canje</h1>
            <p style={{ fontSize:13, color:'#64748b', margin:'4px 0 0' }}>
              Propiedades de venta de otros corredores, ofrecibles como alternativas a clientes.
            </p>
          </div>
          <button onClick={importar} disabled={importando}
            style={{ padding:'10px 18px', borderRadius:8, border:'none', cursor: importando?'wait':'pointer',
              background: importando?'#94a3b8':'#0C447C', color:'#fff', fontSize:14, fontWeight:600, fontFamily:'inherit' }}>
            {importando ? 'Importando…' : '↓ Importar de Asia Propiedades'}
          </button>
        </div>

        {msg && (
          <div style={{ margin:'12px 0', padding:'10px 14px', borderRadius:8, fontSize:13,
            background: msg.startsWith('✓')?'#f0fdf4':'#fef2f2', color: msg.startsWith('✓')?'#166534':'#991b1b',
            border:'1px solid ' + (msg.startsWith('✓')?'#bbf7d0':'#fecaca') }}>
            {msg}
          </div>
        )}

        <div style={{ fontSize:13, color:'#64748b', margin:'16px 0 12px' }}>
          {cargando ? 'Cargando…' : `${props.length} propiedades en canje`}
        </div>

        {/* Grid de tarjetas */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16 }}>
          {props.map(p => (
            <div key={p.id} style={{ background:'#fff', borderRadius:10, border:'1px solid #e2e8f0', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
              <Miniatura url={primeraFoto(p.fotos)} titulo={p.titulo} />
              <div style={{ padding:'12px 14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                  <span style={{ fontSize:10, padding:'2px 7px', borderRadius:8, background:'#fef3c7', color:'#92400e', fontWeight:600 }}>
                    Canje · {p.corredor_origen}
                  </span>
                  <span style={{ fontSize:10, padding:'2px 7px', borderRadius:8, background:'#EAF3DE', color:'#3B6D11', fontWeight:500 }}>
                    {p.tipo || '—'}
                  </span>
                </div>
                <h3 style={{ fontSize:14, fontWeight:600, color:'#0f172a', margin:'8px 0 4px', lineHeight:1.3 }}>
                  {p.titulo || 'Sin título'}
                </h3>
                <div style={{ fontSize:16, fontWeight:700, color:'#0C447C', marginBottom:6 }}>
                  {fmtPrecio(p)}
                </div>
                <div style={{ fontSize:12, color:'#64748b', marginBottom:8 }}>
                  {p.comuna ? p.comuna : <span style={{ color:'#dc2626' }}>comuna sin definir</span>}
                  {p.direccion && p.direccion !== '-' ? ' · ' + p.direccion : ''}
                </div>
                <div style={{ display:'flex', gap:12, fontSize:12, color:'#475569', marginBottom:10 }}>
                  {p.dormitorios && <span>🛏 {p.dormitorios}</span>}
                  {p.banos && <span>🚿 {p.banos}</span>}
                  {p.mt2_const && p.mt2_const !== '0' && <span>{p.mt2_const} m²</span>}
                </div>
                <a href={p.url_original} target="_blank" rel="noopener noreferrer"
                  style={{ display:'block', textAlign:'center', padding:'7px 0', borderRadius:6, border:'1px solid #0C447C',
                    color:'#0C447C', fontSize:12, fontWeight:500, textDecoration:'none' }}>
                  Ver ficha original ↗
                </a>
              </div>
            </div>
          ))}
        </div>

        {!cargando && props.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'#94a3b8' }}>
            No hay propiedades en canje todavía. Pulsa "Importar de Asia Propiedades" para traerlas.
          </div>
        )}
      </div>
    </div>
  )
}