// app/api/canje/test-fetch/route.js
// Endpoint de PRUEBA: solo comprueba si Vercel puede leer la web de Asia.
// No parsea, no escribe en Supabase. Solo dice si llega (200) o lo bloquean (403).
// Visitar:  https://crm-arriendos.vercel.app/api/canje/test-fetch

export async function GET() {
  const url = 'https://www.asiapropiedades.cl/venta'
  const inicio = Date.now()
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-CL,es;q=0.9',
      },
    })
    const ms = Date.now() - inicio
    const html = await res.text()
    // Contamos cuantos enlaces a /propiedad/ hay, para saber si vino contenido util
    const enlaces = (html.match(/\/propiedad\/\d+_/g) || [])
    const unicos = [...new Set(enlaces)]
    return Response.json({
      ok: res.ok,
      status: res.status,
      tiempo_ms: ms,
      bytes_recibidos: html.length,
      propiedades_detectadas: unicos.length,
      muestra_enlaces: unicos.slice(0, 5),
      veredicto: res.ok
        ? 'VERCEL SI PUEDE LEER ASIA'
        : 'VERCEL BLOQUEADO (status ' + res.status + ')',
    })
  } catch (err) {
    return Response.json({
      ok: false,
      error: err.message,
      veredicto: 'ERROR DE RED DESDE VERCEL',
    }, { status: 500 })
  }
}