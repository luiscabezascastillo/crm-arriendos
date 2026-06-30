# Scraping de deudas de servicios (Luz / Agua / Gas)

Consulta la deuda vigente de electricidad, agua y gas por inmueble para `/op/deudas`.

## Arquitectura general
- Librería: `lib/scraping-servicios.js`. Funciones: `consultarEnel`, `consultarAguasAndinas`, `consultarMetrogas`, `consultarAbastible`, `consultarGasco`, y router `consultarServicio(tipo, codigo, compania)`.
- Browserless (puppeteer-core) para Agua/Gas, vía `wss://production-sfo.browserless.io?token=${BROWSERLESS_API_KEY}`.
- Códigos excluidos (no se consultan): `estacionamiento`, `bodega`, `llega con ggcc`, `llega con g.c`, `pendiente ubicar`, vacío.

## Regla anti-bot fundamental (lección clave)
Los portales con Cloudflare/Incapsula **bloquean el tráfico de servidor** (IP de datacenter como Vercel) de dos formas:
- `fetch` directo desde el servidor → **HTTP 403**.
- Navegador headless (Browserless) → se le sirve la **pantalla del CAPTCHA** (Cloudflare Turnstile), no el contenido.

**El fetch debe ejecutarse desde el navegador real del usuario** (IP residencial + sesión + cookies), no desde el servidor ni desde un service worker. En extensiones MV3, el `content.js` (inyectado en la página) hereda las cookies anti-bot; el service worker en perfiles no-default **no** las envía. Por eso el fetch va en `content.js`, nunca en `background.js`.

## Tabla Supabase `ggcc_agua_luz`
- **Todas las columnas son tipo `text`** (la deuda hay que guardarla como string).
- Luz: `codigo_ele` (nº cliente, formato `XXXXXXX-X` con guion y dígito verificador, el DV puede ser `K`), `deuda_vigente_electricidad`, `fecha_hecho_luz`.
- Agua: `codigo_agua`, `deuda_vigente_agua`, `deuda_anterior_agua`, `fecha_hecho_agua`.
- Gas: `codigo_gas`, `deuda_vigente_gas`, `empresa_proveedora`, `fecha_hecho_gas`.
- GGCC: `deuda_gastos_comunes`, `fecha_hecho_ggcc`.
- Claves de actualización: `mes`, `idadmon`, `idinmue`.
- Validación de código consultable (regex): `/^[\d-]+[\dkK]?$/` (acepta el DV `K`).

## Endpoint `app/api/servicios/luz/route.js`
- `GET ?mes=...&solo_pendientes=true` → lista códigos a consultar (filtra `codigo_ele` no nulo/no vacío, `idinmue` que no empiece por `.`, y formato válido). `solo_pendientes` filtra `fecha_hecho_luz is null`.
- `POST {action:'guardar', mes, idadmon, idinmue, deuda, fecha}` → escribe la deuda.
- **Al reenviar errores de la función de scraping, propagar también el campo de diagnóstico** (`textoDebug`), no solo `error`; si no, se pierde la información que permite depurar selectores.

---

# Consulta de deuda ENEL (electricidad) vía Servipag

La consulta pública de ENEL quedó tras login (jun-2026). La vía operativa es **Servipag**, que expone la deuda de Enel mediante una API REST asíncrona.

## API de Servipag (descubierta inspeccionando el portal)
Portal: `https://portal.servipag.com/paymentexpress/category/luz/company/enel`
Enel = **company.id 107**, **category.id 14**, type `"standard"`.

**Paso 1 — registrar la consulta** (devuelve un `queryId`, no la deuda):
```
POST https://portal.servipag.com/portal/bill/v3/query/
Content-Type: application/json
Body: {
  "bill": {
    "company":  { "id": 107 },
    "category": { "id": 14 },
    "type": "standard",
    "metaData": [ { "name": "identifier", "value": "<NUMERO_CLIENTE>" } ]
  },
  "queryId": ""
}
→ { "data": { "queryId": "<ID>" }, "result": { "codigo": 0, "mensaje": "OK" } }
```

**Paso 2 — polling** (la búsqueda es asíncrona):
```
GET https://portal.servipag.com/portal/bill/v3/query/<queryId>/lastcall/false
```
Repetir cada ~1 s hasta que `data[0].queryStatus === 1` ("Busqueda finalizada con Exito").
Mientras `queryStatus === 0` ("Busqueda NO finalizada"), seguir sondeando. Límite recomendado: 15 intentos.

