// VERSION: v1 · 2026-08-14 · Lector del Libro de Remuneraciones Electrónico (LRE) de Nubox en CSV.
//   Formato oficial de la Dirección del Trabajo: una fila por trabajador, columnas con el
//   patrón "Nombre(codigo)" separadas por ';', codificación Latin-1 (ISO-8859-1).
//   A diferencia del PDF, el LRE SÍ trae los aportes del empleador:
//     · 4151 = AFC empleador (cesantía patronal)
//     · 4155 = SIS (invalidez y sobrevivencia)
//     · 4152 = seguro accidentes del trabajo (mutual) + Ley SANNA, SUMADOS (igual que la ACHS)
//   El 4152 se parte en ap_mutual/ap_sanna con SANNA = 0,03% del imponible (base 5210) y
//   mutual = 4152 − SANNA, exactamente como la carga del primer semestre. Se sella
//   ap_origen='lre' para que el coste empresa quede COMPLETO (no reaparece el falso "INCOMPLETO").
//   El LRE trae además el desglose fino de haberes, así que no deja líneas "incompletas".
//   Descarga en Nubox: Utilitarios → Archivo LRE → Descargar → Formato CSV.
'use client'

const MES_NOMBRE = {
  1: 'ENERO', 2: 'FEBRERO', 3: 'MARZO', 4: 'ABRIL', 5: 'MAYO', 6: 'JUNIO',
  7: 'JULIO', 8: 'AGOSTO', 9: 'SEPTIEMBRE', 10: 'OCTUBRE', 11: 'NOVIEMBRE', 12: 'DICIEMBRE',
}

// Los importes del LRE son enteros en pesos, pero por robustez se limpian puntos/comas.
const num = (t) => {
  const s = String(t ?? '').trim().replace(/\./g, '').replace(',', '.')
  if (s === '') return 0
  const n = Number(s)
  return isNaN(n) ? 0 : Math.round(n)
}
const limpiarRut = (r) => String(r || '').replace(/[\s.]/g, '').toUpperCase()

// El LRE no usa comillas ni ';' embebidos: basta partir por ';'.
const campos = (linea) => linea.split(';')

// Periodo desde el nombre del archivo de Nubox: <rut>_AAAAMM.csv (p. ej. 768287120_202607.csv).
function periodoDeNombre(nombre) {
  const m = String(nombre || '').match(/(\d{4})(\d{2})(?=\D*$)/)   // últimos AAAAMM antes del final
  if (!m) return null
  const y = m[1], mo = Number(m[2])
  if (mo < 1 || mo > 12) return null
  return { periodo: `${y}-${m[2]}-01`, mes_texto: `MES: ${MES_NOMBRE[mo]} DEL ${y}` }
}

