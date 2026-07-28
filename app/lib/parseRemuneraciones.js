// VERSION: v2 · 2026-07-27 · Lector del Libro de Remuneraciones de Nubox en PDF.
//   v2: el RUT se normaliza SIN PUNTOS. El PDF trae '26.062.899-2' pero rem_lineas,
//       rem_empleados y rem_empleado_ccb guardan '26062899-2'. Con puntos, la carga
//       habria entrado pero el reparto por RUT no habria casado con nada y nadie
//       habria entendido por que no heredaba.
//
// Nubox lo emite en DOS paginas por periodo:
//   pag. 1 HABERES     Cod · RUT · Nombre · DT · S.Base · H.Extra · Grat.Legal ·
//                      Otros Imp. · Total Imp. · Asig.Fam. · Otr.No Imp. · Tot.No Imp · Tot.Haberes
//   pag. 2 DESCUENTOS  Cod · RUT · Nombre · DT · Prevision · Salud · Imp.Unico · Seg.Ces. ·
//                      Otros D.Leg. · Tot.D.Leg. · Desc.Varios · Tot.Desc. · Liquido
// Las dos se cruzan por RUT y dan exactamente los campos de rem_lineas.
//
// Como se parsea: NO por posicion de columna, que cambia con la longitud de los
// nombres. Se ancla en el RUT y se toman los 10 ULTIMOS numeros de la fila; lo que
// queda entre el RUT y esos numeros es el nombre, tenga las palabras que tenga.
//
// OJO: el libro NO trae los aportes del empleador (SIS, cesantia patronal, mutual,
// SANNA). Esos vienen de la planilla de Previred, asi que el coste empresa seguira
// marcado como incompleto hasta que se carguen aparte.
//
// pdf.js se carga desde CDN para no añadir dependencia al proyecto ni pelearse con
// el worker en el build de Next.
'use client'

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174'

const MESES = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
  JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
}
const sinTildes = (t) => t.replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U')
const RE_RUT = /(\d{1,2}\.\d{3}\.\d{3}\s*-\s*[\dkK])/

const num = (t) => {
  const s = String(t).replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return isNaN(n) ? null : Math.round(n)
}
const esNum = (t) => /^-?[\d.]+$/.test(t) && num(t) !== null

