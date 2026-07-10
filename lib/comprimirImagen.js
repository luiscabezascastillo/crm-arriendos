// VERSION: v1 · 2026-07-10 · Compresión de imagen en el cliente (cámara móvil -> <=1MB)
// Sin dependencias externas. Corrige orientación EXIF y reduce tamaño ANTES de subir,
// para no castigar el 4G ni el almacenamiento. Reutilizable en todo el CRM.

export async function comprimirImagen(file, {
  maxLado = 1600,          // px del lado mayor
  calidad = 0.7,           // calidad JPEG inicial
  maxBytes = 1024 * 1024,  // objetivo <= 1 MB
} = {}) {
  if (!file || !file.type?.startsWith('image/')) return file;

  // createImageBitmap aplica la orientación EXIF automáticamente (evita fotos rotadas).
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await createImageBitmap(file);
  }

  let { width, height } = bitmap;
  if (width > height && width > maxLado) {
    height = Math.round((height * maxLado) / width);
    width = maxLado;
  } else if (height >= width && height > maxLado) {
    width = Math.round((width * maxLado) / height);
    height = maxLado;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let q = calidad;
  let blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
  while (blob && blob.size > maxBytes && q > 0.4) {
    q -= 0.1;
    blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
  }
  return blob || file;
}

export default comprimirImagen;
