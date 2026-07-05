// lib/parsearAviso.js
// Extrae precio / m² / dormitorios desde el contenido pegado de un aviso
// (código fuente HTML o texto visible de Portal Inmobiliario / MercadoLibre).
// Best-effort: prueba JSON-LD, luego regex sobre el texto. Devuelve `debug`
// con lo que encontró, para poder calibrar si algo sale raro.

// Parseo de número en formato chileno: punto = miles, coma = decimal.
function toNum(s) {
  if (s == null) return null;
  const clean = String(s).replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isFinite(n) ? n : null;
}

function extraerTitulo(html) {
  let m = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (m) return m[1];
  m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extraerLink(html) {
  let m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (m) return m[1];
  m = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

// Intenta JSON-LD (bloques <script type="application/ld+json">)
function extraerJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const j = JSON.parse(b[1].trim());
      const arr = Array.isArray(j) ? j : [j];
      for (const o of arr) {
        const price = o?.offers?.price ?? o?.price;
        if (price != null) {
          const cur = o?.offers?.priceCurrency || o?.priceCurrency;
          return {
            precio: toNum(price),
            moneda: cur === 'CLF' ? 'UF' : (cur === 'CLP' ? 'CLP' : null),
            titulo: o?.name || null,
          };
        }
      }
    } catch { /* sigue */ }
  }
  return null;
}

function extraerPrecioTexto(txt) {
  // UF primero (las ventas en PI suelen ir en UF)
  let m = txt.match(/UF\s*([\d.\s]+\d)/i);
  if (m) { const v = toNum(m[1]); if (v && v > 10) return { precio: v, moneda: 'UF' }; }
  // CLP (mínimo 7 dígitos para no confundir con GGCC)
  m = txt.match(/\$\s*([\d.]{7,})/);
  if (m) { const v = toNum(m[1]); if (v && v > 1000000) return { precio: v, moneda: 'CLP' }; }
  return { precio: null, moneda: null };
}

function extraerM2(txt) {
  // preferimos superficie útil (es la que se usa para tasar)
  const util = txt.match(/[úu]til[^\d]{0,25}([\d.,]+)\s*m/i);
  if (util) { const v = toNum(util[1]); if (v) return { m2: v, tipo: 'útil' }; }
  const total = txt.match(/total[^\d]{0,25}([\d.,]+)\s*m/i);
  if (total) { const v = toNum(total[1]); if (v) return { m2: v, tipo: 'total' }; }
  const gen = txt.match(/([\d.,]+)\s*m[²2]\b/i);
  if (gen) { const v = toNum(gen[1]); if (v) return { m2: v, tipo: 'general' }; }
  return { m2: null, tipo: null };
}

function extraerDorm(txt) {
  const m = txt.match(/(\d+)\s*dormitorio/i);
  return m ? parseInt(m[1], 10) : null;
}

export function parsearAviso(contenido) {
  const html = String(contenido || '');
  // texto plano para los regex (saca scripts y tags si viene HTML)
  const txt = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

  const ld = extraerJsonLd(html);
  const precioTxt = extraerPrecioTexto(txt);
  const m2 = extraerM2(txt);

  return {
    titulo: (ld && ld.titulo) || extraerTitulo(html),
    link: extraerLink(html),
    precio: (ld && ld.precio) || precioTxt.precio,
    moneda: (ld && ld.moneda) || precioTxt.moneda,
    m2: m2.m2,
    dormitorios: extraerDorm(txt),
    debug: {
      via_precio: ld && ld.precio ? 'json-ld' : (precioTxt.precio ? 'texto' : 'no encontrado'),
      m2_tipo: m2.tipo,
      largo_contenido: html.length,
    },
  };
}
