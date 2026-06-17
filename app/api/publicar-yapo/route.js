import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { registrarBitacora } from '@/lib/bitacora'
import { getServerSession } from 'next-auth'
import * as ftp from 'basic-ftp'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const FTP_HOST = '131.108.211.119'
const FTP_USER = 'fon19_web'
const FTP_PASS = 'Anita2016a'

const EJECUTIVOS = {
  'Alberto':  { nombre: 'Alberto Cabezas',   movil: '+56 9 5357 7235', email: 'alberto.cabezas@fondocapital.com' },
  'Adalis':   { nombre: 'Adalis',             movil: '+56 9 5334 5848', email: 'admon@fondocapital.com' },
  'Tirza':    { nombre: 'Tirza Chavez',       movil: '+56 9 3423 1754', email: 'tirza.chavez@fondocapital.com' },
  'Lorena':   { nombre: 'Lorena Sanmartín',  movil: '+56 9 7618 3560', email: 'lorena.sanmartin@fondocapital.com' },
  'Pedro':    { nombre: 'Pedro Perdomo',      movil: '+56 9 3445 6944', email: 'pedro.perdomo@fondocapital.com' },
  'Neika':    { nombre: 'Neika Duque',        movil: '+56 9 4274 9624', email: 'neika.duque@fondocapital.com' },
}

// Mapa de comunas → regionid de Yapo
const COMUNAS_YAPO = {
  'Alhué': 5532, 'Buin': 5531, 'Calera de Tango': 5530, 'Cerrillos': 5529,
  'Cerro Navia': 5528, 'Colina': 5527, 'COLINA': 5527, 'Conchalí': 5526,
  'Curacaví': 5525, 'El Bosque': 5524, 'El Monte': 5523, 'Estación Central': 5522,
  'Huechuraba': 5521, 'HUECHURABA': 5521, 'Independencia': 5520, 'Isla de Maipo': 5519,
  'La Cisterna': 5518, 'La Florida': 5517, 'La Granja': 5516, 'La Pintana': 5515,
  'La Reina': 5514, 'LA REINA': 5514, 'Lampa': 5513, 'Las Condes': 5512,
  'LAS CONDES': 5512, 'Lo Barnechea': 5511, 'LO BARNECHEA': 5511, 'Lo Espejo': 5510,
  'Lo Prado': 5509, 'Macul': 5508, 'MACUL': 5508, 'Maipú': 5507,
  'Padre Hurtado': 5504, 'Paine': 5503, 'Peñalolén': 5500, 'Pirque': 5499,
  'Providencia': 5498, 'PROVIDENCIA': 5498, 'Pudahuel': 5497, 'Puente Alto': 5496,
  'Quilicura': 5495, 'Quinta Normal': 5494, 'Recoleta': 5493, 'Renca': 5492,
  'San Bernardo': 5491, 'San Joaquín': 5490, 'San Miguel': 5488, 'Santiago': 5485,
  'SANTIAGO': 5485, 'Talagante': 5484, 'Vitacura': 5482, 'VITACURA': 5482,
  'Ñuñoa': 5481, 'ÑUÑOA': 5481, 'Antofagasta': 5601, 'Calama': 5600,
  'Iquique': 5605, 'Valparaíso': 5445, 'Viña del Mar': 5443, 'Quilpué': 5453,
  'Concepción': 5369, 'Temuco': 5540, 'Puerto Montt': 5324, 'Curarrehue': 5559,
  'Puerto Varas': 5322, 'Coronel': 5367, 'Pucón': 5544, 'Villarrica': 5534,
  'Algarrobo': 5479, 'San Antonio': 5450, 'Chillán': 5268, 'San Fabián': 5254,
}

