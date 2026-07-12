# Plan priorizado de extracción de los chats → docs/

> Extensión del tablero `MIGRACION_CONOCIMIENTO.md`. Objetivo: decidir qué chats vale la pena
> extraer (guardan "porqué" no evidente) y cuáles se pueden **saltar** porque su resultado ("qué")
> ya vive en el código.
>
> **Criterio de prioridad:** valor = cuánto "porqué" único hay que el código NO puede expresar
> (reglas de negocio, criterios, casos límite, decisiones y descartes). Un chat cuyo resultado ya
> está en git y cuya lógica es evidente → **saltar**.
>
> Leyenda prioridad: 🔴 Alta (extraer) · 🟡 Media (extraer si hay tiempo / verificar) · ⚪ Baja (saltar).

---

## Chats 0.1–0.4 (fundacionales / contexto)

| Chat | Temas clave | ¿"Qué" en código? | ¿"Porqué"? | Prioridad | Acción |
|:--:|---|:--:|---|:--:|---|
| 0.1 | **CRM FCR — Roles, permisos y estado del proyecto** | Parcial | **Sí** | 🔴 | Feed de `Permisos.md` y `PROJECT_CONTEXT.md`. |
| 0.2 | **Manual de procesos** (los 13 procesos FCR) | Parcial (`/procesos-2026.html`, `lib/procesos.js`) | **Sí** | 🔴 | Feed de `Arquitectura_Funcional.md` / `Navegacion.md`. |
| 0.3 | FCR — Reorganización 2026 · Personal · IA · Luis | No (org) | Sí (contexto) | 🟡 | Feed de `PROJECT_CONTEXT.md` (equipo, cómo se usa la IA). |
| 0.4 | Deudas servicios · filtros Excel CC1/Deudas · **scraping ENEL/Servipag** · deploy Vercel | Sí | Parcial | 🟡 | Confirma el enfoque **ENEL/Servipag** actual → `integraciones/Servicios.md`; Deudas. |

## Chats 1–7 (títulos ya conocidos)

| Chat | Temas clave | ¿"Qué" en código? | ¿"Porqué" único? | Prioridad | Acción |
|:--:|---|:--:|---|:--:|---|
| 1 | Contratos arrendamiento · Planilla Excel entrada · PI (atributos / descripción indep. / dar de baja / En preparación / editar fichas) · Republicar portales · Filtros Excel BD · **Módulo Tareas trabajadores** | Sí | Parcial | 🟡 | Extraer: lógica de **contratos**, **mapeo de atributos PI** y el **módulo Tareas**. Saltar la UI. |
| 2 | Módulo contactos · Ficha contacto (tabs) · OV modal PDF · **Validación RUT (mód. 11)** · **Roles inversor/maestro** · **Auditoría `creado_por`** · **Roadmap matching/pipeline/canje** · Mapa pins | Sí | Sí (roadmap, roles) | 🟡 | Extraer: **roadmap** matching/pipeline/canje → ROADMAP; **roles** → Permisos; regla de RUT. |
| 3 | **Arquitectura motor 4 niveles** · **Mapa 13 procesos FCR** · masivos vs individuales · **Lógica liquidación DOS CARRILES** · **Modelo descuentos propietarios** · **Tabla proceso_permisos** · **Matriz permisos 9 usuarios** · Scraping servicios analizado · Backlog priorizado | Parcial | **No — mucho porqué** | 🔴 | **El más valioso de este rango.** Alimenta `arquitectura`, `Permisos`, Liquidaciones (dos carriles), Descuentos, Servicios. Puede resolver la duda del índice único de `proceso_permisos`. |
| 4 | Agua masiva Aguas Andinas · Drawer deudas + comentarios · Export Excel deudas · TopNav modal docs · CC1 (IDPROP/IDLINMUE, botón Portal) · Portal propietarios deploy · Fabiola permisos | Sí | Trivial/parcial | ⚪ | Saltar casi todo (resultado en código). Solo rescatar notas de integración **Aguas Andinas** si faltan en `Servicios`. |
| 5 | **Yapo (APIYapo.php, XML / programada)** · Toggle Web ficha · Nueva/Copiar/Republicar publicación · Borradores en históricas · Buscador propietario · Fixes (regex/imagen38) | Sí | Parcial (Yapo) | 🟡 | Extraer el **enfoque de integración Yapo/portales**; saltar los fixes. |
| 6 | **Análisis Proceso Términos** · **Diseño Permisos CRM** · **Valoración Experto** · Mapeo Amenities PI · Manuales (Public./Desarrollador/Términos/Deudas) · Workflows + Pendientes | Parcial | **Sí (Términos, Permisos, Valoración)** | 🔴 | **Extraer.** Feed directo de **B2 Términos**, `Permisos.md` y **Valoración**. Revisar si los "Manuales" ya están en `public/manuales`. |
| 7 | **Mi Portal: tareas por proceso** · Dirección encarga/filtra tareas · Comercial→Ventas · Bitácora · Chequeo PI · Vacuna `fotos_ml` · Fixes publicar-pi/copiar · Notas seguridad | Sí | Trivial/parcial | ⚪ | Parcial en `final seccion 7`. Solo rescatar la lógica de **Tareas/Mi Portal** si no queda clara en código. Resto saltar. |

