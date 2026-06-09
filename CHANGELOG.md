# CHANGELOG — CRM Arriendos · Fondo Capital

Historial de cambios por sesión de desarrollo.

---

## [2026-06-08] — Sesión 08/06

### Módulo Publicaciones

#### Nuevas funcionalidades
- **Modo "En preparación"** — tercer modo de vista (junto a Activas e Históricas) para publicaciones con `activo='CREAR'`
- **Botón "🔴 Dar de baja"** — cierra en todos los portales activos, marca `activo='CLOSE'` y pasa a Históricas
- **Botones en 2 columnas** — columna Acciones reorganizada en grid 2x para acomodar el nuevo botón
- **Sección Editar completa** en ficha de publicación:
  - Campos base: ubicación, propiedad, observaciones
  - Atributos PI: orientación, piso, antigüedad, pisos edificio, deptos por piso, nº depto, rol
  - Características adicionales: balcón, lavandería, cuarto servicio, baño visitas, seguridad, ocultar dirección
- **Botón "📝 Actualizar descripción"** en card Portal Inmobiliario — paso independiente para subir descripción a ML

#### APIs nuevas
- `POST /api/publicar-pi/descripcion` — actualiza descripción en ML (PUT primero, POST si falla)
- `POST /api/publicar-pi/cerrar` — cierra ítem en ML via PUT status=closed

#### Mejoras
- **Republicar** migrado a API server-side `/api/publicaciones/republicar`
- **Orden de publicación**: Web → Yapo → PI (Web es requisito)
- **PI en dos pasos**: POST con todos los datos + POST descripción separado
- **Botón Publicar PI** habilitado (`apiKey: 'pi'`)
- Buscador superior conectado a query server-side
- Filtros Excel columnas conectados a Supabase con `.in()` server-side

#### Fixes
- `import React` agregado en ficha (faltaba para `React.useState`)
- `createClient` duplicado eliminado de `SeccionEditar`
- Sección Editar se activa desde URL `?seccion=Editar` via `useEffect`
- Campos numéricos convertidos a String para permitir edición en formulario
- Función `nuevaPublicacion` duplicada en múltiples componentes — eliminada

---

## [2026-06-07] — Sesión 07/06

### Web fondocapital.com
- `d_property.php` migrado a JavaScript fetch (resuelto error 500 por timeout PHP)
- `properties.php` migrado a JavaScript fetch — precio en pesos solo para arriendos

### Módulo Publicaciones
- **Botón "🌐 Publicar en Web / 🔴 Retirar de Web"** — toggle `web='SI'` desde ficha
- **Botón "📥 Descargar XML Yapo"** y **"🔗 Ver importación programada"** en card Yapo
- **`APIYapo.php`** — generador XML dinámico en fondocapital.com para importación programada Yapo
- **API `/api/propiedades-web-yapo`** y **`/api/generar-yapo`**
- **Botón "+ Nueva publicación"** — crea código secuencial y navega a ficha
- **Botón "📋 Copiar publicación"** — nuevo código con todos los datos del actual (sin imágenes)
- **Botón "🔄 Republicar"** — cierra en PI/Yapo/Web, crea nueva publicación, publica automáticamente
- **Buscador de propietario** en sección Editar — busca en tabla `contactos`, rellena nombre/teléfono/email
- **Botón "+ Crear contacto"** — crea contacto nuevo en tabla `contactos` y lo asigna a la publicación
- Borradores (`activo='CREAR'`) visibles en Históricas

### Infraestructura
- Submódulo duplicado `crm-arriendos\crm-arriendos` eliminado
- Regex inválidas en `contactos/page.js` corregidas
- `jszip` instalado
- Imágenes limitadas a `imagen1`–`imagen38`

---

## [2026-06-06] — Sesión 06/06