**Paso 3 — leer el resultado** de `data[0]`:
- `totalAmount` → deuda (entero, en pesos).
- `expirationDate` → vencimiento (formato `dd/mm/yyyy`).
- Otros: `invoiceAddress`, `company.name` ("Enel"), `category.name` ("Luz").

## Restricción crítica: Cloudflare Turnstile
La API está protegida por **Cloudflare Turnstile (CAPTCHA invisible)**:
- `fetch` directo desde Vercel → **HTTP 403**.
- Browserless headless → recibe la pantalla de Turnstile (input oculto `cf-turnstile-response`, 0 inputs de formulario visibles), no el formulario real.

**Solución operativa: ejecutar el POST + polling desde el navegador real del administrativo** (extensión `crm-bridge`, ver su documento). El navegador con IP residencial y sesión pasa el Turnstile de forma transparente, igual que una consulta manual.

## Dato de verificación
Cliente de prueba `3290040-2` → deuda y vencimiento reales coherentes con la web. Útil para validar la integración tras cambios.

---

# Extensión CRM Bridge (consultas anti-bot desde el navegador del usuario)

Extensión de Chrome (Manifest V3) en `extensions/crm-bridge/`. Permite que las consultas a portales con anti-bot (Servipag/Enel, Aguas Andinas) se ejecuten desde el **navegador real del administrativo**, sorteando los bloqueos de IP de datacenter y los CAPTCHA que afectan al servidor.

## Por qué existe
Los portales tras Cloudflare/Incapsula bloquean el servidor (403 o pantalla de CAPTCHA). El navegador del usuario, con IP residencial, sesión y cookies, pasa esos controles. Lección aprendida (jun-2026): **el fetch debe hacerse en `content.js`** (inyectado en la página, hereda cookies anti-bot), no en el service worker, que en perfiles de Chrome no-default no envía las cookies.

## Arquitectura
- **`manifest.json`**: declara `host_permissions` y `content_scripts` para cada dominio consultado (`aguasandinas.cl`, `portal.servipag.com`, `enel.cl`). `externally_connectable` permite que el CRM le hable (`localhost:3000` y `crm-arriendos.vercel.app`).
- **`background.js`** (service worker): escucha mensajes del CRM vía `chrome.runtime.onMessageExternal`. Contrato:
  - `PING` → `{ ok, pong, version }`
  - `CONSULTAR_AGUA {codigo}` → `{ ok, deuda }`
  - `CONSULTAR_ENEL {codigo}` → `{ ok, deuda, fecha }`
  Localiza la pestaña del dominio (`chrome.tabs.query`) y delega el fetch al `content.js` (`chrome.tabs.sendMessage` con `AGUA_FETCH` / `SERVIPAG_FETCH`).
- **`content.js`**: inyectado en cada dominio. Atiende `AGUA_FETCH` y `SERVIPAG_FETCH` y ejecuta los fetch DENTRO de la página.

## Requisito de uso
El administrativo debe tener la extensión instalada **y una pestaña abierta** del servicio a consultar:
- Luz: `https://portal.servipag.com/paymentexpress/category/luz/company/enel`
- Agua: página "pagar-mi-cuenta" de Aguas Andinas.
Si el content script no responde, recargar esa pestaña (F5) y reintentar.

## Comunicación CRM ↔ extensión
La página del CRM obtiene el `extensionId`, hace `PING` para verificar conexión, y por cada código llama:
```js
chrome.runtime.sendMessage(extensionId, { type: 'CONSULTAR_ENEL', codigo }, (resp) => { ... })
```
Luego guarda el resultado con el endpoint del servidor (`POST {action:'guardar', ...}`). El guardado SÍ va por servidor (Supabase no tiene anti-bot); solo la consulta al portal externo va por la extensión.

## Detalle Aguas Andinas (referencia de patrón ya probado)
El fetch de agua son 2 POST encadenados (buscar cuenta → seleccionar) contra el portlet Liferay, usando el `p_auth` extraído del HTML de la página. El monto sale de `id="pago2"` o `id="montoPagoSum"`. El código de agua se normaliza quitando el guion/DV (`split('-')[0]`, solo dígitos).
