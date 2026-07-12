# INVENTARIO DE CONOCIMIENTO — CRM FCR

> Fecha: 09-jul-2026 · Propósito: mapear TODO el conocimiento disperso antes de decidir
> dónde vive cada cosa. No mueve ni borra nada; es la foto para decidir.
> Fuentes revisadas: repo de código (git), Proyecto de claude.ai, repo `crm-arriendos-knowledge`,
> y archivos sueltos subidos desde Downloads.

---

## Hallazgo principal

**La migración del conocimiento se planificó y se andamió, pero nunca se ejecutó.**

- Tu `MIGRACION_CONOCIMIENTO.md` es el tablero para volcar los chats 1–18 a `docs/`. Las
  **18 casillas están sin marcar**: 0 chats extraídos, 0 revisados, 0 incorporados.
- Los `docs/` del repo de código son casi todos **stubs vacíos** (AI_WORKFLOW, PROJECT_CONTEXT,
  Permisos, ROADMAP, Arquitectura_Funcional, integraciones, templates → 0 bytes).
- Por tanto, el conocimiento real vive HOY en tres sitios NO gobernados: los **archivos sueltos**
  (Downloads), los **chats**, y el **código** (única ancla fiable).

Conclusión: no hay que "reorganizar tres bases de conocimiento", hay que **ejecutar por primera vez**
una migración ya diseñada, usando el código como ancla.

---

## Los 4 sitios — veredicto

| Sitio | Qué contiene | Veredicto |
|---|---|---|
| **Repo de código `docs/`** | Estructura correcta (arquitectura/desarrollo/integraciones/templates) pero casi vacía; 5–6 archivos con algo | **Casa oficial.** Rellenar aquí. |
| **Proyecto claude.ai** | 8 docs: guías, contextos, traspasos; con duplicados y 2 datos desactualizados | Dejar solo reglas + punteros; migrar lo bueno a git. |
| **Repo `crm-arriendos-knowledge`** | **VACÍO** (esqueleto 0 bytes, chats/ y assets/ sin archivos) | **Archivar / eliminar.** Primer intento abandonado; nada que migrar. |
| **Downloads (sueltos)** | Materia prima: los `.md` de abajo + zips + instructivos + auditorías | Bandeja de entrada. Extraer lo permanente y archivar el resto. |

---

## Inventario archivo por archivo (lo subido desde Downloads)

| Archivo | Qué es | ¿Está en git? | Valor | Acción sugerida |
|---|---|---|---|---|
| `MIGRACION_CONOCIMIENTO.md` | Tablero de migración de chats 1–18 (todo sin marcar) | No | Alto (control) | **Adoptar como tracker** de la migración; llevar a `docs/`. |
| `CONVENCIONES_TRABAJO.md` (chat 24, 07/07) | Reglas de trabajo Luis↔Claude, más actuales y detalladas que las del Proyecto | No (`AI_WORKFLOW.md` vacío) | Alto | Volcar a **`docs/AI_WORKFLOW.md`**. |
| `PROCESO_MENSUAL_CUENTAS.md` (chat 24) | Spec del proceso mensual de CUENTAS, caso de abandono, y enlace a DJ 1835 (SII). Confirma RPC `calcular_liquidacion`, estados que se liquidan (S/SQ/P; Q no) | No | **Oro** | Base de **`docs/arquitectura/Modulo_Liquidaciones.md`** (y semilla de un futuro `Modulo_Cuentas.md`). |
| `HANDOVER_Chat17_a_Chat18.md` | Handover con decisiones permanentes (fórmula `apagar`, estados válidos, fixes CC1, imports por profundidad) | No | Medio-alto | Extraer conocimiento a módulos; luego **archivar**. |
| `INICIO_CHAT_19.md` | Arranque chat 19: estado de 3 frentes (Notificaciones ✅, ADMON360/Liquidaciones, ENEL/Servipag) | No | Medio-alto | Extraer (ENEL, ADMON360, seguridad) → integraciones + liquidaciones; **archivar**. |
| `CRM_Dos_Sistemas_Permisos.md` | Los dos sistemas de permisos + fix NextAuth | Sí, en el **Proyecto** (duplicado) | Alto | Base de **`docs/arquitectura/Permisos.md`** (hoy vacío). |
| `TRASPASO_Chat17_1.md` | Traspaso chat 16→17 (duplicado del que hay en el Proyecto) | Duplicado del Proyecto | Bajo | Extraer si falta algo; **archivar**. |
| `README.md` | Plano de la estructura `docs/` (blueprint) | Sí, replicado en `docs/README.md` | Referencia | Ya reflejado; **archivar** el suelto. |
| `crm-arriendos-knowledge/` (repo entero) | Esqueleto vacío | — | Ninguno | **Archivar / eliminar** el repo. |

