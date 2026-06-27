# ============================================================================
# pieza4-canje.ps1
# Aplica la Pieza 4 (cruce de requerimientos con propiedades de CANJE)
# sobre app/requerimientos/page.js.
#
# Qué hace:
#   1. Carga propiedades_canje junto con publicaciones en cargarCartera().
#   2. Une ambas listas (propias + canje) para el matching.
#   3. En la tabla de matches: propias primero, luego canje, con badge de origen.
#   4. Las de canje NO se pueden agendar (no hay dirección): botón "Ver en corredor".
#   5. El conteo del kanban y los matches incluyen canje automáticamente.
#
# NO toca lib/matching.js (no hace falta: los campos de propiedades_canje
# coinciden con los que lee el motor).
#
# Uso (desde la raíz del repo):
#   powershell -ExecutionPolicy Bypass -File .\pieza4-canje.ps1
# ============================================================================

$ErrorActionPreference = 'Stop'
$path = "app\requerimientos\page.js"

if (-not (Test-Path $path)) {
  Write-Host "ERROR: no encuentro $path. Ejecuta el script desde la raíz del repo (C:\Users\altom\crm-arriendos)." -ForegroundColor Red
  exit 1
}

# Backup con timestamp
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = "$path.$stamp.bak"
Copy-Item $path $backup
Write-Host "Backup creado: $backup" -ForegroundColor Green

# Leer como UTF8 (sin romper acentos)
$txt = [System.IO.File]::ReadAllText((Resolve-Path $path), [System.Text.Encoding]::UTF8)
$orig = $txt

