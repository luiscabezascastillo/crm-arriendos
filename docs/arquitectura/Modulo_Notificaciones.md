# Módulo: Notificaciones a arrendatarios

Recordatorio mensual de pago a arrendatarios. Ruta `/procesos/notificaciones`. Migra el envío que en el Excel hacía la "Carta Arrendatarios".

## Archivos
- `app/procesos/notificaciones/page.js` — visor/selector/envío.
- `lib/notifPlantilla.js` — plantilla HTML del correo + helpers (`fmt`, `splitEmails`, `LOGO_URL`).
- `app/api/procesos/notificaciones/enviar/route.js` — envío real (nodemailer/gmail, mismo transporte que `email-deudores`).
- `app/api/procesos/notificaciones/preview/route.js` — HTML del correo sin enviar (la vista previa usa la misma plantilla que el envío, para que sean idénticos).
- Tabla Supabase `notificaciones_arriendo`.

## Fuente de datos
Se alimenta de `datos_arriendos` con `.eq('estado','S')` (solo contratos activos). NO de la tabla de notificaciones.

## Modelo de control de envío (fiel al Excel)
- **`control_envio`** (= columna C "INHIBIR" del Excel): única columna de control.
  - Contiene **fecha** → ya enviado.
  - Contiene **texto** (p. ej. "OBSERVACIONES") → bloqueado, no se envía, se muestra el texto.
  - **Vacío** → pendiente.
  - **Solo se envía si `control_envio` está vacío Y hay email.**
- **`comentario`** (= columna W del Excel): nota informativa, NO bloquea.
- Tras envío real, se escribe en `control_envio` el sello de fecha/hora; la fila pasa a "enviado" y no se reenvía.

## Cálculo del importe a pagar (`apagar`)
- Contrato en **UF**: `round(cuota × uf_peso_factor)` (uf_peso_factor = valor UF del mes).
- Contrato en **pesos**: `round(cuota + Σ cantidad_reajuste1..6)`.
- **`apagar_enviado`**: override de importe. Si la fila lo tiene, ese valor manda sobre el calculado (pantalla y correo). Se marca visualmente con asterisco.

## Bloque de AJUSTE en el correo
- Solo para contratos en **pesos** (nunca UF) y solo si hay ajuste vigente del mes.
- Ajuste vigente = reajuste con monto > 0 cuya `fecha_reajusteN` es la más reciente ≤ primer día del mes procesado.
- La fecha mostrada en el texto del correo = **primer día del mes procesado** (no la fecha guardada del reajuste), decisión para minimizar errores.

## Envío
- Asunto: `RECORDATORIO AUTOMÁTICO DEL PAGO DEL ARRIENDO DEL MES DE {MES}`.
- **CC siempre** a `administracion@fondocapital.com` (también en modo prueba).
- Modo prueba (ON por defecto en el modal): redirige a un correo propio, no marca como enviado.
- `mail_arrendatario` puede traer varios correos separados por `;` (hacer split).

## Caso especial A00684 (herencia)
Propiedad heredada por 2 hijos. Por ahora se resuelve con override manual (`apagar_enviado`). La resolución correcta (división entre 2 propietarios) corresponde al futuro módulo de Liquidaciones. No reintroducir su triplicación en cargas Excel.

## CÃ¡lculo del importe a pagar (`apagar`)

Solo se procesan/notifican IDADMON en estado `S`. Todo cÃ¡lculo filtra `estado = 'S'`.

El importe ya estÃ¡ calculado y volcado en `datos_arriendos` por el VBA. El CRM lee y presenta, no recalcula. `indices_mensuales` es solo informativo para este caso (`Valor UF` del mes).

FÃ³rmula en dos ramas, sin comparar fechas:

- `revision === 'UF'` â†’ `apagar = round(cuota Ã— uf_peso_factor)`.
  - `uf_peso_factor` es el valor de la UF del mes escrito por el VBA.
  - No multiplicar ademÃ¡s por `valor_uf` de `indices_mensuales`.
- Resto (`IPC semestral`, `IPC anual`, `IPC trimestral`, `IPC 6 meses`, `Semestral con UF`, `FIJO`, `null`) â†’ `apagar = round(cuota + Î£ cantidad_reajuste1..6)`.
  - Los reajustes no aplicados valen `0`; por eso se suman los seis sin filtrar por fecha.
  - `IPC 6 meses` se trata como `IPC semestral`.

**JustificaciÃ³n:** regla de negocio definitiva validada en el Chat 17; rige el mÃ³dulo y evita reimplementar o duplicar cÃ¡lculos.

## PÃ¡gina y acceso â€” Parte A

Ruta: `app/procesos/notificaciones/page.js`.

La Parte A es un visor de solo lectura: no escribe en base de datos ni envÃ­a correos.

Comportamiento:

- Lee contratos en estado `S` desde `datos_arriendos`.
- Presenta los registros ordenados por `propietario` â†’ `inmueble`.
- La columna de email del arrendatario es `mail_arrendatario`, no `email_arrendatario`.
- `mail_arrendatario` puede contener varios correos separados por `;`.

Accesos:

- Desde el botÃ³n **Calcular ajustes** del listado CC1: `router.push('/procesos/notificaciones')`.
- Pendiente: enlazar tambiÃ©n la tarjeta **Notificaciones** del motor de procesos (`app/procesos/page.js`) cambiando `href: null` por `href: '/procesos/notificaciones'`.

**JustificaciÃ³n:** documenta ubicaciÃ³n real, punto de acceso y nombre exacto de columna.