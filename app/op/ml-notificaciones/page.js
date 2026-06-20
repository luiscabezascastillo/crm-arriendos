'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

export default function MLNotificacionesPage() {
  const [notifs, setNotifs] = useState([])
  const [pubs, setPubs] = useState({})
  const [visitas, setVisitas] = useState({})
  const [loading, setLoading] = useState(true)
  const [accionando, setAccionando] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('ml_notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifs(data || [])

    // Obtener publicaciones con codigo_pi
    const { data: pubsData } = await supabase
      .from('publicaciones')
      .select('codigo, codigo_pi, direccion, comuna, valor, ggcc, tipo_moneda, activo')
      .not('codigo_pi', 'is', null)
      .eq('pi', 'SI')
      .order('codigo', { ascending: false })
      .limit(30)

    const pubsMap = {}
    for (const p of pubsData || []) pubsMap[p.codigo_pi] = p
    setPubs(pubsMap)
    setLoading(false)
  }

  async function cargarVisitas(codigo_pi) {
    if (visitas[codigo_pi]) return
    const res = await fetch(`/api/ml/visitas?id=${codigo_pi}`)
    const data = await res.json()
    setVisitas(v => ({ ...v, [codigo_pi]: data.total || 0 }))
  }

  async function pausar(codigo_pi) {
    setAccionando(codigo_pi + '_pausar')
    const res = await fetch('/api/ml/pausar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo_pi })
    })
    const data = await res.json()
    setToast(data.ok ? `✓ ${codigo_pi} pausada` : `Error: ${data.error}`)
    setTimeout(() => setToast(null), 3000)
    setAccionando(null)
  }

  // Agrupar notificaciones por resource
  const gruposPorResource = {}
  for (const n of notifs) {
    if (!gruposPorResource[n.resource]) gruposPorResource[n.resource] = []
    gruposPorResource[n.resource].push(n)
  }

  const recursos = Object.entries(gruposPorResource).sort((a, b) =>
    new Date(b[1][0].created_at) - new Date(a[1][0].created_at)
  )

  const topicColor = {
    'items': { bg: '#EFF6FF', color: '#1a56db', label: 'Item' },
    'vis_leads': { bg: '#F0FDF4', color: '#16a34a', label: 'Lead visita' },
    'questions': { bg: '#FAEEDA', color: '#d97706', label: 'Pregunta' },
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <TopNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px' }}>

        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Portal Inmobiliario</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Notificaciones ML</h1>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Actividad recibida desde Mercado Libre / Portal Inmobiliario</div>
          </div>
          <button onClick={cargar} style={{ background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            🔄 Actualizar
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total notificaciones', value: notifs.length, color: '#1a56db' },
            { label: 'Leads de visita', value: notifs.filter(n => n.topic === 'vis_leads').length, color: '#16a34a' },
            { label: 'Cambios de item', value: notifs.filter(n => n.topic === 'items').length, color: '#d97706' },
            { label: 'Sin procesar', value: notifs.filter(n => !n.procesado).length, color: '#dc2626' },
          ].map((k, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Notificaciones */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Actividad reciente — {recursos.length} recursos distintos
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recursos.slice(0, 15).map(([resource, items]) => {
                const ultimo = items[0]
                const tc = topicColor[ultimo.topic] || { bg: '#F3F4F6', color: '#6B7280', label: ultimo.topic }
                const itemId = resource.split('/').pop()
                const pub = pubs[itemId]
                return (
                  <div key={resource} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: tc.bg, color: tc.color }}>{tc.label}</span>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>{new Date(ultimo.created_at).toLocaleString('es-CL')}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', marginBottom: 2 }}>{itemId}</div>
                    {pub && (
                      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>
                        {pub.direccion} · {pub.comuna}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>{items.length} notif.</span>
                      {pub && (
                        <a href={`https://www.portalinmobiliario.com/MLC-${itemId.replace('MLC','')}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: 10, color: '#1a56db', textDecoration: 'none' }}>Ver en PI →</a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Publicaciones activas con visitas */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Publicaciones activas
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.values(pubs).slice(0, 15).map(pub => (
                <div key={pub.codigo_pi} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}
                  onMouseEnter={() => cargarVisitas(pub.codigo_pi)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{pub.codigo_pi}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>
                      {visitas[pub.codigo_pi] !== undefined ? `👁 ${visitas[pub.codigo_pi]} visitas` : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>{pub.direccion}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 11, color: '#374151' }}>
                      {pub.tipo_moneda === 'UF' ? `UF ${pub.valor}` : `$${Number(pub.valor).toLocaleString('es-CL')}`}
                      {pub.ggcc && <span style={{ color: '#9CA3AF', marginLeft: 6 }}>GGCC ${Number(pub.ggcc).toLocaleString('es-CL')}</span>}
                    </div>
                    <button onClick={() => pausar(pub.codigo_pi)} disabled={accionando === pub.codigo_pi + '_pausar'}
                      style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontFamily: 'inherit' }}>
                      ⏸ Pausar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1a1a2e', color: '#fff', fontSize: 13, padding: '10px 20px', borderRadius: 8, zIndex: 999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}