function Replace-Once {
  param([string]$find, [string]$repl, [string]$desc)
  $script:count = ([regex]::Matches($script:txt, [regex]::Escape($find))).Count
  if ($script:count -eq 0) {
    Write-Host "  [SALTADO] $desc - ancla no encontrada (¿ya aplicado?)." -ForegroundColor Yellow
    return
  }
  if ($script:count -gt 1) {
    Write-Host "  [AVISO] $desc - el ancla aparece $($script:count) veces; reemplazo solo la 1a." -ForegroundColor Yellow
    $idx = $script:txt.IndexOf($find)
    $script:txt = $script:txt.Substring(0,$idx) + $repl + $script:txt.Substring($idx + $find.Length)
  } else {
    $script:txt = $script:txt.Replace($find, $repl)
  }
  Write-Host "  [OK] $desc" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# CAMBIO 1 - Estado de cartera: añadir array de canje
# ---------------------------------------------------------------------------
Replace-Once `
  "const [cartera, setCartera] = useState({ pubs: [], edis: [], cargada: false, cargando: false })" `
  "const [cartera, setCartera] = useState({ pubs: [], edis: [], canje: [], cargada: false, cargando: false })" `
  "Cambio 1: estado de cartera con canje"

# ---------------------------------------------------------------------------
# CAMBIO 2 - cargarCartera(): traer también propiedades_canje y etiquetarlas
# Ancla: la línea que filtra venta y hace setCartera al final de cargarCartera.
# ---------------------------------------------------------------------------
$find2 = @'
    // solo venta (el motor igual descarta arriendo, pero filtramos para no traer "otro")
    const venta = todas.filter(p => sinTildes(p.objetivo).includes('venta'))
    setCartera({ pubs: venta, edis: edis || [], cargada: true, cargando: false })
'@
$repl2 = @'
    // solo venta (el motor igual descarta arriendo, pero filtramos para no traer "otro")
    const venta = todas.filter(p => sinTildes(p.objetivo).includes('venta'))
    // propiedades de canje (otros corredores). Mismos nombres de campo que publicaciones,
    // por eso el motor las procesa igual. Las marcamos con _origen y _corredor.
    let canje = []
    try {
      const { data: pc } = await supabase
        .from('propiedades_canje').select('*').eq('activa', true)
      canje = (pc || [])
        .filter(p => sinTildes(p.objetivo).includes('venta'))
        .map(p => ({ ...p, _origen: 'canje', _corredor: p.corredor_origen || 'Canje' }))
    } catch (e) { console.error('canje:', e) }
    setCartera({ pubs: venta, edis: edis || [], canje, cargada: true, cargando: false })
'@
Replace-Once $find2 $repl2 "Cambio 2: cargar propiedades_canje en cargarCartera()"

# ---------------------------------------------------------------------------
# CAMBIO 3 - matches (useMemo): unir propias + canje. Propias primero.
# buscarMatches ya ordena por grado; aquí concatenamos manteniendo el orden
# (primero el resultado de propias, después el de canje).
# ---------------------------------------------------------------------------
$find3 = @'
  const matches = useMemo(() => {
    if (!viendoMatches || !cartera.cargada) return null
    const res = buscarMatches(viendoMatches, cartera.pubs, cartera.edis, VALOR_UF)
'@
$repl3 = @'
  const matches = useMemo(() => {
    if (!viendoMatches || !cartera.cargada) return null
    const resPropias = buscarMatches(viendoMatches, cartera.pubs, cartera.edis, VALOR_UF)
    const resCanje = buscarMatches(viendoMatches, cartera.canje, [], VALOR_UF)
    const res = [...resPropias, ...resCanje] // propias primero, luego canje
'@
Replace-Once $find3 $repl3 "Cambio 3: unir propias + canje en matches (propias primero)"

# ---------------------------------------------------------------------------
# CAMBIO 4 - matchesCount (useMemo del kanban): contar también canje
# ---------------------------------------------------------------------------
$find4 = @'
    for (const r of reqs) {
      const res = buscarMatches(r, cartera.pubs, cartera.edis, VALOR_UF)
      const vistos = new Set()
'@
$repl4 = @'
    for (const r of reqs) {
      const res = [
        ...buscarMatches(r, cartera.pubs, cartera.edis, VALOR_UF),
        ...buscarMatches(r, cartera.canje, [], VALOR_UF),
      ]
      const vistos = new Set()
'@
Replace-Once $find4 $repl4 "Cambio 4: conteo del kanban incluye canje"

# ---------------------------------------------------------------------------
# CAMBIO 5 - dedupe en matches: las de canje no tienen dirección fiable,
# así que para canje deduplicamos por su id propio (no por comuna|dir|depto,
# que las colapsaría todas). Reemplazamos la construcción de la clave 'k'
# dentro del useMemo de matches.
# ---------------------------------------------------------------------------
$find5 = @'
    const vistos = new Set()
    const unicos = []
    for (const m of res) {
      const k = [sinTildes(m.pub.comuna), sinTildes(m.pub.direccionreal || m.pub.direccion), sinTildes(m.pub.departamento)].join('|')
      if (vistos.has(k)) continue
      vistos.add(k)
      unicos.push(m)
    }
    return unicos
  }, [viendoMatches, cartera])
'@
$repl5 = @'
    const vistos = new Set()
    const unicos = []
    for (const m of res) {
      const k = m.pub._origen === 'canje'
        ? 'canje:' + m.pub.id
        : [sinTildes(m.pub.comuna), sinTildes(m.pub.direccionreal || m.pub.direccion), sinTildes(m.pub.departamento)].join('|')
      if (vistos.has(k)) continue
      vistos.add(k)
      unicos.push(m)
    }
    return unicos
  }, [viendoMatches, cartera])
'@
Replace-Once $find5 $repl5 "Cambio 5: dedupe correcto para canje (por id)"

# ---------------------------------------------------------------------------
# CAMBIO 6 - Render de cada fila de match: badge de origen + botones según origen.
# Reemplazamos el bloque <td> de acciones (Agendar / Ver ficha) por uno que
# distingue propia vs canje, y añadimos el badge de origen en la celda Propiedad.
# ---------------------------------------------------------------------------
$find6 = @'
                  {matches.map(m => {
                    const p = m.pub
                    const dir = p.direccionreal || p.direccion || [p.calle, p.numero_calle].filter(Boolean).join(' ') || '—'
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#EAF3DE', color: '#3B6D11' }}>{m.grado}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1a1a2e' }}>
                          {p.tipo || '—'}<div style={{ fontWeight: 400, color: '#888', fontSize: 11 }}>{dir}{p.departamento ? ' · Depto ' + p.departamento : ''}</div>
                        </td>
'@
$repl6 = @'
                  {matches.map(m => {
                    const p = m.pub
                    const esCanje = p._origen === 'canje'
                    const dir = esCanje
                      ? (p.titulo || p.direccion || '—')
                      : (p.direccionreal || p.direccion || [p.calle, p.numero_calle].filter(Boolean).join(' ') || '—')
                    return (
                      <tr key={(esCanje ? 'c-' : 'p-') + p.id} style={{ borderBottom: '1px solid #F3F4F6', background: esCanje ? '#F7FAFF' : '#fff' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#EAF3DE', color: '#3B6D11' }}>{m.grado}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1a1a2e' }}>
                          <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, marginBottom: 3, marginRight: 6, background: esCanje ? '#E6F1FB' : '#EAF3DE', color: esCanje ? '#185FA5' : '#3B6D11', border: '1px solid ' + (esCanje ? '#bcdcf7' : '#cfe3b4') }}>{esCanje ? 'Canje · ' + (p._corredor || '') : 'Propia'}</span>
                          {p.tipo || '—'}<div style={{ fontWeight: 400, color: '#888', fontSize: 11 }}>{dir}{(!esCanje && p.departamento) ? ' · Depto ' + p.departamento : ''}{esCanje ? ' · dirección a confirmar con corredor' : ''}</div>
                        </td>
'@
Replace-Once $find6 $repl6 "Cambio 6: badge de origen + título/aviso en la fila"

# ---------------------------------------------------------------------------
# CAMBIO 7 - Botones de acción de la fila: propia (Agendar+Ficha) vs canje (Ver en corredor)
# ---------------------------------------------------------------------------
$find7 = @'
                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => abrirAgenda(viendoMatches, p)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed', cursor: 'pointer', marginRight: 6, fontFamily: 'inherit' }}>Agendar</button>
                          <button onClick={() => router.push('/publicaciones/' + p.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #185FA5', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', fontFamily: 'inherit' }}>Ver ficha →</button>
                        </td>
'@
$repl7 = @'
                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {esCanje ? (
                            p.url_original
                              ? <a href={p.url_original} target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #185FA5', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>Ver en {p._corredor || 'corredor'} →</a>
                              : <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>contactar corredor</span>
                          ) : (
                            <>
                              <button onClick={() => abrirAgenda(viendoMatches, p)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed', cursor: 'pointer', marginRight: 6, fontFamily: 'inherit' }}>Agendar</button>
                              <button onClick={() => router.push('/publicaciones/' + p.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #185FA5', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', fontFamily: 'inherit' }}>Ver ficha →</button>
                            </>
                          )}
                        </td>
'@
Replace-Once $find7 $repl7 "Cambio 7: botones segun origen (canje sin Agendar)"

# ---------------------------------------------------------------------------
# Guardar si hubo cambios
# ---------------------------------------------------------------------------
if ($txt -eq $orig) {
  Write-Host "`nNo se aplicó ningún cambio (¿ya estaba aplicado?). El archivo no se modificó." -ForegroundColor Yellow
  Remove-Item $backup
  exit 0
}

$utf8 = New-Object System.Text.UTF8Encoding($false)  # sin BOM
[System.IO.File]::WriteAllText((Resolve-Path $path), $txt, $utf8)
Write-Host "" 
Write-Host "Cambios aplicados y guardados en $path" -ForegroundColor Green
Write-Host "  (Backup en $backup por si quieres revertir.)" -ForegroundColor Gray
Write-Host ""
Write-Host "Ahora ejecuta: npm run build" -ForegroundColor Cyan
Write-Host "Si compila limpio: git add . y luego commit, push y vercel --prod" -ForegroundColor Cyan