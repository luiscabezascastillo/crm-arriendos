import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const EJECUTIVOS = {
  'Alberto': { nombre: 'Alberto Cabezas',   phone: '+56 9 5357 7235', email: 'alberto.cabezas@fondocapital.com' },
  'Adalis':  { nombre: 'Adalis',             phone: '+56 9 5334 5848', email: 'admon@fondocapital.com' },
  'Tirza':   { nombre: 'Tirza Chavez',       phone: '+56 9 3423 1754', email: 'tirza.chavez@fondocapital.com' },
  'Lorena':  { nombre: 'Lorena Sanmartin',   phone: '+56 9 7618 3560', email: 'lorena.sanmartin@fondocapital.com' },
  'Pedro':   { nombre: 'Pedro Perdomo',      phone: '+56 9 3445 6944', email: 'pedro.perdomo@fondocapital.com' },
  'Neika':   { nombre: 'Neika Duque',        phone: '+56 9 4274 9624', email: 'neika.duque@fondocapital.com' },
}

const REGION_IDS = {
  'Alhué':5532,'Buin':5531,'Calera de Tango':5530,'Cerrillos':5529,'Cerro Navia':5528,
  'COLINA':5527,'Colina':5527,'Conchalí':5526,'Curacaví':5525,'El Bosque':5524,'El Monte':5523,
  'Estación Central':5522,'ESTACION CENTRAL':5522,'HUECHURABA':5521,'Huechuraba':5521,
  'Independencia':5520,'INDEPENDENCIA':5520,'Isla de Maipo':5519,'La Cisterna':5518,
  'La Florida':5517,'LA FLORIDA':5517,'La Granja':5516,'La Pintana':5515,
  'LA REINA':5514,'La Reina':5514,'Lampa':5513,'LAS CONDES':5512,'Las Condes':5512,
  'LO BARNECHEA':5511,'Lo Barnechea':5511,'Lo Espejo':5510,'Lo Prado':5509,
  'MACUL':5508,'Macul':5508,'Maipú':5507,'MAIPU':5507,'María Pinto':5506,'Melipilla':5505,
  'ÑUÑOA':5481,'Ñuñoa':5481,'Padre Hurtado':5504,'Paine':5503,'Pedro Aguirre Cerda':5502,
  'Peñaflor':5501,'Peñalolén':5500,'Pirque':5499,'PROVIDENCIA':5498,'Providencia':5498,
  'Pudahuel':5497,'PUDAHUEL':5497,'Puente Alto':5496,'PUENTE ALTO':5496,
  'Quilicura':5495,'QUILICURA':5495,'Quinta Normal':5494,'Recoleta':5493,'RECOLETA':5493,
  'Renca':5492,'San Bernardo':5491,'SAN BERNARDO':5491,'San Joaquín':5490,
  'San José de Maipo':5489,'San Miguel':5488,'SAN MIGUEL':5488,'San Pedro':5487,
  'San Ramón':5486,'SANTIAGO':5485,'Santiago':5485,'Talagante':5484,'Tiltil':5483,
  'VITACURA':5482,'Vitacura':5482,'Curarrehue':5559,'Pucón':5544,'Villarrica':5534,
  'Antofagasta':5601,'Puerto Varas':5322,'Valparaíso':5445,'Viña del Mar':5443,
  'Temuco':5540,'Concepción':5369,'Rancagua':5413,'Talca':5381,
}

function getCategoryAndType(objetivo, tipo) {
  const esVenta = (objetivo || '').toLowerCase().includes('venta')
  const t = (tipo || '').toUpperCase()
  if (!esVenta) {
    if (t === 'DEPARTAMENTO') return { categoryid: '156', type: 'rent' }
    if (t === 'CASA')         return { categoryid: '157', type: 'rent' }
    if (t === 'OFICINA')      return { categoryid: '160', type: 'comercial' }
    if (t === 'LOCAL')        return { categoryid: '159', type: 'comercial' }
    if (t === 'INDUSTRIAL')   return { categoryid: '174', type: 'comercial_sale' }
    if (t === 'BODEGA')       return { categoryid: '1460', type: 'lot' }
    if (t === 'ESTACIONAMIENTO') return { categoryid: '1460', type: 'lot' }
    return { categoryid: '156', type: 'rent' }
  } else {
    if (t === 'DEPARTAMENTO') return { categoryid: '179', type: 'property' }
    if (t === 'CASA')         return { categoryid: '173', type: 'property' }
    if (t === 'OFICINA')      return { categoryid: '171', type: 'comercial_sale' }
    if (t === 'LOCAL')        return { categoryid: '171', type: 'comercial_sale' }
    if (t === 'INDUSTRIAL')   return { categoryid: '174', type: 'comercial_sale' }
    if (t === 'TERRENO')      return { categoryid: '176', type: 'lot' }
    if (t === 'PARCELA')      return { categoryid: '178', type: 'lot' }
    if (t === 'BODEGA')       return { categoryid: '1459', type: 'lot' }
    if (t === 'ESTACIONAMIENTO') return { categoryid: '1459', type: 'lot' }
    return { categoryid: '179', type: 'property' }
  }
}

function cdata(val) {
  const s = (val || '').toString().replace(/]]>/g, ']]]]><![CDATA[>')
  return `<![CDATA[${s}]]>`
}

