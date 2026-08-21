// VERSION: v2 · 2026-08-21 · Al guardar GGCC desde el texto de Comunidad Feliz, HEREDA los códigos de
//   servicio (luz/agua/gas) por idinmue: primero de la fuente única `servicios_codigos`, y lo que falte,
//   del último mes ya cargado en ggcc_agua_luz. El texto de CF no trae códigos, así que sin esto el mes
//   nuevo nacía con codigo_ele/agua/gas en null y el drawer de /op/deudas salía "Sin datos" (además de
//   impedir la consulta masiva de luz/agua). Prioriza el código real (empieza por dígito) sobre los
//   marcadores (estacionamiento/bodega/llega con ggcc), y cubre tanto el idinmue exacto (agrupaciones
//   "P016-02 P016-51") como cada componente suelto. Hereda v1 (que no versionaba).
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(req) {
  try {
    const { filas, mesClave, aamm } = await req.json()
    const fechaHoy = new Date().toISOString().substring(0, 10)

    // Agrupar por idadmon
    const porIdadmon = {}
    for (const f of filas) {
      if (!f.idadmon || !f.match) continue
      if (!porIdadmon[f.idadmon]) porIdadmon[f.idadmon] = []
      porIdadmon[f.idadmon].push(f)
    }

    const rows = []
    const claves = new Set() // para deduplicar (idadmon+idinmue+mes)

    function addRow(row) {
      const clave = `${row.idadmon}||${row.idinmue}||${row.mes}`
      if (claves.has(clave)) return // skip duplicado
      claves.add(clave)
      rows.push(row)
    }

    for (const [idadmon, grupo] of Object.entries(porIdadmon)) {
      if (grupo.length === 1) {
        const f = grupo[0]
        addRow({
          mes: mesClave, aamm, idadmon,
          idinmue: f.idinmue || '',
          estado: f.estado,
          deuda_gastos_comunes: String(f.deuda),
          fecha_hecho_ggcc: f.fecha || fechaHoy,
          updated_at: new Date().toISOString()
        })
      } else {
        // Deduplicar idinmues dentro del grupo
        const idinmuesUnicos = [...new Set(grupo.map(g => g.idinmue).filter(Boolean))]
        const idinmueCombinado = idinmuesUnicos.join(' ')
        const deudaTotal = grupo.reduce((s, g) => s + (g.deuda || 0), 0)

        addRow({
          mes: mesClave, aamm, idadmon,
          idinmue: idinmueCombinado,
          estado: grupo[0].estado,
          deuda_gastos_comunes: String(deudaTotal),
          fecha_hecho_ggcc: grupo[0].fecha || fechaHoy,
          updated_at: new Date().toISOString()
        })

        for (const f of grupo) {
          if (!f.idinmue) continue
          addRow({
            mes: mesClave, aamm,
            idadmon: '.' + idadmon,
            idinmue: f.idinmue,
            estado: f.estado,
            deuda_gastos_comunes: String(f.deuda),
            fecha_hecho_ggcc: f.fecha || fechaHoy,
            updated_at: new Date().toISOString()
          })
        }
      }
    }

    // Sin match
    for (const f of filas) {
      if (f.match || !f.idadmon) continue
      addRow({
        mes: mesClave, aamm,
        idadmon: f.idadmon,
        idinmue: f.idinmue || '',
        estado: f.estado,
        deuda_gastos_comunes: null,
        fecha_hecho_ggcc: null,
        comentarios_se_han_dejado_los_comentarios_mes_anterior: `CF_NO_MATCH: ${f.observacion}`,
        updated_at: new Date().toISOString()
      })
    }

    // ── Heredar códigos de servicio por idinmue ────────────────────────────────
    // El texto de Comunidad Feliz no trae códigos de luz/agua/gas. Se heredan de la fuente única
    // `servicios_codigos` (por idinmue) y, lo que falte, del último mes ya cargado en ggcc_agua_luz.
    // Así el mes nuevo no nace sin nº de cliente (y la consulta masiva de luz/agua tiene con qué consultar).
    try {
      const splitInmue = (s) => String(s || '').trim().split(/\s+/).filter(Boolean)
      // codPorInmue: idinmue (exacto o componente) -> { ele, agua, gas }; guarda el PRIMER no-nulo que ve.
      const codPorInmue = new Map()
      const set = (key, campo, val) => {
        if (!key || !val) return
        const e = codPorInmue.get(key) || {}
        if (e[campo] == null) { e[campo] = val; codPorInmue.set(key, e) }
      }
      // Claves a buscar: el idinmue completo (para agrupaciones) y cada componente suelto.
      const claves = new Set()
      for (const r of rows) { const full = String(r.idinmue || '').trim(); if (full) claves.add(full); for (const c of splitInmue(full)) claves.add(c) }
      const lista = [...claves]
      if (lista.length) {
        // 1) Fuente única `servicios_codigos` (por idinmue).
        const { data: sc } = await supabase
          .from('servicios_codigos')
          .select('idinmue, codigo_ele, codigo_agua, codigo_gas')
          .in('idinmue', lista)
        for (const c of (sc || [])) { set(c.idinmue, 'ele', c.codigo_ele); set(c.idinmue, 'agua', c.codigo_agua); set(c.idinmue, 'gas', c.codigo_gas) }
        // 2) Fallback: último mes ya cargado en ggcc_agua_luz (excluye el mes que estamos guardando).
        const { data: hist } = await supabase
          .from('ggcc_agua_luz')
          .select('idinmue, mes, codigo_ele, codigo_agua, codigo_gas')
          .in('idinmue', lista)
          .neq('mes', mesClave)
          .order('mes', { ascending: false })
        for (const h of (hist || [])) { set(h.idinmue, 'ele', h.codigo_ele); set(h.idinmue, 'agua', h.codigo_agua); set(h.idinmue, 'gas', h.codigo_gas) }
        // 3) Volcar a cada fila: por servicio, el primer candidato con código; el código real
        //    (empieza por dígito) tiene prioridad sobre un marcador (estacionamiento/bodega/…).
        const esReal = (v) => /^\d/.test(String(v))
        const elegir = (idinmue, campo) => {
          const cand = [String(idinmue || '').trim(), ...splitInmue(idinmue)]
          let marcador = null
          for (const c of cand) {
            const v = codPorInmue.get(c)?.[campo]
            if (!v) continue
            if (esReal(v)) return v
            if (marcador == null) marcador = v
          }
          return marcador
        }
        for (const r of rows) {
          const ele = elegir(r.idinmue, 'ele'); if (ele) r.codigo_ele = ele
          const agua = elegir(r.idinmue, 'agua'); if (agua) r.codigo_agua = agua
          const gas = elegir(r.idinmue, 'gas'); if (gas) r.codigo_gas = gas
        }
      }
    } catch (e) {
      console.error('guardar ggcc: no se pudieron heredar códigos:', e.message)
      // No se bloquea la carga principal si la herencia falla.
    }

    // Upsert en lotes de 50
    const BATCH = 50
    for (let i = 0; i < rows.length; i += BATCH) {
      const lote = rows.slice(i, i + BATCH)
      const { error } = await supabase
        .from('ggcc_agua_luz')
        .upsert(lote, { onConflict: 'idadmon,idinmue,mes' })
      if (error) throw new Error(`Lote ${Math.floor(i/BATCH)+1}: ${error.message}`)
    }

    return Response.json({ ok: true, insertados: rows.length })
  } catch (e) {
    console.error(e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
