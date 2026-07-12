# B2.- TÉRMINOS — documento de contexto (histórico + código)

> Pégalo en el chat **"B2.- TÉRMINOS"** como complemento, para que arranque con el histórico.
> El "qué" está anclado al **código real** (fiable); el "porqué" que falta se marca con "⚠" y se
> completa extrayéndolo de los chats 6, 8 y 11 (ver sección 7).

---

## 0. Contexto mínimo
CRM de arriendos de Fondo Capital Rent (FCR), Next.js + Supabase + Vercel. Prod:
https://crm-arriendos.vercel.app · Repo: github.com/luiscabezascastillo/crm-arriendos.
Departamento del módulo: **Finanzas** (proceso `termino`, `href: /procesos/terminos`).
Reglas de trabajo en `CLAUDE.md` del repo (rutas relativas, UTF-8, `npm run build`, deploy).

## 1. Qué es Términos
Es el **expediente de fin de contrato**: cuando un arriendo termina, se abre un flujo que va desde
el aviso hasta el cierre (liquidación de la garantía, cobros/pagos, notificaciones y, si procede,
DICOM). Se dispara al pasar un IDADMON a estado **Q** (según `PROCESO_MENSUAL_CUENTAS`, el paso a Q
además genera automáticamente el nuevo IDADMON en P y el contrato en Q **sale** de la liquidación
mensual). Los contratos en N / N-DICOM son histórico (no editables).

## 2. Arquitectura: motor de workflow genérico
Términos NO está hardcodeado; corre sobre un **motor de workflow reutilizable** en Supabase:
- `workflow_nodes` — definición de los nodos (pasos).
- `workflow_dependencies` — aristas (qué nodo depende de cuál). Filtra por `workflow_codigo = 'TERMINO'`.
- `workflow_instances` — una instancia por IDADMON en término.
- `workflow_tasks` — la tarea de cada nodo en cada instancia (con `estado`, `fecha_cierre`).
- `workflow_task_logs` — bitácora de cambios por instancia.
- `vw_workflow_tasks` — vista que consume la página (por `idadmon`, `orden_visual`).

**Estados de tarea:** PENDIENTE · ACTIVO · COMPLETADO · RETRASADO · BLOQUEADO.
La vista de detalle (`/procesos/terminos/[idadmon]`) dibuja un **grafo SVG** con **tarjeta flotante**
al pasar/fijar el ratón sobre un nodo (hover/pinned), y muestra la bitácora.

## 3. Los nodos del workflow TERMINO (23 cajas)
N01 Aviso · N02 Expediente · N03 Publicación · N04 Legal inicial · **N04b Comunic. ex-arrendatario** ·
N05 Ficha término · N06 Llaves / Q · N07 Inspección · N08 Presupuesto · **N08b Markup FCR** ·
N09 Aprobación · N10 Reparación · N11 Limpieza · N12 Servicios · N13 Garantía · N14 Deuda ·
N15 Liquidación · N16 Notif. propietario · N17 Notif. arrendatario · N18 Respuesta · N19 Pago / cobro ·
N20 Cierre · N21 Legal / DICOM.
(N04b y N08b son nodos añadidos después — chat 8. Las **descripciones largas de cada nodo viven en la
BD**, no en el código.)

## 4. La liquidación del término
En `/procesos/terminos` (lista + panel), cada término calcula su liquidación con **líneas**
(`termino_lineas`) agrupadas en **bloques**, con **conceptos fijos (plantilla)**:

- **Garantía:** Balance de pagos del arrendatario · Intereses de retraso · Multas (si procede) ·
  Pérdida de garantía · Otros Liquidación 1/2.
- **Servicios:** Gastos Comunes Atrasados · GGCC Pendientes · Luz · Agua · Acuerdos especiales
  deudas · Otros Servicios 1/2.
- **Reparaciones:** **Arreglos presupuesto** (AUTOMÁTICO, viene del módulo Presupuestos) ·
  Reparaciones extras · Limpieza general · Mantención de TERMO · Limpieza de alfombras ·
  Otros Reparaciones 1/2/3.