async function cargarPdfJs() {
  if (typeof window === 'undefined') throw new Error('Solo en el navegador.')
  if (window.pdfjsLib) return window.pdfjsLib
  await new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `${CDN}/pdf.min.js`
    s.onload = resolve
    s.onerror = () => reject(new Error('No pude cargar el lector de PDF (pdf.js). ¿Hay conexión?'))
    document.head.appendChild(s)
  })
  if (!window.pdfjsLib) throw new Error('pdf.js no quedó disponible.')
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${CDN}/pdf.worker.min.js`
  return window.pdfjsLib
}

// Reconstruye las lineas de una pagina a partir de los fragmentos de texto.
// Se agrupa por altura (y) y se ordena por x. El espacio se mete SOLO si hay hueco
// real entre fragmentos: si no, pdf.js podria partir un RUT en dos y romper el ancla.
function lineasDePagina(items) {
  const filas = new Map()
  for (const it of items) {
    const t = it.str
    if (!t || !t.trim()) continue
    const x = it.transform[4]
    const y = Math.round(it.transform[5])
    if (!filas.has(y)) filas.set(y, [])
    filas.get(y).push({ x, ancho: it.width || 0, t })
  }
  const out = []
  for (const y of Array.from(filas.keys()).sort((a, b) => b - a)) {
    const frs = filas.get(y).sort((a, b) => a.x - b.x)
    let linea = ''
    let finAnterior = null
    for (const f of frs) {
      if (finAnterior !== null && f.x - finAnterior > 1.5) linea += ' '
      linea += f.t
      finAnterior = f.x + f.ancho
    }
    out.push(linea)
  }
  return out
}

export function tipoDePagina(texto) {
  const T = texto.toUpperCase()
  if (T.includes('TOT.HABERES') || T.includes('S. BASE')) return 'haberes'
  if (T.includes('LIQUIDO') || T.includes('LÍQUIDO') || T.includes('PREVISI')) return 'descuentos'
  return null
}

export function periodoDe(texto) {
  const m = sinTildes(texto.toUpperCase()).match(/MES:\s*([A-ZÑ]+)\s+DEL\s+(\d{4})/)
  if (!m) return null
  const mes = MESES[m[1]]
  if (!mes) return null
  return {
    periodo: `${m[2]}-${String(mes).padStart(2, '0')}-01`,
    mes_texto: `MES: ${m[1]} DEL ${m[2]}`,
  }
}

function filasDe(lineas) {
  const out = []
  for (const linea of lineas) {
    const l = String(linea).trim()
    if (!l) continue
    if (/^(TOTAL\s+GENERAL|Personal|C[oó]d\b|R\.U\.T\.)/i.test(l)) continue
    const m = l.match(RE_RUT)
    if (!m) continue
    const antes = l.slice(0, m.index).trim().split(/\s+/).filter(Boolean)
    const resto = l.slice(m.index + m[0].length).trim().split(/\s+/).filter(Boolean)
    const nums = []
    while (resto.length && esNum(resto[resto.length - 1]) && nums.length < 10) nums.unshift(num(resto.pop()))
    if (nums.length < 10) continue
    out.push({
      cod: antes.length ? antes[antes.length - 1] : null,
      rut: m[1].replace(/[\s.]/g, '').toUpperCase(),   // 26.062.899-2 -> 26062899-2
      rut_fmt: m[1].replace(/\s+/g, ''),
      nombre: resto.join(' ').trim(),
      nums,
    })
  }
  return out
}

function totalesDe(lineas) {
  for (const linea of lineas) {
    if (!/TOTAL\s+GENERAL/i.test(linea)) continue
    const t = String(linea).trim().split(/\s+/).filter(Boolean)
    const nums = []
    while (t.length && esNum(t[t.length - 1]) && nums.length < 10) nums.unshift(num(t.pop()))
    if (nums.length >= 10) return nums
  }
  return null
}

// ---- API principal ----
// Devuelve { periodo, mes_texto, archivo, lineas[], totales{}, avisos[] }
export async function parseLibroRemuneracionesPDF(file) {
  const pdfjs = await cargarPdfJs()
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise

  const paginas = []
  let textoTodo = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i)
    const tc = await pg.getTextContent()
    const lineas = lineasDePagina(tc.items)
    const texto = lineas.join('\n')
    textoTodo += texto + '\n'
    paginas.push({ n: i, lineas, texto, tipo: tipoDePagina(texto) })
  }

  const per = periodoDe(textoTodo)
  if (!per) throw new Error('No encontré el periodo ("MES: … DEL ….") ¿Es el Libro de Remuneraciones de Nubox?')
  if (!paginas.some(p => p.tipo === 'haberes')) throw new Error('No encontré la página de HABERES.')

  const avisos = []
  if (!paginas.some(p => p.tipo === 'descuentos')) {
    avisos.push('No venía la página de descuentos: se cargan solo los haberes.')
  }

  const acc = new Map()
  let totHaberes = null, totDesc = null
  for (const p of paginas) {
    if (!p.tipo) continue
    const t = totalesDe(p.lineas)
    if (p.tipo === 'haberes') totHaberes = t || totHaberes
    if (p.tipo === 'descuentos') totDesc = t || totDesc
    for (const f of filasDe(p.lineas)) {
      const e = acc.get(f.rut) || { rut: f.rut, rut_fmt: f.rut_fmt, cod_libro: f.cod ? Number(String(f.cod).replace(/\D/g, '')) || null : null, nombre_libro: f.nombre }
      if (p.tipo === 'haberes') {
        const [dt, base, he, grat, otros, timp, af, oni, tni, th] = f.nums
        Object.assign(e, { dt, sueldo_base: base, horas_extras: he, grat_legal: grat, otros_imp: otros, total_imp: timp, asig_fam: af, otros_no_imp: oni, tot_no_imp: tni, tot_haberes: th })
      } else {
        const [dt, prev, sal, iu, sc, odl, tdl, dv, td, liq] = f.nums
        Object.assign(e, { dt: e.dt ?? dt, prevision: prev, salud: sal, imp_unico: iu, seg_ces: sc, otros_dleg: odl, tot_dleg: tdl, desc_varios: dv, tot_desc: td, liquido: liq })
      }
      acc.set(f.rut, e)
    }
  }

  const lineas = Array.from(acc.values())
  if (!lineas.length) throw new Error('No pude leer ninguna línea de trabajador.')

  // Cuadre contra el TOTAL GENERAL del propio PDF. Si no cuadra, el parseo fallo:
  // mejor avisar que cargar un libro mal leido.
  const suma = (k) => lineas.reduce((a, x) => a + (x[k] || 0), 0)
  const chequear = (etiqueta, calc, esperado) => {
    if (esperado == null) return
    if (Math.abs(calc - esperado) > 0) avisos.push(`${etiqueta}: leí ${calc.toLocaleString('es-CL')} y el PDF dice ${esperado.toLocaleString('es-CL')}.`)
  }
  if (totHaberes) {
    chequear('Total haberes', suma('tot_haberes'), totHaberes[9])
    chequear('Total imponible', suma('total_imp'), totHaberes[5])
    chequear('Días trabajados', suma('dt'), totHaberes[0])
  }
  if (totDesc) {
    chequear('Total descuentos', suma('tot_desc'), totDesc[8])
    chequear('Líquido', suma('liquido'), totDesc[9])
  }

  return {
    ...per,
    archivo: file.name,
    n_empleados: lineas.length,
    lineas,
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