function node(indent, tag, val) {
  if (val === null || val === undefined || val === '') return ''
  return `${indent}<${tag}>${cdata(val)}</${tag}>\n`
}

function formatNum(val) {
  if (!val) return ''
  const n = parseFloat(val)
  return isNaN(n) ? '' : n.toString().replace(',', '.')
}

export async function GET() {
  const { data: props, error } = await supabase
    .from('publicaciones')
    .select('*')
    .eq('yapo', 'SI')
    .order('codigo', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const t = '\t'
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<import>\n${t}<settings>\n${t+t}<type>${cdata('rent')}</type>\n${t+t}<language>${cdata('es')}</language>\n${t}</settings>\n\n${t}<items>\n`

  for (const p of props) {
    const ejec = EJECUTIVOS[p.vendedor] || EJECUTIVOS['Alberto']
    const { categoryid, type } = getCategoryAndType(p.objetivo, p.tipo)
    const regionid = (REGION_IDS[p.comuna] || 5485).toString()
    const esUF = (p.tipo_moneda || '').toUpperCase() === 'UF'
    const esVenta = (p.objetivo || '').toLowerCase().includes('venta')
    const isRentType = type === 'rent' || type === 'comercial'
    const titulo = `${p.objetivo || ''}, ${p.tipo || ''}, ${p.comuna || ''}. ${p.dormitorios || '0'}D/${p.banos || '0'}B`

    // Descripción
    let descr = (p.observaciones || '').replace(/<br\s*\/?>/gi, '\n').replace(/&/g, '&amp;')
    descr += `\n- ${p.codigo} -\n\nSi necesita más información contacte con ${ejec.nombre}.\nCelular/WhatsApp ${ejec.phone}.\nemail: ${ejec.email}\nmetros aproximados proporcionados por el dueño`

    // Imágenes
    let pics = ''
    for (let i = 1; i <= 10; i++) {
      const img = p[`imagen${i}`]
      if (img) pics += node(t+t+t+t+t, 'picture', `https://fondocapital.com/propiedades/${img}`)
    }

    // hidemapmarker — TRUE si no es ADMON (ocultar dirección exacta)
    const hideMap = 'TRUE'

    xml += `${t+t}<item>\n`
    // REQUIRED
    xml += `${t+t+t}<required>\n`
    xml += `${t+t+t+t}<ad>\n`
    xml += node(t+t+t+t+t, 'sourceid', p.codigo)
    xml += node(t+t+t+t+t, 'countryid', '5247')
    xml += node(t+t+t+t+t, 'categoryid', categoryid)
    xml += node(t+t+t+t+t, 'regionid', regionid)
    xml += node(t+t+t+t+t, 'type', type)
    xml += node(t+t+t+t+t, 'title', titulo)
    xml += node(t+t+t+t+t, 'currency', esUF ? 'CLF' : 'CLP')
    xml += isRentType
      ? node(t+t+t+t+t, 'rent', formatNum(p.valor))
      : node(t+t+t+t+t, 'price', formatNum(p.valor))
    if (!isRentType) xml += node(t+t+t+t+t, 'square', formatNum(p.mt2_const))
    xml += node(t+t+t+t+t, 'rooms', p.dormitorios)
    xml += node(t+t+t+t+t, 'bath', p.banos)
    xml += node(t+t+t+t+t, 'parking', p.estacionamientos)
    xml += node(t+t+t+t+t, 'advertiser', 'Agente')
    xml += `${t+t+t+t}</ad>\n`
    xml += `${t+t+t+t}<contact>\n`
    xml += node(t+t+t+t+t, 'email', ejec.email)
    xml += node(t+t+t+t+t, 'phone', ejec.phone)
    xml += node(t+t+t+t+t, 'contact', ejec.nombre)
    xml += node(t+t+t+t+t, 'city', p.comuna)
    xml += `${t+t+t+t}</contact>\n`
    xml += `${t+t+t}</required>\n`
    // OPTIONAL
    xml += `${t+t+t}<optional>\n`
    xml += `${t+t+t+t}<ad>\n`
    xml += node(t+t+t+t+t, 'sourceid', p.codigo)
    xml += node(t+t+t+t+t, 'exact', p.direccion)
    xml += node(t+t+t+t+t, 'descr', descr)
    xml += node(t+t+t+t+t, 'maintenance', p.ggcc)
    if (isRentType) xml += node(t+t+t+t+t, 'square', formatNum(p.mt2_const))
    xml += node(t+t+t+t+t, 'location-lat', p.latitud)
    xml += node(t+t+t+t+t, 'location-long', p.longitud)
    xml += pics
    xml += node(t+t+t+t+t, 'youtube', p.video)
    xml += node(t+t+t+t+t, 'hidemapmarker', hideMap)
    xml += `${t+t+t+t}</ad>\n`
    xml += `${t+t+t+t}<contact>\n`
    xml += node(t+t+t+t+t, 'company', 'Fondo Capital')
    xml += node(t+t+t+t+t, 'url', 'https://www.fondocapital.com/')
    xml += `${t+t+t+t}</contact>\n`
    xml += `${t+t+t}</optional>\n`
    xml += `${t+t}</item>\n\n`
  }

  xml += `${t}</items>\n</import>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Content-Disposition': 'attachment; filename="APIYapo.xml"',
    }
  })
}