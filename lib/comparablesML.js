// lib/comparablesML.js
// Trae comparables de Portal Inmobiliario (MercadoLibre Chile) vía API oficial.
// Requiere el access_token de ML que ya guardas en Supabase (configuracion).
//
// OJO: verifica primero con /api/valoraciones/test-ml si el buscador te devuelve
// publicaciones de terceros. Si ML lo bloquea, aquí es donde cambiarías la
// implementación por scraping de portalinmobiliario.cl (misma firma de función).

const ML_API = 'https://api.mercadolibre.com';

// Categorías ML Chile — VERIFICAR con GET /sites/MLC/categories antes de prod.
//   Inmuebles (raíz): MLC1459
// El buscador acepta q= (texto libre) + category. Empezamos por la raíz de
// inmuebles y afinamos con el texto (tipo + operación + comuna).
const CAT_INMUEBLES = 'MLC1459';

function attr(item, ...ids) {
  const attrs = item.attributes || [];
  for (const id of ids) {
    const a = attrs.find((x) => x.id === id);
    if (!a) continue;
    if (a.value_struct && a.value_struct.number != null) return Number(a.value_struct.number);
    const raw = String(a.value_name || '').replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(raw);
    if (isFinite(n)) return n;
  }
  return null;
}

function extraerM2(item) {
  // superficie útil/cubierta preferida; si no, total
  return attr(item, 'COVERED_AREA', 'TOTAL_AREA', 'AREA');
}

function extraerDormitorios(item) {
  const n = attr(item, 'BEDROOMS', 'ROOMS');
  return n != null ? Math.round(n) : null;
}

// Convierte el precio del item a UF. ML Chile usa CLF (UF) o CLP.
function precioEnUF(item, valorUf) {
  const p = Number(item.price);
  if (!isFinite(p) || p <= 0) return null;
  if (item.currency_id === 'CLF') return p;                 // ya viene en UF
  if (item.currency_id === 'CLP') return valorUf ? p / valorUf : null;
  return null;
}

// Devuelve un array de comparables normalizados (solo los que tienen m² y precio).
export async function buscarComparablesML({
  accessToken,
  comuna,
  tipo = 'departamento',   // 'departamento' | 'casa'
  operacion = 'venta',     // 'venta' | 'arriendo'
  categoria = CAT_INMUEBLES,
  limit = 50,
  valorUf = null,
}) {
  const q = `${tipo} ${operacion} ${comuna}`.trim();
  const url = `${ML_API}/sites/MLC/search?category=${encodeURIComponent(categoria)}`
            + `&q=${encodeURIComponent(q)}&limit=${limit}`;

  const res = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new Error(`ML search ${res.status}`);
    err.status = res.status;
    err.detalle = txt.slice(0, 500);
    throw err;
  }

  const data = await res.json();
  const results = data.results || [];

  return results
    .map((it) => {
      const precio_uf = precioEnUF(it, valorUf);
      const m2 = extraerM2(it);
      return {
        ml_id: it.id,
        titulo: it.title,
        precio: Number(it.price),
        moneda: it.currency_id,
        precio_uf,
        m2,
        dormitorios: extraerDormitorios(it),
        comuna: it.address?.city_name || it.location?.city?.name || null,
        permalink: it.permalink,
      };
    })
    .filter((c) => c.m2 && c.m2 >= 10 && c.m2 <= 1000 && c.precio_uf && c.precio_uf > 0);
}
