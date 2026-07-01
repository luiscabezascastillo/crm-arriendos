-- ============================================================
-- ADMON360 · MOTOR DE CÁLCULO v3.1  (2026-07-01)
-- ------------------------------------------------------------
-- CAMBIO v3.1: el recibido se cruza por bi.liquidacion_mes2 (mes de
-- liquidacion, que hacia el dia 23 ya apunta al mes siguiente), NO por bi.mes
-- (mes natural del movimiento). Asi julio recoge los pagos marcados a 2607.
--
-- CAMBIO v3: la comisión depende SOLO del porcentaje (pct_adm) o del
-- importe fijo (si_fijo_admon), NO de quien_cobra. 'quien_cobra' es solo
-- informativo (quién percibe la comisión). Si pct_adm=0 -> comisión 0.
-- Esto es conceptualmente correcto: la comisión es la comisión, cobre FCR
-- o el dueño. Hoy no cambia ningún número (no hay DUEÑO con pct_adm>0).
--
-- (v2) los campos de importe YA son numeric en la BD
-- (cuota, uf_peso_factor, pct_adm, cantidad_reajusteN, monto_a_transferir).
-- La versión anterior los pasaba por nz() forzando ::text, y una regex
-- rota los convertía en 0 -> por eso el cálculo salía vacío/incorrecto.
-- Esta versión usa los numeric DIRECTOS. Solo convierte los pocos text
-- que quedan (si_fijo_admon, y bi.arriendo por si viene como texto).
--
-- Uso:  SELECT * FROM calcular_liquidacion('2501');
-- (ya viene ordenado por propietario, luego inmueble)
-- ============================================================

-- Helper mínimo: text -> numeric, tolerante (solo para los pocos campos text).
CREATE OR REPLACE FUNCTION txt_num(v text)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE
AS $func$
DECLARE s text;
BEGIN
  IF v IS NULL THEN RETURN 0; END IF;
  s := btrim(v);
  IF s IN ('', '=', '-', '.', 'null', 'NULL') THEN RETURN 0; END IF;
  -- quitar todo salvo dígitos, punto, coma, signo; coma -> punto decimal
  s := replace(regexp_replace(s, '[^0-9.,-]', '', 'g'), ',', '.');
  IF s IN ('', '-', '.') THEN RETURN 0; END IF;
  BEGIN RETURN s::numeric; EXCEPTION WHEN others THEN RETURN 0; END;
END;
$func$;

CREATE OR REPLACE FUNCTION calcular_liquidacion(p_mes text)
RETURNS TABLE (
  idadmon           text,
  idprop            text,
  propietario       text,
  inmueble          text,
  unid              text,
  base              numeric,
  pct_o_fijo        text,
  comision          numeric,
  iva_comision      numeric,
  total_descuentos  numeric,
  neto_transferir   numeric,
  recibido_banco    numeric,
  falta             numeric,
  hubo_falta        boolean
)
LANGUAGE sql
AS $func$
  WITH
  contratos AS (
    SELECT
      d.idadmon, d.idprop, d.propietario, d.inmueble,
      upper(coalesce(d.unid,'')) AS unid,
      -- BASE: UF -> cuota*factor ; pesos -> cuota + reajustes (todos numeric, directos)
      CASE
        WHEN upper(coalesce(d.unid,'')) = 'UF'
          THEN coalesce(d.cuota,0) * coalesce(d.uf_peso_factor,0)
        ELSE
          coalesce(d.cuota,0)
          + coalesce(d.cantidad_reajuste1,0) + coalesce(d.cantidad_reajuste2,0)
          + coalesce(d.cantidad_reajuste3,0) + coalesce(d.cantidad_reajuste4,0)
          + coalesce(d.cantidad_reajuste5,0) + coalesce(d.cantidad_reajuste6,0)
      END AS base,
      d.quien_cobra,
      coalesce(d.pct_adm,0) AS pct_adm,
      d.si_fijo_admon,
      upper(coalesce(d.adicionar_iva,'')) AS adicionar_iva
    FROM datos_arriendos d
    JOIN propietarios p ON p.idprop = d.idprop
    WHERE d.estado = 'S'
      AND coalesce(p.activo,'') = 'SI'
      AND d.idadmon <> 'A00999'
  ),
  con_comision AS (
    SELECT c.*,
      CASE
        WHEN c.si_fijo_admon IS NOT NULL AND btrim(c.si_fijo_admon) <> ''
          THEN txt_num(c.si_fijo_admon)
        ELSE round(c.base * c.pct_adm)
      END AS comision_calc,
      CASE
        WHEN c.si_fijo_admon IS NOT NULL AND btrim(c.si_fijo_admon) <> ''
          THEN 'FIJO ' || c.si_fijo_admon
        ELSE (c.pct_adm*100)::text || '%'
      END AS pct_o_fijo_txt
    FROM contratos c
  ),
  con_iva AS (
    SELECT cc.*,
      CASE WHEN cc.adicionar_iva = 'SI'
           THEN round(cc.comision_calc * 0.19) ELSE 0 END AS iva_calc
    FROM con_comision cc
  ),
  desc_mes AS (
    SELECT ds.idadmon, sum(coalesce(ds.monto_a_transferir,0)) AS total_desc
    FROM descuentos ds
    WHERE upper(coalesce(ds.repercutir_a,'')) = 'PROPIETARIO'
      AND ds.relacionado = p_mes
    GROUP BY ds.idadmon
  ),
  recibido AS (
    SELECT b.idadmon2 AS idadmon, sum(txt_num(b.arriendo::text)) AS recibido_banco
    FROM bi b
    WHERE b.liquidacion_mes2 = p_mes
      AND upper(coalesce(b.centro_cb,'')) = 'ARRIENDO'
    GROUP BY b.idadmon2
  )
  SELECT
    ci.idadmon, ci.idprop, ci.propietario, ci.inmueble, ci.unid,
    round(ci.base) AS base,
    ci.pct_o_fijo_txt AS pct_o_fijo,
    ci.comision_calc AS comision,
    ci.iva_calc AS iva_comision,
    coalesce(dm.total_desc, 0) AS total_descuentos,
    round(ci.base - ci.comision_calc - ci.iva_calc - coalesce(dm.total_desc,0)) AS neto_transferir,
    coalesce(r.recibido_banco, 0) AS recibido_banco,
    round(ci.base - coalesce(r.recibido_banco,0)) AS falta,
    (ci.base - coalesce(r.recibido_banco,0) > 2000) AS hubo_falta
  FROM con_iva ci
  LEFT JOIN desc_mes dm ON dm.idadmon = ci.idadmon
  LEFT JOIN recibido r  ON r.idadmon  = ci.idadmon
  ORDER BY ci.propietario, ci.inmueble
$func$;

-- Prueba:
-- SELECT * FROM calcular_liquidacion('2501');