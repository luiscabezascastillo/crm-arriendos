# B4.- INCIDENCIAS — documento de arranque

> Pega este documento al inicio del chat nuevo **"B4.- INCIDENCIAS"**.
> Objetivo del chat: diseñar y construir el módulo de **Incidencias** (Mantención):
> reporte, clasificación, resolución y cierre de desperfectos, y su enlace con Presupuestos.
>
> Regla rectora: el **código (git)** y los **datos (Supabase)** son la fuente de verdad.
> Lo marcado "⚠ confirmar" hay que verlo en el repo/Supabase o con Luis antes de construir.

---

## 0. Aviso importante de alcance (leer primero)

**En el código HOY el módulo Incidencias no está construido.** Existe solo la *tarjeta* del
proceso en el Motor (`lib/procesos.js`): `incidencia` (Mantención), pero con **`href: null`** y
**sin tabla `incidencias`** ni página. O sea: es prácticamente **greenfield**.

Además, hay que **no confundir dos cosas** que suenan parecido:
- **Incidencias** = módulo de **Mantención** (desperfectos de las propiedades). Es lo de este chat.
- **Requerimientos** (`/requerimientos`) = módulo de **Ventas**: pipeline de *leads* de clientes
  que buscan arriendo/compra (etapas Nuevo → Contactado → Visita → Oferta → Cerrado → Descartado).
  **NO es mantención.** No tocarlo aquí.

Antes de construir, hay que cerrar el alcance con Luis (ver sección 5).

---

## 1. Contexto mínimo (transversal)

- **Empresa:** Fondo Capital Rent SpA (FCR), inmobiliaria de arriendos. Chile. ~209 contratos.
- **Stack:** Next.js 16 (App Router) + Supabase (Postgres) + NextAuth (Google @fondocapital.com)
  + Vercel. JavaScript, **inline styles** en el CRM.
- **Producción:** https://crm-arriendos.vercel.app · **Repo:** github.com/luiscabezascastillo/crm-arriendos
- **Local:** raíz del repo `crm-arriendos` (PC alterna cabez/altom → usar rutas relativas, nunca
  con nombre de usuario). El repo ya trae un `CLAUDE.md` con las reglas de edición (UTF-8 sin BOM,
  validar con `npm run build`, `git pull --no-rebase` antes de push, no exponer valores de `.env`).
- **Despliegue:** colocar archivo → `npm run build` → `git add/commit/push` → `vercel --prod` →
  Ctrl+Shift+R. **SQL** en el SQL Editor de Supabase.
- **Método de trabajo:** Claude genera los archivos; Luis los coloca, corre el SQL y despliega.
  (Por eso este chat va bien como **chat normal**, no Cowork.) Preguntar en TEXTO, nunca pop-ups.
- **Versionado de archivos entregados:** primera línea `// VERSION: vN · fecha · resumen`.

### Roles y permisos del módulo
- **Departamento:** Mantención → en `crm_users.rol` es **`tecnico`**. Encargado histórico:
  **Cristhian** (cristhian.ul@fondocapital.com). ⚠ confirmar si sigue.
- **Permiso por proceso:** en `proceso_permisos`, key **`incidencia`** (responsable/colaborador/
  supervisor/observador). Participan además Administración y Finanzas (así está en el proceso).
- Recordatorio: `crm_users.rol` decide qué **módulos** ve la persona; `proceso_permisos` decide
  qué **hace** dentro del proceso. Son dos sistemas independientes.

---

## 2. Qué es el módulo (visión de negocio)

Gestionar los **desperfectos / arreglos** de las propiedades administradas: alguien reporta una
incidencia (fuga, cerradura, electrodoméstico, etc.), se **clasifica**, se **valida**, se
**resuelve** (posiblemente con un presupuesto de reparación y una orden de trabajo a un técnico o
proveedor) y se **cierra**, dejando historial por inmueble/IDADMON.

**Etapas ya previstas** para el proceso `incidencia` (en `lib/procesos.js`):
**Reporte → Clasificar → Validar → Resolver → Cierre**. Frecuencia: Puntual.

---

## 3. Estado real en el código (qué hay y qué falta)

### ⛔ No existe todavía
- No hay **tabla `incidencias`** en Supabase (⚠ confirmar contra `information_schema`).
- No hay **página** ni carpeta `app/.../incidencias`. La tarjeta del proceso tiene `href: null`.

### ✅ Piezas adyacentes REUTILIZABLES (esto es lo valioso para arrancar)

**a) Presupuestos** — `/procesos/presupuestos` (`app/procesos/presupuestos/page.js`, 533 líneas).
   Es el vecino natural de Incidencias ("Crear y editar presupuestos de reparación"; etapas
   Buscar → Crear → Líneas → Revisar → PDF; `conecta: 'Término · Incidencia · Inicios'`).
   - Tablas: **`presupuestos`** y **`presupuesto_detalle`** (líneas).
   - Cada línea: `descripcion`, `cantidad`, `coste_unit`, `base_imponible`, `iva` (19%), `total`.
   - Cabecera: `numero`, `fecha`, `id_admon_new`, `id_admon_old`, `ubicacion`, `propietario`,
     `descripcion`, `motivo` (p. ej. 'termino').
   - Cruza con `datos_arriendos` por IDADMON; si el estado es N / N-DICOM (histórico) el
     presupuesto **no es editable**.
   → Una incidencia probablemente **genera un presupuesto** de reparación. Reutilizar esta tabla/UI.