## Chats 8–13

| Chat | Temas clave | ¿"Qué" en código? | ¿"Porqué" único? | Prioridad | Acción |
|:--:|---|:--:|---|:--:|---|
| 8 | Grafo Términos (tarjeta flotante) · **Descripciones 23 nodos en BD** · Nodos N04b/N08b · **Bitácora ediciones (endpoint + diff)** · Atributos PI (mascotas/amoblado/calef/AC value_id) · Fix actualizar-pi · Encoding UTF-8 | Sí (`GrafoTermino.js`) | Parcial (Términos) | 🟡 | Extraer el **porqué del workflow de Términos** (23 nodos) y la bitácora con diff. PI value_ids y fixes → saltar. |
| 9 | Limpiar .bak + .gitignore · Toggle visibilidad procesos · Yapo 16867 · **Unique `codigo` + generador atómico `siguiente_codigo`** · Migrar copiar/nueva/republicar a la secuencia · Renombrar Nubox→Financiero · **Karina responsable** · **Responsable único por proceso (limpiar duplicado Cristhian)** | Sí | Sí (permisos, secuencia) | 🟡 | Extraer: **"responsable único por proceso"** → Permisos; **generador atómico de código**. Repo cleanup → saltar. |
| 10 | Región/Comuna edificios · **Comunas RM con IDs ML** · Listado dirección real/compacto · Ordenamiento precio UF→$ · Publicar Web/Yapo marca activa · **Motor matching (tabla + `lib/matching.js`)** · **CRUD requerimientos (Entrega 1)** | Sí | Sí (matching, requerim.) | 🟡 | Extraer **motor de matching** y diseño de **requerimientos** (Ventas). UI → saltar. |
| 11 | Panel Término v1 · tabla `terminos` · **workflow 22 pasos** · `termino_lineas` (conceptos fijos) · **mapeo descuentos a líneas** · resumen descuentos · **servicios desde `ggcc_agua_luz`** · **balance desde cuentas** | Sí | **No — mucho porqué** | 🔴 | **Extraer.** Núcleo de **Términos** + enlaces a Descuentos, Servicios y CUENTAS/Liquidaciones. |
| 12 | Firma OV (RUT/domicilio/extranjero) · menús Comercial/Inventario · bandeja `/visitas` · Calendario · cliente Supabase único · **correo órdenes con Resend** · **matching inverso** · cumpleaños · **requerimientos por zona (polígono Leaflet + point-in-polygon)** | Sí | Parcial (Resend, zona) | 🟡 | Extraer: integración **Resend**, **matching inverso** y **zonas (point-in-polygon)**. UI → saltar. |
| 13 | Bug dirección · Fix copiar `direccionreal` · Limpieza 31 .bak · **Comunas desnormalizadas / IDs ML corruptos** · `/api/ml/comunas` · **tabla `comunas_ml` + sync desde ML** · publicar-pi `getComuna` robusto | Sí | Parcial (comunas ML) | ⚪ | Casi todo bugs/cleanup. Solo rescatar el **porqué de `comunas_ml`/sync ML** → `integraciones`. |

> **Ojo:** entre los 25 títulos NO aparecen explícitos dos módulos que sí existen en el código:
> **Comunidad Feliz (GGCC)** y **Liquidación Paola**. Su "porqué" puede estar disperso (GGCC asoma
> en el chat 11 vía `ggcc_agua_luz`). Al documentar esos módulos, anclarse sobre todo al código.

## Chats 14–25 (con título conocido)

| Chat | Título (aprox.) | Tema | ¿"Qué" en código? | ¿"Porqué" ya capturado? | Prioridad | Acción |
|:--:|---|---|:--:|---|:--:|---|
| 25 | Facturación Simple | Facturación / Nubox (FACTURAS) | Sí (`/api/liquidaciones/facturar`, página facturas) | No (backlog; decisiones abiertas) | 🔴 | **Extraer.** Alimenta el módulo Liquidaciones/FACTURAS (activo). |
| 24 | Override de transferencia | Override + proceso CUENTAS | Sí (`/api/liquidaciones/override`) | Parcial (`PROCESO_MENSUAL_CUENTAS`, `CONVENCIONES`) | 🟡 | Verificar y completar el **criterio del override** (cuándo, quién). |
| 23 | Módulo Valoración | Valoraciones (comparables ML, SII, stats) | Sí (muchos `/api/valoraciones/*`) | No | 🔴 | **Extraer.** Módulo grande, muchas decisiones no evidentes. |
| 22 | Liquidaciones: envíos | EMAILS: PDF, Drive, reenvíos | Sí + `Guia_Liquidaciones` | Parcial (guía de usuario) | 🟡 | Extraer decisiones técnicas (no solo el "cómo usar"). |
| 21 | Contratos borrador | Generación de contrato (plantilla marcadores) | Parcial (`CONTRATO_Plantilla_Marcadores.docx`) | No | 🟡 | Extraer la lógica de marcadores/generación. |
| 20 | Proporcional primer mes | Prorrateo por días de arriendo | **No** (el sistema no lo deduce de los datos) | No | 🔴 | **Máxima prioridad.** Regla de negocio pura, alto riesgo de pérdida, toca Liquidaciones. |
| 19 | Liquidaciones Transfer | ADMON360 / cálculo N_TRANSFER | Sí (RPC `calcular_liquidacion`, páginas) | Parcial (`INICIO_CHAT_19`) | 🔴 | **Extraer.** Núcleo del cálculo de liquidación. |
| 18 | Notificaciones: filtros | Fixes UI de notificaciones | Sí | Sí (`INICIO_CHAT_19`) | ⚪ | Saltar (resultado en código; ya resumido). |
| 17 | Página /procesos/notif. | Cableado página notificaciones | Sí | Sí (`HANDOVER_Chat17_a_Chat18`) | ⚪ | Saltar. |
| 16 | Circuito estados CC1 | Estados P/S/SQ/Q/N + emails | Sí (`/api/cc1/*`) | Sí (`TRASPASO_Chat17`) | 🟡 | Verificar que el doc de CC1 quede completo; si sí, saltar. |
| 15 | Incidente de acceso | Permisos / caso de acceso | Sí | Parcial (`CRM_Dos_Sistemas_Permisos` cuenta un caso real) | ⚪ | Saltar salvo que haya una regla nueva. |
| 14 | Bug características | Fix de bug (amenities/publicaciones) | Sí | Trivial | ⚪ | Saltar. |

