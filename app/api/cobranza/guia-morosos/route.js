// VERSION: v1 · 2026-08-26 · Cobranza · Guía "Buenas prácticas para la reclamación a morosos" (HTML imprimible / PDF).
//   Se abre desde el boton "📕 Guía morosos" de la cabecera. Contenido estatico, para todo el equipo.
// Ruta real: app/api/cobranza/guia-morosos/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return new Response('No autenticado', { status: 401 })

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Guía reclamación morosos — Fondo Capital</title>
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
  li { margin: 5px 0; }
  .box { background: #fff; border: 1px solid #E4E2DA; border-radius: 10px; padding: 14px 18px; margin: 12px 0; }
  .tip { background: #E9F4E4; border: 1px solid #CBE6BE; border-radius: 8px; padding: 10px 14px; margin: 12px 0; font-size: 14px; }
  .warn { background: #FBEDEC; border: 1px solid #F0CFCB; border-radius: 8px; padding: 10px 14px; margin: 12px 0; font-size: 14px; color: #7a1c17; }
  .gold { background: #FFF7E0; border: 1px solid #F0DFA8; border-radius: 8px; padding: 10px 14px; margin: 12px 0; font-size: 14px; color: #6b4e05; }
  .legal { color: #9B1C1C; font-weight: 700; }
  .cob { color: #085041; font-weight: 700; }
  .toolbar { position: sticky; top: 0; background: #F4F6F9; padding: 10px 0; margin-bottom: 8px; }
  button.print { background: #1D9E75; color: #fff; border: none; border-radius: 8px; padding: 9px 16px; font-size: 14px; font-weight: 700; cursor: pointer; }
  .lead { font-size: 15px; }
  .cierre { font-size: 15px; font-weight: 600; color: #1a3d33; background: #fff; border: 1px solid #E4E2DA; border-left: 4px solid #1D9E75; border-radius: 8px; padding: 14px 18px; margin: 20px 0 6px; }
  @media print { .toolbar { display: none; } body { background: #fff; } .box, .tip, .warn, .gold, .cierre { break-inside: avoid; } h2 { break-after: avoid; } }
</style></head><body><div class="wrap">
<div class="toolbar"><button class="print" onclick="window.print()">Imprimir / Guardar como PDF</button></div>

<h1>Buenas prácticas para la reclamación a morosos</h1>
<div class="sub">Fondo Capital Rent · Guía interna para administración, finanzas y legal</div>

<p class="lead">El objetivo de cobrar no es recaudar multas —a los tipos actuales son simbólicas—, es lograr que se pague <b>a tiempo y de forma previsible</b>. Lo que educa la conducta de pago no es la dureza puntual, sino la <b>constancia</b>: que siempre haya una consecuencia, igual para todos y a tiempo.</p>

<h2>1. Principios (el marco)</h2>
<div class="box"><ul>
<li><b>Rápido.</b> La deuda envejece mal: cuanto antes se reclama, más se cobra. El día 6 ya hay gestión, no se espera a fin de mes.</li>
<li><b>Igual para todos.</b> La arbitrariedad (a uno se le perdona, a otro no) destruye el sistema. La consecuencia tiene que ser predecible.</li>
<li><b>Todo por escrito y con constancia.</b> «Sin constancia, no existe.» Cada llamada, correo o acuerdo se registra en el sistema. Lo verbal no cuenta.</li>
<li><b>Firme con la deuda, correcto con la persona.</b> Se reclama el dinero sin faltar al respeto. El tono agresivo no cobra más y sí pierde arrendatarios buenos.</li>
<li><b>Un solo criterio, un solo interlocutor.</b> La mayor filtración no suele ser el arrendatario listo: es la descoordinación interna (uno cobra, otro perdona). Eso hay que cerrarlo.</li>
</ul></div>

<h2>2. No todos los morosos son iguales</h2>
<p>Antes de reclamar, identifica con quién hablas. El trato cambia:</p>
<div class="box"><ul>
<li><b>El despistado / puntual.</b> Paga bien, se le pasó una fecha. Trato: recordatorio amable, sin dramatizar. Un buen pagador vale mucho; no lo quemes por un día de atraso.</li>
<li><b>El de flujo apretado.</b> Quiere pagar pero va justo. Trato: firmeza más una salida — fecha concreta de regularización y compromiso por escrito. Acuerdos sí, pero documentados y con seguimiento.</li>
<li><b>El moroso crónico / negociador.</b> Siempre tiene una excusa, «se le olvida», pide plazos, negocia a la baja con quien le deje, y va acumulando. Es el que más cuesta y al que más hay que blindar (apartado 4).</li>
<li><b>El insolvente / de mala fe.</b> No puede o no quiere pagar. Trato: escalar rápido (aval, DICOM, legal/término). No malgastes energía en «convencerlo».</li>
</ul></div>

<h2>3. La escalera de reclamación (plazos y a quién)</h2>
<p>La fuerza de la cobranza no está en cada carta, sino en que la escalera sea <b>creíble y automática</b>. Cada escalón, con su plazo:</p>
<div class="box"><ul>
<li><b>Vencimiento (día 5) → día 6:</b> recordatorio al arrendatario, tono suave.</li>
<li><b>~Día 10 en adelante:</b> 1.ª reclamación formal al arrendatario, con la multa/mora del contrato. Aviso al dueño si el riesgo es material.</li>
<li><b>2.ª reclamación:</b> arrendatario y aval juntos, con multa, intereses y total.</li>
<li><b>Siguiente:</b> aviso pre-DICOM; después DICOM, vía legal o término, según lo que valide Legal.</li>
</ul></div>
<div class="gold"><b>Sobre el aval — regla de oro:</b> el aval es tu <b>última palanca, no la primera</b>. NO se le mete por un atraso de días: quemas la relación con el arrendatario y con el propio aval, y te quedas sin recurso cuando de verdad lo necesites. El aval entra solo en la morosidad real y avanzada, y a partir de la 2.ª reclamación. La multa por atraso va <b>únicamente al arrendatario</b>.</div>

<h2>4. El moroso crónico: cómo cerrarle las puertas</h2>
<p>Es el perfil que más daño hace: el que «entre pitos y flautas» se olvida, luego negocia por su cuenta con quien le rebaje, y al cabo del año ha dejado de pagar cientos de miles sin que nadie lo notara de golpe. El problema no es el olvido: es que el sistema, sin querer, le premia. Se corta así:</p>
<div class="box"><ul>
<li><b>Un único interlocutor autorizado.</b> Si puede elegir con quién hablar, elige al que más le rebaja. Con estos casos habla y decide una sola persona; los demás derivan a ella. Nada de acuerdos por un lado y por otro.</li>
<li><b>Nada verbal.</b> Cualquier acuerdo (plazo, quita, lo que sea) se escribe, se acepta por correo y queda en la bitácora. «Lo hablé con fulano» no vale si no está registrado.</li>
<li><b>La multa y los intereses no se negocian a la baja sin autorización de Dirección/Legal.</b> Si descubre que insistiendo consigue que se los quiten, lo hará siempre. La consecuencia tiene que ser predecible.</li>
<li><b>Cuadre mensual obligatorio.</b> Cada mes: saldo cero o explicación. Así es como se llega a acumular sin que se note — dejando «arrastrar» un poco cada mes. Alarma automática cuando un contrato pasa de un umbral acumulado.</li>
<li><b>Compromisos con fecha y consecuencia.</b> «Pago la semana que viene» no es un acuerdo. «Pago el día 12; si no, el 13 entra el aval y se activa DICOM» sí lo es — y se cumple.</li>
<li><b>Escalar sin miedo cuando toca.</b> El negociador cuenta con que nunca llegaréis al aval, a DICOM o al término. En cuanto ve que sí llegáis, cambia. La credibilidad de la escalera es lo que hace que paguen.</li>
</ul></div>

<h2>5. Cómo comunicar (tono)</h2>
<div class="box"><ul>
<li><b>Sí:</b> claro y concreto, con cifras exactas (mes, renta, deuda, fecha límite), respetuoso y firme en la consecuencia. Cada carta deja claro cuánto, por qué, para cuándo y qué pasa si no.</li>
<li><b>No:</b> amenazas vacías, ironías, ni el «última vez» repetido diez veces (mata la credibilidad). No prometas lo que no vas a cumplir.</li>
<li><b>Dos tonos según el caso:</b> al que ya pagó pero tarde, aviso amable que reconoce el pago y recuerda el criterio; al que sigue debiendo, requerimiento firme.</li>
</ul></div>

<h2>6. Registro para el dueño</h2>
<p>Todo lo anterior solo sirve si queda constancia. Cada gestión (recordatorio, reclamación, multa, acuerdo) se registra en la <b>bitácora de cobranza</b>, con fecha, arrendatario, propiedad, importe y quién lo hizo. Con eso, cuando un dueño pregunte qué se está haciendo con su arrendatario, se le enseña el <b>expediente</b> — un histórico ordenado y demostrable. Protege al propietario, protege a FCR y presiona de forma sana.</p>

<div class="cierre">En una frase: rápido, igual para todos, por escrito, un solo interlocutor, con una consecuencia real y creíble, y todo en el histórico. <b>Lo que cobra no es la multa; es la disciplina.</b></div>

<div class="sub" style="margin-top:30px">Fondo Capital Rent · Guía reclamación morosos · v1</div>
</div></body></html>`

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
