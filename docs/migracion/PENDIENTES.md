# Pendientes — Auditoría documentación/config CRM FCR

> Registro de tareas detectadas en el chat "A.- Documentación Git y Auditoría".
> Se irá completando a medida que se resuelvan.

## 🔴 URGENTE (resolver a lo largo de la semana del 9-jul-2026) — Secretos en texto plano

**Detectado:** el documento de Contexto `CRM_Arriendos_Contexto.md.docx` (creado 02-jun-2026)
contiene credenciales reales en texto plano, visibles para cualquiera con acceso al proyecto:

- `GMAIL_APP_PASSWORD = wrfk zjen faty kgtv`
- `PORTAL_INTERNAL_SECRET = fc-internal-2026-xK9mP3qR7vNs` (y su gemelo `INTERNAL_SECRET`)
- Referencias/IDs de OAuth Google, ML, 2captcha, service account.

**Estado:** Luis confirma (09-jul-2026) que ahora mismo NO causa problema operativo;
se arreglará a lo largo de la próxima semana. NO urge hoy, pero queda pendiente.

**Acción a tomar (cuando se retome):**
1. Rotar el App Password de Gmail (`info@fondocapital.com`) — está quemado.
2. Rotar `PORTAL_INTERNAL_SECRET` / `INTERNAL_SECRET`.
3. Al reescribir el contexto como `arquitectura.md`, dejar SOLO los NOMBRES de las
   variables, nunca sus valores (los valores viven en `.env` / Vercel).
4. Considerar rotar también AUTH_GOOGLE_SECRET / NEXTAUTH_SECRET (ya estaba en el backlog
   de seguridad del TRASPASO_Chat17).

---

## Otras tareas de la auditoría (en curso, sin urgencia)

- Limpieza de los 8 documentos de Contexto: mapa de conservar/fusionar/archivar/borrar ya
  propuesto y pendiente de validación de Luis.
- Contradicción a verificar contra el código/Supabase: ¿la tabla `proceso_permisos` tiene
  o no índice único en `(proceso, email)`? Los docs se contradicen.
- Copia duplicada de `CRM_Accesos_Roles_Procesos.md` (14:05 vs 14:28) pendiente de comparar
  y eliminar la sobrante.
