# B.- LIQUIDACIONES — documento de arranque

> Pega este documento al inicio del chat nuevo **"B.- LIQUIDACIONES"**.
> Objetivo del chat: trabajar en exclusiva el módulo de **Liquidaciones** — mejoras,
> adaptaciones y resolución de errores — cubriendo sus cinco vistas:
> **TRANSFER · FALTAN · CARTAS · EMAILS · FACTURAS**.
>
> Regla rectora del proyecto: **el código (Git) y los datos (Supabase) son la fuente de
> verdad.** Este documento aporta el *porqué* y el estado conocido; cuando algo aquí y el
> código se contradigan, **gana el código**. Lo marcado como "⚠ confirmar" hay que verlo
> en el repo/Supabase antes de tocar nada.

---

## 0. Contexto mínimo (transversal)

- **Empresa:** Fondo Capital Rent SpA (FCR), inmobiliaria de arriendos. Chile. ~209–213
  contratos activos (estado S). Lo desarrolla Luis (ingeniero) para la inmobiliaria.
- **Stack:** Next.js (App Router) + Supabase (Postgres) + Vercel. JavaScript, **inline
  styles** en el CRM (no Tailwind).
- **Producción:** https://crm-arriendos.vercel.app
- **Repo:** github.com/luiscabezascastillo/crm-arriendos (privado) · Local:
  `C:\Users\cabez\crm-arriendos` (Luis alterna entre cuentas cabez/altom).
- **Despliegue (PowerShell desde la raíz):** colocar archivo → `npm run build` →
  `git add . ; git commit -m "..." ; git push` → `vercel --prod` (esperar "Ready") →
  Ctrl+Shift+R. Si git push es rechazado: `git pull --no-rebase --no-edit origin main ; git push`.
- **SQL** en el SQL Editor de Supabase. **Fetch de prueba** en la consola de Chrome (F12).
- **Versionado de archivos entregados:** primera línea
  `// VERSION: vN · fecha · resumen`. Verificar tras copiar con
  `Select-String archivo -Pattern "VERSION: vN"`.
- **No tocar producción sin ver los datos primero. Preguntar en TEXTO, nunca con pop-ups.**

### Permisos del módulo (importante)
- **Ver** las liquidaciones (TRANSFER, FALTAN, CARTAS, EMAILS) → cualquier cuenta
  `@fondocapital.com`.
- **Acciones sensibles** (enviar cartas por email, y todo lo de facturación) → **solo
  alberto.cabezas, luis.cabezas y karina.morales**.
- Nota: la lógica fina de permisos vive en el código (p. ej. `lib/cc1Permisos.js` para CC1;
  ⚠ confirmar dónde está la comprobación equivalente en Liquidaciones/EMAILS/FACTURAS).

---

## 1. Qué es el módulo Liquidaciones (visión de negocio)

Cada mes FCR administra los arriendos de terceros: cobra la renta al arrendatario, se queda
su **comisión + IVA** (y aplica descuentos si corresponde) y **transfiere el resto al
propietario**, acompañado de una **carta** con el detalle. Después debe **facturar** su
comisión al propietario (**FACTURAS**, vía Nubox).

El flujo mensual completo, en orden:

1. **BI** — subir la cartola del Banco Internacional (para saber qué se recibió).
2. **TRANSFER** — recalcular y revisar cuánto transferir a cada propietario.
3. **FALTAN** — revisar lo que falta (por cobrar / por transferir). ⚠ confirmar alcance.
4. **CARTAS** — revisar el detalle que recibirá cada propietario.
5. **EMAILS** — enviar las cartas por correo (solo Alberto, Luis, Karina).
6. **FACTURAS** — emitir la factura de la comisión de FCR al propietario (Nubox). 🔧 en desarrollo.

Se entra por el menú **Procesos → Liquidaciones**. Arriba hay botones para saltar entre
**TRANSFER · FALTAN · CARTAS · EMAILS · FACTURAS**.

---

## 2. Estado por vista (lo que se sabe hoy)

### 2.1 BI — Banco Internacional (entrada de datos)
- Carga la **cartola** del Banco Internacional en `.xls/.xlsx`. El sistema muestra un
  resumen (Recibidos / Nuevos / Duplicados) e **ignora duplicados** solo. Se guardan los
  movimientos nuevos y queda registro en "Últimas cargas al BI" (fecha, cuántos, archivo, quién).
