// lib/gcalVisitas.js
// VERSION: v1 · 2026-08-20 · Sincroniza las visitas del CRM con el Google Calendar "FCR · Visitas".
//   Misma auth que el resto del CRM (GOOGLE_CREDENTIALS + Service Account) + scope Calendar.
//   El calendario destino se comparte con el email del Service Account ("hacer cambios en eventos")
//   y con los comerciales ("ver todos los eventos"); su id va en GCAL_VISITAS_ID.
//   Invitar al comercial como asistente requiere delegacion de dominio -> gated por GCAL_INVITAR=1.
import { google } from 'googleapis'

const TZ = 'America/Santiago'
const COLOR = { agendada: '3', realizada: '10', cancelada: '11' } // grape / basil / tomato

function calClient() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
  return google.calendar({ version: 'v3', auth })
}
const calId = () => process.env.GCAL_VISITAS_ID

function tramo(fecha, hora) {
  if (!fecha) return null
  if (!hora) return { start: { date: fecha }, end: { date: fecha } }
  const [h, m] = String(hora).split(':').map(n => parseInt(n, 10) || 0)
  const p = (n) => String(n).padStart(2, '0')
  const ini = `${fecha}T${p(h)}:${p(m)}:00`
  const fin = `${fecha}T${p((h + 1) % 24)}:${p(m)}:00`
  return { start: { dateTime: ini, timeZone: TZ }, end: { dateTime: fin, timeZone: TZ } }
}

export async function upsertVisita(v, { direccion, comercialEmail } = {}) {
  if (!calId()) throw new Error('Falta GCAL_VISITAS_ID')
  const t = tramo(v.fecha, v.hora)
  if (!t) throw new Error('Visita sin fecha')
  const cal = calClient()
  const event = {
    summary: ['Visita', v.cliente_nombre, v.comercial].filter(Boolean).join(' · '),
    ...t,
    location: direccion || undefined,
    description: [v.notas, `CRM · visita ${v.id}`].filter(Boolean).join('\n'),
    colorId: COLOR[v.estado] || undefined,
    extendedProperties: { private: { visita_id: String(v.id) } },
  }
  if (comercialEmail && process.env.GCAL_INVITAR === '1') event.attendees = [{ email: comercialEmail }]

  if (v.gcal_event_id) {
    const r = await cal.events.patch({ calendarId: calId(), eventId: v.gcal_event_id, requestBody: event, sendUpdates: 'all' })
    return r.data.id
  }
  const r = await cal.events.insert({ calendarId: calId(), requestBody: event, sendUpdates: 'all' })
  return r.data.id
}

export async function deleteVisita(eventId) {
  if (!eventId || !calId()) return
  const cal = calClient()
  try { await cal.events.delete({ calendarId: calId(), eventId, sendUpdates: 'all' }) }
  catch (e) { if (e?.code !== 404 && e?.code !== 410) throw e }
}
