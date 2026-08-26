// VERSION: v2 · 2026-08-26 · Botón "← Volver" a Cobranza en la barra superior. Hereda v1.
// VERSION: v1 · 2026-08-24 · Cobranza · Manual de uso (HTML imprimible / guardable como PDF).
//   Se abre desde el boton "Manual" de la cabecera. Contenido estatico, para no informaticos.
// Ruta real: app/api/cobranza/manual/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return new Response('No autenticado', { status: 401 })

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Manual de Cobranza — Fondo Capital</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, Arial, sans-serif; color: #2C2C2A; line-height: 1.6; margin: 0; background: #F4F6F9; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 32px 26px 80px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .sub { color: #6b6b66; font-size: 14px; margin-bottom: 22px; }
  h2 { font-size: 19px; margin: 30px 0 8px; padding-top: 14px; border-top: 2px solid #E4E2DA; color: #1a3d33; }
  h3 { font-size: 15px; margin: 18px 0 4px; color: #085041; }
  p, li { font-size: 14.5px; }
  ul, ol { margin: 6px 0 6px 4px; padding-left: 20px; }
  li { margin: 3px 0; }
  .box { background: #fff; border: 1px solid #E4E2DA; border-radius: 10px; padding: 14px 18px; margin: 12px 0; }
  .tip { background: #E9F4E4; border: 1px solid #CBE6BE; border-radius: 8px; padding: 10px 14px; margin: 12px 0; font-size: 14px; }
  .warn { background: #FBEDEC; border: 1px solid #F0CFCB; border-radius: 8px; padding: 10px 14px; margin: 12px 0; font-size: 14px; color: #7a1c17; }
  .k { background: #EEF4FF; border: 1px solid #CFE0FF; border-radius: 5px; padding: 1px 7px; font-size: 12.5px; font-weight: 600; color: #1D4ED8; white-space: nowrap; }
  .legal { color: #9B1C1C; font-weight: 700; }
  .cob { color: #085041; font-weight: 700; }
  .toolbar { position: sticky; top: 0; background: #F4F6F9; padding: 10px 0; margin-bottom: 8px; display: flex; gap: 10px; align-items: center; }
  button.volver { background: #fff; color: #085041; border: 1px solid #CBE6BE; border-radius: 8px; padding: 9px 14px; font-size: 14px; font-weight: 700; cursor: pointer; }
  button.print { background: #1D9E75; color: #fff; border: none; border-radius: 8px; padding: 9px 16px; font-size: 14px; font-weight: 700; cursor: pointer; }
  @media print { .toolbar { display: none; } body { background: #fff; } .box, .tip, .warn { break-inside: avoid; } h2 { break-after: avoid; } }
</style></head><body><div class="wrap">
<div class="toolbar"><button class="volver" onclick="window.close();setTimeout(function(){location.href='/op/cobranza'},150)">← Volver</button><button class="print" onclick="window.print()">Imprimir / Guardar como PDF</button></div>

<h1>Manual de uso — Cobranza</h1>
<div class="sub">Fondo Capital · Impago &rarr; gestión con constancia &rarr; pago o acción legal</div>

<div class="tip"><b>La regla de oro:</b> <i>sin constancia, no existe.</i> Todo lo que registres aquí queda guardado de forma <b>inmutable</b> (no se puede editar ni borrar). Es lo que nos protege ante el arrendatario, el aval, el propietario y, si hace falta, un juez.</div>

<h2>1. Qué hace este módulo</h2>
<p>Cobranza reúne, para cada contrato con deuda, <b>todo lo que hacemos para cobrar</b>: llamadas, WhatsApp, correos, cartas… y te empuja a hacer cada paso a tiempo. Así nunca se nos escapa una gestión ni se nos olvida avisar al aval o al propietario.</p>

<h2>2. Las pestañas</h2>
<div class="box"><ul>
<li><b>Cartolas</b> — los morosos con contrato vigente o en término, su deuda y la <b>próxima acción</b> que toca hoy. Es la pantalla de trabajo del día a día.</li>
<li><b>Casos</b> — los expedientes abiertos, con el <b>semáforo del propietario</b> y el botón para generar el Expediente en PDF.</li>
<li><b>Servicios</b> — deudas de gastos comunes, luz, agua y gas.</li>
<li><b>Inicios</b> — contratos recién iniciados.</li>
<li><b>Bitácora</b> — el registro global de todas las gestiones hechas.</li>
</ul></div>

<h2>3. La escalera: qué toca hoy</h2>
<p>Arriba, la barra <b>"Acciones pendientes hoy"</b> cuenta cuántos morosos están en cada paso, según los días desde el último pago:</p>
<div class="box"><ul>
<li><span class="k">≥1 día</span> 1er aviso, solo al arrendatario.</li>
<li><span class="k">≥5 días</span> 2ª reclamación al arrendatario <b>y</b> al aval, y avisar al propietario.</li>
<li><span class="k">≥15 días</span> aviso previo a DICOM.</li>
</ul></div>
<p>Siempre reclamamos al <b>arrendatario Y al aval</b>: la responsabilidad del aval se pierde si no se le reclama a tiempo y en forma.</p>
<div class="warn">Los plazos son un <b>borrador</b> pensado por el sistema; Legal (Anthony) los validará. No son una obligación legal cerrada.</div>

<h2>4. Abrir la Cartola de un contrato</h2>
<p>En la tabla, el <b>IDADMON</b> (primera columna, p. ej. A00862) es un <b>enlace</b>: al pincharlo se abre la <b>Cartola</b> de ese contrato (su detalle de cargos y abonos) en una <b>pestaña nueva</b>. Para volver a Cobranza, cierra esa pestaña: no pierdes los filtros ni la posición en la lista.</p>

<h2>5. El botón "Gestionar" (el corazón)</h2>
<p>En cada fila, <b>Gestionar</b> abre un panel lateral con todo lo del contrato: contactos, avisos que exige el sistema, y las dos formas de dejar constancia.</p>

<h3>5.1 Registro rápido (sin email)</h3>
<p>Para dejar constancia de una <b>llamada</b>, un <b>WhatsApp</b> o una visita <b>presencial</b> en 2 clics: elige a quién (arrendatario / aval / propietario), escribe una nota corta (ej: <i>"llamé, no contesta"</i> o <i>"acuerda pagar el viernes"</i>) y pulsa el botón del canal. Queda en el historial al instante.</p>

<h3>5.2 Enviar una comunicación por email — paso a paso</h3>
<ol>
<li><b>Departamento</b>: elige <span class="cob">Cobranzas</span> o <span class="legal">Área Legal</span>. Cambia el tono del texto y el remitente (sale desde cobranza@ o legal@).</li>
<li><b>Plantilla</b>: elige el texto por defecto según a quién te diriges (arrendatario o aval). Puedes editarlo libremente; lo que quede escrito es lo que se envía y se guarda como constancia.</li>
<li><b>Para</b>: marca con un check a quién va (Arrendatario, Aval, Propietario). Su email sale precargado y es editable.</li>
<li><b>CC / CCO</b>: copias visibles y ocultas, si necesitas.</li>
<li><b>CCO al propietario</b>: casilla especial. Mete al dueño en copia oculta y <b>añade un párrafo</b> que demuestra que estamos gestionando. Útil cuando queremos que el propietario vea, sin que el arrendatario lo sepa, que FCR está actuando.</li>
<li><b>Adjuntos</b>: puedes subir archivos (van <b>incrustados en el correo</b>, así el que lo recibe los abre siempre).</li>
<li><b>Probar</b>: envía el correo con <span class="k">[PRUEBA]</span> <b>solo a ti</b>, sin dejar rastro. Úsalo para ver cómo queda antes de mandarlo de verdad.</li>
<li><b>Revisar y enviar</b>: muestra un resumen (desde, para, CC/CCO, asunto, adjuntos y el texto). <b>Nada sale</b> hasta que pulsas <b>"Aceptar y enviar"</b>. Si algo no te gusta, "Cancelar / volver" y lo corriges.</li>
</ol>
<div class="tip">La casilla <b>Multa/interés</b> es informativa: calcula la multa por los días de atraso y la mete en el texto donde pongas {{multa}} y {{total}}. Aplicar el cargo real a la cuenta se sigue haciendo en Morosidad.</div>

<h3>5.3 Historial</h3>
<p>Debajo, todas las gestiones del contrato, con fecha, canal, departamento (COBR./LEGAL), a quién fue, adjuntos y el acuse del correo. Es inmutable.</p>

<h3>5.4 Expediente (PDF)</h3>
<p>El botón <b>Expediente</b> (arriba del panel) genera un PDF con toda la secuencia de gestiones del contrato. Es la salida legal: para el aval, el abogado o para respaldar al propietario.</p>

<h2>6. Cobranzas vs Legal: cuándo usar cada uno</h2>
<div class="box"><ul>
<li><span class="cob">Cobranzas</span> — el trato normal, firme pero correcto. Primeros avisos y reclamaciones.</li>
<li><span class="legal">Área Legal</span> — cuando el tono ya debe ser jurídico e inequívoco: requerimiento formal, mención a la vía judicial, a la responsabilidad solidaria del aval y a DICOM. Se nota que lo firma un abogado.</li>
</ul></div>
<div class="warn">Los <b>textos legales son borrador</b>: cumplen su función, pero conviene que Legal los valide antes de usarlos en serio. Se editan en la base de datos (tabla de plantillas), sin tocar el programa.</div>

<h2>7. El semáforo del propietario (pestaña Casos)</h2>
<div class="box"><ul>
<li><b>Verde</b> — silencio operativo: mora leve, FCR gestiona y no molesta al dueño.</li>
<li><b>Ámbar</b> — aviso proactivo: el riesgo crece (mora larga, DICOM, término con déficit).</li>
<li><b>Rojo</b> — decisión o cargo, con el expediente de respaldo.</li>
</ul></div>
<p>Regla de oro: <b>el propietario nunca debe sorprenderse de un mal resultado.</b> El semáforo se alimenta solo de lo que registras aquí.</p>

<h2>8. Buenas prácticas</h2>
<ul>
<li>Deja constancia de <b>todo</b>, aunque sea una llamada sin respuesta. Lo no registrado, para el sistema, no existió.</li>
<li>Antes de un envío real, usa <b>Probar</b>.</li>
<li>Reclama <b>siempre al aval</b> a la vez que al arrendatario.</li>
<li>Usa <b>CCO al propietario</b> cuando quieras que el dueño vea, discretamente, que estamos actuando.</li>
</ul>

<div class="sub" style="margin-top:30px">Fondo Capital · Manual de Cobranza · v1</div>
</div></body></html>`

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
