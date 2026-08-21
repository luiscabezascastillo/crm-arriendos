// VERSION: v1 · 2026-08-21 · Guarda/actualiza los códigos de cliente (luz/agua/gas) de un INMUEBLE en la
//   fuente única `servicios_codigos` (por idinmue), desde el editor del drawer de /op/deudas. Fusión sin
//   borrar: un valor vacío NO pisa el que ya había (para corregir, se manda el nuevo valor). Se usa la
//   service-role key (como el resto del circuito de servicios); cuando se cierre /op/* por rol, validar aquí.
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const clean = (v) => { const s = String(v ?? '').trim(); return s === '' ? null : s }

export async function POST(req) {
  let b
  try { b = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }

  const idinmue = String(b?.idinmue || '').trim()
  if (!idinmue) return Response.json({ error: 'Falta el idinmue.' }, { status: 400 })

  const ele = clean(b?.codigo_ele), agua = clean(b?.codigo_agua), gas = clean(b?.codigo_gas)
  if (ele === null && agua === null && gas === null) {
    return Response.json({ error: 'No hay ningún código para guardar.' }, { status: 400 })
  }

  try {
    // Fusión sin borrar: se conserva lo que ya había si el campo llega vacío.
    const { data: prev } = await supabase
      .from('servicios_codigos')
      .select('idinmue, codigo_ele, codigo_agua, codigo_gas')
      .eq('idinmue', idinmue).maybeSingle()

    const fila = {
      idinmue,
      codigo_ele:  ele  ?? prev?.codigo_ele  ?? null,
      codigo_agua: agua ?? prev?.codigo_agua ?? null,
      codigo_gas:  gas  ?? prev?.codigo_gas  ?? null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('servicios_codigos').upsert(fila, { onConflict: 'idinmue' })
    if (error) throw error

    return Response.json({ ok: true, codigos: fila })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
