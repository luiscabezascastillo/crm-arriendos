# Módulo: Liquidaciones a propietarios (ADMON360) — DISEÑO

> Estado: análisis hecho, **no construido**. Retomar con la señal "CONTINUAR CON ADMON360".

## Sistema actual a migrar (Excel)
- **Fuentes:** LOG → `datos_arriendos`, `propietarios`; BI.xlsm → tabla `bi`; BD_DESCUENTOS.xlsm → tabla `descuentos`.
- **ADMON360 5.0.0.xlsm** (motor): produce 4 hojas — **N_TRANSFER** (a pagar a cada propietario; base para Finanzas), **N_FALTAN** (lo que falta por recibir), **N_CARTAS** (filas por propietario para cartas), **csv_SF** (CSV para subir facturas a SimpleFactura).
- **APP-VISION.xlsm**: vista de solo lectura de ADMON360 para empleados.
- **APP-LIQUIDACIONES-2026.xlsm**: envía los emails de liquidación mensual a propietarios.

## Decisiones de arquitectura (acordadas)
- **No replicar los 3 Excel como 3 módulos.** Construir solo el motor (ADMON360) como módulo de Liquidaciones.
  - APP-VISION desaparece → se resuelve con permisos/roles de lectura.
  - APP-LIQUIDACIONES = botón "enviar" de la pantalla (patrón de Notificaciones).
  - N_FALTAN, N_CARTAS, csv_SF = vistas/exportaciones de la liquidación cerrada.
- **Cálculo materializado** (no al vuelo): se "cierra" la liquidación del mes y queda guardada e inmutable en una tabla `liquidaciones`. Razón: hay dinero saliendo; Finanzas necesita un número fijo.
- Pantalla = patrón de Notificaciones (tabla calculada, filtrable, con detalle expandible por fila; mostrar ~10 columnas de las ~50 de N_TRANSFER).

## Cálculo de N_TRANSFER (descodificado del VBA `TRANSFER`)
1. **Base (col F):** contratos estado S; importe = `cuota × factor_UF + reajustes` (idéntico al de Notificaciones).
2. **Ajustes especiales:** `PAGADOHASTA` → base 0; `COBRAREXTRA` → suma extra; contrato iniciado a mitad de mes → prorrateo por días (`base × días_restantes / días_mes`).
3. **Comisión administración (col L) e IVA (col M):** comisión tipo "F" → fija; si no → `% × base`. IVA → `comisión × 0,19` si el propietario lleva IVA.
4. **Recibido del banco (col G):** de `bi`, movimientos del mes con código `A00*` e importe ≠ 0, agrupado por IDADMON.
5. **Descuentos a propietarios (col I):** de `descuentos`, filtra mes + tipo PROPIETARIO, agrupa por IDADMON, suma y concatena conceptos.
6. **Neto a transferir:** `F − L − M` (solo si gestión = "FCR"). Para propietarios con varios inmuebles se agrupan filas y la última lleva la suma. Si el resultado `≥ −2000` → se marca "TRANSFERIR".
7. **Tipo de facturación:** de `propietarios` (tipo 33/39); los IDINMUE que empiezan por `P001` no se facturan.

## Pendiente antes de construir
**Preguntas de negocio a confirmar:**
1. ¿La fórmula final es `base − comisión − IVA − descuentos`? ¿El número que usa Finanzas es la columna "TRANSFERIR"?
2. ¿El umbral `≥ −2000` es tolerancia de redondeo?
3. FALTA (`H = F − G`): ¿se transfiere el neto aunque el arrendatario no haya pagado todo (las marcas "OJO, FALTA PAGO" solo avisan)?

**Datos a obtener de Supabase** (`select` de columnas):
- `bi`: importe recibido, IDADMON/glosa con `A00*`, mes.
- `descuentos`: monto, IDADMON, mes, tipo (PROPIETARIO/OTROS), concepto.
- `propietarios`: tipo de facturación (33/39), marca de IVA, comisión fija vs %.
- Confirmar si las columnas de comisión (%, fija, IVA) viven en `datos_arriendos` o en `propietarios`.
