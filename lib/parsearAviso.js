// lib/parsearAviso.js
// Dos funciones:
//  - parsearAviso(contenido): extrae UN aviso individual (HTML o texto).
//  - parsearListado(texto): extrae TODOS los comparables de una página de listado PI.

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
          return { precio: toNum(price), moneda: cur === 'CLF' ? 'UF' : (cur === 'CLP' ? 'CLP' : null), titulo: o?.name || null };
        }
      }
    } catch { /* sigue */ }
  }
  return null;
}
function extraerPrecioTexto(txt) {
  let m = txt.match(/UF\s*([\d][\d.,]*)/i);
  if (m) { const v = toNum(m[1]); if (v && v > 10) return { precio: v, moneda: 'UF' }; }
  m = txt.match(/\$\s*([\d.]{7,})/);
  if (m) { const v = toNum(m[1]); if (v && v > 1000000) return { precio: v, moneda: 'CLP' }; }
  return { precio: null, moneda: null };
}
function extraerM2(txt, htmlRaw) {
  const jsonAttr = (id) => {
    let re = new RegExp('"' + id + '"[\\s\\S]{0,300}?"value_name"\\s*:\\s*"([\\d.,]+)', 'i');
    let m = htmlRaw.match(re); if (m) return toNum(m[1]);
    re = new RegExp('"' + id + '"[\\s\\S]{0,300}?"number"\\s*:\\s*([\\d.,]+)', 'i');
    m = htmlRaw.match(re); return m ? toNum(m[1]) : null;
  };
  let v = jsonAttr('COVERED_AREA'); if (v) return { m2: v, tipo: 'útil(json)' };
  v = jsonAttr('TOTAL_AREA'); if (v) return { m2: v, tipo: 'total(json)' };
  const label = (rx) => { const m = txt.match(rx); return m ? toNum(m[1]) : null; };
  v = label(/[úu]til(?:es)?[^\d]{0,25}([\d.,]+)\s*m/i) || label(/([\d.,]+)\s*m[²2][^.]{0,15}[úu]til/i);
  if (v) return { m2: v, tipo: 'útil' };
  v = label(/construid[oa]s?[^\d]{0,25}([\d.,]+)\s*m/i); if (v) return { m2: v, tipo: 'construida' };
  v = label(/total(?:es)?[^\d]{0,25}([\d.,]+)\s*m/i); if (v) return { m2: v, tipo: 'total' };
  const gen = txt.match(/([\d.,]+)\s*m[²2](?![a-z])/i);
  if (gen) { const n = toNum(gen[1]); if (n && n >= 10 && n <= 2000) return { m2: n, tipo: 'general' }; }
  return { m2: null, tipo: null };
}
function extraerDorm(txt, htmlRaw) {
  let m = txt.match(/(\d+)\s*dormitorio/i); if (m) return parseInt(m[1], 10);
  m = htmlRaw.match(/"BEDROOMS"[\s\S]{0,300}?"value_name"\s*:\s*"(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

export function parsearAviso(contenido) {
  const html = String(contenido || '');
  const txt = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const ld = extraerJsonLd(html);
  const precioTxt = extraerPrecioTexto(txt);
  const m2 = extraerM2(txt, html);
  return {
    titulo: (ld && ld.titulo) || extraerTitulo(html),
    link: extraerLink(html),
    precio: (ld && ld.precio) || precioTxt.precio,
    moneda: (ld && ld.moneda) || precioTxt.moneda,
    m2: m2.m2,
    dormitorios: extraerDorm(txt, html),
    debug: { via_precio: ld && ld.precio ? 'json-ld' : (precioTxt.precio ? 'texto' : 'no encontrado'), m2_tipo: m2.tipo || 'no encontrado', largo_contenido: html.length },
  };
}

// Extrae TODOS los comparables de una página de listado de Portal Inmobiliario.
// Patrón por tarjeta: título -> "UF" -> precio -> N dormitorio -> N baño -> N m² útiles -> WhatsApp
export function parsearListado(texto) {
  const lineas = String(texto || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const items = [];
  for (let i = 0; i < lineas.length; i++) {
    if (/^UF$/i.test(lineas[i])) {
      const precio = toNum(lineas[i + 1]);
      let titulo = null;
      for (let j = i - 1; j >= 0; j--) {
        if (/^(VISTO|WhatsApp|Solicitud online de visita)$/i.test(lineas[j])) continue;
        titulo = lineas[j]; break;
      }
      let m2 = null, dorm = null, banos = null;
      for (let k = i + 1; k < Math.min(i + 8, lineas.length); k++) {
        const mm = lineas[k].match(/([\d.,]+)\s*m[²2]/i); if (mm && !m2) m2 = toNum(mm[1]);
        const dd = lineas[k].match(/(\d+)\s*dormitorio/i); if (dd && !dorm) dorm = parseInt(dd[1], 10);
        const bb = lineas[k].match(/(\d+)\s*ba/i); if (bb && !banos) banos = parseInt(bb[1], 10);
      }
      const extras = /estc|estac|bodega|terraza/i.test(titulo || '');
      if (precio && m2) {
        items.push({
          link: '', titulo: (titulo || '').slice(0, 60), precio, moneda: 'UF',
          m2_util: m2, terraza: '', dormitorios: dorm, estac: '', bodega: '',
          revisar: extras,
        });
      }
    }
  }
  return items;
}
