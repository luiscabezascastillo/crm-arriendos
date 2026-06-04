import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase";

export async function GET() {
  try {
    const { data: resumen, error: errorResumen } = await supabaseAdmin
      .from("vw_control_asistencia_dashboard")
      .select("*")
      .order("trabajador", { ascending: true });

    if (errorResumen) throw errorResumen;

    const { data: tendencia, error: errorTendencia } = await supabaseAdmin
      .from("vw_control_asistencia_dashboard_3m")
      .select("*")
      .order("trabajador", { ascending: true })
      .order("mes", { ascending: false });

    if (errorTendencia) throw errorTendencia;

    const { data: incidencias, error: errorIncidencias } = await supabaseAdmin
      .from("control_asistencia_incidencias")
      .select(`
        id,
        fecha,
        tipo,
        estado,
        trabajador_id,
        control_asistencia_trabajadores (
          nombre_real
        )
      `)
      .eq("estado", "ABIERTA")
      .order("fecha", { ascending: false })
      .limit(50);

    if (errorIncidencias) throw errorIncidencias;

    const { data: detalle, error: errorDetalle } = await supabaseAdmin
      .from("vw_control_asistencia_cumplimiento")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(200);

    if (errorDetalle) throw errorDetalle;

    return NextResponse.json({
      ok: true,
      resumen,
      tendencia,
      incidencias,
      detalle,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || "Error cargando dashboard" },
      { status: 500 }
    );
  }
}