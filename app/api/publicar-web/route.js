import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as ftp from 'basic-ftp'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const FTP_HOST = '131.108.211.119'
const FTP_USER = 'fon19_webexcel'
const FTP_PASS = 'Anita2016a'

const EJECUTIVOS = {
  'Alberto':  { nombre: 'Alberto Cabezas',   vendeid: 535843, movil: '+56 9 5357 7235', email: 'alberto.cabezas@fondocapital.com' },
  'Adalis':   { nombre: 'Adalis',             vendeid: 487399, movil: '+56 9 5334 5848', email: 'admon@fondocapital.com' },
  'Tirza':    { nombre: 'Tirza Chavez',       vendeid: 598429, movil: '+56 9 3423 1754', email: 'tirza.chavez@fondocapital.com' },
  'Lorena':   { nombre: 'Lorena Sanmartín',  vendeid: 69004,  movil: '+56 9 7618 3560', email: 'lorena.sanmartin@fondocapital.com' },
  'Pedro':    { nombre: 'Pedro Perdomo',      vendeid: 690001, movil: '+56 9 3445 6944', email: 'pedro.perdomo@fondocapital.com' },
  'Neika':    { nombre: 'Neika Duque',        vendeid: 69006,  movil: '+56 9 4274 9624', email: 'neika.duque@fondocapital.com' },
}

export async function POST(request) {
  try {
    const { publicacionId } = await request.json()

    // 1 — Marcar propiedad como web='SI' en Supabase
    if (publicacionId) {
      await supabase.from('publicaciones').update({ web: 'SI' }).eq('id', publicacionId)
    }

    // 2 — Traer todas las propiedades con web='SI'
    const { data: props, error } = await supabase
      .from('publicaciones')
      .select('*')
      .eq('web', 'SI')
      .order('codigo', { ascending: false })

    if (error) throw new Error('Error Supabase: ' + error.message)
    if (!props || props.length === 0) {
      return NextResponse.json({ error: 'No hay propiedades con web=SI' }, { status: 400 })
    }

    // 3 — Construir descripción con firma del ejecutivo (igual que VBA)
    function buildObservaciones(p) {
      const ejec = EJECUTIVOS[p.vendedor] || null
      let obs = p.observaciones || ''
      if (ejec) {
        obs += `</br>- ${p.codigo} - </br></br>Si necesita más información contacte con ${ejec.nombre}, Celular/WhatsApp ${ejec.movil}. ${ejec.email} </br>metros aproximados proporcionados por el dueño`
      }
      return obs
    }

    // 4 — Construir filas con estructura exacta del Excel original
    const filas = props.map(p => {
      const ejec = EJECUTIVOS[p.vendedor] || null
      const fila = {
        'CODIGO':       p.codigo || '',
        'OBJETIVO':     p.objetivo || '',
        'TIPO':         p.tipo || '',
        'COMUNA':       p.comuna || '',
        'UBICACIÓN':    p.direccion || '',
        'TIPO MONEDA':  p.tipo_moneda || '',
        'VALOR':        p.valor || '',
        'MT2 CONST':    p.mt2_const || '',
        'MT2 TERRENO':  p.mt2_terreno || '',
        'DORMITORIOS':  p.dormitorios || '',
        'BAÑOS':        p.banos || '',
        'LATITUD':      p.latitud || '',
        'LONGITUD':     p.longitud || '',
        'AMOBLADO':     p.amoblado || '',
        'OBSERVACIONES': buildObservaciones(p),
      }

      // Imágenes 1-50 — solo nombre de archivo, sin URL completa
      for (let i = 1; i <= 50; i++) {
        fila[`IMAGEN${i}`] = p[`imagen${i}`] || ''
      }

      fila['Servicios']          = p.servicios || ''
      fila['VendeID']            = ejec ? ejec.vendeid : ''
      fila['PERSONA']            = p.vendedor || ''
      fila['CODIGO_2']           = p.codigo || ''
      fila['ACCION']             = p.activo || ''
      fila['ESTADO']             = p.estado || ''
      fila['CODIGO_PI']          = p.codigo_pi || ''
      fila['ESTACIONAMIENTOS']   = p.estacionamientos || ''
      fila['BODEGAS']            = p.bodegas || ''
      fila['GGCC']               = p.ggcc || ''
      fila['ORIENTACION']        = p.orientacion || ''
      fila['REGION']             = p.direccionreal || p.direccion || ''
      fila['NÚMERO']             = p.numero || p.comuna || ''
      fila['VIDEO']              = p.video || ''
      fila['DIRECCION-REAL']     = p.direccionreal || p.direccion || ''
      fila['Ksuitable for pets'] = p.ksuitable_for_pets || ''
      fila['ADMON SI o NO']      = p.admon_si_o_no || ''
      fila['IDADMON']            = p.idadmon || ''
      fila['IDINMUE']            = p.idinmue || ''
      fila['ESTADO_2']           = p.estado_2 || ''
      fila['Propietario_2']      = p.propietario_2 || ''
      fila['NUM']                = p.codigo || ''
      fila['PI_2']               = p.pi || ''
      fila['WEB_2']              = p.web || ''
      fila['TT']                 = p.tt || ''

      return fila
    })

    // 5 — Generar Excel en memoria con xlsx
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(filas)
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // 6 — Subir al FTP
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
    const stream = Readable.from(buffer)
    await client.uploadFrom(stream, 'propiedades.xlsx')
    client.close()

    return NextResponse.json({
      ok: true,
      total: props.length,
      mensaje: `✓ propiedades.xlsx subido con ${props.length} propiedades`,
    })

  } catch (error) {
    console.error('Error publicar-web:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}