### Atributos Portal Inmobiliario
- 12 columnas nuevas en tabla `publicaciones`: `unit_floor`, `property_age`, `floors`, `apartments_per_floor`, `apartment_number`, `property_registration_code`, `has_balcony`, `has_laundry`, `has_maid_room`, `has_half_bath`, `has_security`, `hide_address`
- Formulario edición en CRM actualizado con sección "Atributos PI" (azul)
- Payload publicar-pi actualizado con todos los nuevos atributos (nivel Estándar y Profesional)

### Web fondocapital.com
- `properties.php` migrado a JavaScript fetch desde Supabase
- `d_property.php` migrado a JavaScript fetch desde Supabase
- API pública `/api/propiedades-web` en CRM
- Botón "🌐 Publicar en Web / 🔴 Retirar de Web" en ficha de publicación

### Yapo
- API `/api/propiedades-web-yapo` en CRM
- API `/api/generar-yapo` genera XML descargable
- `APIYapo.php` creado para fondocapital.com (importación programada)

---

## [2026-06-04] — Sesión 04/06

### Nuevos módulos desplegados
- **Email grandes deudores** `/op/email-deudores` — busca arrendatarios con deuda superior a umbral, vista previa editable, envío
  - APIs: `/api/email-deudores/buscar` y `/api/email-deudores/enviar`
- **Panel Dirección** `/direccion` — protegido para alberto.cabezas, luis.cabezas, karina.morales
- **Control de Asistencia** `/direccion/control-asistencia`
  - APIs: `/api/control-asistencia/dashboard` y `/api/control-asistencia/importar-whatsapp`
- **Notificaciones ML** `/op/ml-notificaciones` — dashboard tiempo real Portal Inmobiliario, leads, pausar publicación

### Infraestructura ML
- Webhook ML `/api/ml/notificaciones` — tópicos activos: items, vis_leads, questions, messages
- Token OAuth refrescado y guardado en Supabase (`configuracion`)
- APIs: `/api/ml/refresh-token`, `/api/ml/exchange-code`, `/api/ml/visitas`, `/api/ml/pausar`
- Tabla nueva: `ml_notificaciones`

### Portal Propietarios
- Acceso token `/acceso/[token]` implementado y desplegado
- API `/api/auth/acceso/route.ts`

### TopNav
- Modal CRM restaurado (Reglamento Interno + Mapa de Procesos)
- Botón Dirección visible solo para emails de dirección

### Workflow Términos
- Motor genérico con tablas: `workflow_definitions`, `workflow_nodes`, `workflow_dependencies`, `workflow_instances`, `workflow_tasks`, `workflow_task_logs`
- 21 nodos proceso Término (N01-N21)
- Dashboard `/procesos/terminos`, detalle `/procesos/terminos/[idadmon]`, mis tareas `/procesos/mis-tareas`
- 57 workflows creados automáticamente desde contratos en estado Q
- Vistas SQL: `vw_workflow_resumen`, `vw_workflow_tasks`

---

## Pendientes activos

### Inmediatos
- **Filtro Excel columnas** — debe buscar en toda la BD (Activas, En preparación, Históricas), no solo página actual
- **Botón toggle Yapo** desde ficha (igual que Web)
- **Yapo** — actualizar URL importación programada: `APIYapo.xml` → `APIYapo.php`
- **fondocapital.com** — eliminar archivos test del FTP (`test_curl.php`, `test_d_property.php`, `test_minimal.php`)

### Backlog
- Trigger automático workflow Término cuando `datos_arriendos.estado → Q`
- Workflow Cobranza
- Certificación ML para `/vis/leads`
- Actualizar GGCC sin republicar en PI
- Subir fotos al CDN de ML con watermark
- Gas — APIs Metrogas, Abastible, Gasco
- Portal arrendatarios con link mágico por RUT
- `idinmue`/`idadmon` en publicaciones — reconstruir vínculo (28/64)
- `ggcc_agua_luz` — automatizar carga mensual
