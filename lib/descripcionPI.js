// VERSION: v1 · 2026-08-23 · Builder ÚNICO de la descripción para Portal Inmobiliario (MercadoLibre).
//   Antes el texto se construía por separado en publicar-pi, actualizar-pi y publicar-pi/descripcion, con
//   limpiezas distintas (unos quitaban emojis, otro reparaba mojibake, otro no colapsaba espacios), así que
//   la descripción podía salir diferente según el botón. Ahora los tres importan esto y el texto es idéntico.
//   Recibe un objeto con { observaciones, codigo }.

export function construirDescripcionPI(pub) {
  let descripcion = (pub && pub.observaciones) || ''
  const codigo = (pub && pub.codigo != null) ? pub.codigo : ''
  descripcion += `\n - ${codigo} - \n\nmetros aproximados proporcionados por el dueno`

  return descripcion
    // 1) Saltos de línea desde HTML (<br>, </br>) que pueda traer observaciones
    .replace(/<br\s*\/?>/gi, '\n ').replace(/<\/br>/gi, '\n ')
    // 2) Reparar mojibake (UTF-8 mal interpretado como Latin-1). Escapes explícitos para evitar
    //    ambigüedades de codificación en el propio archivo. Ã = 'Ã'.
    .replace(/Ã¡/g, 'á') // Ã¡ -> á
    .replace(/Ã©/g, 'é') // Ã© -> é
    .replace(/Ã­/g, 'í') // Ã­ -> í
    .replace(/Ã³/g, 'ó') // Ã³ -> ó
    .replace(/Ãº/g, 'ú') // Ãº -> ú
    .replace(/Ã±/g, 'ñ') // Ã± -> ñ
    // 3) Quitar emojis y símbolos que ML no admite en la descripción
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
    // 4) Colapsar espacios dobles
    .replace(/ {2,}/g, ' ')
}
