import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/src/lib/supabase";

export async function POST(request) {
  try {
    const session = await getServerSession();

    const body = await request.json();

    const {
      workflow_instance_id,
      node_codigo,
      comentarios,
      usuario_email,
    } = body;

    if (!workflow_instance_id || !node_codigo) {
      return NextResponse.json(
        { error: "Faltan workflow_instance_id o node_codigo" },
        { status: 400 }
      );
    }

    const usuario =
      usuario_email ||
      session?.user?.email ||
      "Usuario no identificado";

    const { error } = await supabaseAdmin.rpc("completar_workflow_task", {
      p_workflow_instance_id: workflow_instance_id,
      p_node_codigo: node_codigo,
      p_comentarios: comentarios || null,
      p_usuario: usuario,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Error inesperado" },
      { status: 500 }
    );
  }
}