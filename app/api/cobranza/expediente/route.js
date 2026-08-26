// VERSION: v2 · 2026-08-26 · Botón "← Volver" a Cobranza en la barra superior. Hereda v1.
// VERSION: v1 · 2026-08-10 · Expediente de cobranza (HTML listo para imprimir / guardar como PDF).
//   GET ?idadmon=  -> documento con la cabecera del caso + TODAS las gestiones (constancia) en orden.
//   Se abre en una pestaña; auto-lanza el diálogo de impresión (Guardar como PDF).
// Ruta real: app/api/cobranza/expediente/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const money = (v) => { const n = Number(v) || 0; return '$' + n.toLocaleString('es-CL') }
const DEST_LBL = { arrendatario: 'Arrendatario', aval: 'Aval', propietario: 'Propietario' }
function fh(iso) {
  if (!iso) return '—'
  const d = new Date(iso); const p = (n) => String(n).padStart(2, '0')
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}
function pagina(titulo, cuerpo, autoprint) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1f1f1f; margin: 0; padding: 0 24px 40px; font-size: 13px; }
  .toolbar { padding: 12px 0; display: flex; gap: 10px; align-items: center; }
  .toolbar button { font-size: 13px; padding: 8px 16px; border: 1px solid #1D9E75; background: #fff; color: #085041; border-radius: 6px; cursor: pointer; font-weight: 600; }
  header { border-bottom: 2px solid #1F3864; padding-bottom: 8px; margin-bottom: 14px; }
  header .marca { font-size: 16px; font-weight: 800; color: #1F3864; }
  header .sub { font-size: 12px; color: #666; }
  h1 { font-size: 17px; margin: 6px 0 2px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; margin: 10px 0 16px; }
  .grid div { font-size: 12px; }
  .grid b { color: #333; }
  h2 { font-size: 14px; color: #1F3864; margin: 18px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .g { border: 1px solid #E5E3DC; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; page-break-inside: avoid; }
  .g .head { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; }
  .g .meta { font-size: 11px; color: #777; margin-top: 2px; }
  .g .asunto { font-size: 12px; font-weight: 600; margin-top: 6px; }
  .g .cuerpo { font-size: 12px; color: #333; white-space: pre-wrap; margin-top: 4px; }
  footer { margin-top: 20px; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
  @media print { .toolbar { display: none; } body { padding: 0 6px; } }
</style></head><body>
<div class="toolbar"><button onclick="window.close();setTimeout(function(){location.href='/op/cobranza'},150)">← Volver</button><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>
${cuerpo}
${autoprint ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},350)})</script>' : ''}
</body></html>`
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  if (!session?.user?.email) return new Response(pagina('No autenticado', '<p>No autenticado.</p>', false), { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 401 })
  if (!PUEDEN_VER.includes(rol)) return new Response(pagina('No autorizado', '<p>No autorizado.</p>', false), { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 403 })

  const url = new URL(req.url)
  const idadmon = url.searchParams.get('idadmon')
  if (!idadmon) return new Response(pagina('Falta idadmon', '<p>Falta idadmon.</p>', false), { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 400 })

  const { data: contrato } = await admin.from('datos_arriendos')
    .select('idadmon, propietario, inmueble, arrendatario, rut, mail_arrendatario, movil, avalista, rut_avalista, mail_avalista, telefono_avalista')
    .eq('idadmon', idadmon).maybeSingle()
  const { data: casos } = await admin.from('cobranza_casos').select('*').eq('idadmon', idadmon).order('fecha_apertura', { ascending: false })
  const caso = (casos || []).find(c => c.estado !== 'cerrado') || (casos || [])[0] || null
  const { data: gestiones } = await admin.from('cobranza_gestiones').select('*').eq('idadmon', idadmon).order('fecha', { ascending: true })

  const c = contrato || {}
  const cabecera = `
    <header>
      <div class="marca">FONDO CAPITAL RENTAS — FCR</div>
      <div class="sub">Expediente de cobranza · uso interno / legal</div>
    </header>
    <h1>${esc(idadmon)} — ${esc(c.inmueble || '')}</h1>
    <div class="grid">
      <div><b>Propietario:</b> ${esc(c.propietario || '—')}</div>
      <div><b>Monto en cobro:</b> ${esc(money(caso?.monto_adeudado))}</div>
      <div><b>Arrendatario:</b> ${esc(c.arrendatario || '—')} · ${esc(c.rut || '')}</div>
      <div><b>Contacto arr.:</b> ${esc(c.mail_arrendatario || 's/mail')} · ${esc(c.movil || '')}</div>
      <div><b>Aval:</b> ${esc(c.avalista || '—')} · ${esc(c.rut_avalista || '')}</div>
      <div><b>Contacto aval:</b> ${esc(c.mail_avalista || 's/mail')} · ${esc(c.telefono_avalista || '')}</div>
      <div><b>Tipo de caso:</b> ${esc(caso?.tipo === 'termino' ? 'Término' : 'Vigente')}</div>
      <div><b>Estado:</b> ${esc(caso?.estado || '—')}</div>
    </div>`

  const listado = (gestiones && gestiones.length)
    ? gestiones.map((g, i) => `
      <div class="g">
        <div class="head"><span>${i + 1}. ${esc(DEST_LBL[g.destinatario] || g.destinatario)} · ${esc(g.canal)}</span><span>${esc(fh(g.fecha))}</span></div>
        <div class="meta">${esc(g.etapa || '')}${g.destinatario_nombre ? ' · ' + esc(g.destinatario_nombre) : ''}${g.destinatario_rut ? ' (' + esc(g.destinatario_rut) + ')' : ''} · resultado: ${esc(g.resultado || '')} · registró: ${esc(g.usuario || '')}</div>
        ${g.asunto ? `<div class="asunto">${esc(g.asunto)}</div>` : ''}
        <div class="cuerpo">${esc(g.contenido_snapshot || '')}</div>
        ${g.acuse ? `<div class="meta">Acuse: ${esc(g.acuse)}</div>` : ''}
      </div>`).join('')
    : '<p style="color:#999">Sin gestiones registradas para este caso.</p>'

  const cuerpo = cabecera + `<h2>Gestiones registradas (${(gestiones || []).length})</h2>` + listado +
    `<footer>Documento generado el ${esc(fh(new Date().toISOString()))} por ${esc(session.user.email)}. Cada gestión es una constancia inmutable del sistema de cobranza de FCR.</footer>`

  return new Response(pagina('Expediente ' + idadmon, cuerpo, true), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