---

## Orden de trabajo recomendado (primera pasada)

1. **Chat 3** — arquitectura del motor + 13 procesos + **liquidación dos carriles** + modelo de
   descuentos + matriz de permisos. Transversal: fija el marco que hace más fáciles los demás.
2. **Chat 20** — prorrateo proporcional primer mes (regla que el código no expresa; urge).
3. **Chat 19** — cálculo de liquidación / N_TRANSFER (ADMON360).
4. **Términos (bloque):** chats **11 + 6 + 8** — workflow (22 pasos / 23 nodos), `termino_lineas`,
   mapeo de descuentos, balance desde cuentas. Feed directo de **B2 Términos**.
5. **Chat 24** (override) · **Chat 25** (facturación / Nubox → FACTURAS).
6. **Valoración:** chats **23 + 6**.
7. **Matching / Ventas:** chats **10 + 2 + 12** (motor de matching, roadmap, zonas, Resend).
8. **🟡 segunda pasada:** chats 1, 5, 9, 13.
9. **Verificar** que 16/17/18 quedaron cubiertos por sus handovers; marcar y saltar.
10. **Saltar (⚪):** 4, 7, 14, 15, 18 (17 según verificación).

Los 🔴 se concentran en **Arquitectura/Permisos, Liquidaciones/ADMON360, Términos, Valoración y
Facturación**. Los de bugs/UI (publicaciones, drawers, TopNav, fixes) se dan por cubiertos con el código.

---

## Mapa chat → módulo (para arrancar cada chat de módulo)

> Cuando abras un chat de módulo, estos son los chats históricos de donde extraer su "porqué".

- **Arquitectura / motor de procesos:** 3, 0.2
- **Permisos:** 3, 6, 9, 0.1 · (roles: 2, 15)
- **Liquidaciones / ADMON360 / CUENTAS:** 3 (dos carriles), 19, 20, 22, 24, 25, 11 (balance/descuentos)
- **Términos:** 11, 6, 8
- **Descuentos:** 3, 11
- **Valoración:** 23, 6
- **Publicaciones / PI / MercadoLibre:** 1, 5, 7, 8, 10, 13
- **Matching / Requerimientos (Ventas):** 10, 2, 12
- **Contactos / Visitas / Órdenes de visita:** 2, 12
- **Notificaciones a arrendatarios:** 16, 17, 18
- **Servicios / deudas (Aguas, ENEL, GGCC):** 4, 0.4, 11 (ggcc), 13 (comunas ML)
- **Integraciones (Resend, Yapo, comunas ML):** 12 (Resend), 5 (Yapo), 13 (comunas_ml)
- **Contexto / organización / equipo:** 0.1, 0.3
- **Incidencias (Mantención):** — sin chat dedicado (módulo nuevo, ver `docs/arranques/B4-Incidencias.md`)

---

## Cómo extraer cada chat (método)

Como Claude no puede leer tus chats desde el entorno, para cada uno de la lista:
1. Abre el chat y pídele: *"Extrae SOLO el conocimiento permanente y el porqué de las decisiones
   de este chat (reglas de negocio, criterios, casos límite, descartes). No resumas la conversación
   ni el paso a paso. En markdown, listo para pegar en docs/."*
2. Pasa ese extracto → se incorpora al `docs/` del módulo correspondiente.
3. Marca la fila en `MIGRACION_CONOCIMIENTO.md` (Extraído / Revisado / Incorporado).

> Al incorporar, recordar corregir de paso los 2 datos que el código desmintió: fórmula UF
> (sin `valor_uf`) y ENEL (extensión/Servipag, no 2captcha). Ver `INVENTARIO_conocimiento.md`.