**Cálculo (código):** `totalCargos = Σgarantía + Σservicios + Σreparaciones + markup_fcr`;
`resultado = garantía_recibida − totalCargos`; `conSaldo = resultado ≥ 0`.

**Cuatro tipos de cierre (dos ejes):** `T-{CON|SIN} SALDO-{FCR|DUENO}` — según **si queda saldo** y
**quién cobra** (FCR o el dueño). Esto conecta con la "liquidación de dos carriles" del chat 3.

**Campos del expediente:** fecha_entrega, valoracion_legal, decision_actuacion, lectura_agua,
lectura_luz, markup_fcr, comentarios_arrendatario, comentarios_internos, notas_finanzas_1..4.

**Familias de concepto** (para clasificar tipos): servicios (SERVICIOS/IMPUESTOS/COSTES-CC2),
reparaciones (ARREGLOS/LIMPIEZAS), financiero (MULTAS/DEMANDAS/DEUDAS/DESCUENTO),
gestión (NOTARIOS/CORRETAJES/SEGUROS/SALVOCONDUCTO/TERMINO), garantía (GARANTIAS/DEVOLUCIONES).

## 5. Enlaces con otros módulos y tablas
- **Presupuestos** (`presupuestos`, `presupuesto_detalle`) → alimenta el concepto automático
  "Arreglos presupuesto".
- **Descuentos** (`descuentos`) → mapeo de descuentos a líneas del término (chat 11).
- **CUENTAS** (`cuentas`) → el balance del arrendatario sale de aquí (chat 11).
- **Servicios** (`ggcc_agua_luz`) → GGCC, Luz y Agua de las líneas de servicios.
- **Contrato** (`datos_arriendos`, estado Q; `historico_idadmon`) y **propietarios**.
- **Permisos** (`proceso_permisos`, key `termino`; depto Finanzas).

## 6. Archivos y tablas (ancla)
- Páginas: `app/procesos/terminos/page.js` (656 líneas: lista + panel/liquidación),
  `app/procesos/terminos/[idadmon]/page.js` (vista del workflow), `.../GrafoTermino.js` (grafo SVG),
  `.../CompletarButton.js` (completar tarea).
- Endpoints relacionados: `/api/cc1/cerrar-facturar`, `/api/liquidaciones/facturar`.
- Tablas: `workflow_*`, `vw_workflow_tasks`, `terminos`, `termino_lineas`, `cuentas`, `descuentos`,
  `presupuestos`/`presupuesto_detalle`, `ggcc_agua_luz`, `datos_arriendos`, `historico_idadmon`,
  `propietarios`, `proceso_permisos`.
- ⚠ Nota técnica: `[idadmon]/page.js` importa de `@/src/lib/supabase`, distinto del resto
  (`lib/supabaseClient` / `lib/supabaseAdmin`). Posible duplicación de cliente a revisar.

## 7. El "porqué" a completar desde los chats (extracción)
Estos chats tienen el razonamiento que NO está en el código. En cada uno pide:
*"Extrae SOLO el conocimiento permanente y el porqué de las decisiones de Términos (reglas, criterios,
casos límite, descartes). En markdown."*
- **Chat 11** 🔴 — workflow de 22 pasos, `termino_lineas` (conceptos fijos), mapeo de descuentos a
  líneas, servicios desde `ggcc_agua_luz`, balance desde cuentas.
- **Chat 6** 🔴 — "Análisis Proceso Términos" (el diseño del proceso) + "Guía Términos Karina".
- **Chat 8** 🟡 — grafo con tarjeta flotante, descripciones de los 23 nodos en BD, nodos N04b/N08b.

## 8. Preguntas / pendientes abiertas
- ¿Significado exacto de cada uno de los 4 tipos `T-CON/SIN SALDO-FCR/DUENO` y qué cambia en el cobro?
- ¿Reglas de las transiciones entre nodos (qué desbloquea a qué) — están en `workflow_dependencies`?
- ¿Quién completa cada nodo (roles) y qué dispara las notificaciones (N16/N17)?
- Verificar contra Supabase el esquema real de `workflow_*`, `terminos`, `termino_lineas`, `cuentas`.
- Consolidar el cliente Supabase (`@/src/lib/supabase` vs `lib/supabase*`).