// ---- API principal ----
// Devuelve { periodo, mes_texto, archivo, n_empleados, lineas[], totales{chk_*}, avisos[] }
// con la MISMA forma que parseLibroRemuneracionesPDF, más ap_sis/ap_cesantia/ap_mutual/
// ap_sanna/ap_otros/ap_origen en cada línea.
export async function parseLibroRemuneracionesLRE(file) {
  // El LRE viene en Latin-1: hay que decodificarlo así o los acentos salen rotos.
  const buf = await file.arrayBuffer()
  const texto = new TextDecoder('iso-8859-1').decode(buf)
  const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lineas.length < 2) throw new Error('El CSV del LRE no trae filas de datos.')

  // Cabecera: "Nombre(codigo)" -> índice por código.
  const cab = campos(lineas[0])
  const idx = {}
  cab.forEach((h, i) => { const m = String(h).match(/\((\d+)\)\s*$/); if (m) idx[m[1]] = i })
  const necesarias = ['1101', '5201', '5301', '5501', '5210', '4151', '4152', '4155']
  const faltan = necesarias.filter(c => idx[c] == null)
  if (faltan.length) {
    throw new Error('El CSV no parece un LRE de Nubox (faltan columnas ' + faltan.join(', ') +
      '). ¿Descargaste el "Archivo LRE" en Formato CSV (Utilitarios → Archivo LRE → Descargar → Formato CSV)?')
  }

  const per = periodoDeNombre(file.name)
  if (!per) throw new Error('No pude sacar el mes del nombre del archivo. Súbelo con el nombre original de Nubox (…_AAAAMM.csv).')

  const g = (row, code) => { const i = idx[code]; return (i == null || i >= row.length) ? '' : row[i] }

  const out = []
  const avisos = []
  for (let k = 1; k < lineas.length; k++) {
    const row = campos(lineas[k])
    const rut = limpiarRut(g(row, '1101'))
    if (!rut) continue

    const total_imp = num(g(row, '5210'))        // total haberes imponibles y tributables
    const sueldo_base = num(g(row, '2101'))
    const horas_extras = num(g(row, '2102'))     // sobresueldo
    const grat_legal = num(g(row, '2106'))
    const asig_fam = num(g(row, '2311'))
    const tot_no_imp = num(g(row, '5230'))       // haberes no imponibles y no tributables
    const tot_haberes = num(g(row, '5201'))
    const prevision = num(g(row, '3141'))        // cotización AFP/IPS
    const salud = num(g(row, '3143'))            // cotización salud 7%
    const imp_unico = num(g(row, '3161'))
    const seg_ces = num(g(row, '3151'))          // AFC trabajador
    const tot_dleg = num(g(row, '5341'))         // total cotizaciones del trabajador
    const desc_varios = num(g(row, '5302'))      // total otros descuentos
    const tot_desc = num(g(row, '5301'))
    const liquido = num(g(row, '5501'))

    // Aportes del empleador (lo que el PDF NO traía).
    const ap_cesantia = num(g(row, '4151'))
    const ap_sis = num(g(row, '4155'))
    const mut_sanna = num(g(row, '4152'))                 // mutual + SANNA juntos (como la ACHS)
    const ap_sanna = Math.round(total_imp * 0.0003)       // SANNA = 0,03% del imponible
    const ap_mutual = Math.max(0, mut_sanna - ap_sanna)   // el resto es la mutual (0,90% + adicional)
    const tot_aportes = num(g(row, '5410'))               // total aportes del propio LRE
    // ap_otros absorbe cualquier otro aporte (indemn. a todo evento 4131, trabajo pesado 4154,
    // APVC empleador 4157) para que coste_empresa reproduzca EXACTO el 5410 del LRE.
    const ap_otros = Math.max(0, tot_aportes - ap_cesantia - mut_sanna - ap_sis)

    // Chequeo de integridad: en el LRE, líquido = haberes − descuentos. Si no cuadra,
    // el archivo está mal leído o mal generado: mejor avisar que cargar basura.
    if (Math.abs(liquido - (tot_haberes - tot_desc)) > 1) {
      avisos.push(`${rut}: líquido ${liquido.toLocaleString('es-CL')} no cuadra con haberes − descuentos (${(tot_haberes - tot_desc).toLocaleString('es-CL')}).`)
    }

    out.push({
      rut, cod_libro: null, nombre_libro: null,
      dt: num(g(row, '1115')),                              // nº días trabajados en el mes
      sueldo_base, horas_extras, grat_legal,
      otros_imp: Math.max(0, total_imp - sueldo_base - horas_extras - grat_legal),
      total_imp, asig_fam,
      otros_no_imp: Math.max(0, tot_no_imp - asig_fam),
      tot_no_imp, tot_haberes,
      prevision, salud, imp_unico, seg_ces,
      otros_dleg: Math.max(0, tot_dleg - prevision - salud - imp_unico - seg_ces),
      tot_dleg, desc_varios, tot_desc, liquido,
      ap_sis, ap_cesantia, ap_mutual, ap_sanna, ap_otros, ap_origen: 'lre',
    })
  }
  if (!out.length) throw new Error('El LRE no trae ninguna fila de trabajador legible.')

  const suma = (key) => out.reduce((a, x) => a + (x[key] || 0), 0)
  return {
    ...per,
    archivo: file.name,
    n_empleados: out.length,
    lineas: out,
    totales: {
      chk_dt: suma('dt'),
      chk_tot_imp: suma('total_imp'),
      chk_tot_no_imp: suma('tot_no_imp'),
      chk_tot_haberes: suma('tot_haberes'),
      chk_tot_desc: suma('tot_desc'),
      chk_liquido: suma('liquido'),
    },
    avisos,
  }
}