// Tipo Yapo por operación y tipo de propiedad
function getTipoYapo(objetivo, tipo) {
  const esVenta = (objetivo || '').toLowerCase().includes('venta')
  const t = (tipo || '').toUpperCase()
  if (esVenta) {
    if (t === 'CASA') return { type: 'property', categoryid: 173 }
    if (t === 'DEPARTAMENTO') return { type: 'property', categoryid: 179 }
    if (t === 'OFICINA') return { type: 'comercial_sale', categoryid: 171 }
    if (t === 'TERRENO') return { type: 'lot', categoryid: 176 }
    if (t === 'PARCELA') return { type: 'lot', categoryid: 178 }
    if (t === 'BODEGA') return { type: 'lot', categoryid: 1459 }
    if (t === 'INDUSTRIAL') return { type: 'comercial_sale', categoryid: 174 }
    return { type: 'property', categoryid: 179 }
  } else {
    if (t === 'CASA') return { type: 'rent', categoryid: 157 }
    if (t === 'DEPARTAMENTO') return { type: 'rent', categoryid: 156 }
    if (t === 'OFICINA') return { type: 'comercial', categoryid: 160 }
    if (t === 'LOCAL') return { type: 'comercial', categoryid: 159 }
    if (t === 'BODEGA') return { type: 'lot', categoryid: 1460 }
    if (t === 'INDUSTRIAL') return { type: 'comercial_sale', categoryid: 174 }
    return { type: 'rent', categoryid: 156 }
  }
}

function escapeXml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cdata(val) {
  return `<![CDATA[${val || ''}]]>`
}

function xmlNode(tag, val, indent = '\t\t\t\t\t') {
  if (!val && val !== 0) return ''
  return `${indent}<${tag}>${cdata(String(val))}</${tag}>\n`
}

function generarXML(propiedades) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<import>\n'
  xml += '\t<settings>\n'
  xml += '\t\t<type>rent</type>\n'
  xml += '\t\t<language>es</language>\n'
  xml += '\t</settings>\n\n'
  xml += '\t<items>\n'

  for (const p of propiedades) {
    const { type, categoryid } = getTipoYapo(p.objetivo, p.tipo)
    const regionid = COMUNAS_YAPO[p.comuna] || COMUNAS_YAPO[(p.comuna || '').toUpperCase()] || 5485
    const ejec = EJECUTIVOS[p.vendedor] || EJECUTIVOS['Alberto']
    const esUF = (p.tipo_moneda || '').toUpperCase() === 'UF'
    const moneda = esUF ? 'CLF' : 'CLP'
    const titulo = `${p.objetivo || ''}, ${p.tipo || ''}, ${p.comuna || ''}. ${p.dormitorios || '0'}D/${p.banos || '0'}B`

    // Descripción con firma del ejecutivo
    let descripcion = p.observaciones || ''
    if (ejec) {
      descripcion += `\n- ${p.codigo} - \n\nSi necesita más información contacte con ${ejec.nombre}.\nCelular/WhatsApp ${ejec.movil}.\nemail: ${ejec.email}`
    }

    // Imágenes
    const imgs = Array.from({ length: 30 }, (_, i) => p[`imagen${i+1}`]).filter(Boolean)
    const pictureStr = imgs.map(img => `https://fondocapital.com/propiedades/${img}`).join('\n')

    // Ciudad desde título
    const cityParts = titulo.split(',')
    const city = cityParts.length >= 3 ? cityParts[2].split('.')[0].trim() : 'Santiago'

    xml += '\t\t<item>\n'
    xml += '\t\t\t<required>\n'
    xml += '\t\t\t\t<ad>\n'
    xml += xmlNode('sourceid', p.codigo)
    xml += xmlNode('countryid', 5247)
    xml += xmlNode('categoryid', categoryid)
    xml += xmlNode('regionid', regionid)
    xml += xmlNode('type', type)
    xml += xmlNode('title', titulo)
    xml += xmlNode('currency', moneda)
    if (type === 'rent' || type === 'comercial') {
      xml += xmlNode('rent', p.valor)
    } else {
      xml += xmlNode('price', p.valor)
    }
    if (type !== 'rent') xml += xmlNode('square', p.mt2_const)
    xml += xmlNode('rooms', p.dormitorios)
    xml += xmlNode('bath', p.banos)
    xml += xmlNode('parking', p.estacionamientos)
    xml += xmlNode('advertiser', 'Agente')
    xml += '\t\t\t\t</ad>\n'
    xml += '\t\t\t\t<contact>\n'
    xml += xmlNode('email', ejec.email)
    xml += xmlNode('phone', ejec.movil)
    xml += xmlNode('contact', ejec.nombre)
    xml += xmlNode('city', city)
    xml += '\t\t\t\t</contact>\n'
    xml += '\t\t\t</required>\n'

    xml += '\t\t\t<optional>\n'
    xml += '\t\t\t\t<ad>\n'
    xml += xmlNode('sourceid', p.codigo)
    xml += xmlNode('exact', p.direccionreal || p.direccion)
    xml += xmlNode('descr', descripcion)
    xml += xmlNode('maintenance', p.ggcc)
    if (type === 'rent') xml += xmlNode('square', p.mt2_const)
    xml += xmlNode('location-lat', p.latitud)
    xml += xmlNode('location-long', p.longitud)
    if (pictureStr) {
      for (const img of imgs) {
        xml += `\t\t\t\t\t<picture>${cdata(`https://fondocapital.com/propiedades/${img}`)}</picture>\n`
      }
    }
    xml += xmlNode('youtube', p.video)
    xml += xmlNode('hidemapmarker', p.admon_si_o_no === 'NO' ? 'TRUE' : 'FALSE')
    xml += '\t\t\t\t</ad>\n'
    xml += '\t\t\t\t<contact>\n'
    xml += '\t\t\t\t\t<company><![CDATA[Fondo Capital]]></company>\n'
    xml += '\t\t\t\t\t<url><![CDATA[https://www.fondocapital.com/]]></url>\n'
    xml += '\t\t\t\t</contact>\n'
    xml += '\t\t\t</optional>\n'
    xml += '\t\t</item>\n\n'
  }

  xml += '\t</items>\n'
  xml += '</import>\n'
  return xml
}