**b) Infraestructura de órdenes + PDF** — patrón reutilizable para "orden de trabajo":
   - `lib/pdfOrden.js` (genera PDF), `lib/ordenCondiciones.js` (texto/condiciones), endpoints
     `/api/ordenes/generar`, `/api/ordenes/firmar`, `/api/ordenes/email`.
   - Hoy sirven a la **Orden de Visita del corredor** (Ventas), pero el patrón
     generar → firmar → enviar por email un PDF es **calcable** para una orden de trabajo de
     mantención a un técnico/proveedor. (Nota: ya existe `lib/pdfOrdenTrabajo.js` en el repo.)

**c) Motor de procesos** — `app/procesos/page.js` + `lib/procesos.js`: al construir la página,
   cambiar en la tarjeta `incidencia` el `href: null` → `href: '/procesos/incidencias'`.

### Tablas Supabase relevantes (existentes)
`presupuestos`, `presupuesto_detalle`, `datos_arriendos` (contratos/IDADMON, inmueble,
propietario), `edificios`, `contactos` (personas). ⚠ La de `incidencias` habría que **crearla**.

---

## 4. Modelo de datos propuesto (tentativo, a validar)

> Punto de partida para discutir, NO definitivo. Se cierra con Luis + Supabase real.

**Tabla `incidencias`** (propuesta):
`id`, `idadmon` (o `idinmue`/`edificio`), `inmueble`, `reportado_por`, `canal`
(portal/email/WhatsApp/teléfono), `categoria` (fontanería, electricidad, cerrajería, electrodom.,
otros), `prioridad` (alta/media/baja), `descripcion`, `estado`
(reporte/clasificada/validada/en_resolucion/cerrada/descartada), `asignado_a` (técnico),
`fecha_reporte`, `fecha_cierre`, `presupuesto_id` (FK a `presupuestos`, si aplica),
`comentarios`/historial.

Enlaces: incidencia → (opcional) presupuesto de reparación → (opcional) orden de trabajo (PDF).

---

## 5. Preguntas de negocio a cerrar ANTES de construir

1. **¿Quién reporta y por qué canal?** (arrendatario, propietario, administración; portal de
   arrendatarios —hoy no existe—, email, WhatsApp, teléfono).
2. **¿La incidencia va ligada al contrato (IDADMON) o al inmueble/edificio?** (afecta la clave).
3. **¿Flujo con Presupuestos?** ¿Toda incidencia genera presupuesto de reparación, o solo algunas?
   ¿La aprobación del presupuesto la da el propietario, Administración o Dirección?
4. **¿Órdenes de trabajo a técnicos/proveedores?** ¿Con PDF y envío por email (como las órdenes
   de visita)? ¿Hay catálogo de proveedores?
5. **¿Estados definitivos?** ¿Sirven los previstos (Reporte→Clasificar→Validar→Resolver→Cierre)?
6. **¿Quién trabaja el módulo?** ¿Cristhian (Mantención) como responsable? ¿Quién valida/aprueba
   gasto? (participan Administración y Finanzas).
7. **¿Notificaciones por email** en algún paso (al asignar, al cerrar)?
8. **¿Costos → contabilidad?** ¿El gasto de la reparación entra en la liquidación al propietario
   (como descuento) o se factura aparte? (enlaza con Liquidaciones/CUENTAS).

---

## 6. Primera acción sugerida al abrir el chat

1. **Cerrar alcance** (sección 5) con Luis en texto.
2. **Anclar a Supabase:** correr el `information_schema` de `presupuestos`, `presupuesto_detalle`,
   `datos_arriendos` y confirmar que NO existe `incidencias`.
3. **Diseñar la tabla `incidencias`** + SQL, y luego la página `/procesos/incidencias` siguiendo el
   patrón visual del CRM (TopNav, tablas como CC1, estilo de Presupuestos).
4. Reutilizar Presupuestos para la parte de reparación y el patrón de órdenes/PDF para la orden de
   trabajo, en vez de construir de cero.

---

## 7. Documentos y archivos de referencia
- Código: `app/procesos/presupuestos/page.js`, `lib/procesos.js` (tarjeta `incidencia`),
  `lib/pdfOrden.js`, `lib/pdfOrdenTrabajo.js`, `lib/ordenCondiciones.js`, `app/api/ordenes/*`.
- Reglas: `CLAUDE.md` del repo (edición/despliegue) y las convenciones transversales del proyecto.
- Permisos: doc "los dos sistemas de permisos" (`crm_users.rol` vs `proceso_permisos`).
