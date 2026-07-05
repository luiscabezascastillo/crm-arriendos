// lib/valoracionStats.js
// Utilidades estadísticas para el módulo de valoración. JS puro, sin dependencias.

export function percentil(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const frac = idx - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

export function mediana(arr) {
  const s = [...arr].filter((v) => v != null && isFinite(v)).sort((a, b) => a - b);
  return percentil(s, 0.5);
}

export function media(arr) {
  const s = arr.filter((v) => v != null && isFinite(v));
  if (!s.length) return null;
  return s.reduce((a, b) => a + b, 0) / s.length;
}

// Filtro de extremos por rango intercuartílico (IQR) sobre una métrica.
// getValor: función que extrae el número de cada item (p. ej. uf/m2).
// factor 1.5 = criterio estándar de "outlier". Con <4 datos no filtra.
// Devuelve { conservados, descartados, limites:{q1,q3,min,max} }.
export function filtrarOutliersIQR(items, getValor, factor = 1.5) {
  const valores = items
    .map(getValor)
    .filter((v) => v != null && isFinite(v))
    .sort((a, b) => a - b);

  if (valores.length < 4) {
    return { conservados: [...items], descartados: [], limites: null };
  }

  const q1 = percentil(valores, 0.25);
  const q3 = percentil(valores, 0.75);
  const iqr = q3 - q1;
  const min = q1 - factor * iqr;
  const max = q3 + factor * iqr;

  const conservados = [];
  const descartados = [];
  for (const it of items) {
    const v = getValor(it);
    if (v == null || !isFinite(v)) { descartados.push(it); continue; }
    if (v < min || v > max) descartados.push(it);
    else conservados.push(it);
  }
  return { conservados, descartados, limites: { q1, q3, min, max } };
}

// Resumen estadístico de un array de números.
export function resumenEstadistico(valores) {
  const arr = valores.filter((v) => v != null && isFinite(v)).sort((a, b) => a - b);
  if (!arr.length) return null;
  return {
    n: arr.length,
    min: arr[0],
    max: arr[arr.length - 1],
    media: media(arr),
    mediana: percentil(arr, 0.5),
    p25: percentil(arr, 0.25),
    p75: percentil(arr, 0.75),
  };
}
