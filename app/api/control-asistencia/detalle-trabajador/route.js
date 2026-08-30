// VERSION: v2 · 2026-08-30 · Devuelve el detalle diario COMPLETO (2026) de un trabajador + el calendario laboral
//   global (para calcular la teórica semanal L-V, sin sumar sábados). GET ?id=TRABAJADOR_ID
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase";

export async function GET(req) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Falta id" }, { status: 400 });

    const [detRes, calRes] = await Promise.all([
      supabaseAdmin
        .from("vw_control_asistencia_cumplimiento")
        .select("*")
        .eq("trabajador_id", id)
        .gte("fecha", "2026-01-01")
        .order("fecha", { ascending: false })
        .limit(1000),
      supabaseAdmin
        .from("control_asistencia_calendario")
        .select("fecha, es_habil, horas_esperadas")
        .gte("fecha", "2026-01-01")
        .limit(500),
    ]);

    if (detRes.error) throw detRes.error;
    if (calRes.error) throw calRes.error;

    return NextResponse.json({ ok: true, detalle: detRes.data, calendario: calRes.data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message || "Error" }, { status: 500 });
  }
}