- Proceso en el motor: **`/procesos/bi`** (key `bi_sa`), ya en producción ✅.
- "No hay movimientos nuevos" = esa cartola ya estaba cargada (normal).

### 2.2 TRANSFER (vista de revisión principal) ✅
- Se abre en TRANSFER al entrar a Liquidaciones. Botón **«Recalcular (bi · descuentos ·
  comentarios)»** trae los últimos datos del banco y descuentos. Recalcular **no envía ni
  borra nada**; solo relee.
- Tarjetas superiores: **A transferir · Transferido · Falta transferir · Comisión + IVA ·
  Por cobrar (falta) · Propietarios**.
- Tabla: una fila por **propietario**; al pinchar se despliega el detalle por inmueble.
- Columnas: **A cobrar** (renta total del propietario), **Recibido** (lo entrado en banco),
  **Comisión / IVA / Descuentos** (lo que descuenta FCR), **A transferir** (lo que se le
  paga al propietario), **Transferido** (ya pagado; azul, "—" si nada), **Estado**
  (✓ verde cuadra / ⚠ rojo revisar, p. ej. falta dinero por cobrar).

### 2.3 FALTAN
- Es una de las cuatro vistas del cabecero. ⚠ **A confirmar contra el código:** presumiblemente
  la vista de **pendientes** (propietarios/contratos con dinero **por cobrar** o **por
  transferir**, es decir los que no cuadran). Verificar qué muestra exactamente, qué criterio
  usa para listar un "faltante" y de qué tablas/campos sale, antes de proponer mejoras.

### 2.4 CARTAS (revisión previa al envío) ✅
- Botón **«📄 CARTAS»**. Muestra un bloque por propietario con su tabla de inmuebles y los
  totales, y al pie: **A transferir · Transferido al propietario · Diferencia**.
- La **Diferencia** en verde/0 = ya se transfirió; en rojo = falta pagar.
- En CARTAS solo se **revisa**; el envío es en EMAILS.

### 2.5 EMAILS (envío) ✅ — acción sensible
- Botón **«✉ EMAILS»**. Solo Alberto/Luis/Karina ven los botones de envío; el resto puede
  ver la pantalla y "Ver borrador" pero no enviar.
- **«📄 Ver borrador»** genera el PDF con marca "BORRADOR - NO ENVIAR" (no envía).
- Se marca por propietario (o "Seleccionar todas las enviables") y **«✉ Enviar
  seleccionadas (N)»** con confirmación. Solo enviables en estado **OK / OK DESC**.
- Al enviar: correo al propietario **con PDF adjunto** (copia a administración@), el PDF se
  **archiva en Google Drive** en `3.AÑOS › 2026 › 2607 › 4-CartasAutomaticas` (el mes en
  formato AAMM), y queda constancia de quién envió y cuándo. Reenvío: avisa, pide
  confirmación y guarda el archivo con "-2", "-3"…
- Casilla **«1 pág.»**: comprime la carta a una hoja; reversible.
- ⚠ Motor/Nodemailer: el envío usa `info@fondocapital.com` (Gmail App Password). Confirmar
  ruta del endpoint de envío y de generación de PDF en el repo.

### 2.6 FACTURAS 🔧 EN DESARROLLO — la parte menos definida
- **Objetivo:** emitir la **factura de la comisión de FCR** (Comisión + IVA que ya calcula
  TRANSFER) al **propietario**, e integrarlo con **Nubox** (sistema contable/facturación).
- **Lo que se sabe hoy (poco):**
  - En el backlog figura como **`/op/facturas` + Nubox**.
  - En el motor de procesos existe la tarjeta **nubox** ("Financiero", Finanzas) →
    **`/procesos/financiero`** (⚠ confirmar si es la misma vista de FACTURAS o distinta).
  - El dato de origen natural es la **Comisión + IVA por propietario/inmueble** que ya
    produce TRANSFER; falta definir cómo se agrupa (por propietario, por inmueble, mensual),
    numeración/folios, y el puente con Nubox (API, export, o carga manual).
