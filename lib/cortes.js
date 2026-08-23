// VERSION: v2 · 2026-08-23 · Cortes semanales de servicios — PLAN B (fotos congeladas en tabla aparte).
//   La tabla VIVA `ggcc_agua_luz` NO se toca (sigue con una fila por mes; los cargadores no cambian).
//   "Tomar corte" copia la foto actual del mes desde `ggcc_agua_luz` a `ggcc_cortes_datos` con su
//   (aamm, corte, fecha) y lo registra en `ggcc_cortes`. El nº de corte es la secuencia (1,2,3…) por aamm.

export async function tomarCorte(supabase, aamm, { fecha, nota } = {}) {
  aamm = String(aamm || '').trim()
  if (!aamm) return { error: 'Falta aamm' }

  // Foto actual del mes en la tabla viva
  const { data: filas, error: eF } = await supabase
    .from('ggcc_agua_luz')
    .select('mes, idadmon, idinmue, estado, inmueble, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua, deuda_vigente_gas')
    .eq('aamm', aamm)
  if (eF) return { error: 'leer ggcc_agua_luz: ' + eF.message }
  if (!filas || !filas.length) return { error: `No hay datos vivos para el periodo ${aamm}.` }

  // Próximo número de corte (secuencia por aamm)
  const { data: reg, error: eR } = await supabase.from('ggcc_cortes').select('corte').eq('aamm', aamm)
  if (eR) return { error: 'ggcc_cortes: ' + eR.message }
  const corte = (reg || []).reduce((m, c) => Math.max(m, c.corte), 0) + 1
  const dia = fecha || new Date().toISOString().substring(0, 10)
  const mes = filas[0].mes || null

  // Copiar la foto a ggcc_cortes_datos
  const datos = filas.map(f => ({
    aamm, corte, mes: f.mes,
    idadmon: f.idadmon, idinmue: f.idinmue || '',
    estado: f.estado, inmueble: f.inmueble,
    deuda_gastos_comunes: f.deuda_gastos_comunes,
    deuda_vigente_electricidad: f.deuda_vigente_electricidad,
    deuda_vigente_agua: f.deuda_vigente_agua,
    deuda_vigente_gas: f.deuda_vigente_gas,
  }))
  const BATCH = 100
  for (let i = 0; i < datos.length; i += BATCH) {
    const { error: eU } = await supabase.from('ggcc_cortes_datos')
      .upsert(datos.slice(i, i + BATCH), { onConflict: 'aamm,corte,idadmon,idinmue' })
    if (eU) return { error: 'guardar foto del corte: ' + eU.message }
  }

  // Registrar el corte
  const { error: eIns } = await supabase.from('ggcc_cortes')
    .insert({ aamm, mes, corte, fecha: dia, nota: nota || null })
  if (eIns) return { error: 'registrar corte: ' + eIns.message }

  return { ok: true, aamm, corte, fecha: dia, filas: datos.length }
}
