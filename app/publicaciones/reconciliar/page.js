// VERSION: v1 · 2026-08-21 · Pantalla "Reconciliar PI": muestra el informe de /api/pi/reconciliar y aplica
//   las acciones (que SOLO tocan el CRM): corregir enlaces, reactivar en CRM, marcar caídas. Con confirmación.
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TopNav from '../../components/ui/TopNav'

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }
const th = { textAlign: 'left', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }
const td = { fontSize: 12, color: '#374151', padding: '6px 8px', borderBottom: '.5px solid #f3f4f6' }

function Btn({ onClick, disabled, color, children }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: disabled ? '#cbd5e1' : color, color: '#fff', fontSize: 12, fontWeight: 600, cursor: disabled ? 'default' : 'pointer' }}>{children}</button>
}

export default function ReconciliarPage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [aplicando, setAplicando] = useState(null)

  async function cargar() {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/pi/reconciliar')
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      setData(j)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  async function aplicar(action, items, texto) {
    if (!items.length) return
    if (!window.confirm(`${texto}\n\n${items.length} publicación(es). Esto solo actualiza el CRM (no toca Portal Inmobiliario). ¿Continuar?`)) return
    setAplicando(action)
    try {
      const r = await fetch('/api/pi/reconciliar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, items }) })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Error')
      alert(`✓ ${j.actualizadas} publicación(es) actualizadas en el CRM.`)
      await cargar()
    } catch (e) { alert('Error: ' + e.message) }
    setAplicando(null)
  }

  const r = data?.resumen || {}

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <TopNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span onClick={() => router.push('/publicaciones')} style={{ fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>← Publicaciones</span>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Reconciliar PI</h1>
          <Btn onClick={cargar} disabled={loading} color="#0891b2">{loading ? 'Revisando…' : '🔄 Revisar de nuevo'}</Btn>
        </div>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 0, marginBottom: 16 }}>
          Cruza tus publicaciones reales de Portal Inmobiliario (MercadoLibre) con el CRM. Las acciones <b>solo actualizan el CRM</b> para reflejar lo que hay en PI; nunca crean ni cierran nada en el portal.
        </p>

        {error && <div style={{ ...card, color: '#b91c1c', marginBottom: 16 }}>Error: {error}</div>}
        {loading && !data && <div style={{ ...card }}>Revisando contra MercadoLibre…</div>}

        {data && (<>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 20 }}>
            {[['ML activas', r.ml_activas, '#1a56db'], ['Sincronizadas', r.sincronizadas, '#16a34a'], ['Desincronizadas', r.desincronizadas, '#b45309'], ['Vivas·CRM baja', r.crm_dice_baja_pero_viva, '#b45309'], ['Fantasmas', r.fantasmas, '#b91c1c'], ['Huérfanas', r.huerfanas, '#6b7280']].map(([l, v, c], i) => (
              <div key={i} style={{ ...card, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>{l}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v ?? 0}</div>
              </div>
            ))}
          </div>

          {/* Vivas en PI pero el CRM las da de baja */}
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div><b>Vivas en PI, pero el CRM las da de baja</b> <span style={{ color: '#6b7280', fontSize: 12 }}>({data.crm_dice_baja_pero_viva.length}) — están activas y con visitas en PI</span></div>
              <Btn onClick={() => aplicar('reactivar', data.crm_dice_baja_pero_viva, 'REACTIVAR en el CRM (poner pi=SI, activa, y el MLC real).')} disabled={aplicando || !data.crm_dice_baja_pero_viva.length} color="#16a34a">Reactivar en CRM ({data.crm_dice_baja_pero_viva.length})</Btn>
            </div>
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Código</th><th style={th}>Estado CRM</th><th style={th}>MLC real</th><th style={th}>Enlace</th></tr></thead><tbody>
              {data.crm_dice_baja_pero_viva.map((x, i) => (<tr key={i}><td style={td}>{x.codigo}</td><td style={td}>{x.crm_pi}/{x.crm_activo}</td><td style={td}>{x.mlc_real}</td><td style={td}><a href={x.permalink} target="_blank" rel="noreferrer" style={{ color: '#1a56db' }}>ver</a></td></tr>))}
              {!data.crm_dice_baja_pero_viva.length && <tr><td style={td} colSpan={4}>Nada.</td></tr>}
            </tbody></table></div>
          </div>

          {/* Desincronizadas */}
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div><b>Desincronizadas (enlace incorrecto)</b> <span style={{ color: '#6b7280', fontSize: 12 }}>({data.desincronizadas.length}) — el CRM tiene un MLC distinto al real</span></div>
              <Btn onClick={() => aplicar('sync_links', data.desincronizadas, 'CORREGIR ENLACES (poner el codigo_pi/url_pi real). No cambia el estado.')} disabled={aplicando || !data.desincronizadas.length} color="#b45309">Corregir enlaces ({data.desincronizadas.length})</Btn>
            </div>
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Código</th><th style={th}>codigo_pi CRM</th><th style={th}>MLC real</th><th style={th}>Enlace</th></tr></thead><tbody>
              {data.desincronizadas.map((x, i) => (<tr key={i}><td style={td}>{x.codigo}</td><td style={td}>{x.codigo_pi_crm || '—'}</td><td style={td}>{x.mlc_real}</td><td style={td}><a href={x.permalink} target="_blank" rel="noreferrer" style={{ color: '#1a56db' }}>ver</a></td></tr>))}
              {!data.desincronizadas.length && <tr><td style={td} colSpan={4}>Nada.</td></tr>}
            </tbody></table></div>
          </div>

          {/* Fantasmas */}
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div><b>Fantasmas (caídas en PI)</b> <span style={{ color: '#6b7280', fontSize: 12 }}>({data.fantasmas.length}) — el CRM las marca activas, pero en PI no están activas</span></div>
              <Btn onClick={() => aplicar('marcar_caida', data.fantasmas, 'MARCAR CAÍDAS en el CRM (pasan a históricas). NO las republica.')} disabled={aplicando || !data.fantasmas.length} color="#b91c1c">Marcar caídas ({data.fantasmas.length})</Btn>
            </div>
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Código</th><th style={th}>codigo_pi CRM</th></tr></thead><tbody>
              {data.fantasmas.map((x, i) => (<tr key={i}><td style={td}>{x.codigo}</td><td style={td}>{x.codigo_pi_crm || '—'}</td></tr>))}
              {!data.fantasmas.length && <tr><td style={td} colSpan={2}>Nada.</td></tr>}
            </tbody></table></div>
          </div>

          {data.huerfanas.length > 0 && (
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}><b>Huérfanas en ML</b> <span style={{ color: '#6b7280', fontSize: 12 }}>({data.huerfanas.length}) — activas en ML sin ficha en el CRM (revisar a mano)</span></div>
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>MLC</th><th style={th}>property_code</th><th style={th}>Enlace</th></tr></thead><tbody>
                {data.huerfanas.map((x, i) => (<tr key={i}><td style={td}>{x.mlc}</td><td style={td}>{x.property_code || '—'}</td><td style={td}><a href={x.permalink} target="_blank" rel="noreferrer" style={{ color: '#1a56db' }}>ver</a></td></tr>))}
              </tbody></table></div>
            </div>
          )}
        </>)}
      </div>
    </div>
  )
}