---

## Conocimiento valioso que HOY solo está suelto (con su destino)

- **Proceso mensual de CUENTAS** (calendario día 5/6/7/8, ventana de edición, re-sincronización por
  IDADMON, cierre con auditoría) → `Modulo_Liquidaciones.md` / `Modulo_Cuentas.md`.
- **Caso de abandono del arrendatario** (S→Q, genera nuevo P, qué entra en la liquidación, override
  huérfano, nota al propietario vs nota interna de riesgo) → `Modulo_Liquidaciones.md`.
- **DJ 1835 (SII)** como módulo futuro derivado de CUENTAS + CARTAS → `ROADMAP.md`.
- **ADMON360 / liquidaciones**: RPC `calcular_liquidacion`, N_TRANSFER, y las 3 preguntas de negocio
  abiertas → `Modulo_Liquidaciones.md`.
- **ENEL / Servipag**: Cloudflare Turnstile, solución vía extensión `crm-bridge`, API Servipag
  (company 107, category 14, polling) → `integraciones/Servicios.md`.
- **Convenciones de trabajo** (entrega de archivos, PowerShell altom/cabez, UTF-8, authOptions) →
  `AI_WORKFLOW.md`.

---

## Contradicciones y desactualizaciones detectadas (código = árbitro)

1. **Fórmula del arriendo en UF.** El código
   (`app/procesos/notificaciones/page.js`) calcula `round(cuota × uf_peso_factor)` — **sin**
   multiplicar por `valor_uf`. El doc del Proyecto `contexto-notificaciones-ajustes.md` dice
   `cuota × uf_peso_factor × valor_uf`. **El doc está mal.** `uf_peso_factor` YA es el valor de la UF
   del mes (lo escribe el VBA). Corregir al escribir la doc de notificaciones.

2. **ENEL.** El doc del Proyecto (`CRM_Arriendos_Contexto`) dice 2captcha + reCAPTCHA. El código real
   usa la **extensión crm-bridge** (Servipag tras Cloudflare Turnstile). Doc desactualizado.

3. **`proceso_permisos` — índice único.** Dos docs se contradicen sobre si existe el índice único
   `(proceso, email)`. Pendiente de verificar contra Supabase (`information_schema`).

---

## Próximos pasos recomendados

1. **Adoptar `MIGRACION_CONOCIMIENTO.md` como tablero** de la ejecución (complementado con un índice
   de cobertura de código, para no dejar módulos sin doc).
2. **Rellenar los `docs/` vacíos** desde estos archivos, empezando por los de más valor y menos
   ambigüedad: `AI_WORKFLOW.md` ← CONVENCIONES; `Permisos.md` ← Dos_Sistemas; `Modulo_Liquidaciones.md`
   ← PROCESO_MENSUAL_CUENTAS + ADMON360; `Servicios.md` ← ENEL/Servipag.
3. **Corregir los 2 datos desactualizados** (fórmula UF, ENEL) al escribir sus docs.
4. **Archivar** el repo `crm-arriendos-knowledge` y los sueltos ya extraídos.
5. **Decidir el destino de escritura** (rama vs main) para que yo pueda ir persistiendo por ti.
