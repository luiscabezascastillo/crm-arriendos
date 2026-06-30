# Flujo de trabajo de desarrollo

## Entornos del desarrollador
- Se trabaja en **PowerShell**, alternando entre dos PCs:
  - PC1: `C:\Users\cabez\crm-arriendos`
  - PC2: `C:\Users\altom\crm-arriendos`
- Las rutas con nombre de usuario fijo fallan al cambiar de PC. Usar `~\crm-arriendos`, o ejecutar comandos sin `cd` cuando ya se está dentro del proyecto.
- La carpeta de descargas es `Downloads` (no `Descargas`). Los archivos descargados pueden caer en `Downloads\` o en `Downloads\files\`. Verificar siempre antes de copiar:
  ```powershell
  Get-ChildItem $HOME\Downloads -Recurse -Include nombre.js -ErrorAction SilentlyContinue | Select-Object FullName, LastWriteTime
  ```

## Ciclo de despliegue (orden estricto)
```powershell
npm run build          # esperar a "✓ Compiled successfully"
git add .
git commit -m "..."
git push               # esperar a "main -> main"
vercel --prod          # esperar a "✓ Ready"
```
Tras desplegar: **Ctrl+Shift+R varias veces** (Vercel y el navegador sirven bundles obsoletos de forma repetida).

## Cachés y deploys que no se actualizan
- Si `git` dice `nothing to commit, working tree clean` pero Vercel sigue sirviendo código viejo, forzar reconstrucción ignorando caché:
  ```powershell
  vercel --prod --force
  ```
- Confirmar siempre que el deploy llegó a `✓ Ready` **antes** de probar. Un build interrumpido (cerrar la terminal antes de tiempo) deja desplegada la versión anterior.
- Para verificar qué versión está realmente en el repositorio (no en disco):
  ```powershell
  git log --oneline -5
  git show HEAD:ruta/al/archivo.js | Select-String "patrón único de la versión nueva"
  ```

## Si el push es rechazado
```powershell
git pull --no-rebase --no-edit origin main
git push
```

## Reglas de entrega de archivos
- Al entregar varios archivos a la vez, usar nombres cualificados distintos (nunca dos `page.js`) y especificar la ruta destino de cada uno.
- Reemplazar archivos completos en lugar de editar fragmentos a mano cuando el cambio es grande: cortar y pegar fragmentos a ojo es la causa más común de errores.

---

# Validación de archivos antes de entregar

Todo archivo de código debe validarse antes de desplegarse:

1. **Cero escapes Unicode `\uXXXX`**: tildes y símbolos (×, →, ✓, ⊘, ñ, etc.) deben ir como caracteres reales UTF-8, no escapados.
   ```bash
   grep -c '\\u[0-9a-fA-F]\{4\}' archivo.js   # debe dar 0
   ```
2. **Balance de llaves, paréntesis y corchetes** (orientativo; los paréntesis dentro de strings/comentarios dan falsos positivos).
3. **Parseo JSX con esbuild** (obligatorio para `.jsx` y para `page.js`/`route.js` con JSX):
   ```bash
   node -e "require('esbuild').transform(require('fs').readFileSync('archivo.js','utf8'),{loader:'jsx'}).then(()=>console.log('OK')).catch(e=>{console.log('ERR:',e.message);process.exit(1)})"
   ```
   - `node --check` **NO** sirve para JSX (solo para JS plano). Para JS plano sí es válido.
4. **JSON** (manifiestos, configs): validar con `python3 -c "import json; json.load(open('archivo.json'))"`.

---

# Patrones de UI reutilizables

## Tablas tipo Excel (filtros por columna)
Patrón usado en el visor de Notificaciones, reutilizable en otros listados.

- Estado de filtros: objeto `filtros` donde cada clave es una columna.
  - Clave **ausente** → sin filtro en esa columna (todas las filas pasan).
  - Set **con valores** → solo pasan las filas cuyo valor está en el Set.
  - Set **vacío** → no pasa **ninguna** fila (resultado vacío, no "todas"). Es el comportamiento correcto tipo Excel.
- "(Seleccionar todo)" debe funcionar como on/off real: si todo está marcado y se desmarca, la tabla queda vacía; al volver a marcar, se restaura.
- Botón "Mostrar solo estos (N)": aparece al teclear en el buscador del popover y deja exactamente lo buscado.
- El contenedor de la tabla necesita `overflow: visible` para que el popover de filtro no se recorte.

## Selección masiva
- Checkbox maestro de cabecera: selecciona todo lo **filtrado** y enviable.
- Botón "Seleccionar pendientes (N)": marca de golpe los enviables de la vista filtrada.
- "Copiar emails": copia al portapapeles los correos de los seleccionados separados por `;` (vía `navigator.clipboard.writeText`).

## Tooltips en celdas truncadas
Para columnas con texto cortado por `text-overflow: ellipsis`, añadir el atributo `title={valor}` al `<td>` para mostrar el contenido completo al pasar el ratón (tooltip nativo).

## Páginas de proceso por lotes (consulta + progreso)
Patrón para procesar N elementos llamando un endpoint por cada uno (ej. consulta de deudas):
- Selector de mes + toggle "Todos / Solo pendientes".
- KPIs: a procesar, exitosos, fallidos, pendientes.
- Barra de progreso + log con marcas de tiempo.
- Botón "Detener" (con flag `cancelarRef`).
- Bucle `for` que actualiza estado tras cada item; los fallidos se listan con su mensaje de error (permitir `whiteSpace: pre-wrap` para ver diagnósticos largos).
- **No usar localStorage/sessionStorage** (no soportado en este entorno).
