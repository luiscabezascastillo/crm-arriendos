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
