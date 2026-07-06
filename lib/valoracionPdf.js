// lib/valoracionPdf.js
// Genera el PDF del informe de valoración con jsPDF (lado cliente).
// Requiere: npm install jspdf jspdf-autotable
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const f0 = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL', { maximumFractionDigits: 0 }));
const f2 = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL', { maximumFractionDigits: 2 }));

export function generarPdfValoracion({ folio, sujeto = {}, parametros = {}, resultado = {}, logoDataUrl = null, fotoDataUrl = null, mapaDataUrl = null }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 15;
  let y = 12;

  // ---- Encabezado ----
  if (logoDataUrl) { try { doc.addImage(logoDataUrl, 'PNG', M, 9, 34, 16); } catch (e) {} }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('Informe de Valoración Referencial', W - M, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  doc.text(`Folio N° ${folio}`, W - M, 21, { align: 'right' });
  doc.text(new Date().toLocaleDateString('es-CL'), W - M, 26, { align: 'right' });
  doc.setTextColor(0);
  y = 30; doc.setDrawColor(210); doc.line(M, y, W - M, y); y += 7;

  // ---- Identificación ----
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Identificación de la propiedad', M, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  const est = resultado.estimacion || {};
  const idLines = [
    ['Dirección', sujeto.direccion || '—', 'Comuna', sujeto.comuna || '—'],
    ['Tipo', sujeto.tipo || '—', 'Rol SII', sujeto.rol || '—'],
    ['m² útil', f0(sujeto.m2_util), 'm² terraza', f0(sujeto.terraza)],
    ['Sup. ponderada', `${f0(est.sup_ponderada_sujeto)} m²`, 'Dormitorios', sujeto.dormitorios || '—'],
    ['Estacionamientos', sujeto.estac || '0', 'Bodegas', sujeto.bodega || '0'],
    ['Avalúo fiscal (UF)', sujeto.avaluo_fiscal_uf ? f0(sujeto.avaluo_fiscal_uf) : '—', '', ''],
  ];
  idLines.forEach((r) => {
    doc.setTextColor(110); doc.text(r[0] + ':', M, y);
    doc.setTextColor(0); doc.text(String(r[1]), M + 34, y);
    if (r[2]) { doc.setTextColor(110); doc.text(r[2] + ':', 110, y); doc.setTextColor(0); doc.text(String(r[3]), 145, y); }
    y += 5.5;
  });
  y += 3;

  // ---- Foto (izq) + Mapa (der) lado a lado ----
  if (fotoDataUrl || mapaDataUrl) {
    const boxW = (W - 2 * M - 6) / 2;
    const boxH = 42;
    if (fotoDataUrl) {
      try { doc.addImage(fotoDataUrl, 'JPEG', M, y, boxW, boxH); }
      catch (e) { try { doc.addImage(fotoDataUrl, 'PNG', M, y, boxW, boxH); } catch (e2) {} }
    } else {
      doc.setDrawColor(220); doc.setFillColor(248, 250, 252); doc.roundedRect(M, y, boxW, boxH, 1, 1, 'FD');
      doc.setFontSize(8); doc.setTextColor(150); doc.text('Sin foto', M + boxW / 2, y + boxH / 2, { align: 'center' }); doc.setTextColor(0);
    }
    if (mapaDataUrl) {
      try { doc.addImage(mapaDataUrl, 'PNG', M + boxW + 6, y, boxW, boxH); } catch (e) {}
    } else {
      doc.setDrawColor(220); doc.setFillColor(248, 250, 252); doc.roundedRect(M + boxW + 6, y, boxW, boxH, 1, 1, 'FD');
      doc.setFontSize(8); doc.setTextColor(150); doc.text('Mapa no disponible', M + boxW + 6 + boxW / 2, y + boxH / 2, { align: 'center' }); doc.setTextColor(0);
    }
    y += boxH + 6;
  }

  // ---- Estimación ----
  doc.setFillColor(236, 253, 245); doc.setDrawColor(167, 243, 208);
  doc.roundedRect(M, y, W - 2 * M, 22, 2, 2, 'FD');
  doc.setTextColor(6, 95, 70); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('VALOR ESTIMADO', M + 4, y + 6);
  doc.setFontSize(20);
  doc.text(`${f0(est.valor_uf)} UF`, M + 4, y + 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const linea2 = `Rango ${f0(est.rango_uf?.[0])} - ${f0(est.rango_uf?.[1])} UF     ${f2(est.uf_m2_mediana)} UF/m2`
    + (est.valor_clp ? `     aprox. $${f0(est.valor_clp)}` : '')
    + (resultado.vs_avaluo ? `     ${f2(resultado.vs_avaluo.ratio)}x avaluo fiscal` : '');
  doc.text(linea2, M + 4, y + 20);
  doc.setTextColor(0); y += 28;

  // ---- Metodología ----
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Metodología', M, y); y += 5.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60);
  const pNeg = ((parametros.negociacion || 0) * 100).toFixed(0);
  const met = `Método comparativo de mercado sobre ${resultado.totales?.usados || 0} testigos del sector `
    + `(${resultado.totales?.descartados || 0} descartados por valores extremos). Cada testigo se homologa: `
    + `se ajusta por estacionamiento (${f0(parametros.uf_estac)} UF) y bodega (${f0(parametros.uf_bodega)} UF) respecto a la propiedad, `
    + `y se aplica un descuento de negociación del ${pNeg}% sobre el precio de oferta. La superficie se pondera sumando `
    + `la terraza al ${((parametros.factor_terraza || 0) * 100).toFixed(0)}%. El valor es la mediana de UF/m² homologado por la superficie ponderada de la propiedad.`;
  const metWrap = doc.splitTextToSize(met, W - 2 * M);
  doc.text(metWrap, M, y); y += metWrap.length * 4 + 4;
  doc.setTextColor(0);

  // ---- Tabla de testigos ----
  const comps = resultado.comparables || [];
  autoTable(doc, {
    startY: y,
    head: [['Testigo', 'Sup.pond.', 'Oferta UF', 'Ajuste', 'Homolog.', 'UF/m²']],
    body: comps.map((c) => [
      (c.titulo || c.link || 'manual').slice(0, 34),
      f0(c.sup_ponderada), f0(c.oferta_uf),
      c.ajuste_amenidades ? (c.ajuste_amenidades > 0 ? '+' : '') + f0(c.ajuste_amenidades) : '—',
      f0(c.valor_homologado), f2(c.uf_m2),
    ]),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
    margin: { left: M, right: M },
  });
  y = doc.lastAutoTable.finalY + 8;

  // ---- Disclaimer ----
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFillColor(254, 249, 231); doc.setDrawColor(253, 230, 138);
  doc.roundedRect(M, y, W - 2 * M, 24, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(120, 90, 10);
  doc.text('Aviso importante', M + 3, y + 5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  const disc = 'Esta es una estimación referencial generada por un modelo estadístico a partir de datos públicos de oferta '
    + 'del mercado, con fines exclusivamente internos e informativos. NO constituye una tasación comercial ni bancaria, '
    + 'no ha sido realizada por un tasador certificado y no compromete la responsabilidad de Fondo Capital Rent. '
    + 'Los valores de oferta no equivalen a precios de cierre. Para operaciones formales se requiere una tasación profesional.';
  const dWrap = doc.splitTextToSize(disc, W - 2 * M - 6);
  doc.text(dWrap, M + 3, y + 10);
  doc.setTextColor(0);

  // ---- Pie ----
  doc.setFontSize(7.5); doc.setTextColor(130);
  doc.text('Fondo Capital Rent · Informe generado automáticamente', W / 2, 289, { align: 'center' });

  doc.save(`valoracion-${folio}-${(sujeto.comuna || '').replace(/\s/g, '')}.pdf`);
}