export async function POST(request) {
    try {
      const session = await getServerSession()
      const usuarioBitacora = session?.user?.name || session?.user?.email || null
      const { publicacionId } = await request.json()

    // 1 — Marcar propiedad como yapo='SI' en Supabase
    if (publicacionId) {
        await supabase.from('publicaciones').update({ yapo: 'SI' }).eq('id', publicacionId)
        await registrarBitacora({ idpublicacion: publicacionId, evento: 'publicar_yapo', detalle: 'Publicado en Yapo', usuario: usuarioBitacora })
      }

    // 2 — Traer todas las propiedades con yapo='SI'
    const { data: propiedades, error } = await supabase
      .from('publicaciones')
      .select('*')
      .eq('yapo', 'SI')
      .order('codigo', { ascending: false })

    if (error) throw new Error('Error Supabase: ' + error.message)
    if (!propiedades || propiedades.length === 0) {
      return NextResponse.json({ error: 'No hay propiedades con yapo=SI' }, { status: 400 })
    }

    // 3 — Generar XML
    const xml = generarXML(propiedades)

    // 4 — Subir al FTP
    const client = new ftp.Client()
    client.ftp.verbose = false

    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASS,
      secure: false,
      port: 21,
    })

    const { Readable } = await import('stream')
    const buffer = Buffer.from(xml, 'utf8')
    const stream = Readable.from(buffer)
    await client.cd('/public_html')
    await client.uploadFrom(stream, 'APIYapo.xml')
    client.close()

    return NextResponse.json({
      ok: true,
      total: propiedades.length,
      mensaje: `✓ APIYapo.xml subido al FTP con ${propiedades.length} propiedades`,
    })

  } catch (error) {
    console.error('Error publicar-yapo:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
