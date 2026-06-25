# CLAUDE.md — crm-arriendos

Proyecto: CRM de arriendos de Fondo Capital (FCR).
Stack: Next.js 16 + Supabase + next-auth v4. Despliegue en Vercel.

## Convencion de rutas (SIEMPRE)
La terminal se situa en la RAIZ del proyecto (carpeta `crm-arriendos`).
Todos los comandos usan rutas RELATIVAS (`.\app\...`, `.\lib\...`).
NUNCA rutas absolutas con nombre de usuario (evita el lio altom/cabez).

## Metodo de edicion fiable (PowerShell)
Leer/escribir siempre en UTF-8 sin BOM:

    $f = '.\ruta\al\archivo.js'
    $t = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
    $t = $t.Replace("viejo", "nuevo")
    [System.IO.File]::WriteAllText($f, $t, (New-Object System.Text.UTF8Encoding($false)))

- Cadenas con backticks o ${} de JS: usar comillas SIMPLES en PowerShell.
- Caracteres especiales (guion largo, grados): anclar el Replace en subcadenas ASCII.
- Validar JSX con `npm run build` (NO con node --check).

## Despliegue
Antes de cada push, traer remoto para evitar divergencias:

    git pull --no-rebase --no-edit origin main
    git add <archivos>
    git commit -m "mensaje"
    git push origin main
    vercel --prod

## Seguridad
- NUNCA exponer valores de .env (claves/secretos). Para revisar, listar solo NOMBRES.
- Hacer backup de .env.local antes de modificarlo.

## Estructura clave
- app/procesos/terminos/page.js  -> lista de terminos + panel de trabajo (Finanzas)
- app/procesos/terminos/[idadmon]/page.js -> workflow/grafo del termino (23 nodos)
- lib/pdfOrden.js, lib/ordenCondiciones.js -> PDF de la Orden de Visita
- lib/ejecutivos.js -> datos de contacto de vendedores (PI)
- Tabla `terminos` (clave: idadmon) -> datos del expediente de termino