- **A definir en este chat (preguntas abiertas):** ¿boleta o factura?, ¿un documento por
  propietario o por inmueble?, ¿emisión desde el CRM contra API de Nubox o exportación para
  cargar en Nubox?, ¿qué datos tributarios del propietario se necesitan y de qué tabla salen
  (RUT, razón social, giro, dirección)?, ¿dónde se archiva el PDF/XML emitido?

---

## 3. Modelo de datos relevante (lo conocido — ⚠ anclar a Supabase)

> Antes de trabajar en serio, correr el `information_schema` de las tablas del módulo para
> tener el esquema real. Aquí va lo que se deduce de la documentación previa:

- **`datos_arriendos`** — contratos (idadmon único). Campos de renta/ajuste: `estado`,
  `propietario`, `idprop`, `inmueble`, `cuota`, `unid` ($/UF), `uf_peso_factor`,
  `fecha_reajusteN`/`cantidad_reajusteN` (6 pares), `revision`. Estados: P, S, SQ, Q, N,
  N-DICOM, Inactiva.
- **BI / movimientos bancarios** — tabla que guarda la cartola del Banco Internacional
  (recibidos por propietario/mes). ⚠ confirmar nombre y columnas.
- **Descuentos** — lo que FCR resta además de comisión. ⚠ confirmar tabla/origen.
- **Comentarios** — se traen al recalcular. ⚠ confirmar tabla/origen.
- **`propietarios`** — `idprop`, `propietario`, `nombre`, `mail1`, `rut`, `telefono`,
  `direccion`, `comuna` (clave para FACTURAS: datos tributarios).
- **`indices_mensuales`** — `valor_uf`, `ipc_3m/6m/12m`, `uf_3m/6m/12m` por mes (para la
  parte de ajustes/UF de la renta).
- ⚠ **Tabla de envíos / liquidaciones emitidas** (quién, cuándo, PDF en Drive): confirmar si
  existe y cómo se llama.
- ⚠ **Tabla de facturas** (para FACTURAS/Nubox): probablemente **por crear**.

---

## 4. Pendientes y errores conocidos (punto de partida del trabajo)

1. **FACTURAS**: definir el proceso completo (ver 2.6) y decidir integración con Nubox.
   Es el mayor bloque abierto.
2. **FALTAN**: confirmar qué hace exactamente y si necesita ajustes.
3. **Consistencia de cifras** TRANSFER ↔ CARTAS: la "Diferencia" y "Falta transferir" deben
   cuadrar entre vistas; verificar que usan el mismo cálculo.
4. **Casos proporcionales por días** (arrendatarios que entran/salen a mitad de mes): el
   Excel los cobraba a prorrata; el CRM no los deduce solo de `datos_arriendos`. Definir cómo
   se tratan en la liquidación (afecta A cobrar / A transferir).
5. **Seguridad (heredado, no urgente esta semana):** hay credenciales en texto plano en un
   doc de contexto viejo (Gmail App Password, PORTAL_INTERNAL_SECRET). Rotar y sacar de la
   documentación. No bloquea el trabajo de Liquidaciones.

---

## 5. Primera acción sugerida al abrir el chat

1. **Anclar a la realidad (Fase inventario del módulo):**
   - Correr en Supabase el `information_schema` de las tablas del módulo (BI, descuentos,
     comentarios, datos_arriendos, propietarios, y la de envíos/facturas si existen).
   - Revisar en el repo las rutas reales del módulo: la página de Liquidaciones
     (TRANSFER/FALTAN/CARTAS/EMAILS), `/procesos/bi`, `/procesos/financiero`, y los endpoints
     de recalcular, generar PDF, enviar email y (si hay) facturar.
2. Con eso, **elegir el primer frente**: cerrar/definir **FACTURAS**, o pulir una de las
   vistas existentes (TRANSFER/FALTAN/CARTAS/EMAILS).
3. Trabajar **una cosa a la vez**, viendo los datos antes de tocar producción.

---

## 6. Documentos de contexto a tener a mano
- **`Guia_Liquidaciones_FCR.docx`** — guía de usuario del módulo (TRANSFER/CARTAS/EMAILS/BI).
  Es la fuente principal de este arranque.
- **`contexto-notificaciones-ajustes.md`** — regla de negocio del cálculo de la renta/ajuste
  mensual (UF, IPC, reajustes), útil para la columna "A cobrar".
- Reglas transversales del proyecto (roles, despliegue, versionado) — instrucciones del proyecto.
