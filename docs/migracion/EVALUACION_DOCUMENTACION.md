# Evaluación de la documentación del CRM FCR

> Fecha: 09-jul-2026. Qué pide Luis: mantener su documentación de proyecto (la que va a git y le
> sirve para controlar el sistema) totalmente actualizada, sin perder lo importante. Aquí va la
> evaluación de **lo hecho**, **lo que falta** y **lo que puedo hacer yo** (solo y con tu ayuda).

---

## 1. Dónde estamos (foto honesta)

- **El código es un ancla sólida y completa** (53 páginas, 105 endpoints, 25 `lib/`). El "qué" del
  sistema está todo ahí y es fiable.
- **`docs/` en git: estructura correcta pero casi vacía.** ~6 archivos con algo, ~11 en blanco
  (AI_WORKFLOW, PROJECT_CONTEXT, Permisos, Arquitectura_Funcional, Navegacion, ROADMAP,
  integraciones/*, templates/*).
- **Proyecto claude.ai:** 8 documentos, con duplicados y 2 datos desactualizados.
- **Chats:** 29 en total (0.1–0.4 + 1–25). Su "porqué" está **mayormente sin extraer** (el tablero
  `MIGRACION_CONOCIMIENTO` sigue en 0 incorporados).
- **En este chat ya montamos el andamiaje:** `INVENTARIO_conocimiento`, `PLAN_EXTRACCION_CHATS`
  (29 chats clasificados + mapa chat→módulo), arranques `B-Liquidaciones` y `B4-Incidencias`,
  `PENDIENTES_auditoria`.

**Conclusión:** la **planificación está hecha**; la **ejecución sobre `docs/` está en cero**. El giro
clave: buena parte se puede escribir **ya, desde el código**, sin esperar a la extracción de chats.

---

## 2. Lo que falta

**a) Rellenar los docs vacíos:** `PROJECT_CONTEXT`, `AI_WORKFLOW`, `arquitectura/Arquitectura_Funcional`,
`Navegacion`, `Permisos`, `desarrollo/ROADMAP`, `integraciones/{Supabase, GoogleSheets, GoogleCloud}`,
`templates/{HANDOVER, CHANGELOG, PROJECT_CONTEXT}`.

**b) Fichas de módulo que no existen (~15):** CC1/Admin, Términos, Descuentos, Servicios/Deudas,
Publicaciones/PI/ML, Portal propietarios, Valoraciones, Comunidad Feliz (GGCC), Liquidación Paola,
Incidencias/Presupuestos, Config/Usuarios, Motor de procesos, Contactos/Requerimientos/Visitas,
Cartolas/BI, Control de asistencia/Tareas. (Hoy solo hay `Modulo_Liquidaciones` y `Modulo_Notificaciones`, a medias.)

**c) Ejecutar la extracción de los 29 chats** (según `PLAN_EXTRACCION_CHATS`).

**d) Correcciones ya detectadas:** fórmula UF (sin `valor_uf`) y ENEL (extensión/Servipag, no 2captcha).

**e) Verificar contra Supabase:** índice único de `proceso_permisos` (docs se contradicen) y el
esquema real de las tablas.

**f) Limpieza:** archivar el repo vacío `crm-arriendos-knowledge`; los `fix-*.js` sueltos en la raíz
del repo; duplicados del Proyecto.

**g) Seguridad:** rotar `GMAIL_APP_PASSWORD` y `PORTAL_INTERNAL_SECRET`; sacar secretos de la doc.

---

## 3. Lo que puedo hacer YO solo, desde el código (sin esperarte)

Esto es lo importante: **~60–70% de la documentación se puede escribir ya**, anclada al código, con
los huecos de "porqué" marcados para completarlos después:

- **`PROJECT_CONTEXT.md`** y **`AI_WORKFLOW.md`** (desde `CONVENCIONES_TRABAJO` chat 24 + `CLAUDE.md`).
- **`arquitectura/Arquitectura_Funcional.md`** y **`Navegacion.md`** (rutas y TopNav reales del código).
- **`arquitectura/Permisos.md`** (los dos sistemas + roles reales del código; el dato del índice único
  queda marcado "⚠ verificar en Supabase").
- **`Modulo_*.md` por cada módulo**, anclados a sus páginas/endpoints/tablas reales: qué hace, rutas,
  tablas, endpoints, estado. El "qué" completo; el "porqué" con huecos señalados.
- **`integraciones/Supabase.md`** (tablas usadas en el código), **`Servicios.md`** (ENEL/Servipag/Aguas
  reales), **`GoogleSheets/GoogleCloud`**.
- **`INDICE.md`** de cobertura (módulo ↔ doc ↔ estado) — el tablero para ver de un vistazo qué falta.
- **Corregir los 2 datos desactualizados.**
- **Rellenar `templates/`** con el molde que ya venimos usando (arranques/handover).
- **Todo esto lo puedo commitear a git** para que tú lo revises.

---

## 4. Lo que necesito de ti (no lo puedo hacer solo)

- **El "porqué" de los chats:** la extracción (me pasas el texto de cada chat 🔴, o le pides a cada uno
  que se autorresuma). Sin esto, las fichas quedan con huecos "⚠ porqué pendiente".
- **Validar las reglas de negocio** (las conoces tú; yo las infiero del código y puedo equivocarme).
- **Correr en Supabase** el `information_schema` (constraint de `proceso_permisos` + tablas) y pegármelo.
- **Rotar los secretos** (yo no toco credenciales).
- **Destino de escritura:** DECIDIDO → **main** (Luis, 09-jul-2026). Los commits de `docs/` van
  directos a main; no importa si disparan rebuild de Vercel.

---

## 5. Propuesta: pasar de planificar a ejecutar

- **Fase 1 — Cimientos (yo solo, ya):** `PROJECT_CONTEXT`, `AI_WORKFLOW`, `Arquitectura_Funcional`,
  `Navegacion`, `Permisos` + `INDICE`, y corregir los 2 datos. Todo desde el código, a git.
- **Fase 2 — Fichas de módulo (yo, una a una):** `Modulo_*.md` ancladas al código, empezando por las
  activas (Liquidaciones, Términos).
- **Fase 3 — "Porqué" (tú + yo):** extracción de los chats 🔴 (3, 11/6/8, 19/20, 24/25, 23, 0.1/0.2)
  para rellenar los huecos de las fichas.
- **Fase 4 — Cierre (tú):** validación de negocio + limpieza + seguridad.

**Recomendación:** arrancar la **Fase 1 ahora**. Con eso pasas de tener docs vacíos a un esqueleto con
carne (todo el "qué" del sistema documentado y anclado), sin depender aún de la extracción de chats.
